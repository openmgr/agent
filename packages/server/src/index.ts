import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { AgentPlugin, AgentInterface } from "@openmgr/agent-core";
import type { SessionManager } from "@openmgr/agent-storage";

/**
 * Server configuration options.
 */
export interface ServerConfig {
  /** Port to listen on. Default: 3000 */
  port?: number;
  /** Hostname to bind to. Default: localhost */
  hostname?: string;
  /** Enable CORS. Default: true */
  cors?: boolean;
  /** CORS allowed origins. Default: * */
  corsOrigins?: string | string[];
}

/**
 * Server state accessible via context.
 */
export interface ServerState {
  agent: AgentInterface;
  sessions?: SessionManager;
}

/**
 * Create the Hono server application.
 */
export function createServer(state: ServerState): Hono {
  const app = new Hono();

  // CORS middleware
  app.use("*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }));

  // Health check - simple status endpoint
  app.get("/healthz", (c) => {
    return c.json({ 
      status: "healthy", 
      version: "0.1.0",
      timestamp: new Date().toISOString() 
    });
  });

  // Readiness check
  app.get("/readyz", (c) => {
    return c.json({ ready: true });
  });

  // Conversations (sessions) API
  const conversationsApi = new Hono();

  conversationsApi.get("/", async (c) => {
    const sessions = state.sessions;
    if (!sessions) {
      return c.json({ error: "Conversations not available" }, 500);
    }
    const list = await sessions.getRootSessions(50);
    return c.json({ data: list, count: list.length });
  });

  conversationsApi.get("/:id", async (c) => {
    const sessions = state.sessions;
    if (!sessions) {
      return c.json({ error: "Conversations not available" }, 500);
    }
    const id = c.req.param("id");
    const session = await sessions.getSession(id);
    if (!session) {
      return c.json({ error: "Conversation not found" }, 404);
    }
    return c.json({ data: session });
  });

  conversationsApi.get("/:id/messages", async (c) => {
    const sessions = state.sessions;
    if (!sessions) {
      return c.json({ error: "Conversations not available" }, 500);
    }
    const id = c.req.param("id");
    const messages = await sessions.getSessionMessages(id);
    return c.json({ data: messages, count: messages.length });
  });

  conversationsApi.delete("/:id", async (c) => {
    const sessions = state.sessions;
    if (!sessions) {
      return c.json({ error: "Conversations not available" }, 500);
    }
    const id = c.req.param("id");
    const deleted = await sessions.deleteSession(id);
    return c.json({ success: deleted });
  });

  app.route("/beta/conversations", conversationsApi);

  // Agent status endpoint
  app.get("/beta/status", (c) => {
    const config = state.agent.getConfig();
    return c.json({
      agent: {
        provider: config.provider,
        model: config.model,
      },
      version: "0.1.0",
    });
  });

  return app;
}

/**
 * Start the server using @hono/node-server.
 * This requires the @hono/node-server package to be installed.
 */
export async function startServer(
  app: Hono,
  config: ServerConfig = {}
): Promise<{ port: number; hostname: string; close: () => void }> {
  const { port = 3000, hostname = "localhost" } = config;

  // Dynamic import of @hono/node-server
  const { serve } = await import("@hono/node-server");

  const server = serve({
    fetch: app.fetch,
    port,
    hostname,
  });

  // Get actual port (useful when port is 0 for random port)
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  return {
    port: actualPort,
    hostname,
    close: () => {
      server.close();
    },
  };
}

/**
 * Create a server plugin that adds HTTP API endpoints.
 * 
 * Note: This plugin sets up routes but doesn't start the server.
 * Use `startServer()` to actually start listening.
 */
export function serverPlugin(): AgentPlugin {
  return {
    name: "server",
    version: "0.1.0",
    
    async onRegister(agent: AgentInterface) {
      // The server is created separately using createServer()
      // This plugin just marks server capability as available
      agent.setExtension("server.available", true);
    },
  };
}

export { Hono };
