/**
 * @openmgr/agent
 *
 * OpenMgr Agent - AI coding assistant with batteries included
 *
 * This is the main meta-package that re-exports all functionality from
 * the individual packages for convenience.
 */

// Core Agent functionality
export {
  // Agent class and factory
  Agent,
  createAgent,
  type AgentOptions,
  type AgentSessionContext,

  // Plugin system
  definePlugin,
  defineTool,
  defineProvider,
  defineCommand,
  type AgentPlugin,
  type AgentInterface,
  type ProviderDefinition,
  type ProviderOptions,
  type CommandDefinition,
  type CommandContext,
  type CommandResult,

  // Registries
  toolRegistry,
  providerRegistry,
  commandRegistry,

  // Types
  type Message,
  type MessageRole,
  type ToolCall,
  type ToolResult,
  type Session,
  type AgentEvent,
  type LLMMessage,
  type LLMTool,
  type LLMProvider,
  type LLMStreamOptions,
  type LLMStreamResult,
  type LLMStreamChunk,
  type LLMResponse,
  type ToolDefinition,
  type ToolContext,
  type ToolExecuteResult,
  type TodoItem,
  type PhaseItem,
  type BackgroundTask,
  type AuthConfig,
  type AuthType,
  type ProviderName,
  type AgentConfig,

  // Schemas
  MessageSchema,
  ToolCallSchema,
  ToolResultSchema,
  SessionSchema,
  AgentEventSchema,

  // Defaults
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_AGENT_CONFIG,

  // Config types
  type ResolvedConfig,
  type ConfigLoader,

  // MCP
  McpManager,
  SseMcpClient,
  McpOAuthManager,
  mcpOAuthManager,
  registerMcpTools,
  unregisterMcpTools,
  registerMcpResourcesAndPrompts,
  unregisterMcpResourcesAndPrompts,
  type McpServerConfig,
  type McpStdioConfig,
  type McpSseConfig,
  type McpOAuthConfig,
  type McpTool,
  type McpResource,
  type McpPrompt,
  type McpClientFactory,
  type OAuthCallbackHandler,

  // Skills types
  type SkillMetadata,
  type LoadedSkill,
  type SkillManagerInterface,
  SkillLoadError,
  SkillNotFoundError,

  // Compaction
  CompactionEngine,
  type CompactionConfig,
  type CompactionResult,
  type CompactionStats,
  DEFAULT_COMPACTION_CONFIG,

  // Base provider for implementing custom providers
  BaseLLMProvider,

  // Built-in commands
  registerBuiltinCommands,
} from "@openmgr/agent-core";

// Providers
export {
  providersPlugin,
  createProvider,
  AnthropicProvider,
  OpenAIProvider,
  GoogleProvider,
  OpenRouterProvider,
  GroqProvider,
  XAIProvider,
  type ProviderName as LLMProviderName,
} from "@openmgr/agent-providers";

// Tools (pure code)
export {
  todoReadTool,
  todoWriteTool,
  phaseReadTool,
  phaseWriteTool,
  webFetchTool,
  webSearchTool,
  skillTool,
  toolsPlugin,
} from "@openmgr/agent-tools";

// Tools (terminal/filesystem)
export {
  bashTool,
  readTool,
  writeTool,
  editTool,
  globTool,
  grepTool,
  toolsTerminalPlugin,
} from "@openmgr/agent-tools-terminal";

// Database
export {
  getDb,
  closeDb,
  getDbPath,
  getDefaultDbPath,
  createDatabase,
  createInMemoryDatabase,
  schema,
  runMigrations,
  initializeDatabase,
  type AgentDatabase,
  type DatabaseConfig,
  type BetterSQLite3Database,
  type MigrationResult,
  
  // Schema tables
  sessions,
  messages,
  compactionHistory,
  mcpOAuthTokens,
  memoryEntries,
  anthropicTokens,
  
  // Schema types
  type ToolCallData,
  type ToolResultData,
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
} from "@openmgr/agent-database";

// Storage (session management)
export {
  SessionManager,
  storagePlugin,
  type StorageDatabase,
  type CreateSessionOptions,
  type CreateMessageOptions,
  type UpdateSessionOptions,
  type StoragePluginOptions,
} from "@openmgr/agent-storage";

// Memory
export {
  MemoryStorage,
  memoryAddTool,
  memorySearchTool,
  memoryListTool,
  memoryDeleteTool,
  memoryPlugin,
  type MemoryItem,
  type MemorySearchResult,
} from "@openmgr/agent-memory";

// Auth
export {
  login,
  clearTokens,
  getValidAccessToken,
  loadStoredTokens,
  saveTokens,
  refreshAccessToken,
  isLoggedIn,
  generateAuthorizationUrl,
  exchangeCode,
  createOAuthFetch,
  type OAuthTokens,
  type LoginResult,
  type AuthorizationInfo,
} from "@openmgr/agent-auth-anthropic";

// Skills
export {
  skillsBundledPlugin,
  bundledSkills,
  getBundledSkillPath,
  getBundledSkillNames,
  getBundledSkillsDir,
  type BundledSkillInfo,
} from "@openmgr/agent-skills-bundled";

// LSP
export {
  LspManager,
  LspClient,
  LspTransport,
  getLanguageId,
  DEFAULT_LANGUAGE_SERVERS,
  LANGUAGE_IDS,
  type LanguageServerConfig,
  type LspManagerOptions,
  type Diagnostic,
  type Position,
} from "@openmgr/agent-lsp";

// Server
export {
  createServer,
  startServer,
  serverPlugin,
  type ServerConfig,
  type ServerState,
} from "@openmgr/agent-server";

// CLI
export {
  registerAllCommands,
  Spinner,
  DebugLogger,
  debug,
} from "@openmgr/agent-cli";
