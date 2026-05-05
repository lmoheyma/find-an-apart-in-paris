import type { Page } from "puppeteer";
import type { ScrapedListing } from "./types.js";
import type { Preference } from "../db/preferences.js";
import { getPage, randomDelay, solveCaptchaManually } from "./browser.js";
import { logger } from "../logger.js";

export function buildLeboncoinUrl(pref: Preference, pageNum = 1): string {
  const params = new URLSearchParams();
  params.set("category", "10"); // locations
  params.set("locations", pref.leboncoin_location);
  if (pref.budget_min || pref.budget_max) params.set("price", `${pref.budget_min || "min"}-${pref.budget_max || "max"}`);
  if (pref.surface_min) params.set("square", `${pref.surface_min}-`);
  if (pref.rooms_min || pref.rooms_max) params.set("bedrooms", `${pref.rooms_min || ""}-${pref.rooms_max || ""}`);
  params.set("sort", "time"); // most recent first
  if (pageNum > 1) params.set("page", String(pageNum));
  return `https://www.leboncoin.fr/recherche?${params.toString()}`;
}

export async function scrapeLeboncoinDeep(pref: Preference, maxPages = 10): Promise<ScrapedListing[]> {
  const allResults: ScrapedListing[] = [];
  for (let p = 1; p <= maxPages; p++) {
    logger.info({ page: p, maxPages, preference: pref.name }, "Scraping LeBonCoin page");
    const results = await scrapeLeboncoinPage(pref, p);
    if (results.length === 0) break;
    allResults.push(...results);
    await randomDelay(2000, 5000);
  }
  logger.info({ total: allResults.length, preference: pref.name }, "LeBonCoin deep scrape complete");
  return allResults;
}

export async function scrapeLeboncoin(pref: Preference): Promise<ScrapedListing[]> {
  return scrapeLeboncoinPage(pref, 1);
}

async function scrapeLeboncoinPage(pref: Preference, pageNum: number): Promise<ScrapedListing[]> {
  const url = buildLeboncoinUrl(pref, pageNum);
  logger.info({ url, preference: pref.name }, "Scraping LeBonCoin");

  let page: Page | null = null;
  try {
    page = await getPage("leboncoin");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1000, 3000);

    // Check for CAPTCHA / DataDome verification
    const pageContent = await page.content();
    const isCaptcha = await page.$("[class*='captcha'], [id*='captcha']");
    const isDataDome = pageContent.includes("Verification Required") || pageContent.includes("Slide right to secure");

    if (isCaptcha || isDataDome || pageContent.length < 50000) {
      logger.warn("CAPTCHA/DataDome detected on LeBonCoin");
      await page.close();
      page = null;
      await solveCaptchaManually("leboncoin", url);

      // Retry after manual solve
      page = await getPage("leboncoin");
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });
      await randomDelay(2000, 4000);
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

      // Find ad cards by their class pattern
      const cards = document.querySelectorAll("li[class*='adCard']");
      for (const card of cards) {
        // Find the listing link (href like /ad/locations/12345)
        const link = card.querySelector("a[href*='/ad/']") as HTMLAnchorElement | null;
        if (!link) continue;

        const href = link.getAttribute("href") || "";
        const idMatch = href.match(/\/ad\/[^/]+\/(\d+)/);
        if (!idMatch) continue;

        // Title is in the aria-label or span title of the link
        const titleSpan = link.querySelector("span[title]");
        const titleText = titleSpan?.getAttribute("title")?.replace(/^Voir l'annonce:\s*/, "") || link.getAttribute("aria-label") || "";

        // Price: look for text containing €
        const allText = card.textContent || "";
        const priceMatch = allText.match(/([\d\s]+)\s*€/);
        const priceText = priceMatch ? priceMatch[1].replace(/\s/g, "") : "";

        // City: typically after the price area
        const locationEl = card.querySelector("p[class*='location'], span[class*='location'], [class*='Location']");
        const cityText = locationEl?.textContent?.trim() || null;

        items.push({
          external_id: idMatch[1],
          url: `https://www.leboncoin.fr${href}`,
          title: titleText,
          price: priceText ? parseInt(priceText, 10) : null,
          city: cityText,
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
