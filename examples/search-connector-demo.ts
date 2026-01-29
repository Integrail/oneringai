/**
 * Search Connector Demo
 * Demonstrates the new Connector-based web search architecture
 */

import { Connector, SearchProvider, Services } from '../src/index.js';

async function main() {
  // ============ Setup Connectors ============

  // Create search connectors for different providers
  Connector.create({
    name: 'serper-main',
    serviceType: Services.Serper,
    auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
    baseURL: 'https://google.serper.dev',
  });

  Connector.create({
    name: 'brave-main',
    serviceType: Services.BraveSearch,
    auth: { type: 'api_key', apiKey: process.env.BRAVE_API_KEY! },
    baseURL: 'https://api.search.brave.com/res/v1',
  });

  Connector.create({
    name: 'rapidapi-search',
    serviceType: Services.RapidapiSearch,
    auth: { type: 'api_key', apiKey: process.env.RAPIDAPI_KEY! },
    baseURL: 'https://real-time-web-search.p.rapidapi.com',
  });

  // ============ Use SearchProvider Directly ============

  console.log('=== SearchProvider Demo ===\n');

  // Create search provider from connector
  const serperSearch = SearchProvider.create({ connector: 'serper-main' });

  // Perform search
  const result = await serperSearch.search('latest AI developments 2026', {
    numResults: 5,
    country: 'us',
    language: 'en',
  });

  if (result.success) {
    console.log(`Found ${result.count} results from ${result.provider}:\n`);
    result.results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   ${r.url}`);
      console.log(`   ${r.snippet}\n`);
    });
  } else {
    console.error(`Search failed: ${result.error}`);
  }

  // ============ Use RapidAPI Provider ============

  console.log('\n=== RapidAPI Search Demo ===\n');

  const rapidSearch = SearchProvider.create({ connector: 'rapidapi-search' });

  const rapidResult = await rapidSearch.search('quantum computing news', {
    numResults: 3,
  });

  if (rapidResult.success) {
    console.log(`Found ${rapidResult.count} results from ${rapidResult.provider}:\n`);
    rapidResult.results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   ${r.url}\n`);
    });
  } else {
    console.error(`Search failed: ${rapidResult.error}`);
  }

  // ============ Multiple Keys (Resilience) ============

  console.log('\n=== Multiple Keys Demo ===\n');

  // Create backup connector
  Connector.create({
    name: 'serper-backup',
    serviceType: Services.Serper,
    auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY_BACKUP || process.env.SERPER_API_KEY! },
    baseURL: 'https://google.serper.dev',
  });

  // Use backup if main fails
  try {
    const mainSearch = SearchProvider.create({ connector: 'serper-main' });
    const mainResult = await mainSearch.search('test query');
    console.log('Main connector succeeded');
  } catch (error) {
    console.log('Main connector failed, trying backup...');
    const backupSearch = SearchProvider.create({ connector: 'serper-backup' });
    const backupResult = await backupSearch.search('test query');
    console.log('Backup connector succeeded');
  }
}

main().catch(console.error);
