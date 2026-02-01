/**
 * Tests for FileContextStorage and AgentContext session persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AgentContext } from '../../../src/core/AgentContext.js';
import {
  FileContextStorage,
  createFileContextStorage,
} from '../../../src/infrastructure/storage/FileContextStorage.js';
import type { ContextSessionMetadata } from '../../../src/domain/interfaces/IContextStorage.js';

describe('FileContextStorage', () => {
  let storage: FileContextStorage;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `filecontextstorage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileContextStorage({
      agentId: 'test-agent',
      baseDirectory: testDir,
      prettyPrint: true,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Basic Operations', () => {
    it('should save and load a session', async () => {
      const ctx = AgentContext.create({
        model: 'gpt-4',
        features: { memory: true, history: true },
      });

      // Add some state
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi there!');
      await ctx.memory!.store('key1', 'Test key', { value: 123 });

      const state = await ctx.getState();

      // Save
      await storage.save('session-001', state, { title: 'Test Session' });

      // Load
      const loaded = await storage.load('session-001');

      expect(loaded).not.toBeNull();
      expect(loaded!.sessionId).toBe('session-001');
      expect(loaded!.metadata.title).toBe('Test Session');
      // v2 format uses conversation instead of history
      expect(loaded!.state.core.conversation).toHaveLength(2);
      expect(loaded!.state.memory?.entries).toHaveLength(1);

      ctx.destroy();
    });

    it('should return null for non-existent session', async () => {
      const loaded = await storage.load('non-existent');
      expect(loaded).toBeNull();
    });

    it('should check if session exists', async () => {
      const ctx = AgentContext.create({ model: 'gpt-4' });
      const state = await ctx.getState();

      expect(await storage.exists('session-002')).toBe(false);

      await storage.save('session-002', state);

      expect(await storage.exists('session-002')).toBe(true);

      ctx.destroy();
    });

    it('should delete a session', async () => {
      const ctx = AgentContext.create({ model: 'gpt-4' });
      const state = await ctx.getState();

      await storage.save('session-003', state);
      expect(await storage.exists('session-003')).toBe(true);

      await storage.delete('session-003');
      expect(await storage.exists('session-003')).toBe(false);

      ctx.destroy();
    });

    it('should list sessions', async () => {
      const ctx = AgentContext.create({ model: 'gpt-4' });
      const state = await ctx.getState();

      await storage.save('session-a', state, { title: 'Session A', tags: ['test'] });
      await storage.save('session-b', state, { title: 'Session B', tags: ['test', 'important'] });
      await storage.save('session-c', state, { title: 'Session C' });

      const all = await storage.list();
      expect(all).toHaveLength(3);

      // Filter by tags
      const tagged = await storage.list({ tags: ['important'] });
      expect(tagged).toHaveLength(1);
      expect(tagged[0].metadata?.title).toBe('Session B');

      // Pagination
      const limited = await storage.list({ limit: 2 });
      expect(limited).toHaveLength(2);

      ctx.destroy();
    });

    it('should update metadata', async () => {
      const ctx = AgentContext.create({ model: 'gpt-4' });
      const state = await ctx.getState();

      await storage.save('session-004', state, { title: 'Original' });

      await storage.updateMetadata!('session-004', { title: 'Updated', tags: ['new-tag'] });

      const loaded = await storage.load('session-004');
      expect(loaded!.metadata.title).toBe('Updated');
      expect(loaded!.metadata.tags).toEqual(['new-tag']);

      ctx.destroy();
    });

    it('should preserve createdAt on update', async () => {
      const ctx = AgentContext.create({ model: 'gpt-4' });
      const state = await ctx.getState();

      await storage.save('session-005', state);
      const first = await storage.load('session-005');

      // Wait a bit and save again
      await new Promise(resolve => setTimeout(resolve, 10));
      await storage.save('session-005', state, { title: 'Updated' });
      const second = await storage.load('session-005');

      expect(second!.createdAt).toBe(first!.createdAt);
      expect(new Date(second!.lastSavedAt).getTime()).toBeGreaterThan(
        new Date(first!.lastSavedAt).getTime()
      );

      ctx.destroy();
    });
  });

  describe('createFileContextStorage helper', () => {
    it('should create storage with defaults', () => {
      const storage = createFileContextStorage('my-agent');
      expect(storage).toBeInstanceOf(FileContextStorage);
      expect(storage.getAgentId()).toBe('my-agent');
    });
  });
});

describe('AgentContext Session Persistence', () => {
  let storage: FileContextStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agentcontext-persistence-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileContextStorage({
      agentId: 'test-agent',
      baseDirectory: testDir,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('save() and load() methods', () => {
    it('should save and load session via AgentContext', async () => {
      const ctx = AgentContext.create({
        model: 'gpt-4',
        features: { memory: true, history: true },
        storage,
      });

      // Add state
      ctx.addMessageSync('user', 'What is 2+2?');
      ctx.addMessageSync('assistant', '2+2 equals 4.');
      await ctx.memory!.store('math_result', 'Math calculation', { result: 4 });

      // Save
      await ctx.save('math-session', { title: 'Math Help' });

      // Verify sessionId is set
      expect(ctx.sessionId).toBe('math-session');

      ctx.destroy();

      // Create new context and load
      const ctx2 = AgentContext.create({
        model: 'gpt-4',
        features: { memory: true, history: true },
        storage,
      });

      const loaded = await ctx2.load('math-session');
      expect(loaded).toBe(true);
      expect(ctx2.sessionId).toBe('math-session');

      // Verify state was restored
      // getHistory() now returns InputItem[] where content is Content[]
      const history = ctx2.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');

      const mathResult = await ctx2.memory!.retrieve('math_result');
      expect(mathResult).toEqual({ result: 4 });

      ctx2.destroy();
    });

    it('should throw error when saving without storage', async () => {
      const ctx = AgentContext.create({ model: 'gpt-4' });

      await expect(ctx.save('session')).rejects.toThrow('No storage configured');

      ctx.destroy();
    });

    it('should throw error when loading without storage', async () => {
      const ctx = AgentContext.create({ model: 'gpt-4' });

      await expect(ctx.load('session')).rejects.toThrow('No storage configured');

      ctx.destroy();
    });

    it('should return false when loading non-existent session', async () => {
      const ctx = AgentContext.create({
        model: 'gpt-4',
        storage,
      });

      const loaded = await ctx.load('non-existent');
      expect(loaded).toBe(false);
      expect(ctx.sessionId).toBeNull();

      ctx.destroy();
    });

    it('should save to current session without sessionId', async () => {
      const ctx = AgentContext.create({
        model: 'gpt-4',
        storage,
      });

      // First save with sessionId
      await ctx.save('my-session');
      ctx.addMessageSync('user', 'New message');

      // Save without sessionId should use current
      await ctx.save();

      const loaded = await storage.load('my-session');
      // v2 format uses conversation instead of history
      expect(loaded!.state.core.conversation).toHaveLength(1);

      ctx.destroy();
    });
  });

  describe('sessionExists() and deleteSession()', () => {
    it('should check and delete sessions', async () => {
      const ctx = AgentContext.create({
        model: 'gpt-4',
        storage,
      });

      await ctx.save('temp-session');
      expect(await ctx.sessionExists('temp-session')).toBe(true);

      await ctx.deleteSession('temp-session');
      expect(await ctx.sessionExists('temp-session')).toBe(false);

      // sessionId should be cleared if we deleted current session
      expect(ctx.sessionId).toBeNull();

      ctx.destroy();
    });
  });

  describe('Full persistence round-trip', () => {
    it('should preserve all context state through save/load cycle', async () => {
      // Create context with all features
      const ctx = AgentContext.create({
        agentId: 'full-test-agent',
        model: 'gpt-4',
        systemPrompt: 'You are a helpful assistant.',
        instructions: 'Be concise.',
        features: {
          memory: true,
          history: true,
          permissions: true,
          inContextMemory: true,
        },
        storage,
      });

      // Add comprehensive state
      ctx.addMessageSync('user', 'Hello');
      ctx.addMessageSync('assistant', 'Hi! How can I help?');
      ctx.addMessageSync('user', 'Tell me about TypeScript');
      ctx.addMessageSync('assistant', 'TypeScript is a typed superset of JavaScript.');

      await ctx.memory!.store('topic', 'Current topic', 'TypeScript');
      await ctx.memory!.store('user_level', 'User expertise', 'intermediate');

      ctx.inContextMemory!.set('state', 'Current state', { phase: 'learning' });

      // Save
      await ctx.save('full-state-session', {
        title: 'TypeScript Learning',
        tags: ['education', 'programming'],
        description: 'User learning about TypeScript',
      });

      ctx.destroy();

      // Create new context and restore
      const ctx2 = AgentContext.create({
        agentId: 'full-test-agent',
        model: 'gpt-4',
        features: {
          memory: true,
          history: true,
          permissions: true,
          inContextMemory: true,
        },
        storage,
      });

      await ctx2.load('full-state-session');

      // Verify everything was restored
      expect(ctx2.getHistory()).toHaveLength(4);
      expect(await ctx2.memory!.retrieve('topic')).toBe('TypeScript');
      expect(await ctx2.memory!.retrieve('user_level')).toBe('intermediate');

      // System prompt and instructions
      expect(ctx2.systemPrompt).toBe('You are a helpful assistant.');
      // Note: instructions are stored but may need explicit restore handling

      ctx2.destroy();
    });
  });
});
