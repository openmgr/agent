import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnthropicProvider } from "../anthropic.js";
import { OpenAIProvider } from "../openai.js";
import { GoogleProvider } from "../google.js";
import { GroqProvider } from "../groq.js";
import { XAIProvider } from "../xai.js";
import { OpenRouterProvider } from "../openrouter.js";
import type { LLMMessage, ContentPart } from "../../types.js";

describe("Provider Image Conversion", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to create test messages
  const createTextMessage = (content: string): LLMMessage => ({
    role: "user",
    content,
  });

  const createImageMessage = (textContent: string, imageBase64: string): LLMMessage => ({
    role: "user",
    content: [
      { type: "text", text: textContent },
      {
        type: "image",
        source: {
          type: "base64",
          mediaType: "image/png",
          data: imageBase64,
        },
      },
    ],
  });

  const createImageUrlMessage = (textContent: string, imageUrl: string): LLMMessage => ({
    role: "user",
    content: [
      { type: "text", text: textContent },
      {
        type: "image",
        source: {
          type: "url",
          url: imageUrl,
        },
      },
    ],
  });

  const createMultiImageMessage = (): LLMMessage => ({
    role: "user",
    content: [
      { type: "text", text: "Compare these images:" },
      {
        type: "image",
        source: {
          type: "base64",
          mediaType: "image/jpeg",
          data: "image1base64",
        },
      },
      {
        type: "image",
        source: {
          type: "url",
          url: "https://example.com/image2.png",
        },
      },
      { type: "text", text: "Which one is better?" },
    ],
  });

  describe("AnthropicProvider", () => {
    it("should handle string content messages", () => {
      const provider = new AnthropicProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      // Access private method for testing
      const convertMessages = (provider as any).convertMessages.bind(provider);
      const messages: LLMMessage[] = [createTextMessage("Hello")];
      
      const result = convertMessages(messages);
      
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
      expect(result[0].content).toBe("Hello");
    });

    it("should convert image content parts to AI SDK format", () => {
      const provider = new AnthropicProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const content: ContentPart[] = [
        { type: "text", text: "What's in this image?" },
        {
          type: "image",
          source: {
            type: "base64",
            mediaType: "image/png",
            data: "base64imagedata",
          },
        },
      ];

      const result = convertUserContent(content);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: "text", text: "What's in this image?" });
      expect(result[1]).toEqual({
        type: "image",
        image: "base64imagedata",
        mimeType: "image/png",
      });
    });

    it("should convert URL image source", () => {
      const provider = new AnthropicProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const content: ContentPart[] = [
        {
          type: "image",
          source: {
            type: "url",
            url: "https://example.com/image.png",
          },
        },
      ];

      const result = convertUserContent(content);

      expect(result[0]).toEqual({
        type: "image",
        image: "https://example.com/image.png",
      });
    });

    it("should extract text from assistant message with content parts", () => {
      const provider = new AnthropicProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const extractTextFromParts = (provider as any).extractTextFromParts.bind(provider);
      const parts: ContentPart[] = [
        { type: "text", text: "Hello " },
        { type: "text", text: "world!" },
      ];

      const result = extractTextFromParts(parts);

      expect(result).toBe("Hello \nworld!");
    });
  });

  describe("OpenAIProvider", () => {
    it("should convert image content parts", () => {
      const provider = new OpenAIProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const content: ContentPart[] = [
        { type: "text", text: "Describe this:" },
        {
          type: "image",
          source: {
            type: "base64",
            mediaType: "image/jpeg",
            data: "jpegdata",
          },
        },
      ];

      const result = convertUserContent(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ type: "text", text: "Describe this:" });
      expect(result[1]).toEqual({
        type: "image",
        image: "jpegdata",
        mimeType: "image/jpeg",
      });
    });

    it("should handle string content passthrough", () => {
      const provider = new OpenAIProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const result = convertUserContent("Simple string");

      expect(result).toBe("Simple string");
    });
  });

  describe("GoogleProvider", () => {
    it("should convert image content parts", () => {
      const provider = new GoogleProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const content: ContentPart[] = [
        { type: "text", text: "What do you see?" },
        {
          type: "image",
          source: {
            type: "url",
            url: "https://example.com/photo.webp",
          },
        },
      ];

      const result = convertUserContent(content);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "image",
        image: "https://example.com/photo.webp",
      });
    });
  });

  describe("GroqProvider", () => {
    it("should extract text only (no image support)", () => {
      const provider = new GroqProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const extractTextFromParts = (provider as any).extractTextFromParts.bind(provider);
      const parts: ContentPart[] = [
        { type: "text", text: "Hello" },
        {
          type: "image",
          source: {
            type: "base64",
            mediaType: "image/png",
            data: "imagedata",
          },
        },
        { type: "text", text: "World" },
      ];

      const result = extractTextFromParts(parts);

      // Groq should only extract text, ignoring images
      expect(result).toBe("Hello\nWorld");
    });

    it("should handle messages with image content by extracting text", () => {
      const provider = new GroqProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertMessages = (provider as any).convertMessages.bind(provider);
      const messages: LLMMessage[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image" },
            {
              type: "image",
              source: {
                type: "base64",
                mediaType: "image/png",
                data: "base64data",
              },
            },
          ],
        },
      ];

      const result = convertMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("user");
      // Content should be extracted text only
      expect(result[0].content).toBe("Describe this image");
    });
  });

  describe("OpenRouterProvider", () => {
    it("should convert image content parts like OpenAI", () => {
      const provider = new OpenRouterProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const content: ContentPart[] = [
        { type: "text", text: "Analyze this:" },
        {
          type: "image",
          source: {
            type: "base64",
            mediaType: "image/gif",
            data: "gifdata",
          },
        },
      ];

      const result = convertUserContent(content);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "image",
        image: "gifdata",
        mimeType: "image/gif",
      });
    });
  });

  describe("XAIProvider", () => {
    it("should convert image content parts", () => {
      const provider = new XAIProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const content: ContentPart[] = [
        { type: "text", text: "What is this?" },
        {
          type: "image",
          source: {
            type: "base64",
            mediaType: "image/webp",
            data: "webpdata",
          },
        },
      ];

      const result = convertUserContent(content);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        type: "image",
        image: "webpdata",
        mimeType: "image/webp",
      });
    });
  });

  describe("Message content type handling", () => {
    it("should preserve string content for user messages", () => {
      const provider = new AnthropicProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertMessages = (provider as any).convertMessages.bind(provider);
      const messages: LLMMessage[] = [
        { role: "user", content: "Simple text message" },
      ];

      const result = convertMessages(messages);

      expect(result[0].content).toBe("Simple text message");
    });

    it("should handle assistant messages with content parts by extracting text", () => {
      const provider = new AnthropicProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertMessages = (provider as any).convertMessages.bind(provider);
      const messages: LLMMessage[] = [
        { role: "user", content: "Hello" },
        {
          role: "assistant",
          content: [
            { type: "text", text: "Hi there!" },
            { type: "text", text: "How can I help?" },
          ],
        },
      ];

      const result = convertMessages(messages);

      expect(result).toHaveLength(2);
      // Assistant content should be text with content parts combined
      expect(result[1].role).toBe("assistant");
      // The content array includes both text parts
      const assistantContent = result[1].content;
      expect(Array.isArray(assistantContent)).toBe(true);
    });

    it("should handle multiple images in single message", () => {
      const provider = new OpenAIProvider({
        auth: { type: "api-key", apiKey: "test-key" },
      });

      const convertUserContent = (provider as any).convertUserContent.bind(provider);
      const content: ContentPart[] = [
        { type: "text", text: "Compare:" },
        {
          type: "image",
          source: { type: "base64", mediaType: "image/png", data: "img1" },
        },
        {
          type: "image",
          source: { type: "url", url: "https://example.com/img2.jpg" },
        },
      ];

      const result = convertUserContent(content);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: "text", text: "Compare:" });
      expect(result[1]).toEqual({ type: "image", image: "img1", mimeType: "image/png" });
      expect(result[2]).toEqual({ type: "image", image: "https://example.com/img2.jpg" });
    });
  });
});
