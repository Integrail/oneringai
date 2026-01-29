/**
 * ToolOutputPlugin - Tracks recent tool outputs for context
 *
 * Tool outputs are the most expendable context - they can be truncated
 * or removed when space is needed. Recent outputs are kept for reference.
 */

import { BaseContextPlugin } from './IContextPlugin.js';
import type { IContextComponent, ITokenEstimator } from '../types.js';

/**
 * A single tool output entry
 */
export interface ToolOutput {
  /** Tool name */
  tool: string;
  /** Tool result (may be truncated) */
  output: unknown;
  /** When the tool was called */
  timestamp: number;
  /** Whether output was truncated */
  truncated?: boolean;
}

/**
 * Serialized tool output state
 */
export interface SerializedToolOutputState {
  outputs: ToolOutput[];
}

/**
 * Tool output plugin configuration
 */
export interface ToolOutputPluginConfig {
  /** Maximum outputs to keep (default: 10) */
  maxOutputs?: number;
  /** Maximum tokens per individual output (default: 1000) */
  maxTokensPerOutput?: number;
  /** Whether to include timestamps in context (default: false) */
  includeTimestamps?: boolean;
}

const DEFAULT_CONFIG: Required<ToolOutputPluginConfig> = {
  maxOutputs: 10,
  maxTokensPerOutput: 1000,
  includeTimestamps: false,
};

/**
 * Tool output plugin for context management
 *
 * Provides recent tool outputs as a context component.
 * Highest compaction priority - first to be reduced when space is needed.
 */
export class ToolOutputPlugin extends BaseContextPlugin {
  readonly name = 'tool_outputs';
  readonly priority = 10; // Highest = first to compact
  readonly compactable = true;

  private outputs: ToolOutput[] = [];
  private config: Required<ToolOutputPluginConfig>;

  constructor(config: ToolOutputPluginConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add a tool output
   */
  addOutput(toolName: string, result: unknown): void {
    this.outputs.push({
      tool: toolName,
      output: result,
      timestamp: Date.now(),
    });

    // Keep buffer at 2x max to avoid frequent trimming
    if (this.outputs.length > this.config.maxOutputs * 2) {
      this.outputs = this.outputs.slice(-this.config.maxOutputs);
    }
  }

  /**
   * Get recent outputs
   */
  getOutputs(): ToolOutput[] {
    return this.outputs.slice(-this.config.maxOutputs);
  }

  /**
   * Clear all outputs
   */
  clear(): void {
    this.outputs = [];
  }

  /**
   * Get component for context
   */
  async getComponent(): Promise<IContextComponent | null> {
    const recentOutputs = this.getOutputs();

    if (recentOutputs.length === 0) {
      return null;
    }

    return {
      name: this.name,
      content: this.formatOutputs(recentOutputs),
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        outputCount: recentOutputs.length,
        oldestTimestamp: recentOutputs[0]?.timestamp,
        newestTimestamp: recentOutputs[recentOutputs.length - 1]?.timestamp,
      },
    };
  }

  /**
   * Compact by removing oldest outputs and truncating large ones
   */
  override async compact(_targetTokens: number, estimator: ITokenEstimator): Promise<number> {
    const before = estimator.estimateTokens(this.formatOutputs(this.outputs));

    // Strategy 1: Remove oldest outputs
    const keepCount = Math.max(3, Math.floor(this.outputs.length / 2));
    this.outputs = this.outputs.slice(-keepCount);

    // Strategy 2: Truncate remaining large outputs
    for (const output of this.outputs) {
      const outputStr = this.stringifyOutput(output.output);
      const tokens = estimator.estimateTokens(outputStr);

      if (tokens > this.config.maxTokensPerOutput) {
        // Truncate to approximate target
        const maxChars = this.config.maxTokensPerOutput * 4;
        const truncated = outputStr.slice(0, maxChars) + '... [truncated]';
        output.output = truncated;
        output.truncated = true;
      }
    }

    const after = estimator.estimateTokens(this.formatOutputs(this.outputs));
    return Math.max(0, before - after);
  }

  /**
   * Format outputs for context
   */
  private formatOutputs(outputs: ToolOutput[]): string {
    if (outputs.length === 0) return '';

    const lines = ['## Recent Tool Outputs', ''];

    for (const output of outputs) {
      const outputStr = this.stringifyOutput(output.output);
      const truncatedNote = output.truncated ? ' (truncated)' : '';
      const timeNote = this.config.includeTimestamps
        ? ` at ${new Date(output.timestamp).toISOString()}`
        : '';

      lines.push(`### ${output.tool}${truncatedNote}${timeNote}`);
      lines.push('```');
      lines.push(outputStr);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Safely stringify output
   */
  private stringifyOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }

    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }

  // Session persistence
  override getState(): SerializedToolOutputState {
    return { outputs: this.outputs };
  }

  override restoreState(state: unknown): void {
    const s = state as SerializedToolOutputState;
    if (s?.outputs && Array.isArray(s.outputs)) {
      this.outputs = s.outputs;
    }
  }
}
