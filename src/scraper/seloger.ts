import type { Page } from "puppeteer";
import type { ScrapedListing } from "./types.js";
import type { Preference } from "../db/preferences.js";
import { getPage, randomDelay, solveCaptchaManually } from "./browser.js";
import { logger } from "../logger.js";

export function buildSelogerUrl(pref: Preference, pageNum = 1): string {
  const params = new URLSearchParams();
  params.set("distributionTypes", "Rent");
  params.set("estateTypes", "Apartment");
  params.set("locations", pref.seloger_location);
  if (pref.budget_min) params.set("priceMin", String(pref.budget_min));
  if (pref.budget_max) params.set("priceMax", String(pref.budget_max));
  if (pref.surface_min) params.set("surfaceMin", String(pref.surface_min));
  if (pref.rooms_min) params.set("numberOfBedroomsMin", String(pref.rooms_min));
  if (pref.rooms_max) params.set("numberOfBedroomsMax", String(pref.rooms_max));
  params.set("projectTypes", "Stock");
  params.set("order", "DateDesc");
  if (pageNum > 1) params.set("page", String(pageNum));
  return `https://www.seloger.com/classified-search?${params.toString()}`;
}

export async function scrapeSelogerDeep(pref: Preference, maxPages = 10): Promise<ScrapedListing[]> {
  const allResults: ScrapedListing[] = [];
  for (let p = 1; p <= maxPages; p++) {
    logger.info({ page: p, maxPages, preference: pref.name }, "Scraping SeLoger page");
    const results = await scrapeSelogerPage(pref, p);
    if (results.length === 0) break;
    allResults.push(...results);
    await randomDelay(2000, 5000);
  }
  logger.info({ total: allResults.length, preference: pref.name }, "SeLoger deep scrape complete");
  return allResults;
}

export async function scrapeSeloger(pref: Preference): Promise<ScrapedListing[]> {
  return scrapeSelogerPage(pref, 1);
}

async function scrapeSelogerPage(pref: Preference, pageNum: number): Promise<ScrapedListing[]> {
  const url = buildSelogerUrl(pref, pageNum);
  logger.info({ url, preference: pref.name }, "Scraping SeLoger");

  let page: Page | null = null;
  try {
    page = await getPage("seloger");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1000, 3000);

    // Check for CAPTCHA / bot detection / DataDome
    const pageContent = await page.content();
    const blocked = await page.$("[class*='captcha'], [class*='challenge'], #sec-overlay");
    const isDataDome = pageContent.includes("Verification Required") || pageContent.includes("Slide right to secure");

    if (blocked || isDataDome) {
      logger.warn("CAPTCHA/DataDome detected on SeLoger");
      await page.close();
      page = null;
      await solveCaptchaManually("seloger", url);

      // Retry after manual solve
      page = await getPage("seloger");
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
      await randomDelay(1000, 3000);
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

      // Find all listing links (href contains /annonces/ and ends with .htm)
      const links = document.querySelectorAll('a[href*="/annonces/"][href$=".htm"], a[href*="/annonces/"][href*=".htm?"]');
      const seen = new Set<string>();

      for (const link of links) {
        const href = link.getAttribute("href") || "";
        // Extract ID from URL like .../264471207.htm
        const idMatch = href.match(/\/(\d+)\.htm/);
        if (!idMatch) continue;

        const externalId = idMatch[1];
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        // Clean URL (remove query params and hash)
        const cleanUrl = href.split("?")[0].split("#")[0];
        const fullUrl = cleanUrl.startsWith("http") ? cleanUrl : `https://www.seloger.com${cleanUrl}`;

        // The card container is the closest parent div
        const card = link.closest("div") as HTMLElement | null;
        const cardText = card?.textContent || "";

        // Extract price (number followed by €)
        const priceMatch = cardText.match(/([\d\s.]+)\s*€/);
        const priceText = priceMatch ? priceMatch[1].replace(/[\s.]/g, "") : "";

        // Extract surface (number followed by m²)
        const surfaceMatch = cardText.match(/(\d+)\s*m²/);

        // Extract rooms/pièces
        const roomsMatch = cardText.match(/(\d+)\s*(?:pièce|chambre)/i);

        // Extract city from URL path (e.g., /paris-15eme-75/)
        const cityMatch = href.match(/\/annonces\/[^/]+\/[^/]+\/([^/]+)\//);
        const cityFromUrl = cityMatch ? cityMatch[1].replace(/-/g, " ") : null;

        items.push({
          external_id: externalId,
          url: fullUrl,
          title: cardText.substring(0, 100).trim(),
          price: priceText ? parseInt(priceText, 10) : null,
          surface: surfaceMatch ? parseInt(surfaceMatch[1], 10) : null,
          rooms: roomsMatch ? parseInt(roomsMatch[1], 10) : null,
          city: cityFromUrl,
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
