import { describe, it, expect, beforeEach } from "vitest";
import { todoReadTool } from "../todo-read.js";
import { todoWriteTool } from "../todo-write.js";
import type { ToolContext, TodoItem } from "../../types.js";

describe("todo tools", () => {
  let todos: TodoItem[];
  let ctx: ToolContext;

  beforeEach(() => {
    todos = [];
    ctx = {
      workingDirectory: "/test",
      sessionId: "test-session",
      getTodos: () => todos,
      setTodos: (newTodos: TodoItem[]) => {
        todos = newTodos;
      },
    };
  });

  describe("todoread tool", () => {
    it("should return empty message when no todos", async () => {
      const result = await todoReadTool.execute({}, ctx);
      expect(result.output).toBe("No todos in the current list.");
      expect(result.metadata).toMatchObject({ todos: [], count: 0 });
    });

    it("should return todos as JSON", async () => {
      todos = [
        { id: "1", content: "Task 1", status: "pending", priority: "high" },
        { id: "2", content: "Task 2", status: "completed", priority: "medium" },
      ];

      const result = await todoReadTool.execute({}, ctx);
      const parsed = JSON.parse(result.output);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].content).toBe("Task 1");
      expect(result.metadata).toMatchObject({
        count: 2,
        pending: 1,
      });
    });

    it("should count pending correctly", async () => {
      todos = [
        { id: "1", content: "Task 1", status: "pending", priority: "high" },
        { id: "2", content: "Task 2", status: "in_progress", priority: "medium" },
        { id: "3", content: "Task 3", status: "completed", priority: "low" },
        { id: "4", content: "Task 4", status: "cancelled", priority: "low" },
      ];

      const result = await todoReadTool.execute({}, ctx);
      // pending count = not completed = pending + in_progress + cancelled
      expect(result.metadata).toMatchObject({
        count: 4,
        pending: 3, // pending, in_progress, and cancelled
      });
    });

    it("should return error when getTodos not available", async () => {
      const ctxWithoutTodos: ToolContext = {
        workingDirectory: "/test",
        sessionId: "test-session",
      };

      const result = await todoReadTool.execute({}, ctxWithoutTodos);
      expect(result.output).toContain("not available");
      expect(result.metadata).toEqual({ error: true });
    });
  });

  describe("todowrite tool", () => {
    it("should set todos", async () => {
      const newTodos: TodoItem[] = [
        { id: "1", content: "New task", status: "pending", priority: "high" },
      ];

      const result = await todoWriteTool.execute({ todos: newTodos }, ctx);
      expect(todos).toHaveLength(1);
      expect(todos[0].content).toBe("New task");
      expect(result.metadata).toMatchObject({
        count: 1,
        pending: 1,
        completed: 0,
        inProgress: 0,
      });
    });

    it("should overwrite existing todos", async () => {
      todos = [
        { id: "1", content: "Old task", status: "pending", priority: "high" },
      ];

      const newTodos: TodoItem[] = [
        { id: "2", content: "New task", status: "pending", priority: "medium" },
      ];

      await todoWriteTool.execute({ todos: newTodos }, ctx);
      expect(todos).toHaveLength(1);
      expect(todos[0].id).toBe("2");
      expect(todos[0].content).toBe("New task");
    });

    it("should return correct statistics", async () => {
      const newTodos: TodoItem[] = [
        { id: "1", content: "Task 1", status: "pending", priority: "high" },
        { id: "2", content: "Task 2", status: "in_progress", priority: "high" },
        { id: "3", content: "Task 3", status: "completed", priority: "medium" },
        { id: "4", content: "Task 4", status: "completed", priority: "low" },
        { id: "5", content: "Task 5", status: "cancelled", priority: "low" },
      ];

      const result = await todoWriteTool.execute({ todos: newTodos }, ctx);
      expect(result.metadata).toMatchObject({
        count: 5,
        pending: 3, // pending + in_progress + cancelled
        completed: 2,
        inProgress: 1,
      });
    });

    it("should return todos as JSON in output", async () => {
      const newTodos: TodoItem[] = [
        { id: "1", content: "Task 1", status: "pending", priority: "high" },
      ];

      const result = await todoWriteTool.execute({ todos: newTodos }, ctx);
      const parsed = JSON.parse(result.output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].content).toBe("Task 1");
    });

    it("should handle empty todos array", async () => {
      todos = [
        { id: "1", content: "Existing", status: "pending", priority: "high" },
      ];

      const result = await todoWriteTool.execute({ todos: [] }, ctx);
      expect(todos).toHaveLength(0);
      expect(result.metadata).toMatchObject({
        count: 0,
        pending: 0,
        completed: 0,
        inProgress: 0,
      });
    });

    it("should return error when setTodos not available", async () => {
      const ctxWithoutTodos: ToolContext = {
        workingDirectory: "/test",
        sessionId: "test-session",
      };

      const result = await todoWriteTool.execute(
        { todos: [{ id: "1", content: "Task", status: "pending", priority: "high" }] },
        ctxWithoutTodos
      );
      expect(result.output).toContain("not available");
      expect(result.metadata).toEqual({ error: true });
    });
  });

  describe("todo workflow", () => {
    it("should support complete todo workflow", async () => {
      // Start with empty todos
      let result = await todoReadTool.execute({}, ctx);
      expect(result.metadata).toMatchObject({ count: 0 });

      // Add initial todos
      await todoWriteTool.execute(
        {
          todos: [
            { id: "1", content: "Setup project", status: "pending", priority: "high" },
            { id: "2", content: "Write tests", status: "pending", priority: "high" },
            { id: "3", content: "Deploy", status: "pending", priority: "medium" },
          ],
        },
        ctx
      );

      result = await todoReadTool.execute({}, ctx);
      expect(result.metadata).toMatchObject({ count: 3, pending: 3 });

      // Mark first task in progress
      let writeResult = await todoWriteTool.execute(
        {
          todos: [
            { id: "1", content: "Setup project", status: "in_progress", priority: "high" },
            { id: "2", content: "Write tests", status: "pending", priority: "high" },
            { id: "3", content: "Deploy", status: "pending", priority: "medium" },
          ],
        },
        ctx
      );

      // todoWriteTool returns inProgress count
      expect(writeResult.metadata).toMatchObject({ inProgress: 1 });

      // Complete first task, start second
      writeResult = await todoWriteTool.execute(
        {
          todos: [
            { id: "1", content: "Setup project", status: "completed", priority: "high" },
            { id: "2", content: "Write tests", status: "in_progress", priority: "high" },
            { id: "3", content: "Deploy", status: "pending", priority: "medium" },
          ],
        },
        ctx
      );

      // todoWriteTool returns detailed stats
      expect(writeResult.metadata).toMatchObject({
        count: 3,
        completed: 1,
        inProgress: 1,
        pending: 2,
      });

      // Complete all tasks
      writeResult = await todoWriteTool.execute(
        {
          todos: [
            { id: "1", content: "Setup project", status: "completed", priority: "high" },
            { id: "2", content: "Write tests", status: "completed", priority: "high" },
            { id: "3", content: "Deploy", status: "completed", priority: "medium" },
          ],
        },
        ctx
      );

      // todoWriteTool returns detailed stats
      expect(writeResult.metadata).toMatchObject({
        count: 3,
        completed: 3,
        pending: 0,
        inProgress: 0,
      });

      // todoReadTool only returns count and pending
      result = await todoReadTool.execute({}, ctx);
      expect(result.metadata).toMatchObject({
        count: 3,
        pending: 0,
      });
    });
  });
});
