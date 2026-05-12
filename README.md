# find-an-apart-in-paris

Apartment scraper for LeBonCoin and SeLoger that auto-sends a templated message to new listings matching your preferences. Runs continuously on a local machine (Node.js + Puppeteer + SQLite + React dashboard).

## Features

- Periodic scraping of LeBonCoin and SeLoger
- Configurable search preferences (location, budget, surface, rooms) per platform
- Auto-send platform messages + email when a new listing is found
- React dashboard for managing preferences, templates, sessions, listings
- Rate limiting, retry on transient errors, session expiration detection
- Dry-run mode for testing without sending real messages
- PM2-ready for production deployment

## Stack

Node.js (TypeScript, NodeNext), Puppeteer + stealth plugin (system Chrome), Express 5, better-sqlite3, pino, Vite + React + TailwindCSS.

## Setup

```bash
npm install
cd frontend && npm install && npm run build && cd ..
cp .env.example .env  # then edit values
npm run build
node dist/index.js    # or: pm2 start ecosystem.config.cjs
```

Open `http://localhost:3000`, set up preferences, click "Se connecter" once per platform to persist sessions.

## Disclaimer

**This project is for educational and personal use only.**

Automated scraping and messaging on LeBonCoin and SeLoger violates their Terms of Service. Depending on your jurisdiction, this may also expose you to legal risk (e.g. art. 323-1 of the French Code pénal). Running this software is at your own risk — accounts can be banned, and you may face civil liability.

Do not use this to spam, harass, or harvest data at scale. The code exists as a study of headless browser automation, anti-bot evasion, and end-to-end full-stack development. The author accepts no responsibility for any use, misuse, or consequences thereof.
