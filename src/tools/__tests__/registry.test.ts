import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import type { ToolDefinition, ToolContext } from "../../types.js";

// Create a fresh registry for testing (don't use the singleton)
class TestToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register<TParams>(tool: ToolDefinition<TParams>): void {
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  toLLMTools(filter?: string[]) {
    const tools = filter
      ? filter.map((name) => this.tools.get(name)).filter(Boolean)
      : this.getAll();

    return (tools as ToolDefinition[]).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

describe("ToolRegistry", () => {
  let registry: TestToolRegistry;

  beforeEach(() => {
    registry = new TestToolRegistry();
  });

  const mockTool: ToolDefinition<{ input: string }> = {
    name: "mock-tool",
    description: "A mock tool for testing",
    parameters: z.object({
      input: z.string(),
    }),
    async execute(params, _ctx) {
      return { output: `Received: ${params.input}`, metadata: {} };
    },
  };

  const anotherTool: ToolDefinition<{ value: number }> = {
    name: "another-tool",
    description: "Another mock tool",
    parameters: z.object({
      value: z.number(),
    }),
    async execute(params, _ctx) {
      return { output: `Value: ${params.value}`, metadata: {} };
    },
  };

  describe("register", () => {
    it("should register a tool", () => {
      registry.register(mockTool);
      expect(registry.get("mock-tool")).toBe(mockTool);
    });

    it("should overwrite existing tool with same name", () => {
      registry.register(mockTool);
      const newTool = { ...mockTool, description: "Updated description" };
      registry.register(newTool);
      expect(registry.get("mock-tool")?.description).toBe("Updated description");
    });

    it("should register multiple tools", () => {
      registry.register(mockTool);
      registry.register(anotherTool);
      expect(registry.getNames()).toHaveLength(2);
    });
  });

  describe("unregister", () => {
    it("should remove a registered tool", () => {
      registry.register(mockTool);
      const result = registry.unregister("mock-tool");
      expect(result).toBe(true);
      expect(registry.get("mock-tool")).toBeUndefined();
    });

    it("should return false for non-existent tool", () => {
      const result = registry.unregister("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("get", () => {
    it("should return registered tool", () => {
      registry.register(mockTool);
      expect(registry.get("mock-tool")).toBe(mockTool);
    });

    it("should return undefined for non-existent tool", () => {
      expect(registry.get("non-existent")).toBeUndefined();
    });
  });

  describe("getAll", () => {
    it("should return empty array when no tools registered", () => {
      expect(registry.getAll()).toEqual([]);
    });

    it("should return all registered tools", () => {
      registry.register(mockTool);
      registry.register(anotherTool);
      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(mockTool);
      expect(all).toContain(anotherTool);
    });
  });

  describe("getNames", () => {
    it("should return empty array when no tools registered", () => {
      expect(registry.getNames()).toEqual([]);
    });

    it("should return all tool names", () => {
      registry.register(mockTool);
      registry.register(anotherTool);
      expect(registry.getNames()).toEqual(
        expect.arrayContaining(["mock-tool", "another-tool"])
      );
    });
  });

  describe("toLLMTools", () => {
    it("should convert all tools to LLM format", () => {
      registry.register(mockTool);
      registry.register(anotherTool);
      const llmTools = registry.toLLMTools();
      expect(llmTools).toHaveLength(2);
      expect(llmTools[0]).toHaveProperty("name");
      expect(llmTools[0]).toHaveProperty("description");
      expect(llmTools[0]).toHaveProperty("parameters");
      expect(llmTools[0]).not.toHaveProperty("execute");
    });

    it("should filter tools by name", () => {
      registry.register(mockTool);
      registry.register(anotherTool);
      const llmTools = registry.toLLMTools(["mock-tool"]);
      expect(llmTools).toHaveLength(1);
      expect(llmTools[0].name).toBe("mock-tool");
    });

    it("should ignore non-existent tools in filter", () => {
      registry.register(mockTool);
      const llmTools = registry.toLLMTools(["mock-tool", "non-existent"]);
      expect(llmTools).toHaveLength(1);
    });

    it("should return empty array when filter matches nothing", () => {
      registry.register(mockTool);
      const llmTools = registry.toLLMTools(["non-existent"]);
      expect(llmTools).toHaveLength(0);
    });
  });
});
