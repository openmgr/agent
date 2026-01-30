# @openmgr/agent-memory

Semantic memory system for OpenMgr Agent that provides persistent, searchable project knowledge storage with hybrid keyword + vector search capabilities.

## Installation

```bash
pnpm add @openmgr/agent-memory
```

## Overview

The memory package enables agents to:
- Store and retrieve project knowledge
- Search using hybrid keyword + semantic matching
- Organize memories by scope (path-based hierarchy)
- Tag memories for easy categorization

## Usage

### With Agent

```typescript
import { Agent } from "@openmgr/agent-core";
import { memoryPlugin } from "@openmgr/agent-memory";

const agent = new Agent(config);
await agent.use(memoryPlugin());

// The agent now has access to memory tools:
// - memory_add
// - memory_search
// - memory_list
// - memory_delete
```

### Direct Storage Access

```typescript
import { MemoryStorage, getMemoryDb } from "@openmgr/agent-memory";

const db = getMemoryDb("/path/to/project");
const storage = new MemoryStorage(db);

// Add a memory
const memory = await storage.create({
  content: "The authentication module uses JWT tokens stored in httpOnly cookies.",
  scope: "/src/auth",
  tags: ["authentication", "security"],
  author: "developer",
});

// Search memories
const results = await storage.search({
  query: "how does authentication work",
  scope: "/src/auth",
  limit: 10,
});

// Results include score and match type
for (const result of results) {
  console.log(`[${result.matchType}] ${result.memory.content} (score: ${result.score})`);
}
```

## Memory Tools

### memory_add

Add a memory to the knowledge base.

```typescript
// Parameters
{
  content: string;      // Required: The knowledge to store
  scope?: string;       // Path-based scope (e.g., "/src/auth")
  tags?: string[];      // Tags for categorization
  author?: string;      // Author of the memory
}
```

### memory_search

Hybrid keyword + semantic search.

```typescript
// Parameters
{
  query: string;        // Required: Search query
  scope?: string;       // Limit to scope and its parents
  tags?: string[];      // Filter by tags
  limit?: number;       // Max results (default: 10)
}

// Returns
{
  memory: MemoryItem;
  score: number;        // 0-1 relevance score
  matchType: "keyword" | "semantic" | "hybrid";
}[]
```

### memory_list

Browse memories by scope and tags.

```typescript
// Parameters
{
  scope?: string;       // Filter by scope
  tags?: string[];      // Filter by tags
  limit?: number;       // Max results
  offset?: number;      // Pagination offset
}
```

### memory_delete

Delete a memory by ID.

```typescript
// Parameters
{
  id: string;           // Required: Memory ID
}
```

## How Search Works

The memory system uses a hybrid search approach:

1. **Keyword Search**: FTS5 full-text search with BM25 ranking
2. **Semantic Search**: Cosine similarity on embedding vectors
3. **Hybrid Merge**: When both methods find the same memory, scores are averaged

### Scope-Aware Retrieval

When searching with a scope like `/src/auth/login`, the system includes memories from all parent scopes:
- `/src/auth/login`
- `/src/auth`
- `/src`
- `/`

This allows project-wide knowledge to be accessible from any context.

## Embeddings

The memory system uses local embeddings for semantic search:

| Property | Value |
|----------|-------|
| **Model** | `Xenova/all-MiniLM-L6-v2` |
| **Library** | `@xenova/transformers` |
| **Dimensions** | 384 |
| **Quantized** | Yes |
| **Cache** | `~/.config/openmgr/models` |

### Embedding Functions

```typescript
import { 
  generateEmbedding, 
  generateEmbeddings,
  cosineSimilarity,
  isEmbeddingsAvailable 
} from "@openmgr/agent-memory";

// Generate single embedding
const embedding = await generateEmbedding("Some text to embed");

// Generate batch embeddings
const embeddings = await generateEmbeddings(["text1", "text2", "text3"]);

// Calculate similarity
const similarity = cosineSimilarity(embedding1, embedding2);

// Check if embeddings are ready
const ready = await isEmbeddingsAvailable();
```

## Storage

Memories are stored in SQLite with FTS5 for full-text search:

- **Location**: `.openmgr/memories.db` in project root
- **Schema**: id, content, scope, tags (JSON), author, embedding (BLOB), timestamps

### Database Functions

```typescript
import { 
  getMemoryDb, 
  closeMemoryDb, 
  closeAllMemoryDbs,
  memoryDbExists,
  getMemoryDbPath,
  createInMemoryDb 
} from "@openmgr/agent-memory";

// Get or create database
const db = getMemoryDb("/path/to/project");

// Check if database exists
const exists = memoryDbExists("/path/to/project");

// Close specific database
closeMemoryDb("/path/to/project");

// Close all databases (for cleanup)
closeAllMemoryDbs();

// Create in-memory database (for testing)
const testDb = createInMemoryDb();
```

## API Reference

### MemoryItem

```typescript
interface MemoryItem {
  id: string;
  content: string;
  scope: string;
  tags: string[];
  author?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### MemorySearchResult

```typescript
interface MemorySearchResult {
  memory: MemoryItem;
  score: number;        // 0-1 relevance score
  matchType: "keyword" | "semantic" | "hybrid";
}
```

### MemorySearchOptions

```typescript
interface MemorySearchOptions {
  query: string;
  scope?: string;
  tags?: string[];
  limit?: number;
  useSemanticSearch?: boolean;
}
```

### MemoryListOptions

```typescript
interface MemoryListOptions {
  scope?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt";
  order?: "asc" | "desc";
}
```

## Exports

```typescript
// Plugin
export { memoryPlugin } from "./plugin.js";

// Storage
export { MemoryStorage } from "./storage.js";

// Database
export { 
  getMemoryDb, 
  closeMemoryDb, 
  closeAllMemoryDbs,
  memoryDbExists,
  getMemoryDbPath,
  createInMemoryDb 
} from "./database.js";

// Embeddings
export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  embeddingToBuffer,
  bufferToEmbedding,
  isEmbeddingsAvailable,
  getModelPath,
  getEmbeddingDimensions,
} from "./embeddings.js";

// Tools
export {
  memoryAddTool,
  memorySearchTool,
  memoryListTool,
  memoryDeleteTool,
  memoryTools,
} from "./tools.js";

// Types
export type {
  MemoryItem,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryListOptions,
  MemoryCreateInput,
  MemoryUpdateInput,
  EmbeddingsStatus,
} from "./types.js";
```

## Best Practices

1. **Use Specific Scopes**: Organize memories by project structure (`/src/api`, `/src/auth`)
2. **Tag Consistently**: Use consistent tags across memories for better filtering
3. **Include Context**: Store complete, self-contained knowledge rather than fragments
4. **Clean Up**: Delete outdated memories to keep search results relevant
