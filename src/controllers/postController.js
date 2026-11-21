import { Category } from "../models/Category.js";
import { POST_STATUSES, Post } from "../models/Post.js";
import { isAdmin } from "../middleware/auth.js";
import { countWords, normaliseBlocks, readMinutesFor } from "../utils/blocks.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { slugify } from "../utils/slug.js";
import { revalidateFrontend } from "../utils/revalidate.js";

const WRITABLE = [
  "slug", "title", "category", "excerpt", "summary", "image", "author",
  "date", "blocks", "readMinutes", "status", "metaTitle", "metaDescription",
];

// Newest first; among posts on the same day, the one added last comes first.
const NEWEST_FIRST = { date: -1, _id: -1 };
const MAX_LIMIT = 100;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Copies the writable fields, normalising the body and its derived counts. */
async function buildFields(body, { creating }) {
  if (!body || typeof body !== "object") throw badRequest("Request body must be a JSON object");
  const fields = Object.fromEntries(WRITABLE.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

  if (creating && !fields.slug && fields.title) fields.slug = slugify(fields.title);

  if (fields.category !== undefined) {
    const exists = await Category.exists({ slug: String(fields.category).toLowerCase() });
    if (!exists) throw badRequest(`Unknown category "${fields.category}"`);
  }

  if (fields.summary !== undefined) {
    if (fields.summary !== null && !(Array.isArray(fields.summary) && fields.summary.every((s) => typeof s === "string"))) {
      throw badRequest("summary must be an array of strings");
    }
    fields.summary = fields.summary?.length ? fields.summary : undefined;
  }

  if (fields.blocks !== undefined) {
    try {
      fields.blocks = normaliseBlocks(fields.blocks);
    } catch (err) {
      throw badRequest(err.message);
    }
    fields.words = countWords(fields.blocks);
    // An explicit readMinutes wins; otherwise derive it from the body.
    if (body.readMinutes === undefined) fields.readMinutes = readMinutesFor(fields.words);
  }

  return fields;
}

/**
 * GET /api/blog/posts
 *   ?category=slug  ?search=text  ?page=1  ?limit=20 (0 = every post)
 *   ?include=blocks (bodies are left out of listings by default)
 *   ?status=published|draft|all  (draft/all need the admin key)
 */
export async function listPosts(req, res) {
  const { category, search, include } = req.query;
  const admin = isAdmin(req);

  const status = admin ? req.query.status ?? "all" : "published";
  if (status !== "all" && !POST_STATUSES.includes(status)) throw badRequest(`status must be all or ${POST_STATUSES.join(", ")}`);

  const filter = status === "all" ? {} : { status };
  if (category) filter.category = String(category).toLowerCase();
  if (search) {
    const re = new RegExp(escapeRegex(String(search).trim()), "i");
    filter.$or = [{ title: re }, { excerpt: re }];
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(rawLimit) ? 20 : rawLimit === 0 ? 0 : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

  let query = Post.find(filter).sort(NEWEST_FIRST);
  if (include !== "blocks") query = query.select("-blocks");
  if (limit) query = query.skip((page - 1) * limit).limit(limit);

  const [posts, total] = await Promise.all([query, Post.countDocuments(filter)]);
  res.json({
    data: posts,
    meta: { total, page: limit ? page : 1, limit, pages: limit ? Math.ceil(total / limit) : 1 },
  });
}

/** GET /api/blog/posts/:slug  (?category=slug must match when given) */
export async function getPost(req, res) {
  const filter = { slug: req.params.slug };
  if (!isAdmin(req)) filter.status = "published";
  if (req.query.category) filter.category = String(req.query.category).toLowerCase();

  const post = await Post.findOne(filter);
  if (!post) throw notFound("Post not found");
  res.json({ data: post });
}

/** POST /api/blog/posts */
export async function createPost(req, res) {
  const post = await Post.create(await buildFields(req.body, { creating: true }));
  revalidateFrontend();
  res.status(201).json({ data: post });
}

/** PATCH|PUT /api/blog/posts/:slug — only the fields sent are changed. */
export async function updatePost(req, res) {
  const post = await Post.findOne({ slug: req.params.slug });
  if (!post) throw notFound("Post not found");

  post.set(await buildFields(req.body, { creating: false }));
  await post.save();
  revalidateFrontend();
  res.json({ data: post });
}

/** DELETE /api/blog/posts/:slug */
export async function deletePost(req, res) {
  const result = await Post.deleteOne({ slug: req.params.slug });
  if (!result.deletedCount) throw notFound("Post not found");
  revalidateFrontend();
  res.status(204).end();
}
