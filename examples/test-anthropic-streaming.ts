/**
 * Test Anthropic streaming usage tracking
 */

import { OneRingAI, StreamEventType, StreamHelpers } from '../src/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = new OneRingAI({
    providers: {
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    },
  });

  const agent = await client.agents.create({
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250929',
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
}

main();
