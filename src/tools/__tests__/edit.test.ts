import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";
import { editTool } from "../edit.js";
import { useTempDir } from "../../__tests__/helpers/temp-dir.js";
import type { ToolContext } from "../../types.js";

describe("edit tool", () => {
  const tempDir = useTempDir("edit");
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

  describe("basic editing", () => {
    it("should replace a string in a file", async () => {
      await tempDir.createFile("test.txt", "Hello, World!");
      const result = await editTool.execute(
        { path: "test.txt", oldString: "World", newString: "Universe" },
        ctx
      );
      expect(result.output).toContain("Successfully replaced 1 occurrence");
      expect(result.metadata).toMatchObject({ path: "test.txt", replacements: 1 });

      const actual = await readFile(join(tempDir.path, "test.txt"), "utf-8");
      expect(actual).toBe("Hello, Universe!");
    });

    it("should handle multi-line replacements", async () => {
      const content = "function foo() {\n  console.log('old');\n}";
      const oldStr = "function foo() {\n  console.log('old');\n}";
      const newStr = "function foo() {\n  console.log('new');\n  return true;\n}";
      await tempDir.createFile("code.js", content);

      const result = await editTool.execute(
        { path: "code.js", oldString: oldStr, newString: newStr },
        ctx
      );
      expect(result.output).toContain("Successfully replaced");

      const actual = await readFile(join(tempDir.path, "code.js"), "utf-8");
      expect(actual).toBe(newStr);
    });

    it("should preserve whitespace exactly", async () => {
      const content = "  indented\n    more indented";
      await tempDir.createFile("whitespace.txt", content);

      const result = await editTool.execute(
        { path: "whitespace.txt", oldString: "  indented", newString: "no indent" },
        ctx
      );
      expect(result.output).toContain("Successfully replaced");

      const actual = await readFile(join(tempDir.path, "whitespace.txt"), "utf-8");
      expect(actual).toBe("no indent\n    more indented");
    });
  });

  describe("replaceAll option", () => {
    it("should replace only first occurrence by default", async () => {
      await tempDir.createFile("multi.txt", "foo bar foo baz foo");
      const result = await editTool.execute(
        { path: "multi.txt", oldString: "foo", newString: "qux" },
        ctx
      );
      // Should fail because multiple occurrences exist
      expect(result.output).toContain("found 3 times");
      expect(result.metadata).toMatchObject({ error: true, occurrences: 3 });
    });

    it("should replace all occurrences when replaceAll is true", async () => {
      await tempDir.createFile("multi.txt", "foo bar foo baz foo");
      const result = await editTool.execute(
        { path: "multi.txt", oldString: "foo", newString: "qux", replaceAll: true },
        ctx
      );
      expect(result.output).toContain("Successfully replaced 3 occurrences");
      expect(result.metadata).toMatchObject({ replacements: 3 });

      const actual = await readFile(join(tempDir.path, "multi.txt"), "utf-8");
      expect(actual).toBe("qux bar qux baz qux");
    });

    it("should work with replaceAll on single occurrence", async () => {
      await tempDir.createFile("single.txt", "foo bar baz");
      const result = await editTool.execute(
        { path: "single.txt", oldString: "bar", newString: "qux", replaceAll: true },
        ctx
      );
      expect(result.output).toContain("Successfully replaced 1 occurrence");

      const actual = await readFile(join(tempDir.path, "single.txt"), "utf-8");
      expect(actual).toBe("foo qux baz");
    });
  });

  describe("error handling", () => {
    it("should return error when oldString not found", async () => {
      await tempDir.createFile("test.txt", "Hello, World!");
      const result = await editTool.execute(
        { path: "test.txt", oldString: "NotFound", newString: "Replacement" },
        ctx
      );
      expect(result.output).toContain("oldString not found");
      expect(result.metadata).toEqual({ error: true });
    });

    it("should return error when oldString equals newString", async () => {
      await tempDir.createFile("test.txt", "Hello, World!");
      const result = await editTool.execute(
        { path: "test.txt", oldString: "Hello", newString: "Hello" },
        ctx
      );
      expect(result.output).toContain("oldString and newString are identical");
      expect(result.metadata).toEqual({ error: true });
    });

    it("should return error for non-existent file", async () => {
      const result = await editTool.execute(
        { path: "nonexistent.txt", oldString: "foo", newString: "bar" },
        ctx
      );
      expect(result.output).toContain("File not found");
      expect(result.metadata).toEqual({ error: true });
    });

    it("should return error for path outside working directory", async () => {
      const result = await editTool.execute(
        { path: "../../../etc/passwd", oldString: "root", newString: "hacked" },
        ctx
      );
      expect(result.output).toContain("outside the working directory");
      expect(result.metadata).toEqual({ error: true });
    });
  });

  describe("edge cases", () => {
    it("should handle replacing with empty string", async () => {
      await tempDir.createFile("test.txt", "Hello, World!");
      const result = await editTool.execute(
        { path: "test.txt", oldString: ", World", newString: "" },
        ctx
      );
      expect(result.output).toContain("Successfully replaced");

      const actual = await readFile(join(tempDir.path, "test.txt"), "utf-8");
      expect(actual).toBe("Hello!");
    });

    it("should handle replacing empty string with content at start", async () => {
      await tempDir.createFile("test.txt", "Hello");
      // Empty string matches at start, but we don't support this as it's ambiguous
      const result = await editTool.execute(
        { path: "test.txt", oldString: "", newString: "prefix" },
        ctx
      );
      // Behavior: empty string matches at every position, so many occurrences
      expect(result.metadata).toMatchObject({ error: true });
    });

    it("should handle special regex characters in oldString", async () => {
      await tempDir.createFile("regex.txt", "foo.*bar");
      const result = await editTool.execute(
        { path: "regex.txt", oldString: ".*", newString: "+" },
        ctx
      );
      expect(result.output).toContain("Successfully replaced");

      const actual = await readFile(join(tempDir.path, "regex.txt"), "utf-8");
      expect(actual).toBe("foo+bar");
    });

    it("should handle unicode content", async () => {
      await tempDir.createFile("unicode.txt", "Hello 日本語 World");
      const result = await editTool.execute(
        { path: "unicode.txt", oldString: "日本語", newString: "にほんご" },
        ctx
      );
      expect(result.output).toContain("Successfully replaced");

      const actual = await readFile(join(tempDir.path, "unicode.txt"), "utf-8");
      expect(actual).toBe("Hello にほんご World");
    });
  });

  describe("nested files", () => {
    it("should edit files in subdirectories", async () => {
      await tempDir.createFile("sub/dir/file.txt", "Original content");
      const result = await editTool.execute(
        { path: "sub/dir/file.txt", oldString: "Original", newString: "Modified" },
        ctx
      );
      expect(result.output).toContain("Successfully replaced");
      expect(result.metadata).toMatchObject({ path: "sub/dir/file.txt" });

      const actual = await readFile(
        join(tempDir.path, "sub/dir/file.txt"),
        "utf-8"
      );
      expect(actual).toBe("Modified content");
    });
  });
});
