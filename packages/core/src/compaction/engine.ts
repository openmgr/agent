import { generateId } from "../utils/id.js";
import type { Message, LLMProvider } from "../types.js";
import type { CompactionConfig, CompactionResult, CompactionStats } from "./types.js";
import { DEFAULT_COMPACTION_CONFIG, getModelLimit } from "./types.js";
import { estimateTokens, estimateConversationTokens } from "./tokens.js";

const SUMMARY_PROMPT = `You are a conversation summarizer. Summarize the following conversation history into a structured summary that captures all important context. 

The summary should include:
## Tasks Completed
- [Bullet list of completed tasks with outcomes]

## Files Modified
- [List of files with brief description of changes]

## Key Decisions
- [Important decisions made and their rationale]

## Problems Encountered
- [Any errors, blockers, or issues]

## Current State
[Where we are - 1-2 sentences]

## Next Steps
- [Unfinished work or pending items]

Be thorough but concise. This summary will replace the original messages to maintain context.

Conversation to summarize:
`;

export class CompactionEngine {
  private config: CompactionConfig;
  private provider: LLMProvider;
  private model: string;

  constructor(
    provider: LLMProvider,
    model: string,
    config: Partial<CompactionConfig> = {}
  ) {
    this.provider = provider;
    this.model = model;
    this.config = { ...DEFAULT_COMPACTION_CONFIG, ...config };
  }

  shouldCompact(messages: Message[]): CompactionStats | null {
    if (!this.config.enabled) return null;

    const modelLimit = getModelLimit(this.model);
    const thresholdTokens = Math.floor(modelLimit * this.config.tokenThreshold);
    const currentTokens = estimateConversationTokens(messages);

    if (currentTokens < thresholdTokens) {
      if (this.config.messageThreshold && messages.length >= this.config.messageThreshold) {
        const messagesToCompact = this.getMessagesToCompact(messages);
        if (messagesToCompact.length === 0) return null;

        return {
          currentTokens,
          threshold: thresholdTokens,
          messagesToCompact: messagesToCompact.length,
        };
      }
      return null;
    }

    const messagesToCompact = this.getMessagesToCompact(messages);
    if (messagesToCompact.length === 0) return null;

    return {
      currentTokens,
      threshold: thresholdTokens,
      messagesToCompact: messagesToCompact.length,
    };
  }

  private getMessagesToCompact(messages: Message[]): Message[] {
    const inceptionEnd = Math.min(this.config.inceptionCount, messages.length);
    const workingStart = Math.max(
      inceptionEnd,
      messages.length - this.config.workingWindowCount
    );

    if (workingStart <= inceptionEnd) {
      return [];
    }

    return messages.slice(inceptionEnd, workingStart);
  }

  async compact(messages: Message[]): Promise<CompactionResult> {
    const messagesToCompact = this.getMessagesToCompact(messages);

    if (messagesToCompact.length === 0) {
      throw new Error("No messages to compact");
    }

    const originalTokens = estimateConversationTokens(messagesToCompact);

    const conversationText = this.formatMessagesForSummary(messagesToCompact);
    const summaryPrompt = SUMMARY_PROMPT + conversationText;

    const summaryModel = this.config.model ?? this.model;
    const { response } = await this.provider.stream({
      model: summaryModel,
      messages: [{ role: "user", content: summaryPrompt }],
      system: "You are a helpful assistant that creates structured summaries.",
    });

    const finalResponse = await response;
    const summary = finalResponse.content;

    const compactedTokens = estimateTokens(summary);
    const compressionRatio = originalTokens > 0 ? compactedTokens / originalTokens : 1;
    const compactionId = generateId();

    return {
      compactionId,
      summary,
      originalTokens,
      compactedTokens,
      messagesPruned: messagesToCompact.length,
      compressionRatio,
    };
  }

  buildCompactedMessages(
    messages: Message[],
    summary: string
  ): Message[] {
    const inceptionMessages = messages.slice(
      0,
      Math.min(this.config.inceptionCount, messages.length)
    );
    const workingMessages = messages.slice(
      Math.max(
        this.config.inceptionCount,
        messages.length - this.config.workingWindowCount
      )
    );

    const summaryMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: `[Previous conversation summary]\n\n${summary}`,
      createdAt: Date.now(),
    };

    return [...inceptionMessages, summaryMessage, ...workingMessages];
  }

  private formatMessagesForSummary(messages: Message[]): string {
    const parts: string[] = [];

    for (const msg of messages) {
      const role = msg.role === "user" ? "User" : "Assistant";

      if (msg.content) {
        parts.push(`${role}: ${msg.content}`);
      }

      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          parts.push(`${role} called tool: ${tc.name}`);
        }
      }

      if (msg.toolResults) {
        for (const tr of msg.toolResults) {
          const status = tr.isError ? "failed" : "succeeded";
          const preview = String(tr.result).slice(0, 200);
          parts.push(`Tool ${tr.name} ${status}: ${preview}${String(tr.result).length > 200 ? "..." : ""}`);
        }
      }
    }

    return parts.join("\n\n");
  }

  getConfig(): CompactionConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<CompactionConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
