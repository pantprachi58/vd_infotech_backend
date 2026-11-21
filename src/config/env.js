/* Every setting the API reads, in one place. Values come from .env (loaded by
   `node --env-file`) or the real environment. */
export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vdinfotech",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  adminApiKey: process.env.ADMIN_API_KEY || "",
  revalidateUrl: process.env.FRONTEND_REVALIDATE_URL || "",
  revalidateSecret: process.env.REVALIDATE_SECRET || "",
  isProduction: process.env.NODE_ENV === "production",
};
