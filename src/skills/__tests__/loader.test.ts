import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseSkillMd, isSkillDirectory, loadSkillFromDirectory } from "../loader.js";

describe("parseSkillMd", () => {
  it("parses valid SKILL.md content", () => {
    const content = `---
name: test-skill
description: A test skill for testing purposes.
---

# Test Skill

This is the instruction content.
`;

    const result = parseSkillMd(content);

    expect(result.metadata.name).toBe("test-skill");
    expect(result.metadata.description).toBe("A test skill for testing purposes.");
    expect(result.instructions).toContain("# Test Skill");
    expect(result.instructions).toContain("This is the instruction content.");
  });

  it("parses metadata with optional fields", () => {
    const content = `---
name: advanced-skill
description: An advanced skill.
license: MIT
compatibility: Requires Python 3.10+
metadata:
  author: test-author
  version: "1.0"
allowed-tools: Bash Read Write
---

Instructions here.
`;

    const result = parseSkillMd(content);

    expect(result.metadata.name).toBe("advanced-skill");
    expect(result.metadata.license).toBe("MIT");
    expect(result.metadata.compatibility).toBe("Requires Python 3.10+");
    expect(result.metadata.metadata).toEqual({ author: "test-author", version: "1.0" });
    expect(result.metadata.allowedTools).toEqual(["Bash", "Read", "Write"]);
  });

  it("throws for missing frontmatter", () => {
    const content = `# Just markdown without frontmatter`;

    expect(() => parseSkillMd(content)).toThrow("SKILL.md must contain YAML frontmatter");
  });

  it("throws for invalid YAML", () => {
    const content = `---
name: [invalid yaml
---

Content
`;

    expect(() => parseSkillMd(content)).toThrow("Invalid YAML");
  });

  it("throws for invalid skill name", () => {
    const content = `---
name: Invalid-Name
description: Invalid uppercase.
---

Content
`;

    expect(() => parseSkillMd(content)).toThrow("Invalid skill metadata");
  });

  it("handles empty instruction body", () => {
    const content = `---
name: empty-skill
description: A skill with no instructions.
---
`;

    const result = parseSkillMd(content);

    expect(result.instructions).toBe("");
  });
});

describe("isSkillDirectory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `skill-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns true for directory with SKILL.md", async () => {
    const skillDir = join(tempDir, "my-skill");
    await mkdir(skillDir);
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: my-skill\ndescription: Test\n---\n");

    expect(isSkillDirectory(skillDir)).toBe(true);
  });

  it("returns false for directory without SKILL.md", async () => {
    const skillDir = join(tempDir, "not-a-skill");
    await mkdir(skillDir);
    await writeFile(join(skillDir, "README.md"), "Not a skill");

    expect(isSkillDirectory(skillDir)).toBe(false);
  });

  it("returns false for non-existent directory", () => {
    expect(isSkillDirectory(join(tempDir, "does-not-exist"))).toBe(false);
  });
});

describe("loadSkillFromDirectory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `skill-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads a valid skill", async () => {
    const skillDir = join(tempDir, "my-skill");
    await mkdir(skillDir);
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: my-skill
description: A test skill.
---

# My Skill Instructions

Do the thing.
`
    );

    const skill = await loadSkillFromDirectory(skillDir, "local");

    expect(skill.path).toBe(skillDir);
    expect(skill.source).toBe("local");
    expect(skill.metadata.name).toBe("my-skill");
    expect(skill.metadata.description).toBe("A test skill.");
    expect(skill.instructions).toContain("# My Skill Instructions");
  });

  it("throws when SKILL.md is missing", async () => {
    const skillDir = join(tempDir, "no-skill");
    await mkdir(skillDir);

    await expect(loadSkillFromDirectory(skillDir, "local")).rejects.toThrow("SKILL.md not found");
  });

  it("throws when skill name doesn't match directory name", async () => {
    const skillDir = join(tempDir, "my-skill");
    await mkdir(skillDir);
    await writeFile(
      join(skillDir, "SKILL.md"),
      `---
name: different-name
description: Mismatched name.
---

Content
`
    );

    await expect(loadSkillFromDirectory(skillDir, "local")).rejects.toThrow(
      'Skill name "different-name" does not match directory name "my-skill"'
    );
  });
});
