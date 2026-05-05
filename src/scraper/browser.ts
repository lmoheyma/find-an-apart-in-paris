import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config.js";
import { logger } from "../logger.js";

puppeteer.use(StealthPlugin());

const browsers: Map<string, Browser> = new Map();

function getUserDataDir(platform: string): string {
  const dir = path.join(config.browserDataDir, platform);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function getBrowser(platform: string): Promise<Browser> {
  const existing = browsers.get(platform);
  if (existing && existing.connected) {
    return existing;
  }

  const userDataDir = getUserDataDir(platform);
  logger.info({ platform, userDataDir }, "Launching browser");

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920,1080",
    ],
  });

  browsers.set(platform, browser);
  return browser;
}

export async function launchLoginBrowser(platform: string): Promise<Browser> {
  const userDataDir = getUserDataDir(platform);
  logger.info({ platform }, "Launching visible browser for login");

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir,
    args: ["--window-size=1920,1080"],
  });

  browsers.set(platform, browser);
  return browser;
}

export async function getPage(platform: string): Promise<Page> {
  const browser = await getBrowser(platform);
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  return page;
}

export async function closeAllBrowsers(): Promise<void> {
  for (const [platform, browser] of browsers) {
    logger.info({ platform }, "Closing browser");
    await browser.close();
  }
  browsers.clear();
}

export async function randomDelay(minMs = 500, maxMs = 2000): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
