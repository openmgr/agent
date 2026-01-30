/**
 * @openmgr/agent-skills-loader
 *
 * Filesystem-based skill loading for OpenMgr Agent.
 * Provides functions to discover and load skills from:
 * - Local project: .openmgr/skills/
 * - Global user: ~/.config/openmgr/skills/
 * - Bundled: shipped with packages
 */

import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join, basename, resolve, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import type {
  SkillMetadata,
  LoadedSkill,
  SkillSource,
  SkillReference,
} from "@openmgr/agent-core";
import {
  SkillMetadataSchema,
  toSkillMetadata,
  SkillLoadError,
  SkillNotFoundError,
} from "@openmgr/agent-core";

// Re-export types for convenience
export type { SkillMetadata, LoadedSkill, SkillSource, SkillReference };
export { SkillLoadError, SkillNotFoundError };

const SKILL_FILENAME = "SKILL.md";

/**
 * Regex to match YAML frontmatter in markdown files
 * Matches: ---\n<yaml content>\n---
 */
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parse a SKILL.md file into metadata and instructions
 */
export function parseSkillMd(content: string): { metadata: SkillMetadata; instructions: string } {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    throw new Error("SKILL.md must contain YAML frontmatter (---\\n...\\n---)");
  }

  const [, yamlContent, markdownBody] = match;

  if (!yamlContent) {
    throw new Error("Missing YAML frontmatter content");
  }

  // Parse YAML frontmatter
  let rawMetadata: unknown;
  try {
    rawMetadata = parseYaml(yamlContent);
  } catch (err) {
    throw new Error(
      `Invalid YAML in frontmatter: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Validate against schema
  const parseResult = SkillMetadataSchema.safeParse(rawMetadata);
  if (!parseResult.success) {
    const errors = parseResult.error.errors
      .map((e: { path: (string | number)[]; message: string }) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`Invalid skill metadata: ${errors}`);
  }

  return {
    metadata: toSkillMetadata(parseResult.data),
    instructions: (markdownBody ?? "").trim(),
  };
}

/**
 * Check if a directory contains a valid skill (has SKILL.md)
 */
export function isSkillDirectory(dirPath: string): boolean {
  return existsSync(join(dirPath, SKILL_FILENAME));
}

/**
 * Load a skill from a directory
 */
export async function loadSkillFromDirectory(
  dirPath: string,
  source: SkillSource
): Promise<LoadedSkill> {
  const skillFilePath = join(dirPath, SKILL_FILENAME);

  if (!existsSync(skillFilePath)) {
    throw new SkillLoadError(dirPath, `${SKILL_FILENAME} not found`);
  }

  let content: string;
  try {
    content = await readFile(skillFilePath, "utf-8");
  } catch (err) {
    throw new SkillLoadError(
      dirPath,
      `Failed to read ${SKILL_FILENAME}`,
      err instanceof Error ? err : undefined
    );
  }

  let parsed: { metadata: SkillMetadata; instructions: string };
  try {
    parsed = parseSkillMd(content);
  } catch (err) {
    throw new SkillLoadError(
      dirPath,
      err instanceof Error ? err.message : String(err),
      err instanceof Error ? err : undefined
    );
  }

  // Validate that skill name matches directory name
  const dirName = basename(dirPath);
  if (parsed.metadata.name !== dirName) {
    throw new SkillLoadError(
      dirPath,
      `Skill name "${parsed.metadata.name}" does not match directory name "${dirName}"`
    );
  }

  return {
    path: dirPath,
    metadata: parsed.metadata,
    instructions: parsed.instructions,
    source,
  };
}

/**
 * Load just the metadata from a skill directory (for discovery)
 */
export async function loadSkillMetadata(
  dirPath: string,
  source: SkillSource
): Promise<{ metadata: SkillMetadata; path: string; source: SkillSource }> {
  const skill = await loadSkillFromDirectory(dirPath, source);
  return {
    metadata: skill.metadata,
    path: skill.path,
    source: skill.source,
  };
}

/**
 * Skill discovery paths in priority order
 */
export interface SkillPaths {
  /** Project-local: .openmgr/skills/ in working directory */
  local: string;
  /** Global user: ~/.config/openmgr/skills/ */
  global: string;
  /** Bundled: shipped with the package */
  bundled: string;
  /** Additional bundled paths from plugins */
  additionalBundled: string[];
}

/**
 * Options for SkillManager
 */
export interface SkillManagerOptions {
  /** Additional paths to discover bundled skills from (e.g., from plugins) */
  additionalBundledPaths?: string[];
  /** Custom bundled path (defaults to __dirname/bundled) */
  bundledPath?: string;
}

/**
 * Get skill discovery paths for a given working directory
 */
export function getSkillPaths(
  workingDirectory: string,
  options: { additionalBundledPaths?: string[]; bundledPath?: string } = {}
): SkillPaths {
  // Default bundled path - this may not exist if called outside the core package
  const defaultBundledPath = options.bundledPath ?? join(workingDirectory, ".openmgr", "bundled-skills");
  
  return {
    local: join(workingDirectory, ".openmgr", "skills"),
    global: join(homedir(), ".config", "openmgr", "skills"),
    bundled: defaultBundledPath,
    additionalBundled: options.additionalBundledPaths ?? [],
  };
}

/**
 * Manages skill discovery and loading from the filesystem
 */
export class FilesystemSkillManager {
  private workingDirectory: string;
  private paths: SkillPaths;
  private discovered: Map<string, SkillReference> = new Map();
  private overrideWarnings: string[] = [];
  private warnFn: (msg: string) => void;

  constructor(
    workingDirectory: string,
    options: SkillManagerOptions & { warn?: (msg: string) => void } = {}
  ) {
    this.workingDirectory = resolve(workingDirectory);
    this.paths = getSkillPaths(this.workingDirectory, options);
    this.warnFn = options.warn ?? console.warn;
  }

  /**
   * Add additional bundled skill paths (e.g., from plugins)
   */
  addBundledPath(path: string): void {
    if (!this.paths.additionalBundled.includes(path)) {
      this.paths.additionalBundled.push(path);
    }
  }

  /**
   * Get the skill discovery paths
   */
  getPaths(): SkillPaths {
    return this.paths;
  }

  /**
   * Get any warnings about skill overrides
   */
  getOverrideWarnings(): string[] {
    return [...this.overrideWarnings];
  }

  /**
   * Discover all available skills from all paths
   * Skills in higher-priority paths override those in lower-priority paths
   */
  async discover(): Promise<SkillReference[]> {
    this.discovered.clear();
    this.overrideWarnings = [];

    // Discover in reverse priority order (bundled first, then global, then local)
    // so that higher priority paths override lower ones
    const bundledSource: SkillSource = "bundled";
    const globalSource: SkillSource = "global";
    const localSource: SkillSource = "local";
    
    const sources: Array<{ path: string; source: SkillSource }> = [
      // Additional bundled paths from plugins (lowest priority among bundled)
      ...this.paths.additionalBundled.map((path) => ({ path, source: bundledSource })),
      // Core bundled path
      { path: this.paths.bundled, source: bundledSource },
      // User paths (higher priority)
      { path: this.paths.global, source: globalSource },
      { path: this.paths.local, source: localSource },
    ];

    for (const { path, source } of sources) {
      await this.discoverFromPath(path, source);
    }

    return this.getAvailable();
  }

  /**
   * Discover skills from a specific path
   */
  private async discoverFromPath(basePath: string, source: SkillSource): Promise<void> {
    if (!existsSync(basePath)) {
      return;
    }

    let entries: string[];
    try {
      entries = await readdir(basePath);
    } catch {
      return;
    }

    for (const entry of entries) {
      const skillPath = join(basePath, entry);

      if (!isSkillDirectory(skillPath)) {
        continue;
      }

      try {
        const skill = await loadSkillFromDirectory(skillPath, source);
        const existing = this.discovered.get(skill.metadata.name);

        if (existing) {
          // Higher priority source overrides lower priority
          this.overrideWarnings.push(
            `Skill "${skill.metadata.name}" from ${source} (${skillPath}) overrides ${existing.source} (${existing.path})`
          );
        }

        this.discovered.set(skill.metadata.name, {
          name: skill.metadata.name,
          description: skill.metadata.description,
          path: skill.path,
          source: skill.source,
        });
      } catch (err) {
        // Log error but continue discovering other skills
        this.warnFn(
          `Warning: Failed to load skill from ${skillPath}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  /**
   * Get all discovered skills
   */
  getAvailable(): SkillReference[] {
    return Array.from(this.discovered.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Check if a skill is available
   */
  hasSkill(name: string): boolean {
    return this.discovered.has(name);
  }

  /**
   * Load a skill by name
   */
  async load(name: string): Promise<LoadedSkill> {
    const ref = this.discovered.get(name);

    if (!ref) {
      throw new SkillNotFoundError(name);
    }

    return loadSkillFromDirectory(ref.path, ref.source);
  }

  /**
   * Get a skill reference by name
   */
  getSkill(name: string): SkillReference | undefined {
    return this.discovered.get(name);
  }

  /**
   * Generate the skills section for the system prompt
   */
  generateSystemPromptSection(): string {
    const skills = this.getAvailable();

    if (skills.length === 0) {
      return "";
    }

    const skillsList = skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n");

    return `
# Available Skills

Load a skill with the \`skill\` tool when the task matches its description.

${skillsList}
`.trim();
  }

  /**
   * Generate the dynamic skill tool description
   */
  generateSkillToolDescription(): string {
    const skills = this.getAvailable();

    if (skills.length === 0) {
      return "Load a skill to get detailed instructions for a specific task. No skills are currently available.";
    }

    const skillNames = skills.map((s) => s.name).join(", ");
    return `Load a skill to get detailed instructions for a specific task. Available skills: ${skillNames}`;
  }
}

// Export alias for backwards compatibility
export { FilesystemSkillManager as SkillManager };
