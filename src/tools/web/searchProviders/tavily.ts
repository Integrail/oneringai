/**
 * Tavily AI Search provider
 * AI-optimized search results with summaries
 */

import type { SearchResult } from './serper.js';

export async function searchWithTavily(
  query: string,
  numResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: numResults,
      search_depth: 'basic', // 'basic' or 'advanced'
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();

  if (!data.results || !Array.isArray(data.results)) {
    throw new Error('Invalid response from Tavily API');
  }

  return data.results.slice(0, numResults).map((result: any, index: number) => ({
    title: result.title || 'Untitled',
    url: result.url || '',
    snippet: result.content || '',
    position: index + 1,
  }));
}
