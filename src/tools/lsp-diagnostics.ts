/**
 * LSP Diagnostics Tool
 * Provides code diagnostics (errors, warnings) from language servers
 */

import { z } from "zod";
import { resolve } from "path";
import { existsSync } from "fs";
import { glob } from "glob";
import { defineTool } from "./registry.js";
import type { ToolContext } from "../types.js";
import { LspManager, type FormattedDiagnostic, getLanguageId } from "../lsp/index.js";

// Singleton LSP manager per working directory
const managers = new Map<string, LspManager>();

function getManager(workingDirectory: string): LspManager {
  let manager = managers.get(workingDirectory);
  if (!manager) {
    manager = new LspManager({ workingDirectory });
    managers.set(workingDirectory, manager);
  }
  return manager;
}

export const lspDiagnosticsTool = defineTool({
  name: "mcp_lsp_diagnostics",
  description: `Get code diagnostics (errors, warnings, hints) from language servers.

This tool uses Language Server Protocol (LSP) to get real-time diagnostics from language servers like:
- TypeScript/JavaScript: typescript-language-server
- Go: gopls  
- Python: pyright-langserver
- Rust: rust-analyzer

The language server must be installed on the system for this to work.

Use this tool to:
- Check for type errors before running code
- Find syntax errors and linting issues
- Get detailed error messages with line/column info

Examples:
- Get errors for a specific file: { "files": ["src/index.ts"] }
- Check all TypeScript files: { "pattern": "**/*.ts" }
- Get only errors (no warnings): { "severity": "error" }`,

  parameters: z.object({
    files: z
      .array(z.string())
      .optional()
      .describe("Specific files to check for diagnostics"),
    pattern: z
      .string()
      .optional()
      .describe("Glob pattern to find files (e.g., '**/*.ts', 'src/**/*.go')"),
    severity: z
      .enum(["error", "warning", "all"])
      .optional()
      .default("all")
      .describe("Filter by severity level"),
  }),

  async execute(params, ctx: ToolContext) {
    const manager = getManager(ctx.workingDirectory);
    const allDiagnostics: FormattedDiagnostic[] = [];
    const processedFiles = new Set<string>();
    const errors: string[] = [];

    // Collect files to check
    let filesToCheck: string[] = [];

    if (params.files?.length) {
      filesToCheck = params.files.map((f) => resolve(ctx.workingDirectory, f));
    }

    if (params.pattern) {
      try {
        const matches = await glob(params.pattern, {
          cwd: ctx.workingDirectory,
          absolute: true,
          ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"],
        });
        filesToCheck.push(...matches);
      } catch (err) {
        errors.push(`Glob error: ${(err as Error).message}`);
      }
    }

    // If no files specified, try to find files based on common patterns
    if (filesToCheck.length === 0) {
      const defaultPatterns = [
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
        "**/*.go",
        "**/*.py",
        "**/*.rs",
      ];

      for (const pattern of defaultPatterns) {
        try {
          const matches = await glob(pattern, {
            cwd: ctx.workingDirectory,
            absolute: true,
            ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"],
          });
          // Only add first 10 files per pattern to avoid overwhelming
          filesToCheck.push(...matches.slice(0, 10));
        } catch {
          // Ignore glob errors for default patterns
        }
      }
    }

    // Remove duplicates
    filesToCheck = [...new Set(filesToCheck)];

    // Limit total files
    if (filesToCheck.length > 50) {
      filesToCheck = filesToCheck.slice(0, 50);
      errors.push(`Limited to first 50 files. Use a more specific pattern to check more files.`);
    }

    // Get diagnostics for each file
    for (const filePath of filesToCheck) {
      if (processedFiles.has(filePath)) continue;
      processedFiles.add(filePath);

      if (!existsSync(filePath)) {
        continue;
      }

      const languageId = getLanguageId(filePath);
      if (!languageId) {
        continue;
      }

      try {
        const diagnostics = await manager.getDiagnostics(filePath);
        allDiagnostics.push(...diagnostics);
      } catch (err) {
        errors.push(`Error checking ${filePath}: ${(err as Error).message}`);
      }
    }

    // Filter by severity
    let filteredDiagnostics = allDiagnostics;
    if (params.severity === "error") {
      filteredDiagnostics = allDiagnostics.filter((d) => d.severity === "error");
    } else if (params.severity === "warning") {
      filteredDiagnostics = allDiagnostics.filter(
        (d) => d.severity === "error" || d.severity === "warning"
      );
    }

    // Group by file
    const byFile = new Map<string, FormattedDiagnostic[]>();
    for (const diag of filteredDiagnostics) {
      const existing = byFile.get(diag.file) ?? [];
      existing.push(diag);
      byFile.set(diag.file, existing);
    }

    // Format output
    const lines: string[] = [];

    if (errors.length > 0) {
      lines.push("# Warnings");
      for (const err of errors) {
        lines.push(`- ${err}`);
      }
      lines.push("");
    }

    const errorCount = filteredDiagnostics.filter((d) => d.severity === "error").length;
    const warningCount = filteredDiagnostics.filter((d) => d.severity === "warning").length;
    const infoCount = filteredDiagnostics.filter(
      (d) => d.severity === "info" || d.severity === "hint"
    ).length;

    lines.push(`# Diagnostics Summary`);
    lines.push(`Files checked: ${processedFiles.size}`);
    lines.push(`Errors: ${errorCount}, Warnings: ${warningCount}, Info/Hints: ${infoCount}`);
    lines.push("");

    if (byFile.size === 0) {
      lines.push("No diagnostics found.");
    } else {
      for (const [file, diagnostics] of byFile) {
        // Make path relative
        const relativePath = file.startsWith(ctx.workingDirectory)
          ? file.slice(ctx.workingDirectory.length + 1)
          : file;

        lines.push(`## ${relativePath}`);
        lines.push("");

        // Sort by line number
        diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);

        for (const diag of diagnostics) {
          const severityIcon =
            diag.severity === "error"
              ? "[ERROR]"
              : diag.severity === "warning"
              ? "[WARN]"
              : "[INFO]";

          const location = `${diag.line}:${diag.column}`;
          const source = diag.source ? ` (${diag.source})` : "";
          const code = diag.code ? ` [${diag.code}]` : "";

          lines.push(`- ${severityIcon} Line ${location}${source}${code}`);
          lines.push(`  ${diag.message}`);
        }

        lines.push("");
      }
    }

    // List active servers
    const activeServers = manager.getActiveServers();
    if (activeServers.length > 0) {
      lines.push(`# Active Language Servers`);
      for (const server of activeServers) {
        lines.push(`- ${server}`);
      }
    }

    return {
      output: lines.join("\n"),
      metadata: {
        filesChecked: processedFiles.size,
        errorCount,
        warningCount,
        infoCount,
        activeServers,
      },
    };
  },
});

/**
 * Cleanup function to shutdown all LSP managers
 */
export async function shutdownLspManagers(): Promise<void> {
  const shutdownPromises = Array.from(managers.values()).map((m) =>
    m.shutdown().catch(() => {})
  );
  await Promise.all(shutdownPromises);
  managers.clear();
}
