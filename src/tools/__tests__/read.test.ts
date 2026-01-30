import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readTool } from "../read.js";
import { useTempDir } from "../../__tests__/helpers/temp-dir.js";
import type { ToolContext } from "../../types.js";

describe("read tool", () => {
  const tempDir = useTempDir("read");
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

  describe("basic file reading", () => {
    it("should read a simple file", async () => {
      await tempDir.createFile("test.txt", "Hello, World!");
      const result = await readTool.execute({ path: "test.txt" }, ctx);
      expect(result.output).toContain("Hello, World!");
      expect(result.metadata).toEqual({
        path: "test.txt",
        totalLines: 1,
        shownLines: 1,
      });
    });

    it("should read file with multiple lines", async () => {
      const content = "Line 1\nLine 2\nLine 3";
      await tempDir.createFile("multi.txt", content);
      const result = await readTool.execute({ path: "multi.txt" }, ctx);
      expect(result.output).toContain("Line 1");
      expect(result.output).toContain("Line 2");
      expect(result.output).toContain("Line 3");
      expect(result.metadata).toEqual({
        path: "multi.txt",
        totalLines: 3,
        shownLines: 3,
      });
    });

    it("should add line numbers", async () => {
      await tempDir.createFile("numbered.txt", "First\nSecond\nThird");
      const result = await readTool.execute({ path: "numbered.txt" }, ctx);
      expect(result.output).toMatch(/^\s*1\tFirst/m);
      expect(result.output).toMatch(/^\s*2\tSecond/m);
      expect(result.output).toMatch(/^\s*3\tThird/m);
    });
  });

  describe("offset and limit", () => {
    it("should respect offset parameter", async () => {
      const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
      await tempDir.createFile("offset.txt", content);
      const result = await readTool.execute(
        { path: "offset.txt", offset: 2 },
        ctx
      );
      expect(result.output).toContain("Line 3");
      expect(result.output).toContain("Line 4");
      expect(result.output).not.toContain("1\tLine 1");
      expect(result.output).toContain("Showing lines 3-5 of 5");
    });

    it("should respect limit parameter", async () => {
      const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
      await tempDir.createFile("limit.txt", content);
      const result = await readTool.execute(
        { path: "limit.txt", limit: 2 },
        ctx
      );
      expect(result.output).toContain("Line 1");
      expect(result.output).toContain("Line 2");
      expect(result.output).not.toContain("3\tLine 3");
      expect(result.output).toContain("Showing lines 1-2 of 5");
    });

    it("should combine offset and limit", async () => {
      const content = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
      await tempDir.createFile("both.txt", content);
      const result = await readTool.execute(
        { path: "both.txt", offset: 1, limit: 2 },
        ctx
      );
      expect(result.output).toContain("Line 2");
      expect(result.output).toContain("Line 3");
      expect(result.output).not.toContain("1\tLine 1");
      expect(result.output).not.toContain("4\tLine 4");
      expect(result.output).toContain("Showing lines 2-3 of 5");
    });
  });

  describe("nested files", () => {
    it("should read files in subdirectories", async () => {
      await tempDir.createFile("sub/dir/file.txt", "Nested content");
      const result = await readTool.execute(
        { path: "sub/dir/file.txt" },
        ctx
      );
      expect(result.output).toContain("Nested content");
      expect(result.metadata).toMatchObject({ path: "sub/dir/file.txt" });
    });
  });

  describe("error handling", () => {
    it("should return error for non-existent file", async () => {
      const result = await readTool.execute({ path: "nonexistent.txt" }, ctx);
      expect(result.output).toContain("Error: File not found");
      expect(result.metadata).toEqual({ error: true });
    });

    it("should return error for directory", async () => {
      await tempDir.createDir("mydir");
      const result = await readTool.execute({ path: "mydir" }, ctx);
      expect(result.output).toContain("is a directory");
      expect(result.metadata).toEqual({ error: true });
    });

    it("should return error for path outside working directory", async () => {
      const result = await readTool.execute({ path: "../../../etc/passwd" }, ctx);
      expect(result.output).toContain("outside the working directory");
      expect(result.metadata).toEqual({ error: true });
    });

    it("should return error for absolute path outside working directory", async () => {
      const result = await readTool.execute({ path: "/etc/passwd" }, ctx);
      expect(result.output).toContain("outside the working directory");
      expect(result.metadata).toEqual({ error: true });
    });
  });

  describe("special content", () => {
    it("should handle empty file", async () => {
      await tempDir.createFile("empty.txt", "");
      const result = await readTool.execute({ path: "empty.txt" }, ctx);
      expect(result.metadata).toMatchObject({ totalLines: 1, shownLines: 1 });
    });

    it("should handle file with special characters", async () => {
      const content = "Tab:\t\nUnicode: 日本語\nEmoji: 🎉";
      await tempDir.createFile("special.txt", content);
      const result = await readTool.execute({ path: "special.txt" }, ctx);
      expect(result.output).toContain("Tab:");
      expect(result.output).toContain("Unicode: 日本語");
      expect(result.output).toContain("Emoji: 🎉");
    });

    it("should handle file with trailing newline", async () => {
      await tempDir.createFile("trailing.txt", "Line 1\n");
      const result = await readTool.execute({ path: "trailing.txt" }, ctx);
      expect(result.metadata).toMatchObject({ totalLines: 2 });
    });
  });
});
