/**
 * Razorpay webhooks + the admin Payments screen.
 *
 *   POST /api/payments/razorpay/webhook   Razorpay → us (raw body, signature-checked)
 *   GET  /api/payments/summary            admin: totals for the screen's header
 *   GET  /api/payments/orders             admin: checkouts, newest first (?status, ?q, ?page)
 *   GET  /api/payments/orders/:number     admin: one checkout with its payments
 */
import { Order, ORDER_STATUSES } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { Subscription } from "../models/Subscription.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { razorpay, verifyWebhookSignature } from "../utils/razorpay.js";
import {
  applySubscriptionEntity,
  findOrderByGatewayId,
  findSubscription,
  markOrderPaid,
  orderForSubscription,
  recordPayment,
  syncOrderRefund,
} from "../services/billing.js";

// ---- webhook ---------------------------------------------------------------

/** payment.*, order.paid, refund.*: a one-time checkout's payment, or a refund on any payment. */
async function handlePayment(entity) {
  const order = await findOrderByGatewayId(entity.order_id);
  const existing = await Payment.findOne({ gateway: "razorpay", gatewayPaymentId: entity.id });
  // A subscription charge also fires payment.* with Razorpay's own order id;
  // subscription.charged records it. Only refunds on it are applied here.
  if (!order && !existing) return;

  const linkedOrder = order ?? (existing?.order ? await Order.findById(existing.order) : null);
  const record = await recordPayment(entity, { order: linkedOrder });
  if (linkedOrder) {
    if (record.status === "captured") await markOrderPaid(linkedOrder, record.paidAt);
    await syncOrderRefund(linkedOrder, record);
  }
}

/** subscription.*: mirror the subscription; subscription.charged also carries the payment. */
async function handleSubscription(subEntity, paymentEntity) {
  const subscription = await findSubscription(subEntity.id);
  if (!subscription) return;

  // Events can arrive out of order; the live entity is the truth.
  const fresh = await razorpay.fetchSubscription(subEntity.id).catch(() => subEntity);
  await applySubscriptionEntity(subscription, fresh);

  if (!paymentEntity) return;
  const order = await orderForSubscription(subscription);
  const first = order && (order.status === "created" || order.status === "failed");
  const record = await recordPayment(paymentEntity, { order: first ? order : null, subscription });
  if (first && record.status === "captured") await markOrderPaid(order, record.paidAt);
}

async function applyEvent(body) {
  const payload = body.payload ?? {};
  const payment = payload.payment?.entity;
  const subscription = payload.subscription?.entity;

  if (body.event.startsWith("subscription.") && subscription) return handleSubscription(subscription, payment);
  if (payment) return handlePayment(payment);
}

/** POST /api/payments/razorpay/webhook — mounted with express.raw(), before express.json(). */
export async function razorpayWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  if (!verifyWebhookSignature(raw, req.get("x-razorpay-signature"))) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  let body;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Webhook body is not JSON" });
  }
  if (!body?.event) return res.status(400).json({ error: "Webhook has no event" });

  const entityId = body.payload?.payment?.entity?.id ?? body.payload?.subscription?.entity?.id ?? "";
  const eventId = req.get("x-razorpay-event-id") || `${body.event}:${entityId}:${body.created_at ?? ""}`;

  let record;
  try {
    record = await WebhookEvent.create({ gateway: "razorpay", eventId, event: body.event, payload: body });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    record = await WebhookEvent.findOne({ gateway: "razorpay", eventId });
    if (record?.processedAt) return res.json({ received: true, duplicate: true });
  }

  try {
    await applyEvent(body);
    record.processedAt = new Date();
    record.error = undefined;
    await record.save();
    res.json({ received: true });
  } catch (err) {
    record.error = String(err?.message ?? err).slice(0, 500);
    await record.save().catch(() => {});
    console.error(`Razorpay webhook ${body.event} (${eventId}) failed:`, err);
    // Non-2xx makes Razorpay retry the delivery later.
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

// ---- admin -----------------------------------------------------------------

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Captured minus refunded, per order (first charge + every renewal of its subscription). */
async function paymentTotals(orders) {
  const subIds = orders.map((o) => o.subscription).filter(Boolean);
  const payments = await Payment.find({ $or: [{ order: { $in: orders.map((o) => o._id) } }, { subscription: { $in: subIds } }] });
  return new Map(
    orders.map((o) => {
      const mine = payments.filter((p) => String(p.order) === String(o._id) || (o.subscription && String(p.subscription) === String(o.subscription)));
      const collected = mine
        .filter((p) => ["captured", "partially_refunded", "refunded"].includes(p.status))
        .reduce((sum, p) => sum + p.amount - (p.refundedAmount ?? 0), 0);
      return [String(o._id), { payments: mine.length, collected }];
    })
  );
}

/** GET /api/payments/orders */
export async function listOrders(req, res) {
  const { status, q } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));

  const filter = {};
  if (status) {
    if (!ORDER_STATUSES.includes(status)) throw badRequest(`status must be one of ${ORDER_STATUSES.join(", ")}`);
    filter.status = status;
  }
  if (q && String(q).trim()) {
    const rx = new RegExp(escapeRegex(String(q).trim().slice(0, 80)), "i");
    filter.$or = [{ number: rx }, { "billing.name": rx }, { "billing.email": rx }, { "billing.phone": rx }, { "billing.company": rx }, { "item.packageName": rx }];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("subscription", "status currentPeriodEnd paidCycles totalCycles gatewaySubscriptionId"),
    Order.countDocuments(filter),
  ]);
  const totals = await paymentTotals(orders.map((o) => ({ _id: o._id, subscription: o.subscription?._id })));

  res.json({
    data: orders.map((o) => ({ ...o.toJSON(), ...totals.get(String(o._id)) })),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}

/** GET /api/payments/orders/:number */
export async function getOrder(req, res) {
  const order = await Order.findOne({ number: req.params.number }).populate("customer").populate("subscription");
  if (!order) throw notFound("Order not found");
  const payments = await Payment.find({
    $or: [{ order: order._id }, ...(order.subscription ? [{ subscription: order.subscription._id }] : [])],
  }).sort({ createdAt: -1 });
  res.json({ data: { ...order.toJSON(), payments: payments.map((p) => p.toJSON()) } });
}

/** GET /api/payments/summary */
export async function getSummary(_req, res) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const net = (match) =>
    Payment.aggregate([
      { $match: { status: { $in: ["captured", "partially_refunded", "refunded"] }, ...match } },
      { $group: { _id: null, total: { $sum: { $subtract: ["$amount", { $ifNull: ["$refundedAmount", 0] }] } } } },
    ]).then((r) => r[0]?.total ?? 0);

  const [allTime, thisMonth, paidOrders, activeSubscriptions] = await Promise.all([
    net({}),
    net({ paidAt: { $gte: monthStart } }),
    Order.countDocuments({ status: { $in: ["paid", "partially_refunded"] } }),
    Subscription.countDocuments({ status: "active" }),
  ]);
  res.json({ data: { currency: "INR", collected: { allTime, thisMonth }, paidOrders, activeSubscriptions } });
}
