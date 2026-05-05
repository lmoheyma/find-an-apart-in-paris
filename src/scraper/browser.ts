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

function getChromePath(): string {
  // Use CHROME_PATH env var if set, otherwise detect common locations
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    // WSL accessing Windows Chrome
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    // Linux
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Fallback: let Puppeteer use its bundled Chromium
  logger.warn("No system Chrome found, falling back to bundled Chromium (may be detected by anti-bot)");
  return "";
}

const chromePath = getChromePath();

export async function getBrowser(platform: string): Promise<Browser> {
  const existing = browsers.get(platform);
  if (existing && existing.connected) {
    return existing;
  }

  const userDataDir = getUserDataDir(platform);
  logger.info({ platform, userDataDir, chromePath: chromePath || "bundled" }, "Launching browser");

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920,1080",
      "--disable-blink-features=AutomationControlled",
    ],
  };

  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  browsers.set(platform, browser);
  return browser;
}

export async function launchLoginBrowser(platform: string): Promise<Browser> {
  const userDataDir = getUserDataDir(platform);
  logger.info({ platform }, "Launching visible browser for login");

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: false,
    userDataDir,
    args: ["--window-size=1920,1080", "--disable-blink-features=AutomationControlled"],
  };

  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOptions);
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
