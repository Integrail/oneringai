/**
 * Web Research Agent Example
 *
 * Demonstrates using web tools together:
 * - web_search - Find relevant URLs
 * - web_fetch - Get content from static sites
 * - json_manipulate - Structure the findings
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, tools, ToolFunction } from '../src/index.js';

async function main() {
  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY || '' },
  });

  console.log('🔍 Web Research Agent Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if search API is configured
  if (!process.env.SERPER_API_KEY && !process.env.BRAVE_API_KEY && !process.env.TAVILY_API_KEY) {
    console.log('⚠️  No search API key found!');
    console.log('');
    console.log('Add at least one search API key to your .env file:');
    console.log('  SERPER_API_KEY=...  (recommended - 2,500 free queries)');
    console.log('  BRAVE_API_KEY=...');
    console.log('  TAVILY_API_KEY=...');
    console.log('');
    console.log('Get Serper API key at: https://serper.dev/');
    console.log('');
    console.log('Continuing with web_fetch only (no search)...\n');
  }

  // Create agent with web tools
  const webTools: ToolFunction[] = [tools.webFetch, tools.webSearch, tools.jsonManipulator];

  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
    tools: webTools,
    instructions:
      'You are a web research assistant. Use web_search to find information, then use web_fetch to get full content from relevant pages.',
  });

  // Example 1: Simple web fetch
  console.log('Example 1: Fetch a Static Page');
  console.log('─────────────────────────────\n');

  const response1 = await agent.run(`
Fetch the content from https://example.com and tell me what it says.
`);

  console.log('🤖 Agent response:');
  console.log(response1.output_text);
  console.log('\n');

  // Example 2: Web search (if API key available)
  if (process.env.SERPER_API_KEY || process.env.BRAVE_API_KEY || process.env.TAVILY_API_KEY) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Example 2: Web Search');
    console.log('─────────────────────────────\n');

    const response2 = await agent.run(`
Search for "TypeScript 5.0 new features" and give me a summary of what you find.
`);

    console.log('🤖 Agent response:');
    console.log(response2.output_text);
    console.log('\n');

    // Example 3: Research and structure
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Example 3: Research and Structure Data');
    console.log('─────────────────────────────\n');

    const response3 = await agent.run(`
Research "AI agent frameworks 2026":
1. Search for recent articles
2. Fetch content from top 2-3 results
3. Create a JSON object with this structure:
   {
     "topic": "AI agent frameworks 2026",
     "sources": [
       { "title": "...", "url": "...", "keyPoints": ["...", "..."] }
     ],
     "summary": "Overall summary in one paragraph"
   }

Return the JSON object.
`);

    console.log('🤖 Agent response:');
    console.log(response3.output_text);
    console.log('\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Web research examples completed!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 Available Tools:');
  console.log('  • web_search  - Find URLs with search APIs');
  console.log('  • web_fetch   - Get content from static sites');
  console.log('  • json_manipulate - Structure the findings');
  console.log('');

  if (!process.env.SERPER_API_KEY) {
    console.log('🔑 Get started with web search:');
    console.log('   1. Sign up at https://serper.dev/ (free 2,500 queries)');
    console.log('   2. Add SERPER_API_KEY to your .env file');
    console.log('   3. Run this example again');
    console.log('');
  }
}

main().catch(console.error);
