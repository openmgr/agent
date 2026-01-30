import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnthropicProvider } from "../anthropic.js";
import { OpenAIProvider } from "../openai.js";
import { GoogleProvider } from "../google.js";
import { GroqProvider } from "../groq.js";
import { XAIProvider } from "../xai.js";
import { OpenRouterProvider } from "../openrouter.js";

describe("LLM Providers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear any existing API keys
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("AnthropicProvider", () => {
    it("should create with default oauth auth", () => {
      const provider = new AnthropicProvider();
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it("should create with api-key auth", () => {
      const provider = new AnthropicProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it("should have stream method", () => {
      const provider = new AnthropicProvider();
      expect(typeof provider.stream).toBe("function");
    });
  });

  describe("OpenAIProvider", () => {
    it("should create with default auth", () => {
      const provider = new OpenAIProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it("should create with api-key from options", () => {
      const provider = new OpenAIProvider({
        auth: { type: "api-key", apiKey: "sk-test" },
      });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it("should have stream method", () => {
      const provider = new OpenAIProvider();
      expect(typeof provider.stream).toBe("function");
    });
  });

  describe("GoogleProvider", () => {
    it("should create instance", () => {
      const provider = new GoogleProvider();
      expect(provider).toBeInstanceOf(GoogleProvider);
    });

    it("should create with api-key", () => {
      const provider = new GoogleProvider({
        auth: { type: "api-key", apiKey: "google-key" },
      });
      expect(provider).toBeInstanceOf(GoogleProvider);
    });
  });

  describe("GroqProvider", () => {
    it("should create instance", () => {
      const provider = new GroqProvider();
      expect(provider).toBeInstanceOf(GroqProvider);
    });

    it("should create with api-key", () => {
      const provider = new GroqProvider({
        auth: { type: "api-key", apiKey: "groq-key" },
      });
      expect(provider).toBeInstanceOf(GroqProvider);
    });
  });

  describe("XAIProvider", () => {
    it("should create instance", () => {
      const provider = new XAIProvider();
      expect(provider).toBeInstanceOf(XAIProvider);
    });

    it("should create with api-key", () => {
      const provider = new XAIProvider({
        auth: { type: "api-key", apiKey: "xai-key" },
      });
      expect(provider).toBeInstanceOf(XAIProvider);
    });
  });

  describe("OpenRouterProvider", () => {
    it("should create instance", () => {
      const provider = new OpenRouterProvider();
      expect(provider).toBeInstanceOf(OpenRouterProvider);
    });

    it("should create with api-key", () => {
      const provider = new OpenRouterProvider({
        auth: { type: "api-key", apiKey: "openrouter-key" },
      });
      expect(provider).toBeInstanceOf(OpenRouterProvider);
    });
  });
});

describe("Provider error handling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("OpenAI should throw when no API key is set", async () => {
    const provider = new OpenAIProvider();
    await expect(
      provider.stream({
        model: "gpt-4",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow("OpenAI API key not configured");
  });

  it("Google should throw when no API key is set", async () => {
    const provider = new GoogleProvider();
    await expect(
      provider.stream({
        model: "gemini-pro",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow("Google AI API key not configured");
  });

  it("Groq should throw when no API key is set", async () => {
    const provider = new GroqProvider();
    await expect(
      provider.stream({
        model: "mixtral-8x7b",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow("Groq API key not configured");
  });

  it("XAI should throw when no API key is set", async () => {
    const provider = new XAIProvider();
    await expect(
      provider.stream({
        model: "grok-1",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow("xAI API key not configured");
  });

  it("OpenRouter should throw when no API key is set", async () => {
    const provider = new OpenRouterProvider();
    await expect(
      provider.stream({
        model: "anthropic/claude-3",
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow("OpenRouter API key not configured");
  });
});
