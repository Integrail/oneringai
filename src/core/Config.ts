/**
 * Global Configuration
 *
 * Singleton wrapper around ConfigLoader for global library configuration.
 */

import type { OneRingAIConfig } from '../domain/entities/MCPConfig.js';
import { ConfigLoader } from '../infrastructure/config/ConfigLoader.js';

/**
 * Global configuration singleton
 */
export class Config {
  private static instance: OneRingAIConfig | null = null;
  private static loaded = false;

  /**
   * Load configuration from file
   * If no path provided, searches default locations
   */
  static async load(path?: string): Promise<OneRingAIConfig> {
    this.instance = await ConfigLoader.load(path);
    this.loaded = true;
    return this.instance;
  }

  /**
   * Load configuration synchronously
   */
  static loadSync(path?: string): OneRingAIConfig {
    this.instance = ConfigLoader.loadSync(path);
    this.loaded = true;
    return this.instance;
  }

  /**
   * Get the current configuration
   * Returns null if not loaded
   */
  static get(): OneRingAIConfig | null {
    return this.instance;
  }

  /**
   * Get a specific section of the configuration
   */
  static getSection<K extends keyof OneRingAIConfig>(section: K): OneRingAIConfig[K] | undefined {
    return this.instance?.[section];
  }

  /**
   * Check if configuration is loaded
   */
  static isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Reload configuration from file
   */
  static async reload(path?: string): Promise<OneRingAIConfig> {
    return this.load(path);
  }

  /**
   * Set configuration programmatically
   * Useful for testing or runtime configuration
   */
  static set(config: OneRingAIConfig): void {
    this.instance = config;
    this.loaded = true;
  }

  /**
   * Clear configuration (for testing)
   */
  static clear(): void {
    this.instance = null;
    this.loaded = false;
  }
}
