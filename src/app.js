import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import blogRoutes from "./routes/blogRoutes.js";
import consultationRoutes from "./routes/consultationRoutes.js";
import { UPLOAD_DIR, UPLOAD_URL } from "./controllers/uploadController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins }));
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

  app.use("/api/blog", blogRoutes);
  app.use("/api/consultation", consultationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
