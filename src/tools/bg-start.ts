import { z } from "zod";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import { defineTool } from "./registry.js";
import type { BackgroundTask } from "../types.js";

const DESCRIPTION = `Start a long-running command in the background.

Use this for commands that take a while (builds, tests, deployments, etc.) when you want to continue working on other things.

The command runs in a tmux session. You'll be notified when it completes, and you can check on it anytime with bg_status or bg_output.

## Options

- **checkBackIn**: Get a reminder after N seconds to check on the task
- **onComplete**: Instructions for what to do when the task finishes (will be included in the completion notification)

## Examples

Start a build and check back in 2 minutes:
  bg_start({ command: "npm run build", description: "Building the project", checkBackIn: 120 })

Start tests with follow-up instructions:
  bg_start({ 
    command: "npm test", 
    description: "Running test suite",
    onComplete: "Review any failures and fix them"
  })`;

export const bgStartTool = defineTool({
  name: "bg_start",
  description: DESCRIPTION,
  parameters: z.object({
    command: z.string().describe("The command to run"),
    description: z.string().describe("What this task does (for your reference later)"),
    checkBackIn: z.number().optional().describe("Seconds until you want a reminder to check on this task"),
    onComplete: z.string().optional().describe("Instructions for what to do when the task completes"),
    workdir: z.string().optional().describe("Working directory for the command (defaults to current)"),
  }),
  async execute(params, ctx) {
    if (!ctx.addBackgroundTask) {
      return {
        output: "Background task functionality not available in this context.",
        metadata: { error: true },
      };
    }

    const taskId = randomUUID().slice(0, 8);
    const tmuxSession = `openmgr-bg-${taskId}`;
    const workdir = params.workdir ?? ctx.workingDirectory;
    const exitCodeFile = `/tmp/openmgr-bg-${taskId}-exit`;

    const wrappedCommand = `cd ${JSON.stringify(workdir)} && ${params.command}; echo $? > ${exitCodeFile}`;

    try {
      execSync(`tmux new-session -d -s ${tmuxSession} bash -c ${JSON.stringify(wrappedCommand)}`, {
        encoding: "utf-8",
      });
    } catch (err) {
      return {
        output: `Failed to start background task: ${(err as Error).message}`,
        metadata: { error: true },
      };
    }

    const task: BackgroundTask = {
      id: taskId,
      command: params.command,
      description: params.description,
      status: "running",
      tmuxSession,
      workingDirectory: workdir,
      startedAt: Date.now(),
      checkBackAt: params.checkBackIn ? Date.now() + params.checkBackIn * 1000 : undefined,
      onComplete: params.onComplete,
    };

    ctx.addBackgroundTask(task);

    ctx.emitEvent?.({
      type: "background_task.start",
      taskId: task.id,
      command: task.command,
      description: task.description,
    });

    let output = `Background task started.\n\nTask ID: ${taskId}\nCommand: ${params.command}\nDescription: ${params.description}`;

    if (params.checkBackIn) {
      const checkTime = new Date(Date.now() + params.checkBackIn * 1000).toLocaleTimeString();
      output += `\nCheck back at: ${checkTime}`;
    }

    if (params.onComplete) {
      output += `\nOn complete: ${params.onComplete}`;
    }

    output += `\n\nUse bg_status("${taskId}") to check progress, bg_output("${taskId}") to see output.`;

    return {
      output,
      metadata: {
        taskId,
        tmuxSession,
        status: "running",
      },
    };
  },
});
