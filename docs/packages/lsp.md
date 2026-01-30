# @openmgr/agent-lsp

Language Server Protocol (LSP) integration for OpenMgr Agent. This package enables language intelligence features like diagnostics, code analysis, and more by managing multiple language server processes.

## Installation

```bash
pnpm add @openmgr/agent-lsp
```

## Overview

The LSP package provides:
- Multi-language server management
- Automatic language detection from file extensions
- Workspace-aware server initialization
- Real-time diagnostics streaming
- Support for 60+ programming languages

## Usage

### Basic Usage

```typescript
import { LspManager } from "@openmgr/agent-lsp";

const manager = new LspManager({
  workingDirectory: "/path/to/project",
});

// Open a file (auto-starts appropriate language server)
await manager.openFile("src/index.ts");

// Get diagnostics for a file
const diagnostics = await manager.getDiagnostics("src/index.ts");

for (const diag of diagnostics) {
  console.log(`${diag.severity} at ${diag.file}:${diag.line}:${diag.column}`);
  console.log(`  ${diag.message}`);
}

// Listen for diagnostic updates
manager.on("diagnostics", (uri, diagnostics) => {
  console.log(`Diagnostics for ${uri}:`, diagnostics);
});

// Update file content after edits
await manager.updateFile("src/index.ts", newContent);

// Save file
await manager.saveFile("src/index.ts");

// Close file
await manager.closeFile("src/index.ts");

// Shutdown all servers
await manager.shutdown();
```

### Custom Configuration

```typescript
const manager = new LspManager({
  workingDirectory: "/path/to/project",
  debug: true,
  config: {
    typescript: {
      command: "typescript-language-server",
      args: ["--stdio"],
      rootPatterns: ["tsconfig.json"],
    },
    python: {
      disabled: true, // Disable Python LSP
    },
    custom: {
      command: "my-custom-lsp",
      args: ["--mode", "stdio"],
      env: { DEBUG: "true" },
    },
  },
});
```

## Supported Features

### Text Document Features

- **Document Synchronization** - Open, change, save, close notifications
- **Diagnostics** - Error, warning, info, and hint diagnostics
- **Completion** - Code completion with documentation
- **Hover** - Hover information in plaintext or markdown
- **Definition** - Go to definition
- **References** - Find all references
- **Document Symbols** - Hierarchical document symbols
- **Code Actions** - Code action support

### Workspace Features

- Workspace folders support
- Configuration support
- Watched files notifications

## Default Language Servers

| Language | Command | Root Patterns |
|----------|---------|---------------|
| TypeScript | `typescript-language-server --stdio` | tsconfig.json, jsconfig.json, package.json |
| JavaScript | `typescript-language-server --stdio` | jsconfig.json, package.json |
| Go | `gopls` | go.mod, go.work |
| Python | `pyright-langserver --stdio` | pyproject.toml, setup.py, requirements.txt |
| Rust | `rust-analyzer` | Cargo.toml |

## Supported Languages

The package supports 60+ file extensions including:

- **Web**: TypeScript, JavaScript, HTML, CSS, Vue, Svelte, Astro
- **Backend**: Python, Go, Rust, Ruby, Java, C#, PHP
- **Systems**: C, C++, Zig, Swift, Kotlin
- **Functional**: Haskell, OCaml, F#, Clojure, Elixir, Scala
- **Data**: JSON, YAML, TOML, XML, SQL, GraphQL
- **Scripting**: Shell, Lua, Perl, R
- **Documentation**: Markdown, reStructuredText

## Architecture

The package has three main layers:

### LspTransport

Handles low-level JSON-RPC message encoding/decoding over stdio:

```typescript
import { LspTransport } from "@openmgr/agent-lsp";

const transport = new LspTransport(process.stdin, process.stdout);
transport.sendRequest("textDocument/definition", params);
```

### LspClient

Manages a single language server process:

```typescript
import { LspClient } from "@openmgr/agent-lsp";

const client = new LspClient({
  command: "typescript-language-server",
  args: ["--stdio"],
  rootUri: "file:///path/to/project",
});

await client.initialize();
client.on("diagnostics", (uri, diagnostics) => {
  // Handle diagnostics
});
```

### LspManager

Coordinates multiple language server clients:

```typescript
import { LspManager } from "@openmgr/agent-lsp";

const manager = new LspManager({
  workingDirectory: "/path/to/project",
});
```

## Events

### LspManager Events

```typescript
manager.on("diagnostics", (uri: string, diagnostics: FormattedDiagnostic[]) => {
  // Diagnostics received for a file
});

manager.on("server.started", (language: string) => {
  // Language server started
});

manager.on("server.stopped", (language: string) => {
  // Language server stopped
});

manager.on("server.error", (language: string, error: Error) => {
  // Language server error
});
```

### LspClient Events

```typescript
client.on("diagnostics", (uri: string, diagnostics: Diagnostic[]) => {
  // Raw diagnostics from server
});

client.on("initialized", () => {
  // Server initialization complete
});

client.on("error", (error: Error) => {
  // Client error
});

client.on("close", () => {
  // Server process closed
});
```

## API Reference

### FormattedDiagnostic

```typescript
interface FormattedDiagnostic {
  file: string;         // Relative file path
  line: number;         // 1-based line number
  column: number;       // 1-based column number
  endLine: number;
  endColumn: number;
  severity: "error" | "warning" | "info" | "hint";
  message: string;
  source?: string;      // Diagnostic source (e.g., "typescript")
  code?: string | number;
}
```

### LspServerConfig

```typescript
interface LspServerConfig {
  command: string;      // Server command
  args?: string[];      // Command arguments
  env?: Record<string, string>;  // Environment variables
  rootPatterns?: string[];  // Files indicating workspace root
  disabled?: boolean;   // Disable this server
}
```

### LspConfig

```typescript
type LspConfig = Record<string, LspServerConfig>;
```

### Diagnostic (LSP Protocol)

```typescript
interface Diagnostic {
  range: Range;
  message: string;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  relatedInformation?: DiagnosticRelatedInformation[];
}

enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}
```

## Exports

```typescript
// Main Classes
export { LspClient, type LspClientOptions, type LspClientEvents } from "./client.js";
export { LspManager, type LspManagerOptions, type LspManagerEvents, type LspConfig, type LspServerConfig, type FormattedDiagnostic } from "./manager.js";
export { LspTransport } from "./transport.js";

// Types
export {
  type Diagnostic,
  type DiagnosticSeverity,
  type Position,
  type Range,
  type Location,
  type ServerCapabilities,
  type LanguageServerConfig,
} from "./types.js";

// Utilities
export {
  getLanguageId,
  LANGUAGE_IDS,
  DEFAULT_LANGUAGE_SERVERS,
} from "./types.js";
```

## Language Detection

Use `getLanguageId()` to detect language from file path:

```typescript
import { getLanguageId, LANGUAGE_IDS } from "@openmgr/agent-lsp";

getLanguageId("src/index.ts");     // "typescript"
getLanguageId("main.go");          // "go"
getLanguageId("app.py");           // "python"
getLanguageId("Cargo.toml");       // "toml"

// All supported language IDs
console.log(LANGUAGE_IDS);
```

## Best Practices

1. **Reuse LspManager**: Create one manager per project and reuse it
2. **Handle Events**: Subscribe to diagnostic events for real-time updates
3. **Close Files**: Call `closeFile()` when done to free resources
4. **Graceful Shutdown**: Always call `shutdown()` when finished
5. **Check Server Availability**: Not all language servers may be installed
