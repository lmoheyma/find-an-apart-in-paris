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
