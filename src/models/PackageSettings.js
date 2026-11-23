import mongoose from "mongoose";

/**
 * Catalog-wide package settings — one document (key "default").
 *
 * Everything every package shares lives here: the six plan tiers (the table
 * columns), the group slabs above them, the quoted Custom column, the
 * currencies and their rates, the pricing rules and the billing periods,
 * plus the /packages page copy.
 *
 * Plan and billing-period ids are stable keys: package prices, matrix values
 * and (later) orders and subscriptions all point at them, so the API lets an
 * admin rename them but never add, remove or re-id them.
 */
const { Schema } = mongoose;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const planSchema = new Schema(
  {
    id: { type: String, required: true, match: ID_PATTERN },
    label: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { _id: false }
);

const planGroupSchema = new Schema(
  {
    id: { type: String, required: true, match: ID_PATTERN },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    // Plan ids this slab spans, left to right ("custom" = the Custom column).
    plans: { type: [String], required: true },
  },
  { _id: false }
);

const currencySchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, match: /^[A-Z]{3}$/ }, // ISO 4217
    symbol: { type: String, required: true, trim: true, maxlength: 4 },
    // Units of this currency per 1 INR. USD-priced currencies convert through the USD rate.
    rate: { type: Number, required: true, min: 0 },
    locale: { type: String, required: true, trim: true, default: "en-US" },
    // Digits shown on the site (prices are whole numbers today).
    fractionDigits: { type: Number, default: 0, min: 0, max: 3 },
    // Minor units per major unit for gateways (paise, cents): amountMinor = amount x 10^minorUnits.
    minorUnits: { type: Number, default: 2, min: 0, max: 3 },
  },
  { _id: false }
);

const billingPeriodSchema = new Schema(
  {
    id: { type: String, required: true, match: ID_PATTERN },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    // Months one billing cycle covers. A recurring price is monthly x months.
    months: { type: Number, required: true, min: 1, max: 36 },
    priceLabel: { type: String, required: true, trim: true, maxlength: 60 },
    suffix: { type: String, default: "", trim: true, maxlength: 60 },
  },
  { _id: false }
);

const settingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true, immutable: true },
    plans: { type: [planSchema], required: true },
    planGroups: { type: [planGroupSchema], required: true },
    customPlan: {
      id: { type: String, default: "custom" },
      label: { type: String, required: true, trim: true, maxlength: 40 },
      // Shown in place of a price when a plan has none.
      note: { type: String, required: true, trim: true, maxlength: 60 },
    },
    currencies: { type: [currencySchema], required: true },
    pricing: {
      // INR list price = base x hike, rounded to ₹100.
      hike: { type: Number, required: true, min: 0 },
      // GST on INR prices (0.18 = 18%).
      gst: { type: Number, required: true, min: 0, max: 1 },
      // Tax on non-INR prices (0.05 = 5%).
      intlTax: { type: Number, required: true, min: 0, max: 1 },
    },
    billingPeriods: { type: [billingPeriodSchema], required: true },
    // /packages page copy: banner, intro, suite card, table label.
    overview: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

settingsSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.key;
    return ret;
  },
});

export const PackageSettings = mongoose.model("PackageSettings", settingsSchema);
