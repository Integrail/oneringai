/**
 * AutoSpillPlugin - Automatically spills large tool outputs to memory
 *
 * This plugin monitors tool outputs and automatically stores large results
 * in working memory's raw tier. This prevents context overflow while keeping
 * data available for later retrieval.
 *
 * Features:
 * - Configurable size threshold for auto-spill
 * - Tracks spilled entries with source metadata
 * - Provides cleanup methods (manual and auto on summarization)
 * - Integrates with WorkingMemory's hierarchical tier system
 */

import { EventEmitter } from 'eventemitter3';
import { BaseContextPlugin } from './IContextPlugin.js';
import type { IContextComponent, ITokenEstimator } from '../types.js';
import type { WorkingMemory } from '../../../capabilities/taskAgent/WorkingMemory.js';
import { addTierPrefix, getTierFromKey } from '../../../domain/entities/Memory.js';

/**
 * Spilled entry metadata
 */
export interface SpilledEntry {
  /** Memory key where the entry is stored */
  key: string;
  /** Tool that produced the output */
  sourceTool: string;
  /** Human-readable description of what this entry contains */
  description: string;
  /** Original tool arguments (for context) */
  toolArgs?: Record<string, unknown>;
  /** Original size in bytes */
  sizeBytes: number;
  /** When the entry was spilled */
  timestamp: number;
  /** Whether this entry has been consumed (summarized) */
  consumed: boolean;
  /** Keys of summaries derived from this entry */
  derivedSummaries: string[];
}

/**
 * Auto-spill configuration
 */
export interface AutoSpillConfig {
  /** Minimum size (bytes) to trigger auto-spill. Default: 5KB */
  sizeThreshold?: number;
  /** Tools to auto-spill. If not provided, uses toolPatterns or spills all large outputs */
  tools?: string[];
  /** Regex patterns for tools to auto-spill (e.g., /^web_/ for all web tools) */
  toolPatterns?: RegExp[];
  /** Maximum entries to track (oldest are cleaned up). Default: 100 */
  maxTrackedEntries?: number;
  /** Auto-cleanup consumed entries after this many iterations. Default: 5 */
  autoCleanupAfterIterations?: number;
  /** Key prefix for spilled entries. Default: 'autospill' */
  keyPrefix?: string;
}

const DEFAULT_CONFIG: Required<AutoSpillConfig> = {
  sizeThreshold: 5 * 1024, // 5KB - more aggressive to prevent context overflow
  tools: [],
  toolPatterns: [],
  maxTrackedEntries: 100,
  autoCleanupAfterIterations: 5,
  keyPrefix: 'autospill',
};

/**
 * Serialized plugin state
 */
export interface SerializedAutoSpillState {
  entries: SpilledEntry[];
  iterationsSinceCleanup: number;
}

/**
 * Events emitted by AutoSpillPlugin
 */
export interface AutoSpillEvents {
  spilled: { key: string; tool: string; sizeBytes: number };
  consumed: { key: string; summaryKey: string };
  cleaned: { keys: string[]; reason: 'manual' | 'auto' | 'consumed' };
}

/**
 * AutoSpillPlugin - Monitors tool outputs and auto-stores large ones in memory
 *
 * Usage:
 * ```typescript
 * const autoSpill = new AutoSpillPlugin(memory, {
 *   sizeThreshold: 10 * 1024, // 10KB
 *   tools: ['web_fetch', 'web_scrape'],
 * });
 * agentContext.registerPlugin(autoSpill);
 *
 * // Call this from afterToolExecution hook
 * autoSpill.onToolOutput('web_fetch', largeHtmlContent);
 *
 * // When agent creates summary, mark the raw data as consumed
 * autoSpill.markConsumed('autospill_web_fetch_123', 'summary.search1');
 *
 * // Cleanup consumed entries
 * await autoSpill.cleanupConsumed();
 * ```
 */
export class AutoSpillPlugin extends BaseContextPlugin {
  readonly name = 'auto_spill_tracker';
  readonly priority = 9; // High priority - compact before conversation but after tool outputs
  readonly compactable = true;

  private memory: WorkingMemory;
  private config: Required<AutoSpillConfig>;
  private entries: Map<string, SpilledEntry> = new Map();
  private iterationsSinceCleanup = 0;
  private entryCounter = 0;
  private events = new EventEmitter<AutoSpillEvents>();

  constructor(memory: WorkingMemory, config: AutoSpillConfig = {}) {
    super();
    this.memory = memory;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to events
   */
  on<K extends keyof AutoSpillEvents>(
    event: K,
    listener: (...args: any[]) => void
  ): this {
    this.events.on(event, listener as any);
    return this;
  }

  /**
   * Check if a tool should be auto-spilled
   */
  shouldSpill(toolName: string, outputSize: number): boolean {
    // Check size threshold
    if (outputSize < this.config.sizeThreshold) {
      return false;
    }

    // If specific tools are configured, check if this tool is included
    if (this.config.tools.length > 0) {
      if (this.config.tools.includes(toolName)) {
        return true;
      }
    }

    // Check tool patterns
    if (this.config.toolPatterns.length > 0) {
      for (const pattern of this.config.toolPatterns) {
        if (pattern.test(toolName)) {
          return true;
        }
      }
    }

    // If no specific tools or patterns configured, spill all large outputs
    if (this.config.tools.length === 0 && this.config.toolPatterns.length === 0) {
      return true;
    }

    return false;
  }

  /**
   * Called when a tool produces output
   * Should be called from afterToolExecution hook
   *
   * @param toolName - Name of the tool
   * @param output - Tool output
   * @param toolArgs - Optional tool arguments for better descriptions
   * @param describeCall - Optional describeCall function from the tool
   * @returns The memory key if spilled, undefined otherwise
   */
  async onToolOutput(
    toolName: string,
    output: unknown,
    toolArgs?: Record<string, unknown>,
    describeCall?: (args: Record<string, unknown>) => string
  ): Promise<string | undefined> {
    // Calculate size
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    const sizeBytes = Buffer.byteLength(outputStr, 'utf8');

    if (!this.shouldSpill(toolName, sizeBytes)) {
      return undefined;
    }

    // Generate descriptive key based on tool call
    const description = this.generateDescription(toolName, output, sizeBytes, toolArgs, describeCall);
    const sanitizedDesc = this.sanitizeKeyPart(description);
    const key = `${this.config.keyPrefix}_${toolName}_${sanitizedDesc}_${this.entryCounter++}`;
    const fullKey = addTierPrefix(key, 'raw');

    // Store in memory's raw tier with descriptive description
    await this.memory.storeRaw(
      key,
      description,
      output
    );

    // Track the entry
    const entry: SpilledEntry = {
      key: fullKey,
      sourceTool: toolName,
      description,
      toolArgs,
      sizeBytes,
      timestamp: Date.now(),
      consumed: false,
      derivedSummaries: [],
    };

    this.entries.set(fullKey, entry);
    this.events.emit('spilled', { key: fullKey, tool: toolName, sizeBytes });

    // Prune old entries if we have too many
    this.pruneOldEntries();

    return fullKey;
  }

  /**
   * Generate a human-readable description for the spilled entry
   */
  private generateDescription(
    toolName: string,
    _output: unknown,  // Reserved for future use (e.g., extracting titles from content)
    sizeBytes: number,
    toolArgs?: Record<string, unknown>,
    describeCall?: (args: Record<string, unknown>) => string
  ): string {
    // 1. Try tool's describeCall if available
    if (describeCall && toolArgs) {
      try {
        const desc = describeCall(toolArgs);
        return `${toolName}: ${desc} (${formatBytes(sizeBytes)})`;
      } catch {
        // Fall through
      }
    }

    // 2. Built-in descriptions for common tools
    if (toolArgs) {
      switch (toolName) {
        case 'web_scrape':
        case 'web_fetch':
        case 'web_fetch_js': {
          const url = String(toolArgs['url'] || '');
          try {
            const u = new URL(url);
            return `${toolName}: ${u.hostname}${u.pathname.slice(0, 40)} (${formatBytes(sizeBytes)})`;
          } catch {
            return `${toolName}: ${url.slice(0, 50)} (${formatBytes(sizeBytes)})`;
          }
        }

        case 'web_search': {
          const query = String(toolArgs['query'] || '').slice(0, 40);
          return `${toolName}: "${query}" (${formatBytes(sizeBytes)})`;
        }

        case 'read_file': {
          const path = String(toolArgs['file_path'] || toolArgs['path'] || '');
          const file = path.split('/').pop() ?? path;
          return `${toolName}: ${file.slice(0, 50)} (${formatBytes(sizeBytes)})`;
        }

        case 'bash': {
          const cmd = (String(toolArgs['command'] || '').split('\n')[0] ?? '').slice(0, 40);
          return `${toolName}: \`${cmd}\` (${formatBytes(sizeBytes)})`;
        }

        default: {
          // Try common arg keys
          for (const key of ['query', 'url', 'path', 'command', 'pattern', 'key']) {
            if (toolArgs[key]) {
              return `${toolName}: ${key}="${String(toolArgs[key]).slice(0, 40)}" (${formatBytes(sizeBytes)})`;
            }
          }
        }
      }
    }

    // 3. Fallback: just size
    return `Auto-spilled ${toolName} output (${formatBytes(sizeBytes)})`;
  }

  /**
   * Sanitize a string for use in a memory key
   */
  private sanitizeKeyPart(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 30);
  }

  /**
   * Mark a spilled entry as consumed (summarized)
   * Call this when the agent creates a summary from raw data
   *
   * @param rawKey - Key of the spilled raw entry
   * @param summaryKey - Key of the summary created from it
   */
  markConsumed(rawKey: string, summaryKey: string): void {
    const entry = this.entries.get(rawKey);
    if (entry) {
      entry.consumed = true;
      entry.derivedSummaries.push(summaryKey);
      this.events.emit('consumed', { key: rawKey, summaryKey });
    }
  }

  /**
   * Get all tracked spilled entries
   */
  getEntries(): SpilledEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get unconsumed entries (not yet summarized)
   */
  getUnconsumed(): SpilledEntry[] {
    return this.getEntries().filter((e) => !e.consumed);
  }

  /**
   * Get consumed entries (ready for cleanup)
   */
  getConsumed(): SpilledEntry[] {
    return this.getEntries().filter((e) => e.consumed);
  }

  /**
   * Cleanup consumed entries from memory
   *
   * @returns Keys that were deleted
   */
  async cleanupConsumed(): Promise<string[]> {
    const consumed = this.getConsumed();
    const deleted: string[] = [];

    for (const entry of consumed) {
      try {
        // Only cleanup if it's still a raw tier entry
        const tier = getTierFromKey(entry.key);
        if (tier === 'raw') {
          const exists = await this.memory.has(entry.key);
          if (exists) {
            await this.memory.delete(entry.key);
            deleted.push(entry.key);
          }
        }
        // Remove from tracking
        this.entries.delete(entry.key);
      } catch {
        // Ignore errors - entry may have been evicted already
      }
    }

    if (deleted.length > 0) {
      this.events.emit('cleaned', { keys: deleted, reason: 'consumed' });
    }

    return deleted;
  }

  /**
   * Cleanup specific entries
   *
   * @param keys - Keys to cleanup
   * @returns Keys that were actually deleted
   */
  async cleanup(keys: string[]): Promise<string[]> {
    const deleted: string[] = [];

    for (const key of keys) {
      try {
        const tier = getTierFromKey(key);
        if (tier === 'raw') {
          const exists = await this.memory.has(key);
          if (exists) {
            await this.memory.delete(key);
            deleted.push(key);
          }
        }
        this.entries.delete(key);
      } catch {
        // Ignore errors
      }
    }

    if (deleted.length > 0) {
      this.events.emit('cleaned', { keys: deleted, reason: 'manual' });
    }

    return deleted;
  }

  /**
   * Cleanup all tracked entries
   */
  async cleanupAll(): Promise<string[]> {
    const keys = Array.from(this.entries.keys());
    return this.cleanup(keys);
  }

  /**
   * Called after each agent iteration
   * Handles automatic cleanup if configured
   */
  async onIteration(): Promise<void> {
    this.iterationsSinceCleanup++;

    if (this.iterationsSinceCleanup >= this.config.autoCleanupAfterIterations) {
      await this.cleanupConsumed();
      this.iterationsSinceCleanup = 0;
    }
  }

  /**
   * Get spill info for a specific key
   */
  getSpillInfo(key: string): SpilledEntry | undefined {
    return this.entries.get(key);
  }

  /**
   * Get entry by key (alias for getSpillInfo for cleaner API)
   */
  getEntry(key: string): SpilledEntry | undefined {
    return this.entries.get(key);
  }

  // ============================================================================
  // IContextPlugin implementation
  // ============================================================================

  async getComponent(): Promise<IContextComponent | null> {
    const unconsumed = this.getUnconsumed();
    if (unconsumed.length === 0) {
      return null;
    }

    // Provide info about spilled data to help the agent
    const lines = [
      '## Auto-Spilled Data (Awaiting Processing)',
      '',
      `${unconsumed.length} large tool output(s) were auto-stored in memory:`,
      '',
    ];

    for (const entry of unconsumed) {
      lines.push(`- **${entry.key}**`);
      lines.push(`  - Description: ${entry.description}`);
      lines.push(`  - Size: ${formatBytes(entry.sizeBytes)}`);
      lines.push(`  - Status: ⏳ Awaiting processing`);
    }

    lines.push('');
    lines.push('### How to Process');
    lines.push('Use `autospill_process()` to retrieve, summarize, and mark as consumed:');
    lines.push('```');
    lines.push('autospill_process({');
    lines.push('  key: "raw.autospill_...",');
    lines.push('  summary: "Key findings from this data...",');
    lines.push('  summary_key: "findings.topic_name"  // optional');
    lines.push('})');
    lines.push('```');
    lines.push('');
    lines.push('**IMPORTANT:** Process these entries to prevent them from reappearing.');

    return {
      name: this.name,
      content: lines.join('\n'),
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        unconsumedCount: unconsumed.length,
        consumedCount: this.getConsumed().length,
        totalSizeBytes: unconsumed.reduce((sum, e) => sum + e.sizeBytes, 0),
      },
    };
  }

  async compact(_targetTokens: number, _estimator: ITokenEstimator): Promise<number> {
    // Cleanup consumed entries to free memory
    const deleted = await this.cleanupConsumed();
    // Rough estimate: each entry info takes ~50 chars (~12 tokens)
    return deleted.length * 12;
  }

  override getState(): SerializedAutoSpillState {
    return {
      entries: Array.from(this.entries.values()),
      iterationsSinceCleanup: this.iterationsSinceCleanup,
    };
  }

  override restoreState(state: unknown): void {
    const s = state as SerializedAutoSpillState;
    if (s?.entries && Array.isArray(s.entries)) {
      this.entries.clear();
      for (const entry of s.entries) {
        this.entries.set(entry.key, entry);
      }
    }
    if (typeof s?.iterationsSinceCleanup === 'number') {
      this.iterationsSinceCleanup = s.iterationsSinceCleanup;
    }
  }

  override destroy(): void {
    this.events.removeAllListeners();
    this.entries.clear();
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private pruneOldEntries(): void {
    if (this.entries.size <= this.config.maxTrackedEntries) {
      return;
    }

    // Sort by timestamp, remove oldest
    const sorted = Array.from(this.entries.entries()).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    const toRemove = sorted.slice(0, sorted.length - this.config.maxTrackedEntries);
    for (const [key] of toRemove) {
      this.entries.delete(key);
    }
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
