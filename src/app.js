import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import blogRoutes from "./routes/blogRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { razorpayWebhook } from "./controllers/paymentController.js";
import { UPLOAD_DIR, UPLOAD_URL } from "./controllers/uploadController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins }));
  // Razorpay signs the exact bytes it sends, so its webhook reads the raw
  // body and must be registered before the JSON parser.
  app.post("/api/payments/razorpay/webhook", express.raw({ type: "*/*", limit: "1mb" }), razorpayWebhook);
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
  app.use("/api/packages", packageRoutes);
  app.use("/api/checkout", checkoutRoutes);
  app.use("/api/payments", paymentRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
