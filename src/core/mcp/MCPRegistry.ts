/**
 * MCP Registry
 *
 * Static registry for managing MCP client connections.
 * Follows the same pattern as Connector registry.
 */

import { MCPClient } from './MCPClient.js';
import type { IMCPClient } from '../../domain/interfaces/IMCPClient.js';
import type { MCPServerConfig, MCPConfiguration, OneRingAIConfig } from '../../domain/entities/MCPConfig.js';
import { MCPError } from '../../domain/errors/MCPError.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

/**
 * MCP Registry - static registry for MCP clients
 */
export class MCPRegistry {
  private static clients = new Map<string, IMCPClient>();

  /**
   * Create and register an MCP client
   */
  static create(config: MCPServerConfig, defaults?: MCPConfiguration['defaults']): IMCPClient {
    if (this.clients.has(config.name)) {
      throw new MCPError(`MCP server '${config.name}' is already registered`);
    }

    const client = new MCPClient(config, defaults);
    this.clients.set(config.name, client);

    return client;
  }

  /**
   * Get a registered MCP client
   */
  static get(name: string): IMCPClient {
    const client = this.clients.get(name);
    if (!client) {
      throw new MCPError(`MCP server '${name}' not found in registry`);
    }
    return client;
  }

  /**
   * Check if an MCP client is registered
   */
  static has(name: string): boolean {
    return this.clients.has(name);
  }

  /**
   * List all registered MCP client names
   */
  static list(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get info about a registered MCP client
   */
  static getInfo(name: string): {
    name: string;
    state: string;
    connected: boolean;
    toolCount: number;
  } {
    const client = this.get(name);
    return {
      name: client.name,
      state: client.state,
      connected: client.isConnected(),
      toolCount: client.tools.length,
    };
  }

  /**
   * Get info about all registered MCP clients
   */
  static getAllInfo(): Array<{
    name: string;
    state: string;
    connected: boolean;
    toolCount: number;
  }> {
    return Array.from(this.clients.keys()).map((name) => this.getInfo(name));
  }

  /**
   * Create multiple clients from MCP configuration
   */
  static createFromConfig(config: MCPConfiguration): IMCPClient[] {
    const clients: IMCPClient[] = [];

    for (const serverConfig of config.servers) {
      const client = this.create(serverConfig, config.defaults);
      clients.push(client);
    }

    return clients;
  }

  /**
   * Load MCP configuration from file and create clients
   */
  static async loadFromConfigFile(path: string): Promise<IMCPClient[]> {
    try {
      const configPath = resolve(path);
      const content = await fs.readFile(configPath, 'utf-8');
      const config: OneRingAIConfig = JSON.parse(content);

      if (!config.mcp) {
        throw new MCPError('Configuration file does not contain MCP section');
      }

      // Apply environment variable interpolation
      const interpolatedConfig = this.interpolateEnvVars(config.mcp);

      return this.createFromConfig(interpolatedConfig);
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      throw new MCPError(`Failed to load MCP configuration from '${path}'`, undefined, error as Error);
    }
  }

  /**
   * Connect all servers with autoConnect enabled
   */
  static async connectAll(): Promise<void> {
    const connectPromises: Promise<void>[] = [];

    for (const client of this.clients.values()) {
      if (!client.isConnected()) {
        connectPromises.push(client.connect());
      }
    }

    await Promise.all(connectPromises);
  }

  /**
   * Disconnect all servers
   */
  static async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const client of this.clients.values()) {
      if (client.isConnected()) {
        disconnectPromises.push(client.disconnect());
      }
    }

    await Promise.all(disconnectPromises);
  }

  /**
   * Remove and destroy a specific client from the registry
   * @param name - Name of the MCP server to remove
   * @returns true if the server was found and removed, false otherwise
   */
  static remove(name: string): boolean {
    const client = this.clients.get(name);
    if (!client) {
      return false;
    }
    client.destroy();
    this.clients.delete(name);
    return true;
  }

  /**
   * Destroy all clients and clear registry
   */
  static destroyAll(): void {
    for (const client of this.clients.values()) {
      client.destroy();
    }
    this.clients.clear();
  }

  /**
   * Clear the registry (for testing)
   */
  static clear(): void {
    this.destroyAll();
  }

  /**
   * Interpolate environment variables in configuration
   * Replaces ${ENV_VAR} with process.env.ENV_VAR
   */
  private static interpolateEnvVars(config: MCPConfiguration): MCPConfiguration {
    const jsonString = JSON.stringify(config);
    const interpolated = jsonString.replace(/\$\{([^}]+)\}/g, (_match, envVar) => {
      const value = process.env[envVar];
      if (value === undefined) {
        throw new MCPError(`Environment variable '${envVar}' is not set`);
      }
      return value;
    });

    return JSON.parse(interpolated);
  }
}
