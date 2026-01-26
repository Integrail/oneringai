/**
 * Shell Tools
 *
 * Tools for executing shell commands and managing processes.
 *
 * Available tools:
 * - bash: Execute shell commands
 *
 * @example
 * ```typescript
 * import { tools } from '@oneringai/agents';
 *
 * const agent = Agent.create({
 *   connector: 'openai',
 *   model: 'gpt-4',
 *   tools: [tools.bash]
 * });
 * ```
 */

// Types
export type {
  ShellToolConfig,
  BashResult,
} from './types.js';

export {
  DEFAULT_SHELL_CONFIG,
  isBlockedCommand,
} from './types.js';

// Bash Tool
export {
  bash,
  createBashTool,
  getBackgroundOutput,
  killBackgroundProcess,
} from './bash.js';
