/**
 * Tests for SessionManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionManager,
  createEmptyHistory,
  createEmptyMemory,
  validateSession,
  migrateSession,
  SessionValidationError,
  SESSION_FORMAT_VERSION,
  HISTORY_FORMAT_VERSION,
} from '../../../src/core/SessionManager.js';
import { InMemorySessionStorage } from '../../../src/infrastructure/storage/InMemorySessionStorage.js';
import type { Session } from '../../../src/core/SessionManager.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let storage: InMemorySessionStorage;

  beforeEach(() => {
    storage = new InMemorySessionStorage();
    sessionManager = new SessionManager({ storage });
  });

  describe('create', () => {
    it('should create a new session', () => {
      const session = sessionManager.create('agent');

      expect(session.id).toBeDefined();
      expect(session.agentType).toBe('agent');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActiveAt).toBeInstanceOf(Date);
      expect(session.history).toBeDefined();
      expect(session.toolState).toBeDefined();
    });

    it('should create session with metadata', () => {
      const session = sessionManager.create('agent', {
        name: 'Test Agent',
        description: 'Testing',
        tags: ['test'],
      });

      expect(session.metadata.name).toBe('Test Agent');
      expect(session.metadata.description).toBe('Testing');
      expect(session.metadata.tags).toEqual(['test']);
    });

    it('should emit session:created event', () => {
      const listener = vi.fn();
      sessionManager.on('session:created', listener);

      const session = sessionManager.create('agent');

      expect(listener).toHaveBeenCalledWith({ sessionId: session.id, agentType: 'agent' });
    });

    it('should generate unique IDs', () => {
      const session1 = sessionManager.create('agent');
      const session2 = sessionManager.create('agent');

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('save', () => {
    it('should save a session', async () => {
      const session = sessionManager.create('agent');
      await sessionManager.save(session);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(session.id);
    });

    it('should emit session:saved event', async () => {
      const listener = vi.fn();
      sessionManager.on('session:saved', listener);

      const session = sessionManager.create('agent');
      await sessionManager.save(session);

      expect(listener).toHaveBeenCalledWith({ sessionId: session.id });
    });

    it('should update lastActiveAt', async () => {
      const session = sessionManager.create('agent');
      const originalTime = session.lastActiveAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 10));
      await sessionManager.save(session);

      expect(session.lastActiveAt.getTime()).toBeGreaterThan(originalTime);
    });
  });

  describe('load', () => {
    it('should load a session', async () => {
      const session = sessionManager.create('agent', { name: 'Test' });
      await sessionManager.save(session);

      const loaded = await sessionManager.load(session.id);
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(session.id);
      expect(loaded?.metadata.name).toBe('Test');
    });

    it('should return null for non-existent session', async () => {
      const loaded = await sessionManager.load('non-existent');
      expect(loaded).toBeNull();
    });

    it('should emit session:loaded event', async () => {
      const listener = vi.fn();
      sessionManager.on('session:loaded', listener);

      const session = sessionManager.create('agent');
      await sessionManager.save(session);
      await sessionManager.load(session.id);

      expect(listener).toHaveBeenCalledWith({ sessionId: session.id });
    });

    it('should convert dates on load', async () => {
      const session = sessionManager.create('agent');
      await sessionManager.save(session);

      const loaded = await sessionManager.load(session.id);

      // Dates should be converted back to Date objects
      expect(loaded?.createdAt).toBeInstanceOf(Date);
      expect(loaded?.lastActiveAt).toBeInstanceOf(Date);
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      const session = sessionManager.create('agent');
      await sessionManager.save(session);

      await sessionManager.delete(session.id);

      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull();
    });

    it('should emit session:deleted event', async () => {
      const listener = vi.fn();
      sessionManager.on('session:deleted', listener);

      const session = sessionManager.create('agent');
      await sessionManager.save(session);
      await sessionManager.delete(session.id);

      expect(listener).toHaveBeenCalledWith({ sessionId: session.id });
    });

    it('should not throw when deleting non-existent session', async () => {
      await expect(sessionManager.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return true for existing session', async () => {
      const session = sessionManager.create('agent');
      await sessionManager.save(session);

      const exists = await sessionManager.exists(session.id);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      const exists = await sessionManager.exists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await sessionManager.save(
        sessionManager.create('agent', { name: 'Agent 1', tags: ['test'] })
      );
      await sessionManager.save(
        sessionManager.create('task-agent', { name: 'Task Agent 1' })
      );
      await sessionManager.save(
        sessionManager.create('agent', { name: 'Agent 2', tags: ['prod'] })
      );
    });

    it('should list all sessions', async () => {
      const sessions = await sessionManager.list();
      expect(sessions).toHaveLength(3);
    });

    it('should filter by agentType', async () => {
      const sessions = await sessionManager.list({ agentType: 'agent' });
      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.agentType === 'agent')).toBe(true);
    });

    it('should filter by tags', async () => {
      const sessions = await sessionManager.list({
        tags: ['test'],
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].metadata.name).toBe('Agent 1');
    });

    it('should sort by lastActiveAt descending', async () => {
      const sessions = await sessionManager.list();
      for (let i = 1; i < sessions.length; i++) {
        const prevTime = new Date(sessions[i - 1].lastActiveAt).getTime();
        const currTime = new Date(sessions[i].lastActiveAt).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });
  });

  describe('enableAutoSave', () => {
    it('should enable auto-save', async () => {
      const session = sessionManager.create('agent');
      session.custom = { counter: 0 };

      sessionManager.enableAutoSave(session, 100); // 100ms

      // Modify session
      session.custom.counter = 1;
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Check if saved
      const loaded = await storage.load(session.id);
      expect(loaded?.custom?.counter).toBe(1);

      sessionManager.stopAutoSave(session.id);
    });

    it('should emit session:saved event on auto-save', async () => {
      const listener = vi.fn();
      sessionManager.on('session:saved', listener);

      const session = sessionManager.create('agent');
      sessionManager.enableAutoSave(session, 100);

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(listener).toHaveBeenCalled();

      sessionManager.stopAutoSave(session.id);
    });
  });

  describe('stopAutoSave', () => {
    it('should disable auto-save', async () => {
      const session = sessionManager.create('agent');
      sessionManager.enableAutoSave(session, 100);
      sessionManager.stopAutoSave(session.id);

      // Modify after disabling
      session.custom = { test: true };
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not be saved
      const loaded = await storage.load(session.id);
      expect(loaded).toBeNull(); // Never saved
    });
  });

  describe('createEmptyHistory', () => {
    it('should create empty history', () => {
      const history = createEmptyHistory();
      expect(history.entries).toEqual([]);
      expect(history.version).toBe(1);
    });
  });

  describe('createEmptyMemory', () => {
    it('should create empty memory', () => {
      const memory = createEmptyMemory();
      expect(memory.entries).toEqual([]);
    });
  });

  describe('session modification', () => {
    it('should preserve custom data', async () => {
      const session = sessionManager.create('agent');
      session.custom = {
        userId: '123',
        preferences: { theme: 'dark' },
      };

      await sessionManager.save(session);
      const loaded = await sessionManager.load(session.id);

      expect(loaded?.custom).toEqual({
        userId: '123',
        preferences: { theme: 'dark' },
      });
    });

    it('should track metrics', async () => {
      const session = sessionManager.create('agent');

      session.metrics = {
        totalMessages: 10,
        totalToolCalls: 3,
        totalTokens: 5000,
        totalDurationMs: 1500,
      };

      await sessionManager.save(session);
      const loaded = await sessionManager.load(session.id);

      expect(loaded?.metrics?.totalMessages).toBe(10);
      expect(loaded?.metrics?.totalTokens).toBe(5000);
      expect(loaded?.metrics?.totalToolCalls).toBe(3);
    });

    it('should store conversation history', async () => {
      const session = sessionManager.create('agent');

      session.history.entries.push({
        type: 'user',
        content: { text: 'Hello' },
        timestamp: new Date().toISOString(),
      });
      session.history.entries.push({
        type: 'assistant',
        content: { text: 'Hi there!' },
        timestamp: new Date().toISOString(),
      });

      await sessionManager.save(session);
      const loaded = await sessionManager.load(session.id);

      expect(loaded?.history.entries).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle storage errors gracefully', async () => {
      const errorStorage = new InMemorySessionStorage();
      errorStorage.save = vi.fn().mockRejectedValue(new Error('Storage error'));

      const manager = new SessionManager({ storage: errorStorage });
      const session = manager.create('agent');

      await expect(manager.save(session)).rejects.toThrow('Storage error');
    });
  });

  describe('session validation', () => {
    it('should validate session on load by default', async () => {
      const session = sessionManager.create('agent');
      await sessionManager.save(session);

      const loaded = await sessionManager.load(session.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(session.id);
    });

    it('should emit warning for missing optional fields', async () => {
      const warningListener = vi.fn();
      sessionManager.on('session:warning', warningListener);

      // Create a minimal session directly in storage (bypassing validation)
      const minimalSession: Partial<Session> = {
        id: 'test-minimal',
        agentType: 'agent',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        history: { version: 1, entries: [] },
        toolState: { enabled: {}, namespaces: {}, priorities: {}, permissions: {} },
        // Missing: custom, metadata
      };
      await storage.save(minimalSession as Session);

      const loaded = await sessionManager.load('test-minimal');

      // Should have been migrated to add missing fields
      expect(loaded).not.toBeNull();
      expect(loaded?.custom).toEqual({});
      expect(loaded?.metadata).toEqual({});

      // Warning should have been emitted
      expect(warningListener).toHaveBeenCalled();
    });

    it('should emit migrated event when auto-migrating', async () => {
      const migratedListener = vi.fn();
      sessionManager.on('session:migrated', migratedListener);

      // Create session missing optional fields
      const incompleteSession: Partial<Session> = {
        id: 'test-migrate',
        agentType: 'agent',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        history: { version: 1, entries: [] },
        toolState: { enabled: {}, namespaces: {}, priorities: {}, permissions: {} },
      };
      await storage.save(incompleteSession as Session);

      await sessionManager.load('test-migrate');

      expect(migratedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-migrate',
          migrations: expect.any(Array),
        })
      );
    });

    it('should throw SessionValidationError for invalid session', async () => {
      // Save a completely invalid session directly to storage
      const invalidSession = {
        // Missing required fields: id, agentType
        someField: 'value',
      };
      await storage.save(invalidSession as Session);

      // Can't load without an id - test with corrupted data
      const corruptedSession: Partial<Session> = {
        id: 'corrupted',
        // Missing agentType - critical error
      };

      // Directly insert into storage
      (storage as any).sessions.set('corrupted', corruptedSession);

      await expect(sessionManager.load('corrupted')).rejects.toThrow('Session validation failed');
    });

    it('should skip validation when disabled', async () => {
      const managerNoValidation = new SessionManager({
        storage,
        validateOnLoad: false,
      });

      // Create session missing fields
      const incompleteSession = {
        id: 'test-no-validate',
        agentType: 'agent',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        // Missing: history, toolState, custom, metadata
      };

      (storage as any).sessions.set('test-no-validate', incompleteSession);

      // Should load without error (no validation)
      const loaded = await managerNoValidation.load('test-no-validate');
      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe('test-no-validate');
    });

    it('should reject sessions with incompatible version', async () => {
      const futureSession: Partial<Session> = {
        id: 'future-session',
        agentType: 'agent',
        createdAt: new Date(),
        lastActiveAt: new Date(),
        history: { version: 999, entries: [] }, // Future version
        toolState: { enabled: {}, namespaces: {}, priorities: {}, permissions: {} },
        custom: {},
        metadata: {},
      };

      (storage as any).sessions.set('future-session', futureSession);

      await expect(sessionManager.load('future-session')).rejects.toThrow(
        'History version 999 is newer than supported version'
      );
    });
  });
});
