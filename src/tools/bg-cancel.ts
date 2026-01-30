import { z } from "zod";
import { execSync } from "child_process";
import { defineTool } from "./registry.js";

const DESCRIPTION = `Cancel a running background task.

Kills the tmux session and marks the task as cancelled.`;

export const bgCancelTool = defineTool({
  name: "bg_cancel",
  description: DESCRIPTION,
  parameters: z.object({
    taskId: z.string().describe("The task ID to cancel"),
  }),
  async execute(params, ctx) {
    if (!ctx.getBackgroundTasks || !ctx.updateBackgroundTask) {
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

    if (task.status !== "running") {
      return {
        output: `Task ${task.id} is not running (status: ${task.status})`,
        metadata: { error: true, status: task.status },
      };
    }

    try {
      execSync(`tmux kill-session -t ${task.tmuxSession} 2>/dev/null || true`, {
        encoding: "utf-8",
      });
    } catch {
      void 0;
    }

    ctx.updateBackgroundTask(task.id, {
      status: "cancelled",
      completedAt: Date.now(),
    });

    ctx.emitEvent?.({
      type: "background_task.cancelled",
      taskId: task.id,
      command: task.command,
    });

    return {
      output: `Task ${task.id} cancelled.\n\nCommand: ${task.command}\nDescription: ${task.description}`,
      metadata: {
        taskId: task.id,
        cancelled: true,
      },
    };
  },
});
