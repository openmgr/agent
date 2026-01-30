# Agent Architecture

This document describes the Agent architecture in OpenMgr Agent, including how agents are created, configured, and extended.

## Overview

The `Agent` class is the central orchestrator in OpenMgr Agent. It manages:

- LLM provider communication
- Message history and conversation state
- Tool registration and execution
- Plugin lifecycle
- MCP (Model Context Protocol) servers
- Skills loading and execution
- Conversation compaction

## Creating an Agent

### Using the Factory Method

The recommended way to create an agent is using the static `Agent.create()` method:

```typescript
import { Agent } from "@openmgr/agent-core";

const agent = await Agent.create({
  workingDirectory: process.cwd(),
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
});
```

### Configuration Options

```typescript
interface AgentOptions {
  // Working directory for file operations
  workingDirectory?: string;
  
  // LLM provider (anthropic, openai, google, openrouter, bedrock)
  provider?: string;
  
  // Model name
  model?: string;
  
  // Custom system prompt
  systemPrompt?: string;
  
  // Maximum output tokens
  maxTokens?: number;
  
  // Temperature (0-2)
  temperature?: number;
  
  // Authentication configuration
  auth?: AuthConfig;
  
  // MCP server configurations
  mcp?: Record<string, McpServerConfig>;
  
  // Skills configuration
  skills?: SkillsConfig;
  
  // Compaction configuration
  compaction?: CompactionConfig;
  
  // Skip loading config from files
  skipConfigLoad?: boolean;
}
```

### Configuration Resolution

When `Agent.create()` is called, it:

1. Resolves the working directory
2. Loads configuration from files (unless `skipConfigLoad: true`):
   - Global config: `~/.config/openmgr/config.json`
   - Local config: `.openmgr/config.json`
3. Merges with provided options (options take precedence)
4. Initializes MCP servers if configured
5. Initializes the skills system

## Agent Interface

The `AgentInterface` is a minimal interface for plugin interaction:

```typescript
interface AgentInterface {
  // Emit events
  emit(event: "event", data: AgentEvent): boolean;
  
  // Get current configuration
  getConfig(): { provider: string; model: string };
  
  // Store plugin-specific data
  setExtension(key: string, value: unknown): void;
  getExtension<T>(key: string): T | undefined;
  
  // Tool management
  registerTool(tool: ToolDefinition): void;
  getTools(): ToolDefinition[];
  getTool(name: string): ToolDefinition | undefined;
  
  // Plugin management
  registerPlugin(plugin: AgentPlugin): Promise<void>;
  
  // Run agent loop
  run(options: RunOptions): Promise<RunResult>;
}
```

## Core Methods

### Prompting

Send a message and get a response:

```typescript
const response = await agent.prompt("Hello, world!");
console.log(response.content);
```

### Streaming Responses

Listen to events for streaming:

```typescript
agent.on("event", (event) => {
  if (event.type === "message.delta") {
    process.stdout.write(event.delta);
  }
});

await agent.prompt("Tell me a story");
```

### Running with Options

For more control, use the `run()` method:

```typescript
const result = await agent.run({
  messages: [{ role: "user", content: "Hello" }],
  tools: ["read", "write", "bash"],
  maxTurns: 10,
});
```

### Aborting

Cancel an in-progress operation:

```typescript
const promise = agent.prompt("Long running task...");

// Later...
agent.abort();
```

### Shutdown

Clean up resources:

```typescript
await agent.shutdown();
```

This calls `onShutdown` for all registered plugins and disconnects MCP servers.

## Event System

The Agent emits events for all significant operations:

### Message Events

```typescript
agent.on("event", (event) => {
  switch (event.type) {
    case "user.message":
      // User sent a message
      console.log("User:", event.content);
      break;
      
    case "message.start":
      // LLM started responding
      break;
      
    case "message.delta":
      // Streaming content chunk
      process.stdout.write(event.delta);
      break;
      
    case "message.complete":
      // LLM finished responding
      console.log("Complete:", event.message);
      break;
  }
});
```

### Tool Events

```typescript
agent.on("event", (event) => {
  switch (event.type) {
    case "tool.start":
      console.log(`Calling ${event.toolCall.name}...`);
      break;
      
    case "tool.complete":
      console.log(`${event.toolResult.name}: ${event.toolResult.result}`);
      break;
  }
});
```

### All Event Types

| Event Type | Description |
|------------|-------------|
| `user.message` | User sent a message |
| `message.start` | LLM started generating |
| `message.delta` | Streaming content chunk |
| `message.complete` | LLM finished generating |
| `tool.start` | Tool execution started |
| `tool.complete` | Tool execution finished |
| `error` | Error occurred |
| `mcp.server.connected` | MCP server connected |
| `mcp.server.disconnected` | MCP server disconnected |
| `compaction.pending` | Compaction needed |
| `compaction.start` | Compaction started |
| `compaction.complete` | Compaction finished |
| `compaction.error` | Compaction failed |
| `command.result` | Slash command executed |
| `subagent.start` | Subagent spawned |
| `subagent.complete` | Subagent finished |
| `subagent.error` | Subagent failed |

## Plugin System

Plugins extend agent functionality with tools, providers, commands, and lifecycle hooks.

### Plugin Interface

```typescript
interface AgentPlugin {
  name: string;
  version?: string;
  
  // Registrations
  tools?: ToolDefinition[];
  providers?: ProviderDefinition[];
  commands?: CommandDefinition[];
  skills?: SkillSource[];
  
  // Lifecycle hooks
  onRegister?(agent: AgentInterface): void | Promise<void>;
  onBeforePrompt?(message: string, agent: AgentInterface): string | Promise<string>;
  onAfterPrompt?(response: Message, agent: AgentInterface): void | Promise<void>;
  onShutdown?(agent: AgentInterface): void | Promise<void>;
}
```

### Registering Plugins

```typescript
import { definePlugin } from "@openmgr/agent-core";

const myPlugin = definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  
  tools: [
    {
      name: "my_tool",
      description: "Does something useful",
      parameters: z.object({
        input: z.string(),
      }),
      execute: async (params) => {
        return { result: `Processed: ${params.input}` };
      },
    },
  ],
  
  async onRegister(agent) {
    console.log("Plugin registered!");
    agent.setExtension("my-plugin.initialized", true);
  },
  
  async onShutdown(agent) {
    console.log("Plugin shutting down");
  },
});

await agent.use(myPlugin);
```

### Built-in Plugins

| Plugin | Package | Description |
|--------|---------|-------------|
| `terminalPlugin` | `@openmgr/agent-tools-terminal` | Bash, file read/write/edit, glob, grep |
| `storagePlugin` | `@openmgr/agent-storage` | Session persistence |
| `memoryPlugin` | `@openmgr/agent-memory` | Vector memory |
| `serverPlugin` | `@openmgr/agent-server` | HTTP server |

### Extensions

Plugins can store data in the agent's extension map:

```typescript
// In plugin
agent.setExtension("storage.db", database);
agent.setExtension("storage.sessions", sessionManager);

// Later, access it
const db = agent.getExtension<Database>("storage.db");
```

## Tool System

### Tool Definition

```typescript
import { defineTool } from "@openmgr/agent-core";
import { z } from "zod";

const myTool = defineTool({
  name: "my_tool",
  description: "Performs a calculation",
  parameters: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
  }),
  execute: async (params, ctx) => {
    const result = params.a + params.b;
    return { result: `Sum: ${result}` };
  },
});
```

### Tool Context

Tools receive a context object with useful utilities:

```typescript
interface ToolContext {
  workingDirectory: string;
  abortSignal?: AbortSignal;
  sessionId?: string;
  
  // Todo/Phase management
  getTodos?: () => TodoItem[];
  setTodos?: (todos: TodoItem[]) => void;
  getPhases?: () => PhaseItem[];
  setPhases?: (phases: PhaseItem[]) => void;
  
  // Event emission
  emitEvent?: (event: AgentEvent) => void;
  
  // Access to managers
  getSessionManager?: () => SessionManager;
  getSkillManager?: () => SkillManager;
  getAgent?: () => Agent;
  
  // Plugin extensions
  extensions: Record<string, unknown>;
}
```

### Tool Registration

Tools can be registered directly or via plugins:

```typescript
// Direct registration
agent.registerTool(myTool);

// Via plugin
const plugin = definePlugin({
  name: "my-plugin",
  tools: [myTool],
});
await agent.use(plugin);

// Via global registry
import { toolRegistry } from "@openmgr/agent-core";
toolRegistry.register(myTool);
```

## MCP Integration

OpenMgr Agent supports the Model Context Protocol for connecting to external tool servers.

### Configuration

```typescript
const agent = await Agent.create({
  mcp: {
    filesystem: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
    },
    github: {
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN,
      },
    },
  },
});
```

### Tool Naming

MCP tools are automatically prefixed with `mcp_{serverName}_`:

```
mcp_filesystem_read_file
mcp_filesystem_write_file
mcp_github_create_issue
```

### Accessing the MCP Manager

```typescript
const mcpManager = agent.getMcpManager();

// List connected servers
const servers = mcpManager.getServers();

// Get available tools
const tools = mcpManager.getTools();

// Call a tool directly
const result = await mcpManager.callTool("mcp_filesystem_read_file", {
  path: "/some/file.txt",
});
```

## Compaction

For long conversations, the agent can summarize older messages to stay within context limits.

### Configuration

```typescript
const agent = await Agent.create({
  compaction: {
    enabled: true,
    tokenThreshold: 0.7,        // Trigger at 70% of model limit
    inceptionCount: 4,          // Keep first 4 messages
    workingWindowCount: 10,     // Keep last 10 messages
    model: "claude-sonnet-4-20250514", // Model for summarization
  },
});
```

### Events

```typescript
agent.on("event", (event) => {
  if (event.type === "compaction.complete") {
    console.log(`Compacted ${event.messagesPruned} messages`);
    console.log(`Compression ratio: ${event.compressionRatio}`);
  }
});
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Agent                                │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │ Provider │  │ Messages │  │ Config       │              │
│  └──────────┘  └──────────┘  └──────────────┘              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                Plugin System                          │   │
│  │  plugins: Map<string, AgentPlugin>                    │   │
│  │  extensions: Map<string, unknown>                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ McpManager  │  │ SkillManager │  │CompactionEngine │   │
│  └─────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Global Registries                         │
│  ┌──────────────┐ ┌────────────────┐ ┌────────────────┐    │
│  │ toolRegistry │ │providerRegistry│ │commandRegistry │    │
│  └──────────────┘ └────────────────┘ └────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Best Practices

### 1. Use the Factory Method

Always use `Agent.create()` instead of the constructor:

```typescript
// Good
const agent = await Agent.create({ ... });

// Avoid
const agent = new Agent(config);
```

### 2. Handle Events for User Feedback

Subscribe to events to provide real-time feedback:

```typescript
agent.on("event", (event) => {
  // Handle streaming, tool calls, errors, etc.
});
```

### 3. Clean Up Resources

Always call `shutdown()` when done:

```typescript
try {
  await agent.prompt("...");
} finally {
  await agent.shutdown();
}
```

### 4. Use Plugins for Extensions

Package related functionality as plugins:

```typescript
const myPlugin = definePlugin({
  name: "my-feature",
  tools: [...],
  onRegister: ...,
  onShutdown: ...,
});
```

### 5. Use Extensions for State

Store plugin state in extensions, not global variables:

```typescript
// In onRegister
agent.setExtension("my-plugin.state", initialState);

// In tool execution
const state = ctx.extensions["my-plugin.state"];
```

## Related Documentation

- [Tools](./packages/tools.md) - Built-in tool documentation
- [Configuration](./configuration.md) - Configuration options
- [Core Package](./packages/core.md) - Core package API reference
