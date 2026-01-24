/**
 * PlanningAgent Demo - AI-Driven Plan Generation
 *
 * This example shows how to use PlanningAgent to automatically
 * generate task plans from high-level goals.
 */

import 'dotenv/config';
import { Connector, Vendor, PlanningAgent, TaskAgent, ToolFunction } from '../src/index.js';

// Example tools
const webSearchTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  execute: async (args) => {
    console.log(`  🔍 Searching for: ${args.query}`);
    return {
      results: [
        { title: 'Example Result 1', snippet: 'Information about ' + args.query },
        { title: 'Example Result 2', snippet: 'More details on ' + args.query },
      ],
    };
  },
  idempotency: { safe: true },
};

const analysisTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'analyze_data',
      description: 'Analyze data and extract insights',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data to analyze' },
        },
        required: ['data'],
      },
    },
  },
  execute: async (args) => {
    console.log(`  📊 Analyzing: ${args.data.substring(0, 50)}...`);
    return {
      insights: ['Key insight 1', 'Key insight 2', 'Key insight 3'],
      sentiment: 'positive',
    };
  },
  idempotency: { safe: false, ttlMs: 60000 },
};

const reportTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'generate_report',
      description: 'Generate a formatted report',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['title', 'content'],
      },
    },
  },
  execute: async (args) => {
    console.log(`  📝 Generating report: ${args.title}`);
    return {
      report: `# ${args.title}\n\n${args.content}\n\nGenerated: ${new Date().toISOString()}`,
      wordCount: args.content.split(' ').length,
    };
  },
  idempotency: { safe: false, ttlMs: 60000 },
};

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       PlanningAgent Demo - AI-Driven Plan Generation        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Setup connector
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
  // Step 1: Create PlanningAgent
  // ============================================================
  console.log('📋 Step 1: Creating PlanningAgent...\n');

  const planner = PlanningAgent.create({
    connector: 'openai',
    model: 'gpt-3.5-turbo', // Cheaper model for planning
    planningTemperature: 0.3,
    availableTools: [webSearchTool, analysisTool, reportTool],
  });

  console.log('✅ PlanningAgent created with model: gpt-3.5-turbo\n');

  // ============================================================
  // Step 2: Generate Plan from Goal
  // ============================================================
  console.log('🤖 Step 2: Generating plan from goal...\n');

  const goal = 'Create a market research report on electric vehicles';
  const context = 'Focus on market size, major manufacturers, and adoption trends. Keep it concise.';

  console.log(`Goal: ${goal}`);
  console.log(`Context: ${context}\n`);

  const generated = await planner.generatePlan({
    goal,
    context,
    constraints: [
      'Use only recent data',
      'Include at least 3 major manufacturers',
      'Keep report under 500 words',
    ],
  });

  console.log('✅ Plan generated!\n');

  // ============================================================
  // Step 3: Review Generated Plan
  // ============================================================
  console.log('📊 Step 3: Reviewing generated plan...\n');
  console.log('─'.repeat(64));
  console.log(`Goal: ${generated.plan.goal}`);
  console.log(`Tasks: ${generated.plan.tasks.length}`);
  console.log(`Complexity: ${generated.complexity}`);
  console.log('─'.repeat(64));
  console.log('\nTasks:');

  generated.plan.tasks.forEach((task, i) => {
    console.log(`\n${i + 1}. ${task.name}`);
    console.log(`   Description: ${task.description}`);
    if (task.dependsOn && task.dependsOn.length > 0) {
      console.log(`   Dependencies: ${task.dependsOn.join(', ')}`);
    }
    if (task.execution?.parallel) {
      console.log(`   ⚡ Can run in parallel`);
    }
  });

  console.log('\n─'.repeat(64));
  console.log('\nAI Reasoning:');
  console.log(generated.reasoning);
  console.log('─'.repeat(64));

  // ============================================================
  // Step 4: (Optional) Refine Plan
  // ============================================================
  console.log('\n🔧 Step 4: Refining plan with feedback...\n');

  const refined = await planner.refinePlan(
    generated.plan,
    'Add a task to include pricing trends in the analysis'
  );

  console.log('✅ Plan refined!\n');
  console.log(`Tasks increased: ${generated.plan.tasks.length} → ${refined.plan.tasks.length}`);

  // ============================================================
  // Step 5: Execute Plan with TaskAgent
  // ============================================================
  console.log('\n⚙️  Step 5: Executing plan with TaskAgent...\n');

  const executor = TaskAgent.create({
    connector: 'openai',
    model: 'gpt-4', // More powerful model for execution
    tools: [webSearchTool, analysisTool, reportTool],
    maxIterations: 50,
  });

  console.log('Starting execution...\n');

  // Listen for task events
  executor.on('task:start', ({ task }) => {
    console.log(`\n▶️  Starting task: ${task.name}`);
    console.log(`   ${task.description}`);
  });

  executor.on('task:complete', ({ task }) => {
    console.log(`✅ Completed: ${task.name}`);
  });

  executor.on('task:failed', ({ task, error }) => {
    console.log(`❌ Failed: ${task.name}`);
    console.log(`   Error: ${error.message}`);
  });

  const handle = await executor.start(refined.plan);
  const result = await handle.wait();

  // ============================================================
  // Step 6: Display Results
  // ============================================================
  console.log('\n' + '═'.repeat(64));
  console.log('                       EXECUTION COMPLETE');
  console.log('═'.repeat(64));
  console.log(`\nStatus: ${result.status}`);
  console.log(`Completed Tasks: ${result.metrics.completedTasks}/${result.metrics.totalTasks}`);
  console.log(`Failed Tasks: ${result.metrics.failedTasks}`);
  console.log(`Skipped Tasks: ${result.metrics.skippedTasks}`);

  // Cleanup
  await executor.destroy();

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n' + '═'.repeat(64));
  console.log('                      KEY TAKEAWAYS');
  console.log('═'.repeat(64));
  console.log('\n✨ What We Did:');
  console.log('   1. Used PlanningAgent to generate plan from goal (AI-driven)');
  console.log('   2. Reviewed generated plan (tasks, dependencies, complexity)');
  console.log('   3. Refined plan based on feedback (iterative improvement)');
  console.log('   4. Executed plan with TaskAgent (using powerful model)');
  console.log('\n💡 Benefits:');
  console.log('   • No manual task breakdown required');
  console.log('   • AI identifies optimal dependencies');
  console.log('   • Can use cheaper model for planning');
  console.log('   • Iterative refinement before execution');
  console.log('   • Separate concerns (planning vs execution)');
  console.log('\n📊 Cost Optimization:');
  console.log('   • Planning: gpt-3.5-turbo (~$0.0005 per plan)');
  console.log('   • Execution: gpt-4 (varies by complexity)');
  console.log('   • Savings: ~80% on planning phase');
  console.log('\n');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
