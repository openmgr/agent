# OpenMgr Agent

A modular, extensible AI coding assistant built as a monorepo of composable packages.

## Features

- **Multi-Provider Support** - Works with Anthropic Claude, OpenAI, Google AI, Groq, xAI, and OpenRouter
- **Plugin Architecture** - Extend functionality with plugins for tools, providers, and more
- **MCP Integration** - Connect to Model Context Protocol servers for extended capabilities
- **LSP Support** - Language Server Protocol integration for code intelligence
- **Semantic Memory** - Local vector embeddings for context-aware assistance
- **Session Management** - Persistent conversation history with SQLite storage
- **Context Compaction** - Automatic summarization to handle long conversations
- **Skills System** - Reusable instruction sets for common tasks

## Quick Start

### Installation

```bash
# Install globally
npm install -g @openmgr/agent

# Or use with npx
npx @openmgr/agent
```

### Configuration

Create a configuration file at `~/.config/openmgr/agent.json`:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514"
}
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

Or use OAuth authentication:

```bash
openmgr-agent auth login
```

### Basic Usage

```bash
# Start interactive REPL
openmgr-agent repl

# Run with a prompt
openmgr-agent prompt "Explain this codebase"

# Start HTTP server
openmgr-agent serve --port 3000
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `repl` | Start interactive REPL session |
| `prompt <text>` | Run a single prompt |
| `serve` | Start HTTP API server |
| `auth login` | Authenticate with OAuth |
| `auth logout` | Clear stored credentials |
| `config show` | Display current configuration |
| `config set <key> <value>` | Set a configuration value |
| `session list` | List stored sessions |
| `session show <id>` | Show session details |
| `models list` | List available models |
| `skill list` | List available skills |
| `mcp list` | List MCP server connections |
| `db path` | Show database location |

## Programmatic Usage

```typescript
import { createAgent } from "@openmgr/agent";

const agent = await createAgent({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  workingDirectory: process.cwd(),
});

const result = await agent.run("What files are in this directory?");
console.log(result.response);
```

## Project Structure

This is a monorepo containing the following packages:

| Package | Description |
|---------|-------------|
| `@openmgr/agent` | Meta-package that re-exports all functionality |
| `@openmgr/agent-core` | Core agent, types, plugins, MCP, skills, compaction |
| `@openmgr/agent-providers` | LLM provider implementations |
| `@openmgr/agent-tools` | Pure code tools (todo, phase, web) |
| `@openmgr/agent-tools-terminal` | Terminal tools (bash, read, write, edit, glob, grep) |
| `@openmgr/agent-database` | SQLite database layer with Drizzle ORM |
| `@openmgr/agent-storage` | Session and message management |
| `@openmgr/agent-memory` | Vector memory with local embeddings |
| `@openmgr/agent-auth-anthropic` | Anthropic OAuth authentication |
| `@openmgr/agent-skills-bundled` | Built-in skills collection |
| `@openmgr/agent-lsp` | Language Server Protocol support |
| `@openmgr/agent-server` | HTTP server (Hono-based) |
| `@openmgr/agent-cli` | Command-line interface |

See [docs/packages.md](docs/packages.md) for detailed package documentation.

## Configuration

Configuration is loaded from multiple sources in order of priority:

1. Programmatic overrides
2. Local config (`.openmgr.json` in project directory)
3. Global config (`~/.config/openmgr/agent.json`)
4. Environment variables (for API keys)
5. Built-in defaults

See [docs/configuration.md](docs/configuration.md) for the complete configuration reference.

## HTTP API

When running the server with `openmgr-agent serve`, the following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/healthz` | GET | Health check |
| `/readyz` | GET | Readiness check |
| `/beta/status` | GET | Agent status and configuration |
| `/beta/conversations` | GET | List conversations |
| `/beta/conversations/:id` | GET | Get conversation details |
| `/beta/conversations/:id/messages` | GET | Get conversation messages |
| `/beta/conversations/:id` | DELETE | Delete a conversation |

## Development

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/openmgr/agent.git
cd agent

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Package Development

```bash
# Build a specific package
pnpm --filter @openmgr/agent-core build

# Run tests for a package
pnpm --filter @openmgr/agent-core test

# Watch mode for development
pnpm --filter @openmgr/agent-core dev
```

## License

MIT
