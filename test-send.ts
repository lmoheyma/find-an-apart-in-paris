import dotenv from "dotenv";
dotenv.config();
import { getPage, randomDelay, solveCaptchaManually, closeAllBrowsers } from "./src/scraper/browser.js";
import { logger } from "./src/logger.js";

const TEST_MESSAGE = `Bonjour,
votre bien m'intéresse, est-il toujours disponible ?

Cordialement,
Louis`;

const LBC_TEST_URL = "https://www.leboncoin.fr/ad/locations/3146820612";
const SL_TEST_URL = "https://www.seloger.com/annonces/locations/appartement/toulouse-31/saint-michel-le-busca-empalot-saint-agne/268244625.htm";

async function testLeboncoin() {
  logger.info("=== Testing LeBonCoin message send ===");
  let page = await getPage("leboncoin");
  try {
    await page.goto(LBC_TEST_URL, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Check for CAPTCHA
    const content = await page.content();
    if (content.includes("Verification Required") || content.includes("Slide right to secure") || content.length < 50000) {
      await page.close();
      await solveCaptchaManually("leboncoin", LBC_TEST_URL);
      page = await getPage("leboncoin");
      await page.goto(LBC_TEST_URL, { waitUntil: "networkidle2", timeout: 30_000 });
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

    if (!clicked) {
      await page.screenshot({ path: "debug-lbc-no-btn.png", fullPage: true });
      logger.error("Could not find 'Envoyer un message' button");
      return;
    }

    logger.info("Clicked 'Envoyer un message'");
    await randomDelay(2000, 3000);

    // Wait for textarea
    const textarea = await page.waitForSelector("textarea", { timeout: 10_000 }).catch(() => null);
    if (!textarea) {
      await page.screenshot({ path: "debug-lbc-no-textarea.png", fullPage: true });
      logger.error("No textarea found — check debug-lbc-no-textarea.png");
      return;
    }

    // Set message
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
    }, textarea, TEST_MESSAGE);

    await randomDelay(500, 1000);

    // Click send
    const sendClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const btn of buttons) {
        if (btn.textContent?.includes("Envoyer") && !btn.textContent?.includes("Envoyer un message") && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      const submit = document.querySelector("button[type='submit']") as HTMLButtonElement | null;
      if (submit) { submit.click(); return true; }
      return false;
    });
    logger.info({ sendClicked }, "Clicked send button");
    await randomDelay(3000, 5000);
    await page.screenshot({ path: "debug-lbc-after-send.png", fullPage: true });
    logger.info("=== LeBonCoin test complete — check debug-lbc-after-send.png ===");
  } finally {
    await page.close();
  }
}

async function testSeloger() {
  logger.info("=== Testing SeLoger message send ===");
  let page = await getPage("seloger");
  try {
    await page.goto(SL_TEST_URL, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Check for CAPTCHA / DataDome
    const content = await page.content();
    const pageTitle = await page.title();
    const hasListings = content.includes("annonce") && content.length > 100000;
    logger.info({ pageTitle, contentLength: content.length, hasVR: content.includes("Verification Required"), hasSlide: content.includes("Slide right") }, "SeLoger page check");

    if (!hasListings) {
      logger.warn("SeLoger blocked — opening browser for manual CAPTCHA solve");
      await page.close();
      await solveCaptchaManually("seloger", SL_TEST_URL);
      page = await getPage("seloger");
      await page.goto(SL_TEST_URL, { waitUntil: "networkidle2", timeout: 30_000 });
      await randomDelay(1500, 3000);
    }

    await page.screenshot({ path: "debug-sl-page.png", fullPage: true });

    // Find and click contact button by text
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || "";
        if ((text.includes("contacter") || text.includes("message") || text.includes("envoyer")) && btn.offsetParent !== null) {
          btn.click();
          return btn.textContent?.trim().substring(0, 50) || "unknown";
        }
      }
      return null;
    });

    if (!clicked) {
      logger.error("No contact button found on SeLoger — check debug-sl-page.png");
      return;
    }

    logger.info({ clicked }, "Clicked contact button");
    await randomDelay(2000, 3000);

    const textarea = await page.waitForSelector("textarea", { timeout: 10_000 }).catch(() => null);
    if (!textarea) {
      await page.screenshot({ path: "debug-sl-no-textarea.png", fullPage: true });
      logger.error("No textarea found — check debug-sl-no-textarea.png");
      return;
    }

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
    }, textarea, TEST_MESSAGE);

    await randomDelay(500, 1000);

    // Click send
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
    logger.info({ sendClicked }, "Clicked send button");
    await randomDelay(3000, 5000);
    await page.screenshot({ path: "debug-sl-after-send.png", fullPage: true });
    logger.info("=== SeLoger test complete — check debug-sl-after-send.png ===");
  } finally {
    await page.close();
  }
}

async function main() {
  try {
    await testLeboncoin();
    await testSeloger();
  } finally {
    await closeAllBrowsers();
  }
}

main().catch(console.error);
