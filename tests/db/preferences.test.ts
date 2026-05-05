import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import {
  createPreference,
  getPreferences,
  getActivePreferences,
  updatePreference,
  deletePreference,
} from "../../src/db/preferences.js";

describe("preferences", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("creates and retrieves a preference", () => {
    const pref = createPreference(db, {
      name: "Paris 11",
      city: "Paris 11",
      budget_min: 800,
      budget_max: 1200,
      surface_min: 25,
      rooms_min: 1,
    });
    expect(pref.id).toBeDefined();
    expect(pref.name).toBe("Paris 11");
    expect(pref.active).toBe(1);

    const all = getPreferences(db);
    expect(all).toHaveLength(1);
  });

  it("returns only active preferences", () => {
    createPreference(db, { name: "A", city: "A", budget_min: 0, budget_max: 1000, surface_min: 20, rooms_min: 1 });
    const pref2 = createPreference(db, { name: "B", city: "B", budget_min: 0, budget_max: 1000, surface_min: 20, rooms_min: 1 });
    updatePreference(db, pref2.id, { active: 0 });

    const active = getActivePreferences(db);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("A");
  });

  it("updates a preference", () => {
    const pref = createPreference(db, { name: "Test", city: "Lyon", budget_min: 500, budget_max: 900, surface_min: 30, rooms_min: 2 });
    updatePreference(db, pref.id, { city: "Marseille", budget_max: 1000 });

    const all = getPreferences(db);
    expect(all[0].city).toBe("Marseille");
    expect(all[0].budget_max).toBe(1000);
  });

  it("deletes a preference", () => {
    const pref = createPreference(db, { name: "Del", city: "X", budget_min: 0, budget_max: 500, surface_min: 10, rooms_min: 1 });
    deletePreference(db, pref.id);
    expect(getPreferences(db)).toHaveLength(0);
  });
});
