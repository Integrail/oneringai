/**
 * Basic agent example with tool calling
 */

import 'dotenv/config';
import { OneRingAI, ToolFunction } from '../src/index.js';

// Create a weather tool
const weatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name (e.g., "Paris", "New York")',
          },
          units: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature units',
          },
        },
        required: ['location'],
      },
    },
    blocking: true, // Wait for result before continuing
  },
  execute: async (args: { location: string; units?: string }) => {
    console.log(`\n🌤️  Fetching weather for ${args.location}...`);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock weather data
    const weatherData = {
      location: args.location,
      temperature: args.units === 'fahrenheit' ? 72 : 22,
      units: args.units || 'celsius',
      conditions: 'Partly cloudy',
      humidity: 65,
      wind_speed: 12,
    };

    console.log(`✅ Weather data retrieved`);
    return weatherData;
  },
};

// Create a calculator tool
const calculatorTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2", "10 * 5")',
          },
        },
        required: ['expression'],
      },
    },
    blocking: true,
  },
  execute: async (args: { expression: string }) => {
    console.log(`\n🔢 Calculating: ${args.expression}`);

    try {
      // Simple eval - in production, use a safe math parser!
      const result = eval(args.expression);
      console.log(`✅ Result: ${result}`);
      return { expression: args.expression, result };
    } catch (error) {
      console.log(`❌ Calculation error`);
      throw new Error(`Invalid expression: ${args.expression}`);
    }
  },
};

async function main() {
  // Create client
  const client = new OneRingAI({
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
    },
  });

  console.log('🤖 Creating agent with tools...\n');

  // Create agent with tools
  const agent = client.agents.create({
    provider: 'openai',
    model: 'gpt-4',
    tools: [weatherTool, calculatorTool],
    instructions: 'You are a helpful assistant that can check weather and perform calculations. Be concise.',
    temperature: 0.7,
    maxIterations: 10,
  });

  // Example 1: Weather query
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Example 1: Weather Query');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response1 = await agent.run('What is the weather like in Tokyo?');
  console.log('\n📝 Agent Response:');
  console.log(response1.output_text);

  // Example 2: Calculation
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Example 2: Calculation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response2 = await agent.run('Calculate 123 * 456 and tell me the result');
  console.log('\n📝 Agent Response:');
  console.log(response2.output_text);

  // Example 3: Multiple tools in one query
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Example 3: Multiple Tools');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const response3 = await agent.run(
    'What is the temperature in Paris in Fahrenheit, and what is 32 + 15?'
  );
  console.log('\n📝 Agent Response:');
  console.log(response3.output_text);

  console.log('\n\n✅ All examples completed!');
}

// Run examples
main().catch(console.error);
