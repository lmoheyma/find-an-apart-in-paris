import type { Page } from "puppeteer";
import type { ScrapedListing } from "./types.js";
import type { Preference } from "../db/preferences.js";
import { getPage, randomDelay } from "./browser.js";
import { logger } from "../logger.js";

export function buildSelogerUrl(pref: Preference): string {
  const params = new URLSearchParams();
  params.set("types", "1"); // location
  params.set("places", `[{cp:${pref.city}}]`);
  if (pref.budget_max) params.set("price", `${pref.budget_min || 0}/${pref.budget_max}`);
  if (pref.surface_min) params.set("surface", `${pref.surface_min}/NaN`);
  if (pref.rooms_min) params.set("rooms", `${pref.rooms_min}/NaN`);
  params.set("sort", "d_dt_crea"); // most recent
  return `https://www.seloger.com/list.htm?${params.toString()}`;
}

export async function scrapeSeloger(pref: Preference): Promise<ScrapedListing[]> {
  const url = buildSelogerUrl(pref);
  logger.info({ url, preference: pref.name }, "Scraping SeLoger");

  let page: Page | null = null;
  try {
    page = await getPage("seloger");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1000, 3000);

    // Check for CAPTCHA / bot detection
    const blocked = await page.$("[class*='captcha'], [class*='challenge'], #sec-overlay");
    if (blocked) {
      logger.warn("Bot detection triggered on SeLoger");
      throw new Error("CAPTCHA_DETECTED");
    }

    const listings = await page.evaluate(() => {
      const items: Array<{
        external_id: string;
        url: string;
        title: string;
        price: number | null;
        surface: number | null;
        rooms: number | null;
        city: string | null;
      }> = [];

      const cards = document.querySelectorAll("[data-testid='sl.explore.card'], .CardContainer, article[class*='Classified']");
      for (const card of cards) {
        const link = card.querySelector("a[href*='/annonces/']") || card.closest("a");
        if (!link) continue;

        const href = link.getAttribute("href") || "";
        const idMatch = href.match(/(\d+)\.htm/) || href.match(/annonces\/[^/]+\/(\d+)/);
        if (!idMatch) continue;

        const titleEl = card.querySelector("[data-testid='sl.explore.card-title'], .card__title, [class*='Title']");
        const priceEl = card.querySelector("[data-testid='sl.explore.card-price'], .card__price, [class*='Price']");
        const surfaceEl = card.querySelector("[class*='Surface'], [class*='area']");
        const roomsEl = card.querySelector("[class*='Rooms'], [class*='room']");
        const cityEl = card.querySelector("[class*='City'], [class*='location']");

        const priceText = priceEl?.textContent?.replace(/[^\d]/g, "") || "";
        const surfaceText = surfaceEl?.textContent?.replace(/[^\d]/g, "") || "";
        const roomsText = roomsEl?.textContent?.replace(/[^\d]/g, "") || "";

        items.push({
          external_id: idMatch[1],
          url: href.startsWith("http") ? href : `https://www.seloger.com${href}`,
          title: titleEl?.textContent?.trim() || "",
          price: priceText ? parseInt(priceText, 10) : null,
          surface: surfaceText ? parseInt(surfaceText, 10) : null,
          rooms: roomsText ? parseInt(roomsText, 10) : null,
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
      surface: item.surface,
      rooms: item.rooms,
      city: item.city,
      description: null,
      images: [],
      contact_email: null,
    }));

    logger.info({ count: results.length, preference: pref.name }, "SeLoger scrape complete");
    return results;
  } catch (error) {
    logger.error({ error, preference: pref.name }, "SeLoger scrape failed");
    throw error;
  } finally {
    if (page) await page.close();
  }
}
