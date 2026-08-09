/**
 * Simple text generation examples
 *
 * Demonstrates text generation using the new Connector-First API.
 * For simple text generation, use Agent without tools.
 */

import 'dotenv/config';
import { Connector, Agent, Vendor } from '../src/index.js';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  // Create connector with credentials
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  console.log('🤖 Simple Text Generation Examples\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Example 1: Basic text generation
  console.log('Example 1: Basic Question');
  console.log('─────────────────────────\n');

  const agent1 = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
  });

  const response1 = await agent1.run('What is the capital of France?');
  console.log('Response:', response1.output_text);

  // Example 2: With system instructions
  console.log('\n\nExample 2: With Instructions');
  console.log('─────────────────────────\n');

  const agent2 = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
    instructions: 'You are a teacher explaining concepts to a 10-year-old. Use simple language and analogies.',
    temperature: 0.7,
  });

  const response2 = await agent2.run('Explain quantum computing');
  console.log('Response:', response2.output_text);

  // Example 3: Vendor-neutral schema-constrained JSON output
  console.log('\n\nExample 3: Structured JSON Output');
  console.log('─────────────────────────\n');

  interface RecipeOutput {
    name: string;
    ingredients: string[];
    steps: string[];
    prep_time_minutes: number;
  }

  const agent3 = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
    instructions: 'You are a helpful cooking assistant.',
  });

  const response3 = await agent3.run('Give me a simple pasta recipe.', {
    responseFormat: {
      type: 'json_schema',
      name: 'recipe',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ingredients: { type: 'array', items: { type: 'string' } },
          steps: { type: 'array', items: { type: 'string' } },
          prep_time_minutes: { type: 'number' },
        },
        required: ['name', 'ingredients', 'steps', 'prep_time_minutes'],
        additionalProperties: false,
      },
    },
  });

  const recipe = response3.output_parsed as RecipeOutput;
  console.log('Recipe:', JSON.stringify(recipe, null, 2));

  agent1.destroy();
  agent2.destroy();
  agent3.destroy();
  console.log('\n\n✅ All examples completed!');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
