/**
 * Search Connector Demo
 * Demonstrates the new Connector-based web search architecture
 */

import 'dotenv/config';
import { Connector, SearchProvider, Services } from '../src/index.js';

async function main() {
  const serperKey = process.env.SERPER_API_KEY || process.env.SERPER_KEY;
  const braveKey = process.env.BRAVE_API_KEY;
  const rapidAPIKey = process.env.RAPIDAPI_KEY;

  if (!serperKey && !braveKey && !rapidAPIKey) {
    throw new Error('Set SERPER_API_KEY (or SERPER_KEY), BRAVE_API_KEY, or RAPIDAPI_KEY in .env.');
  }

  // ============ Setup Connectors ============

  // Create search connectors for different providers
  if (serperKey) {
    Connector.create({
      name: 'serper-main',
      serviceType: Services.Serper,
      auth: {
        type: 'api_key',
        apiKey: serperKey,
        headerName: 'X-API-KEY',
        headerPrefix: '',
      },
      baseURL: 'https://google.serper.dev',
    });
  }

  if (braveKey) {
    Connector.create({
      name: 'brave-main',
      serviceType: Services.BraveSearch,
      auth: {
        type: 'api_key',
        apiKey: braveKey,
        headerName: 'X-Subscription-Token',
        headerPrefix: '',
      },
      baseURL: 'https://api.search.brave.com/res/v1',
    });
  }

  if (rapidAPIKey) {
    Connector.create({
      name: 'rapidapi-search',
      serviceType: Services.RapidapiSearch,
      auth: {
        type: 'api_key',
        apiKey: rapidAPIKey,
        headerName: 'X-RapidAPI-Key',
        headerPrefix: '',
      },
      baseURL: 'https://real-time-web-search.p.rapidapi.com',
    });
  }

  // ============ Use SearchProvider Directly ============

  console.log('=== SearchProvider Demo ===\n');

  // Create search provider from connector
  if (serperKey) {
    const serperSearch = SearchProvider.create({ connector: 'serper-main' });
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
  }

  // ============ Use RapidAPI Provider ============

  console.log('\n=== RapidAPI Search Demo ===\n');

  if (rapidAPIKey) {
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
  }

  // ============ Multiple Keys (Resilience) ============

  console.log('\n=== Multiple Keys Demo ===\n');

  // Create backup connector
  const serperBackupKey = process.env.SERPER_API_KEY_BACKUP;
  if (serperKey && serperBackupKey) {
    Connector.create({
      name: 'serper-backup',
      serviceType: Services.Serper,
      auth: {
        type: 'api_key',
        apiKey: serperBackupKey,
        headerName: 'X-API-KEY',
        headerPrefix: '',
      },
      baseURL: 'https://google.serper.dev',
    });

    try {
      const mainSearch = SearchProvider.create({ connector: 'serper-main' });
      const mainResult = await mainSearch.search('test query');
      console.log(`Main connector ${mainResult.success ? 'succeeded' : 'returned an error'}`);
    } catch {
      console.log('Main connector failed, trying backup...');
      const backupSearch = SearchProvider.create({ connector: 'serper-backup' });
      const backupResult = await backupSearch.search('test query');
      console.log(`Backup connector ${backupResult.success ? 'succeeded' : 'returned an error'}`);
    }
  } else {
    console.log('Set SERPER_API_KEY_BACKUP to exercise named-key failover.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
