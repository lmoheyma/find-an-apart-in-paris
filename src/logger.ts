import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";

fs.mkdirSync(config.logDir, { recursive: true });

// In production (PM2), write plain JSON to stdout — synchronous, no worker threads,
// so PM2 captures every line immediately. View with `pm2 logs | npx pino-pretty`.
// In dev (npm run dev / NODE_ENV !== production), use pretty-printed transport.
const isProd = process.env.NODE_ENV === "production";

const fileStream = pino.destination({
  dest: path.join(config.logDir, "app.log"),
  sync: false,
  mkdir: true,
});

export const logger = isProd
  ? pino(
      {
        level: process.env.LOG_LEVEL || "debug",
        serializers: {
          error: pino.stdSerializers.err,
          err: pino.stdSerializers.err,
        },
      },
      pino.multistream([
        { level: "info", stream: process.stdout },
        { level: "debug", stream: fileStream },
      ]),
    )
  : pino({
      level: process.env.LOG_LEVEL || "info",
      serializers: {
        error: pino.stdSerializers.err,
        err: pino.stdSerializers.err,
      },
      transport: {
        targets: [
          { target: "pino-pretty", options: { destination: 1 }, level: "info" },
          {
            target: "pino/file",
            options: { destination: path.join(config.logDir, "app.log") },
            level: "debug",
          },
        ],
      },
    });
