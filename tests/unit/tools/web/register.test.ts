/**
 * Web Tools Registration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConnectorTools } from '../../../../src/tools/connector/ConnectorTools.js';

// Import to trigger side-effect registration
import '../../../../src/tools/web/index.js';

describe('registerWebTools', () => {
  beforeEach(() => {
    // Note: factories are registered on module import (side-effect).
    // ConnectorTools.clearCache() only clears service type + tool caches, not factories.
    ConnectorTools.clearCache();
  });

  afterEach(() => {
    ConnectorTools.clearCache();
  });

  describe('search service types', () => {
    it('should register serper', () => {
      expect(ConnectorTools.hasServiceTools('serper')).toBe(true);
    });

    it('should register brave-search', () => {
      expect(ConnectorTools.hasServiceTools('brave-search')).toBe(true);
    });

    it('should register tavily', () => {
      expect(ConnectorTools.hasServiceTools('tavily')).toBe(true);
    });

    it('should register rapidapi-search', () => {
      expect(ConnectorTools.hasServiceTools('rapidapi-search')).toBe(true);
    });
  });

  describe('scrape service types', () => {
    it('should register zenrows', () => {
      expect(ConnectorTools.hasServiceTools('zenrows')).toBe(true);
    });

    it('should register jina-reader', () => {
      expect(ConnectorTools.hasServiceTools('jina-reader')).toBe(true);
    });

    it('should register firecrawl', () => {
      expect(ConnectorTools.hasServiceTools('firecrawl')).toBe(true);
    });

    it('should register scrapingbee', () => {
      expect(ConnectorTools.hasServiceTools('scrapingbee')).toBe(true);
    });
  });

  describe('all 8 service types registered', () => {
    it('should have all expected services in supported services list', () => {
      const services = ConnectorTools.listSupportedServices();
      const expectedSearch = ['serper', 'brave-search', 'tavily', 'rapidapi-search'];
      const expectedScrape = ['zenrows', 'jina-reader', 'firecrawl', 'scrapingbee'];

      for (const st of [...expectedSearch, ...expectedScrape]) {
        expect(services).toContain(st);
      }
    });
  });
});
