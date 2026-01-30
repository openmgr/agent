import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve, join, dirname } from "path";
import { homedir } from "os";
import { z } from "zod";
import { McpServerConfigSchema, type McpServerConfig } from "./mcp/types.js";

// LSP server configuration schema
const LspServerConfigSchema = z.object({
  disabled: z.boolean().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  rootPatterns: z.array(z.string()).optional(),
});

export type LspServerConfig = z.infer<typeof LspServerConfigSchema>;

const CONFIG_DIR = join(homedir(), ".config", "openmgr");
const GLOBAL_CONFIG_PATH = join(CONFIG_DIR, "agent.json");
const LOCAL_CONFIG_FILENAME = ".openmgr.json";

const AuthTypeSchema = z.enum(["oauth", "api-key"]);

const ProviderAuthSchema = z.object({
  type: AuthTypeSchema,
  apiKey: z.string().optional(),
});

const ApiKeysSchema = z.object({
  anthropic: z.union([z.string(), ProviderAuthSchema]).optional(),
  openai: z.union([z.string(), ProviderAuthSchema]).optional(),
});

export const ConfigSchema = z.object({
  provider: z.enum(["anthropic", "openai", "google", "openrouter", "groq", "xai"]).optional(),
  model: z.string().optional(),
  apiKeys: ApiKeysSchema.optional(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  mcp: z.record(McpServerConfigSchema).optional(),
  lsp: z.record(LspServerConfigSchema).optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export type AuthType = z.infer<typeof AuthTypeSchema>;
export type ProviderAuth = z.infer<typeof ProviderAuthSchema>;
export type ApiKeys = z.infer<typeof ApiKeysSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export interface ResolvedAuth {
  type: AuthType;
  apiKey?: string;
}

export type ProviderName = "anthropic" | "openai" | "google" | "openrouter" | "groq" | "xai";

export interface ResolvedConfig {
  provider: ProviderName;
  model: string;
  auth: ResolvedAuth;
  systemPrompt?: string;
  tools?: string[];
  mcp?: Record<string, McpServerConfig>;
  lsp?: Record<string, LspServerConfig>;
  maxTokens?: number;
  temperature?: number;
}

const DEFAULTS = {
  provider: "anthropic" as const,
  model: "claude-sonnet-4-20250514",
};

async function loadJsonFile(path: string): Promise<Config | null> {
  try {
    if (!existsSync(path)) return null;
    const content = await readFile(path, "utf-8");
    const parsed = JSON.parse(content);
    return ConfigSchema.parse(parsed);
  } catch {
    return null;
  }
}

async function saveJsonFile(path: string, config: Config): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
}

function findLocalConfigPath(startDir: string): string | null {
  let dir = resolve(startDir);
  const root = resolve("/");

  while (dir !== root) {
    const configPath = join(dir, LOCAL_CONFIG_FILENAME);
    if (existsSync(configPath)) {
      return configPath;
    }
    dir = dirname(dir);
  }

  return null;
}

export async function loadGlobalConfig(): Promise<Config | null> {
  return loadJsonFile(GLOBAL_CONFIG_PATH);
}

export async function loadLocalConfig(
  workingDirectory: string
): Promise<Config | null> {
  const configPath = findLocalConfigPath(workingDirectory);
  if (!configPath) return null;
  return loadJsonFile(configPath);
}

function normalizeProviderAuth(
  value: string | ProviderAuth | undefined
): ProviderAuth | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    return { type: "api-key", apiKey: value };
  }
  return value;
}

function resolveAuth(
  provider: ProviderName,
  globalConfig: Config,
  localConfig: Config,
  overrideApiKey?: string
): ResolvedAuth {
  if (overrideApiKey) {
    return { type: "api-key", apiKey: overrideApiKey };
  }

  const apiKeyProvider = provider === "anthropic" || provider === "openai" ? provider : null;
  if (apiKeyProvider) {
    const localAuth = normalizeProviderAuth(localConfig.apiKeys?.[apiKeyProvider]);
    if (localAuth) {
      return { type: localAuth.type, apiKey: localAuth.apiKey };
    }

    const globalAuth = normalizeProviderAuth(globalConfig.apiKeys?.[apiKeyProvider]);
    if (globalAuth) {
      return { type: globalAuth.type, apiKey: globalAuth.apiKey };
    }
  }

  const envKey = getEnvApiKey(provider);
  if (envKey) {
    return { type: "api-key", apiKey: envKey };
  }

  return { type: "oauth" };
}

function getEnvApiKey(provider: ProviderName): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "google":
      return process.env.GOOGLE_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    case "groq":
      return process.env.GROQ_API_KEY;
    case "xai":
      return process.env.XAI_API_KEY;
    default:
      return undefined;
  }
}

export async function loadConfig(
  workingDirectory: string = process.cwd(),
  overrides: { provider?: ProviderName; model?: string; apiKey?: string; systemPrompt?: string; tools?: string[]; maxTokens?: number; temperature?: number } = {}
): Promise<ResolvedConfig> {
  const globalConfig = (await loadGlobalConfig()) ?? {};
  const localConfig = (await loadLocalConfig(workingDirectory)) ?? {};

  const provider =
    overrides.provider ??
    localConfig.provider ??
    globalConfig.provider ??
    DEFAULTS.provider;

  const model =
    overrides.model ??
    localConfig.model ??
    globalConfig.model ??
    DEFAULTS.model;

  const auth = resolveAuth(provider, globalConfig, localConfig, overrides.apiKey);

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
    auth,
    systemPrompt,
    tools,
    mcp: Object.keys(mcp).length > 0 ? mcp : undefined,
    lsp: Object.keys(lsp).length > 0 ? lsp : undefined,
    maxTokens,
    temperature,
  };
}

export async function saveGlobalConfig(config: Partial<Config>): Promise<void> {
  const existing = (await loadGlobalConfig()) ?? {};
  const merged: Config = {
    ...existing,
    ...config,
    apiKeys: config.apiKeys
      ? { ...existing.apiKeys, ...config.apiKeys }
      : existing.apiKeys,
  };
  await saveJsonFile(GLOBAL_CONFIG_PATH, merged);
}

export async function saveLocalConfig(
  workingDirectory: string,
  config: Partial<Config>
): Promise<void> {
  const configPath = join(workingDirectory, LOCAL_CONFIG_FILENAME);
  const existing = (await loadJsonFile(configPath)) ?? {};
  const merged: Config = {
    ...existing,
    ...config,
    apiKeys: config.apiKeys
      ? { ...existing.apiKeys, ...config.apiKeys }
      : existing.apiKeys,
  };
  await saveJsonFile(configPath, merged);
}

export async function setApiKey(
  provider: "anthropic" | "openai",
  apiKey: string,
  scope: "global" | "local" = "global",
  workingDirectory?: string
): Promise<void> {
  const authConfig: ProviderAuth = { type: "api-key", apiKey };
  if (scope === "global") {
    await saveGlobalConfig({ apiKeys: { [provider]: authConfig } });
  } else {
    if (!workingDirectory) {
      throw new Error("workingDirectory required for local scope");
    }
    await saveLocalConfig(workingDirectory, { apiKeys: { [provider]: authConfig } });
  }
}

export async function setAuthType(
  provider: "anthropic" | "openai",
  type: AuthType,
  scope: "global" | "local" = "global",
  workingDirectory?: string
): Promise<void> {
  const authConfig: ProviderAuth = { type };
  if (scope === "global") {
    await saveGlobalConfig({ apiKeys: { [provider]: authConfig } });
  } else {
    if (!workingDirectory) {
      throw new Error("workingDirectory required for local scope");
    }
    await saveLocalConfig(workingDirectory, { apiKeys: { [provider]: authConfig } });
  }
}

export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_PATH;
}

export function getLocalConfigPath(workingDirectory: string): string {
  return join(workingDirectory, LOCAL_CONFIG_FILENAME);
}
