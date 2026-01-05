/**
 * Agent manager - creates and manages agents with tool calling
 */

import { ProviderRegistry } from '../../client/ProviderRegistry.js';
import { Agent, AgentConfig } from './Agent.js';
import { ToolRegistry } from './ToolRegistry.js';

export class AgentManager {
  private toolRegistry: ToolRegistry;

  constructor(private registry: ProviderRegistry) {
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Create a new agent instance
   */
  create(config: AgentConfig): Agent {
    const provider = this.registry.getTextProvider(config.provider);
    return new Agent(config, provider, this.toolRegistry);
  }

  /**
   * Convenience method for one-off agent calls
   */
  async run(
    config: AgentConfig & { input: string | any[] }
  ): Promise<any> {
    const agent = this.create(config);
    return agent.run(config.input);
  }
}
