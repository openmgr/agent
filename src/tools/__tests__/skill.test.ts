import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { skillTool } from "../skill.js";
import { SkillManager } from "../../skills/index.js";
import type { ToolContext } from "../../types.js";

describe("skillTool", () => {
  let tempDir: string;
  let localSkillsDir: string;
  let skillManager: SkillManager;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `skill-tool-test-${Date.now()}`);
    localSkillsDir = join(tempDir, ".openmgr", "skills");
    await mkdir(localSkillsDir, { recursive: true });

    // Create a test skill
    const skillDir = join(localSkillsDir, "test-skill");
    await mkdir(skillDir);
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: test-skill
description: A test skill for unit tests.
---

# Test Skill Instructions

Follow these steps:
1. Step one
2. Step two
`
    );

    skillManager = new SkillManager(tempDir);
    await skillManager.discover();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const createContext = (manager?: SkillManager): ToolContext => ({
    workingDirectory: tempDir,
    getSkillManager: () => manager,
  });

  it("has correct tool definition", () => {
    expect(skillTool.name).toBe("skill");
    expect(skillTool.description).toContain("skill");
  });

  it("returns skill instructions when skill exists", async () => {
    const ctx = createContext(skillManager);
    const result = await skillTool.execute({ name: "test-skill" }, ctx);

    expect(result.output).toContain("# Test Skill Instructions");
    expect(result.output).toContain("Step one");
    expect(result.metadata?.skillName).toBe("test-skill");
    expect(result.metadata?.skillSource).toBe("local");
  });

  it("returns bundled skill instructions", async () => {
    const ctx = createContext(skillManager);
    const result = await skillTool.execute({ name: "code-review" }, ctx);

    expect(result.output).toContain("Code Review");
    expect(result.metadata?.skillSource).toBe("bundled");
  });

  it("returns error when skill not found", async () => {
    const ctx = createContext(skillManager);
    const result = await skillTool.execute({ name: "nonexistent" }, ctx);

    expect(result.output).toContain("Error");
    expect(result.output).toContain("not found");
    expect(result.output).toContain("test-skill"); // Shows available skills
  });

  it("returns error when skill manager not initialized", async () => {
    const ctx = createContext(undefined);
    const result = await skillTool.execute({ name: "test-skill" }, ctx);

    expect(result.output).toContain("Error");
    expect(result.output).toContain("not initialized");
  });
});
