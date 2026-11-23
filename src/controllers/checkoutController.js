/**
 * Public checkout: the website's "Pay now" calls these through its own
 * /api/checkout proxy.
 *
 *   POST /api/checkout                    price the package on the server, save the
 *                                         buyer + an Order, and open a Razorpay order
 *                                         (one-time) or subscription (recurring)
 *   POST /api/checkout/verify             check Checkout's signature and record the payment
 *   GET  /api/checkout/orders/:number     the confirmation page's view of one order
 *
 * The browser only ever names a package, plan and billing period: the amount
 * comes from utils/pricing.js. Payments are INR only, GST always included.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { Customer } from "../models/Customer.js";
import { Order } from "../models/Order.js";
import { Package } from "../models/Package.js";
import { Payment } from "../models/Payment.js";
import { PackageSettings } from "../models/PackageSettings.js";
import { Subscription } from "../models/Subscription.js";
import { badRequest, HttpError, notFound } from "../utils/httpError.js";
import { quote } from "../utils/pricing.js";
import { planPeriod, razorpay, razorpayConfigured, verifyCheckoutSignature } from "../utils/razorpay.js";
import { applySubscriptionEntity, markOrderPaid, recordPayment } from "../services/billing.js";

const CURRENCY = "INR";
const MERCHANT_NAME = "VD Infotech";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^(?:\+?91[\s-]?)?[6-9]\d{9}$/; // Indian mobile
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PIN = /^[1-9]\d{5}$/;

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** The buyer's details from the checkout form; throws 400 listing every problem. */
function readBuyer(body) {
  const b = body?.customer ?? {};
  const a = b.address ?? {};
  const buyer = {
    name: text(b.name, 120),
    email: text(b.email, 254).toLowerCase(),
    phone: text(b.phone, 20).replace(/[\s-]/g, ""),
    company: text(b.company, 160),
    gstin: text(b.gstin, 15).toUpperCase(),
    address: {
      line1: text(a.line1, 200),
      line2: text(a.line2, 200),
      city: text(a.city, 80),
      state: text(a.state, 80),
      postalCode: text(a.postalCode, 10),
      country: "IN",
    },
  };

  const errors = {};
  if (buyer.name.length < 2) errors.name = "Enter your full name.";
  if (!EMAIL.test(buyer.email)) errors.email = "Enter a valid email address.";
  if (!PHONE.test(buyer.phone)) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (buyer.gstin && !GSTIN.test(buyer.gstin)) errors.gstin = "Enter a valid 15-character GSTIN, or leave it empty.";
  if (buyer.address.postalCode && !PIN.test(buyer.address.postalCode)) errors.postalCode = "Enter a valid 6-digit PIN code.";
  if (Object.keys(errors).length) throw badRequest("Please check your details", errors);
  return buyer;
}

/** Saves (or refreshes) the buyer, keyed by email. Empty optional fields never wipe saved ones. */
async function upsertCustomer(buyer) {
  const set = { name: buyer.name, phone: buyer.phone };
  if (buyer.company) set.company = buyer.company;
  if (buyer.gstin) set.gstin = buyer.gstin;
  if (buyer.address.line1 || buyer.address.city || buyer.address.state || buyer.address.postalCode) {
    set.billingAddress = buyer.address;
  }
  return Customer.findOneAndUpdate({ email: buyer.email }, { $set: set }, { upsert: true, new: true, runValidators: true });
}

/** e.g. "VD-261121-7KQ2XM": date + 6 random characters (no 0/O/1/I). */
function orderNumber(now = new Date()) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, "");
  return `VD-${ymd}-${suffix}`;
}

/** The frozen line item stored on the order / subscription. */
function snapshot(pkg, q) {
  return {
    package: pkg._id,
    packageSlug: pkg.slug,
    packageName: pkg.name,
    plan: q.plan,
    planLabel: q.planLabel,
    billingType: q.billingType,
    period: q.period?.id,
    periodMonths: q.period?.months,
    currency: q.currency,
    amountNet: q.amountMinor.net,
    amountTax: q.amountMinor.tax,
    amountTotal: q.amountMinor.total,
    taxRate: q.taxRate,
    taxLabel: q.taxLabel,
  };
}

/**
 * One Razorpay plan per package / plan / period / amount, created on first
 * use and remembered on the package (`gateway.razorpay.plans`). A price change
 * gives a new amount and so a new plan; existing subscriptions keep theirs.
 */
async function razorpayPlanFor(pkg, q) {
  const key = `${q.plan}_${q.period.id}_${q.amountMinor.total}`;
  const known = pkg.gateway?.razorpay?.plans?.[key];
  if (known) return known;

  const plan = await razorpay.createPlan({
    ...planPeriod(q.period.months),
    item: {
      name: `${pkg.name} – ${q.planLabel} (${q.period.label})`.slice(0, 120),
      amount: q.amountMinor.total,
      currency: CURRENCY,
      description: `${q.period.label} billing, ${q.taxLabel} included`,
    },
    notes: { package: pkg.slug, plan: q.plan, period: q.period.id },
  });
  await Package.updateOne({ _id: pkg._id }, { $set: { [`gateway.razorpay.plans.${key}`]: plan.id } });
  return plan.id;
}

/** POST /api/checkout */
export async function createCheckout(req, res) {
  if (!razorpayConfigured()) throw new HttpError(503, "Online payments are not available yet. Please contact us to complete your purchase.");

  const slug = text(req.body?.package, 120);
  const plan = text(req.body?.plan, 40);
  const period = text(req.body?.period, 40) || undefined;
  if (!slug || !plan) throw badRequest("package and plan are required");

  const [settings, pkg] = await Promise.all([
    PackageSettings.findOne({ key: "default" }),
    Package.findOne({ slug, status: "published" }),
  ]);
  if (!settings) throw new HttpError(503, "Package settings are missing on the server.");
  if (!pkg) throw notFound("This package is no longer available.");

  const buyer = readBuyer(req.body);

  let q;
  try {
    q = quote(settings, pkg, { plan, period, currency: CURRENCY, withTax: true });
  } catch (err) {
    if (err.status === 400) throw badRequest(err.message);
    throw err;
  }
  if (q.amountMinor.total < 100) throw badRequest("This plan has no payable amount.");

  const customer = await upsertCustomer(buyer);
  const item = snapshot(pkg, q);
  const number = orderNumber();
  const accessToken = randomBytes(24).toString("hex");
  const notes = { order: number, package: pkg.slug, plan: q.plan, ...(q.period ? { period: q.period.id } : {}) };
  const description = q.period ? `${pkg.name} – ${q.planLabel}, billed ${q.period.label.toLowerCase()}` : `${pkg.name} – ${q.planLabel}`;

  const base = {
    number,
    accessToken,
    keyId: env.razorpay.keyId,
    amount: q.amountMinor.total,
    currency: CURRENCY,
    name: MERCHANT_NAME,
    description,
    // Razorpay expects the country code on the mobile number.
    prefill: { name: buyer.name, email: buyer.email, contact: `+91${buyer.phone.slice(-10)}` },
    notes,
  };

  if (q.billingType === "one_time") {
    const rzpOrder = await razorpay.createOrder({ amount: q.amountMinor.total, currency: CURRENCY, receipt: number, notes });
    await Order.create({
      number,
      accessToken,
      customer: customer._id,
      billing: buyer,
      item,
      gateway: "razorpay",
      gatewayOrderId: rzpOrder.id,
    });
    return res.status(201).json({ data: { ...base, mode: "order", orderId: rzpOrder.id } });
  }

  // Recurring: an auto-renewing Razorpay subscription. The first charge is
  // taken when the buyer authorises the mandate in Checkout.
  const planId = await razorpayPlanFor(pkg, q);
  const totalCount = Math.max(1, Math.floor(env.subscriptionTermMonths / q.period.months));
  const rzpSub = await razorpay.createSubscription({ plan_id: planId, total_count: totalCount, quantity: 1, customer_notify: 1, notes });

  const subscription = await Subscription.create({
    customer: customer._id,
    item,
    totalCycles: totalCount,
    gateway: "razorpay",
    gatewaySubscriptionId: rzpSub.id,
    gatewayPlanId: planId,
  });
  await Order.create({
    number,
    accessToken,
    customer: customer._id,
    billing: buyer,
    item,
    subscription: subscription._id,
    gateway: "razorpay",
  });
  res.status(201).json({ data: { ...base, mode: "subscription", subscriptionId: rzpSub.id } });
}

function tokenMatches(given, expected) {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(String(expected ?? ""));
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/** Loads an order by number, but only for the holder of its access token. */
async function orderForToken(number, token) {
  const order = await Order.findOne({ number: text(number, 40) }).select("+accessToken");
  if (!order || !tokenMatches(token, order.accessToken)) throw notFound("Order not found");
  return order;
}

/** POST /api/checkout/verify — body: { number, token, paymentId, signature } */
export async function verifyCheckout(req, res) {
  const { number, token, paymentId, signature } = req.body ?? {};
  const order = await orderForToken(number, token);
  const subscription = order.subscription ? await Subscription.findById(order.subscription) : null;

  // Signed over the ids we stored when the checkout was created, never ids the browser sends.
  const valid = verifyCheckoutSignature({
    orderId: order.gatewayOrderId,
    subscriptionId: subscription?.gatewaySubscriptionId,
    paymentId: text(paymentId, 40),
    signature: text(signature, 128),
  });
  if (!valid) throw badRequest("We could not verify this payment. If money was deducted, contact us with your order number.");

  let payment = await razorpay.fetchPayment(text(paymentId, 40));
  // One-time orders: capture an authorised payment ourselves in case the
  // account is set to manual capture (Razorpay auto-refunds uncaptured ones).
  if (!subscription && payment.status === "authorized" && payment.amount === order.item.amountTotal) {
    payment = await razorpay.capturePayment(payment.id, payment.amount, payment.currency);
  }

  const record = await recordPayment(payment, { order, subscription });
  if (record.status === "captured") await markOrderPaid(order, record.paidAt);
  if (subscription) {
    const entity = await razorpay.fetchSubscription(subscription.gatewaySubscriptionId).catch(() => null);
    if (entity) await applySubscriptionEntity(subscription, entity);
  }

  res.json({ data: { number: order.number, status: order.status } });
}

/** GET /api/checkout/orders/:number?token= — what the confirmation page shows. */
export async function getCheckoutOrder(req, res) {
  const order = await orderForToken(req.params.number, req.query.token);
  const [subscription, payment] = await Promise.all([
    order.subscription ? Subscription.findById(order.subscription) : null,
    Payment.findOne({ order: order._id }).sort({ createdAt: 1 }),
  ]);

  res.json({
    data: {
      number: order.number,
      status: order.status,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      item: {
        packageSlug: order.item.packageSlug,
        packageName: order.item.packageName,
        planLabel: order.item.planLabel,
        billingType: order.item.billingType,
        periodMonths: order.item.periodMonths,
        currency: order.item.currency,
        amountNet: order.item.amountNet,
        amountTax: order.item.amountTax,
        amountTotal: order.item.amountTotal,
        taxLabel: order.item.taxLabel,
        taxRate: order.item.taxRate,
      },
      billing: { name: order.billing?.name, email: order.billing?.email },
      subscription: subscription && {
        status: subscription.status,
        totalCycles: subscription.totalCycles,
        paidCycles: subscription.paidCycles,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      payment: payment && { id: payment.gatewayPaymentId, status: payment.status, method: payment.method, failureReason: payment.failureReason },
    },
  });
}
