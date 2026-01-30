import { vi } from "vitest";
import { EventEmitter } from "eventemitter3";
import type { McpTool } from "../../mcp/types.js";

/**
 * Mock MCP tool definition
 */
export function createMockMcpTool(
  name: string,
  options: {
    description?: string;
    serverName?: string;
    inputSchema?: Record<string, unknown>;
  } = {}
): McpTool {
  return {
    name,
    description: options.description ?? `Mock tool ${name}`,
    serverName: options.serverName ?? "mock-server",
    inputSchema: options.inputSchema ?? {
      type: "object",
      properties: {},
    },
  };
}

/**
 * Mock MCP client interface
 */
export interface MockMcpClient {
  name: string;
  connected: boolean;
  tools: McpTool[];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  listTools: () => Promise<McpTool[]>;
  callTool: (toolName: string, args: unknown) => Promise<{ result: string }>;
}

/**
 * Create a mock MCP client
 */
export function createMockMcpClient(
  name: string,
  tools: McpTool[] = []
): MockMcpClient {
  const client: MockMcpClient = {
    name,
    connected: false,
    tools,
    connect: async () => {
      client.connected = true;
    },
    disconnect: async () => {
      client.connected = false;
    },
    listTools: async () => tools,
    callTool: async (toolName: string, _args: unknown) => {
      return { result: `Mock result for ${toolName}` };
    },
  };

  return client;
}

/**
 * Mock MCP Manager
 */
export class MockMcpManager extends EventEmitter {
  private servers = new Map<string, MockMcpClient>();
  private allTools: McpTool[] = [];

  async addServer(name: string, _config: unknown): Promise<void> {
    const client = createMockMcpClient(name, [
      createMockMcpTool(`${name}_tool1`, { serverName: name }),
      createMockMcpTool(`${name}_tool2`, { serverName: name }),
    ]);
    await client.connect();
    this.servers.set(name, client);
    this.allTools.push(...client.tools);
    this.emit("server.connected", name, client.tools.length);
  }

  async removeServer(name: string): Promise<void> {
    const client = this.servers.get(name);
    if (client) {
      await client.disconnect();
      this.allTools = this.allTools.filter(t => t.serverName !== name);
      this.servers.delete(name);
      this.emit("server.disconnected", name, "removed");
    }
  }

  getServers() {
    return Array.from(this.servers.entries()).map(([name, client]) => ({
      name,
      connected: client.connected,
      transport: "mock" as const,
      toolCount: client.tools.length,
    }));
  }

  getTools(): McpTool[] {
    return this.allTools;
  }

  async callTool(serverName: string, toolName: string, args: unknown) {
    const client = this.servers.get(serverName);
    if (!client) {
      throw new Error(`Server not found: ${serverName}`);
    }
    return client.callTool(toolName, args);
  }

  async loadFromConfig(config: Record<string, unknown>): Promise<void> {
    for (const name of Object.keys(config)) {
      await this.addServer(name, config[name]);
    }
  }

  async shutdown(): Promise<void> {
    for (const [name] of this.servers) {
      await this.removeServer(name);
    }
  }
}

/**
 * Create a mock MCP Manager instance
 */
export function createMockMcpManager(): MockMcpManager {
  return new MockMcpManager();
}
