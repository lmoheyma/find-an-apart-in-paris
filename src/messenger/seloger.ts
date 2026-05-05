import type { Listing } from "../db/listings.js";
import { getPage, randomDelay, solveCaptchaManually } from "../scraper/browser.js";
import { logger } from "../logger.js";

export async function sendSelogerMessage(listing: Listing, message: string): Promise<void> {
  logger.info({ listingId: listing.id, url: listing.url }, "Sending SeLoger message");

  let page = await getPage("seloger");
  try {
    await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Check for CAPTCHA / DataDome
    const content = await page.content();
    if (content.length < 100000) {
      await page.close();
      await solveCaptchaManually("seloger", listing.url);
      page = await getPage("seloger");
      await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
      await randomDelay(1500, 3000);
    }

    // Click contact button by text
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || "";
        if ((text.includes("contacter") || text.includes("envoyer")) && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error("Contact button not found on SeLoger listing");
    await randomDelay(2000, 3000);

    // Wait for textarea
    const textarea = await page.waitForSelector("textarea", { timeout: 10_000 });
    if (!textarea) throw new Error("Message textarea not found on SeLoger");

    // Set message content using React-compatible method
    await textarea.click();
    await page.evaluate((el, msg) => {
      const ta = el as HTMLTextAreaElement;
      // Use React's internal value setter to bypass React state
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

    // Submit form
    const sendClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || "";
        if (text.includes("envoyer") && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      const submit = document.querySelector("button[type='submit']") as HTMLButtonElement | null;
      if (submit) { submit.click(); return true; }
      return false;
    });
    if (!sendClicked) throw new Error("Submit button not found on SeLoger");
    await randomDelay(1000, 2000);

    logger.info({ listingId: listing.id }, "SeLoger message sent");
  } finally {
    await page.close();
  }
}
