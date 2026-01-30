import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  McpStdioConfigSchema,
  McpSseConfigSchema,
  McpServerConfigSchema,
  expandEnvVars,
  type McpResource,
  type McpPrompt,
  type McpTool,
} from "../types.js";

describe("MCP types", () => {
  describe("McpStdioConfigSchema", () => {
    it("should parse valid stdio config", () => {
      const result = McpStdioConfigSchema.safeParse({
        command: "node",
        args: ["server.js"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.command).toBe("node");
        expect(result.data.args).toEqual(["server.js"]);
        expect(result.data.transport).toBe("stdio");
        expect(result.data.enabled).toBe(true);
        expect(result.data.timeout).toBe(30000);
      }
    });

    it("should parse config with explicit transport", () => {
      const result = McpStdioConfigSchema.safeParse({
        transport: "stdio",
        command: "python",
        args: ["-m", "mcp_server"],
      });
      expect(result.success).toBe(true);
    });

    it("should parse config with env vars", () => {
      const result = McpStdioConfigSchema.safeParse({
        command: "node",
        env: { API_KEY: "secret" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.env).toEqual({ API_KEY: "secret" });
      }
    });

    it("should parse config with custom timeout", () => {
      const result = McpStdioConfigSchema.safeParse({
        command: "slow-server",
        timeout: 60000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeout).toBe(60000);
      }
    });

    it("should parse config with enabled=false", () => {
      const result = McpStdioConfigSchema.safeParse({
        command: "node",
        enabled: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
      }
    });

    it("should reject config without command", () => {
      const result = McpStdioConfigSchema.safeParse({
        args: ["server.js"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("McpSseConfigSchema", () => {
    it("should parse valid SSE config", () => {
      const result = McpSseConfigSchema.safeParse({
        transport: "sse",
        url: "https://api.example.com/mcp",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe("https://api.example.com/mcp");
        expect(result.data.transport).toBe("sse");
      }
    });

    it("should parse config with headers", () => {
      const result = McpSseConfigSchema.safeParse({
        transport: "sse",
        url: "https://api.example.com",
        headers: { Authorization: "Bearer token" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.headers).toEqual({ Authorization: "Bearer token" });
      }
    });

    it("should parse config with OAuth", () => {
      const result = McpSseConfigSchema.safeParse({
        transport: "sse",
        url: "https://api.example.com",
        oauth: {
          clientId: "client123",
          authorizationUrl: "https://auth.example.com/authorize",
          tokenUrl: "https://auth.example.com/token",
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.oauth?.clientId).toBe("client123");
      }
    });

    it("should reject SSE config without transport", () => {
      const result = McpSseConfigSchema.safeParse({
        url: "https://api.example.com",
      });
      expect(result.success).toBe(false);
    });

    it("should reject SSE config without url", () => {
      const result = McpSseConfigSchema.safeParse({
        transport: "sse",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("McpServerConfigSchema (discriminated union)", () => {
    it("should parse stdio config", () => {
      const result = McpServerConfigSchema.safeParse({
        transport: "stdio",
        command: "node",
      });
      expect(result.success).toBe(true);
    });

    it("should parse sse config", () => {
      const result = McpServerConfigSchema.safeParse({
        transport: "sse",
        url: "https://example.com",
      });
      expect(result.success).toBe(true);
    });

    it("should default to stdio when transport is missing", () => {
      // Note: This uses McpStdioConfigSchema directly since the discriminated union
      // requires transport to be present
      const result = McpStdioConfigSchema.safeParse({
        command: "node",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transport).toBe("stdio");
      }
    });
  });

  describe("expandEnvVars", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return undefined for undefined input", () => {
      expect(expandEnvVars(undefined)).toBeUndefined();
    });

    it("should expand environment variables", () => {
      process.env.MY_VAR = "hello";
      process.env.OTHER_VAR = "world";

      const result = expandEnvVars({
        KEY1: "${MY_VAR}",
        KEY2: "${OTHER_VAR}",
        KEY3: "static",
      });

      expect(result).toEqual({
        KEY1: "hello",
        KEY2: "world",
        KEY3: "static",
      });
    });

    it("should replace missing env vars with empty string", () => {
      delete process.env.MISSING_VAR;

      const result = expandEnvVars({
        KEY: "${MISSING_VAR}",
      });

      expect(result).toEqual({ KEY: "" });
    });

    it("should handle multiple variables in one value", () => {
      process.env.HOST = "localhost";
      process.env.PORT = "3000";

      const result = expandEnvVars({
        URL: "http://${HOST}:${PORT}",
      });

      expect(result).toEqual({ URL: "http://localhost:3000" });
    });

    it("should handle empty env object", () => {
      const result = expandEnvVars({});
      expect(result).toEqual({});
    });
  });

  describe("McpResource type", () => {
    it("should have correct structure", () => {
      const resource: McpResource = {
        uri: "file:///path/to/file.txt",
        name: "Test File",
        description: "A test file",
        mimeType: "text/plain",
        serverName: "test-server",
      };

      expect(resource.uri).toBe("file:///path/to/file.txt");
      expect(resource.name).toBe("Test File");
      expect(resource.description).toBe("A test file");
      expect(resource.mimeType).toBe("text/plain");
      expect(resource.serverName).toBe("test-server");
    });

    it("should allow optional fields to be undefined", () => {
      const resource: McpResource = {
        uri: "file:///minimal.txt",
        name: "Minimal",
        serverName: "server",
      };

      expect(resource.description).toBeUndefined();
      expect(resource.mimeType).toBeUndefined();
    });
  });

  describe("McpPrompt type", () => {
    it("should have correct structure", () => {
      const prompt: McpPrompt = {
        name: "test-prompt",
        description: "A test prompt",
        arguments: [
          { name: "input", description: "Input text", required: true },
          { name: "style", description: "Output style", required: false },
        ],
        serverName: "test-server",
      };

      expect(prompt.name).toBe("test-prompt");
      expect(prompt.description).toBe("A test prompt");
      expect(prompt.arguments).toHaveLength(2);
      expect(prompt.arguments![0].name).toBe("input");
      expect(prompt.arguments![0].required).toBe(true);
      expect(prompt.arguments![1].required).toBe(false);
      expect(prompt.serverName).toBe("test-server");
    });

    it("should allow optional fields to be undefined", () => {
      const prompt: McpPrompt = {
        name: "minimal-prompt",
        serverName: "server",
      };

      expect(prompt.description).toBeUndefined();
      expect(prompt.arguments).toBeUndefined();
    });

    it("should allow empty arguments array", () => {
      const prompt: McpPrompt = {
        name: "no-args-prompt",
        arguments: [],
        serverName: "server",
      };

      expect(prompt.arguments).toHaveLength(0);
    });
  });

  describe("McpTool type", () => {
    it("should have correct structure", () => {
      const tool: McpTool = {
        name: "test-tool",
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: {
            input: { type: "string" },
          },
          required: ["input"],
        },
        serverName: "test-server",
      };

      expect(tool.name).toBe("test-tool");
      expect(tool.description).toBe("A test tool");
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.serverName).toBe("test-server");
    });
  });
});
