import type { Page } from "puppeteer";
import type { ScrapedListing } from "./types.js";
import type { Preference } from "../db/preferences.js";
import { getPage, randomDelay } from "./browser.js";
import { logger } from "../logger.js";

export function buildLeboncoinUrl(pref: Preference): string {
  const params = new URLSearchParams();
  params.set("category", "10"); // locations
  params.set("locations", pref.city);
  if (pref.budget_min) params.set("price", `${pref.budget_min}-${pref.budget_max || ""}`);
  if (pref.budget_max && !pref.budget_min) params.set("price", `-${pref.budget_max}`);
  if (pref.surface_min) params.set("square", `${pref.surface_min}-`);
  if (pref.rooms_min) params.set("rooms", `${pref.rooms_min}-`);
  params.set("sort", "time"); // most recent first
  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

export async function scrapeLeboncoin(pref: Preference): Promise<ScrapedListing[]> {
  const url = buildLeboncoinUrl(pref);
  logger.info({ url, preference: pref.name }, "Scraping LeBonCoin");

  let page: Page | null = null;
  try {
    page = await getPage("leboncoin");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1000, 3000);

    // Check for CAPTCHA
    const captcha = await page.$("[class*='captcha'], [id*='captcha']");
    if (captcha) {
      logger.warn("CAPTCHA detected on LeBonCoin");
      throw new Error("CAPTCHA_DETECTED");
    }

    // Extract listings from search results
    const listings = await page.evaluate(() => {
      const items: Array<{
        external_id: string;
        url: string;
        title: string;
        price: number | null;
        city: string | null;
      }> = [];

      const cards = document.querySelectorAll("[data-qa-id='aditem_container'], a[data-test-id='ad']");
      for (const card of cards) {
        const link = card.closest("a") || card.querySelector("a");
        if (!link) continue;

        const href = link.getAttribute("href") || "";
        const idMatch = href.match(/(\d+)\.htm/);
        if (!idMatch) continue;

        const titleEl = card.querySelector("[data-qa-id='aditem_title'], [data-test-id='ad-title']");
        const priceEl = card.querySelector("[data-qa-id='aditem_price'], [data-test-id='ad-price']");
        const cityEl = card.querySelector("[data-qa-id='aditem_location'], [aria-label*='Localisation']");

        const priceText = priceEl?.textContent?.replace(/[^\d]/g, "") || "";

        items.push({
          external_id: idMatch[1],
          url: href.startsWith("http") ? href : `https://www.leboncoin.fr${href}`,
          title: titleEl?.textContent?.trim() || "",
          price: priceText ? parseInt(priceText, 10) : null,
          city: cityEl?.textContent?.trim() || null,
        });
      }
      return items;
    });

    const results: ScrapedListing[] = listings.map((item) => ({
      external_id: item.external_id,
      url: item.url,
      title: item.title,
      price: item.price,
      surface: null,
      rooms: null,
      city: item.city,
      description: null,
      images: [],
      contact_email: null,
    }));

    logger.info({ count: results.length, preference: pref.name }, "LeBonCoin scrape complete");
    return results;
  } catch (error) {
    logger.error({ error, preference: pref.name }, "LeBonCoin scrape failed");
    throw error;
  } finally {
    if (page) await page.close();
  }
}
