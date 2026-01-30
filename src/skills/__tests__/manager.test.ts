import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { SkillManager, getSkillPaths } from "../manager.js";

describe("getSkillPaths", () => {
  it("returns correct paths for working directory", () => {
    const paths = getSkillPaths("/home/user/project");

    expect(paths.local).toBe("/home/user/project/.openmgr/skills");
    expect(paths.global).toContain(".config/openmgr/skills");
    expect(paths.bundled).toContain("bundled");
  });
});

describe("SkillManager", () => {
  let tempDir: string;
  let localSkillsDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `skill-manager-test-${Date.now()}`);
    localSkillsDir = join(tempDir, ".openmgr", "skills");
    await mkdir(localSkillsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("discover", () => {
    it("discovers skills from local directory", async () => {
      // Create a local skill
      const skillDir = join(localSkillsDir, "local-skill");
      await mkdir(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: local-skill
description: A local test skill.
---

Instructions here.
`
      );

      const manager = new SkillManager(tempDir);
      const skills = await manager.discover();

      // Should find local skill + bundled skills
      const localSkill = skills.find((s) => s.name === "local-skill");
      expect(localSkill).toBeDefined();
      expect(localSkill?.source).toBe("local");
      expect(localSkill?.description).toBe("A local test skill.");
    });

    it("discovers bundled skills", async () => {
      const manager = new SkillManager(tempDir);
      const skills = await manager.discover();

      // Should find bundled skills
      const codeReview = skills.find((s) => s.name === "code-review");
      expect(codeReview).toBeDefined();
      expect(codeReview?.source).toBe("bundled");
    });

    it("local skills override bundled skills with same name", async () => {
      // Create a local skill with same name as bundled
      const skillDir = join(localSkillsDir, "code-review");
      await mkdir(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: code-review
description: My custom code review skill.
---

Custom instructions.
`
      );

      const manager = new SkillManager(tempDir);
      await manager.discover();

      const skill = manager.getSkill("code-review");
      expect(skill?.source).toBe("local");
      expect(skill?.description).toBe("My custom code review skill.");

      // Should have warnings
      const warnings = manager.getOverrideWarnings();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("overrides");
    });

    it("returns skills sorted by name", async () => {
      const manager = new SkillManager(tempDir);
      const skills = await manager.discover();

      const names = skills.map((s) => s.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });

  describe("load", () => {
    it("loads full skill content", async () => {
      const skillDir = join(localSkillsDir, "my-skill");
      await mkdir(skillDir);
      await writeFile(
        join(skillDir, "SKILL.md"),
        `---
name: my-skill
description: A test skill.
---

# Instructions

Step 1: Do this.
Step 2: Do that.
`
      );

      const manager = new SkillManager(tempDir);
      await manager.discover();

      const skill = await manager.load("my-skill");

      expect(skill.metadata.name).toBe("my-skill");
      expect(skill.instructions).toContain("# Instructions");
      expect(skill.instructions).toContain("Step 1");
    });

    it("throws for unknown skill", async () => {
      const manager = new SkillManager(tempDir);
      await manager.discover();

      await expect(manager.load("nonexistent")).rejects.toThrow("Skill not found");
    });
  });

  describe("hasSkill", () => {
    it("returns true for existing skill", async () => {
      const manager = new SkillManager(tempDir);
      await manager.discover();

      expect(manager.hasSkill("code-review")).toBe(true);
    });

    it("returns false for non-existing skill", async () => {
      const manager = new SkillManager(tempDir);
      await manager.discover();

      expect(manager.hasSkill("nonexistent")).toBe(false);
    });
  });

  describe("generateSystemPromptSection", () => {
    it("generates skills section for system prompt", async () => {
      const manager = new SkillManager(tempDir);
      await manager.discover();

      const section = manager.generateSystemPromptSection();

      expect(section).toContain("# Available Skills");
      expect(section).toContain("code-review");
      expect(section).toContain("skill");
    });

    it("returns empty string when no skills available", async () => {
      // Create a manager with no skills (impossible in practice due to bundled)
      // This tests the branch by mocking
      const manager = new SkillManager(tempDir);
      // Don't call discover - no skills loaded
      
      const section = manager.generateSystemPromptSection();
      expect(section).toBe("");
    });
  });

  describe("generateSkillToolDescription", () => {
    it("includes available skill names", async () => {
      const manager = new SkillManager(tempDir);
      await manager.discover();

      const desc = manager.generateSkillToolDescription();

      expect(desc).toContain("code-review");
      expect(desc).toContain("Available skills:");
    });
  });
});
