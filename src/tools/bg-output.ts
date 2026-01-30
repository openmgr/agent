import { z } from "zod";
import { execSync } from "child_process";
import { defineTool } from "./registry.js";

const DESCRIPTION = `Get the output from a background task.

Captures the current content of the task's terminal. Useful for checking progress or seeing results.`;

export const bgOutputTool = defineTool({
  name: "bg_output",
  description: DESCRIPTION,
  parameters: z.object({
    taskId: z.string().describe("The task ID to get output from"),
    lines: z.number().optional().describe("Number of lines to capture (default: 100, max: 1000)"),
  }),
  async execute(params, ctx) {
    if (!ctx.getBackgroundTasks) {
      return {
        output: "Background task functionality not available in this context.",
        metadata: { error: true },
      };
    }

    const tasks = ctx.getBackgroundTasks();
    const task = tasks.find(t => t.id === params.taskId);

    if (!task) {
      return {
        output: `No task found with ID: ${params.taskId}`,
        metadata: { error: true, found: false },
      };
    }

    const lines = Math.min(params.lines ?? 100, 1000);

    try {
      const output = execSync(
        `tmux capture-pane -t ${task.tmuxSession} -p -S -${lines}`,
        { encoding: "utf-8", maxBuffer: 1024 * 1024 }
      ).trim();

      if (!output) {
        return {
          output: `Task ${task.id} has no output yet.`,
          metadata: { taskId: task.id, hasOutput: false },
        };
      }

      return {
        output: `Output from task ${task.id} (${task.command}):\n\n${output}`,
        metadata: {
          taskId: task.id,
          hasOutput: true,
          lineCount: output.split("\n").length,
        },
      };
    } catch (err) {
      if (task.status !== "running") {
        return {
          output: `Task ${task.id} has finished (${task.status}, exit ${task.exitCode}). Output is no longer available.`,
          metadata: { taskId: task.id, status: task.status, exitCode: task.exitCode },
        };
      }

      return {
        output: `Failed to capture output: ${(err as Error).message}`,
        metadata: { error: true },
      };
    }
  },
});
