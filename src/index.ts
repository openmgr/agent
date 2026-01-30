export { Agent, createAgent, type AgentOptions } from "./agent.js";

export {
  SessionManager,
  createSessionManager,
  SessionStorage,
  sessionStorage,
  type StoredSession,
  type ListSessionsOptions,
} from "./session/index.js";

export { createServer, startServer } from "./server/index.js";

export { createProvider, AnthropicProvider, OpenAIProvider } from "./llm/index.js";

export {
  loadConfig,
  loadGlobalConfig,
  loadLocalConfig,
  saveGlobalConfig,
  saveLocalConfig,
  setApiKey,
  setAuthType,
  getGlobalConfigPath,
  getLocalConfigPath,
  type Config,
  type ResolvedConfig,
  type AuthType,
} from "./config.js";

export {
  login,
  clearTokens,
  getValidAccessToken,
  isLoggedIn,
  type OAuthTokens,
} from "./auth/index.js";

export { registry, defineTool } from "./tools/index.js";
export { bashTool } from "./tools/bash.js";
export { readTool } from "./tools/read.js";
export { writeTool } from "./tools/write.js";
export { editTool } from "./tools/edit.js";
export { globTool } from "./tools/glob.js";
export { grepTool } from "./tools/grep.js";
export { 
  registerMcpTools, 
  unregisterMcpTools,
  registerMcpResourcesAndPrompts,
  unregisterMcpResourcesAndPrompts,
} from "./tools/mcp-adapter.js";

export {
  McpManager,
  StdioMcpClient,
  type McpClientInterface,
  type McpServerConfig,
  type McpStdioConfig,
  type McpSseConfig,
  type McpTool,
  type McpResource,
  type McpPrompt,
  type McpServerStatus,
} from "./mcp/index.js";

export {
  CompactionEngine,
  DEFAULT_COMPACTION_CONFIG,
  MODEL_LIMITS,
  getModelLimit,
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
  type CompactionConfig,
  type CompactionStats,
  type CompactionResult,
} from "./compaction/index.js";

export { getDb, closeDb, getDbPath, schema } from "./db/index.js";
export { runMigrations, initializeDatabase } from "./db/migrate.js";

export type {
  Message,
  Session,
  ToolCall,
  ToolResult,
  AgentEvent,
  AgentConfig,
  AuthConfig,
  LLMProvider,
  LLMMessage,
  LLMTool,
  LLMStreamResult,
  LLMStreamChunk,
  LLMResponse,
  ToolDefinition,
  ToolContext,
  ToolExecuteResult,
} from "./types.js";

export { DEFAULT_SYSTEM_PROMPT, DEFAULT_AGENT_CONFIG } from "./types.js";
