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
 *   tools: [tools.jsonManipulator, tools.webSearch, tools.webFetch]
 * });
 * ```
 */

// JSON tools
export { jsonManipulator } from './json/jsonManipulator.js';

// Web tools
export { webFetch, webFetchJS, webSearch } from './web/index.js';

// Code execution tools
export { executeJavaScript, createExecuteJavaScriptTool } from './code/index.js';

// Future tool exports
// export { fileReader } from './file/fileReader.js';
