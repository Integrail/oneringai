/**
 * ConfigManager - Handles app configuration persistence
 *
 * Loads, saves, and manages the AMOS configuration file.
 * Uses filesystem for persistence.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AmosConfig, DEFAULT_CONFIG } from './types.js';

export class ConfigManager {
  private config: AmosConfig;
  private configPath: string;
  private dirty: boolean = false;

  constructor(dataDir: string = './data') {
    this.configPath = join(dataDir, 'config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<AmosConfig> {
    try {
      if (existsSync(this.configPath)) {
        const content = await readFile(this.configPath, 'utf-8');
        const loaded = JSON.parse(content) as Partial<AmosConfig>;
        // Deep merge with defaults to ensure all fields exist
        this.config = this.deepMerge(
          DEFAULT_CONFIG as unknown as Record<string, unknown>,
          loaded as unknown as Record<string, unknown>
        ) as unknown as AmosConfig;
      } else {
        // Create default config
        this.config = { ...DEFAULT_CONFIG };
        await this.save();
      }
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
      this.config = { ...DEFAULT_CONFIG };
    }

    this.dirty = false;
    return this.config;
  }

  /**
   * Save configuration to disk
   */
  async save(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      this.dirty = false;
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  get(): AmosConfig {
    return this.config;
  }

  /**
   * Update configuration with partial values
   */
  update(partial: Partial<AmosConfig>): void {
    this.config = this.deepMerge(
      this.config as unknown as Record<string, unknown>,
      partial as unknown as Record<string, unknown>
    ) as unknown as AmosConfig;
    this.dirty = true;
  }

  /**
   * Set a specific config value by path
   */
  set<T>(path: string, value: T): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    this.dirty = true;
  }

  /**
   * Get a specific config value by path
   */
  getValue<T>(path: string, defaultValue?: T): T | undefined {
    const parts = path.split('.');
    let current: unknown = this.config;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return defaultValue;
      }
      if (typeof current !== 'object') {
        return defaultValue;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return (current as T) ?? defaultValue;
  }

  /**
   * Check if config has unsaved changes
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.dirty = true;
  }

  /**
   * Deep merge two objects
   */
  private deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }

    return result;
  }
}
