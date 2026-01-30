import type { SessionManager } from "../session/index.js";
import type { McpManager } from "../mcp/manager.js";
import type { AgentEvent } from "../types.js";

export interface ServerContext {
  sessionManager: SessionManager;
  mcpManager?: McpManager;
  eventSubscribers: Map<string, Set<(event: AgentEvent) => void>>;
}

export interface RouteContext {
  ctx: ServerContext;
}
