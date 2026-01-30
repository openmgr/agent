import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import { z } from "zod";
import { SessionManager } from "../session/index.js";
import { McpManager } from "../mcp/manager.js";
import { sessionStorage } from "../session/storage.js";
import { loadConfig } from "../config.js";
import type { AgentEvent } from "../types.js";
import type { AgentOptions } from "../agent.js";

export interface ServerOptions {
  agentOptions?: Partial<AgentOptions>;
  enablePersistence?: boolean;
}

export function createServer(options: ServerOptions = {}) {
  const app = new Hono();
  const sessionManager = new SessionManager({
    agentOptions: options.agentOptions,
    enablePersistence: options.enablePersistence ?? true,
  });

  const eventSubscribers = new Map<string, Set<(event: AgentEvent) => void>>();

  app.use("*", cors());

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.get("/session", async (c) => {
    const parentIdParam = c.req.query("parentId");
    const parentId = parentIdParam === "null" ? null : parentIdParam;

    const stored = await sessionManager.listStored({
      limit: 50,
      orderBy: "updatedAt",
      order: "desc",
      parentId,
    });

    const sessions = stored.map((s) => ({
      id: s.id,
      parentId: s.parentId,
      workingDirectory: s.workingDirectory,
      title: s.title,
      provider: s.provider,
      model: s.model,
      messageCount: s.messageCount,
      createdAt: s.createdAt.getTime(),
      updatedAt: s.updatedAt.getTime(),
    }));

    return c.json({ sessions });
  });

  app.post("/session", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      workingDirectory: z.string().optional(),
      title: z.string().optional(),
      parentId: z.string().optional(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const session = await sessionManager.create(result.data);
    return c.json({ session }, 201);
  });

  app.get("/session/:id", async (c) => {
    const id = c.req.param("id");

    let session = sessionManager.get(id);
    if (!session) {
      const stored = await sessionManager.getStored(id);
      if (!stored) {
        return c.json({ error: "Session not found" }, 404);
      }
      return c.json({
        session: {
          id: stored.id,
          parentId: stored.parentId,
          workingDirectory: stored.workingDirectory,
          title: stored.title,
          provider: stored.provider,
          model: stored.model,
          systemPrompt: stored.systemPrompt,
          compactionConfig: stored.compactionConfig,
          messageCount: stored.messageCount,
          tokenEstimate: stored.tokenEstimate,
          createdAt: stored.createdAt.getTime(),
          updatedAt: stored.updatedAt.getTime(),
        },
      });
    }
    return c.json({ session });
  });

  app.delete("/session/:id", async (c) => {
    const id = c.req.param("id");
    const deleted = await sessionManager.deleteStored(id);
    if (!deleted) {
      const inMemory = sessionManager.delete(id);
      if (!inMemory) {
        return c.json({ error: "Session not found" }, 404);
      }
    }
    return c.json({ success: true });
  });

  app.get("/session/:id/children", async (c) => {
    const parentId = c.req.param("id");

    const children = await sessionManager.listStored({
      limit: 50,
      orderBy: "createdAt",
      order: "desc",
      parentId,
    });

    const sessions = children.map((s) => ({
      id: s.id,
      parentId: s.parentId,
      workingDirectory: s.workingDirectory,
      title: s.title,
      provider: s.provider,
      model: s.model,
      messageCount: s.messageCount,
      createdAt: s.createdAt.getTime(),
      updatedAt: s.updatedAt.getTime(),
    }));

    return c.json({ sessions });
  });

  app.post("/session/:id/restore", async (c) => {
    const id = c.req.param("id");

    if (sessionManager.get(id)) {
      return c.json({ success: true, message: "Session already active" });
    }

    const session = await sessionManager.restore(id);
    if (!session) {
      return c.json({ error: "Session not found in storage" }, 404);
    }

    return c.json({ success: true, session });
  });

  app.get("/session/:id/message", async (c) => {
    const sessionId = c.req.param("id");

    const state = sessionManager.get(sessionId);
    if (state) {
      const messages = sessionManager.getMessages(sessionId);
      return c.json({ messages });
    }

    const messages = await sessionManager.getStoredMessages(sessionId);
    if (messages.length === 0) {
      const stored = await sessionManager.getStored(sessionId);
      if (!stored) {
        return c.json({ error: "Session not found" }, 404);
      }
    }
    return c.json({ messages });
  });

  app.post("/session/:id/prompt_async", async (c) => {
    const sessionId = c.req.param("id");

    let session = sessionManager.get(sessionId);
    if (!session) {
      const restored = await sessionManager.restore(sessionId);
      if (!restored) {
        return c.json({ error: "Session not found" }, 404);
      }
      session = restored;
    }

    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      prompt: z.string(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const onEvent = (event: AgentEvent) => {
      const subscribers = eventSubscribers.get(sessionId);
      if (subscribers) {
        for (const callback of subscribers) {
          callback(event);
        }
      }
    };

    sessionManager
      .prompt(sessionId, result.data.prompt, onEvent)
      .catch((err) => {
        const subscribers = eventSubscribers.get(sessionId);
        if (subscribers) {
          for (const callback of subscribers) {
            callback({ type: "error", error: err.message });
          }
        }
      });

    return c.json({ success: true, message: "Prompt started" });
  });

  app.post("/session/:id/abort", async (c) => {
    const sessionId = c.req.param("id");
    const session = sessionManager.get(sessionId);
    if (!session) {
      return c.json({ error: "Session not active" }, 404);
    }

    sessionManager.abort(sessionId);
    return c.json({ success: true });
  });

  app.patch("/session/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const schema = z.object({
      title: z.string().optional(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const stored = await sessionManager.getStored(id);
    if (!stored) {
      return c.json({ error: "Session not found" }, 404);
    }

    if (result.data.title !== undefined) {
      await sessionManager.updateSessionTitle(id, result.data.title);
    }

    return c.json({ success: true });
  });

  app.get("/session/:id/events", (c) => {
    const sessionId = c.req.param("id");
    const session = sessionManager.get(sessionId);
    if (!session) {
      return c.json({ error: "Session not active" }, 404);
    }

    return streamSSE(c, async (stream) => {
      const callback = (event: AgentEvent) => {
        stream.writeSSE({ data: JSON.stringify(event) });
      };

      let subscribers = eventSubscribers.get(sessionId);
      if (!subscribers) {
        subscribers = new Set();
        eventSubscribers.set(sessionId, subscribers);
      }
      subscribers.add(callback);

      await stream.writeSSE({
        data: JSON.stringify({ type: "connected", sessionId }),
      });

      const heartbeat = setInterval(() => {
        stream.writeSSE({ data: JSON.stringify({ type: "heartbeat" }) });
      }, 30000);

      try {
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } finally {
        clearInterval(heartbeat);
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          eventSubscribers.delete(sessionId);
        }
      }
    });
  });

  app.get("/event", (c) => {
    return streamSSE(c, async (stream) => {
      const callbacks = new Map<string, (event: AgentEvent) => void>();

      const createCallback = (sessionId: string) => (event: AgentEvent) => {
        stream.writeSSE({
          data: JSON.stringify({ sessionId, ...event }),
        });
      };

      for (const session of sessionManager.list()) {
        const callback = createCallback(session.id);
        callbacks.set(session.id, callback);

        let subscribers = eventSubscribers.get(session.id);
        if (!subscribers) {
          subscribers = new Set();
          eventSubscribers.set(session.id, subscribers);
        }
        subscribers.add(callback);
      }

      await stream.writeSSE({
        data: JSON.stringify({ type: "connected" }),
      });

      const heartbeat = setInterval(() => {
        stream.writeSSE({ data: JSON.stringify({ type: "heartbeat" }) });
      }, 30000);

      try {
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } finally {
        clearInterval(heartbeat);
        for (const [sessionId, callback] of callbacks) {
          const subscribers = eventSubscribers.get(sessionId);
          if (subscribers) {
            subscribers.delete(callback);
            if (subscribers.size === 0) {
              eventSubscribers.delete(sessionId);
            }
          }
        }
      }
    });
  });

  app.get("/session/:id/compaction", async (c) => {
    const sessionId = c.req.param("id");

    const stored = await sessionManager.getStored(sessionId);
    if (!stored) {
      return c.json({ error: "Session not found" }, 404);
    }

    const history = await sessionStorage.getCompactionHistory(sessionId);

    return c.json({
      config: stored.compactionConfig,
      history: history.map((h) => ({
        id: h.id,
        summary: h.editedSummary ?? h.summary,
        originalSummary: h.summary,
        isEdited: !!h.editedSummary,
        originalTokens: h.originalTokens,
        compactedTokens: h.compactedTokens,
        messagesPruned: h.messagesPruned,
        createdAt: h.createdAt.getTime(),
      })),
    });
  });

  app.post("/session/:id/compact", async (c) => {
    const sessionId = c.req.param("id");

    const state = sessionManager.getState(sessionId);
    if (!state) {
      return c.json({ error: "Session not active. Restore it first." }, 400);
    }

    const agent = state.agent;
    if (!agent.shouldCompact()) {
      return c.json({ error: "Session does not need compaction" }, 400);
    }

    try {
      const result = await agent.runCompaction();

      const stored = await sessionManager.getStored(sessionId);
      if (stored) {
        await sessionStorage.saveCompaction(sessionId, {
          summary: result.summary,
          originalTokens: result.originalTokens,
          compactedTokens: result.compactedTokens,
          messagesPruned: result.messagesPruned,
          fromSequence: 0,
          toSequence: result.messagesPruned,
        });
      }

      return c.json({
        success: true,
        result: {
          summary: result.summary,
          originalTokens: result.originalTokens,
          compactedTokens: result.compactedTokens,
          messagesPruned: result.messagesPruned,
          compressionRatio: result.compressionRatio,
        },
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  app.patch("/session/:id/compaction/config", async (c) => {
    const sessionId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));

    const schema = z.object({
      enabled: z.boolean().optional(),
      tokenThreshold: z.number().min(0).max(1).optional(),
      inceptionCount: z.number().min(0).optional(),
      workingWindowCount: z.number().min(0).optional(),
      autoCompact: z.boolean().optional(),
      model: z.string().optional(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const stored = await sessionManager.getStored(sessionId);
    if (!stored) {
      return c.json({ error: "Session not found" }, 404);
    }

    const newConfig = { ...stored.compactionConfig, ...result.data };
    await sessionStorage.updateSession(sessionId, { compactionConfig: newConfig });

    const state = sessionManager.getState(sessionId);
    if (state) {
      state.agent.updateCompactionConfig(result.data);
    }

    return c.json({ success: true, config: newConfig });
  });

  app.get("/session/:id/compaction/:compactionId", async (c) => {
    const compactionId = c.req.param("compactionId");

    const compaction = await sessionStorage.getCompaction(compactionId);
    if (!compaction) {
      return c.json({ error: "Compaction not found" }, 404);
    }

    return c.json({
      compaction: {
        id: compaction.id,
        summary: compaction.editedSummary ?? compaction.summary,
        originalSummary: compaction.summary,
        isEdited: !!compaction.editedSummary,
        originalTokens: compaction.originalTokens,
        compactedTokens: compaction.compactedTokens,
        messagesPruned: compaction.messagesPruned,
        createdAt: compaction.createdAt.getTime(),
      },
    });
  });

  app.patch("/session/:id/compaction/:compactionId", async (c) => {
    const compactionId = c.req.param("compactionId");
    const body = await c.req.json().catch(() => ({}));

    const schema = z.object({
      summary: z.string(),
    });

    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const compaction = await sessionStorage.getCompaction(compactionId);
    if (!compaction) {
      return c.json({ error: "Compaction not found" }, 404);
    }

    await sessionStorage.updateCompactionSummary(compactionId, result.data.summary);

    return c.json({ success: true });
  });

  let mcpManager: McpManager | null = null;

  app.get("/mcp/servers", async (c) => {
    if (!mcpManager) {
      const config = await loadConfig(options.agentOptions?.workingDirectory);
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        mcpManager = new McpManager();
        await mcpManager.loadFromConfig(config.mcp);
      } else {
        return c.json({ servers: [] });
      }
    }

    const servers = mcpManager.getServers();
    return c.json({ servers });
  });

  app.get("/mcp/tools", async (c) => {
    if (!mcpManager) {
      const config = await loadConfig(options.agentOptions?.workingDirectory);
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        mcpManager = new McpManager();
        await mcpManager.loadFromConfig(config.mcp);
      } else {
        return c.json({ tools: [] });
      }
    }

    const tools = mcpManager.getTools();
    return c.json({ tools });
  });

  app.post("/mcp/servers/:name/connect", async (c) => {
    const name = c.req.param("name");

    if (!mcpManager) {
      const config = await loadConfig(options.agentOptions?.workingDirectory);
      if (!config.mcp || !config.mcp[name]) {
        return c.json({ error: `MCP server not found in config: ${name}` }, 404);
      }
      mcpManager = new McpManager();
    }

    const config = await loadConfig(options.agentOptions?.workingDirectory);
    if (!config.mcp || !config.mcp[name]) {
      return c.json({ error: `MCP server not found in config: ${name}` }, 404);
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

  app.post("/mcp/servers/:name/disconnect", async (c) => {
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

  // --- MCP Resources ---

  app.get("/mcp/resources", async (c) => {
    if (!mcpManager) {
      const config = await loadConfig(options.agentOptions?.workingDirectory);
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        mcpManager = new McpManager();
        await mcpManager.loadFromConfig(config.mcp);
      } else {
        return c.json({ resources: [] });
      }
    }

    const serverFilter = c.req.query("server");
    let resources = mcpManager.getResources();
    
    if (serverFilter) {
      resources = resources.filter(r => r.serverName === serverFilter);
    }

    return c.json({ resources });
  });

  app.get("/mcp/resources/read", async (c) => {
    const uri = c.req.query("uri");
    if (!uri) {
      return c.json({ error: "URI is required" }, 400);
    }

    if (!mcpManager) {
      const config = await loadConfig(options.agentOptions?.workingDirectory);
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        mcpManager = new McpManager();
        await mcpManager.loadFromConfig(config.mcp);
      } else {
        return c.json({ error: "No MCP servers configured" }, 400);
      }
    }

    try {
      const content = await mcpManager.readResource(uri);
      const resource = mcpManager.getResource(uri);
      
      return c.json({
        uri,
        content,
        mimeType: resource?.mimeType,
        name: resource?.name,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // --- MCP Prompts ---

  app.get("/mcp/prompts", async (c) => {
    if (!mcpManager) {
      const config = await loadConfig(options.agentOptions?.workingDirectory);
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        mcpManager = new McpManager();
        await mcpManager.loadFromConfig(config.mcp);
      } else {
        return c.json({ prompts: [] });
      }
    }

    const serverFilter = c.req.query("server");
    let prompts = mcpManager.getPrompts();
    
    if (serverFilter) {
      prompts = prompts.filter(p => p.serverName === serverFilter);
    }

    return c.json({ prompts });
  });

  app.post("/mcp/prompts/:name/invoke", async (c) => {
    const name = c.req.param("name");

    if (!mcpManager) {
      const config = await loadConfig(options.agentOptions?.workingDirectory);
      if (config.mcp && Object.keys(config.mcp).length > 0) {
        mcpManager = new McpManager();
        await mcpManager.loadFromConfig(config.mcp);
      } else {
        return c.json({ error: "No MCP servers configured" }, 400);
      }
    }

    const body = await c.req.json().catch(() => ({}));
    const args = body.arguments as Record<string, string> | undefined;

    const fullName = name.startsWith("mcp_") ? name : `mcp_${name}`;
    const prompt = mcpManager.getPrompt(fullName);
    
    if (!prompt) {
      const available = mcpManager.getPrompts().map(p => p.name);
      return c.json({ 
        error: `Prompt not found: ${name}`,
        available,
      }, 404);
    }

    try {
      const result = await mcpManager.invokePrompt(fullName, args);
      return c.json({
        prompt: fullName,
        result,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get("/command", async (c) => {
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

  app.post("/session/:id/command", async (c) => {
    const sessionId = c.req.param("id");

    let session = sessionManager.get(sessionId);
    if (!session) {
      const restored = await sessionManager.restore(sessionId);
      if (!restored) {
        return c.json({ error: "Session not found" }, 404);
      }
      session = restored;
    }

    const body = await c.req.json().catch(() => ({}));
    const commandSchema = z.object({
      command: z.string(),
      arguments: z.string().optional(),
    });

    const result = commandSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.message }, 400);
    }

    const { command, arguments: args } = result.data;
    const { PROVIDER_MODELS, findModel, getProviderModels, getConfiguredProviders, hasProviderCredentials } = await import("../llm/models.js");

    if (command === "models") {
      let response = "";
      const showAll = args === "all";
      const specificProvider = args && args !== "all" ? args : null;

      if (specificProvider) {
        const models = getProviderModels(specificProvider);
        if (models.length === 0) {
          return c.json({
            response: `Unknown provider: ${specificProvider}\n\nValid providers: ${PROVIDER_MODELS.map(p => p.id).join(", ")}`,
          });
        }
        const provider = PROVIDER_MODELS.find(p => p.id === specificProvider)!;
        const isConfigured = hasProviderCredentials(specificProvider);
        const status = isConfigured ? " (configured)" : " (not configured)";
        response = `# ${provider.name} Models${status}\n\n`;
        for (const model of models) {
          response += `- **${model.id}** - ${model.name}`;
          if (model.description) {
            response += ` (${model.description})`;
          }
          response += "\n";
        }
      } else {
        const providers = showAll ? PROVIDER_MODELS : getConfiguredProviders();
        
        if (providers.length === 0) {
          response = "# No Configured Providers\n\n";
          response += "Set up credentials using environment variables:\n";
          response += "- `ANTHROPIC_API_KEY`\n";
          response += "- `OPENAI_API_KEY`\n";
          response += "- `GOOGLE_API_KEY`\n";
          response += "- etc.\n\n";
          response += "Use `/models all` to see all available providers.";
        } else {
          response = showAll ? "# All Available Models\n\n" : "# Configured Models\n\n";
          for (const provider of providers) {
            const isConfigured = hasProviderCredentials(provider.id);
            const status = showAll ? (isConfigured ? " *(configured)*" : " *(not configured)*") : "";
            response += `## ${provider.name}${status}\n`;
            for (const model of provider.models) {
              response += `- \`${model.id}\` - ${model.name}\n`;
            }
            response += "\n";
          }
          response += "Use `/model <model-id>` to set the model for this session.";
          if (!showAll) {
            response += "\nUse `/models all` to see all providers.";
          }
        }
      }

      const onEvent = (event: AgentEvent) => {
        const subscribers = eventSubscribers.get(sessionId);
        if (subscribers) {
          for (const callback of subscribers) {
            callback(event);
          }
        }
      };

      onEvent({ type: "message.start", messageId: `cmd-${Date.now()}` });
      onEvent({ type: "message.delta", messageId: `cmd-${Date.now()}`, delta: response } as AgentEvent);
      onEvent({ type: "message.complete", messageId: `cmd-${Date.now()}`, content: response } as AgentEvent);

      return c.json({ response });
    }

    if (command === "model") {
      if (!args) {
        const state = sessionManager.getState(sessionId);
        const currentModel = state?.agent.getConfig().model ?? "unknown";
        const currentProvider = state?.agent.getConfig().provider ?? "unknown";
        return c.json({
          response: `Current model: **${currentModel}** (provider: ${currentProvider})\n\nUse \`/model <model-id>\` to change the model.\nUse \`/models\` to list available models.`,
        });
      }

      const found = findModel(args);
      if (!found) {
        return c.json({
          response: `Unknown model: ${args}\n\nUse \`/models\` to list available models.`,
        });
      }

      const state = sessionManager.getState(sessionId);
      if (!state) {
        return c.json({ error: "Session not active" }, 400);
      }

      const newConfig = {
        ...state.agent.getConfig(),
        provider: found.provider as "anthropic" | "openai" | "google" | "openrouter" | "groq" | "xai",
        model: found.model.id,
      };

      await sessionManager.updateSessionModel(sessionId, found.provider, found.model.id);

      return c.json({
        response: `Model updated to **${found.model.name}** (\`${found.model.id}\`) from ${found.provider}`,
        model: found.model.id,
        provider: found.provider,
      });
    }

    return c.json({ error: `Unknown command: ${command}` }, 400);
  });

  // --- Provider endpoints ---

  app.get("/provider", async (c) => {
    const { PROVIDER_MODELS, hasProviderCredentials } = await import("../llm/models.js");
    
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

  // --- File endpoints ---

  app.get("/file", async (c) => {
    const path = c.req.query("path") || ".";
    const workingDir = options.agentOptions?.workingDirectory || process.cwd();
    const { readdir, stat } = await import("fs/promises");
    const { join, resolve, relative } = await import("path");

    try {
      const targetPath = resolve(workingDir, path);
      const entries = await readdir(targetPath, { withFileTypes: true });
      
      const files = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = join(targetPath, entry.name);
          const relativePath = relative(workingDir, entryPath);
          const isIgnored = entry.name.startsWith(".") || 
                           entry.name === "node_modules" ||
                           entry.name === "__pycache__";
          
          return {
            name: entry.name,
            path: relativePath,
            absolutePath: entryPath,
            isDirectory: entry.isDirectory(),
            isIgnored,
          };
        })
      );

      // Sort: directories first, then alphabetically
      files.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

      return c.json(files);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get("/file/content", async (c) => {
    const path = c.req.query("path");
    if (!path) {
      return c.json({ error: "Path is required" }, 400);
    }

    const workingDir = options.agentOptions?.workingDirectory || process.cwd();
    const { readFile } = await import("fs/promises");
    const { resolve } = await import("path");

    try {
      const targetPath = resolve(workingDir, path);
      const content = await readFile(targetPath, "utf-8");
      
      return c.json({
        type: "text",
        content,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.put("/file/content", async (c) => {
    const path = c.req.query("path");
    if (!path) {
      return c.json({ error: "Path is required" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const content = body.content;
    if (typeof content !== "string") {
      return c.json({ error: "Content is required" }, 400);
    }

    const workingDir = options.agentOptions?.workingDirectory || process.cwd();
    const { writeFile, mkdir } = await import("fs/promises");
    const { resolve, dirname } = await import("path");

    try {
      const targetPath = resolve(workingDir, path);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content, "utf-8");
      
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // Skill endpoints
  app.get("/skill", async (c) => {
    const { SkillManager } = await import("../skills/index.js");
    const workingDir = options.agentOptions?.workingDirectory || process.cwd();
    
    const manager = new SkillManager(workingDir);
    await manager.discover();
    
    const skills = manager.getAvailable();
    const warnings = manager.getOverrideWarnings();
    
    return c.json({ 
      skills,
      warnings,
      paths: manager.getPaths(),
    });
  });

  app.get("/skill/:name", async (c) => {
    const { SkillManager } = await import("../skills/index.js");
    const workingDir = options.agentOptions?.workingDirectory || process.cwd();
    const name = c.req.param("name");
    
    const manager = new SkillManager(workingDir);
    await manager.discover();
    
    if (!manager.hasSkill(name)) {
      const available = manager.getAvailable();
      return c.json({ 
        error: `Skill not found: ${name}`,
        available: available.map(s => s.name),
      }, 404);
    }

    try {
      const skill = await manager.load(name);
      return c.json(skill);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  return app;
}

export async function startServer(
  options: ServerOptions & { port?: number } = {}
) {
  const { port = 3000, ...serverOptions } = options;
  const app = createServer(serverOptions);

  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Agent server running on http://localhost:${info.port}`);
  });
}
