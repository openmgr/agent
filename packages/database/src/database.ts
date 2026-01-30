import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";
import * as schema from "./schema.js";

export type AgentDatabase = BetterSQLite3Database<typeof schema>;

export interface DatabaseConfig {
  /** Path to the SQLite database file. Defaults to ~/.config/openmgr/agent.db */
  path?: string;
  /** Enable verbose logging */
  verbose?: boolean;
}

const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "openmgr");
const DEFAULT_DB_PATH = join(DEFAULT_CONFIG_DIR, "agent.db");

let defaultDb: AgentDatabase | null = null;
let defaultSqlite: Database.Database | null = null;
let currentDbPath: string = DEFAULT_DB_PATH;

function ensureDirectory(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get or create the default database connection.
 * Uses ~/.config/openmgr/agent.db by default.
 */
export function getDb(config?: DatabaseConfig): AgentDatabase {
  const dbPath = config?.path ?? DEFAULT_DB_PATH;
  
  // If requesting a different path than the current connection, close the current one
  if (defaultDb && dbPath !== currentDbPath) {
    closeDb();
  }
  
  if (!defaultDb) {
    const dir = join(dbPath, "..");
    ensureDirectory(dir);
    
    defaultSqlite = new Database(dbPath, {
      verbose: config?.verbose ? console.log : undefined,
    });
    defaultDb = drizzle(defaultSqlite, { schema });
    currentDbPath = dbPath;
  }
  
  return defaultDb;
}

/**
 * Close the default database connection.
 */
export function closeDb(): void {
  if (defaultSqlite) {
    defaultSqlite.close();
    defaultSqlite = null;
    defaultDb = null;
  }
}

/**
 * Get the path to the current database file.
 */
export function getDbPath(): string {
  return currentDbPath;
}

/**
 * Get the default database path.
 */
export function getDefaultDbPath(): string {
  return DEFAULT_DB_PATH;
}

/**
 * Create a new database connection with custom configuration.
 * This does not affect the default connection.
 */
export function createDatabase(config: DatabaseConfig): {
  db: AgentDatabase;
  sqlite: Database.Database;
  close: () => void;
} {
  const dbPath = config.path ?? DEFAULT_DB_PATH;
  const dir = join(dbPath, "..");
  ensureDirectory(dir);
  
  const sqlite = new Database(dbPath, {
    verbose: config.verbose ? console.log : undefined,
  });
  const db = drizzle(sqlite, { schema });
  
  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

/**
 * Create the database schema tables directly (for in-memory or fresh databases).
 */
function createSchemaTables(sqlite: Database.Database): void {
  // Sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      working_directory TEXT NOT NULL,
      title TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT,
      compaction_enabled INTEGER DEFAULT 1,
      compaction_model TEXT,
      compaction_token_threshold INTEGER,
      compaction_inception_count INTEGER,
      compaction_working_window_count INTEGER,
      token_estimate INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_parent_idx ON sessions(parent_id);
  `);

  // Messages table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      tool_calls TEXT,
      tool_results TEXT,
      is_compaction_summary INTEGER DEFAULT 0,
      is_inception INTEGER DEFAULT 0,
      token_count INTEGER,
      sequence INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id);
    CREATE INDEX IF NOT EXISTS messages_sequence_idx ON messages(session_id, sequence);
  `);

  // Compaction history table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS compaction_history (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      edited_summary TEXT,
      original_tokens INTEGER NOT NULL,
      compacted_tokens INTEGER NOT NULL,
      messages_pruned INTEGER NOT NULL,
      from_sequence INTEGER NOT NULL,
      to_sequence INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS compaction_session_idx ON compaction_history(session_id);
  `);

  // MCP OAuth tokens table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
      server_name TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT DEFAULT 'Bearer',
      expires_at INTEGER,
      scopes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Memory entries table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      embedding BLOB,
      type TEXT NOT NULL CHECK (type IN ('conversation', 'fact', 'note', 'code')),
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS memory_session_idx ON memory_entries(session_id);
    CREATE INDEX IF NOT EXISTS memory_type_idx ON memory_entries(type);
  `);

  // Anthropic tokens table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS anthropic_tokens (
      id TEXT PRIMARY KEY DEFAULT 'default',
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

/**
 * Create an in-memory database for testing.
 * The schema tables are automatically created.
 */
export function createInMemoryDatabase(): {
  db: AgentDatabase;
  sqlite: Database.Database;
  close: () => void;
} {
  const sqlite = new Database(":memory:");
  createSchemaTables(sqlite);
  const db = drizzle(sqlite, { schema });
  
  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}

export { schema };
export type { BetterSQLite3Database };
