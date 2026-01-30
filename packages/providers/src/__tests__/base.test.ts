import { describe, it, expect } from 'vitest';
import { convertMessagesWithSystem, convertMessagesAnthropic } from '../base.js';
import type { LLMMessage, ContentPart } from '@openmgr/agent-core';

// Helper functions that match the expected signatures
function extractText(parts: ContentPart[]): string {
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('\n');
}

function convertContent(
  content: string | ContentPart[]
): string | Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }> {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text };
    } else if (part.type === 'image') {
      if (part.source.type === 'base64') {
        return {
          type: 'image' as const,
          image: part.source.data,
          mimeType: part.source.mediaType,
        };
      } else {
        return {
          type: 'image' as const,
          image: part.source.url,
        };
      }
    }
    throw new Error(`Unknown content part type`);
  });
}

describe('convertMessagesWithSystem', () => {
  it('should add system message as first message when provided', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    const result = convertMessagesWithSystem(messages, 'You are a helpful assistant', extractText, convertContent);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'system', content: 'You are a helpful assistant' });
    expect(result[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('should not add system message when undefined', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    const result = convertMessagesWithSystem(messages, undefined, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('should convert user, assistant, and system messages', () => {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'Additional context' },
      { role: 'user', content: 'Question?' },
      { role: 'assistant', content: 'Answer!' },
    ];
    const result = convertMessagesWithSystem(messages, undefined, extractText, convertContent);
    
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ role: 'system', content: 'Additional context' });
    expect(result[1]).toEqual({ role: 'user', content: 'Question?' });
    expect(result[2]).toEqual({ role: 'assistant', content: 'Answer!' });
  });

  it('should handle user messages with content parts', () => {
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Look at this image' },
          { type: 'image', source: { type: 'url', url: 'https://example.com/image.png' } },
        ],
      },
    ];
    const result = convertMessagesWithSystem(messages, undefined, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toEqual([
      { type: 'text', text: 'Look at this image' },
      { type: 'image', image: 'https://example.com/image.png' },
    ]);
  });

  it('should extract text from assistant content parts', () => {
    const messages: LLMMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Line 1' },
          { type: 'text', text: 'Line 2' },
        ],
      },
    ];
    const result = convertMessagesWithSystem(messages, undefined, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'assistant', content: 'Line 1\nLine 2' });
  });
});

describe('convertMessagesAnthropic', () => {
  it('should convert user messages with string content', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    const result = convertMessagesAnthropic(messages, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('should convert user messages with tool results', () => {
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: '',
        toolResults: [
          { id: 'call_1', name: 'read_file', result: 'file contents', isError: false },
        ],
      },
    ];
    const result = convertMessagesAnthropic(messages, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'call_1',
          toolName: 'read_file',
          result: 'file contents',
          isError: false,
        },
      ],
    });
  });

  it('should convert assistant messages with text and tool calls', () => {
    const messages: LLMMessage[] = [
      {
        role: 'assistant',
        content: 'Let me read that file',
        toolCalls: [
          { id: 'call_1', name: 'read_file', arguments: { path: '/test.txt' } },
        ],
      },
    ];
    const result = convertMessagesAnthropic(messages, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me read that file' },
        { type: 'tool-call', toolCallId: 'call_1', toolName: 'read_file', args: { path: '/test.txt' } },
      ],
    });
  });

  it('should handle assistant messages with only tool calls', () => {
    const messages: LLMMessage[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call_1', name: 'read_file', arguments: { path: '/test.txt' } },
        ],
      },
    ];
    const result = convertMessagesAnthropic(messages, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'call_1', toolName: 'read_file', args: { path: '/test.txt' } },
      ],
    });
  });

  it('should skip empty assistant messages', () => {
    const messages: LLMMessage[] = [
      { role: 'assistant', content: '' },
      { role: 'assistant', content: '   ' },
    ];
    const result = convertMessagesAnthropic(messages, extractText, convertContent);
    
    expect(result).toHaveLength(0);
  });

  it('should handle multiple tool results', () => {
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: '',
        toolResults: [
          { id: 'call_1', name: 'read_file', result: 'content 1', isError: false },
          { id: 'call_2', name: 'write_file', result: 'ok', isError: false },
        ],
      },
    ];
    const result = convertMessagesAnthropic(messages, extractText, convertContent);
    
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('tool');
    expect((result[0] as { content: unknown[] }).content).toHaveLength(2);
  });
});
