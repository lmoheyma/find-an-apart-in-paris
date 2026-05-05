import type Database from "better-sqlite3";

export interface Preference {
  id: number;
  name: string;
  leboncoin_location: string;
  seloger_location: string;
  budget_min: number | null;
  budget_max: number | null;
  surface_min: number | null;
  rooms_min: number | null;
  rooms_max: number | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePreferenceInput {
  name: string;
  leboncoin_location: string;
  seloger_location: string;
  budget_min: number | null;
  budget_max: number | null;
  surface_min: number | null;
  rooms_min: number | null;
  rooms_max: number | null;
}

export function createPreference(db: Database.Database, input: CreatePreferenceInput): Preference {
  const stmt = db.prepare(`
    INSERT INTO preferences (name, leboncoin_location, seloger_location, budget_min, budget_max, surface_min, rooms_min, rooms_max)
    VALUES (@name, @leboncoin_location, @seloger_location, @budget_min, @budget_max, @surface_min, @rooms_min, @rooms_max)
  `);
  const result = stmt.run(input);
  return db.prepare("SELECT * FROM preferences WHERE id = ?").get(result.lastInsertRowid) as Preference;
}

export function getPreferences(db: Database.Database): Preference[] {
  return db.prepare("SELECT * FROM preferences ORDER BY created_at DESC").all() as Preference[];
}

export function getActivePreferences(db: Database.Database): Preference[] {
  return db.prepare("SELECT * FROM preferences WHERE active = 1 ORDER BY created_at DESC").all() as Preference[];
}

export function updatePreference(db: Database.Database, id: number, updates: Partial<Omit<Preference, "id" | "created_at">>): void {
  const fields = Object.keys(updates)
    .filter((k) => k !== "updated_at")
    .map((k) => `${k} = @${k}`)
    .join(", ");
  db.prepare(`UPDATE preferences SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...updates, id });
}

export function deletePreference(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM preferences WHERE id = ?").run(id);
}
