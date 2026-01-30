/**
 * Integration test to verify core and providers work together
 */
import { describe, it, expect, vi } from "vitest";
import { Agent, providerRegistry, toolRegistry, defineTool } from "../src/index.js";
import { providersPlugin, AnthropicProvider } from "@openmgr/agent-providers";
import { z } from "zod";

describe("Core + Providers Integration", () => {
  it("should register providers via plugin", async () => {
    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
    });

    // Register the providers plugin
    await agent.use(providersPlugin);

    // Verify providers are registered
    expect(providerRegistry.has("anthropic")).toBe(true);
    expect(providerRegistry.has("openai")).toBe(true);
    expect(providerRegistry.has("google")).toBe(true);
    expect(providerRegistry.has("openrouter")).toBe(true);
    expect(providerRegistry.has("groq")).toBe(true);
    expect(providerRegistry.has("xai")).toBe(true);
  });

  it("should create provider instances from registry", () => {
    // First register providers
    for (const provider of providersPlugin.providers!) {
      if (!providerRegistry.has(provider.name)) {
        providerRegistry.register(provider);
      }
    }

    const anthropic = providerRegistry.create("anthropic", {
      apiKey: "test-key",
    });
    expect(anthropic).toBeInstanceOf(AnthropicProvider);
  });

  it("should register and use custom tools", async () => {
    const mockExecute = vi.fn().mockResolvedValue({ output: "Hello, World!" });

    const greetTool = defineTool({
      name: "greet",
      description: "Greet a person",
      parameters: z.object({
        name: z.string().describe("Name to greet"),
      }),
      execute: mockExecute,
    });

    toolRegistry.register(greetTool);
    expect(toolRegistry.has("greet")).toBe(true);

    const tool = toolRegistry.get("greet");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("greet");

    // Execute the tool
    const result = await tool!.execute(
      { name: "Alice" },
      { workingDirectory: "/tmp", extensions: {} }
    );
    expect(result.output).toBe("Hello, World!");
    expect(mockExecute).toHaveBeenCalledWith(
      { name: "Alice" },
      expect.objectContaining({ workingDirectory: "/tmp" })
    );

    // Cleanup
    toolRegistry.unregister("greet");
  });

  it("should convert tools to LLM format", () => {
    const testTool = defineTool({
      name: "test_tool",
      description: "A test tool",
      parameters: z.object({
        input: z.string(),
      }),
      execute: async () => ({ output: "done" }),
    });

    toolRegistry.register(testTool);

    const llmTools = toolRegistry.toLLMTools(["test_tool"]);
    expect(llmTools).toHaveLength(1);
    expect(llmTools[0].name).toBe("test_tool");
    expect(llmTools[0].description).toBe("A test tool");

    toolRegistry.unregister("test_tool");
  });

  it("should handle agent configuration", () => {
    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
      systemPrompt: "You are a helpful assistant.",
      workingDirectory: "/test/dir",
    });

    const config = agent.getConfig();
    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-sonnet-4-20250514");
    expect(config.systemPrompt).toBe("You are a helpful assistant.");
    expect(config.workingDirectory).toBe("/test/dir");
  });

  it("should manage messages", () => {
    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
    });

    expect(agent.getMessages()).toHaveLength(0);

    agent.setMessages([
      { id: "1", role: "user", content: "Hello", createdAt: Date.now() },
      { id: "2", role: "assistant", content: "Hi!", createdAt: Date.now() },
    ]);

    expect(agent.getMessages()).toHaveLength(2);

    agent.clearMessages();
    expect(agent.getMessages()).toHaveLength(0);
  });

  it("should manage todos", () => {
    const agent = new Agent({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      auth: { type: "api-key", apiKey: "test-key" },
    });

    expect(agent.getTodos()).toHaveLength(0);

    agent.setTodos([
      { id: "1", content: "Task 1", status: "pending", priority: "high" },
      { id: "2", content: "Task 2", status: "in_progress", priority: "medium" },
    ]);

    expect(agent.getTodos()).toHaveLength(2);

    agent.clearTodos();
    expect(agent.getTodos()).toHaveLength(0);
  });
});

describe("Provider Types", () => {
  it("should export all provider types", async () => {
    const { 
      AnthropicProvider, 
      OpenAIProvider, 
      GoogleProvider,
      OpenRouterProvider,
      GroqProvider,
      XAIProvider,
      createProvider,
    } = await import("@openmgr/agent-providers");

    expect(AnthropicProvider).toBeDefined();
    expect(OpenAIProvider).toBeDefined();
    expect(GoogleProvider).toBeDefined();
    expect(OpenRouterProvider).toBeDefined();
    expect(GroqProvider).toBeDefined();
    expect(XAIProvider).toBeDefined();
    expect(createProvider).toBeDefined();
  });

  it("should create provider via factory function", async () => {
    const { createProvider, AnthropicProvider } = await import("@openmgr/agent-providers");

    const provider = createProvider("anthropic", { apiKey: "test" });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });
});
