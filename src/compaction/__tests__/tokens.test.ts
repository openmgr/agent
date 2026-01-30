import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
} from "../tokens.js";
import {
  createUserMessage,
  createAssistantMessage,
  createToolResultMessage,
  createToolCall,
  createToolResult,
} from "../../__tests__/fixtures/messages.js";

describe("estimateTokens", () => {
  it("estimates tokens for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates tokens based on character count / 4", () => {
    // 4 chars = 1 token
    expect(estimateTokens("test")).toBe(1);
    // 8 chars = 2 tokens
    expect(estimateTokens("testtest")).toBe(2);
  });

  it("rounds up partial tokens", () => {
    // 5 chars should round up to 2 tokens
    expect(estimateTokens("tests")).toBe(2);
    // 1 char should round up to 1 token
    expect(estimateTokens("a")).toBe(1);
  });

  it("handles long text", () => {
    const longText = "a".repeat(1000);
    expect(estimateTokens(longText)).toBe(250);
  });
});

describe("estimateMessageTokens", () => {
  it("estimates tokens for simple user message", () => {
    const message = createUserMessage("Hello, how are you?");
    const tokens = estimateMessageTokens(message);
    expect(tokens).toBe(Math.ceil("Hello, how are you?".length / 4));
  });

  it("estimates tokens for assistant message with tool calls", () => {
    const toolCall = createToolCall("read", { path: "test.txt" });
    const message = createAssistantMessage("Let me read that file.", {
      toolCalls: [toolCall],
    });

    const tokens = estimateMessageTokens(message);
    
    // Content + tool name + arguments
    const expectedContent = Math.ceil("Let me read that file.".length / 4);
    const expectedToolName = Math.ceil("read".length / 4);
    const expectedToolArgs = Math.ceil(JSON.stringify({ path: "test.txt" }).length / 4);
    
    expect(tokens).toBe(expectedContent + expectedToolName + expectedToolArgs);
  });

  it("estimates tokens for message with tool results", () => {
    const message = createToolResultMessage([
      createToolResult("read", "File contents here"),
    ]);

    const tokens = estimateMessageTokens(message);
    
    // Empty content + tool result
    expect(tokens).toBe(Math.ceil("File contents here".length / 4));
  });

  it("handles multiple tool calls", () => {
    const message = createAssistantMessage("", {
      toolCalls: [
        createToolCall("read", { path: "a.txt" }),
        createToolCall("read", { path: "b.txt" }),
      ],
    });

    const tokens = estimateMessageTokens(message);
    expect(tokens).toBeGreaterThan(0);
  });

  it("handles multiple tool results", () => {
    const message = createToolResultMessage([
      createToolResult("read", "Content A"),
      createToolResult("read", "Content B"),
    ]);

    const tokens = estimateMessageTokens(message);
    const expectedA = Math.ceil("Content A".length / 4);
    const expectedB = Math.ceil("Content B".length / 4);
    expect(tokens).toBe(expectedA + expectedB);
  });
});

describe("estimateConversationTokens", () => {
  it("returns 0 for empty conversation", () => {
    expect(estimateConversationTokens([])).toBe(0);
  });

  it("sums tokens across messages", () => {
    const messages = [
      createUserMessage("Hello"),
      createAssistantMessage("Hi there!"),
    ];

    const total = estimateConversationTokens(messages);
    const expected =
      estimateMessageTokens(messages[0]) +
      estimateMessageTokens(messages[1]);

    expect(total).toBe(expected);
  });

  it("handles complex conversation with tool use", () => {
    const messages = [
      createUserMessage("Read the file"),
      createAssistantMessage("", {
        toolCalls: [createToolCall("read", { path: "test.txt" })],
      }),
      createToolResultMessage([
        createToolResult("read", "File contents..."),
      ]),
      createAssistantMessage("The file contains..."),
    ];

    const total = estimateConversationTokens(messages);
    expect(total).toBeGreaterThan(0);

    // Verify it equals sum of individual messages
    const manualSum = messages.reduce(
      (sum, msg) => sum + estimateMessageTokens(msg),
      0
    );
    expect(total).toBe(manualSum);
  });
});
