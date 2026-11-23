import { isAdmin } from "../middleware/auth.js";
import { Order } from "../models/Order.js";
import { PACKAGE_STATUSES, Package } from "../models/Package.js";
import { PackageSettings } from "../models/PackageSettings.js";
import { Subscription } from "../models/Subscription.js";
import { HttpError, badRequest, conflict, notFound } from "../utils/httpError.js";
import { quote } from "../utils/pricing.js";
import { revalidateFrontend } from "../utils/revalidate.js";
import { slugify } from "../utils/slug.js";

const TAG = "packages";
// Fixed routes under /api/packages and /admin/packages — never a package slug.
const RESERVED_SLUGS = new Set(["catalog", "settings", "reorder", "new"]);
const SHEET_ORDER = { order: 1, name: 1 };

const WRITABLE = [
  "slug", "name", "shortName", "category", "status", "order", "menu", "tagline", "description", "introTitle", "intro", "seo",
  "billingType", "priceLabel", "note", "prices", "highlights", "terms", "sections",
];

async function loadSettings() {
  const settings = await PackageSettings.findOne({ key: "default" });
  if (!settings) throw new HttpError(503, "Package settings are missing. Run `npm run seed:packages` on the API.");
  return settings;
}

function pick(body, keys) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Request body must be a JSON object");
  return Object.fromEntries(keys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Cross-field rules Mongoose can't express, checked on the merged document
 * before every save: prices name real plans, each matrix row has one value per
 * plan, and each highlight points at a row that exists (the tier cards read it).
 */
function assertConsistent(pkg, settings) {
  const planIds = settings.plans.map((p) => p.id);
  const errors = {};

  if (RESERVED_SLUGS.has(pkg.slug)) errors.slug = `"${pkg.slug}" is reserved; choose another URL`;

  const seen = new Set();
  pkg.prices.forEach((price, i) => {
    if (!planIds.includes(price.plan)) errors[`prices[${i}]`] = `Unknown plan "${price.plan}"`;
    else if (seen.has(price.plan)) errors[`prices[${i}]`] = `Plan "${price.plan}" is priced twice`;
    seen.add(price.plan);
    for (const key of ["inrBase", "usd"]) {
      if (price[key] != null && !isNum(price[key])) errors[`prices[${i}].${key}`] = "Must be a positive number or empty";
    }
  });

  // The site keys sections by title and rows by label, so both must be unique
  // where they sit (one untitled section at most; labels may repeat across sections).
  const titles = new Set();
  const rowLabels = new Set();
  pkg.sections.forEach((section, si) => {
    const title = section.title ?? "";
    if (titles.has(title)) errors[`sections[${si}].title`] = title ? `Section "${title}" appears twice` : "Only one section can be untitled";
    titles.add(title);

    const inSection = new Set();
    section.rows.forEach((row, ri) => {
      if (inSection.has(row.label)) errors[`sections[${si}].rows[${ri}].label`] = `Row "${row.label}" appears twice in one section`;
      inSection.add(row.label);
      if (row.values.length !== planIds.length) {
        errors[`sections[${si}].rows[${ri}]`] = `"${row.label}" needs ${planIds.length} values (one per plan), has ${row.values.length}`;
      }
      rowLabels.add(row.label);
    });
  });

  pkg.highlights.forEach((h, i) => {
    if (!rowLabels.has(h.row)) errors[`highlights[${i}]`] = `Highlight row "${h.row}" is not a row of this package`;
  });

  if (pkg.status === "published" && !pkg.menu?.label) errors["menu.label"] = "A published package needs a menu label";

  if (Object.keys(errors).length) throw badRequest("Package is not consistent", errors);
}

/* ---------------------------------------------------------------- public */

/**
 * GET /api/packages/catalog — the whole public catalog in one response: the
 * settings plus every published package with its full sheet, in sheet order.
 * This is the document the website renders the header, /packages and every
 * /packages/[slug] from.
 */
export async function getCatalog(_req, res) {
  const [settings, packages] = await Promise.all([
    loadSettings(),
    Package.find({ status: "published" }).sort(SHEET_ORDER),
  ]);
  res.json({ data: { ...settings.toJSON(), packages } });
}

/** GET /api/packages/settings */
export async function getSettings(_req, res) {
  res.json({ data: await loadSettings() });
}

/**
 * GET /api/packages  ?status=published|draft|archived|all (admin)  ?include=sections
 * Public callers only ever see published packages.
 */
export async function listPackages(req, res) {
  const admin = isAdmin(req);
  const status = admin ? req.query.status ?? "all" : "published";
  if (status !== "all" && !PACKAGE_STATUSES.includes(status)) {
    throw badRequest(`status must be all or ${PACKAGE_STATUSES.join(", ")}`);
  }
  let query = Package.find(status === "all" ? {} : { status }).sort(SHEET_ORDER);
  if (req.query.include !== "sections") query = query.select("-sections");
  res.json({ data: await query });
}

/** GET /api/packages/:slug */
export async function getPackage(req, res) {
  const filter = { slug: req.params.slug };
  if (!isAdmin(req)) filter.status = "published";
  const pkg = await Package.findOne(filter);
  if (!pkg) throw notFound("Package not found");
  res.json({ data: pkg });
}

/**
 * GET /api/packages/:slug/quote?plan=starter&currency=INR&period=quarterly&tax=incl
 * The authoritative price for one combination — what checkout will charge.
 */
export async function getQuote(req, res) {
  const [settings, pkg] = await Promise.all([
    loadSettings(),
    Package.findOne({ slug: req.params.slug, status: "published" }),
  ]);
  if (!pkg) throw notFound("Package not found");
  const { plan, currency, period, tax } = req.query;
  if (!plan) throw badRequest("plan is required");
  try {
    res.json({ data: quote(settings, pkg, { plan, currency, period, withTax: tax !== "excl" }) });
  } catch (err) {
    if (err.status === 400) throw badRequest(err.message);
    throw err;
  }
}

/* ----------------------------------------------------------------- admin */

/** POST /api/packages */
export async function createPackage(req, res) {
  const settings = await loadSettings();
  const fields = pick(req.body, WRITABLE);
  if (!fields.slug && fields.name) fields.slug = slugify(fields.name);

  // New packages go to the end of the sheet and of the menu unless placed.
  const last = await Package.findOne().sort({ order: -1 }).select("order");
  const lastMenu = await Package.findOne().sort({ "menu.order": -1 }).select("menu.order");
  fields.order ??= (last?.order ?? -1) + 1;
  fields.menu = { label: fields.name, visible: true, order: (lastMenu?.menu?.order ?? -1) + 1, ...fields.menu };
  // Every plan gets a price slot so the admin form always shows six rows.
  fields.prices ??= settings.plans.map((p) => ({ plan: p.id, inrBase: null, usd: null }));

  const pkg = new Package(fields);
  assertConsistent(pkg, settings);
  await pkg.save();
  revalidateFrontend(TAG);
  res.status(201).json({ data: pkg });
}

/** PATCH|PUT /api/packages/:slug — only the fields sent change. */
export async function updatePackage(req, res) {
  const [settings, pkg] = await Promise.all([loadSettings(), Package.findOne({ slug: req.params.slug })]);
  if (!pkg) throw notFound("Package not found");

  const fields = pick(req.body, WRITABLE);
  // menu / seo are merged, so a caller can send just { menu: { visible: false } }.
  const current = pkg.toObject();
  if (fields.menu) fields.menu = { ...current.menu, ...fields.menu };
  if (fields.seo) fields.seo = { ...current.seo, ...fields.seo };
  pkg.set(fields);
  assertConsistent(pkg, settings);
  await pkg.save();
  revalidateFrontend(TAG);
  res.json({ data: pkg });
}

/** POST /api/packages/:slug/duplicate — a draft copy to start a new package from. */
export async function duplicatePackage(req, res) {
  const source = await Package.findOne({ slug: req.params.slug });
  if (!source) throw notFound("Package not found");

  const base = `${source.slug}-copy`;
  let slug = base;
  for (let n = 2; await Package.exists({ slug }); n += 1) slug = `${base}-${n}`;

  const last = await Package.findOne().sort({ order: -1 }).select("order");
  const { _id, id, createdAt, updatedAt, gateway, ...rest } = source.toObject();
  const copy = await Package.create({
    ...rest,
    slug,
    name: `${source.name} (copy)`,
    status: "draft",
    order: (last?.order ?? 0) + 1,
    menu: { ...rest.menu, label: `${rest.menu?.label ?? source.name} (copy)` },
  });
  res.status(201).json({ data: copy });
}

/** DELETE /api/packages/:slug — refused once anything was sold from it; archive instead. */
export async function deletePackage(req, res) {
  const pkg = await Package.findOne({ slug: req.params.slug });
  if (!pkg) throw notFound("Package not found");

  const [orders, subs] = await Promise.all([
    Order.countDocuments({ "item.package": pkg._id }),
    Subscription.countDocuments({ "item.package": pkg._id }),
  ]);
  if (orders || subs) throw conflict("This package has orders or subscriptions; archive it instead of deleting it");

  await pkg.deleteOne();
  revalidateFrontend(TAG);
  res.status(204).end();
}

/**
 * PUT /api/packages/reorder  { list: "sheet" | "menu", slugs: [...] }
 * Sets /packages row order or header menu order to the order given.
 */
export async function reorderPackages(req, res) {
  const { list, slugs } = req.body ?? {};
  if (!["sheet", "menu"].includes(list)) throw badRequest('list must be "sheet" or "menu"');
  if (!Array.isArray(slugs) || !slugs.every((s) => typeof s === "string")) throw badRequest("slugs must be an array of strings");
  if (new Set(slugs).size !== slugs.length) throw badRequest("slugs contains duplicates");

  const field = list === "sheet" ? "order" : "menu.order";
  const result = await Package.bulkWrite(
    slugs.map((slug, i) => ({ updateOne: { filter: { slug }, update: { $set: { [field]: i } } } }))
  );
  if (result.matchedCount !== slugs.length) throw badRequest("Some slugs do not exist");
  revalidateFrontend(TAG);
  res.json({ data: { list, count: slugs.length } });
}

/**
 * PUT /api/packages/settings
 * Labels, rates, pricing rules and page copy are editable. Plan, group and
 * period ids, their count and their order are not: prices, matrices and sold
 * subscriptions are keyed by them.
 */
export async function updateSettings(req, res) {
  const settings = await loadSettings();
  const body = pick(req.body, ["plans", "planGroups", "customPlan", "currencies", "pricing", "billingPeriods", "overview"]);
  const errors = {};

  const sameIds = (key, next, field = "id") => {
    if (next === undefined) return;
    const before = settings[key].map((x) => x[field]);
    const after = Array.isArray(next) ? next.map((x) => x?.[field]) : null;
    if (!after || after.join() !== before.join()) errors[key] = `${key} ids cannot be added, removed or reordered (${before.join(", ")})`;
  };
  sameIds("plans", body.plans);
  sameIds("billingPeriods", body.billingPeriods);
  sameIds("planGroups", body.planGroups);

  if (body.planGroups && !errors.planGroups) {
    body.planGroups = body.planGroups.map((g, i) => ({ ...g, plans: settings.planGroups[i].plans }));
  }
  if (body.customPlan) body.customPlan = { ...body.customPlan, id: settings.customPlan.id };

  if (body.currencies !== undefined) {
    const codes = Array.isArray(body.currencies) ? body.currencies.map((c) => String(c?.code ?? "").toUpperCase()) : [];
    if (!codes.includes("INR") || !codes.includes("USD")) errors.currencies = "INR and USD are required (prices are set in them)";
    else if (new Set(codes).size !== codes.length) errors.currencies = "Each currency can appear once";
    else if (body.currencies.some((c) => !(c.rate > 0))) errors.currencies = "Every currency needs a rate above 0";
    else if (body.currencies[codes.indexOf("INR")].rate !== 1) errors.currencies = "INR is the base currency; its rate must be 1";
  }
  if (body.overview !== undefined && (typeof body.overview !== "object" || Array.isArray(body.overview) || !body.overview)) {
    errors.overview = "overview must be an object";
  }
  if (Object.keys(errors).length) throw badRequest("Settings not saved", errors);

  settings.set(body);
  if (body.overview) settings.markModified("overview");
  await settings.save();
  revalidateFrontend(TAG);
  res.json({ data: settings });
}
