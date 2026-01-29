/**
 * ConfigLoader Unit Tests
 *
 * Tests focus on validation and interpolation logic.
 * File I/O is tested through error scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigLoader } from '../../../../src/infrastructure/config/ConfigLoader.js';
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigLoader', () => {
  // Use real temp files for testing
  const testDir = join(tmpdir(), 'configloader-test-' + Date.now());
  const testConfigPath = join(testDir, 'test-config.json');

  const validConfig = {
    version: '1.0',
    mcp: {
      servers: [
        {
          name: 'test-server',
          transport: 'stdio',
          transportConfig: {
            command: 'node',
            args: ['server.js'],
          },
        },
      ],
    },
  };

  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Create test directory
    try {
      mkdirSync(testDir, { recursive: true });
    } catch {
      // Ignore if exists
    }

    // Save environment variables
    savedEnv.TEST_VAR = process.env.TEST_VAR;
    savedEnv.API_KEY = process.env.API_KEY;
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore environment variables
    if (savedEnv.TEST_VAR !== undefined) {
      process.env.TEST_VAR = savedEnv.TEST_VAR;
    } else {
      delete process.env.TEST_VAR;
    }
    if (savedEnv.API_KEY !== undefined) {
      process.env.API_KEY = savedEnv.API_KEY;
    } else {
      delete process.env.API_KEY;
    }
  });

  // ============================================================================
  // load() Tests
  // ============================================================================

  describe('load()', () => {
    it('should load config from explicit path', async () => {
      writeFileSync(testConfigPath, JSON.stringify(validConfig));

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.version).toBe('1.0');
      expect(config.mcp?.servers).toHaveLength(1);
      expect(config.mcp?.servers[0].name).toBe('test-server');
    });

    it('should throw error when config file not found', async () => {
      await expect(ConfigLoader.load('/nonexistent/path/config.json')).rejects.toThrow();
    });

    it('should throw error for invalid JSON', async () => {
      writeFileSync(testConfigPath, '{ invalid json }');

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        /Invalid JSON in configuration file/
      );
    });

    it('should interpolate environment variables', async () => {
      const configWithEnvVars = {
        version: '1.0',
        mcp: {
          servers: [
            {
              name: 'test-server',
              transport: 'stdio',
              transportConfig: {
                command: 'node',
                token: '${TEST_VAR}',
              },
            },
          ],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(configWithEnvVars));
      process.env.TEST_VAR = 'secret-value';

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.mcp?.servers[0].transportConfig.token).toBe('secret-value');
    });

    it('should warn but not fail on missing environment variables', async () => {
      const configWithEnvVars = {
        version: '1.0',
        mcp: {
          servers: [
            {
              name: 'test-server',
              transport: 'stdio',
              transportConfig: {
                command: 'node',
                token: '${UNDEFINED_VAR_12345}',
              },
            },
          ],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(configWithEnvVars));
      delete process.env.UNDEFINED_VAR_12345;

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = await ConfigLoader.load(testConfigPath);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Environment variable 'UNDEFINED_VAR_12345' is not set")
      );
      expect(config.mcp?.servers[0].transportConfig.token).toBe('${UNDEFINED_VAR_12345}');
      warnSpy.mockRestore();
    });

    it('should validate MCP servers array', async () => {
      const invalidConfig = {
        version: '1.0',
        mcp: {
          servers: 'not-an-array',
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        'MCP configuration must have a "servers" array'
      );
    });

    it('should validate server name field', async () => {
      const invalidConfig = {
        version: '1.0',
        mcp: {
          servers: [{ transport: 'stdio', transportConfig: {} }],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        'Each MCP server must have a "name" field'
      );
    });

    it('should validate server transport field', async () => {
      const invalidConfig = {
        version: '1.0',
        mcp: {
          servers: [{ name: 'test', transportConfig: {} }],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        "MCP server 'test' must have a \"transport\" field"
      );
    });

    it('should validate server transportConfig field', async () => {
      const invalidConfig = {
        version: '1.0',
        mcp: {
          servers: [{ name: 'test', transport: 'stdio' }],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(invalidConfig));

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        "MCP server 'test' must have a \"transportConfig\" field"
      );
    });

    it('should accept config without MCP section', async () => {
      const configWithoutMCP = { version: '1.0' };
      writeFileSync(testConfigPath, JSON.stringify(configWithoutMCP));

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.version).toBe('1.0');
      expect(config.mcp).toBeUndefined();
    });

    it('should throw error for non-object config', async () => {
      writeFileSync(testConfigPath, JSON.stringify('string-config'));

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        'Configuration must be an object'
      );
    });

    it('should throw error for null config', async () => {
      writeFileSync(testConfigPath, 'null');

      await expect(ConfigLoader.load(testConfigPath)).rejects.toThrow(
        'Configuration must be an object'
      );
    });
  });

  // ============================================================================
  // loadSync() Tests
  // ============================================================================

  describe('loadSync()', () => {
    it('should load config synchronously from explicit path', () => {
      writeFileSync(testConfigPath, JSON.stringify(validConfig));

      const config = ConfigLoader.loadSync(testConfigPath);

      expect(config.version).toBe('1.0');
      expect(config.mcp?.servers).toHaveLength(1);
    });

    it('should throw error when config file not found synchronously', () => {
      expect(() => ConfigLoader.loadSync('/nonexistent/path/config.json')).toThrow();
    });

    it('should throw error for invalid JSON synchronously', () => {
      writeFileSync(testConfigPath, '{ invalid }');

      expect(() => ConfigLoader.loadSync(testConfigPath)).toThrow(
        /Invalid JSON in configuration file/
      );
    });

    it('should interpolate environment variables synchronously', () => {
      const configWithEnvVars = {
        version: '1.0',
        mcp: {
          servers: [
            {
              name: 'test',
              transport: 'stdio',
              transportConfig: {
                apiKey: '${API_KEY}',
              },
            },
          ],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(configWithEnvVars));
      process.env.API_KEY = 'my-secret-key';

      const config = ConfigLoader.loadSync(testConfigPath);

      expect(config.mcp?.servers[0].transportConfig.apiKey).toBe('my-secret-key');
    });
  });

  // ============================================================================
  // Environment Variable Interpolation Tests
  // ============================================================================

  describe('environment variable interpolation', () => {
    it('should replace multiple environment variables', async () => {
      const configWithMultipleVars = {
        version: '1.0',
        mcp: {
          servers: [
            {
              name: 'test',
              transport: 'stdio',
              transportConfig: {
                host: '${HOST}',
                port: '${PORT}',
                key: '${API_KEY}',
              },
            },
          ],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(configWithMultipleVars));
      process.env.HOST = 'localhost';
      process.env.PORT = '8080';
      process.env.API_KEY = 'secret';

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.mcp?.servers[0].transportConfig.host).toBe('localhost');
      expect(config.mcp?.servers[0].transportConfig.port).toBe('8080');
      expect(config.mcp?.servers[0].transportConfig.key).toBe('secret');

      // Cleanup
      delete process.env.HOST;
      delete process.env.PORT;
    });

    it('should handle nested environment variables', async () => {
      const configWithNestedVars = {
        version: '1.0',
        nested: {
          deep: {
            value: '${NESTED_VAR}',
          },
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(configWithNestedVars));
      process.env.NESTED_VAR = 'deep-value';

      const config = await ConfigLoader.load(testConfigPath);

      expect((config as any).nested.deep.value).toBe('deep-value');

      delete process.env.NESTED_VAR;
    });

    it('should handle environment variables in arrays', async () => {
      const configWithArrayVars = {
        version: '1.0',
        mcp: {
          servers: [
            {
              name: 'test',
              transport: 'stdio',
              transportConfig: {
                command: 'node',
                args: ['${ARG1}', '${ARG2}'],
              },
            },
          ],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(configWithArrayVars));
      process.env.ARG1 = 'first';
      process.env.ARG2 = 'second';

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.mcp?.servers[0].transportConfig.args).toEqual(['first', 'second']);

      delete process.env.ARG1;
      delete process.env.ARG2;
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('validation', () => {
    it('should accept valid config with all fields', async () => {
      const fullConfig = {
        version: '1.0',
        mcp: {
          servers: [
            {
              name: 'server1',
              transport: 'stdio',
              transportConfig: { command: 'node' },
            },
            {
              name: 'server2',
              transport: 'sse',
              transportConfig: { url: 'http://localhost:3000' },
            },
          ],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(fullConfig));

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.mcp?.servers).toHaveLength(2);
    });

    it('should accept empty MCP servers array', async () => {
      const configWithEmptyServers = {
        version: '1.0',
        mcp: {
          servers: [],
        },
      };
      writeFileSync(testConfigPath, JSON.stringify(configWithEmptyServers));

      const config = await ConfigLoader.load(testConfigPath);

      expect(config.mcp?.servers).toEqual([]);
    });
  });
});
