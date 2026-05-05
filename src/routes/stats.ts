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
