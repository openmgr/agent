import type { z } from "zod";
import type {
  ToolDefinition,
  LLMProvider,
  LLMStreamOptions,
  LLMStreamResult,
  Message,
  AgentEvent,
} from "./types.js";

// Forward declaration - Agent will be imported where needed
export interface AgentInterface {
  emit(event: "event", data: AgentEvent): boolean;
  getConfig(): { provider: string; model: string };
  setExtension(key: string, value: unknown): void;
  getExtension<T>(key: string): T | undefined;
}

// ============================================================================
// Provider Definition
// ============================================================================

export interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export interface ProviderDefinition {
  name: string;
  factory: (options: ProviderOptions) => LLMProvider;
}

// ============================================================================
// Command Definition
// ============================================================================

export interface CommandContext {
  agent: AgentInterface;
  sessionId?: string;
}

export interface CommandResult {
  /** Output to display to the user */
  output: string;
  /** If true, also process the original input as a prompt after the command */
  shouldContinue?: boolean;
  /** If shouldContinue is true, use this as the prompt instead of original input */
  transformedInput?: string;
}

export interface CommandDefinition {
  name: string;
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<CommandResult>;
}

// ============================================================================
// Plugin Skill Source (for bundled skills from plugins)
// ============================================================================

export interface PluginSkillSource {
  name: string;
  description: string;
  path: string;
}

// ============================================================================
// Plugin Interface
// ============================================================================

export interface AgentPlugin {
  /** Unique plugin name */
  name: string;
  /** Optional version */
  version?: string;
  
  // What the plugin provides
  /** Tools to register */
  tools?: ToolDefinition[];
  /** LLM providers to register */
  providers?: ProviderDefinition[];
  /** Slash commands to register */
  commands?: CommandDefinition[];
  /** Skill sources to register */
  skills?: PluginSkillSource[];
  
  // Lifecycle hooks
  /** Called when the plugin is registered with an agent */
  onRegister?(agent: AgentInterface): void | Promise<void>;
  /** Called before each prompt - can modify the message */
  onBeforePrompt?(message: string, agent: AgentInterface): string | Promise<string>;
  /** Called after each prompt completes */
  onAfterPrompt?(response: Message, agent: AgentInterface): void | Promise<void>;
  /** Called when the agent is shutting down */
  onShutdown?(agent: AgentInterface): void | Promise<void>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Define a plugin with type safety
 */
export function definePlugin(plugin: AgentPlugin): AgentPlugin {
  return plugin;
}

/**
 * Define a tool with type safety
 */
export function defineTool<TParams>(
  definition: ToolDefinition<TParams>
): ToolDefinition<TParams> {
  return definition;
}

/**
 * Define a provider with type safety
 */
export function defineProvider(definition: ProviderDefinition): ProviderDefinition {
  return definition;
}

/**
 * Define a command with type safety
 */
export function defineCommand(definition: CommandDefinition): CommandDefinition {
  return definition;
}
