import { Hono } from "hono";
import { readdir, stat, readFile } from "fs/promises";
import { join, resolve, relative, extname } from "path";

export interface FileRoutesOptions {
  workingDirectory?: string;
}

/**
 * Create file-related routes
 */
export function createFileRoutes(options: FileRoutesOptions = {}) {
  const app = new Hono();
  const workingDir = options.workingDirectory || process.cwd();

  app.get("/", async (c) => {
    const path = c.req.query("path") || ".";

    try {
      const targetPath = resolve(workingDir, path);
      const entries = await readdir(targetPath, { withFileTypes: true });
      
      const files = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = join(targetPath, entry.name);
          const relativePath = relative(workingDir, entryPath);
          const isIgnored = entry.name.startsWith(".") || 
                           entry.name === "node_modules" ||
                           entry.name === "dist" ||
                           entry.name === "build";
          
          try {
            const stats = await stat(entryPath);
            return {
              name: entry.name,
              path: relativePath,
              isDirectory: entry.isDirectory(),
              isIgnored,
              size: stats.size,
              modifiedAt: stats.mtime.getTime(),
            };
          } catch {
            return {
              name: entry.name,
              path: relativePath,
              isDirectory: entry.isDirectory(),
              isIgnored,
              size: 0,
              modifiedAt: 0,
            };
          }
        })
      );

      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return c.json({ files, path: relative(workingDir, targetPath) || "." });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get("/content", async (c) => {
    const path = c.req.query("path");
    if (!path) {
      return c.json({ error: "Path is required" }, 400);
    }

    try {
      const targetPath = resolve(workingDir, path);
      const content = await readFile(targetPath, "utf-8");
      const ext = extname(path).slice(1);
      
      return c.json({ 
        content, 
        path: relative(workingDir, targetPath),
        extension: ext,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  return app;
}
