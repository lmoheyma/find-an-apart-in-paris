import type Database from "better-sqlite3";

export interface Session {
  id: number;
  platform: string;
  user_data_dir: string;
  last_valid_at: string | null;
  status: string;
}

export function getSession(db: Database.Database, platform: string): Session | undefined {
  return db.prepare("SELECT * FROM sessions WHERE platform = ?").get(platform) as Session | undefined;
}

export function upsertSession(db: Database.Database, platform: string, userDataDir: string): Session {
  db.prepare(`
    INSERT INTO sessions (platform, user_data_dir, status)
    VALUES (@platform, @user_data_dir, 'valid')
    ON CONFLICT(platform) DO UPDATE SET user_data_dir = @user_data_dir
  `).run({ platform, user_data_dir: userDataDir });
  return getSession(db, platform)!;
}

export function updateSessionStatus(db: Database.Database, platform: string, status: string): void {
  const lastValid = status === "valid" ? new Date().toISOString() : undefined;
  if (lastValid) {
    db.prepare("UPDATE sessions SET status = ?, last_valid_at = ? WHERE platform = ?").run(status, lastValid, platform);
  } else {
    db.prepare("UPDATE sessions SET status = ? WHERE platform = ?").run(status, platform);
  }
}

export function getSessions(db: Database.Database): Session[] {
  return db.prepare("SELECT * FROM sessions").all() as Session[];
}
