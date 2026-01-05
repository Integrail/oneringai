/**
 * Interactive chat example - Have a real conversation with an AI agent
 *
 * Usage:
 *   npm run example:chat
 *
 * Commands:
 *   /exit     - Exit the chat
 *   /clear    - Clear conversation history
 *   /history  - Show conversation history
 *   Ctrl+C    - Exit the chat
 */

import 'dotenv/config';
import * as readline from 'readline';
import { OneRingAI, InputItem, MessageRole, ContentType } from '../src/index.js';

// Configure readline for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '👤 You: ',
});

// Conversation state
let conversationHistory: InputItem[] = [];
let isProcessing = false;

async function main() {
  // Create client
  const client = new OneRingAI({
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
    },
  });

  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment variables');
    console.error('Please create a .env file with your OpenAI API key');
    console.error('Example: OPENAI_API_KEY=sk-your-key-here');
    process.exit(1);
  }

  // Display welcome message
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🤖 Interactive AI Chat Assistant                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Welcome! I\'m an AI assistant powered by GPT-4.');
  console.log('Ask me anything, and I\'ll do my best to help.');
  console.log('');
  console.log('Commands:');
  console.log('  /exit     - Exit the chat');
  console.log('  /clear    - Clear conversation history');
  console.log('  /history  - Show conversation history');
  console.log('  Ctrl+C    - Exit the chat');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Show prompt
  rl.prompt();

  // Handle user input
  rl.on('line', async (input: string) => {
    const userInput = input.trim();

    // Skip empty input
    if (!userInput) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (userInput.startsWith('/')) {
      handleCommand(userInput);
      rl.prompt();
      return;
    }

    // Prevent multiple concurrent requests
    if (isProcessing) {
      console.log('⏳ Please wait for the current response to complete...');
      rl.prompt();
      return;
    }

    isProcessing = true;

    try {
      // Add user message to history
      conversationHistory.push({
        type: 'message',
        role: MessageRole.USER,
        content: [
          {
            type: ContentType.INPUT_TEXT,
            text: userInput,
          },
        ],
      });

      // Show thinking indicator
      process.stdout.write('🤖 Assistant: ');
      const thinkingInterval = startThinkingAnimation();

      // Generate response
      const response = await client.text.generateRaw(conversationHistory, {
        provider: 'openai',
        model: 'gpt-4',
        instructions: 'You are a helpful, friendly, and knowledgeable AI assistant. Be conversational, concise, and engaging. Use a warm tone.',
        temperature: 0.7,
        max_output_tokens: 500,
      });

      // Stop thinking animation
      stopThinkingAnimation(thinkingInterval);

      // Display assistant response
      const assistantText = response.output_text || '';
      console.log(assistantText);
      console.log('');

      // Add assistant response to history (filter to valid InputItem types)
      conversationHistory.push(
        ...response.output.filter(
          (item): item is InputItem =>
            item.type === 'message' || item.type === 'compaction'
        )
      );

      // Show token usage
      const tokens = response.usage;
      console.log(
        `\x1b[90m[Tokens: ${tokens.total_tokens} total (${tokens.input_tokens} in, ${tokens.output_tokens} out) | Messages: ${Math.floor(conversationHistory.length / 2)}]\x1b[0m`
      );
      console.log('');
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      console.log('');

      // Remove the failed user message from history
      conversationHistory.pop();
    } finally {
      isProcessing = false;
      rl.prompt();
    }
  });

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye! Thanks for chatting!');
    process.exit(0);
  });

  // Handle close
  rl.on('close', () => {
    console.log('\n\n👋 Goodbye! Thanks for chatting!');
    process.exit(0);
  });
}

/**
 * Handle special commands
 */
function handleCommand(command: string) {
  const cmd = command.toLowerCase();

  switch (cmd) {
    case '/exit':
    case '/quit':
    case '/q':
      console.log('\n👋 Goodbye! Thanks for chatting!');
      process.exit(0);
      break;

    case '/clear':
      conversationHistory = [];
      console.clear();
      console.log('✅ Conversation history cleared');
      console.log('');
      break;

    case '/history':
      showHistory();
      break;

    case '/help':
      showHelp();
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Type /help for available commands');
      console.log('');
  }
}

/**
 * Show conversation history
 */
function showHistory() {
  if (conversationHistory.length === 0) {
    console.log('📭 No conversation history yet');
    console.log('');
    return;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📜 Conversation History');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const item of conversationHistory) {
    if (item.type === 'message') {
      const role = item.role === MessageRole.USER ? '👤 You' : '🤖 Assistant';
      const textContent = item.content.find(
        (c) => c.type === ContentType.INPUT_TEXT || c.type === ContentType.OUTPUT_TEXT
      );

      if (textContent && 'text' in textContent) {
        console.log(`${role}:`);
        console.log(textContent.text);
        console.log('');
      }
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Show help message
 */
function showHelp() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📖 Available Commands');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('  /exit, /quit, /q  - Exit the chat');
  console.log('  /clear            - Clear conversation history');
  console.log('  /history          - Show conversation history');
  console.log('  /help             - Show this help message');
  console.log('  Ctrl+C            - Exit the chat');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Thinking animation
 */
function startThinkingAnimation(): NodeJS.Timeout {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  return setInterval(() => {
    process.stdout.write(`\r🤖 Assistant: ${frames[i]} `);
    i = (i + 1) % frames.length;
  }, 80);
}

/**
 * Stop thinking animation
 */
function stopThinkingAnimation(interval: NodeJS.Timeout) {
  clearInterval(interval);
  process.stdout.write('\r🤖 Assistant: ');
}

// Run the interactive chat
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
