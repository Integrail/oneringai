/**
 * Bash Tool
 *
 * Executes shell commands with timeout and output handling.
 * Provides safe command execution with configurable restrictions.
 *
 * Features:
 * - Configurable timeouts
 * - Output truncation for large outputs
 * - Background execution support
 * - Blocked command patterns for safety
 * - Working directory persistence
 */

import { spawn } from 'node:child_process';
import type { ToolFunction } from '../../domain/entities/Tool.js';
import {
  type ShellToolConfig,
  type BashResult,
  DEFAULT_SHELL_CONFIG,
  isBlockedCommand,
} from './types.js';

/**
 * Arguments for the bash tool
 */
export interface BashArgs {
  /** The command to execute */
  command: string;
  /** Optional timeout in milliseconds (up to 600000ms / 10 minutes) */
  timeout?: number;
  /** Description of what this command does (for clarity) */
  description?: string;
  /** Run the command in the background */
  run_in_background?: boolean;
}

// Track background processes
const backgroundProcesses: Map<string, { process: ReturnType<typeof spawn>; output: string[] }> = new Map();

/**
 * Generate a unique ID for background processes
 */
function generateBackgroundId(): string {
  return `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a Bash tool with the given configuration
 */
export function createBashTool(config: ShellToolConfig = {}): ToolFunction<BashArgs, BashResult> {
  const mergedConfig = { ...DEFAULT_SHELL_CONFIG, ...config };

  return {
    definition: {
      type: 'function',
      function: {
        name: 'bash',
        description: `Execute shell commands with optional timeout.

USAGE:
- Execute any shell command
- Working directory persists between commands
- Commands timeout after 2 minutes by default (configurable up to 10 minutes)
- Large outputs (>100KB) will be truncated

IMPORTANT: This tool is for terminal operations like git, npm, docker, etc.
For file operations, prefer dedicated tools:
- Use read_file instead of cat/head/tail
- Use edit_file instead of sed/awk
- Use write_file instead of echo with redirection
- Use glob instead of find
- Use grep tool instead of grep command

BEST PRACTICES:
- Always quote file paths with spaces: cd "/path with spaces"
- Use absolute paths when possible
- Chain dependent commands with &&: git add . && git commit -m "msg"
- Use ; only when you don't care if earlier commands fail
- Avoid interactive commands (no -i flags)

GIT SAFETY:
- NEVER run destructive commands (push --force, reset --hard, clean -f) without explicit permission
- NEVER update git config
- NEVER skip hooks (--no-verify) without permission
- Always create NEW commits rather than amending
- Stage specific files rather than using "git add -A"

EXAMPLES:
- Run npm install: { "command": "npm install", "description": "Install dependencies" }
- Check git status: { "command": "git status", "description": "Show working tree status" }
- Run tests: { "command": "npm test", "timeout": 300000, "description": "Run test suite" }
- Build project: { "command": "npm run build", "description": "Build the project" }`,
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute',
            },
            timeout: {
              type: 'number',
              description: 'Optional timeout in milliseconds (max 600000ms / 10 minutes)',
            },
            description: {
              type: 'string',
              description: 'Clear, concise description of what this command does',
            },
            run_in_background: {
              type: 'boolean',
              description: 'Run the command in the background. Returns immediately with a background ID.',
            },
          },
          required: ['command'],
        },
      },
    },

    execute: async (args: BashArgs): Promise<BashResult> => {
      const {
        command,
        timeout = mergedConfig.defaultTimeout,
        run_in_background = false,
      } = args;

      // Check for blocked commands
      const blockCheck = isBlockedCommand(command, mergedConfig);
      if (blockCheck.blocked) {
        return {
          success: false,
          error: `Command blocked for safety: ${blockCheck.reason}`,
        };
      }

      // Validate timeout
      const effectiveTimeout = Math.min(timeout, mergedConfig.maxTimeout);

      // Prepare environment
      const env = {
        ...process.env,
        ...mergedConfig.env,
      };

      return new Promise((resolve) => {
        const startTime = Date.now();

        // Spawn the process
        const childProcess = spawn(command, [], {
          shell: mergedConfig.shell,
          cwd: mergedConfig.workingDirectory,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Handle background execution
        if (run_in_background && mergedConfig.allowBackground) {
          const bgId = generateBackgroundId();
          const output: string[] = [];

          backgroundProcesses.set(bgId, { process: childProcess, output });

          childProcess.stdout.on('data', (data) => {
            output.push(data.toString());
          });

          childProcess.stderr.on('data', (data) => {
            output.push(data.toString());
          });

          childProcess.on('close', () => {
            // Keep output for a while after completion
            setTimeout(() => {
              backgroundProcesses.delete(bgId);
            }, 300000); // 5 minutes
          });

          resolve({
            success: true,
            backgroundId: bgId,
            stdout: `Command started in background with ID: ${bgId}`,
          });
          return;
        }

        let stdout = '';
        let stderr = '';
        let killed = false;

        // Set up timeout
        const timeoutId = setTimeout(() => {
          killed = true;
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);
        }, effectiveTimeout);

        // Collect stdout
        childProcess.stdout.on('data', (data) => {
          stdout += data.toString();
          // Prevent memory issues with huge outputs
          if (stdout.length > mergedConfig.maxOutputSize * 2) {
            stdout = stdout.slice(-mergedConfig.maxOutputSize);
          }
        });

        // Collect stderr
        childProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          if (stderr.length > mergedConfig.maxOutputSize * 2) {
            stderr = stderr.slice(-mergedConfig.maxOutputSize);
          }
        });

        // Handle process completion
        childProcess.on('close', (code, signal) => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;

          // Truncate output if needed
          let truncated = false;
          if (stdout.length > mergedConfig.maxOutputSize) {
            stdout = stdout.slice(0, mergedConfig.maxOutputSize) + '\n... (output truncated)';
            truncated = true;
          }
          if (stderr.length > mergedConfig.maxOutputSize) {
            stderr = stderr.slice(0, mergedConfig.maxOutputSize) + '\n... (output truncated)';
            truncated = true;
          }

          if (killed) {
            resolve({
              success: false,
              stdout,
              stderr,
              exitCode: code ?? undefined,
              signal: signal ?? undefined,
              duration,
              truncated,
              error: `Command timed out after ${effectiveTimeout}ms`,
            });
          } else {
            resolve({
              success: code === 0,
              stdout,
              stderr,
              exitCode: code ?? undefined,
              signal: signal ?? undefined,
              duration,
              truncated,
              error: code !== 0 ? `Command exited with code ${code}` : undefined,
            });
          }
        });

        // Handle spawn errors
        childProcess.on('error', (error) => {
          clearTimeout(timeoutId);
          resolve({
            success: false,
            error: `Failed to execute command: ${error.message}`,
            duration: Date.now() - startTime,
          });
        });
      });
    },
  };
}

/**
 * Get output from a background process
 */
export function getBackgroundOutput(bgId: string): { found: boolean; output?: string; running?: boolean } {
  const bg = backgroundProcesses.get(bgId);
  if (!bg) {
    return { found: false };
  }

  return {
    found: true,
    output: bg.output.join(''),
    running: !bg.process.killed && bg.process.exitCode === null,
  };
}

/**
 * Kill a background process
 */
export function killBackgroundProcess(bgId: string): boolean {
  const bg = backgroundProcesses.get(bgId);
  if (!bg) {
    return false;
  }

  bg.process.kill('SIGTERM');
  return true;
}

/**
 * Default Bash tool instance
 */
export const bash = createBashTool();
