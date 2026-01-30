import type { ToolDefinition, LLMTool } from "../types.js";

/**
 * Registry for tool definitions.
 * Tools are registered here and can be retrieved by name.
 */
class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a tool
   */
  register<TParams>(tool: ToolDefinition<TParams>): void {
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  /**
   * Unregister a tool by name
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all registered tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Convert tools to LLM format, optionally filtering by name
   */
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

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();
