import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import type { LLMStreamOptions, LLMStreamResult } from "@openmgr/agent-core";
import { BaseLLMProvider, convertMessagesWithSystem, type ProviderOptions } from "./base.js";

/**
 * Google AI provider (Gemini models)
 */
export class GoogleProvider extends BaseLLMProvider {
  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  private getClient() {
    const apiKey = this.auth.apiKey;
    if (!apiKey) {
      throw new Error("Google AI API key not configured. Pass apiKey option when creating the provider.");
    }
    return createGoogleGenerativeAI({ apiKey });
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
