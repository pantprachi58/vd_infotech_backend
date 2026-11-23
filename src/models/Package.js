import mongoose from "mongoose";
import { SLUG_PATTERN } from "../utils/slug.js";

/**
 * One package — the sellable product (SEO, PPC, Website Development …).
 *
 * Billing:
 *   billingType "recurring" — billed every period; the price shown is the
 *                             monthly price x the period's months.
 *               "one_time"  — a project price, the same whatever the period.
 *   prices      one entry per plan tier: the INR base (before the list-price
 *               hike and GST) and the USD list price other currencies convert
 *               from. A plan with no price shows the custom-quote note.
 *
 * Orders and subscriptions never read these numbers back later: they keep a
 * snapshot of the price they were sold at, so editing a package never changes
 * what an existing customer pays.
 *
 * Matrix cell shorthand in sections[].rows[].values (one per plan, in plan
 * order): "c" = included, "x" = not included, "startNow" = the plan's CTA,
 * anything else prints as-is.
 */
const { Schema } = mongoose;

export const PACKAGE_STATUSES = ["published", "draft", "archived"];
export const BILLING_TYPES = ["recurring", "one_time"];

const priceSchema = new Schema(
  {
    plan: { type: String, required: true },
    inrBase: { type: Number, default: null, min: 0 },
    usd: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const highlightSchema = new Schema(
  {
    // Label of the matrix row whose values the compact tier cards show.
    row: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    // What the Custom tier card shows instead (defaults to "As per need").
    custom: {
      type: new Schema(
        { value: { type: String, trim: true }, label: { type: String, trim: true } },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { _id: false }
);

const rowSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    values: { type: [String], required: true },
  },
  { _id: false }
);

const sectionSchema = new Schema(
  {
    // null = the untitled opening block (no red band).
    title: { type: String, default: null, trim: true, maxlength: 200 },
    // The Custom column's single badge for the whole section.
    custom: { type: String, default: "As Per Need", trim: true, maxlength: 60 },
    rows: { type: [rowSchema], default: [] },
  },
  { _id: false }
);

const packageSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: SLUG_PATTERN },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    shortName: { type: String, trim: true, maxlength: 60 },
    category: { type: String, trim: true, lowercase: true, maxlength: 60 },
    status: { type: String, enum: PACKAGE_STATUSES, default: "draft", index: true },
    // Row position on /packages (ascending).
    order: { type: Number, default: 0 },
    // The header's Packages mega menu.
    menu: {
      label: { type: String, trim: true, maxlength: 80 },
      order: { type: Number, default: 0 },
      visible: { type: Boolean, default: true },
    },
    tagline: { type: String, trim: true, maxlength: 400 },
    description: { type: String, trim: true, maxlength: 2000 },
    // Short heading over the intro beside the enquiry form; red words in [[ ]].
    introTitle: { type: String, trim: true, maxlength: 160 },
    // Extra intro paragraphs printed after `description` beside the enquiry form.
    intro: {
      type: [{ type: String, trim: true, maxlength: 1500 }],
      default: [],
      validate: { validator: (v) => v.length <= 6, message: "At most 6 intro paragraphs" },
    },
    seo: {
      title: { type: String, trim: true, maxlength: 200 },
      description: { type: String, trim: true, maxlength: 400 },
    },
    billingType: { type: String, enum: BILLING_TYPES, default: "recurring" },
    // First row of the single-package sheet for a one-time package ("Project price (one-time)").
    priceLabel: { type: String, trim: true, maxlength: 80 },
    // Printed after the tax/period sentences under the sheet.
    note: { type: String, trim: true, maxlength: 2000 },
    prices: { type: [priceSchema], default: [] },
    highlights: { type: [highlightSchema], default: [] },
    terms: { type: [String], default: [] },
    sections: { type: [sectionSchema], default: [] },
    // Reserved for the payment gateway: its product / plan ids per provider,
    // e.g. { razorpay: { plans: { "starter:monthly:INR": "plan_xxx" } } }.
    gateway: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

packageSchema.index({ status: 1, order: 1 });

packageSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.gateway; // internal
    return ret;
  },
});

export const Package = mongoose.model("Package", packageSchema);
