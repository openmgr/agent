import type { Hono } from "hono";
import { z } from "zod";
import type { SessionManager } from "../../session/index.js";
import type { AgentEvent } from "../../types.js";

export function registerSessionRoutes(
  app: Hono,
  sessionManager: SessionManager,
  eventSubscribers: Map<string, Set<(event: AgentEvent) => void>>
): void {
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
}
