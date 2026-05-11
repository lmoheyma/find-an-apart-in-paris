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

export function getListings(db: Database.Database, query: ListingsQuery): { listings: (Listing & { message_status: string | null })[]; total: number } {
  let where = "";
  const params: Record<string, unknown> = { limit: query.limit, offset: query.offset };

  if (query.platform) {
    where = "WHERE l.platform = @platform";
    params.platform = query.platform;
  }

  const total = (db.prepare(`SELECT COUNT(*) as count FROM listings l ${where}`).get(params) as { count: number }).count;
  const listings = db.prepare(`
    SELECT l.*,
      (SELECT m.status FROM messages_sent m WHERE m.listing_id = l.id ORDER BY m.id DESC LIMIT 1) as message_status
    FROM listings l
    ${where}
    ORDER BY l.discovered_at DESC
    LIMIT @limit OFFSET @offset
  `).all(params) as (Listing & { message_status: string | null })[];

  return { listings, total };
}
