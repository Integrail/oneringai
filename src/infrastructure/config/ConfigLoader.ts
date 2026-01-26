/**
 * Configuration Loader
 *
 * Loads and parses oneringai.config.json with environment variable interpolation.
 */

import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { homedir } from 'os';
import type { OneRingAIConfig } from '../../domain/entities/MCPConfig.js';

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private static DEFAULT_PATHS = [
    './oneringai.config.json',
    join(homedir(), '.oneringai', 'config.json'),
  ];

  /**
   * Load configuration from file
   */
  static async load(path?: string): Promise<OneRingAIConfig> {
    const configPath = path ? resolve(path) : await this.findConfig();

    if (!configPath) {
      throw new Error('Configuration file not found. Searched: ' + this.DEFAULT_PATHS.join(', '));
    }

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      let config: OneRingAIConfig = JSON.parse(content);

      // Interpolate environment variables
      config = this.interpolateEnvVars(config);

      // Validate configuration
      this.validate(config);

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file '${configPath}': ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Load configuration synchronously
   */
  static loadSync(path?: string): OneRingAIConfig {
    const configPath = path ? resolve(path) : this.findConfigSync();

    if (!configPath) {
      throw new Error('Configuration file not found. Searched: ' + this.DEFAULT_PATHS.join(', '));
    }

    try {
      const fs = require('fs');
      const content = fs.readFileSync(configPath, 'utf-8');
      let config: OneRingAIConfig = JSON.parse(content);

      // Interpolate environment variables
      config = this.interpolateEnvVars(config);

      // Validate configuration
      this.validate(config);

      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file '${configPath}': ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Find configuration file in default paths
   */
  private static async findConfig(): Promise<string | null> {
    for (const path of this.DEFAULT_PATHS) {
      try {
        await fs.access(resolve(path));
        return resolve(path);
      } catch {
        // Continue searching
      }
    }
    return null;
  }

  /**
   * Find configuration file synchronously
   */
  private static findConfigSync(): string | null {
    const fs = require('fs');
    for (const path of this.DEFAULT_PATHS) {
      try {
        fs.accessSync(resolve(path));
        return resolve(path);
      } catch {
        // Continue searching
      }
    }
    return null;
  }

  /**
   * Interpolate environment variables in configuration
   * Replaces ${ENV_VAR} with process.env.ENV_VAR
   */
  private static interpolateEnvVars(config: OneRingAIConfig): OneRingAIConfig {
    const jsonString = JSON.stringify(config);
    const interpolated = jsonString.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const value = process.env[envVar];
      if (value === undefined) {
        // Don't fail on missing env vars, just keep the placeholder
        console.warn(`Warning: Environment variable '${envVar}' is not set`);
        return match;
      }
      return value;
    });

    return JSON.parse(interpolated);
  }

  /**
   * Basic validation of configuration structure
   */
  private static validate(config: OneRingAIConfig): void {
    if (typeof config !== 'object' || config === null) {
      throw new Error('Configuration must be an object');
    }

    // Validate MCP section if present
    if (config.mcp) {
      if (!Array.isArray(config.mcp.servers)) {
        throw new Error('MCP configuration must have a "servers" array');
      }

      for (const server of config.mcp.servers) {
        if (!server.name) {
          throw new Error('Each MCP server must have a "name" field');
        }
        if (!server.transport) {
          throw new Error(`MCP server '${server.name}' must have a "transport" field`);
        }
        if (!server.transportConfig) {
          throw new Error(`MCP server '${server.name}' must have a "transportConfig" field`);
        }
      }
    }
  }
}
