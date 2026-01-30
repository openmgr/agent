# @openmgr/agent-tools & @openmgr/agent-tools-terminal

These packages provide tools for the agent to interact with the environment.

## Packages

- **@openmgr/agent-tools** - Pure code tools (no system access required)
- **@openmgr/agent-tools-terminal** - Terminal and filesystem tools

## Installation

```bash
# Pure tools only
npm install @openmgr/agent-tools

# Terminal tools
npm install @openmgr/agent-tools-terminal

# Both
npm install @openmgr/agent-tools @openmgr/agent-tools-terminal
```

## Pure Tools (@openmgr/agent-tools)

### Todo Tools

Manage a task list during agent execution.

```typescript
import { todoReadTool, todoWriteTool } from "@openmgr/agent-tools";

// Register with agent
agent.registerTool(todoReadTool);
agent.registerTool(todoWriteTool);
```

**todoReadTool** - Read the current todo list
- No parameters required
- Returns current todo items with status

**todoWriteTool** - Update the todo list
- Parameters:
  - `todos`: Array of todo items with `id`, `content`, `status`, `priority`

### Phase Tools

Track execution phases for complex tasks.

```typescript
import { phaseReadTool, phaseWriteTool } from "@openmgr/agent-tools";
```

**phaseReadTool** - Read current phases
**phaseWriteTool** - Update phases

### Web Tools

Fetch and search web content.

```typescript
import { webFetchTool, webSearchTool } from "@openmgr/agent-tools";
```

**webFetchTool** - Fetch content from a URL
- Parameters:
  - `url`: URL to fetch
  - `format`: "text", "markdown", or "html"
- Returns: Page content in requested format

**webSearchTool** - Search the web
- Parameters:
  - `query`: Search query
  - `limit`: Maximum results
- Returns: Search results with titles and URLs

### Skill Tool

Load and display skills.

```typescript
import { skillTool } from "@openmgr/agent-tools";
```

**skillTool** - Load a skill
- Parameters:
  - `name`: Skill name to load
- Returns: Skill content and metadata

### Plugin

Register all pure tools at once:

```typescript
import { toolsPlugin } from "@openmgr/agent-tools";

await agent.use(toolsPlugin());
```

## Terminal Tools (@openmgr/agent-tools-terminal)

### Bash Tool

Execute shell commands.

```typescript
import { bashTool } from "@openmgr/agent-tools-terminal";
```

**bashTool** - Execute a bash command
- Parameters:
  - `command`: Command to execute
  - `description`: Short description of what the command does
  - `workdir`: Working directory (optional)
  - `timeout`: Timeout in milliseconds (optional)
- Returns: Command output (stdout/stderr)

Example:
```json
{
  "command": "git status",
  "description": "Check git repository status"
}
```

### Read Tool

Read file contents.

```typescript
import { readTool } from "@openmgr/agent-tools-terminal";
```

**readTool** - Read a file
- Parameters:
  - `filePath`: Absolute path to the file
  - `offset`: Line number to start from (optional)
  - `limit`: Number of lines to read (optional)
- Returns: File contents with line numbers

Example:
```json
{
  "filePath": "/path/to/file.ts",
  "limit": 100
}
```

### Write Tool

Write files.

```typescript
import { writeTool } from "@openmgr/agent-tools-terminal";
```

**writeTool** - Write a file
- Parameters:
  - `filePath`: Absolute path for the file
  - `content`: Content to write
- Returns: Success confirmation

Example:
```json
{
  "filePath": "/path/to/file.ts",
  "content": "const x = 1;"
}
```

### Edit Tool

Edit files with search and replace.

```typescript
import { editTool } from "@openmgr/agent-tools-terminal";
```

**editTool** - Edit a file
- Parameters:
  - `filePath`: Absolute path to the file
  - `oldString`: Text to find
  - `newString`: Replacement text
  - `replaceAll`: Replace all occurrences (optional)
- Returns: Success confirmation

Example:
```json
{
  "filePath": "/path/to/file.ts",
  "oldString": "const x = 1;",
  "newString": "const x = 2;"
}
```

### Glob Tool

Find files by pattern.

```typescript
import { globTool } from "@openmgr/agent-tools-terminal";
```

**globTool** - Find files matching a pattern
- Parameters:
  - `pattern`: Glob pattern (e.g., `**/*.ts`)
  - `path`: Directory to search in (optional)
- Returns: List of matching file paths

Example:
```json
{
  "pattern": "src/**/*.test.ts"
}
```

### Grep Tool

Search file contents.

```typescript
import { grepTool } from "@openmgr/agent-tools-terminal";
```

**grepTool** - Search for pattern in files
- Parameters:
  - `pattern`: Regex pattern to search for
  - `path`: Directory to search in (optional)
  - `include`: File pattern filter (optional)
- Returns: Matching files with line numbers

Example:
```json
{
  "pattern": "TODO|FIXME",
  "include": "*.ts"
}
```

### Plugin

Register all terminal tools at once:

```typescript
import { toolsTerminalPlugin } from "@openmgr/agent-tools-terminal";

await agent.use(toolsTerminalPlugin());
```

## Creating Custom Tools

### Tool Definition

```typescript
import { defineTool } from "@openmgr/agent-core";

const myTool = defineTool({
  name: "my-tool",
  description: "Description shown to the agent",
  parameters: {
    type: "object",
    properties: {
      input: {
        type: "string",
        description: "Input parameter",
      },
      options: {
        type: "object",
        properties: {
          flag: { type: "boolean" },
        },
      },
    },
    required: ["input"],
  },
  
  async execute(params, context) {
    // params.input, params.options
    // context.workingDirectory, context.agent
    
    const result = await doSomething(params.input);
    
    return {
      success: true,
      data: result,
    };
  },
});
```

### Tool Context

The `context` object provides:

```typescript
interface ToolContext {
  workingDirectory: string;    // Current working directory
  agent: AgentInterface;       // Agent instance
  session: Session;            // Current session
  abortSignal?: AbortSignal;   // For cancellation
}
```

### Error Handling

```typescript
async execute(params, context) {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
```

### Registering Tools

```typescript
// Register on agent
agent.registerTool(myTool);

// Or use the registry
import { toolRegistry } from "@openmgr/agent-core";
toolRegistry.register(myTool);
```

## Tool Best Practices

1. **Clear Descriptions** - Provide detailed descriptions for tools and parameters
2. **Validation** - Validate parameters before use
3. **Error Messages** - Return helpful error messages
4. **Working Directory** - Use `context.workingDirectory` for file operations
5. **Idempotency** - Make tools idempotent where possible
6. **Timeouts** - Respect timeout settings for long operations

## Available Tools Summary

### Pure Tools

| Tool | Description |
|------|-------------|
| `todoReadTool` | Read current todo list |
| `todoWriteTool` | Update todo list |
| `phaseReadTool` | Read execution phases |
| `phaseWriteTool` | Update execution phases |
| `webFetchTool` | Fetch web page content |
| `webSearchTool` | Search the web |
| `skillTool` | Load a skill |

### Terminal Tools

| Tool | Description |
|------|-------------|
| `bashTool` | Execute shell commands |
| `readTool` | Read file contents |
| `writeTool` | Write files |
| `editTool` | Edit files (search/replace) |
| `globTool` | Find files by pattern |
| `grepTool` | Search file contents |
