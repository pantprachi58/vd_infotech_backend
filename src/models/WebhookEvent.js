import mongoose from "mongoose";
import { GATEWAYS } from "./schemas/purchaseSnapshot.js";

/**
 * Every verified webhook delivery, keyed by the gateway's event id. Razorpay
 * may deliver an event more than once; a repeat finds the processed record
 * here and is acknowledged without being applied again. Also the audit trail
 * when reconciling a payment with support.
 */
const webhookEventSchema = new mongoose.Schema(
  {
    gateway: { type: String, enum: GATEWAYS, required: true },
    eventId: { type: String, required: true },
    event: { type: String, required: true }, // e.g. "subscription.charged"
    payload: { type: mongoose.Schema.Types.Mixed },
    processedAt: { type: Date },
    error: { type: String },
  },
  { timestamps: true }
);

webhookEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
