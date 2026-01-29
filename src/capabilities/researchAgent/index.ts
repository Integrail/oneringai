/**
 * ResearchAgent - Generic research agent supporting any data sources
 *
 * Features:
 * - Multiple configurable sources (web, vector, file, API, etc.)
 * - Automatic memory management (spill large outputs, cleanup raw data)
 * - Research-specific tools for source interaction
 * - Built-in research protocol with search → process → synthesize phases
 *
 * Usage:
 * ```typescript
 * import { ResearchAgent, createWebSearchSource, createFileSearchSource } from '@oneringai/agents';
 *
 * // Create sources
 * const webSource = createWebSearchSource('serper-main');
 * const fileSource = createFileSearchSource('./docs');
 *
 * // Create research agent
 * const agent = ResearchAgent.create({
 *   connector: 'openai',
 *   model: 'gpt-4-turbo',
 *   sources: [webSource, fileSource],
 * });
 *
 * // Run research
 * const handle = await agent.start({
 *   goal: 'Research the impact of AI on employment',
 *   tasks: [
 *     { name: 'search', description: 'Search for relevant information' },
 *     { name: 'synthesize', description: 'Create a comprehensive report' },
 *   ],
 * });
 *
 * const result = await handle.wait();
 * ```
 */

// Main agent
export { ResearchAgent, createResearchTools } from './ResearchAgent.js';
export type { ResearchAgentConfig, ResearchAgentHooks } from './ResearchAgent.js';

// Types
export type {
  IResearchSource,
  SourceResult,
  SearchResponse,
  FetchedContent,
  SearchOptions,
  FetchOptions,
  SourceCapabilities,
  ResearchFinding,
  ResearchPlan,
  ResearchQuery,
  ResearchResult,
  ResearchProgress,
} from './types.js';

// Built-in sources
export {
  WebSearchSource,
  createWebSearchSource,
  FileSearchSource,
  createFileSearchSource,
} from './sources/index.js';
export type { WebSearchSourceConfig, FileSearchSourceConfig } from './sources/index.js';
