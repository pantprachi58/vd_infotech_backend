import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { brand } from "../config/brand.js";
import { slugify } from "./slug.js";

/* Files visitors attach to website forms (resumes, briefs). They are saved
   next to the API in uploads/forms and the team email links to them instead
   of carrying the bytes. Each name starts with 128 random bits, so a link
   can't be guessed; the folder is never listed.

   Links point at the website (`/media/forms/<file>`, rewritten to this API
   by next.config.mjs) unless FORM_FILES_URL names another base. */
export const FORM_UPLOAD_DIR = path.resolve("uploads", "forms");
export const FORM_UPLOAD_URL = "/uploads/forms";
export const FORM_FILE_PATTERN = /^[a-f0-9]{32}-[a-z0-9-]{1,60}\.(pdf|png|jpe?g|docx?)$/;

const linkBase = () => (process.env.FORM_FILES_URL || `${brand.site}/media/forms`).replace(/\/+$/, "");

/** Saves a validated file ({ filename, ext, content }) and returns it with `stored` and `url`. */
export async function storeFormFile(file) {
  const base = slugify(file.filename.replace(/\.[^.]+$/, "")).slice(0, 60) || "file";
  const stored = `${randomBytes(16).toString("hex")}-${base}${file.ext === ".jpeg" ? ".jpg" : file.ext}`;
  await mkdir(FORM_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(FORM_UPLOAD_DIR, stored), file.content, { flag: "wx" });
  return { filename: file.filename, contentType: file.contentType, size: file.size, stored, url: `${linkBase()}/${stored}` };
}

/** Best-effort clean-up, e.g. when the email for a submission could not be sent. */
export async function removeFormFiles(files) {
  await Promise.all(files.map((f) => unlink(path.join(FORM_UPLOAD_DIR, f.stored)).catch(() => {})));
}

/** Response headers for serving a stored form file. */
export function formFileHeaders(res, filePath) {
  res.set({
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "private, max-age=3600",
    // Word files download; PDFs and images open in the browser.
    "Content-Disposition": /\.docx?$/.test(filePath) ? "attachment" : "inline",
  });
}
