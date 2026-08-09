/**
 * Test Anthropic streaming usage tracking
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, StreamEventType } from '../src/index.js';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required. Add it to .env.');

  Connector.create({
    name: 'anthropic',
    vendor: Vendor.Anthropic,
    auth: { type: 'api_key', apiKey },
  });

  const agent = Agent.create({
    connector: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    instructions: 'Be concise.',
  });

  console.log('Testing Anthropic streaming usage tracking...\n');
  console.log('User: Write a haiku about streaming\n');
  console.log('Assistant: ');

  let eventCount = 0;
  let usageEvents = 0;
  let finalUsage = null;

  for await (const event of agent.stream('Write a haiku about streaming')) {
    eventCount++;

    if (event.type === StreamEventType.OUTPUT_TEXT_DELTA) {
      process.stdout.write(event.delta);
    }

    if (event.type === StreamEventType.RESPONSE_COMPLETE) {
      console.log(`\n\n[RESPONSE_COMPLETE event]`);
      console.log('Usage:', JSON.stringify(event.usage, null, 2));
      finalUsage = event.usage;
      usageEvents++;
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log('Total events:', eventCount);
  console.log('Usage events:', usageEvents);
  console.log('Final usage:', finalUsage);
  if (usageEvents !== 1 || !finalUsage) {
    throw new Error('The stream did not include exactly one final usage event.');
  }
  agent.destroy();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
