# @openmgr/agent-core

The core package provides the foundation for the OpenMgr Agent system, including the Agent class, plugin system, tool registry, MCP support, skills, and compaction.

## Installation

```bash
npm install @openmgr/agent-core
```

## Agent

### Creating an Agent

```typescript
import { createAgent, Agent } from "@openmgr/agent-core";

// Using the factory function (recommended)
const agent = await createAgent({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  workingDirectory: process.cwd(),
});

// Using the class directly
const agent = new Agent({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  auth: { type: "api-key", apiKey: "sk-..." },
});
```

### Running Prompts

```typescript
const result = await agent.run("What files are in this directory?");
console.log(result.response);
console.log(`Tokens: ${result.usage.inputTokens} in, ${result.usage.outputTokens} out`);
```

### Agent Options

| Option | Type | Description |
|--------|------|-------------|
| `provider` | `string` | LLM provider name |
| `model` | `string` | Model identifier |
| `apiKey` | `string` | API key for the provider |
| `systemPrompt` | `string` | Custom system prompt |
| `workingDirectory` | `string` | Working directory |
| `tools` | `string[]` | Tools to enable |
| `maxTokens` | `number` | Maximum response tokens |
| `temperature` | `number` | Temperature (0-2) |
| `mcp` | `object` | MCP server configurations |
| `compaction` | `object` | Compaction settings |
| `skipConfigLoad` | `boolean` | Skip loading config files |

## Plugin System

### Defining a Plugin

```typescript
import { definePlugin, AgentPlugin } from "@openmgr/agent-core";

const myPlugin: AgentPlugin = {
  name: "my-plugin",
  version: "1.0.0",
  
  async onRegister(agent) {
    // Called when plugin is registered
    agent.setExtension("my-plugin.data", { initialized: true });
  },
  
  async onBeforeRun(context) {
    // Called before each run
    console.log("Running with:", context.prompt);
  },
  
  async onAfterRun(context, result) {
    // Called after each run
    console.log("Response:", result.response);
  },
  
  async onShutdown() {
    // Called when agent shuts down
    console.log("Plugin shutting down");
  },
};

// Register the plugin
await agent.use(myPlugin);
```

### Using definePlugin Helper

```typescript
const myPlugin = definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  async onRegister(agent) {
    // ...
  },
});
```

### Plugin Lifecycle

1. `onRegister(agent)` - Plugin initialization
2. `onBeforeRun(context)` - Before each prompt
3. `onAfterRun(context, result)` - After each prompt
4. `onShutdown()` - Agent shutdown

## Tool Registry

### Defining a Tool

```typescript
import { defineTool, toolRegistry } from "@openmgr/agent-core";

const myTool = defineTool({
  name: "my-tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "Input value" },
    },
    required: ["input"],
  },
  
  async execute(params, context) {
    const result = await doSomething(params.input);
    return { success: true, data: result };
  },
});

// Register the tool
toolRegistry.register(myTool);

// Or register on an agent
agent.registerTool(myTool);
```

### Tool Context

The `context` parameter provides:

| Property | Type | Description |
|----------|------|-------------|
| `workingDirectory` | `string` | Current working directory |
| `agent` | `AgentInterface` | Agent instance |
| `session` | `Session` | Current session |
| `abortSignal` | `AbortSignal` | Abort signal for cancellation |

## MCP (Model Context Protocol)

### MCP Manager

```typescript
import { McpManager } from "@openmgr/agent-core";

const manager = new McpManager({
  servers: {
    filesystem: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    },
  },
});

await manager.start();

// Get available tools from MCP servers
const tools = manager.getTools();

// Call a tool
const result = await manager.callTool("read_file", { path: "README.md" });

await manager.stop();
```

### MCP Clients

```typescript
import { StdioMcpClient, SseMcpClient } from "@openmgr/agent-core";

// Stdio client
const stdioClient = new StdioMcpClient({
  command: "my-server",
  args: ["--flag"],
});

// SSE client
const sseClient = new SseMcpClient({
  url: "https://example.com/sse",
  headers: { Authorization: "Bearer token" },
});
```

## Skills

### Skill Manager

```typescript
import { SkillManager } from "@openmgr/agent-core";

const manager = new SkillManager({
  workingDirectory: process.cwd(),
});

// List available skills
const skills = manager.listSkills();

// Load a skill
const skill = await manager.loadSkill("code-review");

// Execute skill
console.log(skill.content);
```

### Skill Structure

Skills are markdown files with frontmatter:

```markdown
---
name: my-skill
description: Does something useful
author: Your Name
version: 1.0.0
tags:
  - utility
  - productivity
---

# My Skill

Instructions for the agent...
```

### Skill Locations

1. Local: `.openmgr/skills/<skill-name>/skill.md`
2. Global: `~/.config/openmgr/skills/<skill-name>/skill.md`
3. Bundled: Built-in skills

## Compaction

### Compaction Engine

```typescript
import { CompactionEngine, DEFAULT_COMPACTION_CONFIG } from "@openmgr/agent-core";

const engine = new CompactionEngine({
  enabled: true,
  tokenThreshold: 0.8,
  inceptionCount: 4,
  workingWindowCount: 10,
  summaryMaxTokens: 2000,
  autoCompact: true,
});

// Check if compaction is needed
const shouldCompact = engine.shouldCompact(messages, tokenCount);

// Perform compaction
const result = await engine.compact(messages, provider);
console.log(result.summary);
console.log(`Compacted ${result.stats.messagesPruned} messages`);
```

### Compaction Config

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable compaction |
| `tokenThreshold` | `0.8` | Token usage threshold (0-1) |
| `inceptionCount` | `4` | Initial messages to keep |
| `workingWindowCount` | `10` | Recent messages to keep |
| `summaryMaxTokens` | `2000` | Max tokens for summary |
| `autoCompact` | `true` | Auto-compact on threshold |

## Configuration

### Loading Config

```typescript
import { loadConfig, loadGlobalConfig, loadLocalConfig } from "@openmgr/agent-core";

// Load merged config
const config = await loadConfig(process.cwd());

// Load global config only
const globalConfig = await loadGlobalConfig();

// Load local config only
const localConfig = await loadLocalConfig(process.cwd());
```

### Saving Config

```typescript
import { saveGlobalConfig, saveLocalConfig } from "@openmgr/agent-core";

await saveGlobalConfig({ model: "gpt-4o" });
await saveLocalConfig(process.cwd(), { temperature: 0.5 });
```

## Types

### Key Types

```typescript
import type {
  Agent,
  AgentInterface,
  AgentConfig,
  AgentPlugin,
  Message,
  MessageRole,
  ToolCall,
  ToolResult,
  ToolDefinition,
  ToolContext,
  Session,
  LLMProvider,
  LLMMessage,
  ProviderName,
} from "@openmgr/agent-core";
```

### Message Schema

```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}
```

## Events

The Agent emits events during execution:

```typescript
agent.on("tool:start", (toolName, params) => {
  console.log(`Starting tool: ${toolName}`);
});

agent.on("tool:end", (toolName, result) => {
  console.log(`Tool completed: ${toolName}`);
});

agent.on("message", (message) => {
  console.log(`Message: ${message.role}`);
});
```

## Built-in Commands

```typescript
import { registerBuiltinCommands, commandRegistry } from "@openmgr/agent-core";

// Register built-in slash commands
registerBuiltinCommands();

// Execute a command
const result = await commandRegistry.execute("/help", context);
```
