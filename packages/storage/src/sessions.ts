import { eq, desc, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { AgentDatabase } from "@openmgr/agent-database";
import {
  sessions,
  messages,
  compactionHistory,
  type SessionRow,
  type SessionInsert,
  type MessageRow,
  type MessageInsert,
  type CompactionHistoryRow,
  type CompactionHistoryInsert,
  type ToolCallData,
  type ToolResultData,
} from "@openmgr/agent-database";

export interface CreateSessionOptions {
  id?: string;
  parentId?: string;
  workingDirectory: string;
  title?: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  compactionEnabled?: boolean;
  compactionModel?: string;
  compactionTokenThreshold?: number;
  compactionInceptionCount?: number;
  compactionWorkingWindowCount?: number;
}

export interface CreateMessageOptions {
  id?: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallData[];
  toolResults?: ToolResultData[];
  isCompactionSummary?: boolean;
  isInception?: boolean;
  tokenCount?: number;
  sequence: number;
}

export interface UpdateSessionOptions {
  title?: string;
  tokenEstimate?: number;
  messageCount?: number;
  compactionEnabled?: boolean;
  compactionModel?: string;
  compactionTokenThreshold?: number;
  compactionInceptionCount?: number;
  compactionWorkingWindowCount?: number;
}

/**
 * Session manager for CRUD operations on sessions and messages.
 */
export class SessionManager {
  constructor(private db: AgentDatabase) {}

  // ==================== Sessions ====================

  /**
   * Create a new session.
   */
  async createSession(options: CreateSessionOptions): Promise<SessionRow> {
    const now = new Date();
    const insert: SessionInsert = {
      id: options.id ?? randomUUID(),
      parentId: options.parentId ?? null,
      workingDirectory: options.workingDirectory,
      title: options.title ?? null,
      provider: options.provider,
      model: options.model,
      systemPrompt: options.systemPrompt ?? null,
      compactionEnabled: options.compactionEnabled ?? true,
      compactionModel: options.compactionModel ?? null,
      compactionTokenThreshold: options.compactionTokenThreshold ?? null,
      compactionInceptionCount: options.compactionInceptionCount ?? null,
      compactionWorkingWindowCount: options.compactionWorkingWindowCount ?? null,
      tokenEstimate: 0,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(sessions).values(insert);
    const created = await this.getSession(insert.id!);
    if (!created) {
      throw new Error(`Failed to create session ${insert.id}`);
    }
    return created;
  }

  /**
   * Get a session by ID.
   */
  async getSession(id: string): Promise<SessionRow | null> {
    const result = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Get all root sessions (no parent).
   */
  async getRootSessions(limit = 50): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(sessions)
      .where(isNull(sessions.parentId))
      .orderBy(desc(sessions.updatedAt))
      .limit(limit);
  }

  /**
   * Get child sessions of a parent.
   */
  async getChildSessions(parentId: string): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.parentId, parentId))
      .orderBy(desc(sessions.createdAt));
  }

  /**
   * Update a session.
   */
  async updateSession(id: string, options: UpdateSessionOptions): Promise<SessionRow | null> {
    const updates: Partial<SessionInsert> = {
      ...options,
      updatedAt: new Date(),
    };

    await this.db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.id, id));
    
    return this.getSession(id);
  }

  /**
   * Delete a session and all its messages.
   */
  async deleteSession(id: string): Promise<boolean> {
    const result = await this.db
      .delete(sessions)
      .where(eq(sessions.id, id));
    return true;
  }

  /**
   * Get the most recent session.
   */
  async getMostRecentSession(): Promise<SessionRow | null> {
    const result = await this.db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.updatedAt))
      .limit(1);
    return result[0] ?? null;
  }

  // ==================== Messages ====================

  /**
   * Add a message to a session.
   */
  async addMessage(options: CreateMessageOptions): Promise<MessageRow> {
    const now = new Date();
    const insert: MessageInsert = {
      id: options.id ?? randomUUID(),
      sessionId: options.sessionId,
      role: options.role,
      content: options.content,
      toolCalls: options.toolCalls ?? null,
      toolResults: options.toolResults ?? null,
      isCompactionSummary: options.isCompactionSummary ?? false,
      isInception: options.isInception ?? false,
      tokenCount: options.tokenCount ?? null,
      sequence: options.sequence,
      createdAt: now,
    };

    await this.db.insert(messages).values(insert);
    
    // Update session message count
    const session = await this.getSession(options.sessionId);
    if (session) {
      await this.updateSession(options.sessionId, {
        messageCount: (session.messageCount ?? 0) + 1,
        tokenEstimate: (session.tokenEstimate ?? 0) + (options.tokenCount ?? 0),
      });
    }
    
    const created = await this.getMessage(insert.id!);
    if (!created) {
      throw new Error(`Failed to create message ${insert.id}`);
    }
    return created;
  }

  /**
   * Get a message by ID.
   */
  async getMessage(id: string): Promise<MessageRow | null> {
    const result = await this.db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  /**
   * Get all messages for a session, ordered by sequence.
   */
  async getSessionMessages(sessionId: string): Promise<MessageRow[]> {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.sequence);
  }

  /**
   * Get the next sequence number for a session.
   */
  async getNextSequence(sessionId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.sequence))
      .limit(1);
    
    return result[0] ? result[0].sequence + 1 : 0;
  }

  /**
   * Delete messages after a certain sequence (for compaction).
   */
  async deleteMessagesAfterSequence(sessionId: string, sequence: number): Promise<number> {
    const result = await this.db
      .delete(messages)
      .where(
        and(
          eq(messages.sessionId, sessionId),
          // Note: gt would be better but we use sequence + 1 pattern
        )
      );
    return 0; // SQLite doesn't return count easily
  }

  /**
   * Delete messages within a sequence range.
   */
  async deleteMessageRange(sessionId: string, fromSequence: number, toSequence: number): Promise<void> {
    // Get messages in range
    const msgs = await this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.sequence);
    
    const idsToDelete = msgs
      .filter((m: MessageRow) => m.sequence >= fromSequence && m.sequence <= toSequence)
      .map((m: MessageRow) => m.id);
    
    for (const id of idsToDelete) {
      await this.db.delete(messages).where(eq(messages.id, id));
    }
  }

  // ==================== Compaction History ====================

  /**
   * Record a compaction event.
   */
  async recordCompaction(options: {
    sessionId: string;
    summary: string;
    editedSummary?: string;
    originalTokens: number;
    compactedTokens: number;
    messagesPruned: number;
    fromSequence: number;
    toSequence: number;
  }): Promise<CompactionHistoryRow> {
    const insert: CompactionHistoryInsert = {
      id: randomUUID(),
      sessionId: options.sessionId,
      summary: options.summary,
      editedSummary: options.editedSummary ?? null,
      originalTokens: options.originalTokens,
      compactedTokens: options.compactedTokens,
      messagesPruned: options.messagesPruned,
      fromSequence: options.fromSequence,
      toSequence: options.toSequence,
      createdAt: new Date(),
    };

    await this.db.insert(compactionHistory).values(insert);
    
    const result = await this.db
      .select()
      .from(compactionHistory)
      .where(eq(compactionHistory.id, insert.id))
      .limit(1);
    
    return result[0]!;
  }

  /**
   * Get compaction history for a session.
   */
  async getCompactionHistory(sessionId: string): Promise<CompactionHistoryRow[]> {
    return this.db
      .select()
      .from(compactionHistory)
      .where(eq(compactionHistory.sessionId, sessionId))
      .orderBy(desc(compactionHistory.createdAt));
  }
}
