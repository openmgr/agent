import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ModelInfo } from "./models.js";

const CACHE_DIR = join(homedir(), ".config", "openmgr", "cache");
const MODELS_CACHE_FILE = join(CACHE_DIR, "models.json");

interface AnthropicModelResponse {
  id: string;
  display_name: string;
  created_at: string;
  type: "model";
}

interface AnthropicModelsListResponse {
  data: AnthropicModelResponse[];
  has_more: boolean;
  first_id: string;
  last_id: string;
}

interface CachedModels {
  fetchedAt: string;
  providers: Record<string, ModelInfo[]>;
}

interface FetchOptions {
  apiKey?: string;
  useOAuth?: boolean;
}

async function makeAnthropicRequest(url: string, options: FetchOptions): Promise<Response> {
  const headers: Record<string, string> = {
    "anthropic-version": "2023-06-01",
  };

  if (options.useOAuth) {
    const { getValidAccessToken } = await import("../auth/anthropic/index.js");
    const accessToken = await getValidAccessToken();
    headers["authorization"] = `Bearer ${accessToken}`;
    headers["anthropic-beta"] = "oauth-2025-04-20";
  } else if (options.apiKey) {
    headers["x-api-key"] = options.apiKey;
  } else {
    throw new Error("Either apiKey or useOAuth must be provided");
  }

  return fetch(url, { headers });
}

export async function fetchAnthropicModels(options: FetchOptions): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  let afterId: string | undefined;

  while (true) {
    const url = new URL("https://api.anthropic.com/v1/models");
    url.searchParams.set("limit", "100");
    if (afterId) {
      url.searchParams.set("after_id", afterId);
    }

    const response = await makeAnthropicRequest(url.toString(), options);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch Anthropic models: ${response.status} ${text}`);
    }

    const data = (await response.json()) as AnthropicModelsListResponse;

    for (const model of data.data) {
      models.push({
        id: model.id,
        name: model.display_name,
        contextWindow: 200000,
        maxOutput: 64000,
      });
    }

    if (!data.has_more) {
      break;
    }
    afterId = data.last_id;
  }

  return models;
}

export async function loadCachedModels(): Promise<CachedModels | null> {
  try {
    if (!existsSync(MODELS_CACHE_FILE)) {
      return null;
    }
    const content = await readFile(MODELS_CACHE_FILE, "utf-8");
    return JSON.parse(content) as CachedModels;
  } catch {
    return null;
  }
}

export async function saveCachedModels(providers: Record<string, ModelInfo[]>): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cache: CachedModels = {
    fetchedAt: new Date().toISOString(),
    providers,
  };
  await writeFile(MODELS_CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

export async function getCachedProviderModels(providerId: string): Promise<ModelInfo[] | null> {
  const cache = await loadCachedModels();
  return cache?.providers[providerId] ?? null;
}

export function getCacheFilePath(): string {
  return MODELS_CACHE_FILE;
}

export async function getCacheAge(): Promise<number | null> {
  const cache = await loadCachedModels();
  if (!cache) return null;
  const fetchedAt = new Date(cache.fetchedAt);
  return Date.now() - fetchedAt.getTime();
}
