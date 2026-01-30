import { randomUUID } from "crypto";
import { getMemoryDb } from "./db.js";
import {
  generateEmbedding,
  cosineSimilarity,
  embeddingToBuffer,
  bufferToEmbedding,
  isEmbeddingsAvailable,
} from "./embeddings.js";
import type {
  MemoryItem,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryListOptions,
  MemoryCreateInput,
  MemoryUpdateInput,
} from "./types.js";

interface MemoryRow {
  id: string;
  content: string;
  scope: string;
  tags: string;
  author: string | null;
  embedding: Buffer | null;
  created_at: number;
  updated_at: number;
}

function rowToMemory(row: MemoryRow): MemoryItem {
  return {
    id: row.id,
    content: row.content,
    scope: row.scope,
    tags: JSON.parse(row.tags) as string[],
    author: row.author ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class MemoryStorage {
  constructor(private projectRoot: string) {}

  async create(input: MemoryCreateInput): Promise<MemoryItem & { hasEmbedding: boolean }> {
    const db = getMemoryDb(this.projectRoot);
    const id = randomUUID();
    const now = Date.now();
    const scope = input.scope ?? "/";
    const tags = input.tags ?? [];
    
    let embedding: Buffer | null = null;
    let hasEmbedding = false;
    try {
      if (await isEmbeddingsAvailable()) {
        const embeddingArray = await generateEmbedding(input.content);
        embedding = embeddingToBuffer(embeddingArray);
        hasEmbedding = true;
      }
    } catch {
      embedding = null;
    }

    const stmt = db.prepare(`
      INSERT INTO memories (id, content, scope, tags, author, embedding, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.content,
      scope,
      JSON.stringify(tags),
      input.author ?? null,
      embedding,
      now,
      now
    );

    return {
      id,
      content: input.content,
      scope,
      tags,
      author: input.author,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      hasEmbedding,
    };
  }

  async get(id: string): Promise<MemoryItem | null> {
    const db = getMemoryDb(this.projectRoot);
    const stmt = db.prepare("SELECT * FROM memories WHERE id = ?");
    const row = stmt.get(id) as MemoryRow | undefined;
    
    if (!row) return null;
    return rowToMemory(row);
  }

  async update(id: string, input: MemoryUpdateInput): Promise<MemoryItem | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const db = getMemoryDb(this.projectRoot);
    const now = Date.now();
    
    const updates: string[] = ["updated_at = ?"];
    const values: (string | number | Buffer | null)[] = [now];

    if (input.content !== undefined) {
      updates.push("content = ?");
      values.push(input.content);
      
      try {
        if (await isEmbeddingsAvailable()) {
          const embeddingArray = await generateEmbedding(input.content);
          updates.push("embedding = ?");
          values.push(embeddingToBuffer(embeddingArray));
        }
      } catch {
        void 0;
      }
    }

    if (input.scope !== undefined) {
      updates.push("scope = ?");
      values.push(input.scope);
    }

    if (input.tags !== undefined) {
      updates.push("tags = ?");
      values.push(JSON.stringify(input.tags));
    }

    values.push(id);

    const stmt = db.prepare(`UPDATE memories SET ${updates.join(", ")} WHERE id = ?`);
    stmt.run(...values);

    return this.get(id);
  }

  async delete(id: string): Promise<boolean> {
    const db = getMemoryDb(this.projectRoot);
    const stmt = db.prepare("DELETE FROM memories WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  async list(options: MemoryListOptions = {}): Promise<MemoryItem[]> {
    const db = getMemoryDb(this.projectRoot);
    const {
      scope,
      tags,
      limit = 50,
      offset = 0,
      orderBy = "createdAt",
      order = "desc",
    } = options;

    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (scope) {
      conditions.push("(scope = ? OR scope LIKE ?)");
      values.push(scope, `${scope}/%`);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(" OR ")})`);
      for (const tag of tags) {
        values.push(`%"${tag}"%`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderColumn = orderBy === "createdAt" ? "created_at" : "updated_at";
    const orderDir = order === "asc" ? "ASC" : "DESC";

    const sql = `
      SELECT * FROM memories
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDir}
      LIMIT ? OFFSET ?
    `;

    values.push(limit, offset);

    const stmt = db.prepare(sql);
    const rows = stmt.all(...values) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  async search(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const { query, scope, tags, limit = 10, useSemanticSearch = true } = options;

    const keywordResults = await this.keywordSearch(query, scope, tags, limit * 2);
    
    let semanticResults: MemorySearchResult[] = [];
    if (useSemanticSearch) {
      try {
        if (await isEmbeddingsAvailable()) {
          semanticResults = await this.semanticSearch(query, scope, tags, limit * 2);
        }
      } catch {
        semanticResults = [];
      }
    }

    return this.mergeSearchResults(keywordResults, semanticResults, limit);
  }

  private async keywordSearch(
    query: string,
    scope?: string,
    tags?: string[],
    limit: number = 10
  ): Promise<MemorySearchResult[]> {
    const db = getMemoryDb(this.projectRoot);
    
    const ftsQuery = query
      .split(/\s+/)
      .filter(Boolean)
      .map(term => `"${term}"*`)
      .join(" OR ");

    if (!ftsQuery) return [];

    let sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories_fts
      JOIN memories m ON memories_fts.id = m.id
      WHERE memories_fts MATCH ?
    `;
    const values: (string | number)[] = [ftsQuery];

    if (scope) {
      sql += " AND (m.scope = ? OR m.scope LIKE ? OR ? LIKE m.scope || '%')";
      values.push(scope, `${scope}/%`, scope);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => "m.tags LIKE ?");
      sql += ` AND (${tagConditions.join(" OR ")})`;
      for (const tag of tags) {
        values.push(`%"${tag}"%`);
      }
    }

    sql += ` ORDER BY rank LIMIT ?`;
    values.push(limit);

    const stmt = db.prepare(sql);
    const rows = stmt.all(...values) as (MemoryRow & { rank: number })[];

    const maxRank = Math.max(...rows.map(r => Math.abs(r.rank)), 1);
    
    return rows.map(row => ({
      memory: rowToMemory(row),
      score: 1 - Math.abs(row.rank) / maxRank,
      matchType: "keyword" as const,
    }));
  }

  private async semanticSearch(
    query: string,
    scope?: string,
    tags?: string[],
    limit: number = 10
  ): Promise<MemorySearchResult[]> {
    const db = getMemoryDb(this.projectRoot);
    const queryEmbedding = await generateEmbedding(query);

    let sql = "SELECT * FROM memories WHERE embedding IS NOT NULL";
    const values: (string | number)[] = [];

    if (scope) {
      sql += " AND (scope = ? OR scope LIKE ? OR ? LIKE scope || '%')";
      values.push(scope, `${scope}/%`, scope);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => "tags LIKE ?");
      sql += ` AND (${tagConditions.join(" OR ")})`;
      for (const tag of tags) {
        values.push(`%"${tag}"%`);
      }
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...values) as MemoryRow[];

    const scored = rows.map(row => {
      const embedding = bufferToEmbedding(row.embedding!);
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        memory: rowToMemory(row),
        score: similarity,
        matchType: "semantic" as const,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  private mergeSearchResults(
    keywordResults: MemorySearchResult[],
    semanticResults: MemorySearchResult[],
    limit: number
  ): MemorySearchResult[] {
    const resultMap = new Map<string, MemorySearchResult>();

    for (const result of keywordResults) {
      resultMap.set(result.memory.id, result);
    }

    for (const result of semanticResults) {
      const existing = resultMap.get(result.memory.id);
      if (existing) {
        const combinedScore = (existing.score + result.score) / 2;
        resultMap.set(result.memory.id, {
          memory: result.memory,
          score: combinedScore,
          matchType: "hybrid",
        });
      } else {
        resultMap.set(result.memory.id, result);
      }
    }

    const merged = Array.from(resultMap.values());
    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, limit);
  }

  async getScopedMemories(currentPath: string): Promise<MemoryItem[]> {
    const db = getMemoryDb(this.projectRoot);
    
    const pathParts = currentPath.split("/").filter(Boolean);
    const scopes = ["/"];
    let buildPath = "";
    for (const part of pathParts) {
      buildPath += "/" + part;
      scopes.push(buildPath);
    }

    const placeholders = scopes.map(() => "?").join(", ");
    const sql = `SELECT * FROM memories WHERE scope IN (${placeholders}) ORDER BY scope ASC, created_at DESC`;
    
    const stmt = db.prepare(sql);
    const rows = stmt.all(...scopes) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  async count(): Promise<number> {
    const db = getMemoryDb(this.projectRoot);
    const stmt = db.prepare("SELECT COUNT(*) as count FROM memories");
    const result = stmt.get() as { count: number };
    return result.count;
  }

  async checkEmbeddingsStatus(): Promise<{ available: boolean; memoriesWithEmbeddings: number; totalMemories: number }> {
    const db = getMemoryDb(this.projectRoot);
    const available = await isEmbeddingsAvailable();
    
    const totalResult = db.prepare("SELECT COUNT(*) as count FROM memories").get() as { count: number };
    const embeddedResult = db.prepare("SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL").get() as { count: number };
    
    return {
      available,
      memoriesWithEmbeddings: embeddedResult.count,
      totalMemories: totalResult.count,
    };
  }
}
