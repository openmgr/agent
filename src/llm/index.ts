import type { LLMProvider } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GoogleProvider } from "./google.js";
import { OpenRouterProvider } from "./openrouter.js";
import { GroqProvider } from "./groq.js";
import { XAIProvider } from "./xai.js";
import type { ProviderOptions } from "./provider.js";

export type ProviderName = "anthropic" | "openai" | "google" | "openrouter" | "groq" | "xai";

export function createProvider(
  provider: ProviderName,
  options: ProviderOptions = {}
): LLMProvider {
  switch (provider) {
    case "anthropic":
      return new AnthropicProvider(options);
    case "openai":
      return new OpenAIProvider(options);
    case "google":
      return new GoogleProvider(options);
    case "openrouter":
      return new OpenRouterProvider(options);
    case "groq":
      return new GroqProvider(options);
    case "xai":
      return new XAIProvider(options);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export { AnthropicProvider } from "./anthropic.js";
export { OpenAIProvider } from "./openai.js";
export { GoogleProvider } from "./google.js";
export { OpenRouterProvider } from "./openrouter.js";
export { GroqProvider } from "./groq.js";
export { XAIProvider } from "./xai.js";
export type { LLMProvider, ProviderOptions };
