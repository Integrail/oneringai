/**
 * Example: Simple text streaming
 *
 * Demonstrates basic streaming with text output
 * Works with all providers (OpenAI, Anthropic, Google)
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, isOutputTextDelta, StreamHelpers } from '../src/index.js';

async function main() {
  // Create connectors for each provider
  if (process.env.OPENAI_API_KEY) {
    Connector.create({
      name: 'openai',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    Connector.create({
      name: 'anthropic',
      vendor: Vendor.Anthropic,
      auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY },
    });
  }

  if (process.env.GOOGLE_API_KEY) {
    Connector.create({
      name: 'google',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY },
    });
  }

  console.log('=== Simple Text Streaming Example ===\n');

  // Example 1: Stream with OpenAI
  if (Connector.has('openai')) {
    console.log('1. Streaming with OpenAI (GPT-4)...\n');
    console.log('Assistant: ');

    const agent1 = Agent.create({
      connector: 'openai',
      model: 'gpt-4',
    });

    for await (const event of agent1.stream('Write a haiku about streaming data.')) {
      if (isOutputTextDelta(event)) {
        process.stdout.write(event.delta);
      }
    }

    console.log('\n\n---\n');
  }

  // Example 2: Using textOnly helper with Anthropic
  if (Connector.has('anthropic')) {
    console.log('2. Using StreamHelpers.textOnly() with Anthropic...\n');
    console.log('Assistant: ');

    const agent2 = Agent.create({
      connector: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });

    for await (const text of StreamHelpers.textOnly(agent2.stream('Write a limerick about AI agents.'))) {
      process.stdout.write(text);
    }

    console.log('\n\n---\n');
  }

  // Example 3: Accumulate complete text with Google
  if (Connector.has('google')) {
    console.log('3. Accumulating text with Google Gemini...\n');

    const agent3 = Agent.create({
      connector: 'google',
      model: 'gemini-2.0-flash',
    });

    const completeText = await StreamHelpers.accumulateText(
      agent3.stream('Explain quantum computing in one sentence.')
    );
    console.log('Complete response:', completeText);
  }

  console.log('\n\n✅ Done!');
}

main().catch(console.error);
