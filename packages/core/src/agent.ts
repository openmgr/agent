import { EventEmitter } from "eventemitter3";
import { randomUUID } from "crypto";
import { dirname } from "path";
import { toolRegistry } from "./registry/tools.js";
import { providerRegistry } from "./registry/providers.js";
import { commandRegistry } from "./registry/commands.js";
import { registerBuiltinCommands } from "./commands/builtin.js";
import { loadConfig, type ResolvedConfig } from "./config.js";
import { McpManager } from "./mcp/manager.js";
import {
  registerMcpTools,
  unregisterMcpTools,
  registerMcpResourcesAndPrompts,
  unregisterMcpResourcesAndPrompts,
} from "./mcp/adapter.js";
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
} from "./types.js";
import { DEFAULT_SYSTEM_PROMPT } from "./types.js";
import type { McpServerConfig } from "./mcp/types.js";
import type { AgentPlugin, ProviderOptions } from "./plugin.js";

export interface AgentOptions {
  provider?: string;
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

// Ensure built-in commands are registered once
let builtinCommandsRegistered = false;

export class Agent extends EventEmitter<{
  event: (event: AgentEvent) => void;
}> {
  private config: AgentConfig;
  private provider: LLMProvider | null = null;
  private messages: Message[] = [];
  private abortController: AbortController | null = null;
  private mcpManager: McpManager | null = null;
  private compactionEngine: CompactionEngine | null = null;
  private compactionConfig: CompactionConfig;
  private skillManager: SkillManager | null = null;
  private todos: TodoItem[] = [];
  private phases: PhaseItem[] = [];
  private sessionContext: AgentSessionContext | null = null;
  
  // Plugin system
  private plugins: Map<string, AgentPlugin> = new Map();
  private extensions: Map<string, unknown> = new Map();

  constructor(config: AgentConfig, compactionConfig?: Partial<CompactionConfig>) {
    super();
    this.config = {
      ...config,
      systemPrompt: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    };

    // Try to create provider from registry
    if (providerRegistry.has(config.provider)) {
      this.provider = providerRegistry.create(config.provider, {
        auth: config.auth,
        apiKey: config.auth.apiKey,
      });
    }

    this.compactionConfig = { ...DEFAULT_COMPACTION_CONFIG, ...compactionConfig };

    if (this.compactionConfig.enabled && this.provider) {
      this.compactionEngine = new CompactionEngine(
        this.provider,
        this.config.model,
        this.compactionConfig
      );
    }
    
    // Register built-in commands once
    if (!builtinCommandsRegistered) {
      registerBuiltinCommands();
      builtinCommandsRegistered = true;
    }
  }

  // ============================================================================
  // Plugin System
  // ============================================================================

  /**
   * Register a plugin with this agent
   */
  async use(plugin: AgentPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }

    // Register tools
    if (plugin.tools) {
      for (const tool of plugin.tools) {
        toolRegistry.register(tool);
      }
    }

    // Register providers
    if (plugin.providers) {
      for (const provider of plugin.providers) {
        providerRegistry.register(provider);
      }
    }

    // Register commands
    if (plugin.commands) {
      for (const command of plugin.commands) {
        commandRegistry.register(command);
      }
    }

    // Register skills - add the skill paths to the skill manager
    if (plugin.skills && this.skillManager) {
      for (const skill of plugin.skills) {
        // Get the parent directory of the skill file (e.g., /path/to/skills/code-review from /path/to/skills/code-review/SKILL.md)
        const skillDir = dirname(skill.path);
        const skillsBaseDir = dirname(skillDir);
        this.skillManager.addBundledPath(skillsBaseDir);
      }
      // Re-discover skills to pick up the new paths
      await this.skillManager.discover();
      
      // Update system prompt with new skills
      const skillsSection = this.skillManager.generateSystemPromptSection();
      if (skillsSection) {
        // Remove old skills section and add new one
        const basePrompt = this.config.systemPrompt?.replace(/\n\n# Available Skills[\s\S]*$/, "") ?? DEFAULT_SYSTEM_PROMPT;
        this.config.systemPrompt = basePrompt + "\n\n" + skillsSection;
      }
    }

    // Call lifecycle hook
    await plugin.onRegister?.(this);

    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Get a registered plugin by name
   */
  getPlugin(name: string): AgentPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Set extension data (for plugins to store state)
   */
  setExtension(key: string, value: unknown): void {
    this.extensions.set(key, value);
  }

  /**
   * Get extension data
   */
  getExtension<T>(key: string): T | undefined {
    return this.extensions.get(key) as T | undefined;
  }

  // ============================================================================
  // Provider Management
  // ============================================================================

  /**
   * Set the LLM provider by name
   */
  setProvider(name: string, options: ProviderOptions = {}): void {
    this.provider = providerRegistry.create(name, {
      ...options,
      auth: this.config.auth,
    });
    this.config.provider = name;
    
    // Recreate compaction engine with new provider
    if (this.compactionConfig.enabled && this.provider) {
      this.compactionEngine = new CompactionEngine(
        this.provider,
        this.config.model,
        this.compactionConfig
      );
    }
  }

  /**
   * Check if a provider is available
   */
  hasProvider(name: string): boolean {
    return providerRegistry.has(name);
  }

  /**
   * Get available provider names
   */
  getAvailableProviders(): string[] {
    return providerRegistry.getNames();
  }

  // ============================================================================
  // MCP Integration
  // ============================================================================

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

  // ============================================================================
  // Skills Integration
  // ============================================================================

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
      this.config.systemPrompt =
        (this.config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT) + "\n\n" + skillsSection;
    }
  }

  getSkillManager(): SkillManager | null {
    return this.skillManager;
  }

  // ============================================================================
  // Compaction
  // ============================================================================

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

  async runCompaction(): Promise<CompactionResult> {
    if (!this.compactionEngine) {
      throw new Error("Compaction not enabled");
    }

    const result = await this.compactionEngine.compact(this.messages);

    // Allow plugins to add context to summary (e.g., background tasks)
    let summaryWithContext = result.summary;
    for (const plugin of this.plugins.values()) {
      const pluginWithContext = plugin as unknown as { getContextSummary?: () => string };
      if (typeof pluginWithContext.getContextSummary === "function") {
        const additionalContext = pluginWithContext.getContextSummary();
        if (additionalContext) {
          summaryWithContext = `${summaryWithContext}\n\n${additionalContext}`;
        }
      }
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

  // ============================================================================
  // Static Factory
  // ============================================================================

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

  // ============================================================================
  // Prompt & Agent Loop
  // ============================================================================

  async prompt(userMessage: string): Promise<Message> {
    // Check for slash command (auto-detect)
    if (userMessage.startsWith("/")) {
      const commandResult = await commandRegistry.execute(userMessage, {
        agent: this,
        sessionId: this.sessionContext?.sessionId,
      });

      if (commandResult) {
        // Emit command result event
        this.emit("event", {
          type: "command.result",
          command: userMessage.split(" ")[0],
          output: commandResult.output,
        } as AgentEvent);

        if (!commandResult.shouldContinue) {
          // Return command output as a message
          return {
            id: randomUUID(),
            role: "assistant",
            content: commandResult.output,
            createdAt: Date.now(),
          };
        }
        // If shouldContinue, use transformed input or original
        userMessage = commandResult.transformedInput ?? userMessage;
      }
    }

    // Call onBeforePrompt hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.onBeforePrompt) {
        userMessage = await plugin.onBeforePrompt(userMessage, this);
      }
    }

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
      const response = await this.runAgentLoop();

      // Call onAfterPrompt hooks
      for (const plugin of this.plugins.values()) {
        if (plugin.onAfterPrompt) {
          await plugin.onAfterPrompt(response, this);
        }
      }

      return response;
    } finally {
      this.abortController = null;
    }
  }

  private async runAgentLoop(): Promise<Message> {
    if (!this.provider) {
      throw new Error(
        `No provider available. Register a provider plugin or call setProvider().`
      );
    }

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
        .map((tc) => `${tc.name}:${JSON.stringify(tc.arguments)}`)
        .sort()
        .join("|");

      recentToolCalls.push(callSignature);
      if (recentToolCalls.length > loopDetectionWindow) {
        recentToolCalls.shift();
      }

      if (recentToolCalls.length === loopDetectionWindow) {
        const allSame = recentToolCalls.every((sig) => sig === recentToolCalls[0]);
        if (allSame) {
          throw new Error(
            `Agent stuck in loop: repeatedly calling same tools with same arguments`
          );
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

  private async generateResponse(): Promise<Message> {
    if (!this.provider) {
      throw new Error("No provider configured");
    }

    const messageId = randomUUID();

    this.emit("event", { type: "message.start", messageId });

    const llmMessages = this.buildLLMMessages();
    const tools = toolRegistry.toLLMTools(this.config.tools);

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
      setTodos: (todos: TodoItem[]) => {
        this.todos = todos;
      },
      getPhases: () => this.phases,
      setPhases: (phases: PhaseItem[]) => {
        this.phases = phases;
      },
      emitEvent: (event: AgentEvent) => this.emit("event", event),
      getSessionManager: () => this.sessionContext?.sessionManager,
      getSkillManager: () => this.skillManager,
      getAgent: () => this,
      extensions: Object.fromEntries(this.extensions),
    };

    for (const toolCall of toolCalls) {
      const tool = toolRegistry.get(toolCall.name);

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
      const msg = messages[i]!;
      const nextMsg = messages[i + 1];

      if (msg.role === "user") {
        if (msg.toolResults?.length) {
          llmMessages.push({
            role: "user",
            content: "",
            toolResults: msg.toolResults,
          });
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

  // ============================================================================
  // State Management
  // ============================================================================

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

  setModel(provider: string, model: string): void {
    this.config.provider = provider;
    this.config.model = model;

    if (providerRegistry.has(provider)) {
      this.provider = providerRegistry.create(provider, {
        auth: this.config.auth,
      });
    }

    if (this.compactionEngine && this.provider) {
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

  setSessionContext(context: AgentSessionContext): void {
    this.sessionContext = context;
  }

  getSessionContext(): AgentSessionContext | null {
    return this.sessionContext;
  }

  // ============================================================================
  // Shutdown
  // ============================================================================

  async shutdown(): Promise<void> {
    // Call plugin shutdown hooks
    for (const plugin of this.plugins.values()) {
      if (plugin.onShutdown) {
        await plugin.onShutdown(this);
      }
    }

    // Shutdown MCP
    await this.shutdownMcp();
  }
}

export async function createAgent(options?: AgentOptions): Promise<Agent> {
  return Agent.create(options);
}
