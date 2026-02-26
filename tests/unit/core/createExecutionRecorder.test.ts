import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecutionRecorder } from '../../../src/core/createExecutionRecorder.js';
import type { IRoutineExecutionStorage } from '../../../src/domain/interfaces/IRoutineExecutionStorage.js';
import type { Task } from '../../../src/domain/entities/Task.js';
import type { RoutineExecution } from '../../../src/domain/entities/Routine.js';
import { ToolCallState } from '../../../src/domain/entities/Tool.js';

function createMockStorage(): IRoutineExecutionStorage {
  return {
    insert: vi.fn().mockResolvedValue('exec-123'),
    update: vi.fn().mockResolvedValue(undefined),
    pushStep: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    hasRunning: vi.fn().mockResolvedValue(false),
  };
}

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    name: 'Test Task',
    description: 'A test task',
    status: 'pending',
    dependsOn: [],
    attempts: 0,
    maxAttempts: 3,
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
    ...overrides,
  } as Task;
}

function createMockExecution(overrides: Partial<RoutineExecution> = {}): RoutineExecution {
  return {
    id: 'rexec-1',
    routineId: 'routine-1',
    plan: { id: 'plan-1', goal: 'test', tasks: [], status: 'running', createdAt: Date.now(), lastUpdatedAt: Date.now() },
    status: 'running',
    progress: 0,
    lastUpdatedAt: Date.now(),
    ...overrides,
  } as RoutineExecution;
}

describe('createExecutionRecorder', () => {
  let storage: IRoutineExecutionStorage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('creates a recorder with hooks and callbacks', () => {
    const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });

    expect(recorder.hooks).toBeDefined();
    expect(recorder.hooks['before:llm']).toBeTypeOf('function');
    expect(recorder.hooks['after:llm']).toBeTypeOf('function');
    expect(recorder.hooks['before:tool']).toBeTypeOf('function');
    expect(recorder.hooks['after:tool']).toBeTypeOf('function');
    expect(recorder.hooks['after:execution']).toBeTypeOf('function');
    expect(recorder.hooks['pause:check']).toBeTypeOf('function');
    expect(recorder.onTaskStarted).toBeTypeOf('function');
    expect(recorder.onTaskComplete).toBeTypeOf('function');
    expect(recorder.onTaskFailed).toBeTypeOf('function');
    expect(recorder.onTaskValidation).toBeTypeOf('function');
    expect(recorder.finalize).toBeTypeOf('function');
  });

  describe('onTaskStarted', () => {
    it('updates task status and pushes step', () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });
      const task = createMockTask({ name: 'My Task', attempts: 1 });
      const execution = createMockExecution({ progress: 25 });

      recorder.onTaskStarted(task, execution);

      expect(storage.updateTask).toHaveBeenCalledWith(
        'exec-1',
        'My Task',
        expect.objectContaining({ status: 'in_progress' }),
      );
      expect(storage.pushStep).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({ type: 'task.started', taskName: 'My Task' }),
      );
    });

    it('pushes control_flow.started for control flow tasks', () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });
      const task = createMockTask({
        controlFlow: { type: 'map', source: 'items', taskTemplate: { name: 'sub', description: 'sub' } },
      });
      const execution = createMockExecution();

      recorder.onTaskStarted(task, execution);

      const pushStepCalls = (storage.pushStep as ReturnType<typeof vi.fn>).mock.calls;
      const cfStep = pushStepCalls.find(([, step]: any) => step.type === 'control_flow.started');
      expect(cfStep).toBeDefined();
    });
  });

  describe('onTaskComplete', () => {
    it('updates task to completed', () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });
      const task = createMockTask({
        name: 'Done Task',
        result: { success: true, output: 'result text', validationScore: 95 },
      });
      const execution = createMockExecution({ progress: 100 });

      recorder.onTaskComplete(task, execution);

      expect(storage.updateTask).toHaveBeenCalledWith(
        'exec-1',
        'Done Task',
        expect.objectContaining({ status: 'completed' }),
      );
      expect(storage.pushStep).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({ type: 'task.completed' }),
      );
    });
  });

  describe('onTaskFailed', () => {
    it('updates task to failed', () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });
      const task = createMockTask({
        name: 'Bad Task',
        result: { success: false, error: 'something broke' },
      });
      const execution = createMockExecution();

      recorder.onTaskFailed(task, execution);

      expect(storage.updateTask).toHaveBeenCalledWith(
        'exec-1',
        'Bad Task',
        expect.objectContaining({ status: 'failed' }),
      );
      expect(storage.pushStep).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({ type: 'task.failed' }),
      );
    });
  });

  describe('onTaskValidation', () => {
    it('pushes validation step', () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });
      const task = createMockTask();

      recorder.onTaskValidation(task, {
        isComplete: true,
        completionScore: 85,
        explanation: 'Looks good',
        requiresUserApproval: false,
      }, createMockExecution());

      expect(storage.pushStep).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({
          type: 'task.validation',
          data: expect.objectContaining({ isComplete: true, completionScore: 85 }),
        }),
      );
    });
  });

  describe('hooks', () => {
    it('before:tool pushes tool.start step', () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });

      // Trigger onTaskStarted to set currentTaskName
      recorder.onTaskStarted(createMockTask({ name: 'Active' }), createMockExecution());

      // Call before:tool hook
      const ctx = {
        executionId: 'e1',
        iteration: 1,
        toolCall: {
          id: 'tc-1',
          type: 'function' as const,
          function: { name: 'read_file', arguments: '{"path": "/foo"}' },
          blocking: true,
          state: ToolCallState.PENDING,
        },
        context: {} as any,
        timestamp: new Date(),
      };
      recorder.hooks['before:tool']!(ctx);

      const pushStepCalls = (storage.pushStep as ReturnType<typeof vi.fn>).mock.calls;
      const toolStep = pushStepCalls.find(([, step]: any) => step.type === 'tool.start');
      expect(toolStep).toBeDefined();
      expect(toolStep![1].data.toolName).toBe('read_file');
    });
  });

  describe('finalize', () => {
    it('writes completed status on success', async () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });
      const execution = createMockExecution({ status: 'completed', progress: 100, completedAt: Date.now() });

      await recorder.finalize(execution);

      expect(storage.update).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({ status: 'completed', progress: 100 }),
      );
    });

    it('writes failed status on error', async () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });

      await recorder.finalize(null, new Error('Kaboom'));

      expect(storage.update).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({ status: 'failed', error: 'Kaboom' }),
      );
      expect(storage.pushStep).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({ type: 'execution.error' }),
      );
    });

    it('writes failed when execution is null without error', async () => {
      const recorder = createExecutionRecorder({ storage, executionId: 'exec-1' });

      await recorder.finalize(null);

      expect(storage.update).toHaveBeenCalledWith(
        'exec-1',
        expect.objectContaining({ status: 'failed', error: 'Unknown error' }),
      );
    });
  });
});
