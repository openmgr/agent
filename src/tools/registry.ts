import type { ToolDefinition, LLMTool } from "../types.js";

class ToolRegistry {
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

  toLLMTools(filter?: string[]): LLMTool[] {
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

export const registry = new ToolRegistry();

export function defineTool<TParams>(
  definition: ToolDefinition<TParams>
): ToolDefinition<TParams> {
  registry.register(definition);
  return definition;
}
