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
      leboncoin_location TEXT NOT NULL DEFAULT '',
      seloger_location TEXT NOT NULL DEFAULT '',
      budget_min INTEGER,
      budget_max INTEGER,
      surface_min INTEGER,
      rooms_min INTEGER,
      rooms_max INTEGER,
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

  // Idempotent column additions for existing databases
  const messageColumns = db.prepare("PRAGMA table_info(messages_sent)").all() as Array<{ name: string }>;
  if (!messageColumns.some((c) => c.name === "retry_count")) {
    db.exec("ALTER TABLE messages_sent ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0");
  }
}
