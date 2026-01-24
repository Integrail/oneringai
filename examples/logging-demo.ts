/**
 * Logging Configuration Demo
 *
 * This example demonstrates how to configure logging using environment variables:
 * - LOG_LEVEL: trace|debug|info|warn|error|silent (default: info)
 * - LOG_FILE: Path to log file (optional - logs to console by default)
 * - LOG_PRETTY: true|false (default: true in development)
 *
 * Usage:
 * # Console logging with info level (default)
 * npm run example:logging
 *
 * # Console logging with debug level
 * LOG_LEVEL=debug npm run example:logging
 *
 * # File logging
 * LOG_FILE=./logs/test.log npm run example:logging
 *
 * # JSON format (not pretty)
 * LOG_PRETTY=false npm run example:logging
 *
 * # Trace level to file
 * LOG_LEVEL=trace LOG_FILE=./logs/trace.log npm run example:logging
 */

import 'dotenv/config';
import { Connector, Agent, Vendor, ToolFunction, logger } from '../src/index.js';

// Simple calculation tool
const calculatorTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression' },
        },
        required: ['expression'],
      },
    },
  },
  execute: async (args: { expression: string }) => {
    logger.info({ tool: 'calculate', expression: args.expression }, 'Calculating expression');
    const result = eval(args.expression);
    logger.debug({ result }, 'Calculation complete');
    return { expression: args.expression, result };
  },
};

async function main() {
  console.log('=== Logging Configuration Demo ===\n');
  console.log(`LOG_LEVEL: ${process.env.LOG_LEVEL || 'info'}`);
  console.log(`LOG_FILE: ${process.env.LOG_FILE || 'console'}`);
  console.log(`LOG_PRETTY: ${process.env.LOG_PRETTY || 'auto'}`);
  console.log('\n');

  // Create connector
  Connector.create({
    name: 'openai',
    vendor: Vendor.OpenAI,
    auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY || '' },
  });

  // Create agent
  const agent = Agent.create({
    connector: 'openai',
    model: 'gpt-4',
    tools: [calculatorTool],
    instructions: 'You are a helpful math assistant.',
  });

  // Log at different levels
  logger.trace('This is a trace message (very detailed)');
  logger.debug('This is a debug message (detailed)');
  logger.info('This is an info message (normal)');
  logger.warn('This is a warning message');
  logger.error('This is an error message');

  console.log('\n--- Running Agent ---\n');

  // Run agent (this will generate more logs)
  const response = await agent.run('Calculate 42 * 99 and explain the result');

  console.log('\n--- Agent Response ---');
  console.log(response.output_text);

  console.log('\n--- Log Levels Explained ---');
  console.log('trace: Extremely detailed information (use for debugging)');
  console.log('debug: Detailed information (development)');
  console.log('info:  General information (default)');
  console.log('warn:  Warning messages');
  console.log('error: Error messages');
  console.log('silent: No logging');

  if (process.env.LOG_FILE) {
    console.log(`\n✅ Logs written to: ${process.env.LOG_FILE}`);
  }
}

// Run example
main().catch(console.error);
