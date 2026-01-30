import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { globTool } from "../glob.js";
import { useTempDir } from "../../__tests__/helpers/temp-dir.js";
import type { ToolContext } from "../../types.js";

describe("glob tool", () => {
  const tempDir = useTempDir("glob");
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
    it("should find all files with wildcard", async () => {
      await tempDir.createFile("file1.txt", "content1");
      await tempDir.createFile("file2.txt", "content2");
      await tempDir.createFile("file3.js", "content3");

      const result = await globTool.execute({ pattern: "*" }, ctx);
      expect(result.output).toContain("file1.txt");
      expect(result.output).toContain("file2.txt");
      expect(result.output).toContain("file3.js");
      expect(result.metadata).toMatchObject({ count: 3 });
    });

    it("should find files matching extension pattern", async () => {
      await tempDir.createFile("file1.txt", "content1");
      await tempDir.createFile("file2.txt", "content2");
      await tempDir.createFile("file3.js", "content3");

      const result = await globTool.execute({ pattern: "*.txt" }, ctx);
      expect(result.output).toContain("file1.txt");
      expect(result.output).toContain("file2.txt");
      expect(result.output).not.toContain("file3.js");
      expect(result.metadata).toMatchObject({ count: 2 });
    });

    it("should find files in subdirectories with **", async () => {
      await tempDir.createFile("root.ts", "root");
      await tempDir.createFile("src/index.ts", "src");
      await tempDir.createFile("src/utils/helper.ts", "utils");
      await tempDir.createFile("src/utils/other.js", "other");

      const result = await globTool.execute({ pattern: "**/*.ts" }, ctx);
      expect(result.output).toContain("root.ts");
      expect(result.output).toContain("src/index.ts");
      expect(result.output).toContain("src/utils/helper.ts");
      expect(result.output).not.toContain("other.js");
      expect(result.metadata).toMatchObject({ count: 3 });
    });

    it("should find files in specific subdirectory", async () => {
      await tempDir.createFile("root.ts", "root");
      await tempDir.createFile("src/index.ts", "src");
      await tempDir.createFile("lib/index.ts", "lib");

      const result = await globTool.execute({ pattern: "src/**/*.ts" }, ctx);
      expect(result.output).toContain("src/index.ts");
      expect(result.output).not.toContain("root.ts");
      expect(result.output).not.toContain("lib/index.ts");
      expect(result.metadata).toMatchObject({ count: 1 });
    });
  });

  describe("ignore patterns", () => {
    it("should ignore node_modules by default", async () => {
      await tempDir.createFile("src/index.ts", "src");
      await tempDir.createFile("node_modules/pkg/index.ts", "pkg");

      const result = await globTool.execute({ pattern: "**/*.ts" }, ctx);
      expect(result.output).toContain("src/index.ts");
      expect(result.output).not.toContain("node_modules");
      expect(result.metadata).toMatchObject({ count: 1 });
    });

    it("should ignore .git by default", async () => {
      await tempDir.createFile("src/index.ts", "src");
      await tempDir.createFile(".git/objects/abc", "git object");

      const result = await globTool.execute({ pattern: "**/*" }, ctx);
      expect(result.output).toContain("src/index.ts");
      expect(result.output).not.toContain(".git");
    });

    it("should respect custom ignore patterns", async () => {
      await tempDir.createFile("src/index.ts", "src");
      await tempDir.createFile("test/index.test.ts", "test");
      await tempDir.createFile("node_modules/pkg/index.ts", "pkg");

      const result = await globTool.execute(
        { pattern: "**/*.ts", ignore: ["**/test/**"] },
        ctx
      );
      expect(result.output).toContain("src/index.ts");
      expect(result.output).toContain("node_modules"); // node_modules no longer ignored
      expect(result.output).not.toContain("test/index.test.ts");
    });
  });

  describe("no matches", () => {
    it("should return message when no files match", async () => {
      await tempDir.createFile("file.txt", "content");

      const result = await globTool.execute({ pattern: "*.xyz" }, ctx);
      expect(result.output).toContain("No files found");
      expect(result.metadata).toMatchObject({ count: 0 });
    });

    it("should return message for empty directory", async () => {
      const result = await globTool.execute({ pattern: "*" }, ctx);
      expect(result.output).toContain("No files found");
      expect(result.metadata).toMatchObject({ count: 0 });
    });
  });

  describe("output formatting", () => {
    it("should sort matches alphabetically", async () => {
      await tempDir.createFile("c.txt", "c");
      await tempDir.createFile("a.txt", "a");
      await tempDir.createFile("b.txt", "b");

      const result = await globTool.execute({ pattern: "*.txt" }, ctx);
      const lines = result.output.split("\n");
      expect(lines[0]).toBe("a.txt");
      expect(lines[1]).toBe("b.txt");
      expect(lines[2]).toBe("c.txt");
    });
  });

  describe("dot files", () => {
    it("should include dot files", async () => {
      await tempDir.createFile(".hidden", "hidden");
      await tempDir.createFile(".env", "env");
      await tempDir.createFile("visible.txt", "visible");

      const result = await globTool.execute({ pattern: "*" }, ctx);
      expect(result.output).toContain(".hidden");
      expect(result.output).toContain(".env");
      expect(result.output).toContain("visible.txt");
    });
  });

  describe("complex patterns", () => {
    it("should support brace expansion", async () => {
      await tempDir.createFile("file.ts", "ts");
      await tempDir.createFile("file.js", "js");
      await tempDir.createFile("file.txt", "txt");

      const result = await globTool.execute({ pattern: "*.{ts,js}" }, ctx);
      expect(result.output).toContain("file.ts");
      expect(result.output).toContain("file.js");
      expect(result.output).not.toContain("file.txt");
      expect(result.metadata).toMatchObject({ count: 2 });
    });

    it("should support character classes", async () => {
      await tempDir.createFile("file1.txt", "1");
      await tempDir.createFile("file2.txt", "2");
      await tempDir.createFile("fileA.txt", "A");

      const result = await globTool.execute({ pattern: "file[0-9].txt" }, ctx);
      expect(result.output).toContain("file1.txt");
      expect(result.output).toContain("file2.txt");
      expect(result.output).not.toContain("fileA.txt");
      expect(result.metadata).toMatchObject({ count: 2 });
    });

    it("should support negation in character classes", async () => {
      await tempDir.createFile("file1.txt", "1");
      await tempDir.createFile("file2.txt", "2");
      await tempDir.createFile("fileA.txt", "A");

      const result = await globTool.execute({ pattern: "file[!0-9].txt" }, ctx);
      expect(result.output).not.toContain("file1.txt");
      expect(result.output).not.toContain("file2.txt");
      expect(result.output).toContain("fileA.txt");
      expect(result.metadata).toMatchObject({ count: 1 });
    });
  });
});
