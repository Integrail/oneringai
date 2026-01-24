/**
 * Meta-tools for UniversalAgent
 *
 * These tools are used internally by the agent to signal mode transitions
 * and perform meta-operations like planning and progress reporting.
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import type { StartPlanningArgs, ModifyPlanArgs, ReportProgressArgs, RequestApprovalArgs } from './types.js';

/**
 * Tool for starting planning mode
 */
export const startPlanningTool: ToolFunction<StartPlanningArgs, { status: string }> = {
  definition: {
    type: 'function',
    function: {
      name: '_start_planning',
      description: `Call this when the user's request is complex and requires a multi-step plan.
Use for tasks that:
- Require 3 or more distinct steps
- Need multiple tools to be called in sequence
- Have dependencies between actions
- Would benefit from user review before execution

Do NOT use for:
- Simple questions
- Single tool calls
- Quick calculations
- Direct information retrieval`,
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'The high-level goal to achieve',
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of why planning is needed',
          },
        },
        required: ['goal', 'reasoning'],
      },
    },
  },
  execute: async (args) => {
    // This is handled internally by UniversalAgent
    return { status: 'planning_started', goal: args.goal };
  },
};

/**
 * Tool for modifying the current plan
 */
export const modifyPlanTool: ToolFunction<ModifyPlanArgs, { status: string }> = {
  definition: {
    type: 'function',
    function: {
      name: '_modify_plan',
      description: `Call this when the user wants to change the current plan.
Actions:
- add_task: Add a new task to the plan
- remove_task: Remove a task from the plan
- skip_task: Mark a task to be skipped
- update_task: Modify task description or dependencies
- reorder: Change task order`,
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['add_task', 'remove_task', 'skip_task', 'update_task', 'reorder'],
            description: 'The type of modification',
          },
          taskName: {
            type: 'string',
            description: 'Name of the task (for remove/skip/update/reorder)',
          },
          details: {
            type: 'string',
            description: 'Details of the modification (new task description, updates, etc.)',
          },
          insertAfter: {
            type: 'string',
            description: 'For add_task/reorder: insert after this task name',
          },
        },
        required: ['action', 'details'],
      },
    },
  },
  execute: async (args) => {
    // This is handled internally by UniversalAgent
    return { status: 'plan_modified', action: args.action };
  },
};

/**
 * Tool for reporting current progress
 */
export const reportProgressTool: ToolFunction<ReportProgressArgs, { status: string; progress: unknown }> = {
  definition: {
    type: 'function',
    function: {
      name: '_report_progress',
      description: 'Call this when the user asks about current progress, status, or what has been done.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  execute: async () => {
    // This is handled internally by UniversalAgent
    return { status: 'progress_reported', progress: null };
  },
};

/**
 * Tool for requesting user approval
 */
export const requestApprovalTool: ToolFunction<RequestApprovalArgs, { status: string }> = {
  definition: {
    type: 'function',
    function: {
      name: '_request_approval',
      description: 'Call this when you need user approval to proceed. Use after creating a plan or before destructive operations.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Optional message to show the user',
          },
        },
        required: [],
      },
    },
  },
  execute: async (args) => {
    // This is handled internally by UniversalAgent
    return { status: 'approval_requested', message: args?.message };
  },
};

/**
 * Get all meta-tools
 */
export function getMetaTools(): ToolFunction[] {
  return [
    startPlanningTool,
    modifyPlanTool,
    reportProgressTool,
    requestApprovalTool,
  ];
}

/**
 * Check if a tool name is a meta-tool
 */
export function isMetaTool(toolName: string): boolean {
  return toolName.startsWith('_');
}

/**
 * Meta-tool names
 */
export const META_TOOL_NAMES = {
  START_PLANNING: '_start_planning',
  MODIFY_PLAN: '_modify_plan',
  REPORT_PROGRESS: '_report_progress',
  REQUEST_APPROVAL: '_request_approval',
} as const;
