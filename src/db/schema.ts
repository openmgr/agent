import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { ToolCall, ToolResult } from "../types.js";

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

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  
  toolCalls: text("tool_calls", { mode: "json" }).$type<ToolCall[] | null>(),
  toolResults: text("tool_results", { mode: "json" }).$type<ToolResult[] | null>(),
  
  isCompactionSummary: integer("is_compaction_summary", { mode: "boolean" }).default(false),
  isInception: integer("is_inception", { mode: "boolean" }).default(false),
  tokenCount: integer("token_count"),
  
  sequence: integer("sequence").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("messages_session_idx").on(table.sessionId),
  index("messages_sequence_idx").on(table.sessionId, table.sequence),
]);

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

export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
export type CompactionHistoryRow = typeof compactionHistory.$inferSelect;
export type CompactionHistoryInsert = typeof compactionHistory.$inferInsert;
export type McpOAuthTokenRow = typeof mcpOAuthTokens.$inferSelect;
export type McpOAuthTokenInsert = typeof mcpOAuthTokens.$inferInsert;
