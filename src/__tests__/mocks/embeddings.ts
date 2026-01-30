import { vi } from "vitest";

/**
 * Mock embedding vector (normalized random values)
 */
export function createMockEmbedding(dimensions = 384): number[] {
  const values = Array.from({ length: dimensions }, () => Math.random() - 0.5);
  const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return values.map(v => v / magnitude);
}

/**
 * Mock embedding function that returns consistent embeddings for same text
 */
export function createMockEmbedder() {
  const cache = new Map<string, number[]>();
  
  const embed = vi.fn((text: string): number[] => {
    if (!cache.has(text)) {
      // Use a seeded random based on text hash for consistency
      const hash = text.split("").reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
      }, 0);
      
      const values = Array.from({ length: 384 }, (_, i) => {
        const x = Math.sin(hash + i) * 10000;
        return x - Math.floor(x) - 0.5;
      });
      
      const magnitude = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
      cache.set(text, values.map(v => v / magnitude));
    }
    
    return cache.get(text)!;
  });

  return {
    embed,
    embedBatch: vi.fn((texts: string[]): number[][] => texts.map(t => embed(t))),
    cache,
    reset: () => {
      cache.clear();
      embed.mockClear();
    },
  };
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimensions");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
