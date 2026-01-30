import { readFile, writeFile } from "fs/promises";
import { resolve, relative } from "path";
import { z } from "zod";
import { defineTool } from "./registry.js";

export const editTool = defineTool({
  name: "edit",
  description:
    "Edit a file by replacing a specific string with another. The oldString must match exactly (including whitespace). Use this for precise edits rather than rewriting entire files.",
  parameters: z.object({
    path: z.string().describe("Path to the file (relative to working directory)"),
    oldString: z.string().describe("The exact string to find and replace"),
    newString: z.string().describe("The string to replace it with"),
    replaceAll: z
      .boolean()
      .optional()
      .default(false)
      .describe("Replace all occurrences (default: false, replaces first only)"),
  }),
  async execute(params, ctx) {
    const { path, oldString, newString, replaceAll = false } = params;
    const fullPath = resolve(ctx.workingDirectory, path);
    const relativePath = relative(ctx.workingDirectory, fullPath);

    if (!fullPath.startsWith(ctx.workingDirectory)) {
      return {
        output: `Error: Path "${path}" is outside the working directory`,
        metadata: { error: true },
      };
    }

    if (oldString === newString) {
      return {
        output: "Error: oldString and newString are identical",
        metadata: { error: true },
      };
    }

    try {
      const content = await readFile(fullPath, "utf-8");

      if (!content.includes(oldString)) {
        return {
          output: `Error: oldString not found in ${relativePath}`,
          metadata: { error: true },
        };
      }

      const occurrences = content.split(oldString).length - 1;

      if (!replaceAll && occurrences > 1) {
        return {
          output: `Error: oldString found ${occurrences} times in ${relativePath}. Use replaceAll=true to replace all occurrences, or provide more context to make the match unique.`,
          metadata: { error: true, occurrences },
        };
      }

      const newContent = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      await writeFile(fullPath, newContent, "utf-8");

      const replacements = replaceAll ? occurrences : 1;

      return {
        output: `Successfully replaced ${replacements} occurrence${replacements > 1 ? "s" : ""} in ${relativePath}`,
        metadata: {
          path: relativePath,
          replacements,
        },
      };
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return {
          output: `Error: File not found: ${relativePath}`,
          metadata: { error: true },
        };
      }
      return {
        output: `Error editing file: ${error.message}`,
        metadata: { error: true },
      };
    }
  },
});
