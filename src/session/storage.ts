import { eq, desc, asc, and, gt, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDb, schema } from "../db/index.js";
import type { Message, ToolCall, ToolResult } from "../types.js";
import type { SessionRow, MessageRow, CompactionHistoryRow } from "../db/schema.js";

export interface StoredSession {
  id: string;
  parentId?: string;
  workingDirectory: string;
  title?: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  compactionConfig: {
    enabled: boolean;
    model?: string;
    tokenThreshold?: number;
    inceptionCount?: number;
    workingWindowCount?: number;
  };
  tokenEstimate: number;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListSessionsOptions {
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt";
  order?: "asc" | "desc";
  parentId?: string | null; // null = only root sessions, undefined = all sessions, string = children of that parent
}

export interface CompactionData {
  summary: string;
  originalTokens: number;
  compactedTokens: number;
  messagesPruned: number;
  fromSequence: number;
  toSequence: number;
}

export interface CompactionHistoryEntry {
  id: string;
  summary: string;
  editedSummary?: string;
  originalTokens: number;
  compactedTokens: number;
  messagesPruned: number;
  fromSequence: number;
  toSequence: number;
  createdAt: Date;
}

function rowToStoredSession(row: SessionRow): StoredSession {
  return {
    id: row.id,
    parentId: row.parentId ?? undefined,
    workingDirectory: row.workingDirectory,
    title: row.title ?? undefined,
    provider: row.provider,
    model: row.model,
    systemPrompt: row.systemPrompt ?? undefined,
    compactionConfig: {
      enabled: row.compactionEnabled ?? true,
      model: row.compactionModel ?? undefined,
      tokenThreshold: row.compactionTokenThreshold ?? undefined,
      inceptionCount: row.compactionInceptionCount ?? undefined,
      workingWindowCount: row.compactionWorkingWindowCount ?? undefined,
    },
    tokenEstimate: row.tokenEstimate ?? 0,
    messageCount: row.messageCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    toolCalls: row.toolCalls as ToolCall[] | undefined,
    toolResults: row.toolResults as ToolResult[] | undefined,
    createdAt: row.createdAt.getTime(),
  };
}

function messageToRow(
  sessionId: string,
  message: Message,
  sequence: number,
  options?: { isInception?: boolean; isCompactionSummary?: boolean; tokenCount?: number }
): typeof schema.messages.$inferInsert {
  return {
    id: message.id,
    sessionId,
    role: message.role,
    content: message.content,
    toolCalls: message.toolCalls ?? null,
    toolResults: message.toolResults ?? null,
    isCompactionSummary: options?.isCompactionSummary ?? false,
    isInception: options?.isInception ?? false,
    tokenCount: options?.tokenCount ?? null,
    sequence,
    createdAt: new Date(message.createdAt),
  };
}

export class SessionStorage {
  async createSession(
    session: Omit<StoredSession, "tokenEstimate" | "messageCount">
  ): Promise<StoredSession> {
    const db = getDb();
    const now = new Date();

    const row: typeof schema.sessions.$inferInsert = {
      id: session.id,
      parentId: session.parentId ?? null,
      workingDirectory: session.workingDirectory,
      title: session.title ?? null,
      provider: session.provider,
      model: session.model,
      systemPrompt: session.systemPrompt ?? null,
      compactionEnabled: session.compactionConfig.enabled,
      compactionModel: session.compactionConfig.model ?? null,
      compactionTokenThreshold: session.compactionConfig.tokenThreshold ?? null,
      compactionInceptionCount: session.compactionConfig.inceptionCount ?? null,
      compactionWorkingWindowCount: session.compactionConfig.workingWindowCount ?? null,
      tokenEstimate: 0,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.sessions).values(row);

    return {
      ...session,
      tokenEstimate: 0,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getSession(id: string): Promise<StoredSession | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return rowToStoredSession(rows[0]);
  }

  async listSessions(options: ListSessionsOptions = {}): Promise<StoredSession[]> {
    const db = getDb();
    const { limit = 50, offset = 0, orderBy = "updatedAt", order = "desc", parentId } = options;

    const orderColumn = orderBy === "createdAt" 
      ? schema.sessions.createdAt 
      : schema.sessions.updatedAt;
    const orderFn = order === "asc" ? asc : desc;

    let whereClause;
    if (parentId === null) {
      whereClause = isNull(schema.sessions.parentId);
    } else if (parentId !== undefined) {
      whereClause = eq(schema.sessions.parentId, parentId);
    }

    const query = whereClause
      ? db.select().from(schema.sessions).where(whereClause).orderBy(orderFn(orderColumn)).limit(limit).offset(offset)
      : db.select().from(schema.sessions).orderBy(orderFn(orderColumn)).limit(limit).offset(offset);

    const rows = await query;
    return rows.map(rowToStoredSession);
  }

  async updateSession(id: string, updates: Partial<StoredSession>): Promise<void> {
    const db = getDb();
    const updateData: Partial<typeof schema.sessions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.title !== undefined) updateData.title = updates.title ?? null;
    if (updates.systemPrompt !== undefined) updateData.systemPrompt = updates.systemPrompt ?? null;
    if (updates.tokenEstimate !== undefined) updateData.tokenEstimate = updates.tokenEstimate;
    if (updates.messageCount !== undefined) updateData.messageCount = updates.messageCount;

    if (updates.compactionConfig) {
      const cc = updates.compactionConfig;
      if (cc.enabled !== undefined) updateData.compactionEnabled = cc.enabled;
      if (cc.model !== undefined) updateData.compactionModel = cc.model ?? null;
      if (cc.tokenThreshold !== undefined) updateData.compactionTokenThreshold = cc.tokenThreshold;
      if (cc.inceptionCount !== undefined) updateData.compactionInceptionCount = cc.inceptionCount;
      if (cc.workingWindowCount !== undefined) updateData.compactionWorkingWindowCount = cc.workingWindowCount;
    }

    await db
      .update(schema.sessions)
      .set(updateData)
      .where(eq(schema.sessions.id, id));
  }

  async deleteSession(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(schema.sessions)
      .where(eq(schema.sessions.id, id));

    return result.changes > 0;
  }

  async appendMessage(
    sessionId: string,
    message: Message,
    options?: { isInception?: boolean; tokenCount?: number }
  ): Promise<void> {
    const db = getDb();

    const lastMessage = await db
      .select({ sequence: schema.messages.sequence })
      .from(schema.messages)
      .where(eq(schema.messages.sessionId, sessionId))
      .orderBy(desc(schema.messages.sequence))
      .limit(1);

    const nextSequence = lastMessage.length > 0 ? lastMessage[0].sequence + 1 : 0;
    const row = messageToRow(sessionId, message, nextSequence, options);

    await db.insert(schema.messages).values(row);

    await db
      .update(schema.sessions)
      .set({
        messageCount: nextSequence + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.sessions.id, sessionId));
  }

  async getMessages(
    sessionId: string,
    options?: { limit?: number; afterSequence?: number }
  ): Promise<Message[]> {
    const db = getDb();
    const { limit, afterSequence } = options ?? {};

    let query = db
      .select()
      .from(schema.messages)
      .where(
        afterSequence !== undefined
          ? and(
              eq(schema.messages.sessionId, sessionId),
              gt(schema.messages.sequence, afterSequence)
            )
          : eq(schema.messages.sessionId, sessionId)
      )
      .orderBy(asc(schema.messages.sequence));

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const rows = await query;
    return rows.map(rowToMessage);
  }

  async replaceMessages(
    sessionId: string,
    messages: Message[],
    compactionSummaryId?: string
  ): Promise<void> {
    const db = getDb();

    await db
      .delete(schema.messages)
      .where(eq(schema.messages.sessionId, sessionId));

    if (messages.length > 0) {
      const rows = messages.map((msg, idx) =>
        messageToRow(sessionId, msg, idx, {
          isCompactionSummary: msg.id === compactionSummaryId,
        })
      );
      await db.insert(schema.messages).values(rows);
    }

    await db
      .update(schema.sessions)
      .set({
        messageCount: messages.length,
        updatedAt: new Date(),
      })
      .where(eq(schema.sessions.id, sessionId));
  }

  async saveCompaction(
    sessionId: string,
    data: CompactionData
  ): Promise<string> {
    const db = getDb();
    const id = randomUUID();

    const row: typeof schema.compactionHistory.$inferInsert = {
      id,
      sessionId,
      summary: data.summary,
      editedSummary: null,
      originalTokens: data.originalTokens,
      compactedTokens: data.compactedTokens,
      messagesPruned: data.messagesPruned,
      fromSequence: data.fromSequence,
      toSequence: data.toSequence,
      createdAt: new Date(),
    };

    await db.insert(schema.compactionHistory).values(row);
    return id;
  }

  async updateCompactionSummary(
    compactionId: string,
    editedSummary: string
  ): Promise<void> {
    const db = getDb();
    await db
      .update(schema.compactionHistory)
      .set({ editedSummary })
      .where(eq(schema.compactionHistory.id, compactionId));
  }

  async getCompactionHistory(sessionId: string): Promise<CompactionHistoryEntry[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.compactionHistory)
      .where(eq(schema.compactionHistory.sessionId, sessionId))
      .orderBy(desc(schema.compactionHistory.createdAt));

    return rows.map((row): CompactionHistoryEntry => ({
      id: row.id,
      summary: row.summary,
      editedSummary: row.editedSummary ?? undefined,
      originalTokens: row.originalTokens,
      compactedTokens: row.compactedTokens,
      messagesPruned: row.messagesPruned,
      fromSequence: row.fromSequence,
      toSequence: row.toSequence,
      createdAt: row.createdAt,
    }));
  }

  async getCompaction(compactionId: string): Promise<CompactionHistoryEntry | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.compactionHistory)
      .where(eq(schema.compactionHistory.id, compactionId))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      summary: row.summary,
      editedSummary: row.editedSummary ?? undefined,
      originalTokens: row.originalTokens,
      compactedTokens: row.compactedTokens,
      messagesPruned: row.messagesPruned,
      fromSequence: row.fromSequence,
      toSequence: row.toSequence,
      createdAt: row.createdAt,
    };
  }
}

export const sessionStorage = new SessionStorage();
