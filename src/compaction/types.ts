export interface CompactionConfig {
  enabled: boolean;
  tokenThreshold: number;
  messageThreshold?: number;
  inceptionCount: number;
  workingWindowCount: number;
  summaryMaxTokens: number;
  model?: string;
  autoCompact: boolean;
  allowSummaryEdit: boolean;
}

export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  enabled: true,
  tokenThreshold: 0.8,
  inceptionCount: 4,
  workingWindowCount: 10,
  summaryMaxTokens: 2000,
  autoCompact: true,
  allowSummaryEdit: true,
};

export interface CompactionStats {
  currentTokens: number;
  threshold: number;
  messagesToCompact: number;
}

export interface CompactionResult {
  compactionId: string;
  summary: string;
  originalTokens: number;
  compactedTokens: number;
  messagesPruned: number;
  compressionRatio: number;
}

export const MODEL_LIMITS: Record<string, number> = {
  "claude-sonnet-4-20250514": 200000,
  "claude-3-5-sonnet-20241022": 200000,
  "claude-3-opus-20240229": 200000,
  "gpt-4o": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-3.5-turbo": 16385,
};

export function getModelLimit(model: string): number {
  return MODEL_LIMITS[model] ?? 100000;
}
