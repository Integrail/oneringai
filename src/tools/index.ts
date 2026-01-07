/**
 * Pre-built tools for agents
 *
 * Import and use with your agents:
 *
 * ```typescript
 * import { tools } from '@oneringai/agents';
 *
 * const agent = client.agents.create({
 *   provider: 'openai',
 *   model: 'gpt-4',
 *   tools: [tools.jsonManipulator]
 * });
 * ```
 */

export { jsonManipulator } from './json/jsonManipulator.js';

// Future tool exports
// export { webScraper } from './web/webScraper.js';
// export { fileReader } from './file/fileReader.js';
// export { codeExecutor } from './code/codeExecutor.js';
