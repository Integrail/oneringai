/**
 * Shell Tools - Shared Types
 *
 * Common types and configuration for shell command execution.
 */

/**
 * Configuration for shell tools
 */
export interface ShellToolConfig {
  /**
   * Working directory for command execution.
   * Defaults to process.cwd()
   */
  workingDirectory?: string;

  /**
   * Default timeout for commands in milliseconds.
   * Default: 120000 (2 minutes)
   */
  defaultTimeout?: number;

  /**
   * Maximum timeout allowed in milliseconds.
   * Default: 600000 (10 minutes)
   */
  maxTimeout?: number;

  /**
   * Shell to use for command execution.
   * Default: '/bin/bash' on Unix, 'cmd.exe' on Windows
   */
  shell?: string;

  /**
   * Environment variables to add to command execution.
   */
  env?: Record<string, string>;

  /**
   * Commands that are blocked from execution.
   * Default: dangerous commands like rm -rf /
   */
  blockedCommands?: string[];

  /**
   * Patterns that if matched will block the command.
   * Default: patterns that could cause data loss
   */
  blockedPatterns?: RegExp[];

  /**
   * Soft ceiling on in-memory output buffer per command, in characters.
   * Purely a process-memory safeguard — the bash tool uses a rolling tail
   * buffer so a runaway command that writes gigabytes cannot OOM the host.
   * The FULL buffer up to this ceiling is returned to the caller verbatim
   * (no head-clip). Default: 10_000_000 (10MB), which fits a typical LLM's
   * context window many times over and only kicks in on genuinely runaway
   * commands. Lower only if you have tight memory constraints.
   */
  maxOutputSize?: number;

  /**
   * Whether to allow running commands in background.
   * Default: true
   */
  allowBackground?: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_SHELL_CONFIG: Required<ShellToolConfig> = {
  workingDirectory: process.cwd(),
  defaultTimeout: 120000, // 2 minutes
  maxTimeout: 600000, // 10 minutes
  shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
  env: {},
  blockedCommands: [
    'rm -rf /',
    'rm -rf /*',
    'rm -rf ~',
    'rm -rf ~/*',
    'mkfs',
    'dd if=/dev/zero',
    ':(){:|:&};:', // Fork bomb
  ],
  blockedPatterns: [
    /rm\s+(-rf?|--recursive)\s+\/(?!\S)/i, // rm -rf / variations
    />\s*\/dev\/sd[a-z]/i, // Writing to disk devices
    /mkfs/i,
    /dd\s+.*of=\/dev\//i, // dd to devices
  ],
  maxOutputSize: 10_000_000,
  allowBackground: true,
};

/**
 * Result of a bash command execution
 */
export interface BashResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  signal?: string;
  duration?: number;
  truncated?: boolean;
  error?: string;
  backgroundId?: string;
}

/**
 * Check if a command should be blocked
 */
export function isBlockedCommand(
  command: string,
  config: ShellToolConfig = {}
): { blocked: boolean; reason?: string } {
  const blockedCommands = config.blockedCommands || DEFAULT_SHELL_CONFIG.blockedCommands;
  const blockedPatterns = config.blockedPatterns || DEFAULT_SHELL_CONFIG.blockedPatterns;

  // Check exact matches
  for (const blocked of blockedCommands) {
    if (command.includes(blocked)) {
      return { blocked: true, reason: `Command contains blocked sequence: "${blocked}"` };
    }
  }

  // Check patterns
  for (const pattern of blockedPatterns) {
    if (pattern.test(command)) {
      return { blocked: true, reason: `Command matches blocked pattern` };
    }
  }

  return { blocked: false };
}
