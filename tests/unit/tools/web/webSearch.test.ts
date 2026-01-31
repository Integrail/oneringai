/**
 * Web Search Tool Unit Tests
 * Tests for tool definition only - actual API tests are in integration tests
 */

import { describe, it, expect } from 'vitest';
import { webSearch } from '../../../../src/tools/web/webSearch.js';

describe('webSearch', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(webSearch.definition.function.name).toBe('web_search');
    });

    it('should have query as required parameter', () => {
      expect(webSearch.definition.function.parameters.required).toContain('query');
    });

    it('should have optional parameters', () => {
      const props = webSearch.definition.function.parameters.properties as Record<string, any>;
      expect(props.numResults).toBeDefined();
      expect(props.country).toBeDefined();
      expect(props.language).toBeDefined();
    });

    it('should be a blocking tool', () => {
      expect(webSearch.definition.blocking).toBe(true);
    });

    it('should have timeout defined', () => {
      expect(webSearch.definition.timeout).toBe(15000);
    });

    it('should have comprehensive description', () => {
      const desc = webSearch.definition.function.description;
      expect(desc).toContain('Search the web');
      expect(desc).toContain('results');
    });

    it('should define query parameter with description', () => {
      const props = webSearch.definition.function.parameters.properties as Record<string, any>;
      expect(props.query.type).toBe('string');
      expect(props.query.description).toBeDefined();
    });
  });
});
