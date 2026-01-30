/**
 * Abstract configuration types for OpenMgr Agent
 * 
 * These types define the interface for configuration without any
 * Node.js dependencies, allowing different implementations
 * (XDG filesystem, React Native AsyncStorage, etc.)
 */

import { z } from "zod";
import type { McpServerConfig } from "../mcp/types.js";

// LSP server configuration schema (for compatibility)
export const LspServerConfigSchema = z.object({
  disabled: z.boolean().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  rootPatterns: z.array(z.string()).optional(),
});

export type LspServerConfig = z.infer<typeof LspServerConfigSchema>;

export const AuthTypeSchema = z.enum(["oauth", "api-key"]);
export type AuthType = z.infer<typeof AuthTypeSchema>;

export const ProviderAuthSchema = z.object({
  type: AuthTypeSchema,
  apiKey: z.string().optional(),
});
export type ProviderAuth = z.infer<typeof ProviderAuthSchema>;

export const ApiKeysSchema = z.object({
  anthropic: z.union([z.string(), ProviderAuthSchema]).optional(),
  openai: z.union([z.string(), ProviderAuthSchema]).optional(),
});
export type ApiKeys = z.infer<typeof ApiKeysSchema>;

/**
 * Raw configuration as stored/loaded
 */
export interface Config {
  provider?: string;
  model?: string;
  apiKeys?: ApiKeys;
  systemPrompt?: string;
  tools?: string[];
  mcp?: Record<string, McpServerConfig>;
  lsp?: Record<string, LspServerConfig>;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Authentication configuration after resolution
 */
export interface ResolvedAuth {
  type: AuthType;
  apiKey?: string;
}

/**
 * Fully resolved configuration ready for use
 */
export interface ResolvedConfig {
  provider: string;
  model: string;
  auth: ResolvedAuth;
  systemPrompt?: string;
  tools?: string[];
  mcp?: Record<string, McpServerConfig>;
  lsp?: Record<string, LspServerConfig>;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Configuration overrides that can be passed at runtime
 */
export interface ConfigOverrides {
  provider?: string;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  tools?: string[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * Default configuration values
 */
export const CONFIG_DEFAULTS = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
} as const;

/**
 * Interface for configuration loaders
 * 
 * Implementations can load config from different sources:
 * - XDG filesystem (Node.js)
 * - AsyncStorage (React Native)
 * - In-memory (testing)
 */
export interface ConfigLoader {
  /**
   * Load and resolve configuration
   */
  loadConfig(workingDirectory: string, overrides?: ConfigOverrides): Promise<ResolvedConfig>;
  
  /**
   * Load global configuration only
   */
  loadGlobalConfig?(): Promise<Config | null>;
  
  /**
   * Load local/project configuration only
   */
  loadLocalConfig?(workingDirectory: string): Promise<Config | null>;
  
  /**
   * Save global configuration
   */
  saveGlobalConfig?(config: Partial<Config>): Promise<void>;
  
  /**
   * Save local/project configuration
   */
  saveLocalConfig?(workingDirectory: string, config: Partial<Config>): Promise<void>;
}

/**
 * Normalize a provider auth value (string or object) to ProviderAuth
 */
export function normalizeProviderAuth(
  value: string | ProviderAuth | undefined
): ProviderAuth | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    return { type: "api-key", apiKey: value };
  }
  return value;
}

/**
 * Merge configs with precedence: overrides > local > global > defaults
 */
export function mergeConfigs(
  globalConfig: Config,
  localConfig: Config,
  overrides: ConfigOverrides = {}
): Omit<ResolvedConfig, "auth"> & { apiKey?: string } {
  const provider =
    overrides.provider ??
    localConfig.provider ??
    globalConfig.provider ??
    CONFIG_DEFAULTS.provider;

  const model =
    overrides.model ??
    localConfig.model ??
    globalConfig.model ??
    CONFIG_DEFAULTS.model;

  const systemPrompt =
    overrides.systemPrompt ?? localConfig.systemPrompt ?? globalConfig.systemPrompt;

  const tools = overrides.tools ?? localConfig.tools ?? globalConfig.tools;

  const mcp = {
    ...globalConfig.mcp,
    ...localConfig.mcp,
  };

  const lsp = {
    ...globalConfig.lsp,
    ...localConfig.lsp,
  };

  const maxTokens =
    overrides.maxTokens ?? localConfig.maxTokens ?? globalConfig.maxTokens;

  const temperature =
    overrides.temperature ?? localConfig.temperature ?? globalConfig.temperature;

  return {
    provider,
    model,
    systemPrompt,
    tools,
    mcp: Object.keys(mcp).length > 0 ? mcp : undefined,
    lsp: Object.keys(lsp).length > 0 ? lsp : undefined,
    maxTokens,
    temperature,
    apiKey: overrides.apiKey,
  };
}
