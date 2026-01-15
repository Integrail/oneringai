/**
 * Simple text generation examples
 *
 * Demonstrates text generation using the new Connector-First API.
 * For simple text generation, use Agent without tools.
 */

import 'dotenv/config';
import { Connector, Agent, Vendor } from '../src/index.js';

async function main() {
  // Create connector with credentials
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY || '' },
  });

  console.log('🤖 Simple Text Generation Examples\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Example 1: Basic text generation
  console.log('Example 1: Basic Question');
  console.log('─────────────────────────\n');

  const agent1 = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
  });

  const response1 = await agent1.run('What is the capital of France?');
  console.log('Response:', response1.output_text);

  // Example 2: With system instructions
  console.log('\n\nExample 2: With Instructions');
  console.log('─────────────────────────\n');

  const agent2 = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
    instructions: 'You are a teacher explaining concepts to a 10-year-old. Use simple language and analogies.',
    temperature: 0.7,
  });

  const response2 = await agent2.run('Explain quantum computing');
  console.log('Response:', response2.output_text);

  // Example 3: JSON output (using response_format)
  console.log('\n\nExample 3: Structured JSON Output');
  console.log('─────────────────────────\n');

  interface RecipeOutput {
    name: string;
    ingredients: string[];
    steps: string[];
    prep_time_minutes: number;
  }

  // Note: For JSON output, use the provider's native JSON mode
  // The response will be JSON that you can parse
  const agent3 = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
    instructions: `You are a helpful assistant. Always respond with valid JSON matching this schema:
{
  "name": "string",
  "ingredients": ["string"],
  "steps": ["string"],
  "prep_time_minutes": number
}`,
  });

  const response3 = await agent3.run('Give me a simple pasta recipe. Respond with JSON only.');

  try {
    const recipe = JSON.parse(response3.output_text) as RecipeOutput;
    console.log('Recipe:', JSON.stringify(recipe, null, 2));
  } catch {
    console.log('Raw response:', response3.output_text);
  }

  console.log('\n\n✅ All examples completed!');
}

main().catch(console.error);
