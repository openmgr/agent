import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { LLMStreamOptions, LLMStreamResult } from "@openmgr/agent-core";
import { BaseLLMProvider, convertMessagesWithSystem, type ProviderOptions } from "./base.js";

/**
 * OpenRouter provider (multi-model gateway)
 * Uses OpenAI-compatible API with custom base URL
 */
export class OpenRouterProvider extends BaseLLMProvider {
  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  private getClient() {
    const apiKey = this.auth.apiKey ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable or pass apiKey option.");
    }
    return createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": "https://openmgr.ai",
        "X-Title": "OpenMgr Agent",
      },
    });
  }

  async stream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    const client = this.getClient();
    const aiTools = this.convertTools(options.tools ?? []);
    const aiMessages = convertMessagesWithSystem(
      options.messages,
      options.system,
      this.extractTextFromParts.bind(this),
      this.convertUserContent.bind(this)
    );

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
}
