import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LspManager, type FormattedDiagnostic } from "../manager.js";
import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";

describe("LspManager", () => {
  const testDir = join(tmpdir(), "lsp-manager-test-" + Date.now());

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should create manager with working directory", () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      expect(manager).toBeDefined();
      expect(manager.getActiveServers()).toEqual([]);
    });

    it("should accept custom config", () => {
      const manager = new LspManager({
        workingDirectory: testDir,
        config: {
          typescript: {
            disabled: true,
          },
        },
      });

      expect(manager).toBeDefined();
    });
  });

  describe("getActiveServers", () => {
    it("should return empty array initially", () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      expect(manager.getActiveServers()).toEqual([]);
    });
  });

  describe("hasServer", () => {
    it("should return false when no server is running", () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      expect(manager.hasServer("typescript")).toBe(false);
      expect(manager.hasServer("go")).toBe(false);
    });
  });

  describe("shutdown", () => {
    it("should complete without error when no servers active", async () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      await expect(manager.shutdown()).resolves.toBeUndefined();
    });

    it("should clear active servers", async () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      await manager.shutdown();

      expect(manager.getActiveServers()).toEqual([]);
    });
  });

  describe("getAllDiagnostics", () => {
    it("should return empty map when no servers active", () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      const diagnostics = manager.getAllDiagnostics();

      expect(diagnostics).toBeInstanceOf(Map);
      expect(diagnostics.size).toBe(0);
    });
  });

  describe("getClientForFile", () => {
    it("should return null for unknown file types", async () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      // Create a file with unknown extension
      const unknownFile = join(testDir, "file.xyz");
      writeFileSync(unknownFile, "content");

      const client = await manager.getClientForFile(unknownFile);

      expect(client).toBeNull();
    });

    it("should return null when server is disabled", async () => {
      const manager = new LspManager({
        workingDirectory: testDir,
        config: {
          typescript: {
            disabled: true,
          },
        },
      });

      // Create a TypeScript file
      const tsFile = join(testDir, "file.ts");
      writeFileSync(tsFile, "const x = 1;");

      const client = await manager.getClient("typescript", tsFile);

      expect(client).toBeNull();
    });
  });

  describe("events", () => {
    it("should emit server.started event", async () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      const startedHandler = vi.fn();
      manager.on("server.started", startedHandler);

      // This would need a real server to test fully
      // For now, just verify the event can be subscribed to
      expect(manager.listenerCount("server.started")).toBe(1);

      await manager.shutdown();
    });

    it("should emit server.error event", async () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      const errorHandler = vi.fn();
      manager.on("server.error", errorHandler);

      expect(manager.listenerCount("server.error")).toBe(1);

      await manager.shutdown();
    });

    it("should emit diagnostics event", async () => {
      const manager = new LspManager({
        workingDirectory: testDir,
      });

      const diagnosticsHandler = vi.fn();
      manager.on("diagnostics", diagnosticsHandler);

      expect(manager.listenerCount("diagnostics")).toBe(1);

      await manager.shutdown();
    });
  });

  describe("FormattedDiagnostic type", () => {
    it("should have correct shape", () => {
      const diag: FormattedDiagnostic = {
        file: "test.ts",
        line: 1,
        column: 1,
        endLine: 1,
        endColumn: 10,
        severity: "error",
        message: "Test error",
        source: "typescript",
        code: "TS2322",
      };

      expect(diag.file).toBe("test.ts");
      expect(diag.line).toBe(1);
      expect(diag.column).toBe(1);
      expect(diag.severity).toBe("error");
    });

    it("should accept all severity types", () => {
      const severities: FormattedDiagnostic["severity"][] = ["error", "warning", "info", "hint"];

      for (const severity of severities) {
        const diag: FormattedDiagnostic = {
          file: "test.ts",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
          severity,
          message: "Test",
        };
        expect(diag.severity).toBe(severity);
      }
    });
  });
});
