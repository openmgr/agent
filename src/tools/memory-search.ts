import { z } from "zod";
import { defineTool } from "./registry.js";
import { MemoryStorage } from "../memory/index.js";

const DESCRIPTION = `Search the project's memory/knowledge base.

Uses hybrid search combining:
1. **Keyword search** (FTS5) - Fast exact and prefix matching
2. **Semantic search** (embeddings) - Finds conceptually similar content

## Scope-Aware Search

When you provide a scope (current working path), the search automatically includes:
- Memories at that exact scope
- Memories at all parent scopes (up to "/")
- Global memories

Example: Searching with scope="/src/auth/login" includes memories from:
- /src/auth/login
- /src/auth  
- /src
- / (global)

## When to Search

- Before making changes to unfamiliar code areas
- When you need context about architectural decisions
- To find project conventions and patterns
- To understand why something was implemented a certain way`;

export const memorySearchTool = defineTool({
  name: "memory_search",
  description: DESCRIPTION,
  parameters: z.object({
    query: z.string().describe("What to search for - can be keywords or natural language"),
    scope: z.string().optional().describe("Current working path for scope-aware results"),
    tags: z.array(z.string()).optional().describe("Filter by specific tags"),
    limit: z.number().optional().describe("Maximum results to return (default: 10)"),
  }),
  async execute(params, ctx) {
    const storage = new MemoryStorage(ctx.workingDirectory);
    
    const status = await storage.checkEmbeddingsStatus();
    
    const results = await storage.search({
      query: params.query,
      scope: params.scope,
      tags: params.tags,
      limit: params.limit,
    });

    const hasSemanticResults = results.some(r => r.matchType === "semantic" || r.matchType === "hybrid");

    if (results.length === 0) {
      let output = "No memories found matching your query.";
      if (!status.available) {
        output += "\n\n⚠️  Note: Semantic search unavailable (embedding model not loaded). Only keyword matching was used.";
      }
      return {
        output,
        metadata: { results: [], count: 0, semanticSearchAvailable: status.available },
      };
    }

    const formatted = results.map((r, i) => {
      const tagStr = r.memory.tags.length > 0 ? ` [${r.memory.tags.join(", ")}]` : "";
      const scorePercent = Math.round(r.score * 100);
      return `${i + 1}. [${r.matchType}:${scorePercent}%] ${r.memory.scope}${tagStr}\n   ${r.memory.content}\n   ID: ${r.memory.id}`;
    }).join("\n\n");

    let output = `Found ${results.length} memory/memories:\n\n${formatted}`;

    if (!status.available) {
      output += "\n\n⚠️  Note: Semantic search unavailable (embedding model not loaded). Results are keyword-only.";
    } else if (!hasSemanticResults && status.memoriesWithEmbeddings === 0) {
      output += "\n\nNote: No memories have embeddings yet. Add new memories to enable semantic search.";
    }

    return {
      output,
      metadata: {
        results: results.map(r => ({
          id: r.memory.id,
          scope: r.memory.scope,
          tags: r.memory.tags,
          score: r.score,
          matchType: r.matchType,
        })),
        count: results.length,
        semanticSearchAvailable: status.available,
        memoriesWithEmbeddings: status.memoriesWithEmbeddings,
      },
    };
  },
});
