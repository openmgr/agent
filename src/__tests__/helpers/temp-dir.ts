import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

/**
 * Creates a temporary directory for testing and provides cleanup
 */
export interface TempDirContext {
  /** Absolute path to the temp directory */
  path: string;
  /** Create a file in the temp directory */
  createFile: (relativePath: string, content: string) => Promise<string>;
  /** Create a subdirectory in the temp directory */
  createDir: (relativePath: string) => Promise<string>;
  /** Clean up the temp directory */
  cleanup: () => Promise<void>;
}

/**
 * Create a temporary directory for testing
 */
export async function createTempDir(prefix = "test"): Promise<TempDirContext> {
  const path = join(tmpdir(), `openmgr-${prefix}-${randomUUID()}`);
  await mkdir(path, { recursive: true });

  const createFile = async (relativePath: string, content: string): Promise<string> => {
    const fullPath = join(path, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dir !== path) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(fullPath, content, "utf-8");
    return fullPath;
  };

  const createDir = async (relativePath: string): Promise<string> => {
    const fullPath = join(path, relativePath);
    await mkdir(fullPath, { recursive: true });
    return fullPath;
  };

  const cleanup = async (): Promise<void> => {
    await rm(path, { recursive: true, force: true });
  };

  return { path, createFile, createDir, cleanup };
}

/**
 * Helper for vitest beforeEach/afterEach pattern
 */
export function useTempDir(prefix = "test") {
  let ctx: TempDirContext;

  return {
    get path() {
      return ctx.path;
    },
    get createFile() {
      return ctx.createFile;
    },
    get createDir() {
      return ctx.createDir;
    },
    async setup() {
      ctx = await createTempDir(prefix);
      return ctx;
    },
    async teardown() {
      await ctx.cleanup();
    },
  };
}
