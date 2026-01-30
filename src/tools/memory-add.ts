import { z } from "zod";
import { defineTool } from "./registry.js";
import { MemoryStorage } from "../memory/index.js";

const DESCRIPTION = `Add a memory to the project's knowledge base.

Memories persist across sessions and are shared by all developers working on this project.
They are stored in .openmgr/memories.db and can be tracked in git.

## When to Add Memories

- Project conventions and patterns (e.g., "We use React Query for data fetching")
- Architecture decisions and their rationale
- Important caveats or gotchas about specific code areas
- Team preferences and coding standards
- Integration details with external services
- Anything a new developer would need to know

## Scoping

Use the scope parameter to organize memories by area of the codebase:
- "/" (default) - Global, applies to entire project
- "/src/auth" - Applies to auth module and subdirectories
- "/api" - Applies to API layer

When working in a directory, memories from that scope and all parent scopes are automatically relevant.

## Tags

Use tags for cross-cutting concerns that span multiple scopes:
- ["security"] - Security-related memory
- ["performance", "database"] - Performance note about DB
- ["deprecated"] - Mark something as deprecated`;

export const memoryAddTool = defineTool({
  name: "memory_add",
  description: DESCRIPTION,
  parameters: z.object({
    content: z.string().describe("The memory content - what should be remembered"),
    scope: z.string().optional().describe("Path-based scope (e.g., '/', '/src/auth'). Defaults to '/'"),
    tags: z.array(z.string()).optional().describe("Optional tags for cross-cutting concerns"),
    author: z.string().optional().describe("Who is adding this memory (e.g., developer name)"),
  }),
  async execute(params, ctx) {
    const storage = new MemoryStorage(ctx.workingDirectory);
    
    const memory = await storage.create({
      content: params.content,
      scope: params.scope,
      tags: params.tags,
      author: params.author,
    });

    let output = `Memory added successfully.\n\nID: ${memory.id}\nScope: ${memory.scope}\nTags: ${memory.tags.length > 0 ? memory.tags.join(", ") : "(none)"}\n\nContent:\n${memory.content}`;

    if (!memory.hasEmbedding) {
      output += `\n\n⚠️  Warning: Semantic search unavailable. Embedding model not loaded.\nMemory was saved with keyword search only. Semantic search will work once the model downloads (first use).`;
    }

    return {
      output,
      metadata: {
        memoryId: memory.id,
        scope: memory.scope,
        tags: memory.tags,
        hasEmbedding: memory.hasEmbedding,
      },
    };
  },
});
