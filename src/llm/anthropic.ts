import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, type CoreMessage } from "ai";
import { z } from "zod";
import { BaseLLMProvider, type ProviderOptions } from "./provider.js";
import { getValidAccessToken, createOAuthFetch } from "../auth/anthropic/index.js";
import type {
  LLMMessage,
  LLMTool,
  LLMStreamResult,
  LLMStreamChunk,
  LLMResponse,
  ToolCall,
  LLMStreamOptions,
  ContentPart,
} from "../types.js";

export class AnthropicProvider extends BaseLLMProvider {
  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  private async getClient() {
    if (this.auth.type === "api-key") {
      const apiKey = this.auth.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("Anthropic API key not configured. Run 'openmgr-agent config set-key anthropic <key>' or set ANTHROPIC_API_KEY");
      }
      return { client: createAnthropic({ apiKey }), isOAuth: false };
    }

    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      throw new Error("Not logged in. Run 'openmgr-agent login anthropic' to authenticate");
    }

    const oauthFetch = await createOAuthFetch();

    return {
      client: createAnthropic({
        apiKey: "",
        fetch: oauthFetch,
        // These headers trigger the SDK to include claude-code-20250219 beta,
        // which our fetch interceptor will detect and preserve
        headers: {
          "anthropic-beta": "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
        },
      }),
      isOAuth: true,
    };
  }

  async stream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    const { client } = await this.getClient();
    const aiTools = this.convertTools(options.tools ?? []);
    const aiMessages = this.convertMessages(options.messages);

    const result = streamText({
      model: client(options.model),
      messages: aiMessages,
      tools: aiTools,
      system: options.system,
      abortSignal: options.abortSignal,
      maxSteps: 1,
      ...(options.maxTokens !== undefined && { maxTokens: options.maxTokens }),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
    });

    const stream = this.createStream(result);
    const response = this.createResponse(result);

    return { stream, response };
  }

  private convertTools(
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

  private convertMessages(messages: LLMMessage[]): CoreMessage[] {
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
          // Handle content that could be string or ContentPart[]
          const userContent = this.convertUserContent(msg.content);
          result.push({ role: "user", content: userContent });
        }
      } else if (msg.role === "assistant") {
        const content: Array<{ type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }> = [];

        // Assistant messages always have string content (no images in assistant messages)
        const textContent = typeof msg.content === "string" ? msg.content : this.extractTextFromParts(msg.content);
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

  private convertUserContent(
    content: string | ContentPart[]
  ): string | Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> {
    if (typeof content === "string") {
      return content;
    }

    // Convert ContentPart[] to AI SDK format
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
          // URL-based image
          return {
            type: "image" as const,
            image: part.source.url,
          };
        }
      }
      // This should never happen due to discriminated union
      throw new Error(`Unknown content part type: ${JSON.stringify(part)}`);
    });
  }

  private extractTextFromParts(parts: ContentPart[]): string {
    return parts
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("\n");
  }

  private async *createStream(
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
        const error = part.error as { message?: string; data?: { error?: { message?: string; type?: string } } };
        const apiMessage = error.data?.error?.message ?? error.message ?? "Unknown API error";
        const errorType = error.data?.error?.type;

        if (errorType === "authentication_error" && this.auth.type === "oauth") {
          throw new Error(`OAuth error: ${apiMessage}. Try running 'openmgr-agent logout anthropic' then 'openmgr-agent login anthropic' to re-authenticate.`);
        }
        throw new Error(apiMessage);
      }
    }
  }

  private async createResponse(
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
