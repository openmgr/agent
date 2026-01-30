import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { AgentPlugin, PluginSkillSource } from "@openmgr/agent-core";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to bundled skills (one directory up from dist/index.js to skills/)
const SKILLS_DIR = join(__dirname, "..", "skills");

/**
 * Information about a bundled skill.
 */
export interface BundledSkillInfo {
  name: string;
  description: string;
  path: string;
}

/**
 * All bundled skills with their metadata.
 */
export const bundledSkills: BundledSkillInfo[] = [
  {
    name: "code-review",
    description: "Review code for bugs, style issues, performance problems, and suggest improvements",
    path: join(SKILLS_DIR, "code-review", "SKILL.md"),
  },
  {
    name: "debug",
    description: "Systematic debugging approach for identifying and fixing issues",
    path: join(SKILLS_DIR, "debug", "SKILL.md"),
  },
  {
    name: "documentation",
    description: "Write clear and comprehensive documentation for code and APIs",
    path: join(SKILLS_DIR, "documentation", "SKILL.md"),
  },
  {
    name: "git-commit",
    description: "Create well-formatted commit messages following conventional commit standards",
    path: join(SKILLS_DIR, "git-commit", "SKILL.md"),
  },
  {
    name: "pr-review",
    description: "Review pull requests thoroughly and provide constructive feedback",
    path: join(SKILLS_DIR, "pr-review", "SKILL.md"),
  },
  {
    name: "refactor",
    description: "Refactor code to improve structure, readability, and maintainability",
    path: join(SKILLS_DIR, "refactor", "SKILL.md"),
  },
  {
    name: "security-review",
    description: "Review code for security vulnerabilities and suggest fixes",
    path: join(SKILLS_DIR, "security-review", "SKILL.md"),
  },
  {
    name: "test-writing",
    description: "Write comprehensive tests for code including unit, integration, and e2e tests",
    path: join(SKILLS_DIR, "test-writing", "SKILL.md"),
  },
];

/**
 * Get the path to a bundled skill by name.
 */
export function getBundledSkillPath(name: string): string | null {
  const skill = bundledSkills.find(s => s.name === name);
  return skill?.path ?? null;
}

/**
 * Get all bundled skill names.
 */
export function getBundledSkillNames(): string[] {
  return bundledSkills.map(s => s.name);
}

/**
 * Get the directory containing all bundled skills.
 */
export function getBundledSkillsDir(): string {
  return SKILLS_DIR;
}

/**
 * Convert bundled skills to PluginSkillSource format for plugin registration.
 */
function toPluginSkillSources(): PluginSkillSource[] {
  return bundledSkills.map(skill => ({
    name: skill.name,
    description: skill.description,
    path: skill.path,
  }));
}

/**
 * Create a plugin that registers all bundled skills.
 * 
 * @example
 * ```ts
 * import { Agent } from "@openmgr/agent-core";
 * import { skillsBundledPlugin } from "@openmgr/agent-skills-bundled";
 * 
 * const agent = new Agent({ ... });
 * await agent.use(skillsBundledPlugin());
 * ```
 */
export function skillsBundledPlugin(): AgentPlugin {
  return {
    name: "skills-bundled",
    version: "0.1.0",
    skills: toPluginSkillSources(),
  };
}
