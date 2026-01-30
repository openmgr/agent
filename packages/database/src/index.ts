/**
 * @openmgr/agent-database
 * 
 * SQLite database layer with Drizzle ORM for @openmgr/agent.
 * Provides schema definitions, database connections, and migrations.
 */

// Database connection
export {
  getDb,
  closeDb,
  getDbPath,
  getDefaultDbPath,
  createDatabase,
  createInMemoryDatabase,
  schema,
  type AgentDatabase,
  type DatabaseConfig,
  type BetterSQLite3Database,
} from "./database.js";

// Schema and types
export {
  // Tables
  sessions,
  messages,
  compactionHistory,
  mcpOAuthTokens,
  memoryEntries,
  anthropicTokens,
  
  // Interfaces
  type ToolCallData,
  type ToolResultData,
  
  // Row types
  type SessionRow,
  type SessionInsert,
  type MessageRow,
  type MessageInsert,
  type CompactionHistoryRow,
  type CompactionHistoryInsert,
  type McpOAuthTokenRow,
  type McpOAuthTokenInsert,
  type MemoryEntryRow,
  type MemoryEntryInsert,
  type AnthropicTokenRow,
  type AnthropicTokenInsert,
} from "./schema.js";

// Migrations
export {
  runMigrations,
  initializeDatabase,
  type MigrationResult,
} from "./migrate.js";
