import { describe, it, expect } from 'vitest';
import {
  createRoutineExecutionRecord,
  createTaskSnapshots,
} from '../../../src/domain/entities/RoutineExecutionRecord.js';
import { createRoutineDefinition } from '../../../src/domain/entities/Routine.js';

describe('RoutineExecutionRecord', () => {
  const definition = createRoutineDefinition({
    name: 'Test Routine',
    description: 'A test routine',
    tasks: [
      { name: 'task-1', description: 'First task' },
      { name: 'task-2', description: 'Second task', dependsOn: ['task-1'], maxAttempts: 5 },
      {
        name: 'task-3',
        description: 'Control flow task',
        controlFlow: { type: 'map', source: 'items', taskTemplate: { name: 'sub', description: 'sub task' } },
      },
    ],
  });

  describe('createTaskSnapshots', () => {
    it('creates snapshots from definition tasks', () => {
      const snapshots = createTaskSnapshots(definition);

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]!.name).toBe('task-1');
      expect(snapshots[0]!.status).toBe('pending');
      expect(snapshots[0]!.attempts).toBe(0);
      expect(snapshots[0]!.maxAttempts).toBe(3); // default
    });

    it('preserves maxAttempts from task input', () => {
      const snapshots = createTaskSnapshots(definition);
      expect(snapshots[1]!.maxAttempts).toBe(5);
    });

    it('captures controlFlowType', () => {
      const snapshots = createTaskSnapshots(definition);
      expect(snapshots[2]!.controlFlowType).toBe('map');
    });
  });

  describe('createRoutineExecutionRecord', () => {
    it('creates a record with running status', () => {
      const record = createRoutineExecutionRecord(definition, 'openai', 'gpt-4');

      expect(record.executionId).toMatch(/^rexec-/);
      expect(record.routineId).toBe(definition.id);
      expect(record.routineName).toBe('Test Routine');
      expect(record.status).toBe('running');
      expect(record.progress).toBe(0);
      expect(record.tasks).toHaveLength(3);
      expect(record.steps).toHaveLength(0);
      expect(record.taskCount).toBe(3);
      expect(record.connectorName).toBe('openai');
      expect(record.model).toBe('gpt-4');
      expect(record.startedAt).toBeTypeOf('number');
      expect(record.lastActivityAt).toBeTypeOf('number');
    });

    it('defaults trigger to manual', () => {
      const record = createRoutineExecutionRecord(definition, 'openai', 'gpt-4');
      expect(record.trigger).toEqual({ type: 'manual' });
    });

    it('accepts custom trigger', () => {
      const trigger = { type: 'schedule' as const, source: 'daily-cron' };
      const record = createRoutineExecutionRecord(definition, 'openai', 'gpt-4', trigger);
      expect(record.trigger).toEqual(trigger);
    });
  });
});
