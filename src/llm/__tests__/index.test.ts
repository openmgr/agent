import { describe, it, expect } from "vitest";
import { createProvider, type ProviderName } from "../index.js";
import { AnthropicProvider } from "../anthropic.js";
import { OpenAIProvider } from "../openai.js";
import { GoogleProvider } from "../google.js";
import { OpenRouterProvider } from "../openrouter.js";
import { GroqProvider } from "../groq.js";
import { XAIProvider } from "../xai.js";

describe("createProvider", () => {
  describe("provider creation", () => {
    it("should create Anthropic provider", () => {
      const provider = createProvider("anthropic");
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it("should create OpenAI provider", () => {
      const provider = createProvider("openai");
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it("should create Google provider", () => {
      const provider = createProvider("google");
      expect(provider).toBeInstanceOf(GoogleProvider);
    });

    it("should create OpenRouter provider", () => {
      const provider = createProvider("openrouter");
      expect(provider).toBeInstanceOf(OpenRouterProvider);
    });

    it("should create Groq provider", () => {
      const provider = createProvider("groq");
      expect(provider).toBeInstanceOf(GroqProvider);
    });

    it("should create XAI provider", () => {
      const provider = createProvider("xai");
      expect(provider).toBeInstanceOf(XAIProvider);
    });

    it("should throw for unknown provider", () => {
      expect(() => createProvider("unknown" as ProviderName)).toThrow(
        "Unknown provider: unknown"
      );
    });
  });

  describe("provider options", () => {
    it("should pass auth options to provider", () => {
      const provider = createProvider("anthropic", {
        auth: { type: "api-key", apiKey: "test-key" },
      });
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it("should default to oauth auth if not specified", () => {
      const provider = createProvider("anthropic", {});
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });
  });
});
