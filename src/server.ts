import express from "express";
import path from "node:path";
import { config } from "./config.js";
import { getDb } from "./db/database.js";
import { createPreferencesRouter } from "./routes/preferences.js";
import { createTemplatesRouter } from "./routes/templates.js";
import { createListingsRouter } from "./routes/listings.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createStatsRouter } from "./routes/stats.js";
import { createHealthRouter } from "./routes/health.js";
import { logger } from "./logger.js";

export function startServer(enqueueMessage?: (id: number) => void): void {
  const app = express();
  const db = getDb();

  app.use(express.json());

  // API routes
  app.use("/api/preferences", createPreferencesRouter(db));
  app.use("/api/templates", createTemplatesRouter(db));
  app.use("/api/listings", createListingsRouter(db, enqueueMessage));
  app.use("/api/sessions", createSessionsRouter(db));
  app.use("/api/stats", createStatsRouter(db));
  app.use("/health", createHealthRouter());

  // Serve frontend static files
  const frontendDist = path.join(process.cwd(), "frontend", "dist");
  app.use(express.static(frontendDist));
  app.get("*path", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  app.listen(config.port, () => {
    logger.info({ port: config.port }, "Server listening");
  });
}
