/**
 * @openmgr/agent-core
 *
 * Core agent functionality including the Agent class, plugin system, MCP integration,
 * skills, compaction, and slash commands.
 */

// Main Agent class
export { Agent, createAgent } from "./agent.js";
export type { AgentOptions, AgentSessionContext } from "./agent.js";

// Plugin system
export {
  definePlugin,
  defineTool,
  defineProvider,
  defineCommand,
} from "./plugin.js";
export type {
  AgentPlugin,
  AgentInterface,
  ProviderDefinition,
  ProviderOptions,
  CommandDefinition,
  CommandContext,
  CommandResult,
  SkillSource,
} from "./plugin.js";

// Registries
export { toolRegistry } from "./registry/tools.js";
export { providerRegistry } from "./registry/providers.js";
export { commandRegistry } from "./registry/commands.js";

// Types
export type {
  Message,
  MessageRole,
  ToolCall,
  ToolResult,
  Session,
  AgentEvent,
  LLMMessage,
  LLMTool,
  LLMProvider,
  LLMStreamOptions,
  LLMStreamResult,
  LLMStreamChunk,
  LLMResponse,
  ToolDefinition,
  ToolContext,
  ToolExecuteResult,
  TodoItem,
  PhaseItem,
  BackgroundTask,
  AuthConfig,
  AuthType,
  ProviderName,
  AgentConfig,
  ImagePart,
  ImageSourceBase64,
  ImageSourceUrl,
  TextPart,
  ContentPart,
} from "./types.js";

// Schemas (for runtime validation)
export {
  MessageSchema,
  ToolCallSchema,
  ToolResultSchema,
  SessionSchema,
  AgentEventSchema,
  ImageSourceBase64Schema,
  ImageSourceUrlSchema,
  ImagePartSchema,
  TextPartSchema,
  ContentPartSchema,
} from "./types.js";

// Defaults
export { DEFAULT_SYSTEM_PROMPT, DEFAULT_AGENT_CONFIG } from "./types.js";

// Config
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
} from "./config.js";
export type { ResolvedConfig, Config, AuthType as ConfigAuthType } from "./config.js";

// MCP
export { McpManager } from "./mcp/manager.js";
export { StdioMcpClient } from "./mcp/stdio-client.js";
export { SseMcpClient } from "./mcp/sse-client.js";
export { McpOAuthManager, mcpOAuthManager } from "./mcp/oauth.js";
export type { OAuthTokens, OAuthTokenStore } from "./mcp/oauth.js";
export {
  registerMcpTools,
  unregisterMcpTools,
  registerMcpResourcesAndPrompts,
  unregisterMcpResourcesAndPrompts,
} from "./mcp/adapter.js";
export type {
  McpServerConfig,
  McpStdioConfig,
  McpSseConfig,
  McpOAuthConfig,
  McpTool,
  McpResource,
  McpPrompt,
} from "./mcp/types.js";

// Skills
export { SkillManager } from "./skills/manager.js";
export type { SkillManagerOptions } from "./skills/manager.js";
export { parseSkillMd, loadSkillFromDirectory, isSkillDirectory } from "./skills/loader.js";
export type {
  SkillMetadata,
  LoadedSkill,
  SkillSource as SkillSourceType,
} from "./skills/types.js";
export { SkillLoadError, SkillNotFoundError } from "./skills/types.js";

// Compaction
export { CompactionEngine } from "./compaction/engine.js";
export type {
  CompactionConfig,
  CompactionResult,
  CompactionStats,
} from "./compaction/types.js";
export { DEFAULT_COMPACTION_CONFIG } from "./compaction/types.js";

// LLM Base Provider (for implementing providers)
export { BaseLLMProvider } from "./llm/provider.js";

// Built-in commands
export { registerBuiltinCommands } from "./commands/builtin.js";

// Title generation
export { generateTitle, isDefaultTitle } from "./title.js";
export type { TitleGeneratorOptions } from "./title.js";

// Tool Permissions
export {
  ToolPermissionManager,
  SAFE_READ_TOOLS,
  WRITE_TOOLS,
  createReadOnlyConfig,
  createStrictConfig,
  createPermissiveConfig,
} from "./permissions.js";
export type {
  ToolPermissionConfig,
  PermissionDecision,
  PermissionResponse,
  PermissionRequestCallback,
} from "./permissions.js";
