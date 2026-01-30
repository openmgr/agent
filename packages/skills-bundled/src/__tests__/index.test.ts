import { describe, it, expect } from 'vitest';
import {
  bundledSkills,
  getBundledSkillPath,
  getBundledSkillNames,
  getBundledSkillsDir,
  skillsBundledPlugin,
} from '../index.js';

describe('bundledSkills', () => {
  it('should have all expected skills', () => {
    const expectedSkills = [
      'code-review',
      'debug',
      'documentation',
      'git-commit',
      'pr-review',
      'refactor',
      'security-review',
      'test-writing',
    ];
    
    const skillNames = bundledSkills.map(s => s.name);
    expect(skillNames).toEqual(expectedSkills);
  });

  it('should have valid structure for each skill', () => {
    for (const skill of bundledSkills) {
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('path');
      expect(typeof skill.name).toBe('string');
      expect(typeof skill.description).toBe('string');
      expect(typeof skill.path).toBe('string');
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.path).toContain('SKILL.md');
    }
  });
});

describe('getBundledSkillPath', () => {
  it('should return path for valid skill name', () => {
    const path = getBundledSkillPath('code-review');
    expect(path).not.toBeNull();
    expect(path).toContain('code-review');
    expect(path).toContain('SKILL.md');
  });

  it('should return null for invalid skill name', () => {
    const path = getBundledSkillPath('non-existent-skill');
    expect(path).toBeNull();
  });

  it('should return correct path for each bundled skill', () => {
    for (const skill of bundledSkills) {
      const path = getBundledSkillPath(skill.name);
      expect(path).toBe(skill.path);
    }
  });
});

describe('getBundledSkillNames', () => {
  it('should return all skill names', () => {
    const names = getBundledSkillNames();
    expect(names).toHaveLength(bundledSkills.length);
  });

  it('should return array of strings', () => {
    const names = getBundledSkillNames();
    for (const name of names) {
      expect(typeof name).toBe('string');
    }
  });

  it('should contain expected skills', () => {
    const names = getBundledSkillNames();
    expect(names).toContain('code-review');
    expect(names).toContain('debug');
    expect(names).toContain('refactor');
    expect(names).toContain('test-writing');
  });
});

describe('getBundledSkillsDir', () => {
  it('should return a directory path', () => {
    const dir = getBundledSkillsDir();
    expect(typeof dir).toBe('string');
    expect(dir.length).toBeGreaterThan(0);
  });

  it('should return path containing "skills"', () => {
    const dir = getBundledSkillsDir();
    expect(dir).toContain('skills');
  });
});

describe('skillsBundledPlugin', () => {
  it('should return a valid plugin object', () => {
    const plugin = skillsBundledPlugin();
    expect(plugin).toHaveProperty('name');
    expect(plugin).toHaveProperty('version');
  });

  it('should have correct plugin name', () => {
    const plugin = skillsBundledPlugin();
    expect(plugin.name).toBe('skills-bundled');
  });

  it('should have a version string', () => {
    const plugin = skillsBundledPlugin();
    expect(typeof plugin.version).toBe('string');
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should include skills array', () => {
    const plugin = skillsBundledPlugin();
    expect(plugin).toHaveProperty('skills');
    expect(Array.isArray(plugin.skills)).toBe(true);
    expect(plugin.skills!.length).toBe(bundledSkills.length);
  });

  it('should have correct skill structure in plugin', () => {
    const plugin = skillsBundledPlugin();
    for (const skill of plugin.skills!) {
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('path');
    }
  });
});
