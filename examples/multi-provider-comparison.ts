/**
 * Multi-Provider Comparison Example
 *
 * This example demonstrates using multiple AI providers with the same code.
 * Just change the connector and model to switch between OpenAI, Anthropic, Google, etc.
 *
 * Setup: Add API keys to your .env file:
 *   OPENAI_API_KEY=sk-...
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   GOOGLE_API_KEY=...
 *   GROQ_API_KEY=...
 *   TOGETHER_API_KEY=...
 */

import 'dotenv/config';
import { Connector, Agent, Vendor } from '../src/index.js';

async function main() {
  console.log('🌐 Multi-Provider Comparison\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create connectors for all available providers
  const configuredProviders: string[] = [];

  if (process.env.OPENAI_API_KEY) {
    Connector.create({
      name: 'openai',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
    });
    configuredProviders.push('openai');
  }

  if (process.env.ANTHROPIC_API_KEY) {
    Connector.create({
      name: 'anthropic',
      vendor: Vendor.Anthropic,
      auth: { type: 'api_key', apiKey: process.env.ANTHROPIC_API_KEY },
    });
    configuredProviders.push('anthropic');
  }

  if (process.env.GOOGLE_API_KEY) {
    Connector.create({
      name: 'google',
      vendor: Vendor.Google,
      auth: { type: 'api_key', apiKey: process.env.GOOGLE_API_KEY },
    });
    configuredProviders.push('google');
  }

  if (process.env.GROQ_API_KEY) {
    Connector.create({
      name: 'groq',
      vendor: Vendor.Groq,
      auth: { type: 'api_key', apiKey: process.env.GROQ_API_KEY },
    });
    configuredProviders.push('groq');
  }

  if (process.env.TOGETHER_API_KEY) {
    Connector.create({
      name: 'together',
      vendor: Vendor.Together,
      auth: { type: 'api_key', apiKey: process.env.TOGETHER_API_KEY },
    });
    configuredProviders.push('together');
  }

  console.log('📋 Configured providers:', configuredProviders.join(', '));
  console.log('');

  const question = 'Explain quantum entanglement in one sentence.';
  console.log(`❓ Question: "${question}"\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test each provider
  const providers = [
    { name: 'openai', model: 'gpt-4o', enabled: Connector.has('openai') },
    { name: 'anthropic', model: 'claude-sonnet-4-5-20250929', enabled: Connector.has('anthropic') },
    { name: 'google', model: 'gemini-3-flash-preview', enabled: Connector.has('google') },
    { name: 'groq', model: 'llama-3.1-70b-versatile', enabled: Connector.has('groq') },
    { name: 'together', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', enabled: Connector.has('together') },
  ];

  for (const provider of providers) {
    if (!provider.enabled) {
      console.log(`⏭️  Skipping ${provider.name} (API key not set)\n`);
      continue;
    }

    try {
      console.log(`🤖 Testing ${provider.name.toUpperCase()} (${provider.model})...`);

      const startTime = Date.now();

      const agent = Agent.create({
        connector: provider.name,
        model: provider.model,
        temperature: 0.7,
      });

      const response = await agent.run(question);
      const duration = Date.now() - startTime;

      console.log(`✅ Response (${duration}ms):`);
      console.log(`   "${response.output_text}"`);
      console.log('');
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Comparison complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 Tips:');
  console.log('   • All providers use the exact same code pattern');
  console.log('   • Just change `connector` and `model` parameters');
  console.log('   • Works with agents, tools, vision, everything!');
  console.log('');
  console.log('🔑 To enable more providers, add API keys to .env:');
  console.log('   OPENAI_API_KEY=sk-...');
  console.log('   ANTHROPIC_API_KEY=sk-ant-...');
  console.log('   GOOGLE_API_KEY=...');
  console.log('   GROQ_API_KEY=gsk_...');
  console.log('   TOGETHER_API_KEY=...');
}

main().catch(console.error);
