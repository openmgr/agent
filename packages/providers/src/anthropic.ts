import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import type { LLMStreamOptions, LLMStreamResult } from "@openmgr/agent-core";
import { BaseLLMProvider, convertMessagesAnthropic, type ProviderOptions } from "./base.js";

/**
 * Anthropic provider (Claude models)
 * 
 * Note: This provider only supports API key authentication.
 * For OAuth authentication with Anthropic, use the @openmgr/agent-auth-anthropic package.
 */
export class AnthropicProvider extends BaseLLMProvider {
  constructor(options: ProviderOptions = {}) {
    super(options);
  }

  private getClient() {
    const apiKey = this.auth.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable or pass apiKey option.");
    }
    return createAnthropic({ apiKey });
  }

  async stream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    const client = this.getClient();
    const aiTools = this.convertTools(options.tools ?? []);
    const aiMessages = convertMessagesAnthropic(
      options.messages,
      this.extractTextFromParts.bind(this),
      this.convertUserContent.bind(this)
    );

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
}
