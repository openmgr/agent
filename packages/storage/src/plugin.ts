import type { AgentPlugin, AgentInterface } from "@openmgr/agent-core";
import {
  getDb,
  closeDb,
  initializeDatabase,
  type AgentDatabase,
  type DatabaseConfig,
} from "@openmgr/agent-database";
import { SessionManager } from "./sessions.js";

export interface StoragePluginOptions extends DatabaseConfig {
  /** Run migrations on plugin initialization. Defaults to true. */
  runMigrations?: boolean;
}

/**
 * Create a storage plugin that provides database access to the agent.
 * 
 * The plugin adds:
 * - `storage.db` - The Drizzle database instance
 * - `storage.sessions` - Session manager for CRUD operations
 * 
 * @example
 * ```ts
 * import { Agent } from "@openmgr/agent-core";
 * import { storagePlugin } from "@openmgr/agent-storage";
 * 
 * const agent = new Agent({ ... });
 * await agent.use(storagePlugin());
 * 
 * // Access storage via extensions
 * const sessions = agent.getExtension<SessionManager>("storage.sessions");
 * const session = await sessions.createSession({ ... });
 * ```
 */
export function storagePlugin(options: StoragePluginOptions = {}): AgentPlugin {
  const { runMigrations = true, path, verbose } = options;
  const dbConfig: DatabaseConfig = { path, verbose };
  
  let db: AgentDatabase;
  let sessionManager: SessionManager;

  return {
    name: "storage",
    version: "0.1.0",

    async onRegister(agent: AgentInterface) {
      // Initialize database
      if (runMigrations) {
        const result = await initializeDatabase(path);
        if (!result.success) {
          throw new Error(`Storage plugin failed to initialize: ${result.message}`);
        }
      }
      
      // Get database connection
      db = getDb(dbConfig);
      sessionManager = new SessionManager(db);
      
      // Register extensions
      agent.setExtension("storage.db", db);
      agent.setExtension("storage.sessions", sessionManager);
    },

    async onShutdown() {
      // Close database connection
      closeDb();
    },
  };
}
