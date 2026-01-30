# Monorepo Restructure Plan: @openmgr/agent

> **Status**: Planning Complete - Ready for Implementation  
> **Created**: January 29, 2026  
> **Version**: 1.0

## Table of Contents

1. [Overview](#overview)
2. [Goals](#goals)
3. [Package Structure](#package-structure)
4. [Package Details](#package-details)
5. [Core Architecture](#core-architecture)
6. [Plugin System](#plugin-system)
7. [Slash Command System](#slash-command-system)
8. [File Movement Map](#file-movement-map)
9. [Implementation Phases](#implementation-phases)
10. [Testing Strategy](#testing-strategy)
11. [Dependencies](#dependencies)

---

## Overview

This document outlines the plan to restructure the `@openmgr/agent` repository from a single package into a pnpm monorepo with multiple packages. The goal is to create a modular architecture where:

- **`@openmgr/agent-core`** is a capable foundation that can run in pure Node.js sandbox environments
- **Plugins** provide specific implementations (providers, tools, storage, etc.)
- **`@openmgr/agent`** is a meta-package that bundles everything for a "batteries included" experience

### Key Decisions Made

| Decision | Choice |
|----------|--------|
| Slash commands | Auto-detect in `agent.prompt()` |
| Bundled skills | Separate package (`@openmgr/agent-skills-bundled`) |
| MCP | Core feature (stays in core) |
| Background task polling | Move entirely to `tools-terminal` (uses tmux/child_process) |
| Workspace tooling | pnpm workspaces |
| Auth package naming | `@openmgr/agent-auth-anthropic` (provider-specific) |
| Initial version | `0.1.0` for all packages |

---

## Goals

### Primary Goals

1. **Modularity**: Users can install only what they need
2. **Sandboxability**: Core can run in environments without shell access (e.g., Cloudflare Workers)
3. **Extensibility**: Third-party plugins can add providers, tools, and commands
4. **Maintainability**: Clear separation of concerns

### User Experience Goals

```bash
# Full experience (current behavior)
npm install @openmgr/agent

# Minimal core for custom agents
npm install @openmgr/agent-core

# Mix and match
npm install @openmgr/agent-core @openmgr/agent-providers @openmgr/agent-tools
```

---

## Package Structure

```
packages/
├── core/                      # @openmgr/agent-core
├── providers/                 # @openmgr/agent-providers
├── tools/                     # @openmgr/agent-tools (pure code)
├── tools-terminal/            # @openmgr/agent-tools-terminal (shell required)
├── auth-anthropic/            # @openmgr/agent-auth-anthropic (OAuth)
├── storage/                   # @openmgr/agent-storage (SQLite)
├── memory/                    # @openmgr/agent-memory (embeddings)
├── lsp/                       # @openmgr/agent-lsp (language server)
├── skills-bundled/            # @openmgr/agent-skills-bundled
├── server/                    # @openmgr/agent-server (HTTP API)
├── cli/                       # @openmgr/agent-cli
├── agent/                     # @openmgr/agent (meta-package)
│
├── integration-tests/         # (not published)
└── e2e-tests/                 # (not published)
```

**Total: 12 published packages + 2 test packages**

### Package Dependency Graph

```
@openmgr/agent-core
       │
       ├─────────────────────────────────────────┬────────────────────┐
       │                                         │                    │
       ▼                                         ▼                    ▼
@openmgr/agent-providers              @openmgr/agent-tools    @openmgr/agent-auth-anthropic
       │                                         │
       │                              ┌──────────┴──────────┐
       │                              │                     │
       │                              ▼                     ▼
       │                    @openmgr/agent-storage   @openmgr/agent-tools-terminal
       │                              │
       │                              ▼
       │                    @openmgr/agent-memory
       │
       ├──────────────────────────────┼──────────────────────┐
       │                              │                      │
       ▼                              ▼                      ▼
@openmgr/agent-lsp         @openmgr/agent-skills-bundled   @openmgr/agent-server
       │                              │                      │
       └──────────────────────────────┴──────────────────────┘
                                      │
                                      ▼
                            @openmgr/agent-cli
                                      │
                                      ▼
                              @openmgr/agent
```

---

## Package Details

### 1. `@openmgr/agent-core`

**Purpose**: Capable foundation that can run in pure Node.js sandbox environments.

**What's Included**:
- Agent class (main loop, message handling, streaming)
- Tool Registry (mechanism to register/execute tools)
- Provider Registry (mechanism to register LLM providers)
- Command Registry (slash command system)
- MCP Manager (connect to MCP servers)
- Skill Manager (discover and load skills - but no bundled skills)
- Compaction Engine (context window management)
- Config loading (global/local config)
- Event system (AgentEvent)
- Types (all shared type definitions)
- In-memory state (todos, phases)

**What's NOT Included**:
- LLM provider implementations (→ `providers`)
- Tool implementations (→ `tools`, `tools-terminal`)
- Background task polling (→ `tools-terminal`)
- Session persistence (→ `storage`)
- OAuth implementations (→ `auth-anthropic`)
- Bundled skills (→ `skills-bundled`)

**Directory Structure**:
```
packages/core/src/
├── agent.ts                  # Agent class
├── types.ts                  # All type definitions
├── config.ts                 # Config loading
├── plugin.ts                 # Plugin system interfaces
│
├── registry/
│   ├── tools.ts              # Tool registry
│   ├── providers.ts          # Provider registry
│   └── commands.ts           # Slash command registry
│
├── mcp/
│   ├── manager.ts            # McpManager
│   ├── stdio-client.ts       # Stdio transport
│   ├── sse-client.ts         # SSE transport
│   ├── adapter.ts            # Register MCP tools
│   └── types.ts              # MCP types
│
├── skills/
│   ├── manager.ts            # SkillManager
│   ├── loader.ts             # Load SKILL.md files
│   └── types.ts              # Skill types
│
├── compaction/
│   ├── engine.ts             # CompactionEngine
│   ├── tokens.ts             # Token estimation
│   └── types.ts              # Compaction types
│
├── commands/
│   └── builtin.ts            # Built-in commands (/help, /model, /clear, /compact)
│
├── llm/
│   └── provider.ts           # Abstract LLMProvider interface
│
└── index.ts                  # Public exports
```

**Dependencies**:
```json
{
  "dependencies": {
    "ai": "^4.3.19",
    "zod": "^3.23.0",
    "eventemitter3": "^5.0.0",
    "yaml": "^2.8.2",
    "@modelcontextprotocol/sdk": "^1.25.2"
  }
}
```

---

### 2. `@openmgr/agent-providers`

**Purpose**: All LLM provider implementations.

**Providers**:
- Anthropic
- OpenAI
- Google
- OpenRouter
- Groq
- xAI

**Also Includes**:
- Model registry (`models.ts`)
- Model fetcher (`model-fetcher.ts`)

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*",
    "@ai-sdk/anthropic": "^1.2.12",
    "@ai-sdk/openai": "^1.2.3",
    "@ai-sdk/google": "^1.2.5",
    "@ai-sdk/xai": "^1.2.7"
  }
}
```

---

### 3. `@openmgr/agent-tools`

**Purpose**: Pure code tools that work everywhere (Node, Bun, Cloudflare Workers).

**Tools**:
| Tool | Description |
|------|-------------|
| `read` | Read file contents (fs API) |
| `write` | Write file contents (fs API) |
| `edit` | Edit files (string manipulation) |
| `glob` | File pattern matching |
| `grep` | Content search (regex on fs) |
| `web-fetch` | HTTP requests (fetch API) |
| `web-search` | Web search API calls |
| `code-search` | Code search API calls |
| `todo-read` | Read todos |
| `todo-write` | Write todos |
| `phase-read` | Read phases |
| `phase-write` | Write phases |
| `task` | Subagent spawning |
| `skill` | Skill loading |

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*",
    "glob": "^11.0.0"
  }
}
```

---

### 4. `@openmgr/agent-tools-terminal`

**Purpose**: Tools that require a shell/terminal environment.

**Tools**:
| Tool | Description |
|------|-------------|
| `bash` | Shell command execution |
| `bg-start` | Start background task (tmux) |
| `bg-status` | Check task status |
| `bg-output` | Get task output |
| `bg-cancel` | Cancel task |

**Also Includes**:
- Background task state management
- Background task poller (moved from core)
- tmux integration

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*"
  }
}
```

---

### 5. `@openmgr/agent-auth-anthropic`

**Purpose**: Custom OAuth implementation for Anthropic.

**Exports**:
- `login()`
- `clearTokens()`
- `getValidAccessToken()`
- `isLoggedIn()`
- `authPlugin` (auto-refresh tokens)

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*"
  }
}
```

---

### 6. `@openmgr/agent-storage`

**Purpose**: Session persistence with SQLite.

**Exports**:
- `SessionManager`
- `SessionStorage`
- `storagePlugin`
- Database utilities (`getDb`, `closeDb`, `schema`)
- Migrations

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*",
    "better-sqlite3": "^12.6.2",
    "drizzle-orm": "^0.45.1"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.8"
  }
}
```

---

### 7. `@openmgr/agent-memory`

**Purpose**: Semantic memory with local embeddings.

**Tools**:
- `memory-add`
- `memory-search`
- `memory-list`
- `memory-delete`

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*",
    "@openmgr/agent-storage": "workspace:*",
    "@xenova/transformers": "^2.17.2"
  }
}
```

---

### 8. `@openmgr/agent-lsp`

**Purpose**: Language Server Protocol integration.

**Exports**:
- `LspManager`
- `LspClient`
- `lspPlugin`
- `lsp-diagnostics` tool

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*"
  }
}
```

---

### 9. `@openmgr/agent-skills-bundled`

**Purpose**: The 8 bundled skills as a data package.

**Skills**:
- code-review
- debug
- documentation
- git-commit
- pr-review
- refactor
- security-review
- test-writing

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*"
  }
}
```

---

### 10. `@openmgr/agent-server`

**Purpose**: HTTP API server.

**Exports**:
- `createServer()`
- `startServer()`

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*",
    "@openmgr/agent-storage": "workspace:*",
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "@hono/node-server": "^1.13.0"
  }
}
```

---

### 11. `@openmgr/agent-cli`

**Purpose**: Command-line interface.

**Commands**:
- `auth` - Authentication commands
- `config` - Configuration commands
- `db` - Database commands
- `models` - Model listing
- `session` - Session management
- `mcp` - MCP server management
- `lsp` - LSP server management
- `compaction` - Compaction commands
- `skill` - Skill commands
- `repl` - Interactive REPL
- `prompt` - One-shot prompt
- `serve` - Start HTTP server

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*",
    "@openmgr/agent-providers": "workspace:*",
    "@openmgr/agent-tools": "workspace:*",
    "@openmgr/agent-tools-terminal": "workspace:*",
    "@openmgr/agent-storage": "workspace:*",
    "@openmgr/agent-server": "workspace:*",
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ink": "^6.6.0",
    "ink-big-text": "^2.0.0",
    "ink-box": "^1.0.0",
    "ink-gradient": "^3.0.0",
    "ink-select-input": "^6.2.0",
    "ink-spinner": "^5.0.0",
    "ink-text-input": "^6.0.0",
    "react": "^19.2.3"
  }
}
```

---

### 12. `@openmgr/agent`

**Purpose**: Meta-package that bundles everything.

**Binaries**: `openmgr-agent`, `oa`

**Dependencies**:
```json
{
  "dependencies": {
    "@openmgr/agent-core": "workspace:*",
    "@openmgr/agent-providers": "workspace:*",
    "@openmgr/agent-tools": "workspace:*",
    "@openmgr/agent-tools-terminal": "workspace:*",
    "@openmgr/agent-auth-anthropic": "workspace:*",
    "@openmgr/agent-storage": "workspace:*",
    "@openmgr/agent-memory": "workspace:*",
    "@openmgr/agent-lsp": "workspace:*",
    "@openmgr/agent-skills-bundled": "workspace:*",
    "@openmgr/agent-server": "workspace:*",
    "@openmgr/agent-cli": "workspace:*"
  }
}
```

---

## Core Architecture

### Agent Class (Simplified for Core)

The Agent class in core will be modified to:
1. Remove background task polling (moves to `tools-terminal`)
2. Add plugin system
3. Add slash command auto-detection
4. Support extension data for plugins

```typescript
// packages/core/src/agent.ts
export class Agent extends EventEmitter<AgentEvents> {
  private config: AgentConfig;
  private provider: LLMProvider | null = null;
  private messages: Message[] = [];
  private plugins: Map<string, AgentPlugin> = new Map();
  private extensions: Map<string, unknown> = new Map();
  
  // ... existing methods ...
  
  // Plugin system
  async use(plugin: AgentPlugin): Promise<void>;
  
  // Extension system (for plugins to store state)
  setExtension(key: string, value: unknown): void;
  getExtension<T>(key: string): T | undefined;
  
  // Slash command handling (auto-detect)
  async prompt(userMessage: string): Promise<Message>;
  private async handleCommand(input: string): Promise<CommandResult | null>;
}
```

### ToolContext (Simplified)

```typescript
export interface ToolContext {
  workingDirectory: string;
  abortSignal?: AbortSignal;
  sessionId?: string;
  
  // State accessors (in-memory, stays in core)
  getTodos?: () => TodoItem[];
  setTodos?: (todos: TodoItem[]) => void;
  getPhases?: () => PhaseItem[];
  setPhases?: (phases: PhaseItem[]) => void;
  
  // Event emission
  emitEvent?: (event: AgentEvent) => void;
  
  // Extension points
  getSessionManager?: () => unknown;
  getSkillManager?: () => SkillManager | null;
  
  // Plugin extension data
  extensions?: Record<string, unknown>;
}
```

---

## Plugin System

### Plugin Interface

```typescript
export interface AgentPlugin {
  name: string;
  version?: string;
  
  // What the plugin provides
  tools?: ToolDefinition[];
  providers?: ProviderDefinition[];
  commands?: CommandDefinition[];
  skills?: SkillSource[];
  
  // Lifecycle hooks
  onRegister?(agent: Agent): void | Promise<void>;
  onBeforePrompt?(message: string, agent: Agent): string | Promise<string>;
  onAfterPrompt?(response: Message, agent: Agent): void | Promise<void>;
  onShutdown?(): void | Promise<void>;
}

export interface ProviderDefinition {
  name: string;
  factory: (options: ProviderOptions) => LLMProvider;
}

export interface CommandDefinition {
  name: string;
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<CommandResult>;
}

export interface CommandContext {
  agent: Agent;
  sessionId?: string;
}

export interface CommandResult {
  output: string;
  shouldContinue?: boolean;
  transformedInput?: string;
}
```

### Helper Functions

```typescript
export function definePlugin(plugin: AgentPlugin): AgentPlugin;
export function defineTool<T>(tool: ToolDefinition<T>): ToolDefinition<T>;
export function defineProvider(provider: ProviderDefinition): ProviderDefinition;
export function defineCommand(command: CommandDefinition): CommandDefinition;
```

### Usage Examples

```typescript
// Using the full meta-package
import { createAgent } from "@openmgr/agent";
const agent = await createAgent();

// Using core with specific plugins
import { Agent } from "@openmgr/agent-core";
import { providersPlugin } from "@openmgr/agent-providers";
import { toolsPlugin } from "@openmgr/agent-tools";

const agent = await Agent.create({ skipConfigLoad: true });
await agent.use(providersPlugin());
await agent.use(toolsPlugin());
agent.setProvider("anthropic", { apiKey: "..." });

// Defining custom tools inline
import { Agent, defineTool } from "@openmgr/agent-core";

const myTool = defineTool({
  name: "greet",
  description: "Greet someone",
  parameters: z.object({ name: z.string() }),
  execute: async (params) => ({ output: `Hello, ${params.name}!` })
});

const agent = await Agent.create();
await agent.use({ name: "my-tools", tools: [myTool] });
```

---

## Slash Command System

### Auto-Detection in prompt()

```typescript
async prompt(userMessage: string): Promise<Message> {
  // Check for slash command
  if (userMessage.startsWith("/")) {
    const commandResult = await this.handleCommand(userMessage);
    if (commandResult) {
      if (!commandResult.shouldContinue) {
        return this.createCommandResponseMessage(commandResult);
      }
      userMessage = commandResult.transformedInput ?? userMessage;
    }
  }
  
  // Normal prompt flow...
}

private async handleCommand(input: string): Promise<CommandResult | null> {
  const match = input.match(/^\/(\w+)(?:\s+(.*))?$/);
  if (!match) return null;
  
  const [, name, args] = match;
  const command = commandRegistry.get(name);
  
  if (!command) return null;
  
  return command.execute(args ?? "", {
    agent: this,
    sessionId: this.sessionContext?.sessionId,
  });
}
```

### Built-in Commands (Core)

| Command | Description |
|---------|-------------|
| `/help` | List available commands |
| `/model [name]` | Get or set current model |
| `/models` | List available models |
| `/clear` | Clear conversation history |
| `/compact` | Force context compaction |

### Plugin Commands

Plugins can register additional commands:

```typescript
// In @openmgr/agent-storage
export const storageCommands = [
  defineCommand({
    name: "sessions",
    description: "List saved sessions",
    execute: async (args, ctx) => { /* ... */ }
  }),
  defineCommand({
    name: "restore",
    description: "Restore a session by ID",
    execute: async (args, ctx) => { /* ... */ }
  }),
];
```

---

## File Movement Map

### To `packages/core/`

| Current File | Destination |
|--------------|-------------|
| `src/agent.ts` | `core/src/agent.ts` (modified) |
| `src/types.ts` | `core/src/types.ts` |
| `src/config.ts` | `core/src/config.ts` |
| `src/tools/registry.ts` | `core/src/registry/tools.ts` |
| `src/mcp/manager.ts` | `core/src/mcp/manager.ts` |
| `src/mcp/stdio-client.ts` | `core/src/mcp/stdio-client.ts` |
| `src/mcp/sse-client.ts` | `core/src/mcp/sse-client.ts` |
| `src/mcp/types.ts` | `core/src/mcp/types.ts` |
| `src/mcp/index.ts` | `core/src/mcp/index.ts` |
| `src/tools/mcp-adapter.ts` | `core/src/mcp/adapter.ts` |
| `src/skills/manager.ts` | `core/src/skills/manager.ts` |
| `src/skills/loader.ts` | `core/src/skills/loader.ts` |
| `src/skills/types.ts` | `core/src/skills/types.ts` |
| `src/skills/index.ts` | `core/src/skills/index.ts` |
| `src/compaction/engine.ts` | `core/src/compaction/engine.ts` |
| `src/compaction/tokens.ts` | `core/src/compaction/tokens.ts` |
| `src/compaction/types.ts` | `core/src/compaction/types.ts` |
| `src/compaction/index.ts` | `core/src/compaction/index.ts` |
| `src/llm/provider.ts` | `core/src/llm/provider.ts` |

### To `packages/providers/`

| Current File | Destination |
|--------------|-------------|
| `src/llm/anthropic.ts` | `providers/src/anthropic.ts` |
| `src/llm/openai.ts` | `providers/src/openai.ts` |
| `src/llm/google.ts` | `providers/src/google.ts` |
| `src/llm/openrouter.ts` | `providers/src/openrouter.ts` |
| `src/llm/groq.ts` | `providers/src/groq.ts` |
| `src/llm/xai.ts` | `providers/src/xai.ts` |
| `src/llm/models.ts` | `providers/src/models.ts` |
| `src/llm/model-fetcher.ts` | `providers/src/model-fetcher.ts` |
| `src/llm/index.ts` | `providers/src/index.ts` |

### To `packages/tools/`

| Current File | Destination |
|--------------|-------------|
| `src/tools/read.ts` | `tools/src/read.ts` |
| `src/tools/write.ts` | `tools/src/write.ts` |
| `src/tools/edit.ts` | `tools/src/edit.ts` |
| `src/tools/glob.ts` | `tools/src/glob.ts` |
| `src/tools/grep.ts` | `tools/src/grep.ts` |
| `src/tools/web-fetch.ts` | `tools/src/web-fetch.ts` |
| `src/tools/web-search.ts` | `tools/src/web-search.ts` |
| `src/tools/code-search.ts` | `tools/src/code-search.ts` |
| `src/tools/todo-read.ts` | `tools/src/todo-read.ts` |
| `src/tools/todo-write.ts` | `tools/src/todo-write.ts` |
| `src/tools/phase-read.ts` | `tools/src/phase-read.ts` |
| `src/tools/phase-write.ts` | `tools/src/phase-write.ts` |
| `src/tools/task.ts` | `tools/src/task.ts` |
| `src/tools/skill.ts` | `tools/src/skill.ts` |

### To `packages/tools-terminal/`

| Current File | Destination |
|--------------|-------------|
| `src/tools/bash.ts` | `tools-terminal/src/bash.ts` |
| `src/tools/bg-start.ts` | `tools-terminal/src/bg-start.ts` |
| `src/tools/bg-status.ts` | `tools-terminal/src/bg-status.ts` |
| `src/tools/bg-output.ts` | `tools-terminal/src/bg-output.ts` |
| `src/tools/bg-cancel.ts` | `tools-terminal/src/bg-cancel.ts` |
| (from agent.ts) | `tools-terminal/src/background-tasks.ts` (polling logic) |

### To `packages/auth-anthropic/`

| Current File | Destination |
|--------------|-------------|
| `src/auth/index.ts` | `auth-anthropic/src/index.ts` |
| `src/auth/anthropic/index.ts` | `auth-anthropic/src/oauth.ts` |
| `src/auth/anthropic/oauth.ts` | `auth-anthropic/src/oauth.ts` |
| `src/auth/anthropic/fetch.ts` | `auth-anthropic/src/fetch.ts` |

### To `packages/storage/`

| Current File | Destination |
|--------------|-------------|
| `src/session/index.ts` | `storage/src/session/index.ts` |
| `src/session/storage.ts` | `storage/src/session/storage.ts` |
| `src/session/title.ts` | `storage/src/session/title.ts` |
| `src/db/index.ts` | `storage/src/db/index.ts` |
| `src/db/schema.ts` | `storage/src/db/schema.ts` |
| `src/db/migrate.ts` | `storage/src/db/migrate.ts` |

### To `packages/memory/`

| Current File | Destination |
|--------------|-------------|
| `src/memory/index.ts` | `memory/src/index.ts` |
| `src/memory/storage.ts` | `memory/src/storage.ts` |
| `src/memory/embeddings.ts` | `memory/src/embeddings.ts` |
| `src/memory/db.ts` | `memory/src/db.ts` |
| `src/memory/types.ts` | `memory/src/types.ts` |
| `src/tools/memory-add.ts` | `memory/src/tools/memory-add.ts` |
| `src/tools/memory-search.ts` | `memory/src/tools/memory-search.ts` |
| `src/tools/memory-list.ts` | `memory/src/tools/memory-list.ts` |
| `src/tools/memory-delete.ts` | `memory/src/tools/memory-delete.ts` |

### To `packages/lsp/`

| Current File | Destination |
|--------------|-------------|
| `src/lsp/index.ts` | `lsp/src/index.ts` |
| `src/lsp/manager.ts` | `lsp/src/manager.ts` |
| `src/lsp/client.ts` | `lsp/src/client.ts` |
| `src/lsp/transport.ts` | `lsp/src/transport.ts` |
| `src/lsp/types.ts` | `lsp/src/types.ts` |
| `src/tools/lsp-diagnostics.ts` | `lsp/src/tools/lsp-diagnostics.ts` |

### To `packages/skills-bundled/`

| Current File | Destination |
|--------------|-------------|
| `src/skills/bundled/code-review/SKILL.md` | `skills-bundled/skills/code-review/SKILL.md` |
| `src/skills/bundled/debug/SKILL.md` | `skills-bundled/skills/debug/SKILL.md` |
| `src/skills/bundled/documentation/SKILL.md` | `skills-bundled/skills/documentation/SKILL.md` |
| `src/skills/bundled/git-commit/SKILL.md` | `skills-bundled/skills/git-commit/SKILL.md` |
| `src/skills/bundled/pr-review/SKILL.md` | `skills-bundled/skills/pr-review/SKILL.md` |
| `src/skills/bundled/refactor/SKILL.md` | `skills-bundled/skills/refactor/SKILL.md` |
| `src/skills/bundled/security-review/SKILL.md` | `skills-bundled/skills/security-review/SKILL.md` |
| `src/skills/bundled/test-writing/SKILL.md` | `skills-bundled/skills/test-writing/SKILL.md` |

### To `packages/server/`

| Current File | Destination |
|--------------|-------------|
| `src/server/index.ts` | `server/src/index.ts` |
| `src/server/types.ts` | `server/src/types.ts` |
| `src/server/routes/*` | `server/src/routes/*` |

### To `packages/cli/`

| Current File | Destination |
|--------------|-------------|
| `src/cli.ts` | `cli/src/cli.ts` |
| `src/cli/index.ts` | `cli/src/index.ts` |
| `src/cli/utils.ts` | `cli/src/utils.ts` |
| `src/cli/commands/*` | `cli/src/commands/*` |

---

## Implementation Phases

### Phase 1: Foundation (Core + Providers)

**Goal**: Working agent with LLM support, no tools yet.

**Steps**:
1. Set up pnpm workspace structure
2. Create root `package.json` and `pnpm-workspace.yaml`
3. Create `packages/core/` with:
   - Agent class (modified - remove bg task polling)
   - Types
   - Config
   - Plugin system (new)
   - Registry system
   - MCP (moved)
   - Skills manager (moved, no bundled)
   - Compaction (moved)
   - Built-in commands (new)
4. Create `packages/providers/` with all LLM providers
5. Write basic tests
6. Verify: `core + providers` can make LLM calls

**Validation**:
```typescript
import { Agent } from "@openmgr/agent-core";
import { providersPlugin } from "@openmgr/agent-providers";

const agent = await Agent.create({ skipConfigLoad: true });
await agent.use(providersPlugin());
agent.setProvider("anthropic", { apiKey: "..." });
const response = await agent.prompt("Hello");
```

### Phase 2: Tools

**Goal**: Agent can execute file operations and web requests.

**Steps**:
1. Create `packages/tools/` with pure code tools
2. Create `packages/tools-terminal/` with:
   - bash tool
   - bg-* tools
   - Background task state management
   - Background task poller
3. Write tool tests
4. Verify: Tools execute correctly

**Validation**:
```typescript
import { Agent } from "@openmgr/agent-core";
import { providersPlugin } from "@openmgr/agent-providers";
import { toolsPlugin } from "@openmgr/agent-tools";
import { terminalToolsPlugin } from "@openmgr/agent-tools-terminal";

const agent = await Agent.create();
await agent.use(providersPlugin());
await agent.use(toolsPlugin());
await agent.use(terminalToolsPlugin());

const response = await agent.prompt("List files in current directory");
```

### Phase 3: Features

**Goal**: Add all optional features.

**Steps**:
1. Create `packages/auth-anthropic/`
2. Create `packages/storage/`
3. Create `packages/memory/`
4. Create `packages/lsp/`
5. Create `packages/skills-bundled/`
6. Write tests for each
7. Verify: Each feature works independently

### Phase 4: Interfaces

**Goal**: HTTP server and CLI work.

**Steps**:
1. Create `packages/server/`
2. Create `packages/cli/`
3. Write tests
4. Verify: Server starts, CLI commands work

### Phase 5: Bundle

**Goal**: Meta-package works as drop-in replacement.

**Steps**:
1. Create `packages/agent/` meta-package
2. Set up integration tests
3. Set up e2e tests
4. Verify: `npm install @openmgr/agent` gives same experience as before

---

## Testing Strategy

### Unit Tests (Per Package)

Each package has its own test suite in `src/__tests__/`:

```
packages/core/src/__tests__/
├── agent.test.ts
├── plugin.test.ts
├── registry/
│   ├── tools.test.ts
│   ├── providers.test.ts
│   └── commands.test.ts
├── mcp/
│   └── manager.test.ts
├── skills/
│   └── manager.test.ts
└── compaction/
    └── engine.test.ts
```

### Integration Tests

Location: `packages/integration-tests/`

| Test Suite | Packages | What It Validates |
|------------|----------|-------------------|
| `core-providers.test.ts` | core + providers | Provider registration, LLM calls |
| `core-tools.test.ts` | core + tools | Tool registration, execution |
| `core-terminal.test.ts` | core + tools-terminal | Shell execution, bg tasks |
| `core-storage.test.ts` | core + storage | Session persistence |
| `core-mcp.test.ts` | core | MCP server connection |
| `full-agent.test.ts` | agent (all) | Complete integration |

### E2E Tests

Location: `packages/e2e-tests/`

| Test | What It Validates |
|------|-------------------|
| `cli-repl.test.ts` | REPL starts and accepts input |
| `cli-prompt.test.ts` | One-shot prompt works |
| `server-api.test.ts` | HTTP API endpoints work |
| `server-sse.test.ts` | SSE streaming works |

### CI Pipeline

```yaml
name: Test

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package:
          - core
          - providers
          - tools
          - tools-terminal
          - auth-anthropic
          - storage
          - memory
          - lsp
          - skills-bundled
          - server
          - cli
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm --filter @openmgr/agent-${{ matrix.package }} test

  integration:
    needs: unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm --filter integration-tests test

  e2e:
    needs: integration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm build
      - run: pnpm --filter e2e-tests test
```

---

## Dependencies

### Root `package.json`

```json
{
  "name": "openmgr-agent-monorepo",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "clean": "pnpm -r clean"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^4.0.18",
    "@vitest/coverage-v8": "^4.0.18"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - packages/*
```

### Shared TypeScript Config

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

---

## Appendix: Background Task System (tools-terminal)

Since this is a significant piece moving from core, here's the detailed plan:

### New File: `packages/tools-terminal/src/background-tasks.ts`

```typescript
import type { Agent, BackgroundTask, AgentEvent } from "@openmgr/agent-core";
import { execSync } from "child_process";

const EXTENSION_KEY = "backgroundTasks";

interface BackgroundTaskState {
  tasks: BackgroundTask[];
  poller: NodeJS.Timeout | null;
}

export function getBackgroundTaskState(agent: Agent): BackgroundTaskState {
  let state = agent.getExtension<BackgroundTaskState>(EXTENSION_KEY);
  if (!state) {
    state = { tasks: [], poller: null };
    agent.setExtension(EXTENSION_KEY, state);
  }
  return state;
}

export function addBackgroundTask(agent: Agent, task: BackgroundTask): void {
  const state = getBackgroundTaskState(agent);
  state.tasks.push(task);
  startPoller(agent);
}

export function updateBackgroundTask(
  agent: Agent,
  id: string,
  updates: Partial<BackgroundTask>
): void {
  const state = getBackgroundTaskState(agent);
  const index = state.tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    state.tasks[index] = { ...state.tasks[index], ...updates };
  }
}

export function getBackgroundTasks(agent: Agent): BackgroundTask[] {
  return [...getBackgroundTaskState(agent).tasks];
}

function startPoller(agent: Agent): void {
  const state = getBackgroundTaskState(agent);
  if (state.poller) return;
  
  state.poller = setInterval(() => {
    pollTasks(agent);
  }, 2000);
}

function stopPoller(agent: Agent): void {
  const state = getBackgroundTaskState(agent);
  if (state.poller) {
    clearInterval(state.poller);
    state.poller = null;
  }
}

async function pollTasks(agent: Agent): Promise<void> {
  const state = getBackgroundTaskState(agent);
  const runningTasks = state.tasks.filter(t => t.status === "running");
  
  if (runningTasks.length === 0) {
    stopPoller(agent);
    return;
  }

  for (const task of runningTasks) {
    try {
      const hasSession = (() => {
        try {
          execSync(`tmux has-session -t ${task.tmuxSession} 2>/dev/null`);
          return true;
        } catch {
          return false;
        }
      })();

      if (!hasSession) {
        const exitCode = getTaskExitCode(task);
        const status = exitCode === 0 ? "completed" : "failed";
        
        updateBackgroundTask(agent, task.id, {
          status,
          completedAt: Date.now(),
          exitCode,
        });

        agent.emit("event", {
          type: status === "completed" ? "background_task.complete" : "background_task.failed",
          taskId: task.id,
          command: task.command,
          exitCode,
          onComplete: task.onComplete,
        } as AgentEvent);
      } else if (task.checkBackAt && Date.now() >= task.checkBackAt) {
        agent.emit("event", {
          type: "background_task.check_back",
          taskId: task.id,
          command: task.command,
          description: task.description,
        } as AgentEvent);
        
        updateBackgroundTask(agent, task.id, { checkBackAt: undefined });
      }
    } catch {
      continue;
    }
  }
}

function getTaskExitCode(task: BackgroundTask): number {
  try {
    const output = execSync(
      `cat /tmp/openmgr-bg-${task.id}-exit 2>/dev/null || echo "1"`,
      { encoding: "utf-8" }
    ).trim();
    return parseInt(output, 10) || 1;
  } catch {
    return 1;
  }
}

export function getBackgroundTasksSummary(agent: Agent): string {
  const state = getBackgroundTaskState(agent);
  const tasks = state.tasks.filter(
    t => t.status === "running" || t.status === "completed" || t.status === "failed"
  );
  
  if (tasks.length === 0) return "";

  const lines = tasks.map(t => {
    const elapsed = Math.round((Date.now() - t.startedAt) / 1000 / 60);
    const checkBack = t.checkBackAt 
      ? ` - check back at ${new Date(t.checkBackAt).toLocaleTimeString()}` 
      : "";
    const onComplete = t.onComplete ? `\n  onComplete: "${t.onComplete}"` : "";
    
    if (t.status === "running") {
      return `- ${t.id}: "${t.command}" (running, ${elapsed}m elapsed)${checkBack}${onComplete}`;
    } else {
      return `- ${t.id}: "${t.command}" (${t.status}, exit ${t.exitCode})${onComplete}`;
    }
  });

  return `[ACTIVE BACKGROUND TASKS]\n${lines.join("\n")}`;
}

export function shutdownBackgroundTasks(agent: Agent): void {
  stopPoller(agent);
}
```

### Plugin Integration

```typescript
// packages/tools-terminal/src/plugin.ts
import { definePlugin } from "@openmgr/agent-core";
import { bashTool } from "./bash.js";
import { bgStartTool } from "./bg-start.js";
import { bgStatusTool } from "./bg-status.js";
import { bgOutputTool } from "./bg-output.js";
import { bgCancelTool } from "./bg-cancel.js";
import { shutdownBackgroundTasks, getBackgroundTasksSummary } from "./background-tasks.js";

export const terminalToolsPlugin = definePlugin({
  name: "tools-terminal",
  version: "0.1.0",
  
  tools: [bashTool, bgStartTool, bgStatusTool, bgOutputTool, bgCancelTool],
  
  onRegister(agent) {
    // Hook into compaction to include background task summary
    const originalGetBackgroundTasksSummary = agent.getBackgroundTasksSummary?.bind(agent);
    agent.getBackgroundTasksSummary = () => {
      return getBackgroundTasksSummary(agent);
    };
  },
  
  onShutdown(agent) {
    shutdownBackgroundTasks(agent);
  },
});
```

---

## Next Steps

When ready to implement:

1. **Phase 1**: Set up workspace structure, create core and providers packages
2. **Phase 2**: Create tools and tools-terminal packages
3. **Phase 3**: Create feature packages (auth, storage, memory, lsp, skills-bundled)
4. **Phase 4**: Create server and cli packages
5. **Phase 5**: Create meta-package and test suites

Each phase should be validated before moving to the next.
