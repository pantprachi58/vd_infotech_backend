import mongoose from "mongoose";
import { SLUG_PATTERN } from "../utils/slug.js";

const categorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: SLUG_PATTERN },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    tagline: { type: String, default: "", trim: true, maxlength: 300 },
    // Position in the category strip and sidebar (ascending).
    order: { type: Number, default: 0 },
    // The /blogs page gives each featured category a column under the slider,
    // in ascending featuredOrder.
    featured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export const Category = mongoose.model("Category", categorySchema);
