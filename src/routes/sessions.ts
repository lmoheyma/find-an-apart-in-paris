import { Router } from "express";
import type Database from "better-sqlite3";
import { getSessions, updateSessionStatus, upsertSession } from "../db/sessions.js";
import { launchLoginBrowser, closeBrowser, withPlatformLock } from "../scraper/browser.js";
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

    // Hold the platform lock for the entire login session — prevents scraper/messenger
    // from touching the same userDataDir while the user is logging in.
    // We respond immediately, then keep the lock until the user closes the browser.
    let responded = false;
    void withPlatformLock(platform, async () => {
      try {
        await closeBrowser(platform);
        const browser = await launchLoginBrowser(platform);
        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();
        const url = PLATFORM_URLS[platform] || `https://www.${platform}.fr`;
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });

        res.json({ message: `Navigateur ouvert sur ${platform}. Connectez-vous puis fermez le navigateur.` });
        responded = true;

        // Wait for the user to close the browser, then save the session.
        // This keeps the platform lock held until login completes.
        await new Promise<void>((resolve) => {
          browser.on("disconnected", () => {
            const userDataDir = path.join(config.browserDataDir, platform);
            upsertSession(db, platform, userDataDir);
            updateSessionStatus(db, platform, "valid");
            logger.info({ platform }, "Session saved after login");
            resolve();
          });
        });
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error), platform }, "Login flow failed");
        if (!responded) res.status(500).json({ error: String(error) });
      }
    });
  });

  router.put("/:platform/status", (req, res) => {
    const { status } = req.body;
    updateSessionStatus(db, req.params.platform, status);
    res.json({ ok: true });
  });

  return router;
}
