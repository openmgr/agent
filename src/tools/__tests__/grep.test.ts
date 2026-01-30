import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { grepTool } from "../grep.js";
import { useTempDir } from "../../__tests__/helpers/temp-dir.js";
import type { ToolContext } from "../../types.js";

describe("grep tool", () => {
  const tempDir = useTempDir("grep");
  let ctx: ToolContext;

  beforeEach(async () => {
    await tempDir.setup();
    ctx = {
      workingDirectory: tempDir.path,
      sessionId: "test-session",
    };
  });

  afterEach(async () => {
    await tempDir.teardown();
  });

  describe("basic pattern matching", () => {
    it("should find simple string patterns", async () => {
      await tempDir.createFile("test.txt", "Hello World\nGoodbye World");
      const result = await grepTool.execute({ pattern: "Hello" }, ctx);
      expect(result.output).toContain("test.txt");
      expect(result.output).toContain("Hello World");
      expect(result.metadata).toMatchObject({ count: 1 });
    });

    it("should find pattern in multiple files", async () => {
      await tempDir.createFile("file1.txt", "Hello from file1");
      await tempDir.createFile("file2.txt", "Hello from file2");
      await tempDir.createFile("file3.txt", "Goodbye");

      const result = await grepTool.execute({ pattern: "Hello" }, ctx);
      expect(result.output).toContain("file1.txt");
      expect(result.output).toContain("file2.txt");
      expect(result.output).not.toContain("file3.txt");
      expect(result.metadata).toMatchObject({ count: 2 });
    });

    it("should find multiple matches in same file", async () => {
      await tempDir.createFile(
        "multi.txt",
        "Line 1 with TODO\nLine 2\nLine 3 with TODO\nLine 4"
      );
      const result = await grepTool.execute({ pattern: "TODO" }, ctx);
      expect(result.output).toContain("Line 1 with TODO");
      expect(result.output).toContain("Line 3 with TODO");
      expect(result.metadata).toMatchObject({ count: 2 });
    });
  });

  describe("regex patterns", () => {
    it("should support regex patterns", async () => {
      await tempDir.createFile("code.ts", "const foo = 'bar';\nconst baz = 123;");
      const result = await grepTool.execute({ pattern: "const \\w+ =" }, ctx);
      expect(result.output).toContain("const foo =");
      expect(result.output).toContain("const baz =");
      expect(result.metadata).toMatchObject({ count: 2 });
    });

    it("should support alternation", async () => {
      // Use files far apart so context lines don't overlap
      await tempDir.createFile("a.txt", "apple");
      await tempDir.createFile("b.txt", "banana");
      await tempDir.createFile("c.txt", "cherry");
      const result = await grepTool.execute({ pattern: "apple|cherry" }, ctx);
      expect(result.output).toContain("apple");
      expect(result.output).toContain("cherry");
      expect(result.output).not.toContain("banana");
      expect(result.metadata).toMatchObject({ count: 2 });
    });

    it("should return error for invalid regex", async () => {
      await tempDir.createFile("test.txt", "content");
      const result = await grepTool.execute({ pattern: "[invalid" }, ctx);
      expect(result.output).toContain("Invalid regex");
      expect(result.metadata).toEqual({ error: true });
    });
  });

  describe("case sensitivity", () => {
    it("should be case-insensitive by default", async () => {
      await tempDir.createFile("test.txt", "Hello\nHELLO\nhello");
      const result = await grepTool.execute({ pattern: "hello" }, ctx);
      expect(result.metadata).toMatchObject({ count: 3 });
    });

    it("should respect caseSensitive option", async () => {
      // Use separate files to avoid context line issues
      await tempDir.createFile("lower.txt", "hello lowercase");
      await tempDir.createFile("upper.txt", "HELLO uppercase");
      await tempDir.createFile("mixed.txt", "Hello mixed");
      const result = await grepTool.execute(
        { pattern: "hello", caseSensitive: true },
        ctx
      );
      expect(result.metadata).toMatchObject({ count: 1 });
      expect(result.output).toContain("lower.txt");
      expect(result.output).not.toContain("upper.txt");
      expect(result.output).not.toContain("mixed.txt");
    });
  });

  describe("include filter", () => {
    it("should filter by file extension", async () => {
      await tempDir.createFile("file.ts", "const x = 1;");
      await tempDir.createFile("file.js", "const x = 1;");
      await tempDir.createFile("file.txt", "const x = 1;");

      const result = await grepTool.execute(
        { pattern: "const", include: "*.ts" },
        ctx
      );
      expect(result.output).toContain("file.ts");
      expect(result.output).not.toContain("file.js");
      expect(result.output).not.toContain("file.txt");
      expect(result.metadata).toMatchObject({ count: 1 });
    });

    it("should filter with glob pattern", async () => {
      await tempDir.createFile("src/index.ts", "export const API = true;");
      await tempDir.createFile("lib/index.ts", "export const API = true;");
      await tempDir.createFile("test/index.ts", "export const API = true;");

      const result = await grepTool.execute(
        { pattern: "API", include: "src/**/*.ts" },
        ctx
      );
      expect(result.output).toContain("src/index.ts");
      expect(result.output).not.toContain("lib/index.ts");
      expect(result.output).not.toContain("test/index.ts");
      expect(result.metadata).toMatchObject({ count: 1 });
    });
  });

  describe("context lines", () => {
    it("should show context lines around match", async () => {
      await tempDir.createFile(
        "context.txt",
        "Line 1\nLine 2\nLine 3 MATCH\nLine 4\nLine 5"
      );
      const result = await grepTool.execute({ pattern: "MATCH" }, ctx);
      expect(result.output).toContain("Line 1");
      expect(result.output).toContain("Line 2");
      expect(result.output).toContain("Line 3 MATCH");
      expect(result.output).toContain("Line 4");
      expect(result.output).toContain("Line 5");
    });

    it("should handle match at start of file", async () => {
      await tempDir.createFile("start.txt", "MATCH here\nLine 2\nLine 3");
      const result = await grepTool.execute({ pattern: "MATCH" }, ctx);
      expect(result.output).toContain("MATCH here");
      expect(result.output).toContain("Line 2");
    });

    it("should handle match at end of file", async () => {
      await tempDir.createFile("end.txt", "Line 1\nLine 2\nMATCH here");
      const result = await grepTool.execute({ pattern: "MATCH" }, ctx);
      expect(result.output).toContain("Line 2");
      expect(result.output).toContain("MATCH here");
    });
  });

  describe("no matches", () => {
    it("should return message when no matches found", async () => {
      await tempDir.createFile("test.txt", "Hello World");
      const result = await grepTool.execute({ pattern: "NotFound" }, ctx);
      expect(result.output).toContain("No matches found");
      expect(result.metadata).toMatchObject({ count: 0 });
    });

    it("should return message when no files match include filter", async () => {
      await tempDir.createFile("test.txt", "content");
      const result = await grepTool.execute(
        { pattern: "content", include: "*.xyz" },
        ctx
      );
      expect(result.output).toContain("No matches found");
      expect(result.metadata).toMatchObject({ count: 0 });
    });
  });

  describe("special cases", () => {
    it("should ignore binary files", async () => {
      // Create a file with null bytes (binary-like)
      await tempDir.createFile("binary.bin", "hello\0world");
      await tempDir.createFile("text.txt", "hello world");

      const result = await grepTool.execute({ pattern: "hello" }, ctx);
      expect(result.output).toContain("text.txt");
      expect(result.output).not.toContain("binary.bin");
      expect(result.metadata).toMatchObject({ count: 1 });
    });

    it("should ignore node_modules", async () => {
      await tempDir.createFile("src/index.ts", "TODO: fix");
      await tempDir.createFile("node_modules/pkg/index.ts", "TODO: fix");

      const result = await grepTool.execute({ pattern: "TODO" }, ctx);
      expect(result.output).toContain("src/index.ts");
      expect(result.output).not.toContain("node_modules");
      expect(result.metadata).toMatchObject({ count: 1 });
    });

    it("should ignore dist folder", async () => {
      await tempDir.createFile("src/index.ts", "TODO: fix");
      await tempDir.createFile("dist/index.ts", "TODO: fix");

      const result = await grepTool.execute({ pattern: "TODO" }, ctx);
      expect(result.output).toContain("src/index.ts");
      expect(result.output).not.toContain("dist");
    });
  });

  describe("output formatting", () => {
    it("should include file path and line number", async () => {
      await tempDir.createFile("test.txt", "Line 1\nLine 2 MATCH\nLine 3");
      const result = await grepTool.execute({ pattern: "MATCH" }, ctx);
      expect(result.output).toMatch(/test\.txt:2/);
    });

    it("should include line numbers in context", async () => {
      await tempDir.createFile("test.txt", "Line 1\nLine 2 MATCH\nLine 3");
      const result = await grepTool.execute({ pattern: "MATCH" }, ctx);
      expect(result.output).toMatch(/1: Line 1/);
      expect(result.output).toMatch(/2: Line 2 MATCH/);
      expect(result.output).toMatch(/3: Line 3/);
    });
  });
});
