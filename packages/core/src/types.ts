import { z } from "zod";

// ============================================================================
// Message Types
// ============================================================================

export const MessageRole = z.enum(["user", "assistant"]);
export type MessageRole = z.infer<typeof MessageRole>;

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ToolResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  result: z.unknown(),
  isError: z.boolean().optional(),
});
export type ToolResult = z.infer<typeof ToolResultSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRole,
  content: z.string(),
  toolCalls: z.array(ToolCallSchema).optional(),
  toolResults: z.array(ToolResultSchema).optional(),
  createdAt: z.number(),
});
export type Message = z.infer<typeof MessageSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  parentId: z.string().optional(),
  workingDirectory: z.string(),
  messages: z.array(MessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Session = z.infer<typeof SessionSchema>;

// ============================================================================
// Image/Multimodal Types
// ============================================================================

export const ImageSourceBase64Schema = z.object({
  type: z.literal("base64"),
  mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  data: z.string(),
});
export type ImageSourceBase64 = z.infer<typeof ImageSourceBase64Schema>;

export const ImageSourceUrlSchema = z.object({
  type: z.literal("url"),
  url: z.string().url(),
});
export type ImageSourceUrl = z.infer<typeof ImageSourceUrlSchema>;

export const ImagePartSchema = z.object({
  type: z.literal("image"),
  source: z.discriminatedUnion("type", [
    ImageSourceBase64Schema,
    ImageSourceUrlSchema,
  ]),
});
export type ImagePart = z.infer<typeof ImagePartSchema>;

export const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type TextPart = z.infer<typeof TextPartSchema>;

export const ContentPartSchema = z.discriminatedUnion("type", [
  TextPartSchema,
  ImagePartSchema,
]);
export type ContentPart = z.infer<typeof ContentPartSchema>;

// ============================================================================
// Agent Events
// ============================================================================

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("user.message"),
    messageId: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal("message.start"),
    messageId: z.string(),
  }),
  z.object({
    type: z.literal("message.delta"),
    messageId: z.string(),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("message.complete"),
    messageId: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal("tool.start"),
    messageId: z.string(),
    toolCall: ToolCallSchema,
  }),
  z.object({
    type: z.literal("tool.complete"),
    messageId: z.string(),
    toolResult: ToolResultSchema,
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("subagent.start"),
    sessionId: z.string(),
    parentSessionId: z.string(),
    description: z.string(),
    async: z.boolean(),
  }),
  z.object({
    type: z.literal("subagent.complete"),
    sessionId: z.string(),
    parentSessionId: z.string(),
    result: z.string(),
  }),
  z.object({
    type: z.literal("subagent.error"),
    sessionId: z.string(),
    parentSessionId: z.string(),
    error: z.string(),
  }),
  z.object({
    type: z.literal("mcp.server.connected"),
    serverName: z.string(),
    toolCount: z.number(),
  }),
  z.object({
    type: z.literal("mcp.server.disconnected"),
    serverName: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("compaction.pending"),
    stats: z.object({
      currentTokens: z.number(),
      threshold: z.number(),
      messagesToCompact: z.number(),
    }),
  }),
  z.object({
    type: z.literal("compaction.start"),
    stats: z.object({
      currentTokens: z.number(),
      threshold: z.number(),
      messagesToCompact: z.number(),
    }),
  }),
  z.object({
    type: z.literal("compaction.complete"),
    compactionId: z.string(),
    stats: z.object({
      originalTokens: z.number(),
      compactedTokens: z.number(),
      messagesPruned: z.number(),
      compressionRatio: z.number(),
    }),
  }),
  z.object({
    type: z.literal("compaction.error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("command.result"),
    command: z.string(),
    output: z.string(),
  }),
  // Background task events (emitted by tools-terminal plugin)
  z.object({
    type: z.literal("background_task.start"),
    taskId: z.string(),
    command: z.string(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("background_task.complete"),
    taskId: z.string(),
    command: z.string(),
    exitCode: z.number(),
    onComplete: z.string().optional(),
  }),
  z.object({
    type: z.literal("background_task.failed"),
    taskId: z.string(),
    command: z.string(),
    exitCode: z.number(),
    onComplete: z.string().optional(),
  }),
  z.object({
    type: z.literal("background_task.cancelled"),
    taskId: z.string(),
    command: z.string(),
  }),
  z.object({
    type: z.literal("background_task.check_back"),
    taskId: z.string(),
    command: z.string(),
    description: z.string(),
  }),
  // Tool permission events
  z.object({
    type: z.literal("tool.permission.request"),
    messageId: z.string(),
    toolCall: ToolCallSchema,
  }),
  z.object({
    type: z.literal("tool.permission.granted"),
    messageId: z.string(),
    toolName: z.string(),
    allowAlways: z.boolean(),
  }),
  z.object({
    type: z.literal("tool.permission.denied"),
    messageId: z.string(),
    toolName: z.string(),
  }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

// ============================================================================
// LLM Types
// ============================================================================

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface LLMTool {
  name: string;
  description: string;
  parameters: z.ZodType<unknown>;
}

export interface LLMStreamResult {
  stream: AsyncIterable<LLMStreamChunk>;
  response: Promise<LLMResponse>;
}

export interface LLMStreamChunk {
  type: "text" | "tool_call";
  text?: string;
  toolCall?: ToolCall;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStreamOptions {
  model: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  system?: string;
  abortSignal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  stream(options: LLMStreamOptions): Promise<LLMStreamResult>;
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolDefinition<TParams = unknown> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  execute: (params: TParams, ctx: ToolContext) => Promise<ToolExecuteResult>;
}

export interface ToolExecuteResult {
  output: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context provided to tools during execution.
 * Plugins can extend this via the `extensions` field.
 */
export interface ToolContext {
  workingDirectory: string;
  abortSignal?: AbortSignal;
  sessionId?: string;
  
  // In-memory state (managed by core)
  getTodos?: () => TodoItem[];
  setTodos?: (todos: TodoItem[]) => void;
  getPhases?: () => PhaseItem[];
  setPhases?: (phases: PhaseItem[]) => void;
  
  // Event emission
  emitEvent?: (event: AgentEvent) => void;
  
  // Extension points for plugins
  getSessionManager?: () => unknown;
  getSkillManager?: () => unknown;
  getAgent?: () => unknown;
  
  /**
   * Extension data provided by plugins.
   * Plugins can store arbitrary data here keyed by plugin name.
   */
  extensions: Record<string, unknown>;
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
}

export interface PhaseItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
}

// BackgroundTask is defined here for type sharing, but managed by tools-terminal plugin
export interface BackgroundTask {
  id: string;
  command: string;
  description: string;
  status: "running" | "completed" | "failed" | "cancelled";
  tmuxSession: string;
  workingDirectory: string;
  startedAt: number;
  completedAt?: number;
  exitCode?: number;
  checkBackAt?: number;
  onComplete?: string;
}

// ============================================================================
// Auth & Config Types
// ============================================================================

export type AuthType = "oauth" | "api-key";

export interface AuthConfig {
  type: AuthType;
  apiKey?: string;
}

export type ProviderName = "anthropic" | "openai" | "google" | "openrouter" | "groq" | "xai" | string;

export interface AgentConfig {
  provider: ProviderName;
  model: string;
  auth: AuthConfig;
  systemPrompt?: string;
  workingDirectory?: string;
  tools?: string[];
  maxTokens?: number;
  temperature?: number;
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_SYSTEM_PROMPT = `You are a coding assistant that helps users with software engineering tasks.

# Tone and style
- Be concise. Your responses should be short and direct.
- Only use emojis if the user explicitly requests it.
- Focus on solving the user's problem, not explaining your process.
- Never use unnecessary superlatives, praise, or emotional validation.
- Never introduce yourself or state your name. Just help with the task.
- Output text to communicate with the user. Never use tools like Bash or code comments as means to communicate.

# Doing tasks
- Use tools to explore the codebase when needed
- Make changes carefully and verify they work
- When referencing code, include file path and line number (e.g. src/index.ts:42)
- Prefer editing existing files over creating new ones
- You can call multiple tools in parallel if they have no dependencies

# Tool usage
- Use specialized tools instead of bash when possible (Read instead of cat, Edit instead of sed)
- For file search and exploration, prefer dedicated search tools over bash find/grep`;

export const DEFAULT_AGENT_CONFIG: Partial<AgentConfig> = {
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  auth: { type: "oauth" },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};
