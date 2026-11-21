import { Category } from "../models/Category.js";
import { Post } from "../models/Post.js";

// The activity chart covers at least the last 12 months, stretching back to
// the oldest published post (at most 24) so an older blog never charts empty.
const MIN_MONTHS = 12;
const MAX_MONTHS = 24;

async function activityMonths(now = new Date()) {
  const oldest = await Post.findOne({ status: "published" }).sort({ date: 1 }).select("date");
  if (!oldest) return MIN_MONTHS;
  const span = (now.getUTCFullYear() - oldest.date.getUTCFullYear()) * 12 + (now.getUTCMonth() - oldest.date.getUTCMonth()) + 1;
  return Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, span));
}

/** "2026-03" keys for the last `count` calendar months, oldest first (UTC). */
function monthKeys(count, now = new Date()) {
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

/**
 * GET /api/blog/stats (admin) — everything the admin dashboard draws, in one
 * round trip: totals, posts per category, publishing per month and the most
 * recently edited posts.
 */
export async function getStats(_req, res) {
  const months = monthKeys(await activityMonths());
  const since = new Date(`${months[0]}-01T00:00:00Z`);

  const [totals, byCategory, byMonth, categories, recent] = await Promise.all([
    Post.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
          drafts: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          words: { $sum: "$words" },
          readMinutes: { $avg: "$readMinutes" },
        },
      },
    ]),
    Post.aggregate([
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
        },
      },
    ]),
    Post.aggregate([
      { $match: { status: "published", date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } }, count: { $sum: 1 } } },
    ]),
    Category.find().sort({ order: 1, name: 1 }),
    Post.find().select("-blocks").sort({ updatedAt: -1 }).limit(6),
  ]);

  const t = totals[0] ?? { total: 0, published: 0, drafts: 0, words: 0, readMinutes: 0 };
  const counts = new Map(byCategory.map((r) => [r._id, r]));
  const perMonth = new Map(byMonth.map((r) => [r._id, r.count]));

  res.json({
    data: {
      totals: {
        posts: t.total,
        published: t.published,
        drafts: t.drafts,
        categories: categories.length,
        words: t.words,
        avgReadMinutes: Math.round((t.readMinutes || 0) * 10) / 10,
      },
      byCategory: categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        total: counts.get(c.slug)?.total ?? 0,
        published: counts.get(c.slug)?.published ?? 0,
      })),
      byMonth: months.map((month) => ({ month, count: perMonth.get(month) ?? 0 })),
      recent,
    },
  });
}
