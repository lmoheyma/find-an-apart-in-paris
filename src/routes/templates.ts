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
