import { Router } from "express";
import type Database from "better-sqlite3";
import { getListings, insertListing, listingExists } from "../db/listings.js";
import { getMessagesForListing, createMessage } from "../db/messages.js";
import { getActivePreferences } from "../db/preferences.js";
import { scrapeLeboncoinDeep } from "../scraper/leboncoin.js";
import { scrapeSelogerDeep } from "../scraper/seloger.js";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { ScrapedListing } from "../scraper/types.js";

export function createListingsRouter(db: Database.Database, enqueueMessage?: (id: number) => void): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const platform = req.query.platform as string | undefined;
    const result = getListings(db, { limit, offset, platform });
    res.json(result);
  });

  router.get("/:id/messages", (req, res) => {
    const id = Number(req.params.id);
    res.json(getMessagesForListing(db, id));
  });

  // Deep scrape all pages + send messages to uncontacted listings
  router.post("/send-recent", async (req, res) => {
    const days = Number(req.body.days) || 15;

    try {
      const preferences = getActivePreferences(db);
      if (preferences.length === 0) {
        res.json({ scraped: 0, queued: 0, listings: 0 });
        return;
      }

      // Deep scrape all platforms for all preferences
      let totalScraped = 0;
      for (const pref of preferences) {
        const scrapePromises: Array<Promise<{ platform: string; listings: import("../scraper/types.js").ScrapedListing[] }>> = [];
        if (config.scrapers.leboncoinEnabled && pref.leboncoin_location) {
          scrapePromises.push(scrapeLeboncoinDeep(pref).then(listings => ({ platform: "leboncoin", listings })));
        }
        if (config.scrapers.selogerEnabled && pref.seloger_location) {
          scrapePromises.push(scrapeSelogerDeep(pref).then(listings => ({ platform: "seloger", listings })));
        }
        const results = await Promise.allSettled(scrapePromises);

        const allScraped: Array<{ platform: string; listing: ScrapedListing }> = [];

        for (const result of results) {
          if (result.status === "fulfilled") {
            for (const l of result.value.listings) allScraped.push({ platform: result.value.platform, listing: l });
          } else {
            logger.error({ error: result.reason, pref: pref.name }, "Deep scrape failed");
          }
        }

        // Save new listings
        for (const { platform, listing } of allScraped) {
          if (listingExists(db, platform, listing.external_id)) continue;
          insertListing(db, {
            platform,
            external_id: listing.external_id,
            url: listing.url,
            title: listing.title,
            price: listing.price,
            surface: listing.surface,
            rooms: listing.rooms,
            city: listing.city,
            description: listing.description,
            images: JSON.stringify(listing.images),
            contact_email: listing.contact_email,
          });
          totalScraped++;
        }
      }

      // Queue messages for all uncontacted listings from last N days
      const since = new Date();
      since.setDate(since.getDate() - days);

      const uncontacted = db.prepare(`
        SELECT l.* FROM listings l
        WHERE l.discovered_at >= ?
        AND NOT EXISTS (
          SELECT 1 FROM messages_sent m WHERE m.listing_id = l.id
        )
      `).all(since.toISOString()) as Array<{ id: number; platform: string; contact_email: string | null }>;

      let queued = 0;
      for (const listing of uncontacted) {
        const msg = createMessage(db, { listing_id: listing.id, platform: listing.platform, method: "platform_message" });
        if (enqueueMessage) enqueueMessage(msg.id);
        queued++;

        if (listing.contact_email) {
          const emailMsg = createMessage(db, { listing_id: listing.id, platform: listing.platform, method: "email" });
          if (enqueueMessage) enqueueMessage(emailMsg.id);
        }
      }

      logger.info({ days, scraped: totalScraped, queued, total: uncontacted.length }, "Deep scrape + send complete");
      res.json({ scraped: totalScraped, queued, listings: uncontacted.length });
    } catch (error) {
      logger.error({ error }, "Deep scrape + send failed");
      res.status(500).json({ error: "Scrape failed" });
    }
  });

  return router;
}
