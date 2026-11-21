import mongoose from "mongoose";
import { env } from "../config/env.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return res.status(400).json({ error: "Validation failed", details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid value for ${err.path}` });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    return res.status(409).json({ error: `A record with this ${field} already exists` });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && env.isProduction ? "Internal server error" : err.message,
    ...(err.details && { details: err.details }),
  });
}
