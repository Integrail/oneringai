/**
 * PlanningAgent Unit Tests
 * Tests AI-driven plan generation and refinement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PlanningAgent,
  PlanningAgentConfig,
  generateSimplePlan,
} from '@/capabilities/taskAgent/PlanningAgent.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { Agent } from '@/core/Agent.js';
import { TaskInput, createPlan } from '@/domain/entities/Task.js';

// Mock Agent
const mockRun = vi.fn();
const mockAgentCreate = vi.spyOn(Agent, 'create');

describe('PlanningAgent', () => {
  let planningAgent: PlanningAgent;
  let config: PlanningAgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    Connector.clear();

    // Create test connector
    Connector.create({
      name: 'test-planning',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test-key' },
    });

    config = {
      connector: 'test-planning',
      model: 'gpt-4',
      maxPlanningIterations: 20,
      planningTemperature: 0.3,
    };

    // Mock Agent.create to return a mock agent
    mockAgentCreate.mockReturnValue({
      run: mockRun,
      stream: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
    } as any);
  });

  afterEach(() => {
    Connector.clear();
  });

  describe('create', () => {
    it('should create a PlanningAgent with default settings', () => {
      const agent = PlanningAgent.create(config);
      expect(agent).toBeInstanceOf(PlanningAgent);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          connector: 'test-planning',
          model: 'gpt-4',
          temperature: 0.3,
          maxIterations: 20,
        })
      );
    });

    it('should use default temperature when not provided', () => {
      const minimalConfig = {
        connector: 'test-planning',
        model: 'gpt-4',
      };
      PlanningAgent.create(minimalConfig);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        })
      );
    });

    it('should use default maxPlanningIterations when not provided', () => {
      const minimalConfig = {
        connector: 'test-planning',
        model: 'gpt-4',
      };
      PlanningAgent.create(minimalConfig);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          maxIterations: 20,
        })
      );
    });

    it('should include planning tools in agent creation', () => {
      PlanningAgent.create(config);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              definition: expect.objectContaining({
                function: expect.objectContaining({
                  name: 'create_task',
                }),
              }),
            }),
          ]),
        })
      );
    });

    it('should set planning system prompt', () => {
      PlanningAgent.create(config);
      expect(mockAgentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.stringContaining('AI planning agent'),
        })
      );
    });
  });

  describe('generatePlan', () => {
    beforeEach(() => {
      planningAgent = PlanningAgent.create(config);
    });

    it('should generate a plan from a goal', async () => {
      mockRun.mockResolvedValue({
        output_text: 'Plan created successfully',
        usage: { total_tokens: 100 },
      });

      const result = await planningAgent.generatePlan({
        goal: 'Deploy application to production',
      });

      expect(result.plan).toBeDefined();
      expect(result.plan.goal).toBe('Deploy application to production');
      expect(result.reasoning).toContain('Plan created successfully');
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('Deploy application'));
    });

    it('should include context in planning prompt', async () => {
      mockRun.mockResolvedValue({
        output_text: 'Plan created',
      });

      await planningAgent.generatePlan({
        goal: 'Deploy app',
        context: 'AWS infrastructure',
      });

      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('AWS infrastructure'));
    });

    it('should include constraints in planning prompt', async () => {
      mockRun.mockResolvedValue({
        output_text: 'Plan created',
      });

      await planningAgent.generatePlan({
        goal: 'Deploy app',
        constraints: ['Zero downtime', 'Use blue-green deployment'],
      });

      const callArg = mockRun.mock.calls[0][0];
      expect(callArg).toContain('Zero downtime');
      expect(callArg).toContain('Use blue-green deployment');
    });

    it('should include available tools in planning prompt', async () => {
      mockRun.mockResolvedValue({
        output_text: 'Plan created',
      });

      const configWithTools = {
        ...config,
        availableTools: [
          {
            definition: {
              type: 'function' as const,
              function: {
                name: 'deploy',
                description: 'Deploy to server',
                parameters: { type: 'object', properties: {} },
              },
            },
            execute: async () => ({}),
          },
        ],
      };

      const agent = PlanningAgent.create(configWithTools);
      await agent.generatePlan({
        goal: 'Deploy app',
      });

      const callArg = mockRun.mock.calls[0][0];
      expect(callArg).toContain('deploy');
      expect(callArg).toContain('Deploy to server');
    });

    it('should estimate complexity as low for simple plans', async () => {
      // Simulate agent adding tasks during run
      mockRun.mockImplementation(async () => {
        planningAgent.addTask({
          name: 'simple_task',
          description: 'Do something simple',
        });
        return { output_text: 'Simple plan' };
      });

      const result = await planningAgent.generatePlan({
        goal: 'Simple goal',
      });

      expect(result.complexity).toBe('low');
    });

    it('should estimate complexity as medium for moderate plans', async () => {
      // Simulate agent adding tasks with dependencies during run
      mockRun.mockImplementation(async () => {
        for (let i = 0; i < 5; i++) {
          planningAgent.addTask({
            name: `task_${i}`,
            description: `Task ${i}`,
            dependsOn: i > 0 ? [`task_${i - 1}`] : undefined,
          });
        }
        return { output_text: 'Medium plan' };
      });

      const result = await planningAgent.generatePlan({
        goal: 'Medium goal',
      });

      expect(result.complexity).toBe('medium');
    });

    it('should estimate complexity as high for complex plans', async () => {
      // Simulate agent adding tasks with conditionals during run
      mockRun.mockImplementation(async () => {
        for (let i = 0; i < 15; i++) {
          planningAgent.addTask({
            name: `task_${i}`,
            description: `Task ${i}`,
            condition: i > 5 ? 'some condition' : undefined,
          });
        }
        return { output_text: 'Complex plan' };
      });

      const result = await planningAgent.generatePlan({
        goal: 'Complex goal',
      });

      expect(result.complexity).toBe('high');
    });

    it('should reset state between planning calls', async () => {
      // First plan - add task during run
      mockRun.mockImplementationOnce(async () => {
        planningAgent.addTask({ name: 'task1', description: 'First' });
        return { output_text: 'Plan 1' };
      });

      await planningAgent.generatePlan({ goal: 'Goal 1' });

      // Second plan - should start fresh (no tasks added)
      mockRun.mockImplementationOnce(async () => {
        return { output_text: 'Plan 2' };
      });

      const result2 = await planningAgent.generatePlan({ goal: 'Goal 2' });

      // Should not include tasks from first plan
      expect(result2.plan.tasks.length).toBe(0);
    });

    it('should handle empty output text', async () => {
      mockRun.mockResolvedValue({
        output_text: '',
      });

      const result = await planningAgent.generatePlan({
        goal: 'Test goal',
      });

      expect(result.reasoning).toBe('Plan generated');
    });
  });

  describe('refinePlan', () => {
    beforeEach(() => {
      planningAgent = PlanningAgent.create(config);
    });

    it('should refine an existing plan based on feedback', async () => {
      const originalPlan = createPlan({
        goal: 'Deploy app',
        tasks: [
          { name: 'build', description: 'Build app' },
          { name: 'deploy', description: 'Deploy app' },
        ],
      });

      mockRun.mockResolvedValue({
        output_text: 'Plan refined with additional security checks',
      });

      const result = await planningAgent.refinePlan(originalPlan, 'Add security checks');

      expect(result.plan).toBeDefined();
      expect(result.reasoning).toContain('security checks');
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('Add security checks'));
    });

    it('should load existing tasks from plan', async () => {
      const originalPlan = createPlan({
        goal: 'Deploy app',
        context: 'Production environment',
        tasks: [
          {
            name: 'build',
            description: 'Build app',
            dependsOn: [],
          },
          {
            name: 'test',
            description: 'Run tests',
            dependsOn: ['build'],
          },
        ],
      });

      mockRun.mockResolvedValue({
        output_text: 'Refined',
      });

      await planningAgent.refinePlan(originalPlan, 'Add deployment');

      const callArg = mockRun.mock.calls[0][0];
      expect(callArg).toContain('build: Build app');
      expect(callArg).toContain('test: Run tests');
      // Tasks get dependencies when loaded, may reference by ID or name
      expect(callArg).toContain('depends on:');
    });

    it('should preserve plan goal and context in refined plan', async () => {
      const originalPlan = createPlan({
        goal: 'Original goal',
        context: 'Original context',
        tasks: [{ name: 'task1', description: 'Task 1' }],
      });

      mockRun.mockResolvedValue({
        output_text: 'Refined plan',
      });

      const result = await planningAgent.refinePlan(originalPlan, 'Improve');

      expect(result.plan.goal).toBe('Original goal');
      expect(result.plan.context).toBe('Original context');
    });
  });

  describe('Task management methods', () => {
    beforeEach(() => {
      planningAgent = PlanningAgent.create(config);
    });

    it('should add tasks', () => {
      const task: TaskInput = {
        name: 'test_task',
        description: 'Test task description',
      };

      planningAgent.addTask(task);
      const tasks = planningAgent.getCurrentTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('test_task');
    });

    it('should update existing tasks', () => {
      planningAgent.addTask({
        name: 'task1',
        description: 'Original description',
      });

      planningAgent.updateTask('task1', {
        description: 'Updated description',
        dependsOn: ['task0'],
      });

      const tasks = planningAgent.getCurrentTasks();
      expect(tasks[0].description).toBe('Updated description');
      expect(tasks[0].dependsOn).toEqual(['task0']);
    });

    it('should not throw when updating non-existent task', () => {
      expect(() => {
        planningAgent.updateTask('nonexistent', { description: 'New' });
      }).not.toThrow();
    });

    it('should remove tasks', () => {
      planningAgent.addTask({ name: 'task1', description: 'Task 1' });
      planningAgent.addTask({ name: 'task2', description: 'Task 2' });

      planningAgent.removeTask('task1');

      const tasks = planningAgent.getCurrentTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('task2');
    });

    it('should not throw when removing non-existent task', () => {
      expect(() => {
        planningAgent.removeTask('nonexistent');
      }).not.toThrow();
    });

    it('should finalize planning', () => {
      planningAgent.finalizePlanning();
      // No assertion needed - just verify it doesn't throw
      expect(true).toBe(true);
    });

    it('should return copy of tasks to prevent external modification', () => {
      planningAgent.addTask({ name: 'task1', description: 'Task 1' });

      const tasks1 = planningAgent.getCurrentTasks();
      const tasks2 = planningAgent.getCurrentTasks();

      expect(tasks1).not.toBe(tasks2); // Different array references
      expect(tasks1).toEqual(tasks2); // But same content
    });
  });

  describe('Complexity estimation', () => {
    beforeEach(() => {
      planningAgent = PlanningAgent.create(config);
    });

    it('should return low for plans with 3 or fewer tasks and no dependencies', async () => {
      mockRun.mockImplementation(async () => {
        planningAgent.addTask({ name: 't1', description: 'Task 1' });
        planningAgent.addTask({ name: 't2', description: 'Task 2' });
        return { output_text: 'test' };
      });
      const result = await planningAgent.generatePlan({ goal: 'Simple' });
      expect(result.complexity).toBe('low');
    });

    it('should return medium for plans with dependencies but no conditionals', async () => {
      mockRun.mockImplementation(async () => {
        for (let i = 0; i < 5; i++) {
          planningAgent.addTask({
            name: `t${i}`,
            description: `Task ${i}`,
            dependsOn: i > 0 ? [`t${i - 1}`] : undefined,
          });
        }
        return { output_text: 'test' };
      });
      const result = await planningAgent.generatePlan({ goal: 'Medium' });
      expect(result.complexity).toBe('medium');
    });

    it('should return high for plans with external dependencies', async () => {
      mockRun.mockImplementation(async () => {
        planningAgent.addTask({
          name: 't1',
          description: 'Task 1',
          externalDependency: {
            type: 'webhook',
            state: 'waiting',
          },
        });
        return { output_text: 'test' };
      });
      const result = await planningAgent.generatePlan({ goal: 'Complex' });
      expect(result.complexity).toBe('high');
    });

    it('should return high for plans with conditionals', async () => {
      mockRun.mockImplementation(async () => {
        planningAgent.addTask({
          name: 't1',
          description: 'Task 1',
          condition: 'some condition',
        });
        return { output_text: 'test' };
      });
      const result = await planningAgent.generatePlan({ goal: 'Complex' });
      expect(result.complexity).toBe('high');
    });

    it('should return high for plans with more than 10 tasks', async () => {
      mockRun.mockImplementation(async () => {
        for (let i = 0; i < 12; i++) {
          planningAgent.addTask({
            name: `t${i}`,
            description: `Task ${i}`,
          });
        }
        return { output_text: 'test' };
      });
      const result = await planningAgent.generatePlan({ goal: 'Many tasks' });
      expect(result.complexity).toBe('high');
    });
  });

  describe('Planning tools', () => {
    it('should create planning tools with correct definitions', () => {
      const agent = PlanningAgent.create(config);

      const agentCreateCall = mockAgentCreate.mock.calls[0][0];
      const tools = agentCreateCall.tools;

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);

      // Check create_task tool
      const createTaskTool = tools!.find(
        (t) => t.definition.function.name === 'create_task'
      );
      expect(createTaskTool).toBeDefined();
      expect(createTaskTool!.definition.function.description).toContain('Create a new task');

      // Check finalize_plan tool
      const finalizeTool = tools!.find(
        (t) => t.definition.function.name === 'finalize_plan'
      );
      expect(finalizeTool).toBeDefined();
      expect(finalizeTool!.definition.function.description).toContain('planning phase');
    });

    it('should have idempotency configuration on tools', () => {
      const agent = PlanningAgent.create(config);

      const agentCreateCall = mockAgentCreate.mock.calls[0][0];
      const tools = agentCreateCall.tools;

      tools!.forEach((tool) => {
        expect(tool.idempotency).toBeDefined();
        expect(tool.idempotency!.safe).toBe(false);
      });
    });
  });

  describe('generateSimplePlan', () => {
    it('should create a simple single-task plan', async () => {
      const plan = await generateSimplePlan('Complete the mission');

      expect(plan.goal).toBe('Complete the mission');
      expect(plan.tasks).toHaveLength(1);
      expect(plan.tasks[0].name).toBe('execute_goal');
      expect(plan.tasks[0].description).toContain('Complete the mission');
    });

    it('should include context if provided', async () => {
      const plan = await generateSimplePlan('Deploy app', 'Production environment');

      expect(plan.context).toBe('Production environment');
    });

    it('should allow dynamic tasks', async () => {
      const plan = await generateSimplePlan('Test goal');

      expect(plan.allowDynamicTasks).toBe(true);
    });
  });

  describe('Edge cases', () => {
    beforeEach(() => {
      planningAgent = PlanningAgent.create(config);
    });

    it('should handle empty goal', async () => {
      mockRun.mockResolvedValue({ output_text: 'Plan' });

      const result = await planningAgent.generatePlan({ goal: '' });

      expect(result.plan.goal).toBe('');
    });

    it('should handle very long goal', async () => {
      mockRun.mockResolvedValue({ output_text: 'Plan' });

      const longGoal = 'Very long goal '.repeat(100);
      const result = await planningAgent.generatePlan({ goal: longGoal });

      expect(result.plan.goal).toBe(longGoal);
    });

    it('should handle empty constraints array', async () => {
      mockRun.mockResolvedValue({ output_text: 'Plan' });

      await planningAgent.generatePlan({
        goal: 'Test',
        constraints: [],
      });

      expect(mockRun).toHaveBeenCalled();
    });

    it('should handle plan with no context', async () => {
      const plan = createPlan({
        goal: 'Test',
        tasks: [{ name: 't1', description: 'Task' }],
      });

      mockRun.mockResolvedValue({ output_text: 'Refined' });

      const result = await planningAgent.refinePlan(plan, 'Feedback');

      expect(result.plan.context).toBeUndefined();
    });
  });
});
