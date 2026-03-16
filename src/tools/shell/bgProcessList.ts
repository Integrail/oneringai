/**
 * Background Process List Tool
 *
 * List all tracked background processes with their status and metadata.
 */

import type { ToolFunction } from '../../domain/entities/Tool.js';
import { BackgroundProcessManager } from './BackgroundProcessManager.js';

export interface BgProcessListArgs {
  /** Filter by status: 'all' (default), 'running', 'exited' */
  status?: string;
}

export interface BgProcessListResult {
  success: boolean;
  processes: Array<{
    id: string;
    command: string;
    status: string;
    pid: number | undefined;
    exitCode: number | null;
    startedAt: string;
    exitedAt: string | null;
    totalOutputLines: number;
  }>;
  count: number;
  runningCount: number;
  message?: string;
}

export function createBgProcessListTool(): ToolFunction<BgProcessListArgs, BgProcessListResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'bg_process_list',
        description:
          `List all background processes and their current status. Use this to: see what background processes are running (dev servers, watchers, builds), find a process ID you forgot, check if a background command has finished or crashed, get an overview before deciding what to kill or restart.

Returns each process with: ID (for use with bg_process_output/bg_process_kill), the original command, status (running/exited/killed/errored), PID, exit code, start time, and total output lines. Running processes are listed first.`,
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['all', 'running', 'exited'],
              description: 'Filter by status. "all" (default) shows everything. "running" shows only active processes. "exited" shows completed/killed/errored processes.',
            },
          },
          required: [],
        },
      },
    },

    permission: { scope: 'always' as const, riskLevel: 'low' as const },

    describeCall: (args: BgProcessListArgs): string => {
      if (args.status && args.status !== 'all') return `Listing ${args.status} background processes`;
      return 'Listing background processes';
    },

    execute: async (args: BgProcessListArgs): Promise<BgProcessListResult> => {
      let processes = BackgroundProcessManager.list();

      // Filter by status
      if (args.status === 'running') {
        processes = processes.filter((p) => p.status === 'running');
      } else if (args.status === 'exited') {
        processes = processes.filter((p) => p.status !== 'running');
      }

      const runningCount = processes.filter((p) => p.status === 'running').length;

      const result: BgProcessListResult = {
        success: true,
        processes: processes.map((p) => ({
          id: p.id,
          command: p.command,
          status: p.status,
          pid: p.pid,
          exitCode: p.exitCode,
          startedAt: p.startedAt,
          exitedAt: p.exitedAt,
          totalOutputLines: p.totalOutputLines,
        })),
        count: processes.length,
        runningCount,
      };

      if (processes.length === 0) {
        result.message = 'No background processes. Use the bash tool with run_in_background=true to start one.';
      }

      return result;
    },
  };
}

/**
 * Default bg_process_list tool instance
 */
export const bgProcessList = createBgProcessListTool();
