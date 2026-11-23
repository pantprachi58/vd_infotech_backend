import mongoose from "mongoose";
import { GATEWAYS } from "./schemas/purchaseSnapshot.js";

/**
 * One money movement reported by the gateway — the first charge of an order,
 * or one renewal of a subscription. Written from verified webhooks only, and
 * keyed by the gateway's payment id so a re-delivered webhook is a no-op.
 */
export const PAYMENT_STATUSES = ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"];

const paymentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", index: true },
    amount: { type: Number, required: true, min: 0 }, // minor units
    currency: { type: String, required: true, uppercase: true },
    refundedAmount: { type: Number, default: 0, min: 0 }, // minor units
    status: { type: String, enum: PAYMENT_STATUSES, default: "created", index: true },
    method: { type: String }, // card, upi, netbanking …
    gateway: { type: String, enum: GATEWAYS, required: true },
    gatewayPaymentId: { type: String, required: true },
    failureReason: { type: String },
    paidAt: { type: Date },
    // Last raw gateway payload, for support and reconciliation.
    raw: { type: mongoose.Schema.Types.Mixed, select: false },
  },
  { timestamps: true }
);

paymentSchema.index({ gateway: 1, gatewayPaymentId: 1 }, { unique: true });

paymentSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.raw;
    return ret;
  },
});

export const Payment = mongoose.model("Payment", paymentSchema);
