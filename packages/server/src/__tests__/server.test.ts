import { describe, it, expect } from 'vitest';
import { createServer, serverPlugin } from '../index.js';
import type { AgentInterface, AgentConfig } from '@openmgr/agent-core';
import type { SessionManager } from '@openmgr/agent-storage';

// Create a minimal mock agent
function createMockAgent(): AgentInterface {
  const config: AgentConfig = {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    auth: { type: 'api-key', apiKey: 'test' },
  };

  const extensions = new Map<string, unknown>();

  return {
    getConfig: () => config,
    setExtension: (key: string, value: unknown) => {
      extensions.set(key, value);
    },
    getExtension: (key: string) => extensions.get(key),
    run: async () => ({ response: '', usage: { inputTokens: 0, outputTokens: 0 } }),
    registerPlugin: async () => {},
    registerTool: () => {},
    getTools: () => [],
    getTool: () => undefined,
  } as AgentInterface;
}

// Create a mock session manager
function createMockSessionManager() {
  const sessions = new Map<string, { id: string; title: string; createdAt: Date }>();
  const messages = new Map<string, Array<{ role: string; content: string }>>();

  return {
    getRootSessions: async (limit: number) => {
      return Array.from(sessions.values()).slice(0, limit);
    },
    getSession: async (id: string) => {
      return sessions.get(id) || null;
    },
    getSessionMessages: async (id: string) => {
      return messages.get(id) || [];
    },
    deleteSession: async (id: string) => {
      const exists = sessions.has(id);
      sessions.delete(id);
      return exists;
    },
    // Helpers for testing
    _addSession: (id: string, title: string) => {
      sessions.set(id, { id, title, createdAt: new Date() });
    },
    _addMessages: (id: string, msgs: Array<{ role: string; content: string }>) => {
      messages.set(id, msgs);
    },
  };
}

describe('createServer', () => {
  it('should create a Hono app instance', () => {
    const agent = createMockAgent();
    const app = createServer({ agent });
    
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe('function');
  });

  it('should have health endpoint', async () => {
    const agent = createMockAgent();
    const app = createServer({ agent });
    
    const req = new Request('http://localhost/healthz');
    const res = await app.fetch(req);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
  });

  it('should have readiness endpoint', async () => {
    const agent = createMockAgent();
    const app = createServer({ agent });
    
    const req = new Request('http://localhost/readyz');
    const res = await app.fetch(req);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ready).toBe(true);
  });

  it('should have status endpoint', async () => {
    const agent = createMockAgent();
    const app = createServer({ agent });
    
    const req = new Request('http://localhost/beta/status');
    const res = await app.fetch(req);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agent.provider).toBe('anthropic');
    expect(data.agent.model).toBe('claude-sonnet-4-20250514');
  });

  describe('Conversations API', () => {
    it('should return 500 when sessions not available', async () => {
      const agent = createMockAgent();
      const app = createServer({ agent }); // No sessions manager
      
      const req = new Request('http://localhost/beta/conversations');
      const res = await app.fetch(req);
      
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Conversations not available');
    });

    it('should list conversations when available', async () => {
      const agent = createMockAgent();
      const sessions = createMockSessionManager();
      sessions._addSession('sess-1', 'Test Session');
      
      const app = createServer({ agent, sessions: sessions as unknown as SessionManager });
      
      const req = new Request('http://localhost/beta/conversations');
      const res = await app.fetch(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe('sess-1');
      expect(data.count).toBe(1);
    });

    it('should get conversation by id', async () => {
      const agent = createMockAgent();
      const sessions = createMockSessionManager();
      sessions._addSession('sess-1', 'Test Session');
      
      const app = createServer({ agent, sessions: sessions as unknown as SessionManager });
      
      const req = new Request('http://localhost/beta/conversations/sess-1');
      const res = await app.fetch(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(data.data.id).toBe('sess-1');
      expect(data.data.title).toBe('Test Session');
    });

    it('should return 404 for non-existent conversation', async () => {
      const agent = createMockAgent();
      const sessions = createMockSessionManager();
      
      const app = createServer({ agent, sessions: sessions as unknown as SessionManager });
      
      const req = new Request('http://localhost/beta/conversations/non-existent');
      const res = await app.fetch(req);
      
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Conversation not found');
    });

    it('should get conversation messages', async () => {
      const agent = createMockAgent();
      const sessions = createMockSessionManager();
      sessions._addSession('sess-1', 'Test Session');
      sessions._addMessages('sess-1', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);
      
      const app = createServer({ agent, sessions: sessions as unknown as SessionManager });
      
      const req = new Request('http://localhost/beta/conversations/sess-1/messages');
      const res = await app.fetch(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(data.data).toHaveLength(2);
      expect(data.count).toBe(2);
    });

    it('should delete conversation', async () => {
      const agent = createMockAgent();
      const sessions = createMockSessionManager();
      sessions._addSession('sess-1', 'Test Session');
      
      const app = createServer({ agent, sessions: sessions as unknown as SessionManager });
      
      const req = new Request('http://localhost/beta/conversations/sess-1', { method: 'DELETE' });
      const res = await app.fetch(req);
      
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const agent = createMockAgent();
      const app = createServer({ agent });
      
      const req = new Request('http://localhost/health');
      const res = await app.fetch(req);
      
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
  });
});

describe('serverPlugin', () => {
  it('should return a valid plugin object', () => {
    const plugin = serverPlugin();
    
    expect(plugin).toHaveProperty('name');
    expect(plugin).toHaveProperty('version');
    expect(plugin.name).toBe('server');
  });

  it('should have onRegister function', () => {
    const plugin = serverPlugin();
    expect(plugin.onRegister).toBeDefined();
    expect(typeof plugin.onRegister).toBe('function');
  });

  it('should set server.available extension on register', async () => {
    const plugin = serverPlugin();
    const agent = createMockAgent();
    
    await plugin.onRegister!(agent);
    
    expect(agent.getExtension('server.available')).toBe(true);
  });
});
