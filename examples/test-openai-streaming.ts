/**
 * Test OpenAI streaming usage tracking
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, StreamEventType } from '../src/index.js';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required. Add it to .env.');

  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
    instructions: 'Be concise.',
  });

  console.log('Testing OpenAI streaming usage tracking...\n');
  console.log('User: Hello\n');
  console.log('Assistant: ');

  let eventCount = 0;
  let usageEvents = 0;

  for await (const event of agent.stream('Hello')) {
    eventCount++;

    if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
      process.stdout.write(event.delta);
    }

    if (event.type === StreamEventType.RESPONSE_COMPLETE) {
      console.log(`\n\n[RESPONSE_COMPLETE event]`);
      console.log('Usage:', JSON.stringify(event.usage, null, 2));
      usageEvents++;
    }

    // Log all events
    console.error(`[Event ${eventCount}] ${event.type}`);
  }

  console.log('\n\n=== SUMMARY ===');
  console.log('Total events:', eventCount);
  console.log('Usage events:', usageEvents);
  if (usageEvents !== 1) throw new Error(`Expected one response-complete usage event, received ${usageEvents}.`);
  agent.destroy();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
