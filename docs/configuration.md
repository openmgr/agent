# Configuration Reference

This document describes all configuration options for OpenMgr Agent.

## Configuration Files

### File Locations

| Type | Path | Description |
|------|------|-------------|
| Global | `~/.config/openmgr/agent.json` | User-wide configuration |
| Local | `.openmgr.json` | Project-specific configuration |

Local configuration is searched from the working directory upward to the filesystem root.

### Resolution Order

Configuration values are resolved in this priority order (highest to lowest):

1. **Programmatic overrides** - Options passed to `createAgent()` or `loadConfig()`
2. **Local config** - `.openmgr.json` in the project directory
3. **Global config** - `~/.config/openmgr/agent.json`
4. **Environment variables** - For API keys only
5. **Built-in defaults**

For `mcp` and `lsp` configurations, global and local configs are merged (local takes precedence for same-named servers).

## Environment Variables

### API Keys

| Variable | Provider | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | anthropic | API key for Anthropic/Claude |
| `OPENAI_API_KEY` | openai | API key for OpenAI |
| `GOOGLE_API_KEY` | google | API key for Google AI |
| `OPENROUTER_API_KEY` | openrouter | API key for OpenRouter |
| `GROQ_API_KEY` | groq | API key for Groq |
| `XAI_API_KEY` | xai | API key for xAI |

## Config File Schema

### Basic Configuration

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "systemPrompt": "You are a helpful coding assistant.",
  "maxTokens": 4096,
  "temperature": 0.7
}
```

### Full Configuration

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "systemPrompt": "You are a helpful coding assistant.",
  "maxTokens": 4096,
  "temperature": 0.7,
  "tools": ["bash", "read", "write", "edit", "glob", "grep"],
  "apiKeys": {
    "anthropic": "sk-ant-...",
    "openai": "sk-..."
  },
  "mcp": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
      "enabled": true
    }
  },
  "lsp": {
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"]
    }
  }
}
```

## Configuration Options

### Core Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `provider` | `string` | `"anthropic"` | LLM provider name |
| `model` | `string` | `"claude-sonnet-4-20250514"` | Model identifier |
| `systemPrompt` | `string` | (built-in) | Custom system prompt |
| `maxTokens` | `number` | - | Maximum tokens for responses |
| `temperature` | `number` | - | Temperature (0-2) for responses |
| `tools` | `string[]` | - | Array of tool names to enable |

### Provider Names

| Provider | Value | Description |
|----------|-------|-------------|
| Anthropic | `"anthropic"` | Claude models |
| OpenAI | `"openai"` | GPT models |
| Google | `"google"` | Gemini models |
| OpenRouter | `"openrouter"` | Multi-provider gateway |
| Groq | `"groq"` | Fast inference |
| xAI | `"xai"` | Grok models |

### API Keys

API keys can be configured in two ways:

**Simple string:**
```json
{
  "apiKeys": {
    "anthropic": "sk-ant-..."
  }
}
```

**Auth config object:**
```json
{
  "apiKeys": {
    "anthropic": {
      "type": "api-key",
      "apiKey": "sk-ant-..."
    }
  }
}
```

For OAuth authentication:
```json
{
  "apiKeys": {
    "anthropic": {
      "type": "oauth"
    }
  }
}
```

## MCP Server Configuration

### Stdio Transport (Default)

```json
{
  "mcp": {
    "server-name": {
      "transport": "stdio",
      "command": "command-to-run",
      "args": ["arg1", "arg2"],
      "env": {
        "KEY": "value",
        "EXPANDED": "${HOME}/path"
      },
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `transport` | `"stdio"` | `"stdio"` | Transport type |
| `command` | `string` | (required) | Command to run |
| `args` | `string[]` | `[]` | Command arguments |
| `env` | `object` | - | Environment variables (supports `${VAR}` expansion) |
| `enabled` | `boolean` | `true` | Whether server is enabled |
| `timeout` | `number` | `30000` | Connection timeout in ms |

### SSE Transport

```json
{
  "mcp": {
    "remote-server": {
      "transport": "sse",
      "url": "https://example.com/sse",
      "headers": {
        "Authorization": "Bearer token"
      },
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `transport` | `"sse"` | (required) | Transport type |
| `url` | `string` | (required) | SSE endpoint URL |
| `headers` | `object` | - | HTTP headers |
| `oauth` | `object` | - | OAuth configuration |
| `enabled` | `boolean` | `true` | Whether server is enabled |
| `timeout` | `number` | `30000` | Connection timeout in ms |

### MCP OAuth Configuration

```json
{
  "mcp": {
    "oauth-server": {
      "transport": "sse",
      "url": "https://example.com/sse",
      "oauth": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret",
        "authorizationUrl": "https://example.com/auth",
        "tokenUrl": "https://example.com/token",
        "scopes": ["read", "write"]
      }
    }
  }
}
```

## LSP Server Configuration

```json
{
  "lsp": {
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"],
      "env": {
        "TSC_NONPOLLING_WATCHER": "true"
      },
      "rootPatterns": ["tsconfig.json", "package.json"],
      "disabled": false
    }
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `command` | `string` | - | Command to run the LSP server |
| `args` | `string[]` | - | Command arguments |
| `env` | `object` | - | Environment variables |
| `rootPatterns` | `string[]` | - | Patterns to detect project root |
| `disabled` | `boolean` | `false` | Disable this LSP server |

### Default LSP Servers

The following LSP servers are configured by default:

| Language | Server |
|----------|--------|
| TypeScript/JavaScript | `typescript-language-server` |
| Python | `pylsp` |
| Rust | `rust-analyzer` |
| Go | `gopls` |

## Compaction Configuration

Context compaction can be configured programmatically:

```typescript
const agent = await createAgent({
  compaction: {
    enabled: true,
    tokenThreshold: 0.8,
    inceptionCount: 4,
    workingWindowCount: 10,
    summaryMaxTokens: 2000,
    autoCompact: true,
    allowSummaryEdit: true
  }
});
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable compaction |
| `tokenThreshold` | `number` | `0.8` | Token usage threshold (0-1) |
| `messageThreshold` | `number` | - | Optional message count threshold |
| `inceptionCount` | `number` | `4` | Initial messages to preserve |
| `workingWindowCount` | `number` | `10` | Recent messages to preserve |
| `summaryMaxTokens` | `number` | `2000` | Max tokens for summary |
| `model` | `string` | - | Model for summarization |
| `autoCompact` | `boolean` | `true` | Auto-compact when threshold reached |
| `allowSummaryEdit` | `boolean` | `true` | Allow editing the summary |

### Model Token Limits

| Model | Token Limit |
|-------|-------------|
| `claude-sonnet-4-20250514` | 200,000 |
| `claude-3-5-sonnet-20241022` | 200,000 |
| `claude-3-opus-20240229` | 200,000 |
| `gpt-4o` | 128,000 |
| `gpt-4-turbo` | 128,000 |
| `gpt-4` | 8,192 |
| `gpt-3.5-turbo` | 16,385 |
| Default (unknown) | 100,000 |

## Skills Configuration

### Skill Locations

Skills are loaded from these locations in order of priority:

| Source | Location | Priority |
|--------|----------|----------|
| Local | `<workingDirectory>/.openmgr/skills/` | Highest |
| Global | `~/.config/openmgr/skills/` | Medium |
| Bundled | Built-in with the package | Lowest |

Local skills override global skills with the same name.

### Skill Directory Structure

```
.openmgr/skills/
└── my-skill/
    ├── skill.md          # Skill definition (required)
    └── templates/        # Optional templates
        └── component.tsx
```

## CLI Configuration

### Set Configuration

```bash
# Set global configuration
openmgr-agent config set provider openai
openmgr-agent config set model gpt-4o
openmgr-agent config set maxTokens 4096

# Set local (project) configuration
openmgr-agent config set model gpt-4 --local
```

### View Configuration

```bash
# Show current configuration
openmgr-agent config show

# Show as JSON
openmgr-agent config show --json

# Get specific value
openmgr-agent config get provider

# Show config file paths
openmgr-agent config path
```

### Edit Configuration

```bash
# Open global config in editor
openmgr-agent config edit

# Open local config in editor
openmgr-agent config edit --local
```

## Programmatic Configuration

```typescript
import { createAgent, loadConfig } from "@openmgr/agent";

// Load and use config
const config = await loadConfig(process.cwd());

// Create agent with overrides
const agent = await createAgent({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKey: process.env.ANTHROPIC_API_KEY,
  workingDirectory: process.cwd(),
  maxTokens: 4096,
  temperature: 0.7,
  tools: ["bash", "read", "write"],
});
```

## Examples

### Minimal Configuration

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514"
}
```

### Multi-Provider Setup

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "apiKeys": {
    "anthropic": "sk-ant-...",
    "openai": "sk-...",
    "google": "..."
  }
}
```

### With MCP Servers

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "mcp": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Project-Specific Configuration

`.openmgr.json` in project root:
```json
{
  "model": "gpt-4o",
  "systemPrompt": "You are a React expert. Focus on TypeScript and modern React patterns.",
  "lsp": {
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"]
    }
  }
}
```
