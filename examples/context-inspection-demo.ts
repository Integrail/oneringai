/**
 * Context Inspection Tools Demo
 *
 * This example shows how agents can use the new context inspection
 * tools to monitor their own state and manage resources proactively.
 */

import 'dotenv/config';
import { Connector, Vendor, TaskAgent, ToolFunction } from '../src/index.js';

// Tool that generates large responses
const dataFetchTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'fetch_large_dataset',
      description: 'Fetch a large dataset from API',
      parameters: {
        type: 'object',
        properties: {
          dataset: { type: 'string', description: 'Dataset name' },
          size: { type: 'number', description: 'Number of records' },
        },
        required: ['dataset', 'size'],
      },
    },
  },
  execute: async (args) => {
    console.log(`  📦 Fetching ${args.size} records from ${args.dataset}...`);

    // Generate large response
    const records = Array.from({ length: args.size }, (_, i) => ({
      id: i + 1,
      name: `Record ${i + 1}`,
      data: `Data for record ${i + 1}`.repeat(10), // Make it bulky
    }));

    return {
      dataset: args.dataset,
      count: records.length,
      records: records,
      timestamp: Date.now(),
    };
  },
  idempotency: { safe: true },
};

// Tool that does expensive computation
const computeTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'complex_computation',
      description: 'Perform complex computation',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string' },
          iterations: { type: 'number' },
        },
        required: ['operation', 'iterations'],
      },
    },
  },
  execute: async (args) => {
    console.log(`  🧮 Computing ${args.operation} (${args.iterations} iterations)...`);

    // Simulate computation
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      operation: args.operation,
      result: Math.random() * 1000,
      iterations: args.iterations,
    };
  },
  idempotency: { safe: false, ttlMs: 60000 },
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Context Inspection Tools Demo                        ║');
  console.log('║         Self-Aware Agents with Resource Monitoring           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Setup
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
  });

  // ============================================================
  // Example 1: Context Monitoring
  // ============================================================
  console.log('📊 Example 1: Context Monitoring\n');
  console.log('Creating agent that monitors its own context usage...\n');

  const agent1 = TaskAgent.create({
    connector: 'openai',
    model: 'gpt-4',
    tools: [dataFetchTool],
    maxIterations: 20,
  });

  const handle1 = await agent1.start({
    goal: 'Monitor context usage while fetching data',
    context: 'Demonstrate context inspection tools',
    tasks: [
      {
        name: 'inspect_initial',
        description: 'Check initial context state using context_inspect(). Show total, used, and available tokens.',
      },
      {
        name: 'fetch_data',
        description: 'Fetch 100 records using fetch_large_dataset tool',
      },
      {
        name: 'inspect_after',
        description: 'Check context state again after fetching data. Compare with initial state and report the difference.',
      },
      {
        name: 'breakdown',
        description: 'Get detailed breakdown using context_breakdown(). Identify which component uses the most tokens.',
      },
    ],
  });

  console.log('\nAgent is running tasks...\n');

  agent1.on('task:complete', ({ task }) => {
    console.log(`  ✅ ${task.name} completed`);
  });

  const result1 = await handle1.wait();
  console.log(`\n✅ Example 1 Complete: ${result1.status}\n`);
  console.log('─'.repeat(64) + '\n');

  await agent1.destroy();

  // ============================================================
  // Example 2: Cache Effectiveness Monitoring
  // ============================================================
  console.log('📈 Example 2: Cache Effectiveness Monitoring\n');
  console.log('Creating agent that monitors idempotency cache...\n');

  const agent2 = TaskAgent.create({
    connector: 'openai',
    model: 'gpt-4',
    tools: [computeTool],
    maxIterations: 20,
  });

  const handle2 = await agent2.start({
    goal: 'Test cache effectiveness',
    context: 'Call the same computation multiple times and monitor cache hits',
    tasks: [
      {
        name: 'initial_cache',
        description: 'Check initial cache stats using cache_stats()',
      },
      {
        name: 'first_computation',
        description: 'Perform complex_computation with operation="prime_factorization" and iterations=1000',
      },
      {
        name: 'second_computation',
        description: 'Perform the SAME computation again (operation="prime_factorization", iterations=1000). This should hit the cache.',
      },
      {
        name: 'check_cache',
        description: 'Check cache stats again using cache_stats(). Report the hit rate and effectiveness.',
      },
    ],
  });

  console.log('\nAgent is running tasks...\n');

  agent2.on('task:complete', ({ task }) => {
    console.log(`  ✅ ${task.name} completed`);
  });

  const result2 = await handle2.wait();
  console.log(`\n✅ Example 2 Complete: ${result2.status}\n`);
  console.log('─'.repeat(64) + '\n');

  await agent2.destroy();

  // ============================================================
  // Example 3: Memory Management
  // ============================================================
  console.log('💾 Example 3: Memory Management\n');
  console.log('Creating agent that monitors working memory...\n');

  const agent3 = TaskAgent.create({
    connector: 'openai',
    model: 'gpt-4',
    tools: [],
    maxIterations: 20,
  });

  const handle3 = await agent3.start({
    goal: 'Demonstrate memory inspection',
    context: 'Show how agents can inspect working memory',
    tasks: [
      {
        name: 'store_data',
        description: 'Store 3 pieces of data in memory: memory_store with key="user.name", description="User full name", value="John Doe". Then store key="user.email" with value="john@example.com". Then store key="session.id" with value="abc123".',
      },
      {
        name: 'inspect_memory',
        description: 'Use memory_stats() to list all stored entries. Report the count and list each entry.',
      },
      {
        name: 'retrieve_and_verify',
        description: 'Use memory_retrieve to get user.name and verify it contains the correct value.',
      },
      {
        name: 'cleanup',
        description: 'Delete the session.id entry using memory_delete, then check memory_stats again to verify it was removed.',
      },
    ],
  });

  console.log('\nAgent is running tasks...\n');

  agent3.on('task:complete', ({ task }) => {
    console.log(`  ✅ ${task.name} completed`);
  });

  const result3 = await handle3.wait();
  console.log(`\n✅ Example 3 Complete: ${result3.status}\n`);
  console.log('─'.repeat(64) + '\n');

  await agent3.destroy();

  // ============================================================
  // Example 4: Proactive Resource Management
  // ============================================================
  console.log('🤖 Example 4: Proactive Resource Management\n');
  console.log('Creating agent that manages its own resources...\n');

  const agent4 = TaskAgent.create({
    connector: 'openai',
    model: 'gpt-4',
    tools: [dataFetchTool],
    maxIterations: 30,
  });

  const handle4 = await agent4.start({
    goal: 'Smart resource management',
    context: 'Agent should check resources before each operation and clean up as needed',
    tasks: [
      {
        name: 'check_before_fetch',
        description: 'Before fetching data, use context_inspect() to check if we have enough space. Report the status.',
      },
      {
        name: 'fetch_if_safe',
        description: 'If context status is "ok" or "warning", fetch 50 records. If "critical", skip this step and report why.',
      },
      {
        name: 'monitor_and_optimize',
        description: 'Use all 4 inspection tools: context_inspect, context_breakdown, cache_stats, memory_stats. Analyze the results and suggest one optimization.',
      },
    ],
  });

  console.log('\nAgent is running tasks...\n');

  agent4.on('task:complete', ({ task }) => {
    console.log(`  ✅ ${task.name} completed`);
  });

  const result4 = await handle4.wait();
  console.log(`\n✅ Example 4 Complete: ${result4.status}\n`);

  await agent4.destroy();

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n' + '═'.repeat(64));
  console.log('                      SUMMARY');
  console.log('═'.repeat(64));
  console.log('\n🎯 What We Demonstrated:\n');
  console.log('1. context_inspect()   - Monitor context budget and utilization');
  console.log('2. context_breakdown() - Identify what consumes context space');
  console.log('3. cache_stats()       - Track cache hit rate and effectiveness');
  console.log('4. memory_stats()      - List and monitor working memory entries');
  console.log('\n✨ Key Benefits:\n');
  console.log('• Self-Awareness    - Agents understand their own state');
  console.log('• Proactive         - Can prevent issues before they occur');
  console.log('• Debuggable        - Easy to diagnose resource problems');
  console.log('• Intelligent       - Make informed decisions about resources');
  console.log('\n💡 Use Cases:\n');
  console.log('• Check context before storing large data');
  console.log('• Verify cache effectiveness for optimization');
  console.log('• Monitor memory usage and cleanup');
  console.log('• Debug context overflow issues');
  console.log('• Track resource consumption patterns');
  console.log('\n📊 Tool Availability:\n');
  console.log('All 4 tools are automatically available in every TaskAgent.');
  console.log('No configuration needed - just call them from tasks!');
  console.log('\n');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
