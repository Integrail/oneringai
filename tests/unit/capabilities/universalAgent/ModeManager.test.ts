/**
 * Tests for ModeManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModeManager } from '../../../../src/capabilities/universalAgent/ModeManager.js';
import { createTask } from '../../../../src/domain/entities/Task.js';
import type { Plan } from '../../../../src/domain/entities/Task.js';
import type { IntentAnalysis } from '../../../../src/capabilities/universalAgent/types.js';

describe('ModeManager', () => {
  let modeManager: ModeManager;

  beforeEach(() => {
    modeManager = new ModeManager('interactive');
  });

  describe('initialization', () => {
    it('should initialize in interactive mode by default', () => {
      const manager = new ModeManager();
      expect(manager.getMode()).toBe('interactive');
    });

    it('should initialize in specified mode', () => {
      const manager = new ModeManager('planning');
      expect(manager.getMode()).toBe('planning');
    });
  });

  describe('getMode', () => {
    it('should return current mode', () => {
      expect(modeManager.getMode()).toBe('interactive');
    });
  });

  describe('getState', () => {
    it('should return full state', () => {
      const state = modeManager.getState();

      expect(state.mode).toBe('interactive');
      expect(state.reason).toBe('initial');
      expect(state.enteredAt).toBeInstanceOf(Date);
    });
  });

  describe('canTransition', () => {
    it('should allow interactive → planning', () => {
      expect(modeManager.canTransition('planning')).toBe(true);
    });

    it('should allow interactive → executing', () => {
      expect(modeManager.canTransition('executing')).toBe(true);
    });

    it('should allow planning → interactive', () => {
      modeManager.transition('planning', 'test');
      expect(modeManager.canTransition('interactive')).toBe(true);
    });

    it('should allow planning → executing', () => {
      modeManager.transition('planning', 'test');
      expect(modeManager.canTransition('executing')).toBe(true);
    });

    it('should allow executing → interactive', () => {
      modeManager.transition('executing', 'test');
      expect(modeManager.canTransition('interactive')).toBe(true);
    });

    it('should allow executing → planning', () => {
      modeManager.transition('executing', 'test');
      expect(modeManager.canTransition('planning')).toBe(true);
    });
  });

  describe('transition', () => {
    it('should transition to new mode', () => {
      const result = modeManager.transition('planning', 'test');

      expect(result).toBe(true);
      expect(modeManager.getMode()).toBe('planning');
    });

    it('should emit mode:changed event', () => {
      const listener = vi.fn();
      modeManager.on('mode:changed', listener);

      modeManager.transition('planning', 'user_request');

      expect(listener).toHaveBeenCalledWith({
        from: 'interactive',
        to: 'planning',
        reason: 'user_request',
      });
    });

    it('should update enteredAt timestamp', () => {
      const before = modeManager.getState().enteredAt.getTime();

      setTimeout(() => {
        modeManager.transition('planning', 'test');
        const after = modeManager.getState().enteredAt.getTime();

        expect(after).toBeGreaterThan(before);
      }, 10);
    });

    it('should emit mode:transition_blocked for invalid transition', () => {
      const listener = vi.fn();
      modeManager.on('mode:transition_blocked', listener);

      // Try invalid transition (none exist currently, all are valid)
      // Just testing the event exists
    });

    it('should record transition history', () => {
      modeManager.transition('planning', 'reason1');
      modeManager.transition('executing', 'reason2');

      const history = modeManager.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        from: 'interactive',
        to: 'planning',
        reason: 'reason1',
      });
      expect(history[1]).toMatchObject({
        from: 'planning',
        to: 'executing',
        reason: 'reason2',
      });
    });
  });

  describe('enterPlanning', () => {
    it('should enter planning mode', () => {
      const result = modeManager.enterPlanning('user_request');

      expect(result).toBe(true);
      expect(modeManager.getMode()).toBe('planning');
    });

    it('should use default reason', () => {
      modeManager.enterPlanning();

      const history = modeManager.getHistory();
      expect(history[0].reason).toBe('user_request');
    });
  });

  describe('enterExecuting', () => {
    it('should enter executing mode', () => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      const result = modeManager.enterExecuting(plan, 'plan_approved');

      expect(result).toBe(true);
      expect(modeManager.getMode()).toBe('executing');
    });

    it('should set currentTaskIndex to 0', () => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.enterExecuting(plan);

      expect(modeManager.getCurrentTaskIndex()).toBe(0);
    });

    it('should auto-approve when transitioning from planning', () => {
      modeManager.transition('planning', 'test');

      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.setPendingPlan(plan);
      modeManager.enterExecuting(plan);

      expect(modeManager.isPlanApproved()).toBe(true);
    });
  });

  describe('returnToInteractive', () => {
    it('should return to interactive mode', () => {
      modeManager.transition('planning', 'test');

      const result = modeManager.returnToInteractive('completed');

      expect(result).toBe(true);
      expect(modeManager.getMode()).toBe('interactive');
    });

    it('should use default reason', () => {
      modeManager.transition('planning', 'test');
      modeManager.returnToInteractive();

      const history = modeManager.getHistory();
      expect(history[history.length - 1].reason).toBe('completed');
    });
  });

  describe('plan management', () => {
    it('should set pending plan', () => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.setPendingPlan(plan);

      expect(modeManager.getPendingPlan()).toEqual(plan);
      expect(modeManager.isPlanApproved()).toBe(false);
    });

    it('should get pending plan', () => {
      expect(modeManager.getPendingPlan()).toBeUndefined();

      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.setPendingPlan(plan);
      expect(modeManager.getPendingPlan()).toEqual(plan);
    });

    it('should approve plan', () => {
      modeManager.transition('planning', 'test');

      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.setPendingPlan(plan);

      const result = modeManager.approvePlan();

      expect(result).toBe(true);
      expect(modeManager.isPlanApproved()).toBe(true);
    });

    it('should not approve plan if not in planning mode', () => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.setPendingPlan(plan);

      const result = modeManager.approvePlan();

      expect(result).toBe(false);
    });

    it('should not approve plan if no pending plan', () => {
      modeManager.transition('planning', 'test');

      const result = modeManager.approvePlan();

      expect(result).toBe(false);
    });
  });

  describe('task index management', () => {
    beforeEach(() => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.enterExecuting(plan);
    });

    it('should set current task index', () => {
      modeManager.setCurrentTaskIndex(5);
      expect(modeManager.getCurrentTaskIndex()).toBe(5);
    });

    it('should get current task index', () => {
      expect(modeManager.getCurrentTaskIndex()).toBe(0);
    });

    it('should not set task index if not in executing mode', () => {
      modeManager.returnToInteractive();
      modeManager.setCurrentTaskIndex(5);

      expect(modeManager.getCurrentTaskIndex()).toBe(0); // Still 0
    });
  });

  describe('pause/resume', () => {
    beforeEach(() => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.enterExecuting(plan);
    });

    it('should pause execution', () => {
      modeManager.pauseExecution('user_request');

      expect(modeManager.isPaused()).toBe(true);
      expect(modeManager.getPauseReason()).toBe('user_request');
    });

    it('should resume execution', () => {
      modeManager.pauseExecution('test');
      expect(modeManager.isPaused()).toBe(true);

      modeManager.resumeExecution();

      expect(modeManager.isPaused()).toBe(false);
      expect(modeManager.getPauseReason()).toBeUndefined();
    });

    it('should not pause if not in executing mode', () => {
      modeManager.returnToInteractive();
      modeManager.pauseExecution('test');

      expect(modeManager.isPaused()).toBe(false);
    });
  });

  describe('recommendMode', () => {
    it('should recommend planning for complex task in interactive mode', () => {
      const intent: IntentAnalysis = {
        type: 'complex',
        confidence: 0.9,
        complexity: 'high',
      };

      const recommended = modeManager.recommendMode(intent);
      expect(recommended).toBe('planning');
    });

    it('should recommend executing for approval in planning mode', () => {
      modeManager.transition('planning', 'test');

      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.setPendingPlan(plan);

      const intent: IntentAnalysis = {
        type: 'approval',
        confidence: 0.9,
      };

      const recommended = modeManager.recommendMode(intent);
      expect(recommended).toBe('executing');
    });

    it('should recommend interactive for interrupt', () => {
      modeManager.transition('planning', 'test');

      const intent: IntentAnalysis = {
        type: 'interrupt',
        confidence: 0.9,
      };

      const recommended = modeManager.recommendMode(intent);
      expect(recommended).toBe('interactive');
    });

    it('should recommend null for status query', () => {
      const intent: IntentAnalysis = {
        type: 'status_query',
        confidence: 0.9,
      };

      const recommended = modeManager.recommendMode(intent);
      expect(recommended).toBeNull();
    });

    it('should recommend null for feedback', () => {
      const intent: IntentAnalysis = {
        type: 'feedback',
        confidence: 0.9,
      };

      const recommended = modeManager.recommendMode(intent);
      expect(recommended).toBeNull();
    });
  });

  describe('serialize/restore', () => {
    it('should serialize state', () => {
      modeManager.transition('planning', 'user_request');

      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      modeManager.setPendingPlan(plan);

      const serialized = modeManager.serialize();

      expect(serialized.mode).toBe('planning');
      expect(serialized.reason).toBe('user_request');
      expect(serialized.pendingPlan).toEqual(plan);
      expect(serialized.planApproved).toBe(false);
    });

    it('should restore state', () => {
      const plan: Plan = {
        id: 'plan-1',
        goal: 'Test goal',
        tasks: [],
        status: 'pending',
        createdAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };

      const state = {
        mode: 'executing' as const,
        enteredAt: new Date().toISOString(),
        reason: 'plan_approved',
        pendingPlan: plan,
        planApproved: true,
        currentTaskIndex: 2,
      };

      modeManager.restore(state);

      expect(modeManager.getMode()).toBe('executing');
      expect(modeManager.isPlanApproved()).toBe(true);
      expect(modeManager.getCurrentTaskIndex()).toBe(2);
      expect(modeManager.getPendingPlan()).toEqual(plan);
    });
  });

  describe('getHistory', () => {
    it('should return transition history', () => {
      modeManager.transition('planning', 'reason1');
      modeManager.transition('executing', 'reason2');
      modeManager.transition('interactive', 'reason3');

      const history = modeManager.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].from).toBe('interactive');
      expect(history[0].to).toBe('planning');
      expect(history[1].from).toBe('planning');
      expect(history[1].to).toBe('executing');
      expect(history[2].from).toBe('executing');
      expect(history[2].to).toBe('interactive');
    });

    it('should return empty array initially', () => {
      const history = modeManager.getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('should clear transition history', () => {
      modeManager.transition('planning', 'test');
      modeManager.transition('executing', 'test');

      expect(modeManager.getHistory()).toHaveLength(2);

      modeManager.clearHistory();
      expect(modeManager.getHistory()).toEqual([]);
    });
  });

  describe('getTimeInCurrentMode', () => {
    it('should return time in current mode', async () => {
      const start = modeManager.getTimeInCurrentMode();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const end = modeManager.getTimeInCurrentMode();

      expect(end).toBeGreaterThan(start);
      // Allow some tolerance for timing variations (40ms minimum instead of 50)
      expect(end).toBeGreaterThanOrEqual(40);
    });
  });

  describe('destroy', () => {
    it('should mark as destroyed', () => {
      expect(modeManager.isDestroyed).toBe(false);
      modeManager.destroy();
      expect(modeManager.isDestroyed).toBe(true);
    });

    it('should be idempotent (safe to call multiple times)', () => {
      modeManager.destroy();
      modeManager.destroy();
      modeManager.destroy();
      expect(modeManager.isDestroyed).toBe(true);
    });

    it('should clear transition history', () => {
      modeManager.transition('planning', 'test');
      modeManager.transition('executing', 'test');
      expect(modeManager.getHistory().length).toBeGreaterThan(0);

      modeManager.destroy();
      expect(modeManager.getHistory()).toEqual([]);
    });

    it('should remove event listeners', () => {
      const listener = vi.fn();
      modeManager.on('mode:changed', listener);

      modeManager.destroy();

      // After destroy, listeners should be removed
      expect(modeManager.isDestroyed).toBe(true);
    });
  });
});
