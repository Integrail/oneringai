/**
 * Multi-Provider Comparison Example
 *
 * This example demonstrates using multiple AI providers with the same code.
 * Just change the provider name and model to switch between OpenAI, Anthropic, Google, etc.
 *
 * Setup: Add API keys to your .env file:
 *   OPENAI_API_KEY=sk-...
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   GOOGLE_API_KEY=...
 *   GROQ_API_KEY=...
 *   TOGETHER_API_KEY=...
 */

import 'dotenv/config';
import { OneRingAI } from '../src/index.js';

async function main() {
  console.log('🌐 Multi-Provider Comparison\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Configure all available providers
  const client = new OneRingAI({
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
      },
      google: {
        apiKey: process.env.GOOGLE_API_KEY || '',
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY || '',
        baseURL: 'https://api.groq.com/openai/v1',
      },
      'together-ai': {
        apiKey: process.env.TOGETHER_API_KEY || '',
        baseURL: 'https://api.together.xyz/v1',
      },
    },
  });

  // List configured providers
  console.log('📋 Configured providers:', client.listProviders().join(', '));
  console.log('');

  const question = 'Explain quantum entanglement in one sentence.';
  console.log(`❓ Question: "${question}"\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test each provider
  const providers = [
    { name: 'openai', model: 'gpt-4o', enabled: !!process.env.OPENAI_API_KEY },
    { name: 'anthropic', model: 'claude-sonnet-4-5-20250929', enabled: !!process.env.ANTHROPIC_API_KEY },
    { name: 'google', model: 'gemini-3-flash-preview', enabled: !!process.env.GOOGLE_API_KEY },
    { name: 'groq', model: 'llama-3.1-70b-versatile', enabled: !!process.env.GROQ_API_KEY },
    { name: 'together-ai', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', enabled: !!process.env.TOGETHER_API_KEY },
  ];

  for (const provider of providers) {
    if (!provider.enabled) {
      console.log(`⏭️  Skipping ${provider.name} (API key not set)\n`);
      continue;
    }

    try {
      console.log(`🤖 Testing ${provider.name.toUpperCase()} (${provider.model})...`);

      const startTime = Date.now();
      const response = await client.text.generate(question, {
        provider: provider.name,
        model: provider.model,
        temperature: 0.7,
        max_output_tokens: 100,
      });
      const duration = Date.now() - startTime;

      console.log(`✅ Response (${duration}ms):`);
      console.log(`   "${response}"`);
      console.log('');
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Comparison complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('💡 Tips:');
  console.log('   • All providers use the exact same code');
  console.log('   • Just change `provider` and `model` parameters');
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
