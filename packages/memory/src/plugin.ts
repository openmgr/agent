import type { AgentPlugin, AgentInterface } from "@openmgr/agent-core";
import { memoryTools } from "./tools.js";
import { MemoryStorage } from "./storage.js";
import { closeAllMemoryDbs } from "./database.js";

/**
 * Memory plugin that provides semantic memory tools to the agent.
 * 
 * @example
 * ```ts
 * import { Agent } from "@openmgr/agent-core";
 * import { memoryPlugin } from "@openmgr/agent-memory";
 * 
 * const agent = new Agent({ ... });
 * await agent.use(memoryPlugin());
 * ```
 */
export function memoryPlugin(): AgentPlugin {
  return {
    name: "memory",
    version: "0.1.0",
    tools: memoryTools,
    
    async onShutdown() {
      closeAllMemoryDbs();
    },
  };
}
