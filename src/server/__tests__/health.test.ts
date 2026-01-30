import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { registerHealthRoutes } from "../routes/health.js";

describe("health routes", () => {
  it("should return ok status on GET /health", async () => {
    const app = new Hono();
    registerHealthRoutes(app);

    const res = await app.request("/health");
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
  });
});
