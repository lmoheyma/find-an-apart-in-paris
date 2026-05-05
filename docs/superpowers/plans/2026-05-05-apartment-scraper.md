# Apartment Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated apartment scraper that monitors LeBonCoin and SeLoger, detects new listings matching user preferences, and sends pre-defined messages automatically.

**Architecture:** Node.js/TypeScript backend with Express API serving a React SPA. Puppeteer with stealth plugin handles scraping and messaging. SQLite stores all data. A recursive setTimeout scheduler drives the polling loop.

**Tech Stack:** TypeScript, Express, puppeteer-extra + stealth, better-sqlite3, pino, Nodemailer, React, Vite, TailwindCSS

---

## File Structure

```
src/
├── index.ts                    # Entry point: starts server + scheduler
├── config.ts                   # App configuration (env vars, defaults)
├── db/
│   ├── database.ts             # SQLite connection + initialization
│   ├── migrations.ts           # Schema creation/migrations
│   ├── listings.ts             # Listings CRUD
│   ├── preferences.ts          # Preferences CRUD
│   ├── templates.ts            # Message templates CRUD
│   ├── messages.ts             # Messages sent CRUD
│   └── sessions.ts             # Sessions CRUD
├── scraper/
│   ├── browser.ts              # Puppeteer browser management (launch, userDataDir, stealth)
│   ├── leboncoin.ts            # LeBonCoin scraper (search URL builder + parser)
│   ├── seloger.ts              # SeLoger scraper (search URL builder + parser)
│   └── types.ts                # Shared scraper types (ScrapedListing, etc.)
├── messenger/
│   ├── queue.ts                # Message queue with rate limiting
│   ├── leboncoin.ts            # LeBonCoin platform messenger
│   ├── seloger.ts              # SeLoger platform messenger
│   ├── email.ts                # SMTP email sender
│   └── template.ts             # Template variable interpolation
├── scheduler/
│   └── scheduler.ts            # Recursive setTimeout scheduler + orchestration
├── logger.ts                   # Pino logger setup (stdout + file rotation)
├── server.ts                   # Express app setup (API routes + static frontend)
└── routes/
    ├── preferences.ts          # GET/POST/PUT/DELETE /api/preferences
    ├── templates.ts            # GET/POST/PUT/DELETE /api/templates
    ├── listings.ts             # GET /api/listings (paginated, filtered)
    ├── sessions.ts             # GET/POST /api/sessions
    ├── stats.ts                # GET /api/stats
    └── health.ts               # GET /health

frontend/
├── index.html
├── src/
│   ├── main.tsx                # React entry
│   ├── App.tsx                 # Router + layout
│   ├── api.ts                  # Fetch wrapper for backend API
│   ├── pages/
│   │   ├── Preferences.tsx     # Preferences CRUD page
│   │   ├── Templates.tsx       # Message templates page
│   │   ├── Listings.tsx        # Listings table with filters
│   │   ├── Stats.tsx           # Stats/history charts
│   │   └── Sessions.tsx        # Session status + reconnect
│   └── components/
│       ├── Layout.tsx          # Navbar + page wrapper
│       ├── PreferenceForm.tsx  # Form for adding/editing preferences
│       ├── TemplateEditor.tsx  # Template editor with preview
│       ├── ListingsTable.tsx   # Paginated listings table
│       └── StatsChart.tsx      # Simple chart component

tests/
├── db/
│   ├── listings.test.ts
│   ├── preferences.test.ts
│   ├── templates.test.ts
│   └── messages.test.ts
├── messenger/
│   ├── queue.test.ts
│   └── template.test.ts
├── scheduler/
│   └── scheduler.test.ts
└── routes/
    ├── preferences.test.ts
    ├── templates.test.ts
    ├── listings.test.ts
    └── stats.test.ts
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `src/config.ts`, `src/logger.ts`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
cd /home/louis/trouver-un-appart
npm init -y
npm install typescript @types/node ts-node-dev --save-dev
npm install express @types/express better-sqlite3 @types/better-sqlite3 pino pino-pretty puppeteer-extra puppeteer-extra-plugin-stealth puppeteer nodemailer @types/nodemailer
npm install vitest --save-dev
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "frontend"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
logs/
*.db
browser-data/
frontend/dist/
.env
```

- [ ] **Step 4: Create src/config.ts**

```typescript
import path from "node:path";

export const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || path.join(process.cwd(), "data.db"),
  logDir: process.env.LOG_DIR || path.join(process.cwd(), "logs"),
  browserDataDir: process.env.BROWSER_DATA_DIR || path.join(process.cwd(), "browser-data"),
  polling: {
    intervalMs: Number(process.env.POLLING_INTERVAL_MS) || 90_000, // 1.5 min
  },
  messaging: {
    maxPerHour: Number(process.env.MAX_MESSAGES_PER_HOUR) || 5,
    delayMinMs: 60_000,  // 1 min
    delayMaxMs: 180_000, // 3 min
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "",
  },
};
```

- [ ] **Step 5: Create src/logger.ts**

```typescript
import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { config } from "./config.js";

fs.mkdirSync(config.logDir, { recursive: true });

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: { destination: 1 }, // stdout
        level: "info",
      },
      {
        target: "pino/file",
        options: { destination: path.join(config.logDir, "app.log") },
        level: "debug",
      },
    ],
  },
});
```

- [ ] **Step 6: Add scripts to package.json**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: project setup with TypeScript, dependencies, config and logger"
```

---

## Task 2: Database Layer

**Files:**
- Create: `src/db/database.ts`, `src/db/migrations.ts`, `src/db/listings.ts`, `src/db/preferences.ts`, `src/db/templates.ts`, `src/db/messages.ts`, `src/db/sessions.ts`
- Test: `tests/db/listings.test.ts`, `tests/db/preferences.test.ts`, `tests/db/templates.test.ts`, `tests/db/messages.test.ts`

- [ ] **Step 1: Write tests for database initialization and preferences CRUD**

Create `tests/db/preferences.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import {
  createPreference,
  getPreferences,
  getActivePreferences,
  updatePreference,
  deletePreference,
} from "../../src/db/preferences.js";

describe("preferences", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("creates and retrieves a preference", () => {
    const pref = createPreference(db, {
      name: "Paris 11",
      city: "Paris 11",
      budget_min: 800,
      budget_max: 1200,
      surface_min: 25,
      rooms_min: 1,
    });
    expect(pref.id).toBeDefined();
    expect(pref.name).toBe("Paris 11");
    expect(pref.active).toBe(1);

    const all = getPreferences(db);
    expect(all).toHaveLength(1);
  });

  it("returns only active preferences", () => {
    createPreference(db, { name: "A", city: "A", budget_min: 0, budget_max: 1000, surface_min: 20, rooms_min: 1 });
    const pref2 = createPreference(db, { name: "B", city: "B", budget_min: 0, budget_max: 1000, surface_min: 20, rooms_min: 1 });
    updatePreference(db, pref2.id, { active: 0 });

    const active = getActivePreferences(db);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("A");
  });

  it("updates a preference", () => {
    const pref = createPreference(db, { name: "Test", city: "Lyon", budget_min: 500, budget_max: 900, surface_min: 30, rooms_min: 2 });
    updatePreference(db, pref.id, { city: "Marseille", budget_max: 1000 });

    const all = getPreferences(db);
    expect(all[0].city).toBe("Marseille");
    expect(all[0].budget_max).toBe(1000);
  });

  it("deletes a preference", () => {
    const pref = createPreference(db, { name: "Del", city: "X", budget_min: 0, budget_max: 500, surface_min: 10, rooms_min: 1 });
    deletePreference(db, pref.id);
    expect(getPreferences(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Write tests for listings CRUD**

Create `tests/db/listings.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import {
  insertListing,
  listingExists,
  getListings,
} from "../../src/db/listings.js";

describe("listings", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("inserts a listing and checks existence", () => {
    const listing = insertListing(db, {
      platform: "leboncoin",
      external_id: "abc123",
      url: "https://leboncoin.fr/abc123",
      title: "Studio Paris 11",
      price: 900,
      surface: 25,
      rooms: 1,
      city: "Paris 11",
      description: "Joli studio",
      images: "[]",
      contact_email: null,
    });
    expect(listing.id).toBeDefined();
    expect(listingExists(db, "leboncoin", "abc123")).toBe(true);
    expect(listingExists(db, "leboncoin", "xyz")).toBe(false);
  });

  it("prevents duplicate platform + external_id", () => {
    const data = {
      platform: "leboncoin" as const,
      external_id: "dup1",
      url: "https://x.com/1",
      title: "Test",
      price: 800,
      surface: 20,
      rooms: 1,
      city: "Paris",
      description: "",
      images: "[]",
      contact_email: null,
    };
    insertListing(db, data);
    expect(() => insertListing(db, data)).toThrow();
  });

  it("retrieves listings with pagination", () => {
    for (let i = 0; i < 15; i++) {
      insertListing(db, {
        platform: "seloger",
        external_id: `id-${i}`,
        url: `https://seloger.com/${i}`,
        title: `Listing ${i}`,
        price: 1000 + i * 100,
        surface: 30,
        rooms: 2,
        city: "Lyon",
        description: "",
        images: "[]",
        contact_email: null,
      });
    }
    const page1 = getListings(db, { limit: 10, offset: 0 });
    expect(page1.listings).toHaveLength(10);
    expect(page1.total).toBe(15);

    const page2 = getListings(db, { limit: 10, offset: 10 });
    expect(page2.listings).toHaveLength(5);
  });

  it("filters listings by platform", () => {
    insertListing(db, { platform: "leboncoin", external_id: "a", url: "", title: "", price: 0, surface: 0, rooms: 0, city: "", description: "", images: "[]", contact_email: null });
    insertListing(db, { platform: "seloger", external_id: "b", url: "", title: "", price: 0, surface: 0, rooms: 0, city: "", description: "", images: "[]", contact_email: null });

    const result = getListings(db, { limit: 10, offset: 0, platform: "leboncoin" });
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].platform).toBe("leboncoin");
  });
});
```

- [ ] **Step 3: Write tests for templates CRUD**

Create `tests/db/templates.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import {
  createTemplate,
  getTemplates,
  getDefaultTemplate,
  updateTemplate,
  deleteTemplate,
} from "../../src/db/templates.js";

describe("templates", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("creates a template and retrieves it", () => {
    const t = createTemplate(db, { name: "Default", body: "Bonjour, intéressé par {{title}}", is_default: 1 });
    expect(t.id).toBeDefined();
    expect(getTemplates(db)).toHaveLength(1);
  });

  it("returns the default template", () => {
    createTemplate(db, { name: "A", body: "Body A", is_default: 0 });
    createTemplate(db, { name: "B", body: "Body B", is_default: 1 });
    const def = getDefaultTemplate(db);
    expect(def?.name).toBe("B");
  });

  it("setting a new default unsets the previous one", () => {
    const t1 = createTemplate(db, { name: "A", body: "A", is_default: 1 });
    createTemplate(db, { name: "B", body: "B", is_default: 1 });
    const all = getTemplates(db);
    const a = all.find((t) => t.id === t1.id);
    expect(a?.is_default).toBe(0);
  });

  it("updates a template", () => {
    const t = createTemplate(db, { name: "X", body: "old", is_default: 0 });
    updateTemplate(db, t.id, { body: "new body" });
    const all = getTemplates(db);
    expect(all[0].body).toBe("new body");
  });

  it("deletes a template", () => {
    const t = createTemplate(db, { name: "Del", body: "x", is_default: 0 });
    deleteTemplate(db, t.id);
    expect(getTemplates(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Write tests for messages_sent CRUD**

Create `tests/db/messages.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import { insertListing } from "../../src/db/listings.js";
import {
  createMessage,
  updateMessageStatus,
  getPendingMessages,
  getMessagesForListing,
} from "../../src/db/messages.js";

describe("messages", () => {
  let db: Database.Database;
  let listingId: number;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    const listing = insertListing(db, {
      platform: "leboncoin",
      external_id: "msg-test",
      url: "https://x.com",
      title: "Test",
      price: 900,
      surface: 25,
      rooms: 1,
      city: "Paris",
      description: "",
      images: "[]",
      contact_email: null,
    });
    listingId = listing.id;
  });

  it("creates a pending message", () => {
    const msg = createMessage(db, { listing_id: listingId, platform: "leboncoin", method: "platform_message" });
    expect(msg.status).toBe("pending");
  });

  it("updates message status to sent", () => {
    const msg = createMessage(db, { listing_id: listingId, platform: "leboncoin", method: "platform_message" });
    updateMessageStatus(db, msg.id, "sent");
    const messages = getMessagesForListing(db, listingId);
    expect(messages[0].status).toBe("sent");
  });

  it("updates message status to failed with error", () => {
    const msg = createMessage(db, { listing_id: listingId, platform: "leboncoin", method: "email" });
    updateMessageStatus(db, msg.id, "failed", "SMTP timeout");
    const messages = getMessagesForListing(db, listingId);
    expect(messages[0].status).toBe("failed");
    expect(messages[0].error).toBe("SMTP timeout");
  });

  it("retrieves only pending messages", () => {
    createMessage(db, { listing_id: listingId, platform: "leboncoin", method: "platform_message" });
    const msg2 = createMessage(db, { listing_id: listingId, platform: "leboncoin", method: "email" });
    updateMessageStatus(db, msg2.id, "sent");

    const pending = getPendingMessages(db);
    expect(pending).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
npx vitest run
```

Expected: All tests FAIL (modules not found).

- [ ] **Step 6: Implement database.ts and migrations.ts**

Create `src/db/database.ts`:
```typescript
import Database from "better-sqlite3";
import { config } from "../config.js";
import { runMigrations } from "./migrations.js";
import { logger } from "../logger.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    logger.info({ path: config.dbPath }, "Database initialized");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

Create `src/db/migrations.ts`:
```typescript
import type Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      external_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      price INTEGER,
      surface INTEGER,
      rooms INTEGER,
      city TEXT,
      description TEXT,
      images TEXT DEFAULT '[]',
      contact_email TEXT,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(platform, external_id)
    );

    CREATE TABLE IF NOT EXISTS messages_sent (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      platform TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TEXT,
      error TEXT,
      FOREIGN KEY (listing_id) REFERENCES listings(id)
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      budget_min INTEGER,
      budget_max INTEGER,
      surface_min INTEGER,
      rooms_min INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL UNIQUE,
      user_data_dir TEXT NOT NULL,
      last_valid_at TEXT,
      status TEXT NOT NULL DEFAULT 'valid'
    );

    CREATE INDEX IF NOT EXISTS idx_listings_platform_external ON listings(platform, external_id);
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages_sent(status);
    CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages_sent(listing_id);
  `);
}
```

- [ ] **Step 7: Implement preferences.ts**

Create `src/db/preferences.ts`:
```typescript
import type Database from "better-sqlite3";

export interface Preference {
  id: number;
  name: string;
  city: string;
  budget_min: number | null;
  budget_max: number | null;
  surface_min: number | null;
  rooms_min: number | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePreferenceInput {
  name: string;
  city: string;
  budget_min: number | null;
  budget_max: number | null;
  surface_min: number | null;
  rooms_min: number | null;
}

export function createPreference(db: Database.Database, input: CreatePreferenceInput): Preference {
  const stmt = db.prepare(`
    INSERT INTO preferences (name, city, budget_min, budget_max, surface_min, rooms_min)
    VALUES (@name, @city, @budget_min, @budget_max, @surface_min, @rooms_min)
  `);
  const result = stmt.run(input);
  return db.prepare("SELECT * FROM preferences WHERE id = ?").get(result.lastInsertRowid) as Preference;
}

export function getPreferences(db: Database.Database): Preference[] {
  return db.prepare("SELECT * FROM preferences ORDER BY created_at DESC").all() as Preference[];
}

export function getActivePreferences(db: Database.Database): Preference[] {
  return db.prepare("SELECT * FROM preferences WHERE active = 1 ORDER BY created_at DESC").all() as Preference[];
}

export function updatePreference(db: Database.Database, id: number, updates: Partial<Omit<Preference, "id" | "created_at">>): void {
  const fields = Object.keys(updates)
    .filter((k) => k !== "updated_at")
    .map((k) => `${k} = @${k}`)
    .join(", ");
  db.prepare(`UPDATE preferences SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...updates, id });
}

export function deletePreference(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM preferences WHERE id = ?").run(id);
}
```

- [ ] **Step 8: Implement listings.ts**

Create `src/db/listings.ts`:
```typescript
import type Database from "better-sqlite3";

export interface Listing {
  id: number;
  platform: string;
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  city: string | null;
  description: string | null;
  images: string;
  contact_email: string | null;
  discovered_at: string;
}

export interface InsertListingInput {
  platform: string;
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  city: string | null;
  description: string | null;
  images: string;
  contact_email: string | null;
}

export interface ListingsQuery {
  limit: number;
  offset: number;
  platform?: string;
}

export function insertListing(db: Database.Database, input: InsertListingInput): Listing {
  const stmt = db.prepare(`
    INSERT INTO listings (platform, external_id, url, title, price, surface, rooms, city, description, images, contact_email)
    VALUES (@platform, @external_id, @url, @title, @price, @surface, @rooms, @city, @description, @images, @contact_email)
  `);
  const result = stmt.run(input);
  return db.prepare("SELECT * FROM listings WHERE id = ?").get(result.lastInsertRowid) as Listing;
}

export function listingExists(db: Database.Database, platform: string, externalId: string): boolean {
  const row = db.prepare("SELECT 1 FROM listings WHERE platform = ? AND external_id = ?").get(platform, externalId);
  return row !== undefined;
}

export function getListings(db: Database.Database, query: ListingsQuery): { listings: Listing[]; total: number } {
  let where = "";
  const params: Record<string, unknown> = { limit: query.limit, offset: query.offset };

  if (query.platform) {
    where = "WHERE platform = @platform";
    params.platform = query.platform;
  }

  const total = (db.prepare(`SELECT COUNT(*) as count FROM listings ${where}`).get(params) as { count: number }).count;
  const listings = db.prepare(`SELECT * FROM listings ${where} ORDER BY discovered_at DESC LIMIT @limit OFFSET @offset`).all(params) as Listing[];

  return { listings, total };
}
```

- [ ] **Step 9: Implement templates.ts**

Create `src/db/templates.ts`:
```typescript
import type Database from "better-sqlite3";

export interface Template {
  id: number;
  name: string;
  body: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  body: string;
  is_default: number;
}

export function createTemplate(db: Database.Database, input: CreateTemplateInput): Template {
  if (input.is_default) {
    db.prepare("UPDATE message_templates SET is_default = 0 WHERE is_default = 1").run();
  }
  const stmt = db.prepare(`
    INSERT INTO message_templates (name, body, is_default)
    VALUES (@name, @body, @is_default)
  `);
  const result = stmt.run(input);
  return db.prepare("SELECT * FROM message_templates WHERE id = ?").get(result.lastInsertRowid) as Template;
}

export function getTemplates(db: Database.Database): Template[] {
  return db.prepare("SELECT * FROM message_templates ORDER BY created_at DESC").all() as Template[];
}

export function getDefaultTemplate(db: Database.Database): Template | undefined {
  return db.prepare("SELECT * FROM message_templates WHERE is_default = 1").get() as Template | undefined;
}

export function updateTemplate(db: Database.Database, id: number, updates: Partial<Omit<Template, "id" | "created_at">>): void {
  if (updates.is_default) {
    db.prepare("UPDATE message_templates SET is_default = 0 WHERE is_default = 1").run();
  }
  const fields = Object.keys(updates)
    .filter((k) => k !== "updated_at")
    .map((k) => `${k} = @${k}`)
    .join(", ");
  db.prepare(`UPDATE message_templates SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...updates, id });
}

export function deleteTemplate(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM message_templates WHERE id = ?").run(id);
}
```

- [ ] **Step 10: Implement messages.ts**

Create `src/db/messages.ts`:
```typescript
import type Database from "better-sqlite3";

export interface Message {
  id: number;
  listing_id: number;
  platform: string;
  method: string;
  status: string;
  sent_at: string | null;
  error: string | null;
}

export interface CreateMessageInput {
  listing_id: number;
  platform: string;
  method: string;
}

export function createMessage(db: Database.Database, input: CreateMessageInput): Message {
  const stmt = db.prepare(`
    INSERT INTO messages_sent (listing_id, platform, method)
    VALUES (@listing_id, @platform, @method)
  `);
  const result = stmt.run(input);
  return db.prepare("SELECT * FROM messages_sent WHERE id = ?").get(result.lastInsertRowid) as Message;
}

export function updateMessageStatus(db: Database.Database, id: number, status: string, error?: string): void {
  const sentAt = status === "sent" ? new Date().toISOString() : null;
  db.prepare("UPDATE messages_sent SET status = ?, sent_at = ?, error = ? WHERE id = ?").run(status, sentAt, error || null, id);
}

export function getPendingMessages(db: Database.Database): Message[] {
  return db.prepare("SELECT * FROM messages_sent WHERE status = 'pending' ORDER BY id ASC").all() as Message[];
}

export function getMessagesForListing(db: Database.Database, listingId: number): Message[] {
  return db.prepare("SELECT * FROM messages_sent WHERE listing_id = ? ORDER BY id DESC").all(listingId) as Message[];
}
```

- [ ] **Step 11: Implement sessions.ts**

Create `src/db/sessions.ts`:
```typescript
import type Database from "better-sqlite3";

export interface Session {
  id: number;
  platform: string;
  user_data_dir: string;
  last_valid_at: string | null;
  status: string;
}

export function getSession(db: Database.Database, platform: string): Session | undefined {
  return db.prepare("SELECT * FROM sessions WHERE platform = ?").get(platform) as Session | undefined;
}

export function upsertSession(db: Database.Database, platform: string, userDataDir: string): Session {
  db.prepare(`
    INSERT INTO sessions (platform, user_data_dir, status)
    VALUES (@platform, @user_data_dir, 'valid')
    ON CONFLICT(platform) DO UPDATE SET user_data_dir = @user_data_dir
  `).run({ platform, user_data_dir: userDataDir });
  return getSession(db, platform)!;
}

export function updateSessionStatus(db: Database.Database, platform: string, status: string): void {
  const lastValid = status === "valid" ? new Date().toISOString() : undefined;
  if (lastValid) {
    db.prepare("UPDATE sessions SET status = ?, last_valid_at = ? WHERE platform = ?").run(status, lastValid, platform);
  } else {
    db.prepare("UPDATE sessions SET status = ? WHERE platform = ?").run(status, platform);
  }
}

export function getSessions(db: Database.Database): Session[] {
  return db.prepare("SELECT * FROM sessions").all() as Session[];
}
```

- [ ] **Step 12: Run tests to verify they pass**

```bash
npx vitest run
```

Expected: All 4 test files PASS.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: database layer with SQLite migrations and CRUD for all entities"
```

---

## Task 3: Template Interpolation

**Files:**
- Create: `src/messenger/template.ts`
- Test: `tests/messenger/template.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/messenger/template.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { interpolateTemplate } from "../../src/messenger/template.js";

describe("interpolateTemplate", () => {
  it("replaces all known variables", () => {
    const body = "Bonjour, intéressé par {{title}} à {{price}}€ ({{surface}}m², {{rooms}} pièces) à {{city}}. Lien: {{url}}";
    const result = interpolateTemplate(body, {
      title: "Studio lumineux",
      price: 900,
      city: "Paris 11",
      surface: 25,
      rooms: 1,
      url: "https://leboncoin.fr/123",
    });
    expect(result).toBe("Bonjour, intéressé par Studio lumineux à 900€ (25m², 1 pièces) à Paris 11. Lien: https://leboncoin.fr/123");
  });

  it("leaves unknown variables untouched", () => {
    const result = interpolateTemplate("Hello {{unknown}}", { title: "X", price: 0, city: "", surface: 0, rooms: 0, url: "" });
    expect(result).toBe("Hello {{unknown}}");
  });

  it("handles null values gracefully", () => {
    const result = interpolateTemplate("Prix: {{price}}€", { title: "", price: null, city: "", surface: null, rooms: null, url: "" });
    expect(result).toBe("Prix: €");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/messenger/template.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement template interpolation**

Create `src/messenger/template.ts`:
```typescript
export interface TemplateVariables {
  title: string;
  price: number | null;
  city: string | null;
  surface: number | null;
  rooms: number | null;
  url: string;
}

const KNOWN_VARS = ["title", "price", "city", "surface", "rooms", "url"] as const;

export function interpolateTemplate(body: string, vars: TemplateVariables): string {
  let result = body;
  for (const key of KNOWN_VARS) {
    const value = vars[key];
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value?.toString() ?? "");
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/messenger/template.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: template variable interpolation for message templates"
```

---

## Task 4: Message Queue with Rate Limiting

**Files:**
- Create: `src/messenger/queue.ts`
- Test: `tests/messenger/queue.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/messenger/queue.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MessageQueue } from "../../src/messenger/queue.js";

describe("MessageQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes messages with delay", async () => {
    const processed: number[] = [];
    const handler = async (id: number) => { processed.push(id); };
    const queue = new MessageQueue({ maxPerHour: 5, delayMinMs: 100, delayMaxMs: 200 }, handler);

    queue.enqueue(1);
    queue.enqueue(2);

    // Process first immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(processed).toEqual([1]);

    // Second after delay
    await vi.advanceTimersByTimeAsync(200);
    expect(processed).toEqual([1, 2]);

    queue.stop();
  });

  it("respects rate limit", async () => {
    const processed: number[] = [];
    const handler = async (id: number) => { processed.push(id); };
    const queue = new MessageQueue({ maxPerHour: 2, delayMinMs: 10, delayMaxMs: 20 }, handler);

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    await vi.advanceTimersByTimeAsync(100);
    expect(processed).toHaveLength(2); // Only 2 per hour

    queue.stop();
  });

  it("reports queue size", () => {
    const queue = new MessageQueue({ maxPerHour: 5, delayMinMs: 100, delayMaxMs: 200 }, async () => {});
    queue.enqueue(1);
    queue.enqueue(2);
    expect(queue.size()).toBe(2);
    queue.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/messenger/queue.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement message queue**

Create `src/messenger/queue.ts`:
```typescript
export interface QueueConfig {
  maxPerHour: number;
  delayMinMs: number;
  delayMaxMs: number;
}

export class MessageQueue {
  private queue: number[] = [];
  private processing = false;
  private sentThisHour = 0;
  private hourStart = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private config: QueueConfig,
    private handler: (messageId: number) => Promise<void>,
  ) {}

  enqueue(messageId: number): void {
    this.queue.push(messageId);
    if (!this.processing) {
      this.processNext();
    }
  }

  size(): number {
    return this.queue.length;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async processNext(): Promise<void> {
    if (this.stopped || this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;

    // Reset hourly counter if hour has elapsed
    if (Date.now() - this.hourStart >= 3_600_000) {
      this.sentThisHour = 0;
      this.hourStart = Date.now();
    }

    // Rate limit check
    if (this.sentThisHour >= this.config.maxPerHour) {
      this.processing = false;
      return;
    }

    const messageId = this.queue.shift()!;
    await this.handler(messageId);
    this.sentThisHour++;

    if (this.queue.length > 0 && !this.stopped) {
      const delay = this.config.delayMinMs + Math.random() * (this.config.delayMaxMs - this.config.delayMinMs);
      this.timer = setTimeout(() => this.processNext(), delay);
    } else {
      this.processing = false;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/messenger/queue.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: message queue with configurable rate limiting"
```

---

## Task 5: Browser Management

**Files:**
- Create: `src/scraper/browser.ts`, `src/scraper/types.ts`

- [ ] **Step 1: Create scraper types**

Create `src/scraper/types.ts`:
```typescript
export interface ScrapedListing {
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  city: string | null;
  description: string | null;
  images: string[];
  contact_email: string | null;
}
```

- [ ] **Step 2: Implement browser manager**

Create `src/scraper/browser.ts`:
```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Puppeteer browser management with stealth plugin and userDataDir"
```

---

## Task 6: LeBonCoin Scraper

**Files:**
- Create: `src/scraper/leboncoin.ts`

- [ ] **Step 1: Implement LeBonCoin scraper**

Create `src/scraper/leboncoin.ts`:
```typescript
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

      // LeBonCoin uses data-test-id or specific class patterns for listing cards
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

    // Convert to ScrapedListing format
    const results: ScrapedListing[] = listings.map((item) => ({
      external_id: item.external_id,
      url: item.url,
      title: item.title,
      price: item.price,
      surface: null, // extracted from detail page if needed
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: LeBonCoin scraper with URL builder and listing extraction"
```

---

## Task 7: SeLoger Scraper

**Files:**
- Create: `src/scraper/seloger.ts`

- [ ] **Step 1: Implement SeLoger scraper**

Create `src/scraper/seloger.ts`:
```typescript
import type { Page } from "puppeteer";
import type { ScrapedListing } from "./types.js";
import type { Preference } from "../db/preferences.js";
import { getPage, randomDelay } from "./browser.js";
import { logger } from "../logger.js";

export function buildSelogerUrl(pref: Preference): string {
  // SeLoger uses a different URL structure
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

      // SeLoger listing cards
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
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: SeLoger scraper with URL builder and listing extraction"
```

---

## Task 8: Platform Messengers

**Files:**
- Create: `src/messenger/leboncoin.ts`, `src/messenger/seloger.ts`, `src/messenger/email.ts`

- [ ] **Step 1: Implement LeBonCoin messenger**

Create `src/messenger/leboncoin.ts`:
```typescript
import type { Listing } from "../db/listings.js";
import { getPage, randomDelay } from "../scraper/browser.js";
import { logger } from "../logger.js";

export async function sendLeboncoinMessage(listing: Listing, message: string): Promise<void> {
  logger.info({ listingId: listing.id, url: listing.url }, "Sending LeBonCoin message");

  const page = await getPage("leboncoin");
  try {
    await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Click "Envoyer un message" / contact button
    const contactBtn = await page.$("[data-qa-id='adview_contact_container'] button, button[data-spark-component='button']");
    if (!contactBtn) {
      throw new Error("Contact button not found on listing page");
    }
    await contactBtn.click();
    await randomDelay(1000, 2000);

    // Wait for message textarea
    const textarea = await page.waitForSelector("textarea, [data-qa-id='message_area']", { timeout: 10_000 });
    if (!textarea) {
      throw new Error("Message textarea not found");
    }

    // Clear and type message with human-like delay
    await textarea.click({ clickCount: 3 });
    await textarea.type(message, { delay: 30 + Math.random() * 50 });
    await randomDelay(500, 1500);

    // Click send button
    const sendBtn = await page.$("button[type='submit'], [data-qa-id='message_send_button']");
    if (!sendBtn) {
      throw new Error("Send button not found");
    }
    await sendBtn.click();
    await randomDelay(1000, 2000);

    logger.info({ listingId: listing.id }, "LeBonCoin message sent");
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 2: Implement SeLoger messenger**

Create `src/messenger/seloger.ts`:
```typescript
import type { Listing } from "../db/listings.js";
import { getPage, randomDelay } from "../scraper/browser.js";
import { logger } from "../logger.js";

export async function sendSelogerMessage(listing: Listing, message: string): Promise<void> {
  logger.info({ listingId: listing.id, url: listing.url }, "Sending SeLoger message");

  const page = await getPage("seloger");
  try {
    await page.goto(listing.url, { waitUntil: "networkidle2", timeout: 30_000 });
    await randomDelay(1500, 3000);

    // Click contact button
    const contactBtn = await page.$("button[class*='Contact'], [data-testid='sl.detail.contact-button']");
    if (!contactBtn) {
      throw new Error("Contact button not found on SeLoger listing");
    }
    await contactBtn.click();
    await randomDelay(1000, 2000);

    // Wait for contact form / message area
    const textarea = await page.waitForSelector("textarea[name='message'], textarea[class*='message']", { timeout: 10_000 });
    if (!textarea) {
      throw new Error("Message textarea not found on SeLoger");
    }

    await textarea.click({ clickCount: 3 });
    await textarea.type(message, { delay: 30 + Math.random() * 50 });
    await randomDelay(500, 1500);

    // Submit form
    const sendBtn = await page.$("button[type='submit'], [class*='submit']");
    if (!sendBtn) {
      throw new Error("Submit button not found on SeLoger");
    }
    await sendBtn.click();
    await randomDelay(1000, 2000);

    logger.info({ listingId: listing.id }, "SeLoger message sent");
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 3: Implement email sender**

Create `src/messenger/email.ts`:
```typescript
import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../logger.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!config.smtp.host || !config.smtp.user) {
    logger.warn("SMTP not configured, skipping email");
    return;
  }

  logger.info({ to, subject }, "Sending email");
  await getTransporter().sendMail({
    from: config.smtp.from,
    to,
    subject,
    text: body,
  });
  logger.info({ to }, "Email sent");
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: platform messengers (LeBonCoin, SeLoger) and email sender"
```

---

## Task 9: Scheduler & Orchestration

**Files:**
- Create: `src/scheduler/scheduler.ts`
- Test: `tests/scheduler/scheduler.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/scheduler/scheduler.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scheduler } from "../../src/scheduler/scheduler.js";

describe("Scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the cycle function on start", async () => {
    const cycleFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(cycleFn).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });

  it("schedules next cycle after completion", async () => {
    const cycleFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(cycleFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(cycleFn).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("does not overlap cycles", async () => {
    let running = 0;
    let maxRunning = 0;
    const cycleFn = vi.fn().mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10000)); // Takes 10s
      running--;
    });
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    // Cycle is running (takes 10s), next would trigger at 5s but should wait
    await vi.advanceTimersByTimeAsync(5000);
    expect(maxRunning).toBe(1); // Never more than 1

    scheduler.stop();
  });

  it("stops cleanly", async () => {
    const cycleFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();

    await vi.advanceTimersByTimeAsync(10000);
    expect(cycleFn).toHaveBeenCalledTimes(1); // No more after stop
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/scheduler/scheduler.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement scheduler**

Create `src/scheduler/scheduler.ts`:
```typescript
import { logger } from "../logger.js";

export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private cycleFn: () => Promise<void>,
    private intervalMs: number,
  ) {}

  start(): void {
    this.stopped = false;
    logger.info({ intervalMs: this.intervalMs }, "Scheduler started");
    this.runCycle();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("Scheduler stopped");
  }

  isRunning(): boolean {
    return this.running;
  }

  private async runCycle(): Promise<void> {
    if (this.stopped) return;

    this.running = true;
    const start = Date.now();

    try {
      await this.cycleFn();
    } catch (error) {
      logger.error({ error }, "Scheduler cycle error");
    }

    this.running = false;
    const elapsed = Date.now() - start;
    logger.debug({ elapsed }, "Cycle complete");

    if (!this.stopped) {
      const nextDelay = Math.max(0, this.intervalMs - elapsed);
      this.timer = setTimeout(() => this.runCycle(), nextDelay);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/scheduler/scheduler.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: recursive setTimeout scheduler with overlap protection"
```

---

## Task 10: Main Orchestration (Scrape Cycle)

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement the main scrape cycle and entry point**

Create `src/index.ts`:
```typescript
import { config } from "./config.js";
import { logger } from "./logger.js";
import { getDb, closeDb } from "./db/database.js";
import { getActivePreferences } from "./db/preferences.js";
import { insertListing, listingExists } from "./db/listings.js";
import { createMessage, updateMessageStatus } from "./db/messages.js";
import { getDefaultTemplate } from "./db/templates.js";
import { scrapeLeboncoin } from "./scraper/leboncoin.js";
import { scrapeSeloger } from "./scraper/seloger.js";
import { closeAllBrowsers } from "./scraper/browser.js";
import { sendLeboncoinMessage } from "./messenger/leboncoin.js";
import { sendSelogerMessage } from "./messenger/seloger.js";
import { sendEmail } from "./messenger/email.js";
import { interpolateTemplate } from "./messenger/template.js";
import { MessageQueue } from "./messenger/queue.js";
import { Scheduler } from "./scheduler/scheduler.js";
import { startServer } from "./server.js";
import type { ScrapedListing } from "./scraper/types.js";
import type { Listing } from "./db/listings.js";

const db = getDb();

// Message queue handler
async function handleMessage(messageId: number): Promise<void> {
  const msg = db.prepare("SELECT * FROM messages_sent WHERE id = ?").get(messageId) as any;
  if (!msg || msg.status !== "pending") return;

  const listing = db.prepare("SELECT * FROM listings WHERE id = ?").get(msg.listing_id) as Listing;
  if (!listing) return;

  const template = getDefaultTemplate(db);
  if (!template) {
    logger.warn("No default template configured");
    updateMessageStatus(db, messageId, "failed", "No default template");
    return;
  }

  const messageBody = interpolateTemplate(template.body, {
    title: listing.title,
    price: listing.price,
    city: listing.city,
    surface: listing.surface,
    rooms: listing.rooms,
    url: listing.url,
  });

  try {
    if (msg.method === "platform_message") {
      if (listing.platform === "leboncoin") {
        await sendLeboncoinMessage(listing, messageBody);
      } else {
        await sendSelogerMessage(listing, messageBody);
      }
    } else if (msg.method === "email" && listing.contact_email) {
      await sendEmail(listing.contact_email, `Re: ${listing.title}`, messageBody);
    }
    updateMessageStatus(db, messageId, "sent");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ messageId, error: errMsg }, "Message send failed");
    updateMessageStatus(db, messageId, "failed", errMsg);
  }
}

const messageQueue = new MessageQueue(config.messaging, handleMessage);

// Main scrape cycle
async function scrapeCycle(): Promise<void> {
  const preferences = getActivePreferences(db);
  if (preferences.length === 0) {
    logger.debug("No active preferences, skipping cycle");
    return;
  }

  for (const pref of preferences) {
    try {
      // Scrape both platforms
      const [lbcListings, slListings] = await Promise.allSettled([
        scrapeLeboncoin(pref),
        scrapeSeloger(pref),
      ]);

      const allScraped: Array<{ platform: string; listing: ScrapedListing }> = [];

      if (lbcListings.status === "fulfilled") {
        for (const l of lbcListings.value) {
          allScraped.push({ platform: "leboncoin", listing: l });
        }
      } else {
        logger.error({ error: lbcListings.reason, pref: pref.name }, "LeBonCoin scrape failed");
      }

      if (slListings.status === "fulfilled") {
        for (const l of slListings.value) {
          allScraped.push({ platform: "seloger", listing: l });
        }
      } else {
        logger.error({ error: slListings.reason, pref: pref.name }, "SeLoger scrape failed");
      }

      // Process new listings
      for (const { platform, listing } of allScraped) {
        if (listingExists(db, platform, listing.external_id)) continue;

        const saved = insertListing(db, {
          platform,
          external_id: listing.external_id,
          url: listing.url,
          title: listing.title,
          price: listing.price,
          surface: listing.surface,
          rooms: listing.rooms,
          city: listing.city,
          description: listing.description,
          images: JSON.stringify(listing.images),
          contact_email: listing.contact_email,
        });

        logger.info({ platform, title: saved.title, id: saved.id }, "New listing found");

        // Queue platform message
        const platformMsg = createMessage(db, { listing_id: saved.id, platform, method: "platform_message" });
        messageQueue.enqueue(platformMsg.id);

        // Queue email if available
        if (saved.contact_email) {
          const emailMsg = createMessage(db, { listing_id: saved.id, platform, method: "email" });
          messageQueue.enqueue(emailMsg.id);
        }
      }
    } catch (error) {
      logger.error({ error, pref: pref.name }, "Scrape cycle error for preference");
    }
  }
}

// Graceful shutdown
function shutdown(): void {
  logger.info("Shutting down...");
  scheduler.stop();
  messageQueue.stop();
  closeAllBrowsers().then(() => {
    closeDb();
    logger.info("Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start
const scheduler = new Scheduler(scrapeCycle, config.polling.intervalMs);

startServer();
scheduler.start();
logger.info({ port: config.port, interval: config.polling.intervalMs }, "Apartment scraper started");
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: main entry point with scrape cycle orchestration and graceful shutdown"
```

---

## Task 11: Express API Server

**Files:**
- Create: `src/server.ts`, `src/routes/preferences.ts`, `src/routes/templates.ts`, `src/routes/listings.ts`, `src/routes/sessions.ts`, `src/routes/stats.ts`, `src/routes/health.ts`
- Test: `tests/routes/preferences.test.ts`, `tests/routes/templates.test.ts`, `tests/routes/listings.test.ts`, `tests/routes/stats.test.ts`

- [ ] **Step 1: Write failing tests for preferences routes**

Create `tests/routes/preferences.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import { createPreferencesRouter } from "../../src/routes/preferences.js";

describe("GET/POST/PUT/DELETE /api/preferences", () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    app = express();
    app.use(express.json());
    app.use("/api/preferences", createPreferencesRouter(db));
  });

  it("GET returns empty array initially", async () => {
    const res = await request(app).get("/api/preferences");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST creates a preference", async () => {
    const res = await request(app).post("/api/preferences").send({
      name: "Paris 11",
      city: "Paris 11",
      budget_min: 800,
      budget_max: 1200,
      surface_min: 25,
      rooms_min: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Paris 11");
    expect(res.body.active).toBe(1);
  });

  it("PUT updates a preference", async () => {
    const created = await request(app).post("/api/preferences").send({
      name: "Test", city: "Lyon", budget_min: 500, budget_max: 900, surface_min: 30, rooms_min: 2,
    });
    const res = await request(app).put(`/api/preferences/${created.body.id}`).send({ city: "Marseille" });
    expect(res.status).toBe(200);

    const list = await request(app).get("/api/preferences");
    expect(list.body[0].city).toBe("Marseille");
  });

  it("DELETE removes a preference", async () => {
    const created = await request(app).post("/api/preferences").send({
      name: "Del", city: "X", budget_min: 0, budget_max: 500, surface_min: 10, rooms_min: 1,
    });
    const res = await request(app).delete(`/api/preferences/${created.body.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get("/api/preferences");
    expect(list.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm install supertest @types/supertest --save-dev
npx vitest run tests/routes/preferences.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement preferences route**

Create `src/routes/preferences.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";
import { createPreference, getPreferences, updatePreference, deletePreference } from "../db/preferences.js";

export function createPreferencesRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(getPreferences(db));
  });

  router.post("/", (req, res) => {
    const { name, city, budget_min, budget_max, surface_min, rooms_min } = req.body;
    const pref = createPreference(db, { name, city, budget_min, budget_max, surface_min, rooms_min });
    res.status(201).json(pref);
  });

  router.put("/:id", (req, res) => {
    const id = Number(req.params.id);
    updatePreference(db, id, req.body);
    res.status(200).json({ ok: true });
  });

  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    deletePreference(db, id);
    res.status(204).end();
  });

  return router;
}
```

- [ ] **Step 4: Implement templates route**

Create `src/routes/templates.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";
import { createTemplate, getTemplates, updateTemplate, deleteTemplate } from "../db/templates.js";

export function createTemplatesRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(getTemplates(db));
  });

  router.post("/", (req, res) => {
    const { name, body, is_default } = req.body;
    const template = createTemplate(db, { name, body, is_default: is_default ? 1 : 0 });
    res.status(201).json(template);
  });

  router.put("/:id", (req, res) => {
    const id = Number(req.params.id);
    updateTemplate(db, id, req.body);
    res.status(200).json({ ok: true });
  });

  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    deleteTemplate(db, id);
    res.status(204).end();
  });

  return router;
}
```

- [ ] **Step 5: Implement listings route**

Create `src/routes/listings.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";
import { getListings } from "../db/listings.js";
import { getMessagesForListing } from "../db/messages.js";

export function createListingsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const platform = req.query.platform as string | undefined;
    const result = getListings(db, { limit, offset, platform });
    res.json(result);
  });

  router.get("/:id/messages", (req, res) => {
    const id = Number(req.params.id);
    res.json(getMessagesForListing(db, id));
  });

  return router;
}
```

- [ ] **Step 6: Implement sessions route**

Create `src/routes/sessions.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";
import { getSessions, updateSessionStatus } from "../db/sessions.js";
import { launchLoginBrowser } from "../scraper/browser.js";

export function createSessionsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(getSessions(db));
  });

  router.post("/:platform/login", async (req, res) => {
    const platform = req.params.platform;
    try {
      await launchLoginBrowser(platform);
      res.json({ message: `Browser opened for ${platform} login. Close it when done.` });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.put("/:platform/status", (req, res) => {
    const { status } = req.body;
    updateSessionStatus(db, req.params.platform, status);
    res.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 7: Implement stats route**

Create `src/routes/stats.ts`:
```typescript
import { Router } from "express";
import type Database from "better-sqlite3";

export function createStatsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const totalListings = (db.prepare("SELECT COUNT(*) as count FROM listings").get() as { count: number }).count;
    const totalMessages = (db.prepare("SELECT COUNT(*) as count FROM messages_sent").get() as { count: number }).count;
    const sentMessages = (db.prepare("SELECT COUNT(*) as count FROM messages_sent WHERE status = 'sent'").get() as { count: number }).count;
    const failedMessages = (db.prepare("SELECT COUNT(*) as count FROM messages_sent WHERE status = 'failed'").get() as { count: number }).count;
    const pendingMessages = (db.prepare("SELECT COUNT(*) as count FROM messages_sent WHERE status = 'pending'").get() as { count: number }).count;

    const listingsPerDay = db.prepare(`
      SELECT date(discovered_at) as day, COUNT(*) as count
      FROM listings
      GROUP BY date(discovered_at)
      ORDER BY day DESC
      LIMIT 30
    `).all();

    const messagesPerDay = db.prepare(`
      SELECT date(sent_at) as day, COUNT(*) as count
      FROM messages_sent
      WHERE sent_at IS NOT NULL
      GROUP BY date(sent_at)
      ORDER BY day DESC
      LIMIT 30
    `).all();

    res.json({
      totalListings,
      totalMessages,
      sentMessages,
      failedMessages,
      pendingMessages,
      listingsPerDay,
      messagesPerDay,
    });
  });

  return router;
}
```

- [ ] **Step 8: Implement health route**

Create `src/routes/health.ts`:
```typescript
import { Router } from "express";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  return router;
}
```

- [ ] **Step 9: Implement server.ts**

Create `src/server.ts`:
```typescript
import express from "express";
import path from "node:path";
import { config } from "./config.js";
import { getDb } from "./db/database.js";
import { createPreferencesRouter } from "./routes/preferences.js";
import { createTemplatesRouter } from "./routes/templates.js";
import { createListingsRouter } from "./routes/listings.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createStatsRouter } from "./routes/stats.js";
import { createHealthRouter } from "./routes/health.js";
import { logger } from "./logger.js";

export function startServer(): void {
  const app = express();
  const db = getDb();

  app.use(express.json());

  // API routes
  app.use("/api/preferences", createPreferencesRouter(db));
  app.use("/api/templates", createTemplatesRouter(db));
  app.use("/api/listings", createListingsRouter(db));
  app.use("/api/sessions", createSessionsRouter(db));
  app.use("/api/stats", createStatsRouter(db));
  app.use("/health", createHealthRouter());

  // Serve frontend static files
  const frontendDist = path.join(process.cwd(), "frontend", "dist");
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  app.listen(config.port, () => {
    logger.info({ port: config.port }, "Server listening");
  });
}
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
npx vitest run tests/routes/
```

Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: Express API server with all CRUD routes, stats, and health endpoint"
```

---

## Task 12: Frontend Setup

**Files:**
- Create: `frontend/package.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/src/index.css`

- [ ] **Step 1: Initialize frontend project**

```bash
cd /home/louis/trouver-un-appart
mkdir -p frontend/src
cd frontend
npm init -y
npm install react react-dom react-router-dom
npm install --save-dev vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Create frontend config files**

Create `frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
```

Create `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

Create `frontend/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

Create `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apartment Scraper</title>
  </head>
  <body class="bg-gray-50">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create API client**

Create `frontend/src/api.ts`:
```typescript
const BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Preference {
  id: number;
  name: string;
  city: string;
  budget_min: number | null;
  budget_max: number | null;
  surface_min: number | null;
  rooms_min: number | null;
  active: number;
}

export interface Template {
  id: number;
  name: string;
  body: string;
  is_default: number;
}

export interface Listing {
  id: number;
  platform: string;
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  city: string | null;
  discovered_at: string;
}

export interface Stats {
  totalListings: number;
  totalMessages: number;
  sentMessages: number;
  failedMessages: number;
  pendingMessages: number;
  listingsPerDay: Array<{ day: string; count: number }>;
  messagesPerDay: Array<{ day: string; count: number }>;
}

export interface Session {
  id: number;
  platform: string;
  last_valid_at: string | null;
  status: string;
}

export const api = {
  preferences: {
    list: () => fetchJson<Preference[]>("/preferences"),
    create: (data: Omit<Preference, "id" | "active">) => fetchJson<Preference>("/preferences", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Preference>) => fetchJson<void>(`/preferences/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => fetchJson<void>(`/preferences/${id}`, { method: "DELETE" }),
  },
  templates: {
    list: () => fetchJson<Template[]>("/templates"),
    create: (data: Omit<Template, "id">) => fetchJson<Template>("/templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Template>) => fetchJson<void>(`/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => fetchJson<void>(`/templates/${id}`, { method: "DELETE" }),
  },
  listings: {
    list: (params: { limit?: number; offset?: number; platform?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.limit) qs.set("limit", String(params.limit));
      if (params.offset) qs.set("offset", String(params.offset));
      if (params.platform) qs.set("platform", params.platform);
      return fetchJson<{ listings: Listing[]; total: number }>(`/listings?${qs}`);
    },
  },
  stats: () => fetchJson<Stats>("/stats"),
  sessions: {
    list: () => fetchJson<Session[]>("/sessions"),
    login: (platform: string) => fetchJson<{ message: string }>(`/sessions/${platform}/login`, { method: "POST" }),
  },
};
```

- [ ] **Step 4: Create main entry and App with router**

Create `frontend/src/main.tsx`:
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

Create `frontend/src/App.tsx`:
```typescript
import { Routes, Route, NavLink } from "react-router-dom";
import Preferences from "./pages/Preferences.js";
import Templates from "./pages/Templates.js";
import Listings from "./pages/Listings.js";
import Stats from "./pages/Stats.js";
import Sessions from "./pages/Sessions.js";

function Layout({ children }: { children: React.ReactNode }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded ${isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`;

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow p-4 flex gap-2">
        <NavLink to="/" className={linkClass}>Annonces</NavLink>
        <NavLink to="/preferences" className={linkClass}>Préférences</NavLink>
        <NavLink to="/templates" className={linkClass}>Messages</NavLink>
        <NavLink to="/stats" className={linkClass}>Stats</NavLink>
        <NavLink to="/sessions" className={linkClass}>Sessions</NavLink>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Listings />} />
        <Route path="/preferences" element={<Preferences />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/sessions" element={<Sessions />} />
      </Routes>
    </Layout>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: frontend setup with Vite, React Router, TailwindCSS, and API client"
```

---

## Task 13: Frontend Pages

**Files:**
- Create: `frontend/src/pages/Preferences.tsx`, `frontend/src/pages/Templates.tsx`, `frontend/src/pages/Listings.tsx`, `frontend/src/pages/Stats.tsx`, `frontend/src/pages/Sessions.tsx`

- [ ] **Step 1: Implement Preferences page**

Create `frontend/src/pages/Preferences.tsx`:
```typescript
import { useState, useEffect } from "react";
import { api, type Preference } from "../api.js";

export default function Preferences() {
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [form, setForm] = useState({ name: "", city: "", budget_min: "", budget_max: "", surface_min: "", rooms_min: "" });
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => { loadPrefs(); }, []);

  async function loadPrefs() {
    setPrefs(await api.preferences.list());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      city: form.city,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      surface_min: form.surface_min ? Number(form.surface_min) : null,
      rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
    };
    if (editing) {
      await api.preferences.update(editing, data);
      setEditing(null);
    } else {
      await api.preferences.create(data);
    }
    setForm({ name: "", city: "", budget_min: "", budget_max: "", surface_min: "", rooms_min: "" });
    loadPrefs();
  }

  async function toggleActive(pref: Preference) {
    await api.preferences.update(pref.id, { active: pref.active ? 0 : 1 });
    loadPrefs();
  }

  async function handleDelete(id: number) {
    await api.preferences.delete(id);
    loadPrefs();
  }

  function startEdit(pref: Preference) {
    setEditing(pref.id);
    setForm({
      name: pref.name,
      city: pref.city,
      budget_min: pref.budget_min?.toString() || "",
      budget_max: pref.budget_max?.toString() || "",
      surface_min: pref.surface_min?.toString() || "",
      rooms_min: pref.rooms_min?.toString() || "",
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Préférences de recherche</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 grid grid-cols-2 gap-3">
        <input className="border p-2 rounded" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="border p-2 rounded" placeholder="Ville/Quartier" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        <input className="border p-2 rounded" type="number" placeholder="Budget min (€)" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Budget max (€)" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Surface min (m²)" value={form.surface_min} onChange={(e) => setForm({ ...form, surface_min: e.target.value })} />
        <input className="border p-2 rounded" type="number" placeholder="Pièces min" value={form.rooms_min} onChange={(e) => setForm({ ...form, rooms_min: e.target.value })} />
        <button type="submit" className="col-span-2 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          {editing ? "Modifier" : "Ajouter"}
        </button>
      </form>

      <div className="space-y-3">
        {prefs.map((pref) => (
          <div key={pref.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
            <div>
              <span className="font-semibold">{pref.name}</span> — {pref.city}
              <span className="text-sm text-gray-500 ml-2">
                {pref.budget_min}–{pref.budget_max}€ | {pref.surface_min}m² | {pref.rooms_min}p
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleActive(pref)} className={`px-3 py-1 rounded text-sm ${pref.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {pref.active ? "Actif" : "Inactif"}
              </button>
              <button onClick={() => startEdit(pref)} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">Modifier</button>
              <button onClick={() => handleDelete(pref.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement Templates page**

Create `frontend/src/pages/Templates.tsx`:
```typescript
import { useState, useEffect } from "react";
import { api, type Template } from "../api.js";

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState({ name: "", body: "", is_default: false });
  const [editing, setEditing] = useState<number | null>(null);
  const [preview, setPreview] = useState("");

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setTemplates(await api.templates.list());
  }

  function updatePreview(body: string) {
    const vars: Record<string, string> = {
      "{{title}}": "Studio lumineux Paris 11",
      "{{price}}": "950",
      "{{city}}": "Paris 11",
      "{{surface}}": "28",
      "{{rooms}}": "1",
      "{{url}}": "https://leboncoin.fr/exemple",
    };
    let result = body;
    for (const [key, val] of Object.entries(vars)) {
      result = result.replaceAll(key, val);
    }
    setPreview(result);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      await api.templates.update(editing, { name: form.name, body: form.body, is_default: form.is_default ? 1 : 0 });
      setEditing(null);
    } else {
      await api.templates.create({ name: form.name, body: form.body, is_default: form.is_default ? 1 : 0 });
    }
    setForm({ name: "", body: "", is_default: false });
    setPreview("");
    loadTemplates();
  }

  async function handleDelete(id: number) {
    await api.templates.delete(id);
    loadTemplates();
  }

  function startEdit(t: Template) {
    setEditing(t.id);
    setForm({ name: t.name, body: t.body, is_default: !!t.is_default });
    updatePreview(t.body);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Templates de message</h1>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 space-y-3">
        <input className="border p-2 rounded w-full" placeholder="Nom du template" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <textarea
          className="border p-2 rounded w-full h-32"
          placeholder="Message... Utilisez {{title}}, {{price}}, {{city}}, {{surface}}, {{rooms}}, {{url}}"
          value={form.body}
          onChange={(e) => { setForm({ ...form, body: e.target.value }); updatePreview(e.target.value); }}
          required
        />
        {preview && (
          <div className="bg-gray-50 p-3 rounded border text-sm">
            <span className="font-semibold text-gray-500">Aperçu :</span><br />{preview}
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
          Template par défaut
        </label>
        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 w-full">
          {editing ? "Modifier" : "Ajouter"}
        </button>
      </form>

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">{t.name} {t.is_default ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">défaut</span> : ""}</span>
              <div className="flex gap-2">
                <button onClick={() => startEdit(t)} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">Modifier</button>
                <button onClick={() => handleDelete(t.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">Supprimer</button>
              </div>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement Listings page**

Create `frontend/src/pages/Listings.tsx`:
```typescript
import { useState, useEffect } from "react";
import { api, type Listing } from "../api.js";

export default function Listings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [platform, setPlatform] = useState<string>("");
  const limit = 20;

  useEffect(() => { loadListings(); }, [page, platform]);

  async function loadListings() {
    const result = await api.listings.list({ limit, offset: page * limit, platform: platform || undefined });
    setListings(result.listings);
    setTotal(result.total);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Annonces ({total})</h1>
        <select className="border p-2 rounded" value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(0); }}>
          <option value="">Toutes</option>
          <option value="leboncoin">LeBonCoin</option>
          <option value="seloger">SeLoger</option>
        </select>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left">Titre</th>
              <th className="p-3 text-left">Prix</th>
              <th className="p-3 text-left">Surface</th>
              <th className="p-3 text-left">Ville</th>
              <th className="p-3 text-left">Plateforme</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Lien</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3">{l.title}</td>
                <td className="p-3">{l.price ? `${l.price}€` : "—"}</td>
                <td className="p-3">{l.surface ? `${l.surface}m²` : "—"}</td>
                <td className="p-3">{l.city || "—"}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${l.platform === "leboncoin" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"}`}>{l.platform}</span></td>
                <td className="p-3 text-gray-500">{new Date(l.discovered_at).toLocaleDateString("fr")}</td>
                <td className="p-3"><a href={l.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Voir</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 border rounded disabled:opacity-50">Précédent</button>
          <span className="px-3 py-1">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 border rounded disabled:opacity-50">Suivant</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement Stats page**

Create `frontend/src/pages/Stats.tsx`:
```typescript
import { useState, useEffect } from "react";
import { api, type Stats as StatsType } from "../api.js";

export default function Stats() {
  const [stats, setStats] = useState<StatsType | null>(null);

  useEffect(() => { api.stats().then(setStats); }, []);

  if (!stats) return <div>Chargement...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Statistiques</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.totalListings}</div>
          <div className="text-sm text-gray-500">Annonces détectées</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-green-600">{stats.sentMessages}</div>
          <div className="text-sm text-gray-500">Messages envoyés</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.pendingMessages}</div>
          <div className="text-sm text-gray-500">En attente</div>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <div className="text-3xl font-bold text-red-600">{stats.failedMessages}</div>
          <div className="text-sm text-gray-500">Échoués</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Annonces / jour (30 derniers jours)</h2>
          <div className="space-y-1">
            {stats.listingsPerDay.slice(0, 14).map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-gray-500">{d.day}</span>
                <div className="bg-blue-200 h-4 rounded" style={{ width: `${Math.min(100, d.count * 5)}%` }} />
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-3">Messages / jour (30 derniers jours)</h2>
          <div className="space-y-1">
            {stats.messagesPerDay.slice(0, 14).map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-sm">
                <span className="w-24 text-gray-500">{d.day}</span>
                <div className="bg-green-200 h-4 rounded" style={{ width: `${Math.min(100, d.count * 10)}%` }} />
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement Sessions page**

Create `frontend/src/pages/Sessions.tsx`:
```typescript
import { useState, useEffect } from "react";
import { api, type Session } from "../api.js";

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { loadSessions(); }, []);

  async function loadSessions() {
    setSessions(await api.sessions.list());
  }

  async function handleLogin(platform: string) {
    setMessage(`Ouverture du navigateur pour ${platform}...`);
    try {
      const result = await api.sessions.login(platform);
      setMessage(result.message);
    } catch (error) {
      setMessage(`Erreur: ${error}`);
    }
  }

  const platforms = ["leboncoin", "seloger"];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Sessions</h1>

      {message && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4">{message}</div>}

      <div className="space-y-4">
        {platforms.map((platform) => {
          const session = sessions.find((s) => s.platform === platform);
          const statusColor = session?.status === "valid" ? "green" : session?.status === "expired" ? "red" : "gray";

          return (
            <div key={platform} className="bg-white p-4 rounded shadow flex items-center justify-between">
              <div>
                <span className="font-semibold capitalize">{platform}</span>
                <span className={`ml-3 px-2 py-0.5 rounded text-xs bg-${statusColor}-100 text-${statusColor}-700`}>
                  {session?.status || "non configuré"}
                </span>
                {session?.last_valid_at && (
                  <span className="ml-2 text-sm text-gray-500">
                    Dernière validation: {new Date(session.last_valid_at).toLocaleString("fr")}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleLogin(platform)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Se connecter
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-yellow-50 p-4 rounded border border-yellow-200">
        <p className="text-sm text-yellow-800">
          Cliquer sur "Se connecter" ouvre un navigateur visible. Connectez-vous manuellement à votre compte, 
          puis fermez le navigateur. La session sera automatiquement persistée.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Build frontend to verify no TypeScript errors**

```bash
cd /home/louis/trouver-un-appart/frontend
npx tsc --noEmit
npx vite build
```

Expected: Build successful.

- [ ] **Step 7: Commit**

```bash
cd /home/louis/trouver-un-appart
git add -A
git commit -m "feat: frontend pages — preferences, templates, listings, stats, sessions"
```

---

## Task 14: Integration & Final Wiring

**Files:**
- Modify: `package.json` (add build:all script)

- [ ] **Step 1: Add build scripts to root package.json**

Add to root `package.json` scripts:
```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc && cd frontend && npm run build",
    "build:frontend": "cd frontend && npm install && npx vite build",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "login:leboncoin": "ts-node-dev --transpile-only -e \"import { launchLoginBrowser } from './src/scraper/browser.js'; launchLoginBrowser('leboncoin');\"",
    "login:seloger": "ts-node-dev --transpile-only -e \"import { launchLoginBrowser } from './src/scraper/browser.js'; launchLoginBrowser('seloger');\""
  }
}
```

- [ ] **Step 2: Add frontend build script to frontend/package.json**

Add to `frontend/package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 3: Create a vitest.config.ts at root**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
  },
});
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 5: Build everything**

```bash
npm run build
```

Expected: TypeScript compiles, frontend builds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: integration — build scripts, vitest config, final wiring"
```

---

## Task 15: PM2 Configuration & README

**Files:**
- Create: `ecosystem.config.cjs`

- [ ] **Step 1: Create PM2 config**

Create `ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [{
    name: "apartment-scraper",
    script: "dist/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
      PORT: "3000",
    },
  }],
};
```

- [ ] **Step 2: Create .env.example**

Create `.env.example`:
```bash
# Server
PORT=3000

# Polling interval in ms (default: 90000 = 1.5min)
POLLING_INTERVAL_MS=90000

# Rate limiting
MAX_MESSAGES_PER_HOUR=5

# SMTP (for email sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Logging
LOG_LEVEL=info
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: PM2 config and .env.example for deployment"
```

---

## Self-Review Checklist

1. **Spec coverage:** All spec sections mapped to tasks — DB schema (Task 2), anti-bot/stealth (Task 5), rate limiting (Task 4), template interpolation (Task 3), scrapers (Tasks 6-7), messengers (Task 8), scheduler (Task 9), orchestration (Task 10), API (Task 11), dashboard (Tasks 12-13), logging (Task 1), graceful shutdown (Task 10), pm2 (Task 15), health endpoint (Task 11).

2. **Placeholder scan:** No TBD/TODO found. All steps have complete code.

3. **Type consistency:** `ScrapedListing`, `Listing`, `Preference`, `Template`, `Message`, `Session` types are consistent across tasks. Function names match between definition and usage (`interpolateTemplate`, `listingExists`, `getActivePreferences`, etc.).
