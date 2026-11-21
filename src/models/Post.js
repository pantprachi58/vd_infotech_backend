import mongoose from "mongoose";
import { SLUG_PATTERN } from "../utils/slug.js";

export const POST_STATUSES = ["published", "draft"];

const postSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: SLUG_PATTERN },
    title: { type: String, required: true, trim: true, maxlength: 250 },
    // Category slug — the website addresses categories by slug in every URL.
    category: { type: String, required: true, trim: true, lowercase: true, index: true },
    excerpt: { type: String, required: true, trim: true, maxlength: 1000 },
    // Paragraphs for the home page's featured card; empty means "use the excerpt".
    summary: { type: [String], default: undefined },
    // Path under the website's /public (e.g. /images/blog/x.webp) or an absolute URL.
    image: { type: String, required: true, trim: true },
    author: { type: String, default: "VD Infotech", trim: true },
    date: { type: Date, required: true, index: true },
    blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    words: { type: Number, default: 0 },
    readMinutes: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: POST_STATUSES, default: "published", index: true },
    // SEO overrides; the site falls back to title / excerpt.
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
  },
  { timestamps: true }
);

postSchema.index({ status: 1, date: -1, _id: -1 });
postSchema.index({ title: "text", excerpt: "text" });

postSchema.set("toJSON", {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    // The website works in calendar dates ("2025-06-25"), always UTC.
    if (ret.date instanceof Date) ret.date = ret.date.toISOString().slice(0, 10);
    if (!ret.summary?.length) delete ret.summary;
    return ret;
  },
});

export const Post = mongoose.model("Post", postSchema);
