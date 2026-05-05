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
