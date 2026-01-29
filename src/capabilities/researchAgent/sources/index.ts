/**
 * Built-in research sources
 *
 * These sources implement IResearchSource for common research scenarios.
 * Custom sources can implement IResearchSource directly.
 */

export { WebSearchSource, createWebSearchSource } from './WebSearchSource.js';
export type { WebSearchSourceConfig } from './WebSearchSource.js';

export { FileSearchSource, createFileSearchSource } from './FileSearchSource.js';
export type { FileSearchSourceConfig } from './FileSearchSource.js';
