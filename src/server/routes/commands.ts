import { Hono } from "hono";

/**
 * Create command-related routes (list available commands)
 */
export function createCommandRoutes() {
  const app = new Hono();

  app.get("/", async (c) => {
    const commands = [
      {
        name: "models",
        description: "List available models from all providers",
        builtin: true,
      },
      {
        name: "model",
        description: "Set the model for this session (e.g., /model claude-sonnet-4-20250514)",
        builtin: true,
      },
    ];
    return c.json(commands);
  });

  return app;
}
