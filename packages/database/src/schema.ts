import { sqliteTable, text, integer, index, blob } from "drizzle-orm/sqlite-core";

// Sessions table - stores agent conversation sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  workingDirectory: text("working_directory").notNull(),
  title: text("title"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  systemPrompt: text("system_prompt"),
  
  compactionEnabled: integer("compaction_enabled", { mode: "boolean" }).default(true),
  compactionModel: text("compaction_model"),
  compactionTokenThreshold: integer("compaction_token_threshold"),
  compactionInceptionCount: integer("compaction_inception_count"),
  compactionWorkingWindowCount: integer("compaction_working_window_count"),
  
  tokenEstimate: integer("token_estimate").default(0),
  messageCount: integer("message_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("sessions_parent_idx").on(table.parentId),
]);

// Tool calls embedded in messages
export interface ToolCallData {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Tool results embedded in messages
export interface ToolResultData {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// Messages table - stores conversation messages
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  
  toolCalls: text("tool_calls", { mode: "json" }).$type<ToolCallData[] | null>(),
  toolResults: text("tool_results", { mode: "json" }).$type<ToolResultData[] | null>(),
  
  isCompactionSummary: integer("is_compaction_summary", { mode: "boolean" }).default(false),
  isInception: integer("is_inception", { mode: "boolean" }).default(false),
  tokenCount: integer("token_count"),
  
  sequence: integer("sequence").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("messages_session_idx").on(table.sessionId),
  index("messages_sequence_idx").on(table.sessionId, table.sequence),
]);

// Compaction history - tracks context compaction operations
export const compactionHistory = sqliteTable("compaction_history", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  
  summary: text("summary").notNull(),
  editedSummary: text("edited_summary"),
  
  originalTokens: integer("original_tokens").notNull(),
  compactedTokens: integer("compacted_tokens").notNull(),
  messagesPruned: integer("messages_pruned").notNull(),
  
  fromSequence: integer("from_sequence").notNull(),
  toSequence: integer("to_sequence").notNull(),
  
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("compaction_session_idx").on(table.sessionId),
]);

// MCP OAuth tokens - stores OAuth tokens for MCP servers
export const mcpOAuthTokens = sqliteTable("mcp_oauth_tokens", {
  serverName: text("server_name").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type").default("Bearer"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  scopes: text("scopes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Memory entries - stores vector embeddings for semantic search
export const memoryEntries = sqliteTable("memory_entries", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
  
  content: text("content").notNull(),
  embedding: blob("embedding", { mode: "buffer" }),  // Float32Array serialized
  
  type: text("type", { enum: ["conversation", "fact", "note", "code"] }).notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("memory_session_idx").on(table.sessionId),
  index("memory_type_idx").on(table.type),
]);

// Anthropic auth tokens - stores Anthropic OAuth tokens
export const anthropicTokens = sqliteTable("anthropic_tokens", {
  id: text("id").primaryKey().default("default"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Type exports
export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
export type CompactionHistoryRow = typeof compactionHistory.$inferSelect;
export type CompactionHistoryInsert = typeof compactionHistory.$inferInsert;
export type McpOAuthTokenRow = typeof mcpOAuthTokens.$inferSelect;
export type McpOAuthTokenInsert = typeof mcpOAuthTokens.$inferInsert;
export type MemoryEntryRow = typeof memoryEntries.$inferSelect;
export type MemoryEntryInsert = typeof memoryEntries.$inferInsert;
export type AnthropicTokenRow = typeof anthropicTokens.$inferSelect;
export type AnthropicTokenInsert = typeof anthropicTokens.$inferInsert;
