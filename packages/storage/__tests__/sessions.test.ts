import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createInMemoryDatabase, SessionManager } from "../src/index.js";
import type { StorageDatabase } from "../src/database.js";
import Database from "better-sqlite3";

describe("SessionManager", () => {
  let db: StorageDatabase;
  let sqlite: Database.Database;
  let closeDb: () => void;
  let manager: SessionManager;

  beforeEach(() => {
    const result = createInMemoryDatabase();
    db = result.db;
    sqlite = result.sqlite;
    closeDb = result.close;
    manager = new SessionManager(db);

    // Create tables using raw SQLite
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        working_directory TEXT NOT NULL,
        title TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        system_prompt TEXT,
        compaction_enabled INTEGER DEFAULT 1,
        compaction_model TEXT,
        compaction_token_threshold INTEGER,
        compaction_inception_count INTEGER,
        compaction_working_window_count INTEGER,
        token_estimate INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_results TEXT,
        is_compaction_summary INTEGER DEFAULT 0,
        is_inception INTEGER DEFAULT 0,
        token_count INTEGER,
        sequence INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS compaction_history (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        edited_summary TEXT,
        original_tokens INTEGER NOT NULL,
        compacted_tokens INTEGER NOT NULL,
        messages_pruned INTEGER NOT NULL,
        from_sequence INTEGER NOT NULL,
        to_sequence INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  });

  afterEach(() => {
    closeDb();
  });

  describe("createSession", () => {
    it("creates a session with required fields", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      expect(session.id).toBeDefined();
      expect(session.workingDirectory).toBe("/test");
      expect(session.provider).toBe("anthropic");
      expect(session.model).toBe("claude-3-opus");
      expect(session.compactionEnabled).toBe(true);
      expect(session.tokenEstimate).toBe(0);
      expect(session.messageCount).toBe(0);
    });

    it("creates a session with custom id", async () => {
      const session = await manager.createSession({
        id: "custom-id",
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      expect(session.id).toBe("custom-id");
    });

    it("creates a session with optional fields", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
        title: "Test Session",
        systemPrompt: "You are a helpful assistant",
        compactionEnabled: false,
        compactionTokenThreshold: 50000,
      });

      expect(session.title).toBe("Test Session");
      expect(session.systemPrompt).toBe("You are a helpful assistant");
      expect(session.compactionEnabled).toBe(false);
      expect(session.compactionTokenThreshold).toBe(50000);
    });
  });

  describe("getSession", () => {
    it("returns null for non-existent session", async () => {
      const session = await manager.getSession("non-existent");
      expect(session).toBeNull();
    });

    it("returns the session if it exists", async () => {
      const created = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      const fetched = await manager.getSession(created.id);
      expect(fetched).toEqual(created);
    });
  });

  describe("updateSession", () => {
    it("updates session fields", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      const updated = await manager.updateSession(session.id, {
        title: "Updated Title",
        tokenEstimate: 1000,
      });

      expect(updated?.title).toBe("Updated Title");
      expect(updated?.tokenEstimate).toBe(1000);
    });
  });

  describe("addMessage", () => {
    it("adds a message to a session", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      const message = await manager.addMessage({
        sessionId: session.id,
        role: "user",
        content: "Hello",
        sequence: 0,
        tokenCount: 10,
      });

      expect(message.id).toBeDefined();
      expect(message.sessionId).toBe(session.id);
      expect(message.role).toBe("user");
      expect(message.content).toBe("Hello");
      expect(message.sequence).toBe(0);

      // Check session was updated
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession?.messageCount).toBe(1);
      expect(updatedSession?.tokenEstimate).toBe(10);
    });

    it("adds multiple messages in sequence", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      await manager.addMessage({
        sessionId: session.id,
        role: "user",
        content: "Hello",
        sequence: 0,
      });

      await manager.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Hi there!",
        sequence: 1,
      });

      const messages = await manager.getSessionMessages(session.id);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("user");
      expect(messages[1].role).toBe("assistant");
    });
  });

  describe("getSessionMessages", () => {
    it("returns messages in sequence order", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      // Add messages out of order
      await manager.addMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Response",
        sequence: 1,
      });

      await manager.addMessage({
        sessionId: session.id,
        role: "user",
        content: "Question",
        sequence: 0,
      });

      const messages = await manager.getSessionMessages(session.id);
      expect(messages[0].sequence).toBe(0);
      expect(messages[1].sequence).toBe(1);
    });
  });

  describe("getNextSequence", () => {
    it("returns 0 for empty session", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      const nextSeq = await manager.getNextSequence(session.id);
      expect(nextSeq).toBe(0);
    });

    it("returns next sequence number", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      await manager.addMessage({
        sessionId: session.id,
        role: "user",
        content: "Hello",
        sequence: 0,
      });

      const nextSeq = await manager.getNextSequence(session.id);
      expect(nextSeq).toBe(1);
    });
  });

  describe("recordCompaction", () => {
    it("records compaction history", async () => {
      const session = await manager.createSession({
        workingDirectory: "/test",
        provider: "anthropic",
        model: "claude-3-opus",
      });

      const compaction = await manager.recordCompaction({
        sessionId: session.id,
        summary: "Summary of conversation",
        originalTokens: 10000,
        compactedTokens: 500,
        messagesPruned: 20,
        fromSequence: 0,
        toSequence: 19,
      });

      expect(compaction.id).toBeDefined();
      expect(compaction.summary).toBe("Summary of conversation");
      expect(compaction.originalTokens).toBe(10000);
      expect(compaction.compactedTokens).toBe(500);

      const history = await manager.getCompactionHistory(session.id);
      expect(history).toHaveLength(1);
    });
  });
});
