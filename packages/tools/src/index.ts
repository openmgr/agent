/**
 * @openmgr/agent-tools
 * 
 * Pure code tools for @openmgr/agent that don't require filesystem or terminal access.
 * These tools can run in sandboxed environments like Cloudflare Workers.
 * 
 * Included tools:
 * - todoread / todowrite - Task management
 * - phaseread / phasewrite - Project phase management  
 * - web_fetch - Fetch and convert web content
 * - web_search - Search the web via Exa AI
 * - skill - Load skill instructions
 */

import type { AgentPlugin } from "@openmgr/agent-core";

// Import tool definitions
import { todoReadTool } from "./todo-read.js";
import { todoWriteTool } from "./todo-write.js";
import { phaseReadTool } from "./phase-read.js";
import { phaseWriteTool } from "./phase-write.js";
import { webFetchTool } from "./web-fetch.js";
import { webSearchTool } from "./web-search.js";
import { skillTool } from "./skill.js";

// Export individual tools
export { todoReadTool } from "./todo-read.js";
export { todoWriteTool } from "./todo-write.js";
export { phaseReadTool } from "./phase-read.js";
export { phaseWriteTool } from "./phase-write.js";
export { webFetchTool } from "./web-fetch.js";
export { webSearchTool } from "./web-search.js";
export { skillTool } from "./skill.js";

/**
 * All pure code tools
 */
export const tools = [
  todoReadTool,
  todoWriteTool,
  phaseReadTool,
  phaseWriteTool,
  webFetchTool,
  webSearchTool,
  skillTool,
];

/**
 * Plugin that registers all pure code tools with the agent
 */
export const toolsPlugin: AgentPlugin = {
  name: "@openmgr/agent-tools",
  version: "0.1.0",
  tools: tools as AgentPlugin["tools"],
};

export default toolsPlugin;
