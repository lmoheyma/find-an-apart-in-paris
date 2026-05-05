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
