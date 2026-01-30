import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";
import { writeTool } from "../write.js";
import { useTempDir } from "../../__tests__/helpers/temp-dir.js";
import type { ToolContext } from "../../types.js";

describe("write tool", () => {
  const tempDir = useTempDir("write");
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

  describe("basic file writing", () => {
    it("should create a new file", async () => {
      const result = await writeTool.execute(
        { path: "new.txt", content: "Hello, World!" },
        ctx
      );
      expect(result.output).toContain("Successfully wrote");
      expect(result.output).toContain("new.txt");
      expect(result.metadata).toMatchObject({
        path: "new.txt",
        lines: 1,
        bytes: 13,
      });

      const actual = await readFile(join(tempDir.path, "new.txt"), "utf-8");
      expect(actual).toBe("Hello, World!");
    });

    it("should overwrite existing file", async () => {
      await tempDir.createFile("existing.txt", "Old content");
      const result = await writeTool.execute(
        { path: "existing.txt", content: "New content" },
        ctx
      );
      expect(result.output).toContain("Successfully wrote");

      const actual = await readFile(join(tempDir.path, "existing.txt"), "utf-8");
      expect(actual).toBe("New content");
    });

    it("should report correct line count", async () => {
      const content = "Line 1\nLine 2\nLine 3";
      const result = await writeTool.execute(
        { path: "lines.txt", content },
        ctx
      );
      expect(result.metadata).toMatchObject({ lines: 3 });
    });

    it("should report correct byte count for ASCII", async () => {
      const content = "Hello";
      const result = await writeTool.execute(
        { path: "bytes.txt", content },
        ctx
      );
      expect(result.metadata).toMatchObject({ bytes: 5 });
    });

    it("should report correct byte count for unicode", async () => {
      const content = "日本語"; // 9 bytes in UTF-8
      const result = await writeTool.execute(
        { path: "unicode.txt", content },
        ctx
      );
      expect(result.metadata).toMatchObject({ bytes: 9 });
    });
  });

  describe("directory creation", () => {
    it("should create parent directories automatically", async () => {
      const result = await writeTool.execute(
        { path: "sub/dir/deep/file.txt", content: "Deep content" },
        ctx
      );
      expect(result.output).toContain("Successfully wrote");
      expect(result.metadata).toMatchObject({ path: "sub/dir/deep/file.txt" });

      const actual = await readFile(
        join(tempDir.path, "sub/dir/deep/file.txt"),
        "utf-8"
      );
      expect(actual).toBe("Deep content");
    });
  });

  describe("error handling", () => {
    it("should return error for path outside working directory", async () => {
      const result = await writeTool.execute(
        { path: "../../../tmp/evil.txt", content: "malicious" },
        ctx
      );
      expect(result.output).toContain("outside the working directory");
      expect(result.metadata).toEqual({ error: true });
    });

    it("should return error for absolute path outside working directory", async () => {
      const result = await writeTool.execute(
        { path: "/tmp/evil.txt", content: "malicious" },
        ctx
      );
      expect(result.output).toContain("outside the working directory");
      expect(result.metadata).toEqual({ error: true });
    });
  });

  describe("special content", () => {
    it("should handle empty content", async () => {
      const result = await writeTool.execute(
        { path: "empty.txt", content: "" },
        ctx
      );
      expect(result.output).toContain("Successfully wrote");
      expect(result.metadata).toMatchObject({ lines: 1, bytes: 0 });

      const actual = await readFile(join(tempDir.path, "empty.txt"), "utf-8");
      expect(actual).toBe("");
    });

    it("should handle content with special characters", async () => {
      const content = "Tab:\tNewline:\nCarriage:\rNull:";
      const result = await writeTool.execute(
        { path: "special.txt", content },
        ctx
      );
      expect(result.output).toContain("Successfully wrote");

      const actual = await readFile(join(tempDir.path, "special.txt"), "utf-8");
      expect(actual).toBe(content);
    });

    it("should handle content with emojis", async () => {
      const content = "Emoji test: 🎉🚀💻";
      const result = await writeTool.execute(
        { path: "emoji.txt", content },
        ctx
      );
      expect(result.output).toContain("Successfully wrote");

      const actual = await readFile(join(tempDir.path, "emoji.txt"), "utf-8");
      expect(actual).toBe(content);
    });
  });
});
