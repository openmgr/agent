/**
 * Skills types and interfaces.
 * 
 * For filesystem-based skill loading, use @openmgr/agent-skills-loader or @openmgr/agent-node.
 */
export {
  SkillMetadataSchema,
  SkillNameSchema,
  SkillDescriptionSchema,
  SkillCompatibilitySchema,
  SkillLoadError,
  SkillNotFoundError,
  toSkillMetadata,
  parseAllowedTools,
  type SkillMetadata,
  type SkillReference,
  type LoadedSkill,
  type SkillSource,
  type SkillManagerInterface,
} from "./types.js";
