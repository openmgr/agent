import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, basename } from "path";
import { parse as parseYaml } from "yaml";
import {
  type SkillMetadata,
  type LoadedSkill,
  type SkillSource,
  SkillMetadataSchema,
  toSkillMetadata,
  SkillLoadError,
} from "./types.js";

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
    throw new Error(`Invalid YAML in frontmatter: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Validate against schema
  const parseResult = SkillMetadataSchema.safeParse(rawMetadata);
  if (!parseResult.success) {
    const errors = parseResult.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
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
