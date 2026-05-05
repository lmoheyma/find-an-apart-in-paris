import type { Listing } from "../db/listings.js";
import { getPage, randomDelay } from "../scraper/browser.js";
import { logger } from "../logger.js";

export async function sendSelogerMessage(listing: Listing, message: string): Promise<void> {
  logger.info({ listingId: listing.id, url: listing.url }, "Sending SeLoger message");

  const page = await getPage("seloger");
  try {
    await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Click contact button
    const contactBtn = await page.$("button[class*='Contact'], [data-testid='sl.detail.contact-button']");
    if (!contactBtn) {
      throw new Error("Contact button not found on SeLoger listing");
    }
    await contactBtn.click();
    await randomDelay(1000, 2000);

    // Wait for contact form / message area
    const textarea = await page.waitForSelector("textarea[name='message'], textarea[class*='message']", { timeout: 10_000 });
    if (!textarea) {
      throw new Error("Message textarea not found on SeLoger");
    }

    await textarea.click({ clickCount: 3 });
    await textarea.type(message, { delay: 30 + Math.random() * 50 });
    await randomDelay(500, 1500);

    // Submit form
    const sendBtn = await page.$("button[type='submit'], [class*='submit']");
    if (!sendBtn) {
      throw new Error("Submit button not found on SeLoger");
    }
    await sendBtn.click();
    await randomDelay(1000, 2000);

    logger.info({ listingId: listing.id }, "SeLoger message sent");
  } finally {
    await page.close();
  }
}
