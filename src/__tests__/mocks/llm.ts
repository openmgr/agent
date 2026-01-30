import { vi } from "vitest";
import type { LLMProvider, LLMMessage, LLMTool, ToolCall, LLMStreamChunk, LLMResponse } from "../../types.js";

type StreamChunk = LLMStreamChunk;

/**
 * Mock streaming chunk generators
 */
export function* textChunks(text: string, chunkSize = 10): Generator<StreamChunk> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield {
      type: "text",
      text: text.slice(i, i + chunkSize),
    };
  }
}

export function* toolCallChunks(toolCalls: ToolCall[]): Generator<StreamChunk> {
  for (const toolCall of toolCalls) {
    yield {
      type: "tool_call",
      toolCall,
    };
  }
}

/**
 * Create a mock LLM response
 */
export function createMockResponse(options: {
  content?: string;
  toolCalls?: ToolCall[];
}): LLMResponse {
  return {
    content: options.content ?? "",
    toolCalls: options.toolCalls ?? [],
  };
}

/**
 * Create a mock async generator for streaming
 */
export async function* createMockStream(
  chunks: StreamChunk[]
): AsyncGenerator<StreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Create a mock LLM provider
 */
export function createMockLLMProvider(options: {
  /** Responses to return in order (cycles back to first when exhausted) */
  responses?: Array<{
    content?: string;
    toolCalls?: ToolCall[];
  }>;
  /** Custom stream implementation */
  streamImpl?: LLMProvider["stream"];
}): LLMProvider {
  const responses = options.responses ?? [{ content: "Mock response" }];
  let responseIndex = 0;

  const stream: LLMProvider["stream"] = options.streamImpl ?? (async (_params) => {
    const response = responses[responseIndex % responses.length];
    responseIndex++;

    const chunks: StreamChunk[] = [];
    
    if (response.content) {
      chunks.push(...Array.from(textChunks(response.content)));
    }
    
    if (response.toolCalls?.length) {
      chunks.push(...Array.from(toolCallChunks(response.toolCalls)));
    }

    return {
      stream: createMockStream(chunks),
      response: Promise.resolve(createMockResponse(response)),
    };
  });

  return {
    stream,
  };
}

/**
 * Create a mock tool call
 */
export function createMockToolCall(
  name: string,
  args: Record<string, unknown> = {},
  id?: string
): ToolCall {
  return {
    id: id ?? `call_${Math.random().toString(36).slice(2, 11)}`,
    name,
    arguments: args,
  };
}

/**
 * Create spy functions for tracking LLM calls
 */
export function createLLMSpies() {
  const streamCalls: Array<{
    model: string;
    messages: LLMMessage[];
    tools?: LLMTool[];
    system?: string;
  }> = [];

  const mockProvider = createMockLLMProvider({
    streamImpl: async (params) => {
      streamCalls.push({
        model: params.model,
        messages: params.messages,
        tools: params.tools,
        system: params.system,
      });

      return {
        stream: createMockStream([{ type: "text", text: "Mocked response" }]),
        response: Promise.resolve({ content: "Mocked response", toolCalls: [] }),
      };
    },
  });

  return {
    provider: mockProvider,
    streamCalls,
    getLastCall: () => streamCalls[streamCalls.length - 1],
    reset: () => {
      streamCalls.length = 0;
    },
  };
}

/**
 * Helper to create a provider that returns specific tool calls
 */
export function createToolCallingProvider(toolCalls: ToolCall[]) {
  let called = false;
  
  return createMockLLMProvider({
    streamImpl: async (_params) => {
      if (!called) {
        called = true;
        return {
          stream: createMockStream(Array.from(toolCallChunks(toolCalls))),
          response: Promise.resolve({ content: "", toolCalls }),
        };
      }
      
      // After tool results, return a text response
      return {
        stream: createMockStream([{ type: "text", text: "Done with tools" }]),
        response: Promise.resolve({ content: "Done with tools", toolCalls: [] }),
      };
    },
  });
}
