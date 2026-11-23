/**
 * Loads the packages the website ships with (a copy of
 * frontend/src/data/packages.json) into MongoDB.
 *
 *   npm run seed:packages         add the settings and any missing packages; on existing ones only
 *                                 fill fields added later (introTitle, intro) that are still empty
 *   npm run seed:packages:fresh   wipe settings + packages first, then load everything
 *
 * Refuses --fresh once orders or subscriptions exist, since those point at packages.
 */
import { readFile } from "node:fs/promises";
import { connectDb, disconnectDb } from "../config/db.js";
import { Order } from "../models/Order.js";
import { Package } from "../models/Package.js";
import { PackageSettings } from "../models/PackageSettings.js";
import { Subscription } from "../models/Subscription.js";

const catalog = JSON.parse(await readFile(new URL("./data/packages.json", import.meta.url), "utf8"));
const fresh = process.argv.includes("--fresh");

async function seed() {
  await connectDb();
  await Promise.all([PackageSettings.init(), Package.init()]); // unique indexes before inserting

  if (fresh) {
    const sold = (await Order.estimatedDocumentCount()) + (await Subscription.estimatedDocumentCount());
    if (sold) throw new Error("Orders or subscriptions exist; refusing to wipe packages. Edit them in /admin instead.");
    await Promise.all([PackageSettings.deleteMany({}), Package.deleteMany({})]);
    console.log("Cleared package settings and packages.");
  }

  const { plans, planGroups, customPlan, currencies, pricing, billingPeriods, overview } = catalog;
  const settings = await PackageSettings.updateOne(
    { key: "default" },
    { $setOnInsert: { key: "default", plans, planGroups, customPlan, currencies, pricing, billingPeriods, overview } },
    { upsert: true }
  );

  let added = 0;
  let backfilled = 0;
  for (const pkg of catalog.packages) {
    if (await Package.exists({ slug: pkg.slug })) {
      // Fields added after the first seed: fill them only where still empty,
      // so copy edited in /admin is never overwritten.
      if (pkg.intro?.length) {
        const res = await Package.updateOne(
          { slug: pkg.slug, $or: [{ intro: { $exists: false } }, { intro: { $size: 0 } }] },
          { $set: { intro: pkg.intro } }
        );
        backfilled += res.modifiedCount;
      }
      if (pkg.introTitle) {
        const res = await Package.updateOne(
          { slug: pkg.slug, $or: [{ introTitle: { $exists: false } }, { introTitle: "" }, { introTitle: null }] },
          { $set: { introTitle: pkg.introTitle } }
        );
        backfilled += res.modifiedCount;
      }
      continue;
    }
    await Package.create(pkg);
    added += 1;
  }

  console.log(`Settings:  ${settings.upsertedCount ? "added" : "already present"}.`);
  console.log(`Packages:  ${added} added, ${catalog.packages.length - added} already present.`);
  if (backfilled) console.log(`Intro:     filled ${backfilled} empty intro field(s) on existing packages.`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
