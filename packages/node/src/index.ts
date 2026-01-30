/**
 * @openmgr/agent-node
 *
 * OpenMgr Agent for Node.js environments.
 * This package bundles the core agent with Node.js-specific implementations:
 * - XDG filesystem configuration
 * - Filesystem-based skill loading
 * - Stdio MCP client
 *
 * Use this package when running in Node.js. For React Native or browser environments,
 * use @openmgr/agent-core directly with custom implementations.
 */

// Re-export everything from core
export * from "@openmgr/agent-core";

// Re-export Node.js-specific implementations
export {
  // XDG config functions
  loadConfig,
  loadGlobalConfig,
  loadLocalConfig,
  saveGlobalConfig,
  saveLocalConfig,
  setApiKey,
  setAuthType,
  getGlobalConfigPath,
  getLocalConfigPath,
  xdgConfigLoader,
} from "@openmgr/agent-config-xdg";

export {
  // Skills loader
  FilesystemSkillManager,
  SkillManager,
  parseSkillMd,
  isSkillDirectory,
  loadSkillFromDirectory,
  loadSkillMetadata,
  getSkillPaths,
  type SkillPaths,
  type SkillManagerOptions,
} from "@openmgr/agent-skills-loader";

export {
  // MCP stdio client
  StdioMcpClient,
} from "@openmgr/agent-mcp-stdio";

import {
  Agent,
  SseMcpClient,
  type AgentOptions,
  type McpServerConfig,
  type McpClientInterface,
  type McpClientFactory,
  type McpSseConfig,
  type McpStdioConfig,
} from "@openmgr/agent-core";
import { loadConfig } from "@openmgr/agent-config-xdg";
import { FilesystemSkillManager } from "@openmgr/agent-skills-loader";
import { StdioMcpClient } from "@openmgr/agent-mcp-stdio";

/**
 * Create an MCP client for Node.js environments.
 * Supports both stdio (via child process) and SSE transports.
 */
export function createNodeMcpClient(
  name: string,
  config: McpServerConfig
): McpClientInterface {
  if (config.transport === "sse") {
    return new SseMcpClient(name, config as McpSseConfig);
  } else {
    // Default to stdio transport
    return new StdioMcpClient(name, config as McpStdioConfig);
  }
}

/**
 * MCP client factory for Node.js environments.
 * This is passed to the Agent to enable stdio MCP support.
 */
export const nodeMcpClientFactory: McpClientFactory = createNodeMcpClient;

/**
 * Options for creating a Node.js agent
 */
export interface NodeAgentOptions extends AgentOptions {
  // NodeAgentOptions is the same as AgentOptions
  // but documented separately for clarity
}

/**
 * Create an Agent configured for Node.js environments.
 *
 * This function:
 * - Loads configuration from XDG paths (~/.config/openmgr/)
 * - Sets up filesystem-based skill discovery
 * - Configures stdio MCP client support
 *
 * @example
 * ```typescript
 * import { createNodeAgent } from "@openmgr/agent-node";
 *
 * const agent = await createNodeAgent({
 *   workingDirectory: process.cwd(),
 * });
 *
 * const response = await agent.prompt("Hello!");
 * ```
 */
export async function createNodeAgent(options: NodeAgentOptions = {}): Promise<Agent> {
  const workingDirectory = options.workingDirectory ?? process.cwd();

  // Load configuration from XDG paths unless skipped
  let resolvedConfig = options.resolvedConfig;
  if (!resolvedConfig && !options.skipConfigLoad) {
    resolvedConfig = await loadConfig(workingDirectory, {
      provider: options.provider,
      model: options.model,
      apiKey: options.apiKey,
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    });
  }

  // Set up filesystem skill manager (unless one is provided)
  const skillManager = options.skillManager ?? new FilesystemSkillManager(workingDirectory);

  // Create the agent with Node.js implementations
  const agent = await Agent.create({
    ...options,
    workingDirectory,
    mcpClientFactory: options.mcpClientFactory ?? nodeMcpClientFactory,
    skillManager,
    resolvedConfig,
    skipConfigLoad: true, // Config is handled above
  });

  return agent;
}

/**
 * Get or create a FilesystemSkillManager from an agent
 */
export function getSkillManager(agent: Agent): FilesystemSkillManager | undefined {
  return agent.getExtension<FilesystemSkillManager>("skills.manager");
}

/**
 * Create a StdioMcpClient for a given server configuration
 */
export { StdioMcpClient as createStdioMcpClient } from "@openmgr/agent-mcp-stdio";
