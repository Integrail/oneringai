/**
 * Basic TaskAgent Example
 *
 * Demonstrates how to use TaskAgent for autonomous task execution
 * with working memory and plan-based workflows.
 */

import {
  Connector,
  Vendor,
  TaskAgent,
  ToolFunction,
  createMemoryTools,
} from '../dist/index.js';

// Create a connector
Connector.create({
  name: 'openai',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY || 'test-key' },
});

// Define custom tools
const getWeatherTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    },
  },
  execute: async (args) => {
    console.log(`[Tool] Getting weather for ${args.location}`);
    return {
      location: args.location,
      temperature: 72,
      conditions: 'sunny',
      humidity: 45,
    };
  },
  // Tool is naturally idempotent (GET request)
  idempotency: { safe: true },
  output: { expectedSize: 'small' },
};

const sendEmailTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to a recipient',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  execute: async (args) => {
    console.log(`[Tool] Sending email to ${args.to}`);
    console.log(`Subject: ${args.subject}`);
    console.log(`Body: ${args.body}`);
    return { success: true, messageId: `msg-${Date.now()}` };
  },
  // Email sending is NOT idempotent - cache the result
  idempotency: {
    safe: false,
    keyFn: (args) => `${args.to}:${args.subject}`,
    ttlMs: 60000, // 1 minute
  },
  output: { expectedSize: 'small' },
};

async function main() {
  console.log('=== TaskAgent Example ===\n');

  // Create TaskAgent
  const agent = TaskAgent.create({
    connector: 'openai',
    model: 'gpt-4',
    tools: [getWeatherTool, sendEmailTool],
    instructions: 'You are a helpful assistant that completes tasks systematically.',

    // Hooks for monitoring
    hooks: {
      onStart: async (agent, plan) => {
        console.log(`[Agent] Starting plan: ${plan.goal}`);
        console.log(`[Agent] Tasks: ${plan.tasks.length}`);
      },
      beforeTask: async (task) => {
        console.log(`[Agent] Starting task: ${task.name}`);
      },
      afterTask: async (task, result) => {
        console.log(`[Agent] Completed task: ${task.name} (${result.success ? 'success' : 'failed'})`);
      },
      onComplete: async (result) => {
        console.log(`[Agent] Plan completed: ${result.status}`);
        console.log(`[Agent] Metrics:`, result.metrics);
      },
    },

    // Memory configuration
    memoryConfig: {
      maxSizeBytes: 1024 * 1024, // 1MB
      descriptionMaxLength: 150,
      softLimitPercent: 80,
      contextAllocationPercent: 20,
    },
  });

  // Define a plan
  const handle = await agent.start({
    goal: 'Check weather and notify user',
    context: 'User wants to know if they should bring an umbrella',

    tasks: [
      {
        name: 'fetch_weather',
        description: 'Get current weather for San Francisco',
        expectedOutput: 'Weather data including temperature and conditions',
      },
      {
        name: 'analyze_weather',
        description: 'Analyze if user needs an umbrella based on weather',
        dependsOn: ['fetch_weather'],
      },
      {
        name: 'send_notification',
        description: 'Send email to user with weather advice',
        dependsOn: ['analyze_weather'],
      },
    ],

    // Allow agent to add additional tasks if needed
    allowDynamicTasks: true,
  });

  console.log(`\n[Agent] ID: ${handle.agentId}`);
  console.log(`[Agent] Plan ID: ${handle.planId}\n`);

  // Wait for completion
  const result = await handle.wait();

  console.log('\n=== Execution Complete ===');
  console.log('Status:', result.status);
  console.log('Metrics:', result.metrics);

  // Inspect working memory
  const memory = agent.getMemory();
  const memoryIndex = await memory.getIndex();

  console.log('\n=== Working Memory ===');
  console.log(`Utilization: ${memoryIndex.utilizationPercent.toFixed(1)}%`);
  console.log(`Entries: ${memoryIndex.entries.length}`);

  for (const entry of memoryIndex.entries) {
    console.log(`  - ${entry.key} (${entry.size}): ${entry.description}`);
  }

  // Get final state
  const finalState = agent.getState();
  console.log('\n=== Agent State ===');
  console.log('Status:', finalState.status);
  console.log('LLM Calls:', finalState.metrics.totalLLMCalls);
  console.log('Tool Calls:', finalState.metrics.totalToolCalls);
  console.log('Total Cost: $', finalState.metrics.totalCost.toFixed(4));
}

// Run example
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}
