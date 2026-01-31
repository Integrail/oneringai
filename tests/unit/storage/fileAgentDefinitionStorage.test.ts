/**
 * Tests for FileAgentDefinitionStorage and Agent definition persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  FileAgentDefinitionStorage,
  createFileAgentDefinitionStorage,
} from '../../../src/infrastructure/storage/FileAgentDefinitionStorage.js';
import type {
  StoredAgentDefinition,
  AgentDefinitionMetadata,
} from '../../../src/domain/interfaces/IAgentDefinitionStorage.js';
import { AGENT_DEFINITION_FORMAT_VERSION } from '../../../src/domain/interfaces/IAgentDefinitionStorage.js';

describe('FileAgentDefinitionStorage', () => {
  let storage: FileAgentDefinitionStorage;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fileagentdef-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    storage = new FileAgentDefinitionStorage({
      baseDirectory: testDir,
      prettyPrint: true,
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createTestDefinition = (agentId: string, overrides?: Partial<StoredAgentDefinition>): StoredAgentDefinition => ({
    version: AGENT_DEFINITION_FORMAT_VERSION,
    agentId,
    name: `Test Agent ${agentId}`,
    agentType: 'agent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    connector: {
      name: 'openai',
      model: 'gpt-4',
    },
    systemPrompt: 'You are a helpful assistant.',
    instructions: 'Be concise and accurate.',
    features: {
      memory: true,
      history: true,
    },
    metadata: {
      description: 'A test agent',
      tags: ['test'],
    },
    ...overrides,
  });

  describe('Basic Operations', () => {
    it('should save and load an agent definition', async () => {
      const definition = createTestDefinition('my-agent');

      await storage.save(definition);

      const loaded = await storage.load('my-agent');

      expect(loaded).not.toBeNull();
      expect(loaded!.agentId).toBe('my-agent');
      expect(loaded!.name).toBe('Test Agent my-agent');
      expect(loaded!.connector.model).toBe('gpt-4');
      expect(loaded!.systemPrompt).toBe('You are a helpful assistant.');
      expect(loaded!.features?.memory).toBe(true);
    });

    it('should return null for non-existent agent', async () => {
      const loaded = await storage.load('non-existent');
      expect(loaded).toBeNull();
    });

    it('should check if agent exists', async () => {
      expect(await storage.exists('test-agent')).toBe(false);

      await storage.save(createTestDefinition('test-agent'));

      expect(await storage.exists('test-agent')).toBe(true);
    });

    it('should delete an agent definition', async () => {
      await storage.save(createTestDefinition('to-delete'));
      expect(await storage.exists('to-delete')).toBe(true);

      await storage.delete('to-delete');
      expect(await storage.exists('to-delete')).toBe(false);
    });

    it('should list all agent definitions', async () => {
      await storage.save(createTestDefinition('agent-1', {
        agentType: 'agent',
        metadata: { tags: ['general'] }
      }));
      await storage.save(createTestDefinition('agent-2', {
        agentType: 'task-agent',
        metadata: { tags: ['task', 'important'] }
      }));
      await storage.save(createTestDefinition('agent-3', {
        agentType: 'agent',
        metadata: { tags: ['general', 'important'] }
      }));

      const all = await storage.list();
      expect(all).toHaveLength(3);

      // Filter by agent type
      const taskAgents = await storage.list({ agentType: 'task-agent' });
      expect(taskAgents).toHaveLength(1);
      expect(taskAgents[0].agentId).toBe('agent-2');

      // Filter by tags
      const important = await storage.list({ tags: ['important'] });
      expect(important).toHaveLength(2);

      // Pagination
      const limited = await storage.list({ limit: 2 });
      expect(limited).toHaveLength(2);
    });

    it('should update metadata', async () => {
      await storage.save(createTestDefinition('meta-test', {
        metadata: { description: 'Original' }
      }));

      await storage.updateMetadata!('meta-test', {
        description: 'Updated',
        author: 'Test Author',
      });

      const loaded = await storage.load('meta-test');
      expect(loaded!.metadata?.description).toBe('Updated');
      expect(loaded!.metadata?.author).toBe('Test Author');
    });

    it('should preserve createdAt on update', async () => {
      const definition = createTestDefinition('preserve-test');
      await storage.save(definition);

      const first = await storage.load('preserve-test');

      // Wait and update
      await new Promise(resolve => setTimeout(resolve, 10));
      definition.name = 'Updated Name';
      await storage.save(definition);

      const second = await storage.load('preserve-test');

      expect(second!.createdAt).toBe(first!.createdAt);
      expect(new Date(second!.updatedAt).getTime()).toBeGreaterThan(
        new Date(first!.updatedAt).getTime()
      );
    });

    it('should sanitize agent IDs for filesystem safety', async () => {
      const definition = createTestDefinition('my agent/with:special*chars');
      await storage.save(definition);

      // Should be able to load by original ID
      const loaded = await storage.load('my agent/with:special*chars');
      expect(loaded).not.toBeNull();
      expect(loaded!.agentId).toBe('my agent/with:special*chars');
    });
  });

  describe('createFileAgentDefinitionStorage helper', () => {
    it('should create storage with defaults', () => {
      const storage = createFileAgentDefinitionStorage();
      expect(storage).toBeInstanceOf(FileAgentDefinitionStorage);
      // Should use default path
      expect(storage.getPath()).toContain('oneringai');
    });

    it('should accept custom base directory', () => {
      const customDir = join(testDir, 'custom');
      const storage = createFileAgentDefinitionStorage({ baseDirectory: customDir });
      expect(storage.getPath()).toBe(customDir);
    });
  });

  describe('Index rebuilding', () => {
    it('should rebuild index from files', async () => {
      // Save some definitions
      await storage.save(createTestDefinition('rebuild-1'));
      await storage.save(createTestDefinition('rebuild-2'));

      // Force rebuild
      await storage.rebuildIndex();

      // Should still list correctly
      const all = await storage.list();
      expect(all).toHaveLength(2);
    });
  });
});
