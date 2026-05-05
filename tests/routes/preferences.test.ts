import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import Database from "better-sqlite3";
import { runMigrations } from "../../src/db/migrations.js";
import { createPreferencesRouter } from "../../src/routes/preferences.js";

describe("GET/POST/PUT/DELETE /api/preferences", () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    app = express();
    app.use(express.json());
    app.use("/api/preferences", createPreferencesRouter(db));
  });

  it("GET returns empty array initially", async () => {
    const res = await request(app).get("/api/preferences");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST creates a preference", async () => {
    const res = await request(app).post("/api/preferences").send({
      name: "Paris 11",
      city: "Paris 11",
      budget_min: 800,
      budget_max: 1200,
      surface_min: 25,
      rooms_min: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Paris 11");
    expect(res.body.active).toBe(1);
  });

  it("PUT updates a preference", async () => {
    const created = await request(app).post("/api/preferences").send({
      name: "Test", city: "Lyon", budget_min: 500, budget_max: 900, surface_min: 30, rooms_min: 2,
    });
    const res = await request(app).put(`/api/preferences/${created.body.id}`).send({ city: "Marseille" });
    expect(res.status).toBe(200);

    const list = await request(app).get("/api/preferences");
    expect(list.body[0].city).toBe("Marseille");
  });

  it("DELETE removes a preference", async () => {
    const created = await request(app).post("/api/preferences").send({
      name: "Del", city: "X", budget_min: 0, budget_max: 500, surface_min: 10, rooms_min: 1,
    });
    const res = await request(app).delete(`/api/preferences/${created.body.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get("/api/preferences");
    expect(list.body).toHaveLength(0);
  });
});
