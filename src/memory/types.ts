export interface MemoryItem {
  id: string;
  content: string;
  scope: string; // path-based scope, e.g., "/", "/src/auth", "/api"
  tags: string[]; // optional tags for cross-cutting concerns
  author?: string; // who added this memory
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchOptions {
  query: string;
  scope?: string; // current working context path
  tags?: string[]; // filter by specific tags
  limit?: number;
  useSemanticSearch?: boolean; // default true if embeddings available
}

export interface MemorySearchResult {
  memory: MemoryItem;
  score: number; // relevance score (0-1)
  matchType: "keyword" | "semantic" | "hybrid";
}

export interface MemoryListOptions {
  scope?: string; // filter by scope (exact match or prefix)
  tags?: string[];
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt";
  order?: "asc" | "desc";
}

export interface MemoryCreateInput {
  content: string;
  scope?: string; // defaults to "/"
  tags?: string[];
  author?: string;
}

export interface MemoryUpdateInput {
  content?: string;
  scope?: string;
  tags?: string[];
}
