import { Hono } from "hono";

/**
 * Create provider-related routes
 */
export function createProviderRoutes() {
  const app = new Hono();

  app.get("/", async (c) => {
    const { PROVIDER_MODELS, hasProviderCredentials } = await import("../../llm/models.js");
    
    const providers = PROVIDER_MODELS.map((p) => ({
      id: p.id,
      name: p.name,
      isConnected: hasProviderCredentials(p.id),
      models: p.models.map((m) => ({
        id: m.id,
        name: m.name,
        providerId: p.id,
        description: m.description,
      })),
    }));

    return c.json({ providers });
  });

  return app;
}
