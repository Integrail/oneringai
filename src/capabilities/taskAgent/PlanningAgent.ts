/**
 * PlanningAgent - AI-driven plan generation
 *
 * Separates planning phase from execution phase.
 * Analyzes goals and generates task graphs with dependencies.
 */

import { Agent } from '../../core/Agent.js';
import { Connector } from '../../core/Connector.js';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { Plan, TaskInput, createPlan } from '../../domain/entities/Task.js';

/**
 * PlanningAgent configuration
 */
export interface PlanningAgentConfig {
  /** Connector for LLM access */
  connector: string | Connector;

  /** Model to use for planning (can be different/cheaper than execution) */
  model: string;

  /** Max planning iterations */
  maxPlanningIterations?: number;

  /** Temperature for planning (lower = more deterministic) */
  planningTemperature?: number;

  /** Tools available for the plan (used to inform planning) */
  availableTools?: ToolFunction[];
}

/**
 * Generated plan with metadata
 */
export interface GeneratedPlan {
  plan: Plan;
  reasoning: string;
  estimated_duration?: string;
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Planning system prompt
 */
const PLANNING_SYSTEM_PROMPT = `You are an AI planning agent. Your job is to analyze goals and break them down into structured, executable task plans.

**Your Role:**
1. Analyze the user's goal and context
2. Break down the goal into logical, atomic tasks
3. Identify dependencies between tasks
4. Structure tasks for optimal execution (parallel where possible)
5. Use the planning tools to create the plan

**Planning Principles:**
- Each task should have a single, clear responsibility
- Tasks should be atomic (can't be broken down further meaningfully)
- Dependencies should be explicit (use dependsOn)
- Parallel tasks should be marked as such (execution.parallel)
- Task names should be descriptive snake_case (e.g., "fetch_user_data")
- Descriptions should be clear and actionable

**Available Planning Tools:**
- create_task: Add a task to the plan
- add_dependency: Link tasks with dependencies
- mark_parallel: Mark tasks that can run in parallel
- finalize_plan: Complete the planning phase

Always start by analyzing the goal, then create tasks one by one, building dependencies as you go.`;

/**
 * PlanningAgent class
 */
export class PlanningAgent {
  private agent: Agent;
  private config: PlanningAgentConfig;
  private currentTasks: TaskInput[] = [];
  private planningComplete = false;

  private constructor(agent: Agent, config: PlanningAgentConfig) {
    this.agent = agent;
    this.config = config;
  }

  /**
   * Create a new PlanningAgent
   */
  static create(config: PlanningAgentConfig): PlanningAgent {
    // Create planning tools
    const planningTools = createPlanningTools();

    // Create base Agent with planning configuration
    const agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: planningTools,
      instructions: PLANNING_SYSTEM_PROMPT,
      temperature: config.planningTemperature ?? 0.3, // Lower temp for more structured output
      maxIterations: config.maxPlanningIterations ?? 20,
    });

    return new PlanningAgent(agent, config);
  }

  /**
   * Generate a plan from a goal
   */
  async generatePlan(input: {
    goal: string;
    context?: string;
    constraints?: string[];
  }): Promise<GeneratedPlan> {
    // Reset state
    this.currentTasks = [];
    this.planningComplete = false;

    // Build planning prompt
    const prompt = this.buildPlanningPrompt(input);

    // Use the agent to generate the plan
    const response = await this.agent.run(prompt);

    // If planning wasn't finalized through tools, finalize manually
    if (!this.planningComplete && this.currentTasks.length > 0) {
      this.planningComplete = true;
    }

    // Create the plan
    const plan = createPlan({
      goal: input.goal,
      context: input.context,
      tasks: this.currentTasks,
      allowDynamicTasks: false, // Plans are static by default
    });

    return {
      plan,
      reasoning: response.output_text || 'Plan generated',
      complexity: this.estimateComplexity(this.currentTasks),
    };
  }

  /**
   * Validate and refine an existing plan
   */
  async refinePlan(plan: Plan, feedback: string): Promise<GeneratedPlan> {
    // Load existing tasks
    this.currentTasks = plan.tasks.map((task) => ({
      name: task.name,
      description: task.description,
      dependsOn: task.dependsOn,
      expectedOutput: task.expectedOutput,
      condition: task.condition,
      execution: task.execution,
      externalDependency: task.externalDependency,
      maxAttempts: task.maxAttempts,
    }));

    this.planningComplete = false;

    // Build refinement prompt
    const prompt = `I have an existing plan that needs refinement based on feedback.

**Current Plan Goal:** ${plan.goal}
**Current Plan Context:** ${plan.context || 'None'}

**Current Tasks:**
${this.currentTasks.map((t, i) => `${i + 1}. ${t.name}: ${t.description}${t.dependsOn?.length ? ` (depends on: ${t.dependsOn.join(', ')})` : ''}`).join('\n')}

**Feedback:** ${feedback}

Please refine the plan based on this feedback. You can:
- Add new tasks
- Modify existing task descriptions
- Change dependencies
- Remove unnecessary tasks
- Adjust parallel execution

Use the planning tools to make changes, then finalize when complete.`;

    const response = await this.agent.run(prompt);

    // Create refined plan
    const refinedPlan = createPlan({
      goal: plan.goal,
      context: plan.context,
      tasks: this.currentTasks,
      allowDynamicTasks: false,
    });

    return {
      plan: refinedPlan,
      reasoning: response.output_text || 'Plan refined',
      complexity: this.estimateComplexity(this.currentTasks),
    };
  }

  /**
   * Build planning prompt from input
   */
  private buildPlanningPrompt(input: {
    goal: string;
    context?: string;
    constraints?: string[];
  }): string {
    const parts: string[] = [];

    parts.push('Please create an execution plan for the following goal:\n');
    parts.push(`**Goal:** ${input.goal}\n`);

    if (input.context) {
      parts.push(`**Context:** ${input.context}\n`);
    }

    if (input.constraints && input.constraints.length > 0) {
      parts.push('\n**Constraints:**');
      input.constraints.forEach((c) => parts.push(`- ${c}`));
      parts.push('');
    }

    if (this.config.availableTools && this.config.availableTools.length > 0) {
      parts.push('\n**Available Tools for Execution:**');
      this.config.availableTools.forEach((tool) => {
        parts.push(`- ${tool.definition.function.name}: ${tool.definition.function.description}`);
      });
      parts.push('');
    }

    parts.push('\nAnalyze this goal and create a structured plan with clear tasks and dependencies.');
    parts.push('Use the planning tools to build the plan step by step.');

    return parts.join('\n');
  }

  /**
   * Estimate plan complexity
   */
  private estimateComplexity(tasks: TaskInput[]): 'low' | 'medium' | 'high' {
    const taskCount = tasks.length;
    const hasDependencies = tasks.some((t) => t.dependsOn && t.dependsOn.length > 0);
    const hasConditionals = tasks.some((t) => t.condition);
    const hasExternalDeps = tasks.some((t) => t.externalDependency);

    if (taskCount <= 3 && !hasDependencies && !hasConditionals && !hasExternalDeps) {
      return 'low';
    }

    if (taskCount <= 10 && !hasConditionals && !hasExternalDeps) {
      return 'medium';
    }

    return 'high';
  }

  /**
   * Get current tasks (for tool access)
   */
  getCurrentTasks(): TaskInput[] {
    return [...this.currentTasks];
  }

  /**
   * Add task (called by planning tools)
   */
  addTask(task: TaskInput): void {
    this.currentTasks.push(task);
  }

  /**
   * Update task (called by planning tools)
   */
  updateTask(name: string, updates: Partial<TaskInput>): void {
    const task = this.currentTasks.find((t) => t.name === name);
    if (task) {
      Object.assign(task, updates);
    }
  }

  /**
   * Remove task (called by planning tools)
   */
  removeTask(name: string): void {
    const index = this.currentTasks.findIndex((t) => t.name === name);
    if (index >= 0) {
      this.currentTasks.splice(index, 1);
    }
  }

  /**
   * Mark planning as complete
   */
  finalizePlanning(): void {
    this.planningComplete = true;
  }
}

/**
 * Create planning tools
 */
function createPlanningTools(): ToolFunction[] {
  return [
    {
      definition: {
        type: 'function',
        function: {
          name: 'create_task',
          description: 'Create a new task in the plan with name, description, and optional dependencies',
          parameters: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Task name in snake_case (e.g., "fetch_user_data")',
              },
              description: {
                type: 'string',
                description: 'Clear, actionable description of what this task does',
              },
              depends_on: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of task names this task depends on (optional)',
              },
              parallel: {
                type: 'boolean',
                description: 'Whether this task can run in parallel with others (default: false)',
              },
              expected_output: {
                type: 'string',
                description: 'Description of expected output (optional)',
              },
            },
            required: ['name', 'description'],
          },
        },
      },
      execute: async (args: any) => {
        // Note: In a real implementation, we'd need access to the PlanningAgent instance
        // This is a simplified version - the actual implementation would need to be bound to the instance
        return {
          success: true,
          message: `Task '${args.name}' created`,
        };
      },
      idempotency: {
        safe: false,
      },
    },
    {
      definition: {
        type: 'function',
        function: {
          name: 'finalize_plan',
          description: 'Mark the planning phase as complete. Call this when all tasks have been created and the plan is ready.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      execute: async () => {
        return {
          success: true,
          message: 'Plan finalized and ready for execution',
        };
      },
      idempotency: {
        safe: false,
      },
    },
  ];
}

/**
 * Simple plan generation without tools (fallback)
 */
export async function generateSimplePlan(
  goal: string,
  context?: string
): Promise<Plan> {
  // Fallback: create a simple single-task plan
  return createPlan({
    goal,
    context,
    tasks: [
      {
        name: 'execute_goal',
        description: `Execute the goal: ${goal}`,
      },
    ],
    allowDynamicTasks: true, // Allow agent to modify plan
  });
}
