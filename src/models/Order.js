import mongoose from "mongoose";
import { GATEWAYS, purchaseSnapshotSchema } from "./schemas/purchaseSnapshot.js";

/**
 * One checkout. A one-time package is paid through its order; a recurring one
 * starts here too (the first charge) and links the Subscription it created.
 *
 *   created ─▶ paid ─▶ refunded / partially_refunded
 *      └────▶ failed / cancelled / expired
 */
export const ORDER_STATUSES = ["created", "paid", "failed", "cancelled", "expired", "refunded", "partially_refunded"];

const orderSchema = new mongoose.Schema(
  {
    // Human-readable, e.g. "VD-2026-000123" — what invoices and emails quote.
    number: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    item: { type: purchaseSnapshotSchema, required: true },
    // Who it was billed to, as entered at checkout (the Customer record may change later).
    billing: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      company: { type: String, trim: true },
      gstin: { type: String, trim: true, uppercase: true },
      address: {
        line1: { type: String, trim: true },
        line2: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        postalCode: { type: String, trim: true },
        country: { type: String, trim: true, uppercase: true },
      },
    },
    // Random secret in the confirmation-page link, so an order number alone
    // cannot be used to look an order up.
    accessToken: { type: String, select: false },
    status: { type: String, enum: ORDER_STATUSES, default: "created", index: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription" },
    gateway: { type: String, enum: GATEWAYS, required: true },
    gatewayOrderId: { type: String }, // razorpay order_xxx / stripe checkout session id
    paidAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

orderSchema.index({ gateway: 1, gatewayOrderId: 1 }, { unique: true, partialFilterExpression: { gatewayOrderId: { $type: "string" } } });
orderSchema.index({ "item.package": 1 });

orderSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.accessToken;
    return ret;
  },
});

export const Order = mongoose.model("Order", orderSchema);
