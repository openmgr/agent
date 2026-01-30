import { writeFile, mkdir } from "fs/promises";
import { resolve, relative, dirname } from "path";
import { z } from "zod";
import { defineTool } from "@openmgr/agent-core";

export const writeTool = defineTool({
  name: "write",
  description:
    "Write content to a file. Creates the file if it doesn't exist, or overwrites it if it does. Parent directories are created automatically.",
  parameters: z.object({
    path: z.string().describe("Path to the file (relative to working directory)"),
    content: z.string().describe("Content to write to the file"),
  }),
  async execute(params, ctx) {
    const { path, content } = params;
    const fullPath = resolve(ctx.workingDirectory, path);
    const relativePath = relative(ctx.workingDirectory, fullPath);

    if (!fullPath.startsWith(ctx.workingDirectory)) {
      return {
        output: `Error: Path "${path}" is outside the working directory`,
        metadata: { error: true },
      };
    }

    try {
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, "utf-8");

      const lineCount = content.split("\n").length;
      const byteCount = Buffer.byteLength(content, "utf-8");

      return {
        output: `Successfully wrote ${lineCount} lines (${byteCount} bytes) to ${relativePath}`,
        metadata: {
          path: relativePath,
          lines: lineCount,
          bytes: byteCount,
        },
      };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      return {
        output: `Error writing file: ${error.message}`,
        metadata: { error: true },
      };
    }
  },
});
