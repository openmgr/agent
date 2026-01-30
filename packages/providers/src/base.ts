import type {
  LLMProvider,
  LLMStreamOptions,
  LLMStreamResult,
  LLMStreamChunk,
  LLMResponse,
  LLMMessage,
  LLMTool,
  ToolCall,
  ContentPart,
  AuthConfig,
} from "@openmgr/agent-core";
import { streamText, type CoreMessage } from "ai";
import { z } from "zod";

export interface ProviderOptions {
  auth?: AuthConfig;
  apiKey?: string;
}

export abstract class BaseLLMProvider implements LLMProvider {
  protected auth: AuthConfig;

  constructor(options: ProviderOptions = {}) {
    this.auth = options.auth ?? { 
      type: "api-key", 
      apiKey: options.apiKey 
    };
  }

  abstract stream(options: LLMStreamOptions): Promise<LLMStreamResult>;

  /**
   * Convert our LLM tools to AI SDK format
   */
  protected convertTools(
    tools: LLMTool[]
  ): Record<string, { description: string; parameters: z.ZodType<unknown> }> {
    const aiTools: Record<
      string,
      { description: string; parameters: z.ZodType<unknown> }
    > = {};
    for (const tool of tools) {
      aiTools[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
      };
    }
    return aiTools;
  }

  /**
   * Convert user content (string or parts) to AI SDK format
   */
  protected convertUserContent(
    content: string | ContentPart[]
  ): string | Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> {
    if (typeof content === "string") {
      return content;
    }

    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      } else if (part.type === "image") {
        if (part.source.type === "base64") {
          return {
            type: "image" as const,
            image: part.source.data,
            mimeType: part.source.mediaType,
          };
        } else {
          return {
            type: "image" as const,
            image: part.source.url,
          };
        }
      }
      throw new Error(`Unknown content part type: ${JSON.stringify(part)}`);
    });
  }

  /**
   * Extract text from content parts (for providers that don't support images)
   */
  protected extractTextFromParts(parts: ContentPart[]): string {
    return parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("\n");
  }

  /**
   * Create async stream from AI SDK result
   */
  protected async *createStream(
    result: ReturnType<typeof streamText>
  ): AsyncIterable<LLMStreamChunk> {
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        yield { type: "text", text: part.textDelta };
      } else if (part.type === "tool-call") {
        yield {
          type: "tool_call",
          toolCall: {
            id: part.toolCallId,
            name: part.toolName,
            arguments: part.args as Record<string, unknown>,
          },
        };
      } else if (part.type === "error") {
        const error = part.error as { message?: string; data?: { error?: { message?: string } } };
        const message = error.data?.error?.message ?? error.message ?? "Unknown API error";
        throw new Error(message);
      }
    }
  }

  /**
   * Create response promise from AI SDK result
   */
  protected async createResponse(
    result: ReturnType<typeof streamText>
  ): Promise<LLMResponse> {
    const [text, toolCalls, usage] = await Promise.all([
      result.text,
      result.toolCalls,
      result.usage,
    ]);

    const mappedToolCalls: ToolCall[] = (toolCalls ?? []).map((tc) => ({
      id: tc.toolCallId,
      name: tc.toolName,
      arguments: tc.args as Record<string, unknown>,
    }));

    return {
      content: text,
      toolCalls: mappedToolCalls,
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.promptTokens + usage.completionTokens,
          }
        : undefined,
    };
  }
}

/**
 * Convert messages with system prompt for OpenAI-style providers
 * (system message as first message)
 */
export function convertMessagesWithSystem(
  messages: LLMMessage[],
  system: string | undefined,
  extractText: (parts: ContentPart[]) => string,
  convertContent: (content: string | ContentPart[]) => string | Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }>
): CoreMessage[] {
  const result: CoreMessage[] = [];

  if (system) {
    result.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (msg.role === "system") {
      const textContent = typeof msg.content === "string" ? msg.content : extractText(msg.content);
      result.push({ role: "system", content: textContent });
    } else if (msg.role === "user") {
      const content = convertContent(msg.content);
      result.push({ role: "user", content });
    } else if (msg.role === "assistant") {
      const textContent = typeof msg.content === "string" ? msg.content : extractText(msg.content);
      result.push({ role: "assistant", content: textContent });
    }
  }

  return result;
}

/**
 * Convert messages for Anthropic-style providers
 * (system prompt passed separately, tool results handled specially)
 */
export function convertMessagesAnthropic(
  messages: LLMMessage[],
  extractText: (parts: ContentPart[]) => string,
  convertContent: (content: string | ContentPart[]) => string | Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }>
): CoreMessage[] {
  const result: CoreMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      if (msg.toolResults?.length) {
        result.push({
          role: "tool",
          content: msg.toolResults.map((tr) => ({
            type: "tool-result" as const,
            toolCallId: tr.id,
            toolName: tr.name,
            result: tr.result,
            isError: tr.isError,
          })),
        });
      } else {
        const userContent = convertContent(msg.content);
        result.push({ role: "user", content: userContent });
      }
    } else if (msg.role === "assistant") {
      const content: Array<{ type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }> = [];

      const textContent = typeof msg.content === "string" ? msg.content : extractText(msg.content);
      if (textContent && textContent.trim()) {
        content.push({ type: "text", text: textContent });
      }

      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: "tool-call",
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.arguments,
          });
        }
      }

      if (content.length > 0) {
        result.push({ role: "assistant", content });
      }
    }
  }

  return result;
}
