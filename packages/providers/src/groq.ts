import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type CoreMessage } from "ai";
import type { LLMStreamOptions, LLMStreamResult, LLMMessage, ContentPart } from "@openmgr/agent-core";
import { BaseLLMProvider, type ProviderOptions } from "./base.js";

/**
 * Groq provider (fast inference)
 * Uses OpenAI-compatible API with custom base URL
 * Note: Groq doesn't support images, so all content is converted to text
 */
export class GroqProvider extends BaseLLMProvider {
  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  private getClient() {
    const apiKey = this.auth.apiKey;
    if (!apiKey) {
      throw new Error("Groq API key not configured. Pass apiKey option when creating the provider.");
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

  /**
   * Convert messages for Groq (text only, no images)
   */
  private convertMessages(messages: LLMMessage[], system?: string): CoreMessage[] {
    const result: CoreMessage[] = [];

    if (system) {
      result.push({ role: "system", content: system });
    }

    for (const msg of messages) {
      // Groq doesn't support images, so always extract text
      const textContent = typeof msg.content === "string" 
        ? msg.content 
        : this.extractTextFromParts(msg.content as ContentPart[]);
      
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
}
