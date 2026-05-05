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
