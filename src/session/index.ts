import { randomUUID } from "crypto";
import { Agent, type AgentOptions } from "../agent.js";
import type { Session, Message, AgentEvent } from "../types.js";
import { SessionStorage, sessionStorage, type StoredSession, type ListSessionsOptions } from "./storage.js";
import { runMigrations } from "../db/migrate.js";
import { generateTitle } from "./title.js";

export interface SessionManagerOptions {
  agentOptions?: Partial<AgentOptions>;
  enablePersistence?: boolean;
}

export interface SessionState {
  session: Session;
  agent: Agent;
}

let migrationsRun = false;

async function ensureMigrations(): Promise<void> {
  if (!migrationsRun) {
    await runMigrations();
    migrationsRun = true;
  }
}

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private pendingSessions: Map<string, Promise<Session>> = new Map();
  private defaultAgentOptions: Partial<AgentOptions>;
  private storage: SessionStorage;
  private enablePersistence: boolean;

  constructor(options: SessionManagerOptions = {}) {
    this.defaultAgentOptions = options.agentOptions ?? {};
    this.storage = sessionStorage;
    this.enablePersistence = options.enablePersistence ?? true;
  }

  async create(options?: { workingDirectory?: string; title?: string; parentId?: string }): Promise<Session> {
    if (this.enablePersistence) {
      await ensureMigrations();
    }

    const id = randomUUID();
    const now = Date.now();

    const workingDirectory =
      options?.workingDirectory ??
      this.defaultAgentOptions.workingDirectory ??
      process.cwd();

    const session: Session = {
      id,
      parentId: options?.parentId,
      workingDirectory,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const createPromise = (async () => {
      const agent = await Agent.create({
        ...this.defaultAgentOptions,
        workingDirectory,
      });

      agent.setSessionContext({
        sessionId: id,
        sessionManager: this,
      });

      const config = agent.getConfig();

      if (this.enablePersistence) {
        await this.storage.createSession({
          id,
          parentId: options?.parentId,
          workingDirectory,
          title: options?.title,
          provider: config.provider,
          model: config.model,
          systemPrompt: config.systemPrompt,
          compactionConfig: {
            enabled: true,
          },
          createdAt: new Date(now),
          updatedAt: new Date(now),
        });
      }

      this.sessions.set(id, { session, agent });
      this.pendingSessions.delete(id);
      return session;
    })();

    this.pendingSessions.set(id, createPromise);
    return createPromise;
  }

  async restore(id: string): Promise<Session | null> {
    if (!this.enablePersistence) {
      return null;
    }

    await ensureMigrations();

    if (this.sessions.has(id)) {
      return this.sessions.get(id)!.session;
    }

    const stored = await this.storage.getSession(id);
    if (!stored) return null;

    const messages = await this.storage.getMessages(id);

    const agent = await Agent.create({
      ...this.defaultAgentOptions,
      workingDirectory: stored.workingDirectory,
      provider: stored.provider as "anthropic" | "openai" | "google" | "openrouter" | "groq" | "xai",
      model: stored.model,
      systemPrompt: stored.systemPrompt,
    });

    agent.setSessionContext({
      sessionId: id,
      sessionManager: this,
    });
    agent.setMessages(messages);

    const session: Session = {
      id: stored.id,
      parentId: stored.parentId,
      workingDirectory: stored.workingDirectory,
      messages,
      createdAt: stored.createdAt.getTime(),
      updatedAt: stored.updatedAt.getTime(),
    };

    this.sessions.set(id, { session, agent });
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id)?.session;
  }

  getState(id: string): SessionState | undefined {
    return this.sessions.get(id);
  }

  list(): Session[] {
    return Array.from(this.sessions.values()).map((s) => s.session);
  }

  async listStored(options?: ListSessionsOptions): Promise<StoredSession[]> {
    if (!this.enablePersistence) {
      return [];
    }
    await ensureMigrations();
    return this.storage.listSessions(options);
  }

  async getStored(id: string): Promise<StoredSession | null> {
    if (!this.enablePersistence) {
      return null;
    }
    await ensureMigrations();
    return this.storage.getSession(id);
  }

  delete(id: string): boolean {
    const state = this.sessions.get(id);
    if (state) {
      state.agent.abort();
      this.sessions.delete(id);
      return true;
    }
    return false;
  }

  async deleteStored(id: string): Promise<boolean> {
    this.delete(id);

    if (!this.enablePersistence) {
      return false;
    }

    await ensureMigrations();
    return this.storage.deleteSession(id);
  }

  async prompt(
    sessionId: string,
    message: string,
    onEvent?: (event: AgentEvent) => void
  ): Promise<Message> {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (onEvent) {
      state.agent.on("event", onEvent);
    }

    try {
      const messagesBeforePrompt = state.agent.getMessages().length;
      const response = await state.agent.prompt(message);

      state.session.messages = state.agent.getMessages();
      state.session.updatedAt = Date.now();

      if (this.enablePersistence) {
        const agentMessages = state.agent.getMessages();
        for (let i = messagesBeforePrompt; i < agentMessages.length; i++) {
          const msg = agentMessages[i];
          await this.storage.appendMessage(sessionId, msg);
        }

        const isFirstMessage = messagesBeforePrompt === 0;
        if (isFirstMessage) {
          const stored = await this.storage.getSession(sessionId);
          const hasDefaultTitle = !stored?.title || stored.title.startsWith("Session ");
          
          if (hasDefaultTitle) {
            const config = state.agent.getConfig();
            generateTitle(message, config.provider, config.auth)
              .then(async (title) => {
                if (title && title !== "New conversation") {
                  await this.storage.updateSession(sessionId, { title });
                }
              })
              .catch((err) => {
                console.error("Title generation error:", err);
              });
          }
        }
      }

      return response;
    } finally {
      if (onEvent) {
        state.agent.off("event", onEvent);
      }
    }
  }

  abort(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.agent.abort();
    }
  }

  getMessages(sessionId: string): Message[] {
    const state = this.sessions.get(sessionId);
    return state?.agent.getMessages() ?? [];
  }

  async getStoredMessages(sessionId: string): Promise<Message[]> {
    if (!this.enablePersistence) {
      return this.getMessages(sessionId);
    }
    await ensureMigrations();
    return this.storage.getMessages(sessionId);
  }

  subscribe(
    sessionId: string,
    callback: (event: AgentEvent) => void
  ): () => void {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    state.agent.on("event", callback);
    return () => state.agent.off("event", callback);
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    if (!this.enablePersistence) return;
    await ensureMigrations();
    await this.storage.updateSession(sessionId, { title });
  }

  async updateSessionModel(sessionId: string, provider: string, model: string): Promise<void> {
    if (this.enablePersistence) {
      await ensureMigrations();
      await this.storage.updateSession(sessionId, { provider, model });
    }

    const state = this.sessions.get(sessionId);
    if (state) {
      const newAgent = await Agent.create({
        ...this.defaultAgentOptions,
        workingDirectory: state.session.workingDirectory,
        provider: provider as "anthropic" | "openai" | "google" | "openrouter" | "groq" | "xai",
        model,
      });
      newAgent.setSessionContext({
        sessionId,
        sessionManager: this,
      });
      newAgent.setMessages(state.agent.getMessages());
      newAgent.setTodos(state.agent.getTodos());
      state.agent = newAgent;
    }
  }
}

export function createSessionManager(
  options?: SessionManagerOptions
): SessionManager {
  return new SessionManager(options);
}

export { SessionStorage, sessionStorage, type StoredSession, type ListSessionsOptions };
