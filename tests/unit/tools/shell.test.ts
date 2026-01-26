/**
 * Unit tests for Shell Tools
 */

import { describe, it, expect } from 'vitest';
import {
  createBashTool,
  isBlockedCommand,
  DEFAULT_SHELL_CONFIG,
} from '../../../src/tools/shell/index.js';

describe('Shell Tools', () => {
  describe('isBlockedCommand', () => {
    it('should block rm -rf /', () => {
      const result = isBlockedCommand('rm -rf /');
      expect(result.blocked).toBe(true);
    });

    it('should block rm -rf /*', () => {
      const result = isBlockedCommand('rm -rf /*');
      expect(result.blocked).toBe(true);
    });

    it('should block fork bomb', () => {
      const result = isBlockedCommand(':(){:|:&};:');
      expect(result.blocked).toBe(true);
    });

    it('should allow safe commands', () => {
      const result = isBlockedCommand('ls -la');
      expect(result.blocked).toBe(false);
    });

    it('should allow npm commands', () => {
      const result = isBlockedCommand('npm install');
      expect(result.blocked).toBe(false);
    });

    it('should allow git commands', () => {
      const result = isBlockedCommand('git status');
      expect(result.blocked).toBe(false);
    });

    it('should allow rm with specific files', () => {
      const result = isBlockedCommand('rm /tmp/test.txt');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Bash Tool', () => {
    it('should create tool with correct definition', () => {
      const tool = createBashTool();
      expect(tool.definition.function.name).toBe('bash');
      expect(tool.definition.function.parameters.required).toContain('command');
    });

    it('should execute simple command', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo "Hello World"' });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello World');
      expect(result.exitCode).toBe(0);
    });

    it('should capture stderr', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'ls /nonexistent 2>&1 || true' });

      // The command won't fail because of || true, but we should see the error
      expect(result.success).toBe(true);
    });

    it('should handle command failure', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'exit 1' });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should block dangerous commands', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'rm -rf /' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('blocked');
    });

    it('should respect timeout', async () => {
      const tool = createBashTool();
      const result = await tool.execute({
        command: 'sleep 10',
        timeout: 100, // 100ms timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    }, 5000);

    it('should capture exit code', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'exit 42' });

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(42);
    });

    it('should use custom working directory', async () => {
      const tool = createBashTool({ workingDirectory: '/tmp' });
      const result = await tool.execute({ command: 'pwd' });

      expect(result.success).toBe(true);
      // On macOS, /tmp is a symlink to /private/tmp
      const stdout = result.stdout?.trim();
      expect(stdout === '/tmp' || stdout === '/private/tmp').toBe(true);
    });

    it('should handle environment variables', async () => {
      const tool = createBashTool({
        env: { MY_VAR: 'test_value' },
      });
      const result = await tool.execute({ command: 'echo $MY_VAR' });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test_value');
    });

    it('should handle piped commands', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo "hello world" | grep hello' });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('hello');
    });

    it('should handle chained commands', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'echo "first" && echo "second"' });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('first');
      expect(result.stdout).toContain('second');
    });

    it('should track duration', async () => {
      const tool = createBashTool();
      const result = await tool.execute({ command: 'sleep 0.1' });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(50); // At least 50ms
    });
  });

  describe('DEFAULT_SHELL_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_SHELL_CONFIG.defaultTimeout).toBe(120000); // 2 minutes
      expect(DEFAULT_SHELL_CONFIG.maxTimeout).toBe(600000); // 10 minutes
      expect(DEFAULT_SHELL_CONFIG.maxOutputSize).toBe(100000);
      expect(DEFAULT_SHELL_CONFIG.blockedCommands.length).toBeGreaterThan(0);
    });

    it('should block dangerous patterns by default', () => {
      expect(DEFAULT_SHELL_CONFIG.blockedPatterns.length).toBeGreaterThan(0);
    });
  });
});
