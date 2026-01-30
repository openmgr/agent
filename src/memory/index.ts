export { MemoryStorage } from "./storage.js";
export { getMemoryDb, closeMemoryDb, closeAllMemoryDbs, memoryDbExists, getMemoryDbPath } from "./db.js";
export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  isEmbeddingsAvailable,
  getModelPath,
  getEmbeddingDimensions,
} from "./embeddings.js";
export type {
  MemoryItem,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryListOptions,
  MemoryCreateInput,
  MemoryUpdateInput,
} from "./types.js";
