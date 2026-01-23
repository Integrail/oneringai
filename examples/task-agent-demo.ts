/**
 * TaskAgent Demo - Shows full functionality
 *
 * This demo shows TaskAgent executing a plan with:
 * - Sequential and parallel tasks
 * - Working memory usage
 * - Conditional execution
 * - Tool idempotency
 * - Context management
 */

import {
  Connector,
  Vendor,
  TaskAgent,
  ToolFunction,
} from '../dist/index.js';

// Setup connector
Connector.create({
  name: 'demo',
  vendor: Vendor.OpenAI,
  auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY || 'demo-key' },
});

// Define tools
const fetchUserTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'fetch_user',
      description: 'Fetch user profile from database',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
        required: ['userId'],
      },
    },
  },
  execute: async (args) => {
    console.log(`[Tool] Fetching user: ${args.userId}`);
    return {
      id: args.userId,
      name: 'John Doe',
      email: 'john@example.com',
      isPremium: true,
      preferences: { notifications: true, theme: 'dark' },
    };
  },
  idempotency: { safe: true },
  output: { expectedSize: 'medium' },
};

const sendEmailTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email to a user',
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
    console.log(`  Subject: ${args.subject}`);
    return { success: true, messageId: `msg-${Date.now()}` };
  },
  idempotency: {
    safe: false,
    keyFn: (args) => `${args.to}:${args.subject}`,
    ttlMs: 300000, // 5 minutes
  },
};

const analyzeDataTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'analyze_data',
      description: 'Analyze user data and generate insights',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'object', description: 'Data to analyze' },
        },
        required: ['data'],
      },
    },
  },
  execute: async (args) => {
    console.log(`[Tool] Analyzing data...`);
    return {
      insights: ['User is highly engaged', 'Premium features used frequently'],
      recommendation: 'Offer annual subscription discount',
    };
  },
  idempotency: { safe: true },
};

async function main() {
  console.log('=== TaskAgent Full Demo ===\n');

  // Create TaskAgent with all features
  const agent = TaskAgent.create({
    connector: 'demo',
    model: 'gpt-4',
    tools: [fetchUserTool, sendEmailTool, analyzeDataTool],
    instructions: `You are an autonomous agent that executes tasks systematically.
Use working memory to store and retrieve information between tasks.
Always confirm when a task is complete.`,

    // Hooks for monitoring
    hooks: {
      onStart: async (_agent, plan) => {
        console.log(`\n[Hook] Starting plan: ${plan.goal}`);
        console.log(`[Hook] Total tasks: ${plan.tasks.length}\n`);
      },
      beforeTask: async (task) => {
        console.log(`\n[Hook] → Starting task: ${task.name}`);
        console.log(`[Hook]   Description: ${task.description}`);
      },
      afterTask: async (task, result) => {
        console.log(`[Hook] ✓ Completed task: ${task.name}`);
        if (result.output) {
          console.log(`[Hook]   Output: ${JSON.stringify(result.output).substring(0, 100)}...`);
        }
      },
      onComplete: async (result) => {
        console.log(`\n[Hook] === Plan Completed ===`);
        console.log(`[Hook] Status: ${result.status}`);
        console.log(`[Hook] Tasks completed: ${result.metrics.completedTasks}/${result.metrics.totalTasks}`);
      },
    },

    memoryConfig: {
      maxSizeBytes: 512 * 1024, // 512KB
      descriptionMaxLength: 150,
      softLimitPercent: 80,
      contextAllocationPercent: 20,
    },

    maxIterations: 50,
  });

  // Execute a complex plan
  const handle = await agent.start({
    goal: 'Analyze user engagement and send personalized email',
    context: 'Target user: user-123. Send premium upsell if appropriate.',

    tasks: [
      {
        name: 'fetch_user_data',
        description: 'Fetch user profile data for user-123. Store the profile in memory as "user.profile".',
        expectedOutput: 'User profile with id, name, email, and premium status',
      },
      {
        name: 'analyze_engagement',
        description: 'Analyze the user data and generate engagement insights. Store insights in memory as "analysis.insights".',
        dependsOn: ['fetch_user_data'],
        expectedOutput: 'Engagement insights and recommendations',
      },
      {
        name: 'send_email_premium',
        description: 'Send personalized email with premium upsell based on analysis',
        dependsOn: ['analyze_engagement'],
        condition: {
          memoryKey: 'user.profile',
          operator: 'contains',
          value: 'isPremium',
          onFalse: 'skip',
        },
      },
      {
        name: 'send_email_standard',
        description: 'Send standard engagement email',
        dependsOn: ['analyze_engagement'],
        condition: {
          memoryKey: 'user.profile',
          operator: 'not_exists',
          value: undefined,
          onFalse: 'skip',
        },
      },
    ],

    // Enable parallel execution where possible
    concurrency: {
      maxParallelTasks: 2,
      strategy: 'fifo',
    },

    allowDynamicTasks: true,
  });

  console.log(`\n[Agent] ID: ${handle.agentId}`);
  console.log(`[Agent] Plan ID: ${handle.planId}\n`);

  // Wait for completion
  const result = await handle.wait();

  console.log('\n=== Final Results ===');
  console.log(`Status: ${result.status}`);
  console.log(`Completed: ${result.metrics.completedTasks}/${result.metrics.totalTasks}`);
  console.log(`Failed: ${result.metrics.failedTasks}`);
  console.log(`Skipped: ${result.metrics.skippedTasks}`);

  // Inspect working memory
  const memory = agent.getMemory();
  const memoryIndex = await memory.getIndex();

  console.log('\n=== Working Memory ===');
  console.log(await memory.formatIndex());

  // Get agent state
  const state = agent.getState();
  console.log('\n=== Agent Metrics ===');
  console.log(`LLM Calls: ${state.metrics.totalLLMCalls}`);
  console.log(`Tool Calls: ${state.metrics.totalToolCalls}`);
  console.log(`Tokens Used: ${state.metrics.totalTokensUsed}`);
  console.log(`Total Cost: $${state.metrics.totalCost.toFixed(4)}`);

  // Cleanup
  agent.destroy();
}

// Run if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
}
