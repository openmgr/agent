import { z } from "zod";
import { defineTool } from "./registry.js";
import { MemoryStorage } from "../memory/index.js";

const DESCRIPTION = `Delete a memory from the project's knowledge base.

Use this when a memory is:
- Outdated or no longer accurate
- Superseded by newer information
- Added by mistake

You need the memory ID, which you can get from memory_search or memory_list.`;

export const memoryDeleteTool = defineTool({
  name: "memory_delete",
  description: DESCRIPTION,
  parameters: z.object({
    id: z.string().describe("The ID of the memory to delete"),
  }),
  async execute(params, ctx) {
    const storage = new MemoryStorage(ctx.workingDirectory);
    
    const memory = await storage.get(params.id);
    if (!memory) {
      return {
        output: `Memory not found with ID: ${params.id}`,
        metadata: { error: true, found: false },
      };
    }

    const deleted = await storage.delete(params.id);
    
    if (!deleted) {
      return {
        output: `Failed to delete memory: ${params.id}`,
        metadata: { error: true, deleted: false },
      };
    }

    return {
      output: `Memory deleted successfully.\n\nDeleted memory:\nScope: ${memory.scope}\nTags: ${memory.tags.length > 0 ? memory.tags.join(", ") : "(none)"}\nContent: ${memory.content}`,
      metadata: {
        deleted: true,
        memoryId: params.id,
        scope: memory.scope,
      },
    };
  },
});
