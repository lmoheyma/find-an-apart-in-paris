import { config } from "./config.js";
import { logger } from "./logger.js";
import { getDb, closeDb } from "./db/database.js";
import { getActivePreferences } from "./db/preferences.js";
import { insertListing, listingExists } from "./db/listings.js";
import { createMessage, updateMessageStatus } from "./db/messages.js";
import { getDefaultTemplate } from "./db/templates.js";
import { scrapeLeboncoin } from "./scraper/leboncoin.js";
import { scrapeSeloger } from "./scraper/seloger.js";
import { closeAllBrowsers, CaptchaError, SessionExpiredError } from "./scraper/browser.js";
import { updateSessionStatus, upsertSession } from "./db/sessions.js";
import path from "node:path";
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

// Message queue handler. Returns true if the message actually went out
// (counts toward hourly rate limit). False for retries / CAPTCHA / session skips.
async function handleMessage(messageId: number): Promise<boolean> {
  const msg = db.prepare("SELECT * FROM messages_sent WHERE id = ?").get(messageId) as any;
  if (!msg || msg.status !== "pending") return false;

  const listing = db.prepare("SELECT * FROM listings WHERE id = ?").get(msg.listing_id) as Listing;
  if (!listing) return false;

  const template = getDefaultTemplate(db);
  if (!template) {
    logger.warn("No default template configured");
    updateMessageStatus(db, messageId, "failed", "No default template");
    return false;
  }

  const messageBody = interpolateTemplate(template.body, {
    title: listing.title,
    price: listing.price,
    city: listing.city,
    surface: listing.surface,
    rooms: listing.rooms,
    url: listing.url,
  });

  if (config.dryRun) {
    logger.info({ messageId, platform: listing.platform, method: msg.method, title: listing.title, messageBody }, "[DRY RUN] Message would be sent");
    updateMessageStatus(db, messageId, "sent");
    return true;
  }

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
    return true;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    // CAPTCHA/Session expired: don't count as a retry — needs human action.
    // Message stays pending; reEnqueuePending will retry once session is valid again.
    if (error instanceof CaptchaError) {
      flagSession(error.platform, "captcha_required");
      logger.warn({ messageId, platform: error.platform }, "Message send skipped — CAPTCHA required");
      return false;
    }
    if (error instanceof SessionExpiredError) {
      flagSession(error.platform, "needs_check");
      logger.warn({ messageId, platform: error.platform, reason: errMsg }, "Message send skipped — session likely expired");
      return false;
    }

    // Transient error: retry up to MAX_RETRIES with exponential-ish backoff via the queue's natural delay
    const MAX_RETRIES = 3;
    const retryCount = (msg.retry_count ?? 0) + 1;
    if (retryCount < MAX_RETRIES) {
      db.prepare("UPDATE messages_sent SET retry_count = ?, error = ? WHERE id = ?").run(retryCount, errMsg, messageId);
      logger.warn({ messageId, retryCount, error: errMsg }, "Message send failed — will retry");
      // Re-enqueue after the queue's finally block removes the dedup entry.
      // Backoff: 30s × retryCount.
      setTimeout(() => messageQueue.enqueue(messageId), 30_000 * retryCount);
      return false;
    }

    logger.error({ messageId, retryCount, error: errMsg }, "Message send failed permanently");
    updateMessageStatus(db, messageId, "failed", errMsg);
    return false;
  }
}

function flagSession(platform: string, status: string): void {
  const userDataDir = path.join(config.browserDataDir, platform);
  upsertSession(db, platform, userDataDir);
  updateSessionStatus(db, platform, status);
}

const messageQueue = new MessageQueue(config.messaging, handleMessage);

function reEnqueuePending(): void {
  const pendingMessages = db.prepare("SELECT id FROM messages_sent WHERE status = 'pending' ORDER BY id ASC").all() as Array<{ id: number }>;
  if (pendingMessages.length > 0) {
    logger.info({ count: pendingMessages.length }, "Re-enqueuing pending messages from DB");
    for (const msg of pendingMessages) {
      messageQueue.enqueue(msg.id);
    }
  }
}

// Main scrape cycle
async function scrapeCycle(): Promise<void> {
  const preferences = getActivePreferences(db);
  if (preferences.length === 0) {
    logger.debug("No active preferences, skipping cycle");
    return;
  }

  for (const pref of preferences) {
    try {
      // Scrape platforms (only if enabled and location is configured)
      const scrapePromises: Array<Promise<{ platform: string; listings: ScrapedListing[] }>> = [];
      if (config.scrapers.leboncoinEnabled && pref.leboncoin_location) {
        scrapePromises.push(scrapeLeboncoin(pref).then(listings => ({ platform: "leboncoin", listings })));
      }
      if (config.scrapers.selogerEnabled && pref.seloger_location) {
        scrapePromises.push(scrapeSeloger(pref).then(listings => ({ platform: "seloger", listings })));
      }
      const results = await Promise.allSettled(scrapePromises);

      const allScraped: Array<{ platform: string; listing: ScrapedListing }> = [];

      for (const result of results) {
        if (result.status === "fulfilled") {
          for (const l of result.value.listings) allScraped.push({ platform: result.value.platform, listing: l });
        } else {
          const reason = result.reason;
          if (reason instanceof CaptchaError) {
            flagSession(reason.platform, "captcha_required");
            logger.warn({ platform: reason.platform, pref: pref.name }, "Scrape skipped — CAPTCHA required");
          } else {
            const errMsg = reason instanceof Error ? reason.message : String(reason);
            logger.error({ error: errMsg, pref: pref.name }, "Scrape failed");
          }
        }
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

  // After scraping, re-enqueue any pending messages (including from previous runs)
  reEnqueuePending();
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

startServer((id) => messageQueue.enqueue(id));
scheduler.start();
if (config.dryRun) {
  logger.info("*** DRY RUN MODE — scraping active, messages will NOT be sent ***");
}
logger.info({ port: config.port, interval: config.polling.intervalMs, dryRun: config.dryRun }, "Apartment scraper started");
