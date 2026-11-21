/**
 * Loads the blog the website currently ships with (copied from
 * frontend/src/data/blog.js and blogContent.json) into MongoDB.
 *
 *   npm run seed         add missing categories/posts, leave existing ones alone
 *   npm run seed:fresh   wipe both collections first, then load everything
 */
import { readFile } from "node:fs/promises";
import { connectDb, disconnectDb } from "../config/db.js";
import { Category } from "../models/Category.js";
import { Post } from "../models/Post.js";
import { countWords, normaliseBlocks } from "../utils/blocks.js";
import { BLOG_AUTHOR, blogCategories, blogPosts, featuredBlogCategories } from "./data/blog.js";

const content = JSON.parse(await readFile(new URL("./data/blogContent.json", import.meta.url), "utf8"));
const fresh = process.argv.includes("--fresh");

async function seed() {
  await connectDb();
  await Promise.all([Category.init(), Post.init()]); // build unique indexes before inserting

  if (fresh) {
    await Promise.all([Category.deleteMany({}), Post.deleteMany({})]);
    console.log("Cleared categories and posts.");
  }

  let addedCategories = 0;
  for (const [order, c] of blogCategories.entries()) {
    const featuredOrder = featuredBlogCategories.indexOf(c.slug);
    const res = await Category.updateOne(
      { slug: c.slug },
      {
        $setOnInsert: {
          slug: c.slug,
          name: c.name,
          tagline: c.tagline,
          order,
          featured: featuredOrder !== -1,
          featuredOrder: Math.max(featuredOrder, 0),
        },
      },
      { upsert: true }
    );
    addedCategories += res.upsertedCount;
  }

  // blogPosts is newest first. Insert oldest first so that, among posts sharing
  // a date, the API's { date: -1, _id: -1 } sort keeps the site's order.
  let addedPosts = 0;
  for (const p of [...blogPosts].reverse()) {
    if (await Post.exists({ slug: p.slug })) continue;
    const blocks = normaliseBlocks(content[p.slug]?.blocks ?? []);
    await Post.create({
      slug: p.slug,
      title: p.title,
      category: p.category,
      excerpt: p.excerpt,
      summary: p.summary,
      image: p.image,
      author: BLOG_AUTHOR,
      date: new Date(p.date),
      blocks,
      words: content[p.slug]?.words ?? countWords(blocks),
      readMinutes: p.readMinutes,
      status: "published",
    });
    addedPosts++;
  }

  console.log(`Categories: ${addedCategories} added, ${blogCategories.length - addedCategories} already present.`);
  console.log(`Posts:      ${addedPosts} added, ${blogPosts.length - addedPosts} already present.`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
