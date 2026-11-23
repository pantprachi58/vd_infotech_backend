import mongoose from "mongoose";

/**
 * A buyer. Created at first checkout; the admin's future "Users" screen lists
 * these. Gateway-side customer ids are kept per provider so a returning buyer
 * reuses their saved mandate / card.
 */
const customerSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 20 },
    company: { type: String, trim: true, maxlength: 160 },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 15 }, // Indian GST number, for B2B invoices
    billingAddress: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true, uppercase: true, default: "IN" }, // ISO 3166-1 alpha-2
    },
    // { razorpay: "cust_xxx", stripe: "cus_xxx" }
    gatewayIds: { type: Map, of: String, default: undefined },
  },
  { timestamps: true }
);

customerSchema.set("toJSON", {
  versionKey: false,
  flattenMaps: true,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export const Customer = mongoose.model("Customer", customerSchema);
