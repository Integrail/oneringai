/**
 * Web Search Integration Tests
 *
 * Tests web search with real APIs when keys are available.
 * Skips tests when API keys are not configured.
 *
 * Required environment variables:
 * - SERPER_API_KEY - For Serper (Google search)
 * - BRAVE_API_KEY - For Brave Search
 * - TAVILY_API_KEY - For Tavily AI-optimized search
 * - RAPIDAPI_KEY - For RapidAPI Real-Time Web Search
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dotenv from 'dotenv';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import { SearchProvider } from '../../../src/capabilities/search/index.js';
import { webSearch } from '../../../src/tools/web/webSearch.js';

// Load environment variables
dotenv.config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

const HAS_SERPER_KEY = Boolean(SERPER_API_KEY);
const HAS_BRAVE_KEY = Boolean(BRAVE_API_KEY);
const HAS_TAVILY_KEY = Boolean(TAVILY_API_KEY);
const HAS_RAPIDAPI_KEY = Boolean(RAPIDAPI_KEY);

// Conditional test execution based on API key availability
const describeIfSerper = HAS_SERPER_KEY ? describe : describe.skip;
const describeIfBrave = HAS_BRAVE_KEY ? describe : describe.skip;
const describeIfTavily = HAS_TAVILY_KEY ? describe : describe.skip;
const describeIfRapidAPI = HAS_RAPIDAPI_KEY ? describe : describe.skip;

// ============================================================================
// Setup and Teardown
// ============================================================================

beforeAll(() => {
  // Create connectors for available providers
  if (HAS_SERPER_KEY) {
    Connector.create({
      name: 'serper-test',
      vendor: Vendor.Custom,
      serviceType: 'serper',
      auth: { type: 'api_key', apiKey: SERPER_API_KEY! },
      baseURL: 'https://google.serper.dev',
    });
  }

  if (HAS_BRAVE_KEY) {
    Connector.create({
      name: 'brave-test',
      vendor: Vendor.Custom,
      serviceType: 'brave-search',
      auth: { type: 'api_key', apiKey: BRAVE_API_KEY! },
      baseURL: 'https://api.search.brave.com/res/v1',
    });
  }

  if (HAS_TAVILY_KEY) {
    Connector.create({
      name: 'tavily-test',
      vendor: Vendor.Custom,
      serviceType: 'tavily',
      auth: { type: 'api_key', apiKey: TAVILY_API_KEY! },
      baseURL: 'https://api.tavily.com',
    });
  }

  if (HAS_RAPIDAPI_KEY) {
    Connector.create({
      name: 'rapidapi-test',
      vendor: Vendor.Custom,
      serviceType: 'rapidapi-search',
      auth: { type: 'api_key', apiKey: RAPIDAPI_KEY! },
      baseURL: 'https://real-time-web-search.p.rapidapi.com',
    });
  }
});

afterAll(() => {
  Connector.clear();
});

// ============================================================================
// Serper Provider Tests
// ============================================================================

describeIfSerper('Serper Search Integration', () => {
  it('should search and return results', async () => {
    const provider = SearchProvider.create({ connector: 'serper-test' });
    const result = await provider.search('TypeScript programming language');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('serper');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]).toHaveProperty('title');
    expect(result.results[0]).toHaveProperty('url');
    expect(result.results[0]).toHaveProperty('snippet');
    expect(result.results[0]).toHaveProperty('position');
  }, 15000);

  it('should respect numResults parameter', async () => {
    const provider = SearchProvider.create({ connector: 'serper-test' });
    const result = await provider.search('JavaScript tutorials', { numResults: 3 });

    expect(result.success).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(3);
  }, 15000);

  it('should work via webSearch tool', async () => {
    const result = await webSearch.execute({
      query: 'Node.js documentation',
      connectorName: 'serper-test',
      numResults: 5,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('serper');
    expect(result.results.length).toBeGreaterThan(0);
  }, 15000);
});

// ============================================================================
// Brave Search Tests
// ============================================================================

describeIfBrave('Brave Search Integration', () => {
  it('should search and return results', async () => {
    const provider = SearchProvider.create({ connector: 'brave-test' });
    const result = await provider.search('Python programming');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('brave');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]).toHaveProperty('title');
    expect(result.results[0]).toHaveProperty('url');
    expect(result.results[0]).toHaveProperty('snippet');
  }, 15000);

  it('should respect numResults parameter', async () => {
    const provider = SearchProvider.create({ connector: 'brave-test' });
    const result = await provider.search('React framework', { numResults: 5 });

    expect(result.success).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(5);
  }, 15000);

  it('should work via webSearch tool', async () => {
    const result = await webSearch.execute({
      query: 'Vue.js guide',
      connectorName: 'brave-test',
      numResults: 5,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('brave');
  }, 15000);
});

// ============================================================================
// Tavily Search Tests
// ============================================================================

describeIfTavily('Tavily Search Integration', () => {
  it('should search and return results', async () => {
    const provider = SearchProvider.create({ connector: 'tavily-test' });
    const result = await provider.search('machine learning basics');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('tavily');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]).toHaveProperty('title');
    expect(result.results[0]).toHaveProperty('url');
    expect(result.results[0]).toHaveProperty('snippet');
  }, 15000);

  it('should respect numResults parameter', async () => {
    const provider = SearchProvider.create({ connector: 'tavily-test' });
    const result = await provider.search('deep learning', { numResults: 3 });

    expect(result.success).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(3);
  }, 15000);

  it('should work via webSearch tool', async () => {
    const result = await webSearch.execute({
      query: 'neural networks',
      connectorName: 'tavily-test',
      numResults: 5,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('tavily');
  }, 15000);
});

// ============================================================================
// RapidAPI Search Tests
// ============================================================================

describeIfRapidAPI('RapidAPI Search Integration', () => {
  it('should search and return results', async () => {
    const provider = SearchProvider.create({ connector: 'rapidapi-test' });
    const result = await provider.search('artificial intelligence news');

    expect(result.success).toBe(true);
    expect(result.provider).toBe('rapidapi');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]).toHaveProperty('title');
    expect(result.results[0]).toHaveProperty('url');
    expect(result.results[0]).toHaveProperty('snippet');
  }, 15000);

  it('should respect numResults parameter', async () => {
    const provider = SearchProvider.create({ connector: 'rapidapi-test' });
    const result = await provider.search('cloud computing', { numResults: 5 });

    expect(result.success).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(5);
  }, 15000);

  it('should work via webSearch tool', async () => {
    const result = await webSearch.execute({
      query: 'blockchain technology',
      connectorName: 'rapidapi-test',
      numResults: 5,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('rapidapi');
  }, 15000);

  it('should pass country and language options', async () => {
    const provider = SearchProvider.create({ connector: 'rapidapi-test' });
    const result = await provider.search('tech news', {
      numResults: 5,
      country: 'us',
      language: 'en',
    });

    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);
  }, 15000);
});

// ============================================================================
// Environment Variable Fallback Tests (Legacy)
// ============================================================================

describeIfSerper('Serper Environment Variable Fallback', () => {
  it('should work with provider parameter instead of connector', async () => {
    const result = await webSearch.execute({
      query: 'TypeScript handbook',
      provider: 'serper',
      numResults: 3,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('serper');
    expect(result.results.length).toBeGreaterThan(0);
  }, 15000);
});

describeIfBrave('Brave Environment Variable Fallback', () => {
  it('should work with provider parameter instead of connector', async () => {
    const result = await webSearch.execute({
      query: 'JavaScript ES6',
      provider: 'brave',
      numResults: 3,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('brave');
    expect(result.results.length).toBeGreaterThan(0);
  }, 15000);
});

describeIfTavily('Tavily Environment Variable Fallback', () => {
  it('should work with provider parameter instead of connector', async () => {
    const result = await webSearch.execute({
      query: 'data science',
      provider: 'tavily',
      numResults: 3,
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('tavily');
    expect(result.results.length).toBeGreaterThan(0);
  }, 15000);
});
