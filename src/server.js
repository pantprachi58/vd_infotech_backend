import { createApp } from "./app.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { env } from "./config/env.js";

async function start() {
  await connectDb();
  if (!env.adminApiKey) console.warn("ADMIN_API_KEY is not set — write routes will refuse every request.");

  const server = createApp().listen(env.port, () => {
    console.log(`Blog API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
