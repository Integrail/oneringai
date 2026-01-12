/**
 * Test OpenAI streaming usage tracking
 */

import { OneRingAI, StreamEventType } from '../src/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const client = new OneRingAI({
    providers: {
      openai: { apiKey: process.env.OPENAI_API_KEY! },
    },
  });

  const agent = await client.agents.create({
    provider: 'openai',
    model: 'gpt-4o-mini',
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
}

main();
