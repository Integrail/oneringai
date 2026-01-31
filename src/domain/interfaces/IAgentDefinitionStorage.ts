/**
 * IAgentDefinitionStorage - Storage interface for Agent configuration persistence
 *
 * Provides persistence operations for agent definitions (configuration, model, system prompt, etc.).
 * This allows agents to be instantiated from stored configurations.
 *
 * This follows Clean Architecture - the interface is in domain layer,
 * implementations are in infrastructure layer.
 */

import type { AgentContextFeatures } from '../../core/AgentContext.js';

/**
 * Agent type identifier
 */
export type StoredAgentType = 'agent' | 'task-agent' | 'universal-agent' | 'research-agent' | string;

/**
 * Stored agent definition - everything needed to recreate an agent
 */
export interface StoredAgentDefinition {
  /** Format version for migration support */
  version: number;

  /** Unique agent identifier */
  agentId: string;

  /** Human-readable agent name */
  name: string;

  /** Agent type */
  agentType: StoredAgentType;

  /** When the definition was created */
  createdAt: string; // ISO string

  /** When the definition was last updated */
  updatedAt: string; // ISO string

  /** Connector configuration */
  connector: {
    /** Connector name (must be registered at runtime) */
    name: string;
    /** Model to use */
    model: string;
  };

  /** System prompt */
  systemPrompt?: string;

  /** Instructions */
  instructions?: string;

  /** Feature configuration */
  features?: AgentContextFeatures;

  /** Agent metadata */
  metadata?: AgentDefinitionMetadata;

  /** Agent-type-specific configuration */
  typeConfig?: Record<string, unknown>;
}

/**
 * Agent definition metadata
 */
export interface AgentDefinitionMetadata {
  /** Description of what this agent does */
  description?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Author/creator */
  author?: string;

  /** Custom key-value data */
  [key: string]: unknown;
}

/**
 * Agent definition summary for listing
 */
export interface AgentDefinitionSummary {
  /** Agent identifier */
  agentId: string;

  /** Agent name */
  name: string;

  /** Agent type */
  agentType: StoredAgentType;

  /** Model being used */
  model: string;

  /** When created */
  createdAt: Date;

  /** When last updated */
  updatedAt: Date;

  /** Optional metadata */
  metadata?: AgentDefinitionMetadata;
}

/**
 * Current format version for stored agent definitions
 */
export const AGENT_DEFINITION_FORMAT_VERSION = 1;

/**
 * Storage interface for agent definitions
 *
 * Implementations:
 * - FileAgentDefinitionStorage: File-based storage at ~/.oneringai/agents/<agentId>/
 * - (Future) DatabaseAgentDefinitionStorage, etc.
 */
export interface IAgentDefinitionStorage {
  /**
   * Save an agent definition
   *
   * @param definition - The agent definition to save
   */
  save(definition: StoredAgentDefinition): Promise<void>;

  /**
   * Load an agent definition
   *
   * @param agentId - Agent identifier to load
   * @returns The stored definition, or null if not found
   */
  load(agentId: string): Promise<StoredAgentDefinition | null>;

  /**
   * Delete an agent definition
   *
   * @param agentId - Agent identifier to delete
   */
  delete(agentId: string): Promise<void>;

  /**
   * Check if an agent definition exists
   *
   * @param agentId - Agent identifier to check
   */
  exists(agentId: string): Promise<boolean>;

  /**
   * List all agent definitions (summaries only)
   *
   * @param options - Optional filtering
   * @returns Array of agent summaries, sorted by updatedAt descending
   */
  list(options?: AgentDefinitionListOptions): Promise<AgentDefinitionSummary[]>;

  /**
   * Update agent definition metadata without loading full definition
   *
   * @param agentId - Agent identifier
   * @param metadata - Metadata to merge
   */
  updateMetadata?(
    agentId: string,
    metadata: Partial<AgentDefinitionMetadata>
  ): Promise<void>;

  /**
   * Get the storage path/location (for display/debugging)
   */
  getPath(): string;
}

/**
 * Options for listing agent definitions
 */
export interface AgentDefinitionListOptions {
  /** Filter by agent type */
  agentType?: StoredAgentType;

  /** Filter by tags (any match) */
  tags?: string[];

  /** Maximum number of results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}
