import mongoose from "mongoose";
import { GATEWAYS, purchaseSnapshotSchema } from "./schemas/purchaseSnapshot.js";

/**
 * A recurring package being billed every period. The gateway owns the
 * schedule and retries; this mirrors its state from webhooks.
 *
 *   created ─▶ active ─▶ past_due ─▶ active
 *                 │          └────▶ cancelled
 *                 ├─▶ paused ─▶ active
 *                 ├─▶ cancelled            (by admin/customer)
 *                 └─▶ completed            (fixed number of cycles ran out)
 *
 * Razorpay: pending → past_due (a renewal failed, retrying); halted → halted
 * (retries ran out; no more charges until the customer updates the mandate).
 */
export const SUBSCRIPTION_STATUSES = ["created", "active", "past_due", "halted", "paused", "cancelled", "completed", "expired"];

const subscriptionSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    item: { type: purchaseSnapshotSchema, required: true },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "created", index: true },
    // Cycles to bill (a minimum contract); null = until cancelled.
    totalCycles: { type: Number, default: null, min: 1 },
    paidCycles: { type: Number, default: 0, min: 0 },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date, index: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    startedAt: { type: Date },
    cancelledAt: { type: Date },
    endedAt: { type: Date },
    gateway: { type: String, enum: GATEWAYS, required: true },
    gatewaySubscriptionId: { type: String }, // razorpay sub_xxx / stripe sub_xxx
    gatewayPlanId: { type: String }, // razorpay plan_xxx / stripe price_xxx
  },
  { timestamps: true }
);

subscriptionSchema.index(
  { gateway: 1, gatewaySubscriptionId: 1 },
  { unique: true, partialFilterExpression: { gatewaySubscriptionId: { $type: "string" } } }
);
subscriptionSchema.index({ "item.package": 1 });

subscriptionSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
