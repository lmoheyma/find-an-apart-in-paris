import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";

fs.mkdirSync(config.logDir, { recursive: true });

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: { destination: 1 }, // stdout
        level: "info",
      },
      {
        target: "pino/file",
        options: { destination: path.join(config.logDir, "app.log") },
        level: "debug",
      },
    ],
  },
});
