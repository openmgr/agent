import { describe, it, expect, vi } from "vitest";
import { CompactionEngine } from "../engine.js";
import { DEFAULT_COMPACTION_CONFIG } from "../types.js";
import { createMockLLMProvider } from "../../__tests__/mocks/llm.js";
import {
  createUserMessage,
  createAssistantMessage,
  createToolResultMessage,
  createToolCall,
  createToolResult,
} from "../../__tests__/fixtures/messages.js";
import type { Message } from "../../types.js";

describe("CompactionEngine", () => {
  const createEngine = (config = {}) => {
    const provider = createMockLLMProvider({
      responses: [{ content: "## Summary\n\nThis is a test summary." }],
    });
    return new CompactionEngine(provider, "claude-sonnet-4-20250514", config);
  };

  describe("shouldCompact", () => {
    it("returns null when compaction is disabled", () => {
      const engine = createEngine({ enabled: false });
      const messages = [createUserMessage("Hello")];
      
      expect(engine.shouldCompact(messages)).toBeNull();
    });

    it("returns null when under token threshold", () => {
      const engine = createEngine({
        enabled: true,
        tokenThreshold: 0.8,
        inceptionCount: 2,
        workingWindowCount: 2,
      });
      
      // Short conversation under threshold
      const messages = [
        createUserMessage("Hello"),
        createAssistantMessage("Hi!"),
      ];

      expect(engine.shouldCompact(messages)).toBeNull();
    });

    it("returns stats when over token threshold", () => {
      const engine = createEngine({
        enabled: true,
        tokenThreshold: 0.00001, // Extremely low threshold to guarantee trigger
        inceptionCount: 1,
        workingWindowCount: 1,
      });

      // Create longer messages to ensure we exceed threshold
      const longContent = "A".repeat(1000);
      const messages = [
        createUserMessage(longContent + " first"),
        createAssistantMessage(longContent + " response 1"),
        createUserMessage(longContent + " second"),
        createAssistantMessage(longContent + " response 2"),
        createUserMessage(longContent + " third"),
        createAssistantMessage(longContent + " response 3"),
      ];

      const result = engine.shouldCompact(messages);
      expect(result).not.toBeNull();
      expect(result?.messagesToCompact).toBeGreaterThan(0);
    });

    it("returns null when all messages are in inception or working window", () => {
      const engine = createEngine({
        enabled: true,
        tokenThreshold: 0.001,
        inceptionCount: 3,
        workingWindowCount: 3,
      });

      // Only 4 messages - all fit in windows
      const messages = [
        createUserMessage("First"),
        createAssistantMessage("Second"),
        createUserMessage("Third"),
        createAssistantMessage("Fourth"),
      ];

      expect(engine.shouldCompact(messages)).toBeNull();
    });

    it("returns stats based on message threshold when set", () => {
      const engine = createEngine({
        enabled: true,
        tokenThreshold: 0.99, // Very high token threshold
        messageThreshold: 4, // But low message threshold
        inceptionCount: 1,
        workingWindowCount: 1,
      });

      const messages = [
        createUserMessage("1"),
        createAssistantMessage("2"),
        createUserMessage("3"),
        createAssistantMessage("4"),
        createUserMessage("5"),
        createAssistantMessage("6"),
      ];

      const result = engine.shouldCompact(messages);
      expect(result).not.toBeNull();
    });
  });

  describe("compact", () => {
    it("calls LLM to generate summary", async () => {
      const provider = createMockLLMProvider({
        responses: [{ content: "Test summary content" }],
      });
      const engine = new CompactionEngine(provider, "claude-sonnet-4-20250514", {
        inceptionCount: 1,
        workingWindowCount: 1,
      });

      const messages = [
        createUserMessage("First"),
        createAssistantMessage("Second"),
        createUserMessage("Third"),
        createAssistantMessage("Fourth"),
      ];

      const result = await engine.compact(messages);

      expect(result.summary).toBe("Test summary content");
      expect(result.compactionId).toBeDefined();
      expect(result.messagesPruned).toBe(2); // Messages between inception and working
    });

    it("throws when no messages to compact", async () => {
      const engine = createEngine({
        inceptionCount: 5,
        workingWindowCount: 5,
      });

      const messages = [
        createUserMessage("First"),
        createAssistantMessage("Second"),
      ];

      await expect(engine.compact(messages)).rejects.toThrow("No messages to compact");
    });

    it("calculates compression ratio", async () => {
      const provider = createMockLLMProvider({
        responses: [{ content: "Short" }],
      });
      const engine = new CompactionEngine(provider, "claude-sonnet-4-20250514", {
        inceptionCount: 1,
        workingWindowCount: 1,
      });

      const messages = [
        createUserMessage("This is a longer message"),
        createAssistantMessage("This is also a longer response message"),
        createUserMessage("And another long message here"),
        createAssistantMessage("Final long response"),
      ];

      const result = await engine.compact(messages);

      expect(result.originalTokens).toBeGreaterThan(0);
      expect(result.compactedTokens).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThan(1); // Summary should be shorter
    });

    it("uses custom model for summarization when configured", async () => {
      let calledWithModel: string | undefined;
      
      const provider = createMockLLMProvider({
        streamImpl: async (params) => {
          calledWithModel = params.model;
          return {
            stream: (async function* () {
              yield { type: "text" as const, text: "Summary" };
            })(),
            response: Promise.resolve({ content: "Summary", toolCalls: [] }),
          };
        },
      });

      const engine = new CompactionEngine(provider, "claude-sonnet-4-20250514", {
        model: "claude-3-haiku",
        inceptionCount: 1,
        workingWindowCount: 1,
      });

      const messages = [
        createUserMessage("First"),
        createAssistantMessage("Second"),
        createUserMessage("Third"),
        createAssistantMessage("Fourth"),
      ];

      await engine.compact(messages);

      expect(calledWithModel).toBe("claude-3-haiku");
    });
  });

  describe("buildCompactedMessages", () => {
    it("builds messages with inception, summary, and working window", () => {
      const engine = createEngine({
        inceptionCount: 2,
        workingWindowCount: 2,
      });

      const messages = [
        createUserMessage("Inception 1"),
        createAssistantMessage("Inception 2"),
        createUserMessage("Middle 1"),
        createAssistantMessage("Middle 2"),
        createUserMessage("Working 1"),
        createAssistantMessage("Working 2"),
      ];

      const result = engine.buildCompactedMessages(messages, "Test summary");

      // Should have: 2 inception + 1 summary + 2 working = 5 messages
      expect(result.length).toBe(5);
      
      // Check inception messages preserved
      expect(result[0].content).toBe("Inception 1");
      expect(result[1].content).toBe("Inception 2");
      
      // Check summary message
      expect(result[2].content).toContain("[Previous conversation summary]");
      expect(result[2].content).toContain("Test summary");
      
      // Check working messages preserved
      expect(result[3].content).toBe("Working 1");
      expect(result[4].content).toBe("Working 2");
    });

    it("handles overlapping windows gracefully", () => {
      const engine = createEngine({
        inceptionCount: 3,
        workingWindowCount: 3,
      });

      const messages = [
        createUserMessage("First"),
        createAssistantMessage("Second"),
        createUserMessage("Third"),
        createAssistantMessage("Fourth"),
      ];

      const result = engine.buildCompactedMessages(messages, "Summary");

      // With 4 messages and windows of 3 each, there's overlap
      // Should still produce valid output
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getConfig / updateConfig", () => {
    it("returns current config", () => {
      const engine = createEngine({
        tokenThreshold: 0.7,
        inceptionCount: 5,
      });

      const config = engine.getConfig();
      expect(config.tokenThreshold).toBe(0.7);
      expect(config.inceptionCount).toBe(5);
    });

    it("updates config", () => {
      const engine = createEngine({ tokenThreshold: 0.8 });

      engine.updateConfig({ tokenThreshold: 0.6 });

      expect(engine.getConfig().tokenThreshold).toBe(0.6);
    });

    it("partial update preserves other config", () => {
      const engine = createEngine({
        tokenThreshold: 0.8,
        inceptionCount: 3,
      });

      engine.updateConfig({ tokenThreshold: 0.6 });

      expect(engine.getConfig().inceptionCount).toBe(3);
    });
  });
});
