# @openmgr/agent-database

The database package provides the SQLite database layer using Drizzle ORM. It contains schema definitions, connection management, and migrations.

## Installation

```bash
npm install @openmgr/agent-database
```

## Quick Start

```typescript
import { getDb, createInMemoryDatabase, sessions, messages } from "@openmgr/agent-database";
import { eq } from "drizzle-orm";

// Get the default database connection
const db = getDb();

// Query sessions
const allSessions = await db.select().from(sessions).all();

// Insert a new session
await db.insert(sessions).values({
  id: "session-1",
  workingDirectory: "/path/to/project",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

## Database Connection

### Default Connection

```typescript
import { getDb, closeDb, getDbPath, getDefaultDbPath } from "@openmgr/agent-database";

// Get the default database (creates if not exists)
// Location: ~/.config/openmgr/agent.db
const db = getDb();

// Get with custom path
const db = getDb({ path: "/custom/path/agent.db" });

// Close the connection
closeDb();

// Get current database path
const path = getDbPath();

// Get default path
const defaultPath = getDefaultDbPath();
```

### Custom Connection

```typescript
import { createDatabase, createInMemoryDatabase } from "@openmgr/agent-database";

// Create a custom database
const { db, sqlite, close } = createDatabase({
  path: "/custom/path/agent.db",
  verbose: true,  // Log SQL queries
});

// Use the database
const sessions = await db.select().from(sessions).all();

// Close when done
close();

// Create an in-memory database (for testing)
const { db, close } = createInMemoryDatabase();
```

## Schema

### Sessions Table

Stores conversation sessions.

```typescript
import { sessions, type SessionRow, type SessionInsert } from "@openmgr/agent-database";
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | `TEXT` | Primary key |
| `parent_id` | `TEXT` | Parent session ID (for forking) |
| `working_directory` | `TEXT` | Working directory path |
| `title` | `TEXT` | Session title |
| `provider` | `TEXT` | LLM provider name |
| `model` | `TEXT` | Model identifier |
| `system_prompt` | `TEXT` | Custom system prompt |
| `compaction_enabled` | `INTEGER` | Compaction enabled flag |
| `compaction_model` | `TEXT` | Model for compaction |
| `compaction_token_threshold` | `INTEGER` | Token threshold |
| `compaction_inception_count` | `INTEGER` | Inception message count |
| `compaction_working_window_count` | `INTEGER` | Working window size |
| `token_estimate` | `INTEGER` | Estimated token count |
| `message_count` | `INTEGER` | Total message count |
| `created_at` | `INTEGER` | Creation timestamp |
| `updated_at` | `INTEGER` | Last update timestamp |

### Messages Table

Stores chat messages.

```typescript
import { messages, type MessageRow, type MessageInsert } from "@openmgr/agent-database";
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | `TEXT` | Primary key |
| `session_id` | `TEXT` | Foreign key to sessions |
| `role` | `TEXT` | "user" or "assistant" |
| `content` | `TEXT` | Message content |
| `tool_calls` | `TEXT` | JSON array of tool calls |
| `tool_results` | `TEXT` | JSON array of tool results |
| `is_compaction_summary` | `INTEGER` | Is a compaction summary |
| `is_inception` | `INTEGER` | Is an inception message |
| `token_count` | `INTEGER` | Token count for message |
| `sequence` | `INTEGER` | Message sequence number |
| `created_at` | `INTEGER` | Creation timestamp |

### Compaction History Table

Tracks compaction operations.

```typescript
import { compactionHistory, type CompactionHistoryRow } from "@openmgr/agent-database";
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | `TEXT` | Primary key |
| `session_id` | `TEXT` | Foreign key to sessions |
| `summary` | `TEXT` | Generated summary |
| `edited_summary` | `TEXT` | User-edited summary |
| `original_tokens` | `INTEGER` | Tokens before compaction |
| `compacted_tokens` | `INTEGER` | Tokens after compaction |
| `messages_pruned` | `INTEGER` | Messages removed |
| `from_sequence` | `INTEGER` | Start sequence |
| `to_sequence` | `INTEGER` | End sequence |
| `created_at` | `INTEGER` | Compaction timestamp |

### MCP OAuth Tokens Table

Stores OAuth tokens for MCP servers.

```typescript
import { mcpOAuthTokens, type McpOAuthTokenRow } from "@openmgr/agent-database";
```

| Column | Type | Description |
|--------|------|-------------|
| `server_name` | `TEXT` | Primary key (server name) |
| `access_token` | `TEXT` | OAuth access token |
| `refresh_token` | `TEXT` | OAuth refresh token |
| `token_type` | `TEXT` | Token type (default: Bearer) |
| `expires_at` | `INTEGER` | Token expiration |
| `scopes` | `TEXT` | Granted scopes |
| `created_at` | `INTEGER` | Creation timestamp |
| `updated_at` | `INTEGER` | Update timestamp |

### Memory Entries Table

Stores vector embeddings for semantic search.

```typescript
import { memoryEntries, type MemoryEntryRow } from "@openmgr/agent-database";
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | `TEXT` | Primary key |
| `session_id` | `TEXT` | Associated session (optional) |
| `content` | `TEXT` | Memory content |
| `embedding` | `BLOB` | Vector embedding |
| `type` | `TEXT` | "conversation", "fact", "note", "code" |
| `metadata` | `TEXT` | JSON metadata |
| `created_at` | `INTEGER` | Creation timestamp |
| `updated_at` | `INTEGER` | Update timestamp |

### Anthropic Tokens Table

Stores Anthropic OAuth tokens.

```typescript
import { anthropicTokens, type AnthropicTokenRow } from "@openmgr/agent-database";
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | `TEXT` | Primary key (default: "default") |
| `access_token` | `TEXT` | OAuth access token |
| `refresh_token` | `TEXT` | OAuth refresh token |
| `expires_at` | `INTEGER` | Token expiration |
| `created_at` | `INTEGER` | Creation timestamp |
| `updated_at` | `INTEGER` | Update timestamp |

## Queries

### Using Drizzle ORM

```typescript
import { getDb, sessions, messages } from "@openmgr/agent-database";
import { eq, desc, and } from "drizzle-orm";

const db = getDb();

// Select all sessions
const allSessions = await db.select().from(sessions).all();

// Select with conditions
const recentSessions = await db
  .select()
  .from(sessions)
  .orderBy(desc(sessions.updatedAt))
  .limit(10)
  .all();

// Select with join
const sessionWithMessages = await db
  .select()
  .from(sessions)
  .leftJoin(messages, eq(sessions.id, messages.sessionId))
  .where(eq(sessions.id, "session-1"))
  .all();

// Insert
await db.insert(sessions).values({
  id: "new-session",
  workingDirectory: "/path",
  provider: "anthropic",
  model: "claude-sonnet-4",
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Update
await db
  .update(sessions)
  .set({ title: "New Title", updatedAt: new Date() })
  .where(eq(sessions.id, "session-1"));

// Delete
await db.delete(sessions).where(eq(sessions.id, "session-1"));
```

## Migrations

### Running Migrations

```typescript
import { runMigrations, initializeDatabase } from "@openmgr/agent-database";

// Run migrations with default database
const result = await runMigrations();

// Run migrations with custom path
const result = await runMigrations("/custom/path/agent.db");

// Initialize database (runs migrations)
const result = await initializeDatabase();

console.log(result.success);
console.log(result.message);
```

### CLI Migration

```bash
# From package directory
pnpm db:migrate

# Or using tsx
npx tsx src/migrate.ts
```

## Types

### Row Types (Select)

```typescript
import type {
  SessionRow,
  MessageRow,
  CompactionHistoryRow,
  McpOAuthTokenRow,
  MemoryEntryRow,
  AnthropicTokenRow,
} from "@openmgr/agent-database";
```

### Insert Types

```typescript
import type {
  SessionInsert,
  MessageInsert,
  CompactionHistoryInsert,
  McpOAuthTokenInsert,
  MemoryEntryInsert,
  AnthropicTokenInsert,
} from "@openmgr/agent-database";
```

### Embedded Types

```typescript
import type { ToolCallData, ToolResultData } from "@openmgr/agent-database";

interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResultData {
  toolCallId: string;
  content: string;
  isError?: boolean;
}
```

## Testing

Use in-memory database for testing:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { createInMemoryDatabase, sessions } from "@openmgr/agent-database";

describe("My Tests", () => {
  let testDb: ReturnType<typeof createInMemoryDatabase>;

  afterEach(() => {
    testDb?.close();
  });

  it("should work with database", async () => {
    testDb = createInMemoryDatabase();
    const { db } = testDb;

    await db.insert(sessions).values({
      id: "test-session",
      workingDirectory: "/test",
      provider: "anthropic",
      model: "claude-sonnet-4",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db.select().from(sessions).all();
    expect(result).toHaveLength(1);
  });
});
```

## Database Configuration

### DatabaseConfig

```typescript
interface DatabaseConfig {
  /** Path to the SQLite database file */
  path?: string;
  /** Enable verbose SQL logging */
  verbose?: boolean;
}
```

### Default Locations

| Type | Path |
|------|------|
| Config Directory | `~/.config/openmgr/` |
| Database File | `~/.config/openmgr/agent.db` |
| Migrations | `<package>/drizzle/` |
