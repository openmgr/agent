import type { Message } from "../types.js";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateMessageTokens(message: Message): number {
  let tokens = estimateTokens(message.content);

  if (message.toolCalls) {
    for (const tc of message.toolCalls) {
      tokens += estimateTokens(tc.name);
      tokens += estimateTokens(JSON.stringify(tc.arguments));
    }
  }

  if (message.toolResults) {
    for (const tr of message.toolResults) {
      tokens += estimateTokens(String(tr.result));
    }
  }

  return tokens;
}

export function estimateConversationTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}
