import { describe, it, expect } from 'vitest';
import * as agentExports from '../index.js';

describe('@openmgr/agent exports', () => {
  it('should export Agent class', () => {
    expect(agentExports.Agent).toBeDefined();
    expect(typeof agentExports.Agent).toBe('function');
  });

  it('should export defineTool', () => {
    expect(agentExports.defineTool).toBeDefined();
    expect(typeof agentExports.defineTool).toBe('function');
  });

  it('should export SkillManager', () => {
    expect(agentExports.SkillManager).toBeDefined();
    expect(typeof agentExports.SkillManager).toBe('function');
  });

  it('should export loadConfig function', () => {
    expect(agentExports.loadConfig).toBeDefined();
    expect(typeof agentExports.loadConfig).toBe('function');
  });

  it('should export provider functions', () => {
    expect(agentExports.createProvider).toBeDefined();
    expect(typeof agentExports.createProvider).toBe('function');
  });

  it('should export providersPlugin', () => {
    expect(agentExports.providersPlugin).toBeDefined();
    expect(typeof agentExports.providersPlugin).toBe('function');
  });

  it('should export storage classes', () => {
    expect(agentExports.SessionManager).toBeDefined();
    expect(agentExports.createDatabase).toBeDefined();
  });

  it('should export memory classes', () => {
    expect(agentExports.MemoryStorage).toBeDefined();
    expect(typeof agentExports.MemoryStorage).toBe('function');
  });

  it('should export server functions', () => {
    expect(agentExports.createServer).toBeDefined();
    expect(agentExports.startServer).toBeDefined();
    expect(agentExports.serverPlugin).toBeDefined();
  });

  it('should export skills-bundled functions', () => {
    expect(agentExports.skillsBundledPlugin).toBeDefined();
    expect(agentExports.getBundledSkillPath).toBeDefined();
    expect(agentExports.getBundledSkillNames).toBeDefined();
  });

  it('should export tool plugins', () => {
    expect(agentExports.toolsPlugin).toBeDefined();
    expect(agentExports.toolsTerminalPlugin).toBeDefined();
  });

  it('should export auth functions', () => {
    expect(agentExports.login).toBeDefined();
    expect(agentExports.isLoggedIn).toBeDefined();
    expect(agentExports.clearTokens).toBeDefined();
  });

  it('should export LSP classes', () => {
    expect(agentExports.LspClient).toBeDefined();
    expect(agentExports.LspManager).toBeDefined();
    expect(agentExports.getLanguageId).toBeDefined();
  });

  it('should export CLI utilities', () => {
    expect(agentExports.Spinner).toBeDefined();
    expect(agentExports.DebugLogger).toBeDefined();
    expect(agentExports.registerAllCommands).toBeDefined();
  });

  it('should export core tools', () => {
    expect(agentExports.todoReadTool).toBeDefined();
    expect(agentExports.todoWriteTool).toBeDefined();
    expect(agentExports.webFetchTool).toBeDefined();
  });

  it('should export terminal tools', () => {
    expect(agentExports.bashTool).toBeDefined();
    expect(agentExports.readTool).toBeDefined();
    expect(agentExports.writeTool).toBeDefined();
    expect(agentExports.editTool).toBeDefined();
    expect(agentExports.globTool).toBeDefined();
    expect(agentExports.grepTool).toBeDefined();
  });
});
