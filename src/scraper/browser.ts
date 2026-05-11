import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, Page } from "puppeteer";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config.js";
import { logger } from "../logger.js";

puppeteer.use(StealthPlugin());

const browsers: Map<string, Browser> = new Map();

// Per-platform serialization. All scraper, messenger, and login operations
// MUST run inside withPlatformLock to prevent userDataDir contention.
const platformLocks: Map<string, Promise<unknown>> = new Map();

export async function withPlatformLock<T>(platform: string, fn: () => Promise<T>): Promise<T> {
  const prev = platformLocks.get(platform) || Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  platformLocks.set(platform, next);
  try {
    return await next;
  } finally {
    // Only clear if no further work was queued behind us
    if (platformLocks.get(platform) === next) {
      platformLocks.delete(platform);
    }
  }
}

export class CaptchaError extends Error {
  constructor(public platform: string) {
    super(`CAPTCHA detected on ${platform} — manual login required`);
    this.name = "CaptchaError";
  }
}

function getUserDataDir(platform: string): string {
  const dir = path.join(config.browserDataDir, platform);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function clearStaleChromeLocks(userDataDir: string): void {
  for (const lockFile of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    const lockPath = path.join(userDataDir, lockFile);
    try {
      if (fs.existsSync(lockPath) || fs.lstatSync(lockPath, { throwIfNoEntry: false })) {
        fs.unlinkSync(lockPath);
        logger.info({ lockPath }, "Removed stale Chrome lock");
      }
    } catch {
      // ignore — file doesn't exist or already removed
    }
  }
}

function getChromePath(): string {
  // Use CHROME_PATH env var if set, otherwise detect common locations
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    // Linux (prefer native Chrome in WSL)
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    // WSL accessing Windows Chrome (fallback — may not work well)
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
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
  clearStaleChromeLocks(userDataDir);
  logger.info({ platform, userDataDir, chromePath: chromePath || "bundled" }, "Launching browser");

  const launchOptions: NonNullable<Parameters<typeof puppeteer.launch>[0]> = {
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
  clearStaleChromeLocks(userDataDir);
  logger.info({ platform }, "Launching visible browser for login");

  const launchOptions: NonNullable<Parameters<typeof puppeteer.launch>[0]> = {
    headless: false,
    userDataDir,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080", "--disable-blink-features=AutomationControlled"],
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

export async function closeBrowser(platform: string): Promise<void> {
  const existing = browsers.get(platform);
  if (existing && existing.connected) {
    logger.info({ platform }, "Closing browser");
    await existing.close();
    browsers.delete(platform);
  }
}

export async function closeAllBrowsers(): Promise<void> {
  for (const [platform, browser] of browsers) {
    logger.info({ platform }, "Closing browser");
    await browser.close();
  }
  browsers.clear();
}

// Throws CaptchaError. Caller is responsible for closing pages and marking
// the platform's session as captcha_required in the DB so the user can act.
export async function reportCaptcha(platform: string): Promise<never> {
  logger.warn({ platform }, "CAPTCHA detected — marking session as captcha_required");

  // Close the browser so the userDataDir lock is released for the user to log back in via the dashboard
  const existing = browsers.get(platform);
  if (existing && existing.connected) {
    await existing.close().catch(() => undefined);
  }
  browsers.delete(platform);

  throw new CaptchaError(platform);
}

export async function randomDelay(minMs = 500, maxMs = 2000): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
