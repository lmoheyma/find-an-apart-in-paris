import type Database from "better-sqlite3";

export interface Template {
  id: number;
  name: string;
  body: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  body: string;
  is_default: number;
}

export function createTemplate(db: Database.Database, input: CreateTemplateInput): Template {
  if (input.is_default) {
    db.prepare("UPDATE message_templates SET is_default = 0 WHERE is_default = 1").run();
  }
  const stmt = db.prepare(`
    INSERT INTO message_templates (name, body, is_default)
    VALUES (@name, @body, @is_default)
  `);
  const result = stmt.run(input);
  return db.prepare("SELECT * FROM message_templates WHERE id = ?").get(result.lastInsertRowid) as Template;
}

export function getTemplates(db: Database.Database): Template[] {
  return db.prepare("SELECT * FROM message_templates ORDER BY created_at DESC").all() as Template[];
}

export function getDefaultTemplate(db: Database.Database): Template | undefined {
  return db.prepare("SELECT * FROM message_templates WHERE is_default = 1").get() as Template | undefined;
}

export function updateTemplate(db: Database.Database, id: number, updates: Partial<Omit<Template, "id" | "created_at">>): void {
  if (updates.is_default) {
    db.prepare("UPDATE message_templates SET is_default = 0 WHERE is_default = 1").run();
  }
  const fields = Object.keys(updates)
    .filter((k) => k !== "updated_at")
    .map((k) => `${k} = @${k}`)
    .join(", ");
  db.prepare(`UPDATE message_templates SET ${fields}, updated_at = datetime('now') WHERE id = @id`).run({ ...updates, id });
}

export function deleteTemplate(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM message_templates WHERE id = ?").run(id);
}
