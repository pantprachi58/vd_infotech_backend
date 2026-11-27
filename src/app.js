import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import blogRoutes from "./routes/blogRoutes.js";
import formRoutes, { formBodyParser } from "./routes/formRoutes.js";
import { submitForm } from "./controllers/formController.js";
import { FORM_FILE_PATTERN, FORM_UPLOAD_DIR, FORM_UPLOAD_URL, formFileHeaders } from "./utils/formUploads.js";
import { UPLOAD_DIR, UPLOAD_URL } from "./controllers/uploadController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins }));
  // Form submissions may carry a small attachment, so they get a larger body
  // limit; parsed here first, the global parser below then leaves them alone.
  app.use("/api/forms", formBodyParser);
  app.use(express.json({ limit: "2mb" }));
  if (!env.isProduction) app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
  });

  // Uploaded blog images. The website serves them from its own origin through
  // a rewrite of /media/blog/*, so pages never link to the API host directly.
  app.use(
    UPLOAD_URL,
    (_req, res, next) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true, fallthrough: false })
  );

  // Files attached to website forms, linked from the team emails. Only names
  // in the generated pattern are served; there is no index.
  app.use(
    FORM_UPLOAD_URL,
    (req, res, next) => {
      if (!FORM_FILE_PATTERN.test(req.path.slice(1))) return res.status(404).json({ error: "File not found" });
      next();
    },
    express.static(FORM_UPLOAD_DIR, { index: false, dotfiles: "deny", fallthrough: false, setHeaders: formFileHeaders })
  );

  app.use("/api/blog", blogRoutes);
  app.use("/api/forms", formRoutes);
  // Older clients posted the strategy-session form here; same handler.
  app.post("/api/consultation", (req, res) => {
    req.params.form = "consultation";
    return submitForm(req, res);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
