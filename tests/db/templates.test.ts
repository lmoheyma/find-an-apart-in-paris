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
