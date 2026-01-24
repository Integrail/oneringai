/**
 * ConnectorManager - Runtime connector management with filesystem persistence
 *
 * Handles loading, saving, and registering connectors with the Connector registry.
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Connector, Vendor } from '@oneringai/agents';
import type { StoredConnectorConfig, IConnectorManager } from '../config/types.js';

export class ConnectorManager implements IConnectorManager {
  private connectors: Map<string, StoredConnectorConfig> = new Map();
  private registeredConnectors: Set<string> = new Set();
  private dataDir: string;

  constructor(dataDir: string = './data/connectors') {
    this.dataDir = dataDir;
  }

  /**
   * Initialize - load all connectors from disk
   */
  async initialize(): Promise<void> {
    // Ensure directory exists
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
      return;
    }

    // Load all connector files
    const files = await readdir(this.dataDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await readFile(join(this.dataDir, file), 'utf-8');
        const config = JSON.parse(content) as StoredConnectorConfig;
        this.connectors.set(config.name, config);
      } catch (error) {
        console.error(`Failed to load connector ${file}:`, error);
      }
    }
  }

  /**
   * List all connectors
   */
  list(): StoredConnectorConfig[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Get a connector by name
   */
  get(name: string): StoredConnectorConfig | null {
    return this.connectors.get(name) || null;
  }

  /**
   * Add a new connector
   */
  async add(config: StoredConnectorConfig): Promise<void> {
    // Validate
    if (this.connectors.has(config.name)) {
      throw new Error(`Connector "${config.name}" already exists`);
    }

    // Save to memory
    this.connectors.set(config.name, config);

    // Persist to disk
    await this.saveConnector(config);
  }

  /**
   * Update an existing connector
   */
  async update(name: string, updates: Partial<StoredConnectorConfig>): Promise<void> {
    const existing = this.connectors.get(name);
    if (!existing) {
      throw new Error(`Connector "${name}" not found`);
    }

    const updated: StoredConnectorConfig = {
      ...existing,
      ...updates,
      name, // Name cannot change
      updatedAt: Date.now(),
    };

    this.connectors.set(name, updated);
    await this.saveConnector(updated);

    // If registered, re-register with new config
    if (this.registeredConnectors.has(name)) {
      this.unregisterConnector(name);
      this.registerConnector(name);
    }
  }

  /**
   * Delete a connector
   */
  async delete(name: string): Promise<void> {
    if (!this.connectors.has(name)) {
      throw new Error(`Connector "${name}" not found`);
    }

    // Unregister if registered
    if (this.registeredConnectors.has(name)) {
      this.unregisterConnector(name);
    }

    // Remove from memory
    this.connectors.delete(name);

    // Remove from disk
    const filePath = join(this.dataDir, `${name}.json`);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  /**
   * Register a connector with the Connector registry
   */
  registerConnector(name: string): void {
    const config = this.connectors.get(name);
    if (!config) {
      throw new Error(`Connector "${name}" not found`);
    }

    if (this.registeredConnectors.has(name)) {
      return; // Already registered
    }

    // Map vendor string to Vendor enum
    const vendorMap: Record<string, string> = {
      openai: Vendor.OpenAI,
      anthropic: Vendor.Anthropic,
      google: Vendor.Google,
      'google-vertex': Vendor.GoogleVertex,
      groq: Vendor.Groq,
      together: Vendor.Together,
      grok: Vendor.Grok,
      deepseek: Vendor.DeepSeek,
      mistral: Vendor.Mistral,
      perplexity: Vendor.Perplexity,
      ollama: Vendor.Ollama,
      custom: Vendor.Custom,
    };

    const vendor = vendorMap[config.vendor.toLowerCase()] || Vendor.Custom;

    // Build auth config based on type
    let auth: { type: 'api_key'; apiKey: string } | {
      type: 'oauth';
      flow: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
      clientId: string;
      clientSecret?: string;
      tokenUrl: string;
      authorizationUrl?: string;
      scope?: string;
    };

    if (config.auth.type === 'api_key' && config.auth.apiKey) {
      auth = { type: 'api_key', apiKey: config.auth.apiKey };
    } else if (config.auth.type === 'oauth') {
      auth = {
        type: 'oauth',
        flow: 'client_credentials', // Default flow
        clientId: config.auth.clientId || '',
        clientSecret: config.auth.clientSecret,
        tokenUrl: config.auth.tokenUrl || '',
        authorizationUrl: config.auth.authorizationUrl,
        scope: config.auth.scope,
      };
    } else {
      throw new Error(`Unsupported auth type: ${config.auth.type}`);
    }

    // Register with Connector
    Connector.create({
      name: config.name,
      vendor: vendor as typeof Vendor[keyof typeof Vendor],
      auth,
      baseURL: config.baseURL,
      options: config.options,
    });

    this.registeredConnectors.add(name);
  }

  /**
   * Unregister a connector
   */
  unregisterConnector(name: string): void {
    if (!this.registeredConnectors.has(name)) {
      return;
    }

    // Connector class doesn't have a remove method, but we track our own state
    // In a real implementation, we'd want Connector.remove(name)
    this.registeredConnectors.delete(name);
  }

  /**
   * Check if a connector is registered
   */
  isRegistered(name: string): boolean {
    // Check both our tracking and the actual Connector registry
    return this.registeredConnectors.has(name) || Connector.has(name);
  }

  /**
   * Get all connectors for a vendor
   */
  getVendorConnectors(vendor: string): StoredConnectorConfig[] {
    return this.list().filter(
      (c) => c.vendor.toLowerCase() === vendor.toLowerCase()
    );
  }

  /**
   * Get available models for a connector
   */
  getModelsForConnector(name: string): string[] {
    const config = this.connectors.get(name);
    return config?.models || [];
  }

  /**
   * Save a connector to disk
   */
  private async saveConnector(config: StoredConnectorConfig): Promise<void> {
    // Ensure directory exists
    if (!existsSync(this.dataDir)) {
      await mkdir(this.dataDir, { recursive: true });
    }

    const filePath = join(this.dataDir, `${config.name}.json`);
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
