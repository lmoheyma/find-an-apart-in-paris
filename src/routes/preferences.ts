import { Router } from "express";
import type Database from "better-sqlite3";
import { createPreference, getPreferences, updatePreference, deletePreference } from "../db/preferences.js";

export function createPreferencesRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(getPreferences(db));
  });

  router.post("/", (req, res) => {
    const { name, leboncoin_location, seloger_location, budget_min, budget_max, surface_min, rooms_min, rooms_max } = req.body;
    const pref = createPreference(db, { name, leboncoin_location, seloger_location, budget_min, budget_max, surface_min, rooms_min, rooms_max });
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
