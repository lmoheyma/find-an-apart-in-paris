import { Router } from "express";
import type Database from "better-sqlite3";
import { getSessions, updateSessionStatus, upsertSession } from "../db/sessions.js";
import { launchLoginBrowser } from "../scraper/browser.js";
import { config } from "../config.js";
import path from "node:path";
import { logger } from "../logger.js";

const PLATFORM_URLS: Record<string, string> = {
  leboncoin: "https://www.leboncoin.fr/compte/connexion",
  seloger: "https://www.seloger.com/connexion",
};

export function createSessionsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(getSessions(db));
  });

  router.post("/:platform/login", async (req, res) => {
    const platform = req.params.platform;
    try {
      const browser = await launchLoginBrowser(platform);
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();

      // Navigate to login page
      const url = PLATFORM_URLS[platform] || `https://www.${platform}.fr`;
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });

      res.json({ message: `Navigateur ouvert sur ${platform}. Connectez-vous puis fermez le navigateur.` });

      // Wait for browser to close, then save session
      browser.on("disconnected", () => {
        const userDataDir = path.join(config.browserDataDir, platform);
        upsertSession(db, platform, userDataDir);
        updateSessionStatus(db, platform, "valid");
        logger.info({ platform }, "Session saved after login");
      });
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
