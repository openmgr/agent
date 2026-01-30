import type { Config, ResolvedConfig } from "../../config.js";

/**
 * Minimal valid config
 */
export const minimalConfig: Partial<Config> = {};

/**
 * Full config with all options
 */
export const fullConfig: Config = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  apiKeys: {
    anthropic: { type: "api-key", apiKey: "sk-ant-test-key" },
    openai: { type: "api-key", apiKey: "sk-openai-test-key" },
  },
  systemPrompt: "You are a helpful coding assistant.",
  tools: ["read", "write", "bash"],
  mcp: {
    "test-server": {
      transport: "stdio",
      command: "npx",
      args: ["-y", "test-mcp-server"],
      enabled: true,
      timeout: 30000,
    },
  },
};

/**
 * Resolved config (what loadConfig returns)
 */
export const resolvedConfig: ResolvedConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  auth: { type: "api-key", apiKey: "sk-ant-test-key" },
  systemPrompt: "You are a helpful coding assistant.",
  tools: ["read", "write", "bash"],
  mcp: {
    "test-server": {
      transport: "stdio",
      command: "npx",
      args: ["-y", "test-mcp-server"],
      enabled: true,
      timeout: 30000,
    },
  },
};

/**
 * Config with OAuth auth
 */
export const oauthConfig: ResolvedConfig = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  auth: { type: "oauth" },
};

/**
 * Config for different providers
 */
export const providerConfigs = {
  anthropic: {
    provider: "anthropic" as const,
    model: "claude-sonnet-4-20250514",
    auth: { type: "api-key" as const, apiKey: "sk-ant-test" },
  },
  openai: {
    provider: "openai" as const,
    model: "gpt-4o",
    auth: { type: "api-key" as const, apiKey: "sk-openai-test" },
  },
  google: {
    provider: "google" as const,
    model: "gemini-2.0-flash",
    auth: { type: "api-key" as const, apiKey: "google-test" },
  },
  openrouter: {
    provider: "openrouter" as const,
    model: "anthropic/claude-3.5-sonnet",
    auth: { type: "api-key" as const, apiKey: "sk-or-test" },
  },
  groq: {
    provider: "groq" as const,
    model: "llama-3.3-70b-versatile",
    auth: { type: "api-key" as const, apiKey: "gsk-test" },
  },
  xai: {
    provider: "xai" as const,
    model: "grok-2",
    auth: { type: "api-key" as const, apiKey: "xai-test" },
  },
};
