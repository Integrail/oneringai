/**
 * Agent manager - creates and manages agents with tool calling
 *
 * Implements IDisposable for proper resource cleanup
 */

import { ProviderRegistry } from '../../client/ProviderRegistry.js';
import { IDisposable, assertNotDestroyed } from '../../domain/interfaces/IDisposable.js';
import { Agent, AgentConfig } from './Agent.js';
import { ToolRegistry } from './ToolRegistry.js';

export class AgentManager implements IDisposable {
  private toolRegistry: ToolRegistry;
  private agents: Set<Agent> = new Set();
  private _isDestroyed = false;

  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  constructor(private registry: ProviderRegistry) {
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Create a new agent instance
   * @returns Promise<Agent> - async to support race-condition-free provider loading
   */
  async create(config: AgentConfig): Promise<Agent> {
    assertNotDestroyed(this, 'create agent');

    const provider = await this.registry.getTextProvider(config.provider);
    const agent = new Agent(config, provider, this.toolRegistry);

    // Track agent for cleanup
    this.agents.add(agent);

    // Auto-remove from tracking when agent is destroyed
    agent.onCleanup(() => {
      this.agents.delete(agent);
    });

    return agent;
  }

  /**
   * Convenience method for one-off agent calls
   */
  async run(config: AgentConfig & { input: string | any[] }): Promise<any> {
    const agent = await this.create(config);
    try {
      return await agent.run(config.input);
    } finally {
      // Clean up one-off agents
      agent.destroy();
    }
  }

  /**
   * Get the number of active agents
   */
  getActiveAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Destroy the manager and all managed agents
   * Safe to call multiple times (idempotent)
   */
  destroy(): void {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;

    // Destroy all managed agents
    for (const agent of this.agents) {
      try {
        agent.destroy();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.agents.clear();

    // Clear tool registry
    this.toolRegistry.clear();
  }
}
