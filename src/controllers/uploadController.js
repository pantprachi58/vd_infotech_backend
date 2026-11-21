import { randomBytes } from "node:crypto";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { badRequest, notFound } from "../utils/httpError.js";
import { slugify } from "../utils/slug.js";

/* Uploaded images live on disk next to the API and are served at /uploads/blog. */
export const UPLOAD_DIR = path.resolve("uploads", "blog");
export const UPLOAD_URL = "/uploads/blog";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/* The file's own bytes decide its type — the Content-Type header is only a hint. */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a") return "gif";
  if (buf.toString("ascii", 4, 12) === "ftypavif") return "avif";
  return null;
}

const FILE_PATTERN = /^[a-z0-9-]+\.(jpg|png|webp|gif|avif)$/;

/** POST /api/blog/uploads?name=original-file-name  (raw image body) */
export async function uploadImage(req, res) {
  const body = req.body;
  if (!Buffer.isBuffer(body) || !body.length) throw badRequest("Send the image bytes as the request body");
  const ext = sniff(body);
  if (!ext) throw badRequest("Only JPEG, PNG, WebP, GIF or AVIF images are accepted");

  const base = slugify(String(req.query.name ?? "image").replace(/\.[^.]+$/, "")).slice(0, 60) || "image";
  const file = `${base}-${randomBytes(4).toString("hex")}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, file), body);
  res.status(201).json({ data: { file, url: `${UPLOAD_URL}/${file}`, size: body.length } });
}

/** GET /api/blog/uploads — newest first. */
export async function listUploads(_req, res) {
  let names = [];
  try {
    names = (await readdir(UPLOAD_DIR)).filter((n) => FILE_PATTERN.test(n));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const files = await Promise.all(
    names.map(async (file) => {
      const s = await stat(path.join(UPLOAD_DIR, file));
      return { file, url: `${UPLOAD_URL}/${file}`, size: s.size, uploadedAt: s.mtime.toISOString() };
    })
  );
  files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  res.json({ data: files });
}

/** DELETE /api/blog/uploads/:file */
export async function deleteUpload(req, res) {
  const { file } = req.params;
  if (!FILE_PATTERN.test(file)) throw badRequest("Invalid file name");
  try {
    await unlink(path.join(UPLOAD_DIR, file));
  } catch (err) {
    if (err.code === "ENOENT") throw notFound("File not found");
    throw err;
  }
  res.status(204).end();
}
