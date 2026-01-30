import type { Message, ToolCall, ToolResult } from "../../types.js";
import { randomUUID } from "crypto";

/**
 * Create a user message
 */
export function createUserMessage(content: string, options: { id?: string; createdAt?: number } = {}): Message {
  return {
    id: options.id ?? randomUUID(),
    role: "user",
    content,
    createdAt: options.createdAt ?? Date.now(),
  };
}

/**
 * Create an assistant message
 */
export function createAssistantMessage(
  content: string,
  options: {
    id?: string;
    createdAt?: number;
    toolCalls?: ToolCall[];
  } = {}
): Message {
  return {
    id: options.id ?? randomUUID(),
    role: "assistant",
    content,
    toolCalls: options.toolCalls,
    createdAt: options.createdAt ?? Date.now(),
  };
}

/**
 * Create a tool result message (user message with tool results)
 */
export function createToolResultMessage(
  toolResults: ToolResult[],
  options: { id?: string; createdAt?: number } = {}
): Message {
  return {
    id: options.id ?? randomUUID(),
    role: "user",
    content: "",
    toolResults,
    createdAt: options.createdAt ?? Date.now(),
  };
}

/**
 * Create a tool call
 */
export function createToolCall(
  name: string,
  args: Record<string, unknown> = {},
  id?: string
): ToolCall {
  return {
    id: id ?? `call_${randomUUID().slice(0, 8)}`,
    name,
    arguments: args,
  };
}

/**
 * Create a tool result
 */
export function createToolResult(
  name: string,
  result: unknown,
  options: { id?: string; isError?: boolean } = {}
): ToolResult {
  return {
    id: options.id ?? `call_${randomUUID().slice(0, 8)}`,
    name,
    result,
    isError: options.isError,
  };
}

/**
 * Sample conversation fixtures
 */
export const sampleConversations = {
  simple: [
    createUserMessage("Hello"),
    createAssistantMessage("Hi there! How can I help you today?"),
  ],

  withToolUse: [
    createUserMessage("Read the README file"),
    createAssistantMessage("", {
      toolCalls: [createToolCall("read", { path: "README.md" })],
    }),
    createToolResultMessage([
      createToolResult("read", "# Project\n\nThis is a sample project."),
    ]),
    createAssistantMessage("The README contains a project description."),
  ],

  multiTurn: [
    createUserMessage("What files are in the src directory?"),
    createAssistantMessage("", {
      toolCalls: [createToolCall("glob", { pattern: "src/**/*.ts" })],
    }),
    createToolResultMessage([
      createToolResult("glob", ["src/index.ts", "src/utils.ts"]),
    ]),
    createAssistantMessage("There are 2 TypeScript files in src."),
    createUserMessage("Show me index.ts"),
    createAssistantMessage("", {
      toolCalls: [createToolCall("read", { path: "src/index.ts" })],
    }),
    createToolResultMessage([
      createToolResult("read", 'export const version = "1.0.0";'),
    ]),
    createAssistantMessage("Here's the content of index.ts - it exports a version constant."),
  ],
};
