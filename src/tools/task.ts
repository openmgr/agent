import { z } from "zod";
import { defineTool } from "./registry.js";
import type { SessionManager } from "../session/index.js";
import type { AgentEvent } from "../types.js";

const DESCRIPTION = `Launch a subagent to handle a specific task autonomously.

Use this tool when:
- A task is complex and would benefit from focused attention
- You want to delegate work while continuing with other tasks
- The task is self-contained and doesn't need back-and-forth

The subagent will:
1. Work independently on the given task
2. Have access to the same tools as you
3. Return a summary of what it accomplished

Usage notes:
- Provide a clear, specific prompt for the subagent
- Set async: true to run in background (returns immediately with session ID)
- Set async: false (default) to wait for the result
- Subagent sessions are persisted and can be viewed later`;

const runningTasks = new Map<string, Promise<string>>();

export const taskTool = defineTool({
  name: "task",
  description: DESCRIPTION,
  parameters: z.object({
    description: z
      .string()
      .describe("A short (3-5 words) description of the task"),
    prompt: z
      .string()
      .describe("The detailed task for the subagent to perform"),
    async: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, run in background and return session ID immediately"),
  }),
  async execute(params, ctx) {
    const { description, prompt, async: runAsync } = params;
    const parentSessionId = ctx.sessionId;
    const sessionManager = ctx.getSessionManager?.() as SessionManager | undefined;
    const emitEvent = ctx.emitEvent;

    if (!sessionManager) {
      return {
        output: "Task tool requires SessionManager context. Cannot spawn subagent.",
        metadata: { error: true, description },
      };
    }

    if (!parentSessionId) {
      return {
        output: "Task tool requires parent session ID. Cannot spawn subagent.",
        metadata: { error: true, description },
      };
    }

    try {
      const subSession = await sessionManager.create({
        workingDirectory: ctx.workingDirectory,
        title: `Subagent: ${description}`,
        parentId: parentSessionId,
      });

      emitEvent?.({
        type: "subagent.start",
        sessionId: subSession.id,
        parentSessionId,
        description,
        async: runAsync,
      } as AgentEvent);

      const runTask = async (): Promise<string> => {
        try {
          const response = await sessionManager.prompt(subSession.id, prompt);
          const output = response.content || "Task completed with no output.";

          emitEvent?.({
            type: "subagent.complete",
            sessionId: subSession.id,
            parentSessionId,
            result: output,
          } as AgentEvent);

          return output;
        } catch (err) {
          const errorMsg = (err as Error).message;
          emitEvent?.({
            type: "subagent.error",
            sessionId: subSession.id,
            parentSessionId,
            error: errorMsg,
          } as AgentEvent);
          throw err;
        }
      };

      if (runAsync) {
        const taskPromise = runTask();
        runningTasks.set(subSession.id, taskPromise);

        taskPromise.finally(() => {
          runningTasks.delete(subSession.id);
        });

        return {
          output: [
            `Subagent started in background.`,
            "",
            "<task_metadata>",
            `session_id: ${subSession.id}`,
            `parent_session_id: ${parentSessionId}`,
            `description: ${description}`,
            `async: true`,
            "</task_metadata>",
          ].join("\n"),
          metadata: {
            sessionId: subSession.id,
            parentSessionId,
            description,
            async: true,
          },
        };
      }

      const output = await runTask();

      return {
        output: [
          output,
          "",
          "<task_metadata>",
          `session_id: ${subSession.id}`,
          `parent_session_id: ${parentSessionId}`,
          `description: ${description}`,
          "</task_metadata>",
        ].join("\n"),
        metadata: {
          sessionId: subSession.id,
          parentSessionId,
          description,
          messageCount: sessionManager.getMessages(subSession.id).length,
        },
      };
    } catch (err) {
      return {
        output: `Task failed: ${(err as Error).message}`,
        metadata: { error: true, description },
      };
    }
  },
});

export function getRunningTask(sessionId: string): Promise<string> | undefined {
  return runningTasks.get(sessionId);
}

export function getRunningTaskIds(): string[] {
  return Array.from(runningTasks.keys());
}
