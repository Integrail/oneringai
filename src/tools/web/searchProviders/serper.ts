/**
 * Serper.dev search provider
 * Fast Google search results via API
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

export async function searchWithSerper(
  query: string,
  numResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num: numResults,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
  }

  const data: any = await response.json();

  if (!data.organic || !Array.isArray(data.organic)) {
    throw new Error('Invalid response from Serper API');
  }

  return data.organic.slice(0, numResults).map((result: any, index: number) => ({
    title: result.title || 'Untitled',
    url: result.link || '',
    snippet: result.snippet || '',
    position: index + 1,
  }));
}
