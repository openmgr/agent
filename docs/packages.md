# Packages Overview

OpenMgr Agent is organized as a monorepo with modular packages that can be used independently or together.

## Package Hierarchy

```
@openmgr/agent (meta-package)
├── @openmgr/agent-core
├── @openmgr/agent-providers
├── @openmgr/agent-tools
├── @openmgr/agent-tools-terminal
├── @openmgr/agent-database
├── @openmgr/agent-storage
├── @openmgr/agent-memory
├── @openmgr/agent-auth-anthropic
├── @openmgr/agent-skills-bundled
├── @openmgr/agent-lsp
├── @openmgr/agent-server
└── @openmgr/agent-cli
```

## Core Packages

### @openmgr/agent

The main meta-package that re-exports all functionality from other packages. This is the recommended package to install for most use cases.

```bash
npm install @openmgr/agent
```

```typescript
import { createAgent, bashTool, storagePlugin } from "@openmgr/agent";
```

### @openmgr/agent-core

The foundation of the agent system. Contains:

- **Agent class** - Main agent orchestration
- **Plugin system** - Extensibility framework
- **Tool registry** - Tool definition and management
- **Provider registry** - LLM provider management
- **MCP support** - Model Context Protocol client
- **Skills system** - Skill loading and execution
- **Compaction** - Context window management
- **Configuration** - Config loading and resolution

```typescript
import { 
  Agent, 
  createAgent,
  definePlugin,
  defineTool,
  McpManager,
  SkillManager,
  CompactionEngine 
} from "@openmgr/agent-core";
```

### @openmgr/agent-providers

LLM provider implementations for:

- **Anthropic** (Claude models)
- **OpenAI** (GPT models)
- **Google** (Gemini models)
- **OpenRouter** (Multi-provider gateway)
- **Groq** (Fast inference)
- **xAI** (Grok models)

```typescript
import { 
  AnthropicProvider,
  OpenAIProvider,
  GoogleProvider,
  createProvider 
} from "@openmgr/agent-providers";
```

See [providers documentation](./packages/providers.md) for detailed API reference.

## Tool Packages

### @openmgr/agent-tools

Pure code tools that don't require system access:

| Tool | Description |
|------|-------------|
| `todoReadTool` | Read the current todo list |
| `todoWriteTool` | Update the todo list |
| `phaseReadTool` | Read task phases |
| `phaseWriteTool` | Update task phases |
| `webFetchTool` | Fetch web content |
| `webSearchTool` | Search the web |
| `skillTool` | Load and use skills |

```typescript
import { todoReadTool, webFetchTool, toolsPlugin } from "@openmgr/agent-tools";
```

### @openmgr/agent-tools-terminal

System tools that interact with the filesystem and terminal:

| Tool | Description |
|------|-------------|
| `bashTool` | Execute shell commands |
| `readTool` | Read file contents |
| `writeTool` | Write files |
| `editTool` | Edit files with search/replace |
| `globTool` | Find files by pattern |
| `grepTool` | Search file contents |

```typescript
import { bashTool, readTool, editTool, toolsTerminalPlugin } from "@openmgr/agent-tools-terminal";
```

## Storage Packages

### @openmgr/agent-database

Low-level SQLite database layer using Drizzle ORM:

- Schema definitions for all tables
- Database connection management
- Migration support
- In-memory database for testing

```typescript
import { 
  getDb, 
  createInMemoryDatabase,
  sessions,
  messages,
  runMigrations 
} from "@openmgr/agent-database";
```

**Tables:**
- `sessions` - Conversation sessions
- `messages` - Chat messages
- `compaction_history` - Compaction events
- `mcp_oauth_tokens` - MCP OAuth tokens
- `memory_entries` - Vector memory entries
- `anthropic_tokens` - Anthropic OAuth tokens

### @openmgr/agent-storage

Session and message management built on top of the database:

```typescript
import { 
  SessionManager,
  storagePlugin,
  type CreateSessionOptions 
} from "@openmgr/agent-storage";

const manager = new SessionManager(db);
const session = await manager.createSession({
  workingDirectory: "/path/to/project",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
});
```

### @openmgr/agent-memory

Vector memory storage with local embeddings for semantic search:

```typescript
import { 
  MemoryStorage,
  memoryPlugin,
  memoryAddTool,
  memorySearchTool 
} from "@openmgr/agent-memory";

const memory = new MemoryStorage("/path/to/project");
await memory.create({
  content: "Important fact about the codebase",
  scope: "/src/components",
  tags: ["architecture", "components"],
});

const results = await memory.search({
  query: "component architecture",
  limit: 5,
});
```

See [memory documentation](./packages/memory.md) for detailed API reference.

## Authentication

### @openmgr/agent-auth-anthropic

OAuth authentication for Anthropic's API:

```typescript
import { 
  login,
  isLoggedIn,
  getValidAccessToken,
  createOAuthFetch 
} from "@openmgr/agent-auth-anthropic";

// Start OAuth flow
const result = await login();

// Check authentication status
if (await isLoggedIn()) {
  const token = await getValidAccessToken();
}

// Create authenticated fetch
const oauthFetch = await createOAuthFetch();
```

## Skills

### @openmgr/agent-skills-bundled

Collection of built-in skills:

| Skill | Description |
|-------|-------------|
| `code-review` | Review code for issues and improvements |
| `debug` | Debug code problems |
| `document` | Generate documentation |
| `explain` | Explain code functionality |
| `git-commit` | Create commit messages |
| `refactor` | Suggest refactoring improvements |
| `security` | Security analysis |
| `test` | Generate test cases |

```typescript
import { 
  skillsBundledPlugin,
  bundledSkills,
  getBundledSkillPath 
} from "@openmgr/agent-skills-bundled";
```

## Server

### @openmgr/agent-server

HTTP server built with Hono:

```typescript
import { createServer, startServer, serverPlugin } from "@openmgr/agent-server";

const app = createServer({ agent, sessions });
const server = await startServer(app, { port: 3000 });
```

**Endpoints:**
- `GET /healthz` - Health check
- `GET /readyz` - Readiness check
- `GET /beta/status` - Agent status
- `GET /beta/conversations` - List conversations
- `GET /beta/conversations/:id` - Get conversation
- `GET /beta/conversations/:id/messages` - Get messages
- `DELETE /beta/conversations/:id` - Delete conversation

### @openmgr/agent-lsp

Language Server Protocol integration:

```typescript
import { 
  LspManager,
  LspClient,
  getLanguageId,
  DEFAULT_LANGUAGE_SERVERS 
} from "@openmgr/agent-lsp";

const manager = new LspManager({
  workingDirectory: "/path/to/project",
  servers: {
    typescript: {
      command: "typescript-language-server",
      args: ["--stdio"],
    },
  },
});

await manager.start();
const diagnostics = await manager.getDiagnostics("/path/to/file.ts");
```

See [LSP documentation](./packages/lsp.md) for detailed API reference.

## CLI

### @openmgr/agent-cli

Command-line interface implementation:

```typescript
import { registerAllCommands, Spinner, DebugLogger } from "@openmgr/agent-cli";
```

## Using Packages Individually

Each package can be installed and used independently:

```bash
# Install only core functionality
npm install @openmgr/agent-core

# Install specific tools
npm install @openmgr/agent-tools-terminal

# Install storage layer
npm install @openmgr/agent-database @openmgr/agent-storage
```

## Plugin System

Most packages expose a plugin for easy integration:

```typescript
import { createAgent } from "@openmgr/agent-core";
import { providersPlugin } from "@openmgr/agent-providers";
import { toolsPlugin } from "@openmgr/agent-tools";
import { toolsTerminalPlugin } from "@openmgr/agent-tools-terminal";
import { storagePlugin } from "@openmgr/agent-storage";
import { memoryPlugin } from "@openmgr/agent-memory";

const agent = await createAgent({ ... });

// Register plugins
await agent.use(providersPlugin());
await agent.use(toolsPlugin());
await agent.use(toolsTerminalPlugin());
await agent.use(storagePlugin());
await agent.use(memoryPlugin({ projectRoot: process.cwd() }));
```

## Package Dependencies

```
@openmgr/agent-database
       ↑
@openmgr/agent-storage
       ↑
@openmgr/agent-server

@openmgr/agent-core
       ↑
├── @openmgr/agent-providers
├── @openmgr/agent-tools
├── @openmgr/agent-tools-terminal
├── @openmgr/agent-skills-bundled
├── @openmgr/agent-lsp
└── @openmgr/agent-cli
```
