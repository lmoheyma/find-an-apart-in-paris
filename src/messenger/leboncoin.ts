import type { Listing } from "../db/listings.js";
import { getPage, randomDelay, solveCaptchaManually } from "../scraper/browser.js";
import { logger } from "../logger.js";

export async function sendLeboncoinMessage(listing: Listing, message: string): Promise<void> {
  logger.info({ listingId: listing.id, url: listing.url }, "Sending LeBonCoin message");

  let page = await getPage("leboncoin");
  try {
    await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Check for CAPTCHA
    const content = await page.content();
    if (content.includes("Verification Required") || content.includes("Slide right to secure") || content.length < 50000) {
      await page.close();
      await solveCaptchaManually("leboncoin", listing.url);
      page = await getPage("leboncoin");
      await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
      await randomDelay(1500, 3000);
    }

    // Click "Envoyer un message" by text
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const btn of buttons) {
        if (btn.textContent?.includes("Envoyer un message") && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error("Contact button not found on listing page");
    await randomDelay(2000, 3000);

    // Wait for message textarea
    const textarea = await page.waitForSelector("textarea", { timeout: 10_000 });
    if (!textarea) throw new Error("Message textarea not found");

    // Set message content using React-compatible method
    await textarea.click();
    await page.evaluate((el, msg) => {
      const ta = el as HTMLTextAreaElement;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(ta, msg);
      } else {
        ta.value = msg;
      }
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.dispatchEvent(new Event("change", { bubbles: true }));
    }, textarea, message);
    await randomDelay(500, 1500);

    // Click send button
    const sendClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const btn of buttons) {
        if (btn.textContent?.includes("Envoyer") && !btn.textContent?.includes("Envoyer un message") && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      // Fallback: submit button
      const submit = document.querySelector("button[type='submit']") as HTMLButtonElement | null;
      if (submit) { submit.click(); return true; }
      return false;
    });
    if (!sendClicked) throw new Error("Send button not found");
    await randomDelay(1000, 2000);

    logger.info({ listingId: listing.id }, "LeBonCoin message sent");
  } finally {
    await page.close();
  }
}
