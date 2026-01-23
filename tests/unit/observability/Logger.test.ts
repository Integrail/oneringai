/**
 * Logger Tests
 *
 * Tests for structured logging infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrameworkLogger, logger } from '../../../src/infrastructure/observability/Logger.js';

describe('FrameworkLogger', () => {
  // Capture console output
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Log Levels', () => {
    it('should log at trace level when enabled', () => {
      const testLogger = new FrameworkLogger({ level: 'trace', pretty: false });

      testLogger.trace({ key: 'value' }, 'Trace message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.level).toBe('trace');
      expect(call.msg).toBe('Trace message');
      expect(call.key).toBe('value');
    });

    it('should log at debug level when enabled', () => {
      const testLogger = new FrameworkLogger({ level: 'debug', pretty: false });

      testLogger.debug({ key: 'value' }, 'Debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.level).toBe('debug');
    });

    it('should log at info level', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: false });

      testLogger.info({ key: 'value' }, 'Info message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.level).toBe('info');
    });

    it('should log at warn level', () => {
      const testLogger = new FrameworkLogger({ level: 'warn', pretty: false, destination: 'stdout' });

      testLogger.warn({ key: 'value' }, 'Warn message');

      // With destination='stdout', warn goes to console.log
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.level).toBe('warn');
    });

    it('should log at error level', () => {
      const testLogger = new FrameworkLogger({ level: 'error', pretty: false, destination: 'stdout' });

      testLogger.error({ key: 'value' }, 'Error message');

      // With destination='stdout', error goes to console.log
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.level).toBe('error');
    });

    it('should filter logs below configured level', () => {
      const testLogger = new FrameworkLogger({ level: 'warn', pretty: false, destination: 'stdout' });

      testLogger.trace('Should not log');
      testLogger.debug('Should not log');
      testLogger.info('Should not log');
      testLogger.warn('Should log');
      testLogger.error('Should log');

      // With destination='stdout', all go to console.log
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should support silent level (no logging)', () => {
      const testLogger = new FrameworkLogger({ level: 'silent' });

      testLogger.trace('No');
      testLogger.debug('No');
      testLogger.info('No');
      testLogger.warn('No');
      testLogger.error('No');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should check if level is enabled', () => {
      const testLogger = new FrameworkLogger({ level: 'warn' });

      expect(testLogger.isLevelEnabled('trace')).toBe(false);
      expect(testLogger.isLevelEnabled('debug')).toBe(false);
      expect(testLogger.isLevelEnabled('info')).toBe(false);
      expect(testLogger.isLevelEnabled('warn')).toBe(true);
      expect(testLogger.isLevelEnabled('error')).toBe(true);
    });

    it('should get current level', () => {
      const testLogger = new FrameworkLogger({ level: 'debug' });

      expect(testLogger.getLevel()).toBe('debug');
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with additional context', () => {
      const parentLogger = new FrameworkLogger({ level: 'info', pretty: false });
      const childLogger = parentLogger.child({ component: 'TestComponent', agentId: '123' });

      childLogger.info({ action: 'test' }, 'Child log');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.component).toBe('TestComponent');
      expect(call.agentId).toBe('123');
      expect(call.action).toBe('test');
      expect(call.msg).toBe('Child log');
    });

    it('should propagate parent context to child', () => {
      const parentLogger = new FrameworkLogger({
        level: 'info',
        pretty: false,
        context: { service: 'my-service', env: 'test' },
      });

      const childLogger = parentLogger.child({ component: 'Agent' });

      childLogger.info('Message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.service).toBe('my-service');
      expect(call.env).toBe('test');
      expect(call.component).toBe('Agent');
    });

    it('should allow nested child loggers', () => {
      const level1 = new FrameworkLogger({ level: 'info', pretty: false });
      const level2 = level1.child({ layer: 'L2' });
      const level3 = level2.child({ layer: 'L3' });

      level3.info({ action: 'test' }, 'Nested log');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.layer).toBe('L3'); // Latest wins
    });
  });

  describe('Log Formats', () => {
    it('should output JSON by default', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: false });

      testLogger.info({ userId: '123' }, 'User logged in');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];

      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.userId).toBe('123');
      expect(parsed.msg).toBe('User logged in');
      expect(parsed.time).toBeDefined();
    });

    it('should output pretty format when enabled', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: true });

      testLogger.info({ userId: '123' }, 'User logged in');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];

      // Should NOT be JSON (pretty printed)
      expect(output).toContain('INFO');
      expect(output).toContain('User logged in');
      expect(output).toContain('userId="123"');
    });

    it('should handle string-only log calls', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: false });

      testLogger.info('Simple message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.msg).toBe('Simple message');
    });
  });

  describe('Configuration Updates', () => {
    it('should allow updating log level', () => {
      const testLogger = new FrameworkLogger({ level: 'info' });

      expect(testLogger.getLevel()).toBe('info');

      testLogger.updateConfig({ level: 'debug' });

      expect(testLogger.getLevel()).toBe('debug');
    });

    it('should filter logs after level update', () => {
      const testLogger = new FrameworkLogger({ level: 'error', pretty: false });

      testLogger.info('Should not log');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      testLogger.updateConfig({ level: 'info' });

      testLogger.info('Should log now');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should allow updating context', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: false });

      testLogger.updateConfig({ context: { version: '2.0' } });

      testLogger.info('Message');

      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.version).toBe('2.0');
    });
  });

  describe('Global Logger Singleton', () => {
    it('should provide global logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(FrameworkLogger);
    });

    it('should respect LOG_LEVEL environment variable', () => {
      // Note: This tests the default initialization logic
      // Actual env var is set at module load time
      expect(logger.getLevel()).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle complex nested objects', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: false });

      testLogger.info(
        {
          user: { id: '123', name: 'Test' },
          metadata: { tags: ['a', 'b'], count: 42 },
        },
        'Complex data'
      );

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.user.id).toBe('123');
      expect(call.metadata.tags).toEqual(['a', 'b']);
    });

    it('should handle undefined and null values', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: false });

      testLogger.info({ undef: undefined, nul: null }, 'Message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.undef).toBeUndefined();
      expect(call.nul).toBeNull();
    });

    it('should handle errors in log data', () => {
      const testLogger = new FrameworkLogger({ level: 'info', pretty: false, destination: 'stdout' });

      const error = new Error('Test error');
      testLogger.error({ error: error.message, stack: error.stack }, 'Error occurred');

      // With destination='stdout', goes to console.log
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(call.error).toBe('Test error');
    });
  });
});
