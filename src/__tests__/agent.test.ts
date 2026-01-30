import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Agent, type AgentOptions } from "../agent.js";
import {
  createMockLLMProvider,
  createMockToolCall,
  createToolCallingProvider,
  createLLMSpies,
  createMockStream,
} from "./mocks/llm.js";
import type { AgentConfig, AgentEvent, Message, ToolCall, LLMProvider, TodoItem, BackgroundTask } from "../types.js";

// Mock the createProvider function
vi.mock("../llm/index.js", () => ({
  createProvider: vi.fn(() => createMockLLMProvider({ responses: [{ content: "Mock response" }] })),
}));

// Mock loadConfig to avoid file system dependencies
vi.mock("../config.js", () => ({
  loadConfig: vi.fn(async () => ({
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    auth: { type: "api-key", apiKey: "test-key" },
    systemPrompt: "Test prompt",
    tools: [],
    mcp: {},
  })),
}));

describe("Agent", () => {
  let mockProvider: LLMProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = createMockLLMProvider({ responses: [{ content: "Hello from mock" }] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create an agent with default config", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      };

      const agent = new Agent(config);
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig().provider).toBe("anthropic");
      expect(agent.getConfig().model).toBe("claude-sonnet-4-20250514");
    });

    it("should use default system prompt when not provided", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      };

      const agent = new Agent(config);
      expect(agent.getConfig().systemPrompt).toBeDefined();
    });

    it("should use custom system prompt when provided", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        systemPrompt: "Custom prompt",
        workingDirectory: "/test",
      };

      const agent = new Agent(config);
      expect(agent.getConfig().systemPrompt).toBe("Custom prompt");
    });

    it("should initialize compaction engine when enabled", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      };

      const agent = new Agent(config, { enabled: true });
      expect(agent.getCompactionEngine()).not.toBeNull();
    });

    it("should not initialize compaction engine when disabled", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      };

      const agent = new Agent(config, { enabled: false });
      expect(agent.getCompactionEngine()).toBeNull();
    });

    it("should store maxTokens in config", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
        maxTokens: 4096,
      };

      const agent = new Agent(config);
      expect(agent.getConfig().maxTokens).toBe(4096);
    });

    it("should store temperature in config", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
        temperature: 0.7,
      };

      const agent = new Agent(config);
      expect(agent.getConfig().temperature).toBe(0.7);
    });

    it("should store both maxTokens and temperature in config", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
        maxTokens: 8192,
        temperature: 0.5,
      };

      const agent = new Agent(config);
      expect(agent.getConfig().maxTokens).toBe(8192);
      expect(agent.getConfig().temperature).toBe(0.5);
    });

    it("should have undefined maxTokens when not provided", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      };

      const agent = new Agent(config);
      expect(agent.getConfig().maxTokens).toBeUndefined();
    });

    it("should have undefined temperature when not provided", () => {
      const config: AgentConfig = {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      };

      const agent = new Agent(config);
      expect(agent.getConfig().temperature).toBeUndefined();
    });
  });

  describe("message management", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should start with no messages", () => {
      expect(agent.getMessages()).toHaveLength(0);
    });

    it("should set messages", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
        { id: "2", role: "assistant", content: "Hi!", createdAt: Date.now() },
      ];

      agent.setMessages(messages);
      expect(agent.getMessages()).toHaveLength(2);
    });

    it("should return a copy of messages (not reference)", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
      ];

      agent.setMessages(messages);
      const retrieved = agent.getMessages();
      retrieved.push({ id: "2", role: "user", content: "World", createdAt: Date.now() });

      expect(agent.getMessages()).toHaveLength(1);
    });

    it("should clear messages", () => {
      agent.setMessages([
        { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
      ]);

      agent.clearMessages();
      expect(agent.getMessages()).toHaveLength(0);
    });
  });

  describe("todo management", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should start with no todos", () => {
      expect(agent.getTodos()).toHaveLength(0);
    });

    it("should set todos", () => {
      const todos: TodoItem[] = [
        { id: "1", content: "Task 1", status: "pending", priority: "high" },
        { id: "2", content: "Task 2", status: "completed", priority: "low" },
      ];

      agent.setTodos(todos);
      expect(agent.getTodos()).toHaveLength(2);
    });

    it("should return a copy of todos", () => {
      const todos: TodoItem[] = [
        { id: "1", content: "Task 1", status: "pending", priority: "high" },
      ];

      agent.setTodos(todos);
      const retrieved = agent.getTodos();
      retrieved.push({ id: "2", content: "Task 2", status: "pending", priority: "medium" });

      expect(agent.getTodos()).toHaveLength(1);
    });

    it("should clear todos", () => {
      agent.setTodos([
        { id: "1", content: "Task 1", status: "pending", priority: "high" },
      ]);

      agent.clearTodos();
      expect(agent.getTodos()).toHaveLength(0);
    });
  });

  describe("phase management", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should start with no phases", () => {
      expect(agent.getPhases()).toHaveLength(0);
    });

    it("should set phases", () => {
      agent.setPhases([
        { id: "1", content: "Phase 1", status: "pending" },
        { id: "2", content: "Phase 2", status: "in_progress" },
      ]);

      expect(agent.getPhases()).toHaveLength(2);
    });

    it("should clear phases", () => {
      agent.setPhases([{ id: "1", content: "Phase 1", status: "pending" }]);
      agent.clearPhases();
      expect(agent.getPhases()).toHaveLength(0);
    });
  });

  describe("background tasks", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    afterEach(() => {
      // Clean up any running pollers
      (agent as any).stopBackgroundTaskPoller();
    });

    it("should start with no background tasks", () => {
      expect(agent.getBackgroundTasks()).toHaveLength(0);
    });

    it("should add background task", () => {
      const task: BackgroundTask = {
        id: "task-1",
        command: "npm test",
        description: "Run tests",
        status: "running",
        startedAt: Date.now(),
        tmuxSession: "test-session",
        workingDirectory: "/test",
      };

      agent.addBackgroundTask(task);
      expect(agent.getBackgroundTasks()).toHaveLength(1);
      expect(agent.getBackgroundTask("task-1")).toEqual(task);
    });

    it("should update background task", () => {
      const task: BackgroundTask = {
        id: "task-1",
        command: "npm test",
        description: "Run tests",
        status: "running",
        startedAt: Date.now(),
        tmuxSession: "test-session",
        workingDirectory: "/test",
      };

      agent.addBackgroundTask(task);
      agent.updateBackgroundTask("task-1", { status: "completed", exitCode: 0 });

      const updated = agent.getBackgroundTask("task-1");
      expect(updated?.status).toBe("completed");
      expect(updated?.exitCode).toBe(0);
    });

    it("should return undefined for non-existent task", () => {
      expect(agent.getBackgroundTask("non-existent")).toBeUndefined();
    });

    it("should generate background tasks summary", () => {
      const task: BackgroundTask = {
        id: "task-1",
        command: "npm test",
        description: "Run tests",
        status: "running",
        startedAt: Date.now() - 60000, // 1 minute ago
        tmuxSession: "test-session",
        workingDirectory: "/test",
      };

      agent.addBackgroundTask(task);
      const summary = agent.getBackgroundTasksSummary();

      expect(summary).toContain("[ACTIVE BACKGROUND TASKS]");
      expect(summary).toContain("task-1");
      expect(summary).toContain("npm test");
      expect(summary).toContain("running");
    });

    it("should return empty string when no tasks", () => {
      expect(agent.getBackgroundTasksSummary()).toBe("");
    });
  });

  describe("model management", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should change model", () => {
      agent.setModel("openai", "gpt-4");

      expect(agent.getConfig().provider).toBe("openai");
      expect(agent.getConfig().model).toBe("gpt-4");
    });

    it("should recreate compaction engine when model changes", () => {
      const agentWithCompaction = new Agent(
        {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          auth: { type: "api-key", apiKey: "test-key" },
          workingDirectory: "/test",
        },
        { enabled: true }
      );

      const originalEngine = agentWithCompaction.getCompactionEngine();
      agentWithCompaction.setModel("openai", "gpt-4");

      const newEngine = agentWithCompaction.getCompactionEngine();
      expect(newEngine).not.toBe(originalEngine);
    });
  });

  describe("compaction config", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent(
        {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          auth: { type: "api-key", apiKey: "test-key" },
          workingDirectory: "/test",
        },
        { enabled: true, tokenThreshold: 50000 }
      );
    });

    it("should return compaction config", () => {
      const config = agent.getCompactionConfig();
      expect(config.enabled).toBe(true);
      expect(config.tokenThreshold).toBe(50000);
    });

    it("should update compaction config", () => {
      agent.updateCompactionConfig({ tokenThreshold: 100000 });

      const config = agent.getCompactionConfig();
      expect(config.tokenThreshold).toBe(100000);
    });

    it("should return a copy of config (not reference)", () => {
      const config = agent.getCompactionConfig();
      config.tokenThreshold = 999999;

      expect(agent.getCompactionConfig().tokenThreshold).toBe(50000);
    });
  });

  describe("session context", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should start with no session context", () => {
      expect(agent.getSessionContext()).toBeNull();
    });

    it("should set session context", () => {
      const context = {
        sessionId: "session-123",
        sessionManager: {},
      };

      agent.setSessionContext(context);
      expect(agent.getSessionContext()).toEqual(context);
    });
  });

  describe("MCP manager", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should start with no MCP manager", () => {
      expect(agent.getMcpManager()).toBeNull();
    });
  });

  describe("skill manager", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should start with no skill manager", () => {
      expect(agent.getSkillManager()).toBeNull();
    });
  });

  describe("abort functionality", () => {
    let agent: Agent;

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
    });

    it("should handle abort when no controller exists", () => {
      // Should not throw
      expect(() => agent.abort()).not.toThrow();
    });
  });

  describe("shouldCompact", () => {
    it("should return false when compaction is disabled", () => {
      const agent = new Agent(
        {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          auth: { type: "api-key", apiKey: "test-key" },
          workingDirectory: "/test",
        },
        { enabled: false }
      );

      expect(agent.shouldCompact()).toBe(false);
    });

    it("should return false when messages are empty", () => {
      const agent = new Agent(
        {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          auth: { type: "api-key", apiKey: "test-key" },
          workingDirectory: "/test",
        },
        { enabled: true }
      );

      expect(agent.shouldCompact()).toBe(false);
    });
  });

  describe("runCompaction", () => {
    it("should throw when compaction is not enabled", async () => {
      const agent = new Agent(
        {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          auth: { type: "api-key", apiKey: "test-key" },
          workingDirectory: "/test",
        },
        { enabled: false }
      );

      await expect(agent.runCompaction()).rejects.toThrow("Compaction not enabled");
    });
  });

  describe("event emission", () => {
    let agent: Agent;
    let events: AgentEvent[];

    beforeEach(() => {
      agent = new Agent({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        auth: { type: "api-key", apiKey: "test-key" },
        workingDirectory: "/test",
      });
      events = [];
      agent.on("event", (event) => events.push(event));
    });

    it("should be an EventEmitter", () => {
      expect(typeof agent.on).toBe("function");
      expect(typeof agent.emit).toBe("function");
      expect(typeof agent.off).toBe("function");
    });

    it("should emit events when added as listener", () => {
      // Manually emit an event to test the listener
      agent.emit("event", { type: "message.start", messageId: "test-123" } as AgentEvent);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("message.start");
    });
  });
});

describe("Agent.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create agent with skipConfigLoad option", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      apiKey: "test-key",
      workingDirectory: "/test",
    });

    expect(agent).toBeInstanceOf(Agent);
    expect(agent.getConfig().provider).toBe("anthropic");
  });

  it("should use oauth auth when no API key provided with skipConfigLoad", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      workingDirectory: "/test",
    });

    expect(agent.getConfig().auth.type).toBe("oauth");
  });

  it("should use api-key auth when API key provided", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      apiKey: "test-key",
      workingDirectory: "/test",
    });

    expect(agent.getConfig().auth.type).toBe("api-key");
  });

  it("should use default provider and model when not specified", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      apiKey: "test-key",
      workingDirectory: "/test",
    });

    expect(agent.getConfig().provider).toBe("anthropic");
    expect(agent.getConfig().model).toBe("claude-sonnet-4-20250514");
  });

  it("should pass maxTokens from options with skipConfigLoad", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      apiKey: "test-key",
      workingDirectory: "/test",
      maxTokens: 4096,
    });

    expect(agent.getConfig().maxTokens).toBe(4096);
  });

  it("should pass temperature from options with skipConfigLoad", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      apiKey: "test-key",
      workingDirectory: "/test",
      temperature: 0.8,
    });

    expect(agent.getConfig().temperature).toBe(0.8);
  });

  it("should pass both maxTokens and temperature with skipConfigLoad", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      apiKey: "test-key",
      workingDirectory: "/test",
      maxTokens: 16384,
      temperature: 0.3,
    });

    expect(agent.getConfig().maxTokens).toBe(16384);
    expect(agent.getConfig().temperature).toBe(0.3);
  });

  it("should have undefined maxTokens when not provided with skipConfigLoad", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      apiKey: "test-key",
      workingDirectory: "/test",
    });

    expect(agent.getConfig().maxTokens).toBeUndefined();
  });

  it("should have undefined temperature when not provided with skipConfigLoad", async () => {
    const agent = await Agent.create({
      skipConfigLoad: true,
      apiKey: "test-key",
      workingDirectory: "/test",
    });

    expect(agent.getConfig().temperature).toBeUndefined();
  });
});

describe("createAgent helper", () => {
  it("should export createAgent function", async () => {
    const { createAgent } = await import("../agent.js");
    expect(typeof createAgent).toBe("function");
  });
});

describe("Agent prompt and agent loop", () => {
  let createProviderMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get access to the mocked createProvider
    const llmModule = await import("../llm/index.js");
    createProviderMock = llmModule.createProvider as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should emit user.message event when prompt is called", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Hello!" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const events: AgentEvent[] = [];
    agent.on("event", (event) => events.push(event));

    await agent.prompt("Hello");

    expect(events.some(e => e.type === "user.message")).toBe(true);
    const userEvent = events.find(e => e.type === "user.message");
    expect((userEvent as any).content).toBe("Hello");
  });

  it("should emit message.start event when generating response", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Response" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const events: AgentEvent[] = [];
    agent.on("event", (event) => events.push(event));

    await agent.prompt("Test");

    expect(events.some(e => e.type === "message.start")).toBe(true);
  });

  it("should emit message.delta events during streaming", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Hello world" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const events: AgentEvent[] = [];
    agent.on("event", (event) => events.push(event));

    await agent.prompt("Test");

    const deltaEvents = events.filter(e => e.type === "message.delta");
    expect(deltaEvents.length).toBeGreaterThan(0);
  });

  it("should emit message.complete event when response finishes", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Done" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const events: AgentEvent[] = [];
    agent.on("event", (event) => events.push(event));

    await agent.prompt("Test");

    expect(events.some(e => e.type === "message.complete")).toBe(true);
    const completeEvent = events.find(e => e.type === "message.complete");
    expect((completeEvent as any).content).toBe("Done");
  });

  it("should add user message to messages array", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Response" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    await agent.prompt("Hello there");

    const messages = agent.getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Hello there");
  });

  it("should return assistant message from prompt", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "I am the assistant" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const response = await agent.prompt("Who are you?");

    expect(response.role).toBe("assistant");
    expect(response.content).toBe("I am the assistant");
  });

  it("should add assistant message to messages array", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Assistant here" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    await agent.prompt("Test");

    const messages = agent.getMessages();
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Assistant here");
  });

  it("should emit tool.start event when tool is called", async () => {
    const toolCall: ToolCall = {
      id: "call_123",
      name: "mcp_todoread",
      arguments: {},
    };
    
    const mockProvider = createToolCallingProvider([toolCall]);
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const events: AgentEvent[] = [];
    agent.on("event", (event) => events.push(event));

    await agent.prompt("Read my todos");

    expect(events.some(e => e.type === "tool.start")).toBe(true);
    const toolStartEvent = events.find(e => e.type === "tool.start");
    expect((toolStartEvent as any).toolCall.name).toBe("mcp_todoread");
  });

  it("should emit tool.complete event when tool finishes", async () => {
    const toolCall: ToolCall = {
      id: "call_123",
      name: "mcp_todoread",
      arguments: {},
    };
    
    const mockProvider = createToolCallingProvider([toolCall]);
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const events: AgentEvent[] = [];
    agent.on("event", (event) => events.push(event));

    await agent.prompt("Read my todos");

    expect(events.some(e => e.type === "tool.complete")).toBe(true);
  });

  it("should handle unknown tool gracefully", async () => {
    const toolCall: ToolCall = {
      id: "call_123",
      name: "nonexistent_tool",
      arguments: {},
    };
    
    const mockProvider = createToolCallingProvider([toolCall]);
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const events: AgentEvent[] = [];
    agent.on("event", (event) => events.push(event));

    await agent.prompt("Call unknown tool");

    const toolCompleteEvent = events.find(e => e.type === "tool.complete");
    expect(toolCompleteEvent).toBeDefined();
    expect((toolCompleteEvent as any).toolResult.isError).toBe(true);
    expect((toolCompleteEvent as any).toolResult.result).toContain("Unknown tool");
  });

  it("should preserve conversation history across prompts", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [
        { content: "First response" },
        { content: "Second response" },
      ],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    await agent.prompt("First message");
    await agent.prompt("Second message");

    const messages = agent.getMessages();
    expect(messages.length).toBe(4);
    expect(messages[0].content).toBe("First message");
    expect(messages[1].content).toBe("First response");
    expect(messages[2].content).toBe("Second message");
    expect(messages[3].content).toBe("Second response");
  });

  it("should assign unique IDs to messages", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Response" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    await agent.prompt("Test");

    const messages = agent.getMessages();
    expect(messages[0].id).toBeDefined();
    expect(messages[1].id).toBeDefined();
    expect(messages[0].id).not.toBe(messages[1].id);
  });

  it("should set createdAt timestamps on messages", async () => {
    const mockProvider = createMockLLMProvider({
      responses: [{ content: "Response" }],
    });
    createProviderMock.mockReturnValue(mockProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    const before = Date.now();
    await agent.prompt("Test");
    const after = Date.now();

    const messages = agent.getMessages();
    expect(messages[0].createdAt).toBeGreaterThanOrEqual(before);
    expect(messages[0].createdAt).toBeLessThanOrEqual(after);
  });

  it("should detect loop when same tool called repeatedly", async () => {
    // Create a provider that always returns the same tool call
    const toolCall: ToolCall = {
      id: "call_loop",
      name: "mcp_todoread",
      arguments: {},
    };
    
    let callCount = 0;
    const loopingProvider = createMockLLMProvider({
      streamImpl: async (_params) => {
        callCount++;
        // Always return the same tool call (would create infinite loop)
        return {
          stream: createMockStream([{ type: "tool_call", toolCall }]),
          response: Promise.resolve({ content: "", toolCalls: [toolCall] }),
        };
      },
    });
    createProviderMock.mockReturnValue(loopingProvider);

    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      workingDirectory: "/test",
    });

    // Should throw loop detection error
    await expect(agent.prompt("Loop test")).rejects.toThrow("Agent stuck in loop");
  });
});
