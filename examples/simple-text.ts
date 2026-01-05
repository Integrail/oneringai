/**
 * Simple text generation examples
 */

import 'dotenv/config';
import { OneRingAI } from '../src/index.js';

async function main() {
  // Create client
  const client = new OneRingAI({
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
    },
  });

  console.log('🤖 Simple Text Generation Examples\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Example 1: Basic text generation
  console.log('Example 1: Basic Question');
  console.log('─────────────────────────\n');

  const response1 = await client.text.generate('What is the capital of France?', {
    provider: 'openai',
    model: 'gpt-4',
  });

  console.log('Response:', response1);

  // Example 2: With system instructions
  console.log('\n\nExample 2: With Instructions');
  console.log('─────────────────────────\n');

  const response2 = await client.text.generate('Explain quantum computing', {
    provider: 'openai',
    model: 'gpt-4',
    instructions: 'You are a teacher explaining concepts to a 10-year-old. Use simple language and analogies.',
    temperature: 0.7,
    max_output_tokens: 150,
  });

  console.log('Response:', response2);

  // Example 3: JSON output
  console.log('\n\nExample 3: Structured JSON Output');
  console.log('─────────────────────────\n');

  interface RecipeOutput {
    name: string;
    ingredients: string[];
    steps: string[];
    prep_time_minutes: number;
  }

  const recipe = await client.text.generateJSON<RecipeOutput>(
    'Give me a simple pasta recipe',
    {
      provider: 'openai',
      model: 'gpt-4',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ingredients: {
            type: 'array',
            items: { type: 'string' },
          },
          steps: {
            type: 'array',
            items: { type: 'string' },
          },
          prep_time_minutes: { type: 'number' },
        },
        required: ['name', 'ingredients', 'steps', 'prep_time_minutes'],
      },
    }
  );

  console.log('Recipe:', JSON.stringify(recipe, null, 2));

  console.log('\n\n✅ All examples completed!');
}

main().catch(console.error);
