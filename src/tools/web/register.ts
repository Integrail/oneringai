/**
 * Web Tools Registration
 *
 * Registers web search and scrape tool factories with ConnectorTools.
 * When a connector with a matching serviceType is used,
 * these tools become available via `ConnectorTools.for(connectorName)`.
 */

import { ConnectorTools } from '../connector/ConnectorTools.js';
import type { Connector } from '../../core/Connector.js';
import { createWebSearchTool } from './createWebSearchTool.js';
import { createWebScrapeTool } from './createWebScrapeTool.js';

/** Search service types that get the web_search tool */
const SEARCH_SERVICE_TYPES = ['serper', 'brave-search', 'tavily', 'rapidapi-search'];

/** Scrape service types that get the web_scrape tool */
const SCRAPE_SERVICE_TYPES = ['zenrows', 'jina-reader', 'firecrawl', 'scrapingbee'];

/**
 * Register web tool factories with the ConnectorTools framework.
 *
 * After calling this:
 * - `ConnectorTools.for('my-serper')` returns [my-serper_api, my-serper_web_search]
 * - `ConnectorTools.for('my-zenrows')` returns [my-zenrows_api, my-zenrows_web_scrape]
 */
export function registerWebTools(): void {
  // Register search tool for each search service type
  for (const st of SEARCH_SERVICE_TYPES) {
    ConnectorTools.registerService(st, (connector: Connector) => [
      createWebSearchTool(connector),
    ]);
  }

  // Register scrape tool for each scrape service type
  for (const st of SCRAPE_SERVICE_TYPES) {
    ConnectorTools.registerService(st, (connector: Connector) => [
      createWebScrapeTool(connector),
    ]);
  }
}
