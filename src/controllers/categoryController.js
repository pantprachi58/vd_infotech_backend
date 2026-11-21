import { Category } from "../models/Category.js";
import { Post } from "../models/Post.js";
import { badRequest, conflict, notFound } from "../utils/httpError.js";
import { slugify } from "../utils/slug.js";
import { revalidateFrontend } from "../utils/revalidate.js";

const WRITABLE = ["slug", "name", "tagline", "order", "featured", "featuredOrder"];

function pick(body) {
  if (!body || typeof body !== "object") throw badRequest("Request body must be a JSON object");
  return Object.fromEntries(WRITABLE.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
}

/** Published-post count per category slug. */
async function postCounts() {
  const rows = await Post.aggregate([{ $match: { status: "published" } }, { $group: { _id: "$category", count: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [r._id, r.count]));
}

/** GET /api/blog/categories */
export async function listCategories(_req, res) {
  const [categories, counts] = await Promise.all([Category.find().sort({ order: 1, name: 1 }), postCounts()]);
  res.json({ data: categories.map((c) => ({ ...c.toJSON(), count: counts.get(c.slug) ?? 0 })) });
}

/** GET /api/blog/categories/:slug */
export async function getCategory(req, res) {
  const category = await Category.findOne({ slug: req.params.slug });
  if (!category) throw notFound("Category not found");
  const count = await Post.countDocuments({ category: category.slug, status: "published" });
  res.json({ data: { ...category.toJSON(), count } });
}

/** POST /api/blog/categories */
export async function createCategory(req, res) {
  const fields = pick(req.body);
  if (!fields.slug && fields.name) fields.slug = slugify(fields.name);
  const category = await Category.create(fields);
  revalidateFrontend();
  res.status(201).json({ data: category });
}

/** PATCH|PUT /api/blog/categories/:slug — renaming the slug moves its posts along. */
export async function updateCategory(req, res) {
  const category = await Category.findOne({ slug: req.params.slug });
  if (!category) throw notFound("Category not found");

  const oldSlug = category.slug;
  category.set(pick(req.body));
  await category.save();
  if (category.slug !== oldSlug) await Post.updateMany({ category: oldSlug }, { category: category.slug });

  revalidateFrontend();
  res.json({ data: category });
}

/** DELETE /api/blog/categories/:slug — refused while posts still use it. */
export async function deleteCategory(req, res) {
  const category = await Category.findOne({ slug: req.params.slug });
  if (!category) throw notFound("Category not found");

  const inUse = await Post.countDocuments({ category: category.slug });
  if (inUse) throw conflict(`${inUse} post(s) still belong to this category; move or delete them first`);

  await category.deleteOne();
  revalidateFrontend();
  res.status(204).end();
}
