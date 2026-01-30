import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PROVIDER_MODELS,
  getProviderModels,
  getAllModels,
  getProvider,
  findModel,
  getDefaultModel,
  hasProviderCredentials,
  getConfiguredProviders,
  type ModelInfo,
} from "../models.js";

describe("models", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.XAI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("PROVIDER_MODELS", () => {
    it("should have all expected providers", () => {
      const providerIds = PROVIDER_MODELS.map((p) => p.id);
      expect(providerIds).toContain("anthropic");
      expect(providerIds).toContain("openai");
      expect(providerIds).toContain("google");
      expect(providerIds).toContain("openrouter");
      expect(providerIds).toContain("groq");
      expect(providerIds).toContain("xai");
    });

    it("should have models for each provider", () => {
      for (const provider of PROVIDER_MODELS) {
        expect(provider.models.length).toBeGreaterThan(0);
        expect(provider.name).toBeTruthy();
      }
    });

    it("each model should have required fields", () => {
      for (const provider of PROVIDER_MODELS) {
        for (const model of provider.models) {
          expect(model.id).toBeTruthy();
          expect(model.name).toBeTruthy();
        }
      }
    });
  });

  describe("getProviderModels", () => {
    it("should return models for anthropic", () => {
      const models = getProviderModels("anthropic");
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id.includes("claude"))).toBe(true);
    });

    it("should return models for openai", () => {
      const models = getProviderModels("openai");
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id.includes("gpt"))).toBe(true);
    });

    it("should return empty array for unknown provider", () => {
      const models = getProviderModels("unknown");
      expect(models).toEqual([]);
    });
  });

  describe("getAllModels", () => {
    it("should return all models with provider info", () => {
      const allModels = getAllModels();
      expect(allModels.length).toBeGreaterThan(10);
      
      // Check structure
      for (const item of allModels) {
        expect(item.provider).toBeTruthy();
        expect(item.model).toBeDefined();
        expect(item.model.id).toBeTruthy();
      }
    });

    it("should include models from all providers", () => {
      const allModels = getAllModels();
      const providers = new Set(allModels.map((m) => m.provider));
      expect(providers.size).toBe(PROVIDER_MODELS.length);
    });
  });

  describe("getProvider", () => {
    it("should return provider by id", () => {
      const provider = getProvider("anthropic");
      expect(provider).toBeDefined();
      expect(provider?.id).toBe("anthropic");
      expect(provider?.name).toBe("Anthropic");
    });

    it("should return undefined for unknown provider", () => {
      const provider = getProvider("unknown");
      expect(provider).toBeUndefined();
    });
  });

  describe("findModel", () => {
    it("should find model by id", () => {
      const result = findModel("gpt-4o");
      expect(result).toBeDefined();
      expect(result?.provider).toBe("openai");
      expect(result?.model.id).toBe("gpt-4o");
    });

    it("should find anthropic models", () => {
      const result = findModel("claude-sonnet-4-20250514");
      expect(result).toBeDefined();
      expect(result?.provider).toBe("anthropic");
    });

    it("should return undefined for unknown model", () => {
      const result = findModel("unknown-model-xyz");
      expect(result).toBeUndefined();
    });
  });

  describe("getDefaultModel", () => {
    it("should return default for anthropic", () => {
      expect(getDefaultModel("anthropic")).toBe("claude-sonnet-4-20250514");
    });

    it("should return default for openai", () => {
      expect(getDefaultModel("openai")).toBe("gpt-4o");
    });

    it("should return default for google", () => {
      expect(getDefaultModel("google")).toBe("gemini-2.0-flash");
    });

    it("should return default for openrouter", () => {
      expect(getDefaultModel("openrouter")).toBe("anthropic/claude-sonnet-4");
    });

    it("should return default for groq", () => {
      expect(getDefaultModel("groq")).toBe("llama-3.3-70b-versatile");
    });

    it("should return default for xai", () => {
      expect(getDefaultModel("xai")).toBe("grok-2");
    });

    it("should return anthropic default for unknown provider", () => {
      expect(getDefaultModel("unknown")).toBe("claude-sonnet-4-20250514");
    });
  });

  describe("hasProviderCredentials", () => {
    it("should return false when no credentials", () => {
      expect(hasProviderCredentials("anthropic")).toBe(false);
      expect(hasProviderCredentials("openai")).toBe(false);
      expect(hasProviderCredentials("google")).toBe(false);
      expect(hasProviderCredentials("openrouter")).toBe(false);
      expect(hasProviderCredentials("groq")).toBe(false);
      expect(hasProviderCredentials("xai")).toBe(false);
    });

    it("should detect anthropic env var", () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      expect(hasProviderCredentials("anthropic")).toBe(true);
    });

    it("should detect openai env var", () => {
      process.env.OPENAI_API_KEY = "test-key";
      expect(hasProviderCredentials("openai")).toBe(true);
    });

    it("should detect google env var (GOOGLE_GENERATIVE_AI_API_KEY)", () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
      expect(hasProviderCredentials("google")).toBe(true);
    });

    it("should detect google env var (GOOGLE_API_KEY)", () => {
      process.env.GOOGLE_API_KEY = "test-key";
      expect(hasProviderCredentials("google")).toBe(true);
    });

    it("should detect openrouter env var", () => {
      process.env.OPENROUTER_API_KEY = "test-key";
      expect(hasProviderCredentials("openrouter")).toBe(true);
    });

    it("should detect groq env var", () => {
      process.env.GROQ_API_KEY = "test-key";
      expect(hasProviderCredentials("groq")).toBe(true);
    });

    it("should detect xai env var", () => {
      process.env.XAI_API_KEY = "test-key";
      expect(hasProviderCredentials("xai")).toBe(true);
    });

    it("should detect anthropic config api key", () => {
      expect(hasProviderCredentials("anthropic", { anthropic: "test-key" })).toBe(true);
    });

    it("should detect anthropic config object with api key", () => {
      expect(
        hasProviderCredentials("anthropic", { anthropic: { type: "api-key", apiKey: "test" } })
      ).toBe(true);
    });

    it("should detect anthropic config oauth", () => {
      expect(
        hasProviderCredentials("anthropic", { anthropic: { type: "oauth" } })
      ).toBe(true);
    });

    it("should detect openai config api key", () => {
      expect(hasProviderCredentials("openai", { openai: "test-key" })).toBe(true);
    });

    it("should return false for unknown provider", () => {
      expect(hasProviderCredentials("unknown")).toBe(false);
    });
  });

  describe("getConfiguredProviders", () => {
    it("should return empty array when no credentials", () => {
      const providers = getConfiguredProviders();
      expect(providers).toEqual([]);
    });

    it("should return configured providers", () => {
      process.env.ANTHROPIC_API_KEY = "test";
      process.env.OPENAI_API_KEY = "test";
      
      const providers = getConfiguredProviders();
      const ids = providers.map((p) => p.id);
      expect(ids).toContain("anthropic");
      expect(ids).toContain("openai");
      expect(ids).not.toContain("google");
    });

    it("should include providers from config", () => {
      const providers = getConfiguredProviders({ anthropic: "key", openai: "key" });
      const ids = providers.map((p) => p.id);
      expect(ids).toContain("anthropic");
      expect(ids).toContain("openai");
    });
  });
});
