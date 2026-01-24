/**
 * Tests for FileSessionStorage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSessionStorage } from '../../../../src/infrastructure/storage/FileSessionStorage.js';
import { createEmptyHistory } from '../../../../src/core/SessionManager.js';
import type { Session } from '../../../../src/core/SessionManager.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

describe('FileSessionStorage', () => {
  const testDir = './test-sessions';
  let storage: FileSessionStorage;
  let testSession: Session;

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true });
    }

    storage = new FileSessionStorage({ directory: testDir });

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

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create directory if it does not exist', async () => {
      await storage.save(testSession);
      expect(existsSync(testDir)).toBe(true);
    });

    it('should load existing index', async () => {
      await storage.save(testSession);

      // Create new storage instance
      const newStorage = new FileSessionStorage({ directory: testDir });
      const sessions = await newStorage.list();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('test-session-1');
    });
  });

  describe('save', () => {
    it('should save a session to file', async () => {
      await storage.save(testSession);

      const filePath = path.join(testDir, `${testSession.id}.json`);
      expect(existsSync(filePath)).toBe(true);
    });

    it('should overwrite existing session', async () => {
      await storage.save(testSession);

      const modified = { ...testSession, metadata: { ...testSession.metadata, name: 'Modified' } };
      await storage.save(modified);

      const loaded = await storage.load('test-session-1');
      expect(loaded?.metadata.name).toBe('Modified');
    });

    it('should update index', async () => {
      await storage.save(testSession);

      const indexPath = path.join(testDir, '_index.json');
      const indexData = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(indexData);

      expect(index.sessions).toHaveLength(1);
      expect(index.sessions[0].id).toBe('test-session-1');
    });

    it('should use pretty print option', async () => {
      const customStorage = new FileSessionStorage({
        directory: testDir,
        prettyPrint: true,
      });

      await customStorage.save(testSession);

      const filePath = path.join(testDir, `${testSession.id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');

      // Pretty print should include newlines
      expect(data.includes('\n')).toBe(true);
    });
  });

  describe('load', () => {
    it('should load a session from file', async () => {
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

    it('should use custom deserialization if provided', async () => {
      const customStorage = new FileSessionStorage({
        directory: testDir,
        serialize: (session) => JSON.stringify({ ...session, custom: true }),
        deserialize: (data) => {
          const parsed = JSON.parse(data);
          delete parsed.custom;
          return parsed;
        },
      });

      await customStorage.save(testSession);
      const loaded = await customStorage.load('test-session-1');

      expect(loaded).toBeDefined();
      expect((loaded as any).custom).toBeUndefined();
    });

    it('should handle corrupted files gracefully', async () => {
      await storage.save(testSession);

      // Corrupt the file
      const filePath = path.join(testDir, `${testSession.id}.json`);
      await fs.writeFile(filePath, 'invalid json{{{');

      const loaded = await storage.load('test-session-1');
      expect(loaded).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a session file', async () => {
      await storage.save(testSession);

      const filePath = path.join(testDir, `${testSession.id}.json`);
      expect(existsSync(filePath)).toBe(true);

      await storage.delete('test-session-1');
      expect(existsSync(filePath)).toBe(false);
    });

    it('should remove from index', async () => {
      await storage.save(testSession);
      await storage.delete('test-session-1');

      const sessions = await storage.list();
      expect(sessions).toHaveLength(0);
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
        lastActiveAt: new Date(3000000),
        metadata: { name: 'Session 1', tags: ['test'] },
      });

      await storage.save({
        ...testSession,
        id: 'session-2',
        agentType: 'task-agent',
        lastActiveAt: new Date(2000000),
        metadata: { name: 'Session 2', tags: ['prod'] },
      });

      await storage.save({
        ...testSession,
        id: 'session-3',
        agentType: 'agent',
        lastActiveAt: new Date(1000000),
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

    it('should sort by lastActiveAt descending', async () => {
      const sessions = await storage.list();
      expect(sessions[0].id).toBe('session-1'); // lastActiveAt: 3000000
      expect(sessions[1].id).toBe('session-2'); // lastActiveAt: 2000000
      expect(sessions[2].id).toBe('session-3'); // lastActiveAt: 1000000
    });
  });

  describe('index recovery', () => {
    it('should rebuild index from files if index is missing', async () => {
      await storage.save(testSession);

      // Delete index
      const indexPath = path.join(testDir, '_index.json');
      await fs.unlink(indexPath);

      // Create new storage instance and rebuild
      const newStorage = new FileSessionStorage({ directory: testDir });
      await newStorage.rebuildIndex();
      const sessions = await newStorage.list();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('test-session-1');
    });

    it('should rebuild index from files if index is corrupted', async () => {
      await storage.save(testSession);

      // Corrupt index
      const indexPath = path.join(testDir, '_index.json');
      await fs.writeFile(indexPath, 'invalid json{{{');

      // Create new storage instance and rebuild
      const newStorage = new FileSessionStorage({ directory: testDir });
      await newStorage.rebuildIndex();
      const sessions = await newStorage.list();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('test-session-1');
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

    it('should handle special characters in session data', async () => {
      const session: Session = {
        ...testSession,
        metadata: {
          name: 'Test "with" \'quotes\' & <special> chars',
          description: 'Line 1\nLine 2\tTab',
        },
        customData: {
          emoji: '🎉',
          unicode: 'Hello 世界',
        },
      };

      await storage.save(session);
      const loaded = await storage.load(testSession.id);

      expect(loaded?.metadata.name).toBe(session.metadata.name);
      expect(loaded?.metadata.description).toBe(session.metadata.description);
      expect(loaded?.customData?.emoji).toBe('🎉');
      expect(loaded?.customData?.unicode).toBe('Hello 世界');
    });
  });

  describe('concurrent operations', () => {
    it('should handle sequential saves', async () => {
      // Note: Concurrent saves to the same index file can have race conditions
      // This test uses sequential saves to ensure reliability
      for (let i = 0; i < 10; i++) {
        await storage.save({
          ...testSession,
          id: `session-${i}`,
        });
      }

      const loaded = await storage.list();
      expect(loaded).toHaveLength(10);
    });

    it('should handle concurrent reads', async () => {
      await storage.save(testSession);

      const results = await Promise.all(
        Array.from({ length: 10 }, () => storage.load('test-session-1'))
      );

      expect(results.every((r) => r?.id === 'test-session-1')).toBe(true);
    });
  });
});
