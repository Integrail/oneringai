/**
 * Core module - main public API
 *
 * This is the primary entry point for the library.
 *
 * @example
 * ```typescript
 * import { Connector, Agent, Vendor } from '@oneringai/agents';
 *
 * // Create a connector
 * Connector.create({
 *   name: 'openai',
 *   vendor: Vendor.OpenAI,
 *   auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY! }
 * });
 *
 * // Create an agent
 * const agent = Agent.create({
 *   connector: 'openai',
 *   model: 'gpt-4'
 * });
 *
 * // Run the agent
 * const response = await agent.run('Hello!');
 * ```
 */

export { Connector } from './Connector.js';
export { Agent } from './Agent.js';
export type { AgentConfig } from './Agent.js';
export { Vendor, VENDORS, isVendor } from './Vendor.js';
export { createProvider, createProviderAsync } from './createProvider.js';
