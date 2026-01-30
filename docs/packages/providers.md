# @openmgr/agent-providers

LLM provider implementations for OpenMgr Agent. This package provides unified access to multiple AI model providers through a consistent interface.

## Installation

```bash
pnpm add @openmgr/agent-providers
```

## Supported Providers

| Provider | Class | Models | Environment Variable |
|----------|-------|--------|---------------------|
| **Anthropic** | `AnthropicProvider` | Claude models | `ANTHROPIC_API_KEY` |
| **OpenAI** | `OpenAIProvider` | GPT models | `OPENAI_API_KEY` |
| **Google** | `GoogleProvider` | Gemini models | `GOOGLE_GENERATIVE_AI_API_KEY` |
| **OpenRouter** | `OpenRouterProvider` | Multi-model gateway | `OPENROUTER_API_KEY` |
| **Groq** | `GroqProvider` | Fast inference | `GROQ_API_KEY` |
| **xAI** | `XAIProvider` | Grok models | `XAI_API_KEY` |

## Usage

### With Agent

The simplest way to use providers is through the Agent:

```typescript
import { Agent } from "@openmgr/agent-core";

const agent = await Agent.create({
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
});
```

### Direct Provider Creation

Create providers directly using the factory function:

```typescript
import { createProvider } from "@openmgr/agent-providers";

const provider = createProvider("anthropic", {
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use the provider
const { stream, response } = await provider.stream({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: "Hello!" }],
  system: "You are a helpful assistant.",
});

// Stream responses
for await (const event of stream) {
  if (event.type === "text-delta") {
    process.stdout.write(event.textDelta);
  }
}
```

### Using Provider Classes Directly

```typescript
import { AnthropicProvider } from "@openmgr/agent-providers";

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

## Provider Plugin

Register all providers at once using the plugin:

```typescript
import { Agent } from "@openmgr/agent-core";
import { providersPlugin } from "@openmgr/agent-providers";

const agent = new Agent(config);
await agent.use(providersPlugin);
```

## API Reference

### ProviderOptions

```typescript
interface ProviderOptions {
  apiKey?: string;
  baseUrl?: string;
  [key: string]: unknown;
}
```

### LLMProvider Interface

All providers implement this interface:

```typescript
interface LLMProvider {
  stream(options: LLMStreamOptions): Promise<LLMStreamResult>;
}
```

### LLMStreamOptions

```typescript
interface LLMStreamOptions {
  model: string;
  messages: Message[];
  system?: string;
  tools?: LLMTool[];
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}
```

### LLMStreamResult

```typescript
interface LLMStreamResult {
  stream: AsyncIterable<LLMStreamEvent>;
  response: Promise<LLMResponse>;
}
```

## Provider-Specific Notes

### Anthropic

Uses Claude models with native support for:
- Streaming responses
- Tool use
- System prompts
- Image inputs

```typescript
const provider = createProvider("anthropic", {
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

### OpenAI

Compatible with GPT-4, GPT-3.5, and other OpenAI models:

```typescript
const provider = createProvider("openai", {
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Google

Uses Gemini models:

```typescript
const provider = createProvider("google", {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
```

### OpenRouter

Multi-model gateway supporting various providers:

```typescript
const provider = createProvider("openrouter", {
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

### Groq

Fast inference provider (text-only, no image support):

```typescript
const provider = createProvider("groq", {
  apiKey: process.env.GROQ_API_KEY,
});
```

### xAI

Grok models:

```typescript
const provider = createProvider("xai", {
  apiKey: process.env.XAI_API_KEY,
});
```

## Custom Providers

Create custom providers by extending `BaseLLMProvider`:

```typescript
import { BaseLLMProvider, ProviderOptions } from "@openmgr/agent-providers";

class CustomProvider extends BaseLLMProvider {
  constructor(options: ProviderOptions) {
    super(options);
  }

  async stream(options: LLMStreamOptions): Promise<LLMStreamResult> {
    // Implement streaming logic
  }
}
```

## Exports

```typescript
// Provider Classes
export { AnthropicProvider } from "./anthropic.js";
export { OpenAIProvider } from "./openai.js";
export { GoogleProvider } from "./google.js";
export { OpenRouterProvider } from "./openrouter.js";
export { GroqProvider } from "./groq.js";
export { XAIProvider } from "./xai.js";

// Base Class & Types
export { BaseLLMProvider, ProviderOptions } from "./base.js";

// Factory & Plugin
export { createProvider, providersPlugin, ProviderName } from "./index.js";
```

## Architecture

All providers use the [Vercel AI SDK](https://sdk.vercel.ai/) with provider-specific adapters:

- `@ai-sdk/anthropic` for Anthropic
- `@ai-sdk/openai` for OpenAI and OpenRouter
- `@ai-sdk/google` for Google
- `@ai-sdk/xai` for xAI

The `BaseLLMProvider` class handles common streaming and response conversion logic, while individual providers implement provider-specific message formatting and API calls.
