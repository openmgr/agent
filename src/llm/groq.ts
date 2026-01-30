import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";
import { z } from "zod";
import { BaseLLMProvider, type ProviderOptions } from "./provider.js";
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

export class GroqProvider extends BaseLLMProvider {
  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  private getClient() {
    const apiKey = this.auth.apiKey ?? process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Groq API key not configured. Run 'openmgr-agent config set-key groq <key>' or set GROQ_API_KEY");
    }
    return createOpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  async stream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    const client = this.getClient();
    const aiTools = this.convertTools(options.tools ?? []);
    const aiMessages = this.convertMessages(options.messages, options.system);

    const result = streamText({
      model: client(options.model),
      messages: aiMessages,
      tools: aiTools,
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

  private convertMessages(messages: LLMMessage[], system?: string): CoreMessage[] {
    const result: CoreMessage[] = [];

    if (system) {
      result.push({ role: "system", content: system });
    }

    for (const msg of messages) {
      // Groq doesn't support images, so always extract text
      const textContent = typeof msg.content === "string" ? msg.content : this.extractTextFromParts(msg.content);
      if (msg.role === "system") {
        result.push({ role: "system", content: textContent });
      } else if (msg.role === "user") {
        result.push({ role: "user", content: textContent });
      } else if (msg.role === "assistant") {
        result.push({ role: "assistant", content: textContent });
      }
    }

    return result;
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
        const error = part.error as { message?: string; data?: { error?: { message?: string } } };
        const message = error.data?.error?.message ?? error.message ?? "Unknown API error";
        throw new Error(message);
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
