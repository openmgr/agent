import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bashTool } from "../bash.js";
import { useTempDir } from "../../__tests__/helpers/temp-dir.js";
import type { ToolContext } from "../../types.js";

describe("bash tool", () => {
  const tempDir = useTempDir("bash");
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

  describe("basic command execution", () => {
    it("should execute simple command", async () => {
      const result = await bashTool.execute({ command: "echo 'hello'" }, ctx);
      expect(result.output.trim()).toBe("hello");
      expect(result.metadata).toMatchObject({ exitCode: 0 });
    });

    it("should capture stdout", async () => {
      await tempDir.createFile("test.txt", "file content");
      const result = await bashTool.execute({ command: "cat test.txt" }, ctx);
      expect(result.output.trim()).toBe("file content");
    });

    it("should capture stderr", async () => {
      const result = await bashTool.execute(
        { command: "ls nonexistent-file-12345" },
        ctx
      );
      expect(result.output).toContain("STDERR:");
      expect(result.output).toContain("nonexistent");
    });

    it("should return exit code", async () => {
      const result = await bashTool.execute({ command: "exit 42" }, ctx);
      expect(result.metadata).toMatchObject({ exitCode: 42 });
    });

    it("should run in working directory", async () => {
      await tempDir.createFile("marker.txt", "");
      const result = await bashTool.execute({ command: "ls marker.txt" }, ctx);
      expect(result.output.trim()).toBe("marker.txt");
      expect(result.metadata).toMatchObject({ exitCode: 0 });
    });
  });

  describe("command with pipes and chaining", () => {
    it("should support pipes", async () => {
      await tempDir.createFile("data.txt", "apple\nbanana\napricot");
      const result = await bashTool.execute(
        { command: "cat data.txt | grep apple" },
        ctx
      );
      expect(result.output).toContain("apple");
      expect(result.output).not.toContain("banana");
    });

    it("should support command chaining with &&", async () => {
      const result = await bashTool.execute(
        { command: "echo 'first' && echo 'second'" },
        ctx
      );
      expect(result.output).toContain("first");
      expect(result.output).toContain("second");
    });

    it("should stop on failure with &&", async () => {
      const result = await bashTool.execute(
        { command: "false && echo 'should not appear'" },
        ctx
      );
      expect(result.output).not.toContain("should not appear");
      expect(result.metadata).toMatchObject({ exitCode: 1 });
    });

    it("should continue with || on failure", async () => {
      const result = await bashTool.execute(
        { command: "false || echo 'fallback'" },
        ctx
      );
      expect(result.output).toContain("fallback");
      expect(result.metadata).toMatchObject({ exitCode: 0 });
    });
  });

  describe("timeout handling", () => {
    it("should timeout long-running commands", async () => {
      const result = await bashTool.execute(
        { command: "sleep 10", timeout: 100 },
        ctx
      );
      expect(result.output).toContain("terminated");
      expect(result.metadata).toMatchObject({ killed: true });
    }, 5000);

    it("should complete before timeout", async () => {
      const result = await bashTool.execute(
        { command: "echo 'quick'", timeout: 5000 },
        ctx
      );
      expect(result.output.trim()).toBe("quick");
      expect(result.metadata).toMatchObject({ killed: false });
    });
  });

  describe("environment", () => {
    it("should have access to environment variables", async () => {
      const result = await bashTool.execute({ command: "echo $HOME" }, ctx);
      expect(result.output.trim()).toBeTruthy();
      expect(result.output.trim()).not.toBe("$HOME");
    });

    it("should have TERM set to dumb", async () => {
      const result = await bashTool.execute({ command: "echo $TERM" }, ctx);
      expect(result.output.trim()).toBe("dumb");
    });
  });

  describe("abort signal", () => {
    it("should be terminated when abort signal fires", async () => {
      const abortController = new AbortController();
      const ctxWithAbort: ToolContext = {
        ...ctx,
        abortSignal: abortController.signal,
      };

      const promise = bashTool.execute({ command: "sleep 10" }, ctxWithAbort);
      
      // Give the process time to start
      await new Promise((r) => setTimeout(r, 50));
      abortController.abort();

      const result = await promise;
      expect(result.output).toContain("terminated");
      expect(result.metadata).toMatchObject({ killed: true });
    }, 5000);
  });

  describe("output handling", () => {
    it("should return '(no output)' for commands with no output", async () => {
      const result = await bashTool.execute({ command: "true" }, ctx);
      expect(result.output).toBe("(no output)");
    });

    it("should combine stdout and stderr", async () => {
      const result = await bashTool.execute(
        { command: "echo 'stdout' && echo 'stderr' >&2" },
        ctx
      );
      expect(result.output).toContain("stdout");
      expect(result.output).toContain("stderr");
    });
  });

  describe("special characters", () => {
    it("should handle quotes", async () => {
      const result = await bashTool.execute(
        { command: `echo "double quotes" && echo 'single quotes'` },
        ctx
      );
      expect(result.output).toContain("double quotes");
      expect(result.output).toContain("single quotes");
    });

    it("should handle special shell characters", async () => {
      const result = await bashTool.execute(
        { command: `echo 'dollar: $HOME, backtick: \`echo test\`'` },
        ctx
      );
      expect(result.output).toContain("dollar:");
    });

    it("should handle newlines in output", async () => {
      const result = await bashTool.execute(
        { command: 'printf "line1\\nline2\\nline3"' },
        ctx
      );
      expect(result.output).toContain("line1");
      expect(result.output).toContain("line2");
      expect(result.output).toContain("line3");
    });
  });

  describe("file operations via bash", () => {
    it("should create files", async () => {
      const result = await bashTool.execute(
        { command: "touch newfile.txt && ls newfile.txt" },
        ctx
      );
      expect(result.output.trim()).toBe("newfile.txt");
      expect(result.metadata).toMatchObject({ exitCode: 0 });
    });

    it("should create directories", async () => {
      const result = await bashTool.execute(
        { command: "mkdir -p nested/dir && ls nested" },
        ctx
      );
      expect(result.output.trim()).toBe("dir");
    });

    it("should delete files", async () => {
      await tempDir.createFile("todelete.txt", "content");
      const result = await bashTool.execute(
        { command: "rm todelete.txt && ls todelete.txt 2>&1 || echo 'deleted'" },
        ctx
      );
      expect(result.output).toContain("deleted");
    });
  });

  describe("process errors", () => {
    it("should handle command not found", async () => {
      const result = await bashTool.execute(
        { command: "nonexistent-command-12345" },
        ctx
      );
      expect(result.output).toContain("not found");
      expect(result.metadata?.exitCode).not.toBe(0);
    });
  });
});
