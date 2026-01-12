/**
 * Example: Simple text streaming
 *
 * Demonstrates basic streaming with text output
 * Works with all providers (OpenAI, Anthropic, Google)
 */

import { OneRingAI, isOutputTextDelta, StreamHelpers } from '@oneringai/agents';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Initialize client
  const client = new OneRingAI({
    providers: {
      openai: { apiKey: process.env.OPENAI_API_KEY! },
      anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
      google: { apiKey: process.env.GOOGLE_API_KEY! },
    },
  });

  console.log('=== Simple Text Streaming Example ===\n');

  // Example 1: Stream with OpenAI
  console.log('1. Streaming with OpenAI (GPT-4)...\n');
  console.log('Assistant: ');

  const stream = client.text.getProvider('openai').streamGenerate({
    model: 'gpt-4',
    input: 'Write a haiku about streaming data.',
  });

  for await (const event of stream) {
    if (isOutputTextDelta(event)) {
      process.stdout.write(event.delta);
    }
  }

  console.log('\n\n---\n');

  // Example 2: Using textOnly helper
  console.log('2. Using StreamHelpers.textOnly() with Anthropic...\n');
  console.log('Assistant: ');

  const stream2 = client.text.getProvider('anthropic').streamGenerate({
    model: 'claude-sonnet-4-20250514',
    input: 'Write a limerick about AI agents.',
  });

  for await (const text of StreamHelpers.textOnly(stream2)) {
    process.stdout.write(text);
  }

  console.log('\n\n---\n');

  // Example 3: Accumulate complete text
  console.log('3. Accumulating text with Google Gemini...\n');

  const stream3 = client.text.getProvider('google').streamGenerate({
    model: 'gemini-2.0-flash',
    input: 'Explain quantum computing in one sentence.',
  });

  const completeText = await StreamHelpers.accumulateText(stream3);
  console.log('Complete response:', completeText);

  console.log('\n\n✅ Done!');
}

main().catch(console.error);
