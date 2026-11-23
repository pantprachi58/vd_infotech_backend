import mongoose from "mongoose";

/**
 * What was sold, frozen at the moment of sale. Orders and subscriptions embed
 * this rather than reading the live package, so a later price or copy edit
 * never changes an existing customer's bill or invoice.
 *
 * Money is stored in minor units (paise, cents) as integers — never floats.
 */
export const purchaseSnapshotSchema = new mongoose.Schema(
  {
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package", required: true },
    packageSlug: { type: String, required: true },
    packageName: { type: String, required: true },
    plan: { type: String, required: true }, // plan id, e.g. "starter"
    planLabel: { type: String, required: true },
    billingType: { type: String, enum: ["recurring", "one_time"], required: true },
    // Recurring only: the billing period sold and its cycle length.
    period: { type: String },
    periodMonths: { type: Number, min: 1 },
    currency: { type: String, required: true, uppercase: true },
    amountNet: { type: Number, required: true, min: 0 }, // before tax, minor units
    amountTax: { type: Number, required: true, min: 0 }, // minor units
    amountTotal: { type: Number, required: true, min: 0 }, // charged per cycle, minor units
    taxRate: { type: Number, required: true, min: 0 }, // 0.18 GST, 0.05 intl
    taxLabel: { type: String }, // "GST", "Tax"
  },
  { _id: false }
);

/** Payment gateways the billing models accept. Add one here when integrating it. */
export const GATEWAYS = ["razorpay", "stripe", "manual"];
