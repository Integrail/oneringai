/**
 * Agent with Hooks Example
 *
 * Demonstrates the hook system for controlling agent execution:
 * - Real-time event logging
 * - Tool approval (human-in-the-loop)
 * - Tool result caching
 * - Metrics collection
 * - Pause/resume control
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, tools } from '../src/index.js';

// Simple in-memory cache
const cache = new Map<string, any>();

// Simple approval function (simulated)
async function askForApproval(toolName: string, args: any): Promise<boolean> {
  console.log(`\n⚠️  Tool approval required:`);
  console.log(`   Tool: ${toolName}`);
  console.log(`   Args: ${JSON.stringify(args, null, 2)}`);
  console.log(`   Auto-approving for demo...\n`);

  // In real app, this would show UI and wait for user input
  return true;
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Add it to .env before running this example.');
  }

  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey },
  });

  console.log('🔧 Agent with Hooks Demo\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Create agent with hooks
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4.1-mini',
    tools: [tools.jsonManipulator],
    instructions: 'You are a JSON manipulation assistant.',

    // Configure hooks
    hooks: {
      // Tool approval hook (human-in-the-loop)
      'approve:tool': async ({ toolCall }) => {
        const args = JSON.parse(toolCall.function.arguments);
        const approved = await askForApproval(toolCall.function.name, args);

        return {
          approved,
          reason: approved ? 'Approved by user' : 'Rejected by user',
        };
      },

      // Before tool - check cache
      'before:tool': async ({ toolCall }) => {
        const cacheKey = `${toolCall.function.name}:${toolCall.function.arguments}`;

        if (cache.has(cacheKey)) {
          console.log(`💾 Cache hit for ${toolCall.function.name}\n`);
          return {
            skip: true,
            mockResult: cache.get(cacheKey),
            reason: 'Cached result',
          };
        }

        return {};
      },

      // After tool - save to cache
      'after:tool': async ({ toolCall, result }) => {
        if (result.state === 'completed') {
          const cacheKey = `${toolCall.function.name}:${toolCall.function.arguments}`;
          cache.set(cacheKey, result.content);
          console.log(`💾 Cached result for ${toolCall.function.name}\n`);
        }

        return {};
      },
    },

    // Resource limits
    limits: {
      maxExecutionTime: 60000, // 1 minute
      maxToolCalls: 20,
      maxContextSize: 5242880, // 5MB
    },

    // Error handling
    errorHandling: {
      hookFailureMode: 'warn', // Continue on hook errors
      toolFailureMode: 'fail', // Stop on tool errors
      maxConsecutiveErrors: 3,
    },

    // History mode
    historyMode: 'summary', // Memory efficient
  });

  // Listen to events
  agent.on('execution:start', ({ executionId }) => {
    console.log(`▶️  Execution started: ${executionId}\n`);
  });

  agent.on('iteration:start', ({ iteration }) => {
    console.log(`🔄 Iteration ${iteration} started`);
  });

  agent.on('llm:request', ({ options }) => {
    console.log(`🤖 LLM request to ${options.model}`);
  });

  agent.on('llm:response', ({ duration }) => {
    console.log(`✅ LLM response received (${duration}ms)\n`);
  });

  agent.on('tool:start', ({ toolCall }) => {
    console.log(`🔧 Tool starting: ${toolCall.function.name}`);
  });

  agent.on('tool:complete', ({ toolCall, result }) => {
    console.log(`✅ Tool completed: ${toolCall.function.name} (${result.executionTime}ms)`);
  });

  agent.on('execution:complete', ({ duration }) => {
    console.log(`\n⏱️  Total execution time: ${duration}ms`);
  });

  // Run the agent
  const testObject = {
    user: {
      name: 'John Doe',
      email: 'john@example.com',
      settings: {
        theme: 'light',
        notifications: true,
      },
    },
  };

  console.log('Original object:');
  console.log(JSON.stringify(testObject, null, 2));
  console.log('\n');

  const response = await agent.run(`
Transform this JSON object:
${JSON.stringify(testObject)}

1. Delete the email field
2. Change the theme to "dark"
3. Add a new field user.phone with value "+1234567890"
`);

  console.log('\n🤖 Agent Response:');
  console.log(response.output_text);
  console.log('\n');

  // Get metrics
  const metrics = agent.getMetrics();
  if (metrics) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Execution Metrics');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`  Total Duration: ${metrics.totalDuration}ms`);
    console.log(`  LLM Duration: ${metrics.llmDuration}ms`);
    console.log(`  Tool Duration: ${metrics.toolDuration}ms`);
    console.log(`  Hook Duration: ${metrics.hookDuration}ms`);
    console.log(`  Iterations: ${metrics.iterationCount}`);
    console.log(`  Tool Calls: ${metrics.toolCallCount}`);
    console.log(`  Tool Success: ${metrics.toolSuccessCount}`);
    console.log(`  Tool Failures: ${metrics.toolFailureCount}`);
    console.log(`  Total Tokens: ${metrics.totalTokens}`);
    console.log(`  Errors: ${metrics.errors.length}`);
    console.log('');
  }

  // Get audit trail
  const audit = agent.getAuditTrail();
  if (audit.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Audit Trail (last 5 entries)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    audit.slice(-5).forEach((entry) => {
      console.log(`  ${entry.type} at ${entry.timestamp.toISOString()}`);
      if (entry.toolName) console.log(`    Tool: ${entry.toolName}`);
    });
    console.log('');
  }

  // Get summary
  const summary = agent.getSummary();
  if (summary) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 Execution Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`  Execution ID: ${summary.executionId}`);
    console.log(`  Current Iteration: ${summary.currentIteration}`);
    console.log(`  Paused: ${summary.paused}`);
    console.log(`  Cancelled: ${summary.cancelled}`);
    console.log(`  Total Duration: ${summary.totalDuration}ms`);
    console.log('');
  }

  // Cleanup
  agent.destroy();
  console.log('✅ Agent destroyed and resources cleaned up\n');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
