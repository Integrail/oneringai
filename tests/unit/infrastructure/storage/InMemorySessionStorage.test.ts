/**
 * Tests for InMemorySessionStorage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemorySessionStorage } from '../../../../src/infrastructure/storage/InMemorySessionStorage.js';
import { createEmptyHistory } from '../../../../src/core/SessionManager.js';
import type { Session } from '../../../../src/core/SessionManager.js';

describe('InMemorySessionStorage', () => {
  let storage: InMemorySessionStorage;
  let testSession: Session;

  beforeEach(() => {
    storage = new InMemorySessionStorage();

    testSession = {
      id: 'test-session-1',
      agentType: 'agent',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {
        name: 'Test Session',
        tags: ['test'],
      },
      history: createEmptyHistory(),
      toolState: { enabled: {}, namespaces: {}, priorities: {} },
      metrics: {
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
        toolCallCount: 0,
      },
    };
  });

  describe('save', () => {
    it('should save a session', async () => {
      await storage.save(testSession);

      const loaded = await storage.load('test-session-1');
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('test-session-1');
    });

    it('should overwrite existing session', async () => {
      await storage.save(testSession);

      const modified = { ...testSession, metadata: { ...testSession.metadata, name: 'Modified' } };
      await storage.save(modified);

      const loaded = await storage.load('test-session-1');
      expect(loaded?.metadata.name).toBe('Modified');
    });

    it('should deep clone session data', async () => {
      await storage.save(testSession);

      // Modify original
      testSession.metadata.name = 'Changed';

      const loaded = await storage.load('test-session-1');
      expect(loaded?.metadata.name).toBe('Test Session'); // Not changed
    });
  });

  describe('load', () => {
    it('should load a session', async () => {
      await storage.save(testSession);

      const loaded = await storage.load('test-session-1');
      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe('test-session-1');
      expect(loaded?.metadata.name).toBe('Test Session');
    });

    it('should return null for non-existent session', async () => {
      const loaded = await storage.load('non-existent');
      expect(loaded).toBeNull();
    });

    it('should return deep clone', async () => {
      await storage.save(testSession);

      const loaded = await storage.load('test-session-1');
      expect(loaded).not.toBe(testSession);
      expect(loaded?.metadata).not.toBe(testSession.metadata);
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      await storage.save(testSession);
      expect(await storage.exists('test-session-1')).toBe(true);

      await storage.delete('test-session-1');
      expect(await storage.exists('test-session-1')).toBe(false);
    });

    it('should not throw when deleting non-existent session', async () => {
      await expect(storage.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should return true for existing session', async () => {
      await storage.save(testSession);
      expect(await storage.exists('test-session-1')).toBe(true);
    });

    it('should return false for non-existent session', async () => {
      expect(await storage.exists('non-existent')).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await storage.save({
        ...testSession,
        id: 'session-1',
        agentType: 'agent',
        metadata: { name: 'Session 1', tags: ['test'] },
      });

      await storage.save({
        ...testSession,
        id: 'session-2',
        agentType: 'task-agent',
        metadata: { name: 'Session 2', tags: ['prod'] },
      });

      await storage.save({
        ...testSession,
        id: 'session-3',
        agentType: 'agent',
        metadata: { name: 'Session 3', tags: ['test'] },
      });
    });

    it('should list all sessions', async () => {
      const sessions = await storage.list();
      expect(sessions).toHaveLength(3);
    });

    it('should filter by agentType', async () => {
      const sessions = await storage.list({ agentType: 'agent' });
      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.agentType === 'agent')).toBe(true);
    });

    it('should filter by tags', async () => {
      const sessions = await storage.list({
        tags: ['test'],
      });
      expect(sessions).toHaveLength(2);
    });

    it('should combine multiple filters', async () => {
      const sessions = await storage.list({
        agentType: 'agent',
        metadata: { tags: ['test'] },
      });
      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.agentType === 'agent')).toBe(true);
    });

    it('should sort by lastActiveAt descending', async () => {
      const sessions = await storage.list();
      for (let i = 1; i < sessions.length; i++) {
        const prevTime = new Date(sessions[i - 1].lastActiveAt).getTime();
        const currTime = new Date(sessions[i].lastActiveAt).getTime();
        expect(prevTime).toBeGreaterThanOrEqual(currTime);
      }
    });
  });

  describe('data integrity', () => {
    it('should preserve all session fields', async () => {
      const complexSession: Session = {
        id: 'complex-1',
        agentType: 'universal-agent',
        createdAt: new Date(1000000),
        lastActiveAt: new Date(2000000),
        metadata: {
          name: 'Complex Session',
          description: 'Test description',
          tags: ['tag1', 'tag2'],
          custom: { key: 'value' },
        },
        history: {
          version: 1,
          entries: [
            {
              type: 'user',
              content: { text: 'Hello' },
              timestamp: new Date(1500000).toISOString(),
            },
          ],
        },
        toolState: { enabled: {}, namespaces: {}, priorities: {} },
        memory: {
          version: 1,
          entries: [
            {
              key: 'test',
              value: { data: 123 },
              scope: 'global',
              createdAt: new Date(1600000).toISOString(),
            },
          ],
        },
        plan: {
          version: 1,
          id: 'plan-1',
          goal: 'Test goal',
          tasks: [],
          status: 'pending',
          createdAt: new Date(1700000).toISOString(),
          lastUpdatedAt: new Date(1700000).toISOString(),
        },
        metrics: {
          totalMessages: 1,
          totalTokens: 100,
          totalCost: 0.01,
          toolCallCount: 0,
        },
        customData: {
          userId: '123',
          preferences: { theme: 'dark' },
        },
      };

      await storage.save(complexSession);
      const loaded = await storage.load('complex-1');

      expect(loaded).toBeDefined();
      expect(loaded?.id).toBe(complexSession.id);
      expect(loaded?.agentType).toBe(complexSession.agentType);
      expect(loaded?.metadata).toEqual(complexSession.metadata);
      expect(loaded?.history).toEqual(complexSession.history);
      expect(loaded?.memory).toEqual(complexSession.memory);
      expect(loaded?.plan).toEqual(complexSession.plan);
      expect(loaded?.metrics).toEqual(complexSession.metrics);
      expect(loaded?.customData).toEqual(complexSession.customData);
    });
  });

  describe('clear', () => {
    it('should clear all sessions', async () => {
      await storage.save(testSession);
      await storage.save({ ...testSession, id: 'session-2' });

      expect((await storage.list()).length).toBe(2);

      await storage.clear();
      expect((await storage.list()).length).toBe(0);
    });
  });
});
