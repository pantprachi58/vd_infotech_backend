import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

function matches(given, expected) {
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when the request carries the admin key (used to show drafts on read routes). */
export function isAdmin(req) {
  const key = req.get("x-api-key");
  return Boolean(env.adminApiKey && key && matches(key, env.adminApiKey));
}

/** Guards every write route. */
export function requireAdmin(req, _res, next) {
  if (!env.adminApiKey) return next(new HttpError(503, "ADMIN_API_KEY is not configured on the server"));
  if (!isAdmin(req)) return next(new HttpError(401, "Missing or invalid x-api-key header"));
  next();
}
