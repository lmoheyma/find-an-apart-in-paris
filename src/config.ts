import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export const config = {
  dryRun: process.env.DRY_RUN === "true",
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || path.join(process.cwd(), "data.db"),
  logDir: process.env.LOG_DIR || path.join(process.cwd(), "logs"),
  browserDataDir: process.env.BROWSER_DATA_DIR || path.join(process.cwd(), "browser-data"),
  polling: {
    intervalMs: Number(process.env.POLLING_INTERVAL_MS) || 90_000, // 1.5 min
  },
  scrapers: {
    leboncoinEnabled: process.env.LEBONCOIN_ENABLED !== "false",
    selogerEnabled: process.env.SELOGER_ENABLED === "true",
  },
  messaging: {
    maxPerHour: Number(process.env.MAX_MESSAGES_PER_HOUR) || 5,
    delayMinMs: 10_000,  // 10 sec
    delayMaxMs: 30_000,  // 30 sec
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "",
  },
};
