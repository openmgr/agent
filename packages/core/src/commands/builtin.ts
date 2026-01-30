import { defineCommand, type CommandDefinition } from "../plugin.js";
import { commandRegistry } from "../registry/commands.js";

/**
 * /help - List all available commands
 */
export const helpCommand = defineCommand({
  name: "help",
  description: "List all available commands",
  execute: async (_args, _ctx) => {
    const commands = commandRegistry.getAll();
    
    if (commands.length === 0) {
      return { output: "No commands available." };
    }
    
    const output = commands
      .map(cmd => `/${cmd.name} - ${cmd.description}`)
      .join("\n");
    
    return { output: `Available commands:\n${output}` };
  },
});

/**
 * /clear - Clear conversation history
 */
export const clearCommand = defineCommand({
  name: "clear",
  description: "Clear conversation history",
  execute: async (_args, ctx) => {
    // Agent will need to expose clearMessages method
    const agent = ctx.agent as { clearMessages?: () => void };
    if (agent.clearMessages) {
      agent.clearMessages();
    }
    return { output: "Conversation cleared." };
  },
});

/**
 * /compact - Force context compaction
 */
export const compactCommand = defineCommand({
  name: "compact",
  description: "Force context compaction",
  execute: async (_args, ctx) => {
    const agent = ctx.agent as {
      shouldCompact?: () => boolean;
      runCompaction?: () => Promise<{ messagesPruned: number; compressionRatio: number }>;
    };
    
    if (!agent.shouldCompact || !agent.runCompaction) {
      return { output: "Compaction not available." };
    }
    
    if (!agent.shouldCompact()) {
      return { output: "Context does not need compaction." };
    }
    
    try {
      const result = await agent.runCompaction();
      return {
        output: `Compacted ${result.messagesPruned} messages. Compression ratio: ${(result.compressionRatio * 100).toFixed(1)}%`,
      };
    } catch (err) {
      return { output: `Compaction failed: ${(err as Error).message}` };
    }
  },
});

/**
 * All built-in commands
 */
export const builtinCommands: CommandDefinition[] = [
  helpCommand,
  clearCommand,
  compactCommand,
];

/**
 * Register all built-in commands
 */
export function registerBuiltinCommands(): void {
  for (const command of builtinCommands) {
    commandRegistry.register(command);
  }
}
