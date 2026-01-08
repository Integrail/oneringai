/**
 * Brave Search API provider
 * Independent search index (privacy-focused)
 */

import type { SearchResult } from './serper.js';

export async function searchWithBrave(
  query: string,
  numResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`;

  const response = await fetch(url, {
    headers: {
      'X-Subscription-Token': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();

  if (!data.web?.results || !Array.isArray(data.web.results)) {
    throw new Error('Invalid response from Brave API');
  }

  return data.web.results.slice(0, numResults).map((result: any, index: number) => ({
    title: result.title || 'Untitled',
    url: result.url || '',
    snippet: result.description || '',
    position: index + 1,
  }));
}
