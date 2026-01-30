import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { createServer } from "../../server/index.js";
import { createMockLLMProvider, createToolCallingProvider } from "../mocks/llm.js";
import type { ToolCall, Message, TodoItem } from "../../types.js";

// Mock LLM providers for E2E tests
vi.mock("../../llm/index.js", () => ({
  createProvider: vi.fn(() =>
    createMockLLMProvider({
      responses: [{ content: "E2E test response" }],
    })
  ),
}));

// Mock config loading
vi.mock("../../config.js", () => ({
  loadConfig: vi.fn(async () => ({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    auth: { type: "api-key", apiKey: "test-key" },
    systemPrompt: "Test prompt",
    tools: [],
    mcp: {},
  })),
}));

// Mock session storage to use in-memory storage
vi.mock("../../session/storage.js", () => ({
  sessionStorage: {
    saveSession: vi.fn(async () => {}),
    loadSession: vi.fn(async () => null),
    deleteSession: vi.fn(async () => {}),
    listSessions: vi.fn(async () => []),
    addMessage: vi.fn(async () => {}),
    getMessages: vi.fn(async () => []),
    updateSession: vi.fn(async () => {}),
    getCompactionHistory: vi.fn(async () => []),
    saveCompaction: vi.fn(async () => {}),
    getCompaction: vi.fn(async () => null),
    updateCompactionSummary: vi.fn(async () => {}),
  },
}));

describe("E2E: Server API", () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(() => {
    app = createServer({
      agentOptions: {
        skipConfigLoad: true,
        apiKey: "test-key",
        workingDirectory: "/test",
      },
      enablePersistence: false,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Health endpoint", () => {
    it("should return ok status", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);

      const data = (await res.json()) as { status: string };
      expect(data.status).toBe("ok");
    });
  });

  describe("Session management", () => {
    it("should create a new session", async () => {
      const res = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingDirectory: "/test/project",
          title: "Test Session",
        }),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as { session: { id: string; workingDirectory: string } };
      expect(data.session).toBeDefined();
      expect(data.session.id).toBeDefined();
      expect(data.session.workingDirectory).toBe("/test/project");
      // Note: title is stored in DB, not returned in Session object
    });

    it("should create session with minimal data", async () => {
      const res = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(201);
      const data = (await res.json()) as { session: { id: string } };
      expect(data.session.id).toBeDefined();
    });

    it("should get an existing session", async () => {
      // First create a session
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingDirectory: "/test/get" }),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Then get it
      const res = await app.request(`/session/${sessionId}`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as { session: { id: string; workingDirectory: string } };
      expect(data.session.id).toBe(sessionId);
      expect(data.session.workingDirectory).toBe("/test/get");
    });

    it("should return 404 for non-existent session", async () => {
      const res = await app.request("/session/nonexistent-session-id");
      expect(res.status).toBe(404);

      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("not found");
    });

    it("should list sessions", async () => {
      const res = await app.request("/session");
      expect(res.status).toBe(200);

      const data = (await res.json()) as { sessions: unknown[] };
      expect(Array.isArray(data.sessions)).toBe(true);
    });
  });

  describe("Async prompt endpoint", () => {
    it("should send an async prompt", async () => {
      // Create a session first
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Prompt Test" }),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Send an async prompt
      const res = await app.request(`/session/${sessionId}/prompt_async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Hello, world!" }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { success: boolean; message: string };
      expect(data.success).toBe(true);
      expect(data.message).toBe("Prompt started");
    });

    it("should return 404 for prompt on non-existent session", async () => {
      const res = await app.request("/session/nonexistent/prompt_async", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Hello" }),
      });

      expect(res.status).toBe(404);
    });

    it("should return 400 for prompt without prompt field", async () => {
      // Create a session first
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Send prompt without prompt field
      const res = await app.request(`/session/${sessionId}/prompt_async`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("Messages endpoint", () => {
    it("should get messages for a session", async () => {
      // Create a session first
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Get messages (note: endpoint is /message not /messages)
      const res = await app.request(`/session/${sessionId}/message`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as { messages: unknown[] };
      expect(Array.isArray(data.messages)).toBe(true);
    });
  });

  describe("Session deletion", () => {
    it("should return 404 for non-existent session", async () => {
      const deleteRes = await app.request("/session/nonexistent-id", {
        method: "DELETE",
      });

      expect(deleteRes.status).toBe(404);
    });

    // Note: With mocked storage (returning false for deleteStored),
    // the delete endpoint's behavior is:
    // 1. deleteStored is called - also calls delete(id) which removes from memory
    // 2. deleteStored returns false (from mock)
    // 3. sessionManager.delete(id) is called - but session is already removed
    // 4. Returns 404
    // This is a quirk of how the mock interacts with the actual implementation
  });

  describe("Abort endpoint", () => {
    it("should abort a running session", async () => {
      // Create a session first
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Abort - note this returns 404 if session is not "active" (in memory)
      // For a freshly created session it should work
      const res = await app.request(`/session/${sessionId}/abort`, {
        method: "POST",
      });

      // Session is active immediately after creation
      expect(res.status).toBe(200);
    });

    it("should return 404 for abort on non-existent session", async () => {
      const res = await app.request("/session/nonexistent/abort", {
        method: "POST",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("Command endpoints", () => {
    it("should list available commands", async () => {
      const res = await app.request("/command");
      expect(res.status).toBe(200);

      const data = (await res.json()) as Array<{ name: string; description: string }>;
      expect(Array.isArray(data)).toBe(true);
      expect(data.some(cmd => cmd.name === "models")).toBe(true);
      expect(data.some(cmd => cmd.name === "model")).toBe(true);
    });

    it("should execute models command", async () => {
      // Create a session first
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Execute models command
      const res = await app.request(`/session/${sessionId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "models" }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { response: string };
      expect(data.response).toBeDefined();
    });

    it("should execute model command without args to get current model", async () => {
      // Create a session first
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Execute model command without args
      const res = await app.request(`/session/${sessionId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "model" }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { response: string };
      expect(data.response).toContain("Current model");
    });

    it("should return error for unknown command", async () => {
      // Create a session first
      const createRes = await app.request("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const createData = (await createRes.json()) as { session: { id: string } };
      const sessionId = createData.session.id;

      // Execute unknown command
      const res = await app.request(`/session/${sessionId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "unknowncommand" }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("Provider endpoints", () => {
    it("should list providers", async () => {
      const res = await app.request("/provider");
      expect(res.status).toBe(200);

      const data = (await res.json()) as { providers: Array<{ id: string; name: string; models: unknown[] }> };
      expect(Array.isArray(data.providers)).toBe(true);
      expect(data.providers.length).toBeGreaterThan(0);
      expect(data.providers[0].id).toBeDefined();
      expect(data.providers[0].models).toBeDefined();
    });
  });

  describe("MCP endpoints", () => {
    it("should list MCP servers", async () => {
      const res = await app.request("/mcp/servers");
      expect(res.status).toBe(200);

      const data = (await res.json()) as { servers: unknown[] };
      expect(Array.isArray(data.servers)).toBe(true);
    });

    it("should list MCP tools", async () => {
      const res = await app.request("/mcp/tools");
      expect(res.status).toBe(200);

      const data = (await res.json()) as { tools: unknown[] };
      expect(Array.isArray(data.tools)).toBe(true);
    });
  });

  describe("Session update", () => {
    // Note: PATCH endpoint requires session to exist in storage
    // With mocked storage, we can only test the 404 case
    it("should return 404 when updating non-existent session", async () => {
      const res = await app.request("/session/nonexistent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Title" }),
      });

      expect(res.status).toBe(404);
    });
  });
});

describe("E2E: Session workflow", () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(() => {
    app = createServer({
      agentOptions: {
        skipConfigLoad: true,
        apiKey: "test-key",
        workingDirectory: "/test",
      },
      enablePersistence: false,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete a basic session workflow", async () => {
    // 1. Create session
    const createRes = await app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Full Workflow Test",
        workingDirectory: "/test/workflow",
      }),
    });
    expect(createRes.status).toBe(201);
    const { session } = (await createRes.json()) as { session: { id: string; workingDirectory: string } };
    const sessionId = session.id;
    expect(session.workingDirectory).toBe("/test/workflow");

    // 2. Get session info (note: session exists in memory but not in storage mock)
    const getRes = await app.request(`/session/${sessionId}`);
    expect(getRes.status).toBe(200);

    // 3. Send async prompt
    const promptRes = await app.request(`/session/${sessionId}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "What can you do?" }),
    });
    expect(promptRes.status).toBe(200);

    // 4. Get messages
    const messagesRes = await app.request(`/session/${sessionId}/message`);
    expect(messagesRes.status).toBe(200);

    // 5. Use model command
    const modelRes = await app.request(`/session/${sessionId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "model" }),
    });
    expect(modelRes.status).toBe(200);

    // 6. Abort session (delete doesn't work properly with mocked storage)
    const abortRes = await app.request(`/session/${sessionId}/abort`, {
      method: "POST",
    });
    expect(abortRes.status).toBe(200);
  });
});

describe("E2E: Error handling", () => {
  let app: ReturnType<typeof createServer>;

  beforeAll(() => {
    app = createServer({
      agentOptions: {
        skipConfigLoad: true,
        apiKey: "test-key",
        workingDirectory: "/test",
      },
      enablePersistence: false,
    });
  });

  it("should handle malformed JSON in request body", async () => {
    const res = await app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });

    // Should still create session with defaults since JSON parsing fails gracefully
    expect(res.status).toBe(201);
  });

  it("should validate prompt schema", async () => {
    // Create session
    const createRes = await app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const { session } = (await createRes.json()) as { session: { id: string } };

    // Send invalid prompt (prompt must be string)
    const res = await app.request(`/session/${session.id}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: 123 }),
    });

    expect(res.status).toBe(400);
  });
});
