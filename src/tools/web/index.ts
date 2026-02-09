/**
 * Web tools for fetching, searching, and scraping
 *
 * - webFetch: Standalone tool (no connector needed)
 * - createWebSearchTool / createWebScrapeTool: Factory functions (ConnectorTools pattern)
 *
 * Search/scrape tool factories are auto-registered with ConnectorTools on import.
 */

// Side-effect: register web tool factories with ConnectorTools
import { registerWebTools } from './register.js';
registerWebTools();

// Standalone tool (no connector needed)
export { webFetch } from './webFetch.js';

// Tool factories (for direct use)
export { createWebSearchTool } from './createWebSearchTool.js';
export { createWebScrapeTool } from './createWebScrapeTool.js';

// Re-export SearchResult type from capabilities (canonical location)
export type { SearchResult } from '../../capabilities/search/index.js';
