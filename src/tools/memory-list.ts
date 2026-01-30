import { z } from "zod";
import { defineTool } from "./registry.js";
import { MemoryStorage } from "../memory/index.js";

const DESCRIPTION = `List and browse memories in the project's knowledge base.

Use this to:
- Browse all memories in a specific scope
- Filter by tags
- See what knowledge exists about a code area

For searching by content, use memory_search instead.`;

export const memoryListTool = defineTool({
  name: "memory_list",
  description: DESCRIPTION,
  parameters: z.object({
    scope: z.string().optional().describe("Filter by scope path (includes subscopes)"),
    tags: z.array(z.string()).optional().describe("Filter by tags (OR logic)"),
    limit: z.number().optional().describe("Maximum results (default: 50)"),
    offset: z.number().optional().describe("Pagination offset (default: 0)"),
  }),
  async execute(params, ctx) {
    const storage = new MemoryStorage(ctx.workingDirectory);
    
    const memories = await storage.list({
      scope: params.scope,
      tags: params.tags,
      limit: params.limit,
      offset: params.offset,
    });

    const total = await storage.count();

    if (memories.length === 0) {
      const filterDesc = params.scope || params.tags?.length 
        ? " matching filters" 
        : "";
      return {
        output: `No memories found${filterDesc}. Total memories in project: ${total}`,
        metadata: { memories: [], count: 0, total },
      };
    }

    const formatted = memories.map((m, i) => {
      const tagStr = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
      const authorStr = m.author ? ` (by ${m.author})` : "";
      const dateStr = m.createdAt.toISOString().split("T")[0];
      return `${i + 1}. ${m.scope}${tagStr}${authorStr} - ${dateStr}\n   ${m.content}\n   ID: ${m.id}`;
    }).join("\n\n");

    const showing = params.offset 
      ? `${params.offset + 1}-${params.offset + memories.length}` 
      : `1-${memories.length}`;

    return {
      output: `Showing ${showing} of ${total} memories:\n\n${formatted}`,
      metadata: {
        memories: memories.map(m => ({
          id: m.id,
          scope: m.scope,
          tags: m.tags,
          author: m.author,
          createdAt: m.createdAt.toISOString(),
        })),
        count: memories.length,
        total,
      },
    };
  },
});
