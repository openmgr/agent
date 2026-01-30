import { EventEmitter } from "eventemitter3";
import { randomUUID } from "crypto";
import { createProvider } from "./llm/index.js";
import { registry } from "./tools/index.js";
import { loadConfig, type ResolvedConfig } from "./config.js";
import { McpManager } from "./mcp/manager.js";
import { registerMcpTools, unregisterMcpTools, registerMcpResourcesAndPrompts, unregisterMcpResourcesAndPrompts } from "./tools/mcp-adapter.js";
import { CompactionEngine } from "./compaction/engine.js";
import type { CompactionConfig, CompactionResult } from "./compaction/types.js";
import { DEFAULT_COMPACTION_CONFIG } from "./compaction/types.js";
import { SkillManager } from "./skills/index.js";
import type {
  AgentConfig,
  AgentEvent,
  Message,
  LLMProvider,
  LLMMessage,
  ToolCall,
  ToolResult,
  ToolContext,
  AuthConfig,
  TodoItem,
  PhaseItem,
  BackgroundTask,
  ProviderName,
} from "./types.js";
import { DEFAULT_SYSTEM_PROMPT } from "./types.js";
import type { McpServerConfig } from "./mcp/types.js";

export interface AgentOptions {
  provider?: ProviderName;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  workingDirectory?: string;
  tools?: string[];
  skipConfigLoad?: boolean;
  mcp?: Record<string, McpServerConfig>;
  compaction?: Partial<CompactionConfig>;
  maxTokens?: number;
  temperature?: number;
}

export interface AgentSessionContext {
  sessionId: string;
  sessionManager: unknown;
}

export class Agent extends EventEmitter<{
  event: (event: AgentEvent) => void;
}> {
  private config: AgentConfig;
  private provider: LLMProvider;
  private messages: Message[] = [];
  private abortController: AbortController | null = null;
  private mcpManager: McpManager | null = null;
  private compactionEngine: CompactionEngine | null = null;
  private compactionConfig: CompactionConfig;
  private skillManager: SkillManager | null = null;
  private todos: TodoItem[] = [];
  private phases: PhaseItem[] = [];
  private backgroundTasks: BackgroundTask[] = [];
  private backgroundTaskPoller: NodeJS.Timeout | null = null;
  private sessionContext: AgentSessionContext | null = null;

  constructor(config: AgentConfig, compactionConfig?: Partial<CompactionConfig>) {
    super();
    this.config = {
      ...config,
      systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    };

    this.provider = createProvider(this.config.provider, {
      auth: this.config.auth,
    });

    this.compactionConfig = { ...DEFAULT_COMPACTION_CONFIG, ...compactionConfig };

    if (this.compactionConfig.enabled) {
      this.compactionEngine = new CompactionEngine(
        this.provider,
        this.config.model,
        this.compactionConfig
      );
    }
  }

  async initMcp(mcpConfig: Record<string, McpServerConfig>): Promise<void> {
    if (this.mcpManager) {
      await this.shutdownMcp();
    }

    this.mcpManager = new McpManager();

    this.mcpManager.on("server.connected", (serverName, toolCount) => {
      this.emit("event", {
        type: "mcp.server.connected",
        serverName,
        toolCount,
      } as AgentEvent);
    });

    this.mcpManager.on("server.disconnected", (serverName, reason) => {
      this.emit("event", {
        type: "mcp.server.disconnected",
        serverName,
        reason,
      } as AgentEvent);
    });

    await this.mcpManager.loadFromConfig(mcpConfig);
    registerMcpTools(this.mcpManager);
    registerMcpResourcesAndPrompts(this.mcpManager);
  }

  async shutdownMcp(): Promise<void> {
    if (this.mcpManager) {
      unregisterMcpResourcesAndPrompts(this.mcpManager);
      unregisterMcpTools(this.mcpManager);
      await this.mcpManager.shutdown();
      this.mcpManager = null;
    }
  }

  getMcpManager(): McpManager | null {
    return this.mcpManager;
  }

  async initSkills(): Promise<void> {
    this.skillManager = new SkillManager(this.config.workingDirectory!);
    await this.skillManager.discover();

    // Log any override warnings
    for (const warning of this.skillManager.getOverrideWarnings()) {
      console.warn(`Warning: ${warning}`);
    }

    // Inject skills section into system prompt
    const skillsSection = this.skillManager.generateSystemPromptSection();
    if (skillsSection) {
      this.config.systemPrompt = (this.config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT) + "\n\n" + skillsSection;
    }
  }

  getSkillManager(): SkillManager | null {
    return this.skillManager;
  }

  getCompactionEngine(): CompactionEngine | null {
    return this.compactionEngine;
  }

  getCompactionConfig(): CompactionConfig {
    return { ...this.compactionConfig };
  }

  updateCompactionConfig(updates: Partial<CompactionConfig>): void {
    this.compactionConfig = { ...this.compactionConfig, ...updates };
    if (this.compactionEngine) {
      this.compactionEngine.updateConfig(updates);
    }
  }

  static async create(options: AgentOptions = {}): Promise<Agent> {
    const workingDirectory = options.workingDirectory ?? process.cwd();

    if (options.skipConfigLoad) {
      const auth: AuthConfig = options.apiKey
        ? { type: "api-key", apiKey: options.apiKey }
        : { type: "oauth" };

      return new Agent(
        {
          provider: options.provider ?? "anthropic",
          model: options.model ?? "claude-sonnet-4-20250514",
          auth,
          systemPrompt: options.systemPrompt,
          tools: options.tools,
          workingDirectory,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
        },
        options.compaction
      );
    }

    const config = await loadConfig(workingDirectory, {
      provider: options.provider,
      model: options.model,
      apiKey: options.apiKey,
      systemPrompt: options.systemPrompt,
      tools: options.tools,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });

    const agent = new Agent(
      {
        provider: config.provider,
        model: config.model,
        auth: config.auth,
        systemPrompt: config.systemPrompt,
        tools: config.tools,
        workingDirectory,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      },
      options.compaction
    );

    const mcpConfig = options.mcp ?? config.mcp;
    if (mcpConfig && Object.keys(mcpConfig).length > 0) {
      await agent.initMcp(mcpConfig);
    }

    // Initialize skills system
    await agent.initSkills();

    return agent;
  }

  async prompt(userMessage: string): Promise<Message> {
    const userMsg: Message = {
      id: randomUUID(),
      role: "user",
      content: userMessage,
      createdAt: Date.now(),
    };
    this.messages.push(userMsg);

    this.emit("event", {
      type: "user.message",
      messageId: userMsg.id,
      content: userMsg.content,
    });

    this.abortController = new AbortController();

    try {
      return await this.runAgentLoop();
    } finally {
      this.abortController = null;
    }
  }

  private async runAgentLoop(): Promise<Message> {
    const maxIterations = 200;
    const loopDetectionWindow = 5;
    const recentToolCalls: string[] = [];

    for (let iterations = 0; iterations < maxIterations; iterations++) {
      if (this.compactionConfig.autoCompact && this.compactionEngine) {
        const compactionStats = this.compactionEngine.shouldCompact(this.messages);
        if (compactionStats) {
          this.emit("event", {
            type: "compaction.start",
            stats: compactionStats,
          });

          try {
            const result = await this.runCompaction();
            this.emit("event", {
              type: "compaction.complete",
              compactionId: result.compactionId,
              stats: {
                originalTokens: result.originalTokens,
                compactedTokens: result.compactedTokens,
                messagesPruned: result.messagesPruned,
                compressionRatio: result.compressionRatio,
              },
            });
          } catch (err) {
            this.emit("event", {
              type: "compaction.error",
              error: (err as Error).message,
            });
          }
        }
      }

      const assistantMessage = await this.generateResponse();
      this.messages.push(assistantMessage);

      if (!assistantMessage.toolCalls?.length) {
        return assistantMessage;
      }

      const callSignature = assistantMessage.toolCalls
        .map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`)
        .sort()
        .join("|");

      recentToolCalls.push(callSignature);
      if (recentToolCalls.length > loopDetectionWindow) {
        recentToolCalls.shift();
      }

      if (recentToolCalls.length === loopDetectionWindow) {
        const allSame = recentToolCalls.every(sig => sig === recentToolCalls[0]);
        if (allSame) {
          throw new Error(`Agent stuck in loop: repeatedly calling same tools with same arguments`);
        }
      }

      const toolResults = await this.executeTools(
        assistantMessage.id,
        assistantMessage.toolCalls
      );

      const toolResultMessage: Message = {
        id: randomUUID(),
        role: "user",
        content: "",
        toolResults,
        createdAt: Date.now(),
      };
      this.messages.push(toolResultMessage);
    }

    throw new Error("Agent loop exceeded maximum iterations (200)");
  }

  async runCompaction(): Promise<CompactionResult> {
    if (!this.compactionEngine) {
      throw new Error("Compaction not enabled");
    }

    const result = await this.compactionEngine.compact(this.messages);
    
    let summaryWithContext = result.summary;
    const bgTasksSummary = this.getBackgroundTasksSummary();
    if (bgTasksSummary) {
      summaryWithContext = `${result.summary}\n\n${bgTasksSummary}`;
    }
    
    const newMessages = this.compactionEngine.buildCompactedMessages(
      this.messages,
      summaryWithContext
    );
    this.messages = newMessages;

    return result;
  }

  shouldCompact(): boolean {
    if (!this.compactionEngine) return false;
    return this.compactionEngine.shouldCompact(this.messages) !== null;
  }

  private async generateResponse(): Promise<Message> {
    const messageId = randomUUID();

    this.emit("event", { type: "message.start", messageId });

    const llmMessages = this.buildLLMMessages();
    const tools = registry.toLLMTools(this.config.tools);

    const { stream, response } = await this.provider.stream({
      model: this.config.model,
      messages: llmMessages,
      tools: tools.length > 0 ? tools : undefined,
      system: this.config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      abortSignal: this.abortController?.signal,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    let content = "";
    const toolCalls: ToolCall[] = [];

    for await (const chunk of stream) {
      if (chunk.type === "text" && chunk.text) {
        content += chunk.text;
        this.emit("event", {
          type: "message.delta",
          messageId,
          delta: chunk.text,
        });
      } else if (chunk.type === "tool_call" && chunk.toolCall) {
        toolCalls.push(chunk.toolCall);
        this.emit("event", {
          type: "tool.start",
          messageId,
          toolCall: chunk.toolCall,
        });
      }
    }

    const finalResponse = await response;
    if (finalResponse.toolCalls.length > toolCalls.length) {
      for (const tc of finalResponse.toolCalls.slice(toolCalls.length)) {
        toolCalls.push(tc);
        this.emit("event", {
          type: "tool.start",
          messageId,
          toolCall: tc,
        });
      }
    }

    this.emit("event", {
      type: "message.complete",
      messageId,
      content,
    });

    return {
      id: messageId,
      role: "assistant",
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      createdAt: Date.now(),
    };
  }

  private async executeTools(
    messageId: string,
    toolCalls: ToolCall[]
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    const ctx: ToolContext = {
      workingDirectory: this.config.workingDirectory!,
      abortSignal: this.abortController?.signal,
      sessionId: this.sessionContext?.sessionId,
      getTodos: () => this.todos,
      setTodos: (todos: TodoItem[]) => { this.todos = todos; },
      getPhases: () => this.phases,
      setPhases: (phases: PhaseItem[]) => { this.phases = phases; },
      getBackgroundTasks: () => this.backgroundTasks,
      addBackgroundTask: (task: BackgroundTask) => this.addBackgroundTask(task),
      updateBackgroundTask: (id: string, updates: Partial<BackgroundTask>) => this.updateBackgroundTask(id, updates),
      emitEvent: (event: AgentEvent) => this.emit("event", event),
      getSessionManager: () => this.sessionContext?.sessionManager,
      getSkillManager: () => this.skillManager,
    };

    for (const toolCall of toolCalls) {
      const tool = registry.get(toolCall.name);

      let result: ToolResult;

      if (!tool) {
        result = {
          id: toolCall.id,
          name: toolCall.name,
          result: `Unknown tool: ${toolCall.name}`,
          isError: true,
        };
      } else {
        try {
          const parseResult = tool.parameters.safeParse(toolCall.arguments);
          if (!parseResult.success) {
            result = {
              id: toolCall.id,
              name: toolCall.name,
              result: `Invalid parameters: ${parseResult.error.message}`,
              isError: true,
            };
          } else {
            const execResult = await tool.execute(parseResult.data, ctx);
            result = {
              id: toolCall.id,
              name: toolCall.name,
              result: execResult.output,
              isError: !!execResult.metadata?.error,
            };
          }
        } catch (err) {
          result = {
            id: toolCall.id,
            name: toolCall.name,
            result: `Tool execution error: ${(err as Error).message}`,
            isError: true,
          };
        }
      }

      results.push(result);
      this.emit("event", {
        type: "tool.complete",
        messageId,
        toolResult: result,
      });
    }

    return results;
  }

  private buildLLMMessages(): LLMMessage[] {
    const llmMessages: LLMMessage[] = [];
    const messages = this.messages;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const nextMsg = messages[i + 1];

      if (msg.role === "user") {
        if (msg.toolResults?.length) {
          llmMessages.push({ role: "user", content: "", toolResults: msg.toolResults });
        } else {
          llmMessages.push({ role: "user", content: msg.content });
        }
      } else {
        const hasToolCalls = msg.toolCalls?.length;
        const nextHasToolResults = nextMsg?.toolResults?.length;

        if (hasToolCalls && !nextHasToolResults) {
          llmMessages.push({
            role: "assistant",
            content: msg.content,
          });
        } else {
          llmMessages.push({
            role: "assistant",
            content: msg.content,
            toolCalls: msg.toolCalls,
          });
        }
      }
    }

    return llmMessages;
  }

  abort(): void {
    this.abortController?.abort();
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  setMessages(messages: Message[]): void {
    this.messages = [...messages];
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  setModel(provider: ProviderName, model: string): void {
    this.config.provider = provider;
    this.config.model = model;
    this.provider = createProvider(provider, {
      auth: this.config.auth,
    });
    if (this.compactionEngine) {
      this.compactionEngine = new CompactionEngine(
        this.provider,
        model,
        this.compactionConfig
      );
    }
  }

  getTodos(): TodoItem[] {
    return [...this.todos];
  }

  setTodos(todos: TodoItem[]): void {
    this.todos = [...todos];
  }

  clearTodos(): void {
    this.todos = [];
  }

  getPhases(): PhaseItem[] {
    return [...this.phases];
  }

  setPhases(phases: PhaseItem[]): void {
    this.phases = [...phases];
  }

  clearPhases(): void {
    this.phases = [];
  }

  getBackgroundTasks(): BackgroundTask[] {
    return [...this.backgroundTasks];
  }

  addBackgroundTask(task: BackgroundTask): void {
    this.backgroundTasks.push(task);
    this.startBackgroundTaskPoller();
  }

  updateBackgroundTask(id: string, updates: Partial<BackgroundTask>): void {
    const index = this.backgroundTasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.backgroundTasks[index] = { ...this.backgroundTasks[index], ...updates };
    }
  }

  getBackgroundTask(id: string): BackgroundTask | undefined {
    return this.backgroundTasks.find(t => t.id === id);
  }

  private startBackgroundTaskPoller(): void {
    if (this.backgroundTaskPoller) return;
    
    this.backgroundTaskPoller = setInterval(() => {
      this.pollBackgroundTasks();
    }, 2000);
  }

  private stopBackgroundTaskPoller(): void {
    if (this.backgroundTaskPoller) {
      clearInterval(this.backgroundTaskPoller);
      this.backgroundTaskPoller = null;
    }
  }

  private async pollBackgroundTasks(): Promise<void> {
    const runningTasks = this.backgroundTasks.filter(t => t.status === "running");
    
    if (runningTasks.length === 0) {
      this.stopBackgroundTaskPoller();
      return;
    }

    for (const task of runningTasks) {
      try {
        const { execSync } = await import("child_process");
        
        const hasSession = (() => {
          try {
            execSync(`tmux has-session -t ${task.tmuxSession} 2>/dev/null`);
            return true;
          } catch {
            return false;
          }
        })();

        if (!hasSession) {
          const exitCode = this.getTaskExitCode(task);
          const status = exitCode === 0 ? "completed" : "failed";
          
          this.updateBackgroundTask(task.id, {
            status,
            completedAt: Date.now(),
            exitCode,
          });

          this.emit("event", {
            type: status === "completed" ? "background_task.complete" : "background_task.failed",
            taskId: task.id,
            command: task.command,
            exitCode,
            onComplete: task.onComplete,
          } as AgentEvent);
        } else if (task.checkBackAt && Date.now() >= task.checkBackAt) {
          this.emit("event", {
            type: "background_task.check_back",
            taskId: task.id,
            command: task.command,
            description: task.description,
          } as AgentEvent);
          
          this.updateBackgroundTask(task.id, { checkBackAt: undefined });
        }
      } catch {
        continue;
      }
    }
  }

  private getTaskExitCode(task: BackgroundTask): number {
    try {
      const { execSync } = require("child_process");
      const output = execSync(
        `cat /tmp/openmgr-bg-${task.id}-exit 2>/dev/null || echo "1"`,
        { encoding: "utf-8" }
      ).trim();
      return parseInt(output, 10) || 1;
    } catch {
      return 1;
    }
  }

  getBackgroundTasksSummary(): string {
    const tasks = this.backgroundTasks.filter(t => t.status === "running" || t.status === "completed" || t.status === "failed");
    if (tasks.length === 0) return "";

    const lines = tasks.map(t => {
      const elapsed = Math.round((Date.now() - t.startedAt) / 1000 / 60);
      const checkBack = t.checkBackAt ? ` - check back at ${new Date(t.checkBackAt).toLocaleTimeString()}` : "";
      const onComplete = t.onComplete ? `\n  onComplete: "${t.onComplete}"` : "";
      
      if (t.status === "running") {
        return `- ${t.id}: "${t.command}" (running, ${elapsed}m elapsed)${checkBack}${onComplete}`;
      } else {
        return `- ${t.id}: "${t.command}" (${t.status}, exit ${t.exitCode})${onComplete}`;
      }
    });

    return `[ACTIVE BACKGROUND TASKS]\n${lines.join("\n")}`;
  }

  setSessionContext(context: AgentSessionContext): void {
    this.sessionContext = context;
  }

  getSessionContext(): AgentSessionContext | null {
    return this.sessionContext;
  }
}

export async function createAgent(options?: AgentOptions): Promise<Agent> {
  return Agent.create(options);
}
