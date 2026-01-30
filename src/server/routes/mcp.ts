import { Hono } from "hono";
import { McpManager } from "../../mcp/manager.js";
import { loadConfig } from "../../config.js";

export interface McpRoutesOptions {
  workingDirectory?: string;
}

/**
 * Create MCP-related routes
 */
export function createMcpRoutes(options: McpRoutesOptions = {}) {
  const app = new Hono();
  let mcpManager: McpManager | null = null;

  const getMcpManager = async () => {
    if (!mcpManager) {
      const config = await loadConfig(options.workingDirectory);
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        mcpManager = new McpManager();
        await mcpManager.loadFromConfig(config.mcp);
      }
    }
    return mcpManager;
  };

  app.get("/servers", async (c) => {
    const manager = await getMcpManager();
    if (!manager) {
      return c.json({ servers: [] });
    }
    const servers = manager.getServers();
    return c.json({ servers });
  });

  app.get("/tools", async (c) => {
    const manager = await getMcpManager();
    if (!manager) {
      return c.json({ tools: [] });
    }
    const tools = manager.getTools();
    return c.json({ tools });
  });

  app.post("/servers/:name/connect", async (c) => {
    const name = c.req.param("name");

    const config = await loadConfig(options.workingDirectory);
    if (!config.mcp || !config.mcp[name]) {
      return c.json({ error: `MCP server not found in config: ${name}` }, 404);
    }

    if (!mcpManager) {
      mcpManager = new McpManager();
    }

    try {
      await mcpManager.addServer(name, config.mcp[name]);
      const servers = mcpManager.getServers();
      const server = servers.find((s) => s.name === name);
      return c.json({ success: true, server });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  app.post("/servers/:name/disconnect", async (c) => {
    const name = c.req.param("name");

    if (!mcpManager) {
      return c.json({ error: "MCP manager not initialized" }, 400);
    }

    try {
      await mcpManager.removeServer(name);
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  return app;
}
