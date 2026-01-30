import { z } from "zod";
import { defineTool } from "./registry.js";

const DESCRIPTION = `Check the status of background tasks.

Call without arguments to see all tasks, or with a task ID to check a specific one.`;

export const bgStatusTool = defineTool({
  name: "bg_status",
  description: DESCRIPTION,
  parameters: z.object({
    taskId: z.string().optional().describe("Specific task ID to check (omit to see all tasks)"),
  }),
  async execute(params, ctx) {
    if (!ctx.getBackgroundTasks) {
      return {
        output: "Background task functionality not available in this context.",
        metadata: { error: true },
      };
    }

    const tasks = ctx.getBackgroundTasks();

    if (params.taskId) {
      const task = tasks.find(t => t.id === params.taskId);
      if (!task) {
        return {
          output: `No task found with ID: ${params.taskId}`,
          metadata: { error: true, found: false },
        };
      }

      const elapsed = Math.round((Date.now() - task.startedAt) / 1000);
      const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.round(elapsed / 60)}m ${elapsed % 60}s`;

      let output = `Task: ${task.id}\nCommand: ${task.command}\nDescription: ${task.description}\nStatus: ${task.status}\nElapsed: ${elapsedStr}`;

      if (task.status === "completed" || task.status === "failed") {
        output += `\nExit code: ${task.exitCode}`;
      }

      if (task.checkBackAt && task.status === "running") {
        const checkTime = new Date(task.checkBackAt).toLocaleTimeString();
        output += `\nCheck back at: ${checkTime}`;
      }

      if (task.onComplete) {
        output += `\nOn complete: ${task.onComplete}`;
      }

      return {
        output,
        metadata: { task },
      };
    }

    if (tasks.length === 0) {
      return {
        output: "No background tasks.",
        metadata: { tasks: [], count: 0 },
      };
    }

    const formatted = tasks.map(t => {
      const elapsed = Math.round((Date.now() - t.startedAt) / 1000);
      const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.round(elapsed / 60)}m`;
      const exitStr = t.status !== "running" ? ` (exit ${t.exitCode})` : "";
      return `- ${t.id}: "${t.command}" [${t.status}${exitStr}] ${elapsedStr}\n  ${t.description}`;
    }).join("\n\n");

    const running = tasks.filter(t => t.status === "running").length;
    const completed = tasks.filter(t => t.status === "completed").length;
    const failed = tasks.filter(t => t.status === "failed").length;

    return {
      output: `Background tasks (${running} running, ${completed} completed, ${failed} failed):\n\n${formatted}`,
      metadata: {
        tasks,
        count: tasks.length,
        running,
        completed,
        failed,
      },
    };
  },
});
