import { describe, it, expect } from "vitest";
import { sessions, messages, compactionHistory, mcpOAuthTokens } from "../schema.js";

describe("database schema", () => {
  describe("sessions table", () => {
    it("should have correct column structure", () => {
      // Verify sessions table has expected columns
      expect(sessions.id).toBeDefined();
      expect(sessions.parentId).toBeDefined();
      expect(sessions.workingDirectory).toBeDefined();
      expect(sessions.title).toBeDefined();
      expect(sessions.provider).toBeDefined();
      expect(sessions.model).toBeDefined();
      expect(sessions.systemPrompt).toBeDefined();
      expect(sessions.compactionEnabled).toBeDefined();
      expect(sessions.compactionModel).toBeDefined();
      expect(sessions.compactionTokenThreshold).toBeDefined();
      expect(sessions.compactionInceptionCount).toBeDefined();
      expect(sessions.compactionWorkingWindowCount).toBeDefined();
      expect(sessions.tokenEstimate).toBeDefined();
      expect(sessions.messageCount).toBeDefined();
      expect(sessions.createdAt).toBeDefined();
      expect(sessions.updatedAt).toBeDefined();
    });

    it("should have primary key on id", () => {
      expect(sessions.id.primary).toBe(true);
    });
  });

  describe("messages table", () => {
    it("should have correct column structure", () => {
      expect(messages.id).toBeDefined();
      expect(messages.sessionId).toBeDefined();
      expect(messages.role).toBeDefined();
      expect(messages.content).toBeDefined();
      expect(messages.toolCalls).toBeDefined();
      expect(messages.toolResults).toBeDefined();
      expect(messages.isCompactionSummary).toBeDefined();
      expect(messages.isInception).toBeDefined();
      expect(messages.tokenCount).toBeDefined();
      expect(messages.sequence).toBeDefined();
      expect(messages.createdAt).toBeDefined();
    });

    it("should have primary key on id", () => {
      expect(messages.id.primary).toBe(true);
    });
  });

  describe("compactionHistory table", () => {
    it("should have correct column structure", () => {
      expect(compactionHistory.id).toBeDefined();
      expect(compactionHistory.sessionId).toBeDefined();
      expect(compactionHistory.summary).toBeDefined();
      expect(compactionHistory.editedSummary).toBeDefined();
      expect(compactionHistory.originalTokens).toBeDefined();
      expect(compactionHistory.compactedTokens).toBeDefined();
      expect(compactionHistory.messagesPruned).toBeDefined();
      expect(compactionHistory.fromSequence).toBeDefined();
      expect(compactionHistory.toSequence).toBeDefined();
      expect(compactionHistory.createdAt).toBeDefined();
    });

    it("should have primary key on id", () => {
      expect(compactionHistory.id.primary).toBe(true);
    });
  });

  describe("mcpOAuthTokens table", () => {
    it("should have correct column structure", () => {
      expect(mcpOAuthTokens.serverName).toBeDefined();
      expect(mcpOAuthTokens.accessToken).toBeDefined();
      expect(mcpOAuthTokens.refreshToken).toBeDefined();
      expect(mcpOAuthTokens.tokenType).toBeDefined();
      expect(mcpOAuthTokens.expiresAt).toBeDefined();
      expect(mcpOAuthTokens.scopes).toBeDefined();
      expect(mcpOAuthTokens.createdAt).toBeDefined();
      expect(mcpOAuthTokens.updatedAt).toBeDefined();
    });

    it("should have primary key on serverName", () => {
      expect(mcpOAuthTokens.serverName.primary).toBe(true);
    });
  });
});
