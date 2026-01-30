import { readdir } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  type SkillReference,
  type LoadedSkill,
  type SkillSource,
  SkillNotFoundError,
} from "./types.js";
import { isSkillDirectory, loadSkillFromDirectory } from "./loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
}

/**
 * Get skill discovery paths for a given working directory
 */
export function getSkillPaths(workingDirectory: string): SkillPaths {
  return {
    local: join(workingDirectory, ".openmgr", "skills"),
    global: join(homedir(), ".config", "openmgr", "skills"),
    bundled: join(__dirname, "bundled"),
  };
}

/**
 * Manages skill discovery and loading
 */
export class SkillManager {
  private workingDirectory: string;
  private paths: SkillPaths;
  private discovered: Map<string, SkillReference> = new Map();
  private overrideWarnings: string[] = [];

  constructor(workingDirectory: string) {
    this.workingDirectory = resolve(workingDirectory);
    this.paths = getSkillPaths(this.workingDirectory);
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
    const sources: Array<{ path: string; source: SkillSource }> = [
      { path: this.paths.bundled, source: "bundled" },
      { path: this.paths.global, source: "global" },
      { path: this.paths.local, source: "local" },
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
        console.warn(`Warning: Failed to load skill from ${skillPath}: ${err instanceof Error ? err.message : String(err)}`);
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

    const skillsList = skills
      .map((s) => `- **${s.name}**: ${s.description}`)
      .join("\n");

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
