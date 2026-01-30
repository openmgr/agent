/**
 * @openmgr/agent-tools-terminal
 * 
 * Terminal and filesystem tools for @openmgr/agent.
 * These tools require Node.js runtime and cannot run in sandboxed environments.
 * 
 * Included tools:
 * - bash - Execute shell commands
 * - read - Read file contents
 * - write - Write file contents
 * - edit - Edit files with find/replace
 * - glob - Find files by pattern
 * - grep - Search file contents
 */

import type { AgentPlugin } from "@openmgr/agent-core";

// Import tool definitions
import { bashTool } from "./bash.js";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";

// Export individual tools
export { bashTool } from "./bash.js";
export { readTool } from "./read.js";
export { writeTool } from "./write.js";
export { editTool } from "./edit.js";
export { globTool } from "./glob.js";
export { grepTool } from "./grep.js";

/**
 * All terminal/filesystem tools
 */
export const tools = [
  bashTool,
  readTool,
  writeTool,
  editTool,
  globTool,
  grepTool,
];

/**
 * Plugin that registers all terminal tools with the agent
 */
export const toolsTerminalPlugin: AgentPlugin = {
  name: "@openmgr/agent-tools-terminal",
  version: "0.1.0",
  tools: tools as AgentPlugin["tools"],
};

export default toolsTerminalPlugin;
