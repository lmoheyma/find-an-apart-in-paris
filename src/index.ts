import { config } from "./config.js";
import { logger } from "./logger.js";
import { getDb, closeDb } from "./db/database.js";
import { getActivePreferences } from "./db/preferences.js";
import { insertListing, listingExists } from "./db/listings.js";
import { createMessage, updateMessageStatus } from "./db/messages.js";
import { getDefaultTemplate } from "./db/templates.js";
import { scrapeLeboncoin } from "./scraper/leboncoin.js";
import { scrapeSeloger } from "./scraper/seloger.js";
import { closeAllBrowsers } from "./scraper/browser.js";
import { sendLeboncoinMessage } from "./messenger/leboncoin.js";
import { sendSelogerMessage } from "./messenger/seloger.js";
import { sendEmail } from "./messenger/email.js";
import { interpolateTemplate } from "./messenger/template.js";
import { MessageQueue } from "./messenger/queue.js";
import { Scheduler } from "./scheduler/scheduler.js";
import { startServer } from "./server.js";
import type { ScrapedListing } from "./scraper/types.js";
import type { Listing } from "./db/listings.js";

const db = getDb();

// Message queue handler
async function handleMessage(messageId: number): Promise<void> {
  const msg = db.prepare("SELECT * FROM messages_sent WHERE id = ?").get(messageId) as any;
  if (!msg || msg.status !== "pending") return;

  const listing = db.prepare("SELECT * FROM listings WHERE id = ?").get(msg.listing_id) as Listing;
  if (!listing) return;

  const template = getDefaultTemplate(db);
  if (!template) {
    logger.warn("No default template configured");
    updateMessageStatus(db, messageId, "failed", "No default template");
    return;
  }

  const messageBody = interpolateTemplate(template.body, {
    title: listing.title,
    price: listing.price,
    city: listing.city,
    surface: listing.surface,
    rooms: listing.rooms,
    url: listing.url,
  });

  try {
    if (msg.method === "platform_message") {
      if (listing.platform === "leboncoin") {
        await sendLeboncoinMessage(listing, messageBody);
      } else {
        await sendSelogerMessage(listing, messageBody);
      }
    } else if (msg.method === "email" && listing.contact_email) {
      await sendEmail(listing.contact_email, `Re: ${listing.title}`, messageBody);
    }
    updateMessageStatus(db, messageId, "sent");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ messageId, error: errMsg }, "Message send failed");
    updateMessageStatus(db, messageId, "failed", errMsg);
  }
}

const messageQueue = new MessageQueue(config.messaging, handleMessage);

// Main scrape cycle
async function scrapeCycle(): Promise<void> {
  const preferences = getActivePreferences(db);
  if (preferences.length === 0) {
    logger.debug("No active preferences, skipping cycle");
    return;
  }

  for (const pref of preferences) {
    try {
      // Scrape both platforms
      const [lbcListings, slListings] = await Promise.allSettled([
        scrapeLeboncoin(pref),
        scrapeSeloger(pref),
      ]);

      const allScraped: Array<{ platform: string; listing: ScrapedListing }> = [];

      if (lbcListings.status === "fulfilled") {
        for (const l of lbcListings.value) {
          allScraped.push({ platform: "leboncoin", listing: l });
        }
      } else {
        logger.error({ error: lbcListings.reason, pref: pref.name }, "LeBonCoin scrape failed");
      }

      if (slListings.status === "fulfilled") {
        for (const l of slListings.value) {
          allScraped.push({ platform: "seloger", listing: l });
        }
      } else {
        logger.error({ error: slListings.reason, pref: pref.name }, "SeLoger scrape failed");
      }

      // Process new listings
      for (const { platform, listing } of allScraped) {
        if (listingExists(db, platform, listing.external_id)) continue;

        const saved = insertListing(db, {
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

        logger.info({ platform, title: saved.title, id: saved.id }, "New listing found");

        // Queue platform message
        const platformMsg = createMessage(db, { listing_id: saved.id, platform, method: "platform_message" });
        messageQueue.enqueue(platformMsg.id);

        // Queue email if available
        if (saved.contact_email) {
          const emailMsg = createMessage(db, { listing_id: saved.id, platform, method: "email" });
          messageQueue.enqueue(emailMsg.id);
        }
      }
    } catch (error) {
      logger.error({ error, pref: pref.name }, "Scrape cycle error for preference");
    }
  }
}

// Graceful shutdown
function shutdown(): void {
  logger.info("Shutting down...");
  scheduler.stop();
  messageQueue.stop();
  closeAllBrowsers().then(() => {
    closeDb();
    logger.info("Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start
const scheduler = new Scheduler(scrapeCycle, config.polling.intervalMs);

startServer();
scheduler.start();
logger.info({ port: config.port, interval: config.polling.intervalMs }, "Apartment scraper started");
