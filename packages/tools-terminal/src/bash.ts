import { spawn } from "child_process";
import { z } from "zod";
import { defineTool } from "@openmgr/agent-core";

const MAX_OUTPUT_SIZE = 50000;

export const bashTool = defineTool({
  name: "bash",
  description:
    "Execute a shell command. Use this for running scripts, installing packages, git operations, or any terminal command. Commands run in the working directory.",
  parameters: z.object({
    command: z.string().describe("The shell command to execute"),
    timeout: z
      .number()
      .optional()
      .default(30000)
      .describe("Timeout in milliseconds (default: 30000)"),
  }),
  async execute(params, ctx) {
    return new Promise((resolve) => {
      const { command, timeout = 30000 } = params;

      const proc = spawn("sh", ["-c", command], {
        cwd: ctx.workingDirectory,
        env: { ...process.env, TERM: "dumb" },
      });

      let stdout = "";
      let stderr = "";
      let killed = false;

      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill("SIGTERM");
      }, timeout);

      const abortHandler = () => {
        killed = true;
        proc.kill("SIGTERM");
      };
      ctx.abortSignal?.addEventListener("abort", abortHandler);

      proc.stdout.on("data", (data: Buffer) => {
        if (stdout.length < MAX_OUTPUT_SIZE) {
          stdout += data.toString();
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        if (stderr.length < MAX_OUTPUT_SIZE) {
          stderr += data.toString();
        }
      });

      proc.on("close", (code: number | null) => {
        clearTimeout(timeoutId);
        ctx.abortSignal?.removeEventListener("abort", abortHandler);

        const truncatedStdout =
          stdout.length >= MAX_OUTPUT_SIZE
            ? stdout.slice(0, MAX_OUTPUT_SIZE) + "\n... (output truncated)"
            : stdout;

        const truncatedStderr =
          stderr.length >= MAX_OUTPUT_SIZE
            ? stderr.slice(0, MAX_OUTPUT_SIZE) + "\n... (output truncated)"
            : stderr;

        let output = "";
        if (truncatedStdout) {
          output += truncatedStdout;
        }
        if (truncatedStderr) {
          output += (output ? "\n\nSTDERR:\n" : "STDERR:\n") + truncatedStderr;
        }

        if (killed) {
          output += "\n\n(Command was terminated)";
        }

        resolve({
          output: output || "(no output)",
          metadata: {
            exitCode: code,
            killed,
          },
        });
      });

      proc.on("error", (err: Error) => {
        clearTimeout(timeoutId);
        ctx.abortSignal?.removeEventListener("abort", abortHandler);
        resolve({
          output: `Error executing command: ${err.message}`,
          metadata: { error: true },
        });
      });
    });
  },
});
