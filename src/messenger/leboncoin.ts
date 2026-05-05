import type { Listing } from "../db/listings.js";
import { getPage, randomDelay } from "../scraper/browser.js";
import { logger } from "../logger.js";

export async function sendLeboncoinMessage(listing: Listing, message: string): Promise<void> {
  logger.info({ listingId: listing.id, url: listing.url }, "Sending LeBonCoin message");

  const page = await getPage("leboncoin");
  try {
    await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Click "Envoyer un message" / contact button
    const contactBtn = await page.$("[data-qa-id='adview_contact_container'] button, button[data-spark-component='button']");
    if (!contactBtn) {
      throw new Error("Contact button not found on listing page");
    }
    await contactBtn.click();
    await randomDelay(1000, 2000);

    // Wait for message textarea
    const textarea = await page.waitForSelector("textarea, [data-qa-id='message_area']", { timeout: 10_000 });
    if (!textarea) {
      throw new Error("Message textarea not found");
    }

    // Clear and type message with human-like delay
    await textarea.click({ clickCount: 3 });
    await textarea.type(message, { delay: 30 + Math.random() * 50 });
    await randomDelay(500, 1500);

    // Click send button
    const sendBtn = await page.$("button[type='submit'], [data-qa-id='message_send_button']");
    if (!sendBtn) {
      throw new Error("Send button not found");
    }
    await sendBtn.click();
    await randomDelay(1000, 2000);

    logger.info({ listingId: listing.id }, "LeBonCoin message sent");
  } finally {
    await page.close();
  }
}
