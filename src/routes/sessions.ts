import { Router } from "express";
import type Database from "better-sqlite3";
import { getSessions, updateSessionStatus } from "../db/sessions.js";
import { launchLoginBrowser } from "../scraper/browser.js";

export function createSessionsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(getSessions(db));
  });

  router.post("/:platform/login", async (req, res) => {
    const platform = req.params.platform;
    try {
      await launchLoginBrowser(platform);
      res.json({ message: `Browser opened for ${platform} login. Close it when done.` });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.put("/:platform/status", (req, res) => {
    const { status } = req.body;
    updateSessionStatus(db, req.params.platform, status);
    res.json({ ok: true });
  });

  return router;
}
