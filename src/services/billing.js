/**
 * Applies what Razorpay reports to our Order / Subscription / Payment records.
 * Used by both the checkout "verify" call (the browser, right after paying)
 * and the webhooks (Razorpay's server, possibly later, possibly repeated), so
 * every write here is idempotent and never moves a record backwards.
 */
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { Subscription } from "../models/Subscription.js";

const GATEWAY = "razorpay";
const fromUnix = (seconds) => (seconds ? new Date(seconds * 1000) : undefined);

// A payment only moves forward: created → authorized → captured → (partially_)refunded.
const PAYMENT_RANK = { created: 0, failed: 1, authorized: 1, captured: 2, partially_refunded: 3, refunded: 4 };

function paymentStatus(entity) {
  const refunded = entity.amount_refunded ?? 0;
  if (refunded > 0) return refunded >= entity.amount ? "refunded" : "partially_refunded";
  return ["created", "authorized", "captured", "failed"].includes(entity.status) ? entity.status : "created";
}

/**
 * Upserts one Razorpay payment entity, linked to its order and/or
 * subscription. Returns the Payment document.
 */
export async function recordPayment(entity, { order, subscription }) {
  const status = paymentStatus(entity);
  const existing = await Payment.findOne({ gateway: GATEWAY, gatewayPaymentId: entity.id });

  if (existing) {
    if (PAYMENT_RANK[status] >= PAYMENT_RANK[existing.status]) existing.status = status;
    existing.refundedAmount = Math.max(existing.refundedAmount ?? 0, entity.amount_refunded ?? 0);
    existing.method = entity.method || existing.method;
    if (status === "failed") existing.failureReason = entity.error_description || existing.failureReason;
    if (!existing.paidAt && (status === "captured" || existing.status === "captured")) existing.paidAt = fromUnix(entity.created_at) ?? new Date();
    if (!existing.order && order) existing.order = order._id;
    if (!existing.subscription && subscription) existing.subscription = subscription._id;
    existing.raw = entity;
    return existing.save();
  }

  const customer = order?.customer ?? subscription?.customer;
  try {
    return await Payment.create({
      customer,
      order: order?._id,
      subscription: subscription?._id,
      amount: entity.amount,
      currency: entity.currency,
      refundedAmount: entity.amount_refunded ?? 0,
      status,
      method: entity.method,
      gateway: GATEWAY,
      gatewayPaymentId: entity.id,
      failureReason: status === "failed" ? entity.error_description : undefined,
      paidAt: status === "captured" ? fromUnix(entity.created_at) ?? new Date() : undefined,
      raw: entity,
    });
  } catch (err) {
    // Verify and a webhook raced to insert the same payment: apply to the winner.
    if (err?.code === 11000) return recordPayment(entity, { order, subscription });
    throw err;
  }
}

/** Marks a checkout paid (first successful charge). Never un-pays or overrides a refund. */
export async function markOrderPaid(order, paidAt = new Date()) {
  if (order.status !== "created" && order.status !== "failed") return order;
  order.status = "paid";
  order.paidAt = order.paidAt ?? paidAt;
  return order.save();
}

/** Reflects a refund on the order once its payment is (partially) refunded. */
export async function syncOrderRefund(order, payment) {
  if (!order || order.status === "refunded") return order;
  if (payment.status === "refunded") order.status = "refunded";
  else if (payment.status === "partially_refunded") order.status = "partially_refunded";
  else return order;
  return order.save();
}

const SUBSCRIPTION_STATUS = {
  created: "created",
  authenticated: "created",
  active: "active",
  pending: "past_due",
  halted: "halted",
  paused: "paused",
  cancelled: "cancelled",
  completed: "completed",
  expired: "expired",
};

/** Copies a Razorpay subscription entity onto our Subscription. */
export async function applySubscriptionEntity(subscription, entity) {
  const status = SUBSCRIPTION_STATUS[entity.status];
  if (status) subscription.status = status;
  if (entity.total_count) subscription.totalCycles = entity.total_count;
  if (typeof entity.paid_count === "number") subscription.paidCycles = entity.paid_count;
  if (entity.current_start) subscription.currentPeriodStart = fromUnix(entity.current_start);
  if (entity.current_end) subscription.currentPeriodEnd = fromUnix(entity.current_end);
  if (status === "active" && !subscription.startedAt) subscription.startedAt = fromUnix(entity.start_at) ?? new Date();
  if (status === "cancelled" && !subscription.cancelledAt) subscription.cancelledAt = new Date();
  if (["cancelled", "completed", "expired"].includes(status) && !subscription.endedAt) {
    subscription.endedAt = fromUnix(entity.ended_at) ?? new Date();
  }
  if (!subscription.gatewayPlanId && entity.plan_id) subscription.gatewayPlanId = entity.plan_id;
  return subscription.save();
}

/** The checkout Order a subscription was started from. */
export const orderForSubscription = (subscription) => Order.findOne({ subscription: subscription._id });

export const findSubscription = (gatewaySubscriptionId) =>
  gatewaySubscriptionId ? Subscription.findOne({ gateway: GATEWAY, gatewaySubscriptionId }) : null;

export const findOrderByGatewayId = (gatewayOrderId) =>
  gatewayOrderId ? Order.findOne({ gateway: GATEWAY, gatewayOrderId }) : null;
