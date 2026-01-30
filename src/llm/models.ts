// Model registry for all supported providers

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  maxOutput?: number;
}

export interface ProviderModels {
  id: string;
  name: string;
  models: ModelInfo[];
}

export const PROVIDER_MODELS: ProviderModels[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      {
        id: "claude-opus-4-5-20251101",
        name: "Claude Opus 4.5",
        description: "Premium model combining maximum intelligence with practical performance",
        contextWindow: 200000,
        maxOutput: 64000,
      },
      {
        id: "claude-sonnet-4-5-20250929",
        name: "Claude Sonnet 4.5",
        description: "Best balance of intelligence, speed, and cost for most use cases",
        contextWindow: 200000,
        maxOutput: 64000,
      },
      {
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
        description: "Fastest model with near-frontier intelligence",
        contextWindow: 200000,
        maxOutput: 64000,
      },
      {
        id: "claude-opus-4-1-20250805",
        name: "Claude Opus 4.1",
        description: "Previous generation premium model",
        contextWindow: 200000,
        maxOutput: 32000,
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        description: "Previous generation balanced model",
        contextWindow: 200000,
        maxOutput: 64000,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        description: "Previous generation capable model",
        contextWindow: 200000,
        maxOutput: 32000,
      },
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3.7 Sonnet",
        description: "Claude 3.7 generation model",
        contextWindow: 200000,
        maxOutput: 64000,
      },
      {
        id: "claude-3-haiku-20240307",
        name: "Claude 3 Haiku",
        description: "Legacy fast model",
        contextWindow: 200000,
        maxOutput: 4096,
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Most capable GPT-4 model",
        contextWindow: 128000,
        maxOutput: 16384,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Smaller, faster, cheaper GPT-4o",
        contextWindow: 128000,
        maxOutput: 16384,
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "GPT-4 Turbo with vision",
        contextWindow: 128000,
        maxOutput: 4096,
      },
      {
        id: "gpt-4",
        name: "GPT-4",
        description: "Original GPT-4",
        contextWindow: 8192,
        maxOutput: 4096,
      },
      {
        id: "o1",
        name: "o1",
        description: "Reasoning model for complex tasks",
        contextWindow: 200000,
        maxOutput: 100000,
      },
      {
        id: "o1-mini",
        name: "o1 Mini",
        description: "Smaller reasoning model",
        contextWindow: 128000,
        maxOutput: 65536,
      },
      {
        id: "o3-mini",
        name: "o3 Mini",
        description: "Latest small reasoning model",
        contextWindow: 200000,
        maxOutput: 100000,
      },
    ],
  },
  {
    id: "google",
    name: "Google",
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Latest fast Gemini model",
        contextWindow: 1000000,
        maxOutput: 8192,
      },
      {
        id: "gemini-2.0-flash-thinking",
        name: "Gemini 2.0 Flash Thinking",
        description: "Reasoning-focused Gemini model",
        contextWindow: 1000000,
        maxOutput: 8192,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Most capable Gemini 1.5",
        contextWindow: 2000000,
        maxOutput: 8192,
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        description: "Fast Gemini 1.5",
        contextWindow: 1000000,
        maxOutput: 8192,
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    models: [
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4 (via OpenRouter)",
        description: "Claude Sonnet 4 through OpenRouter",
      },
      {
        id: "openai/gpt-4o",
        name: "GPT-4o (via OpenRouter)",
        description: "GPT-4o through OpenRouter",
      },
      {
        id: "google/gemini-2.0-flash",
        name: "Gemini 2.0 Flash (via OpenRouter)",
        description: "Gemini 2.0 Flash through OpenRouter",
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B",
        description: "Meta's Llama 3.3 70B Instruct",
      },
      {
        id: "deepseek/deepseek-chat",
        name: "DeepSeek Chat",
        description: "DeepSeek's chat model",
      },
      {
        id: "mistralai/mistral-large",
        name: "Mistral Large",
        description: "Mistral's largest model",
      },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B Versatile",
        description: "Fast inference Llama 3.3 70B",
        contextWindow: 128000,
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B Instant",
        description: "Ultra-fast Llama 3.1 8B",
        contextWindow: 128000,
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        description: "Mixtral MoE model",
        contextWindow: 32768,
      },
      {
        id: "gemma2-9b-it",
        name: "Gemma 2 9B",
        description: "Google's Gemma 2 9B",
        contextWindow: 8192,
      },
    ],
  },
  {
    id: "xai",
    name: "xAI",
    models: [
      {
        id: "grok-2",
        name: "Grok 2",
        description: "xAI's Grok 2 model",
        contextWindow: 131072,
      },
      {
        id: "grok-2-mini",
        name: "Grok 2 Mini",
        description: "Smaller Grok 2 variant",
        contextWindow: 131072,
      },
      {
        id: "grok-beta",
        name: "Grok Beta",
        description: "Grok beta model",
        contextWindow: 131072,
      },
    ],
  },
];

/**
 * Get all models for a specific provider
 */
export function getProviderModels(providerId: string): ModelInfo[] {
  const provider = PROVIDER_MODELS.find((p) => p.id === providerId);
  return provider?.models ?? [];
}

/**
 * Get all available models across all providers
 */
export function getAllModels(): Array<{ provider: string; model: ModelInfo }> {
  const result: Array<{ provider: string; model: ModelInfo }> = [];
  for (const provider of PROVIDER_MODELS) {
    for (const model of provider.models) {
      result.push({ provider: provider.id, model });
    }
  }
  return result;
}

/**
 * Get provider info by ID
 */
export function getProvider(providerId: string): ProviderModels | undefined {
  return PROVIDER_MODELS.find((p) => p.id === providerId);
}

/**
 * Find a model by ID across all providers
 */
export function findModel(modelId: string): { provider: string; model: ModelInfo } | undefined {
  for (const provider of PROVIDER_MODELS) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) {
      return { provider: provider.id, model };
    }
  }
  return undefined;
}

export function getDefaultModel(providerId: string): string {
  switch (providerId) {
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "openai":
      return "gpt-4o";
    case "google":
      return "gemini-2.0-flash";
    case "openrouter":
      return "anthropic/claude-sonnet-4";
    case "groq":
      return "llama-3.3-70b-versatile";
    case "xai":
      return "grok-2";
    default:
      return "claude-sonnet-4-20250514";
  }
}

export interface ConfigApiKeys {
  anthropic?: string | { type: string; apiKey?: string };
  openai?: string | { type: string; apiKey?: string };
}

function getApiKeyFromConfig(config: ConfigApiKeys | undefined, provider: "anthropic" | "openai"): string | undefined {
  const value = config?.[provider];
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.apiKey;
}

function hasOAuthConfigured(config: ConfigApiKeys | undefined, provider: "anthropic" | "openai"): boolean {
  const value = config?.[provider];
  if (!value) return false;
  if (typeof value === "string") return false;
  return value.type === "oauth";
}

export function hasProviderCredentials(providerId: string, configApiKeys?: ConfigApiKeys): boolean {
  switch (providerId) {
    case "anthropic":
      return !!(getApiKeyFromConfig(configApiKeys, "anthropic") || hasOAuthConfigured(configApiKeys, "anthropic") || process.env.ANTHROPIC_API_KEY);
    case "openai":
      return !!(getApiKeyFromConfig(configApiKeys, "openai") || hasOAuthConfigured(configApiKeys, "openai") || process.env.OPENAI_API_KEY);
    case "google":
      return !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY);
    case "openrouter":
      return !!(process.env.OPENROUTER_API_KEY);
    case "groq":
      return !!(process.env.GROQ_API_KEY);
    case "xai":
      return !!(process.env.XAI_API_KEY);
    default:
      return false;
  }
}

export function getConfiguredProviders(configApiKeys?: ConfigApiKeys): ProviderModels[] {
  return PROVIDER_MODELS.filter((p) => hasProviderCredentials(p.id, configApiKeys));
}
