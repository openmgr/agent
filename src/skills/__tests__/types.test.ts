import { describe, it, expect } from "vitest";
import {
  SkillNameSchema,
  SkillDescriptionSchema,
  SkillMetadataSchema,
  parseAllowedTools,
  toSkillMetadata,
} from "../types.js";

describe("SkillNameSchema", () => {
  it("accepts valid skill names", () => {
    expect(SkillNameSchema.safeParse("code-review").success).toBe(true);
    expect(SkillNameSchema.safeParse("a").success).toBe(true);
    expect(SkillNameSchema.safeParse("test123").success).toBe(true);
    expect(SkillNameSchema.safeParse("my-skill-name").success).toBe(true);
  });

  it("rejects names starting with hyphen", () => {
    const result = SkillNameSchema.safeParse("-invalid");
    expect(result.success).toBe(false);
  });

  it("rejects names ending with hyphen", () => {
    const result = SkillNameSchema.safeParse("invalid-");
    expect(result.success).toBe(false);
  });

  it("rejects names with consecutive hyphens", () => {
    const result = SkillNameSchema.safeParse("in--valid");
    expect(result.success).toBe(false);
  });

  it("rejects names with uppercase letters", () => {
    const result = SkillNameSchema.safeParse("Invalid");
    expect(result.success).toBe(false);
  });

  it("rejects names over 64 characters", () => {
    const longName = "a".repeat(65);
    const result = SkillNameSchema.safeParse(longName);
    expect(result.success).toBe(false);
  });

  it("rejects empty names", () => {
    const result = SkillNameSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("SkillDescriptionSchema", () => {
  it("accepts valid descriptions", () => {
    expect(SkillDescriptionSchema.safeParse("A simple description").success).toBe(true);
  });

  it("rejects empty descriptions", () => {
    const result = SkillDescriptionSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects descriptions over 1024 characters", () => {
    const longDesc = "a".repeat(1025);
    const result = SkillDescriptionSchema.safeParse(longDesc);
    expect(result.success).toBe(false);
  });
});

describe("SkillMetadataSchema", () => {
  it("accepts valid minimal metadata", () => {
    const result = SkillMetadataSchema.safeParse({
      name: "test-skill",
      description: "A test skill",
    });
    expect(result.success).toBe(true);
  });

  it("accepts full metadata with optional fields", () => {
    const result = SkillMetadataSchema.safeParse({
      name: "test-skill",
      description: "A test skill",
      license: "MIT",
      compatibility: "Requires Node.js 20+",
      metadata: { author: "test", version: "1.0" },
      "allowed-tools": "Bash Read Write",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = SkillMetadataSchema.safeParse({
      description: "A test skill",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = SkillMetadataSchema.safeParse({
      name: "test-skill",
    });
    expect(result.success).toBe(false);
  });
});

describe("parseAllowedTools", () => {
  it("parses space-delimited tools", () => {
    expect(parseAllowedTools("Bash Read Write")).toEqual(["Bash", "Read", "Write"]);
  });

  it("handles multiple spaces", () => {
    expect(parseAllowedTools("Bash  Read   Write")).toEqual(["Bash", "Read", "Write"]);
  });

  it("returns undefined for undefined input", () => {
    expect(parseAllowedTools(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseAllowedTools("")).toBeUndefined();
  });
});

describe("toSkillMetadata", () => {
  it("converts raw metadata to SkillMetadata", () => {
    const raw = {
      name: "test-skill",
      description: "A test skill",
      license: "MIT",
      "allowed-tools": "Bash Read",
    };

    const result = toSkillMetadata(raw);

    expect(result.name).toBe("test-skill");
    expect(result.description).toBe("A test skill");
    expect(result.license).toBe("MIT");
    expect(result.allowedTools).toEqual(["Bash", "Read"]);
  });

  it("handles missing optional fields", () => {
    const raw = {
      name: "test-skill",
      description: "A test skill",
    };

    const result = toSkillMetadata(raw);

    expect(result.name).toBe("test-skill");
    expect(result.license).toBeUndefined();
    expect(result.allowedTools).toBeUndefined();
  });
});
