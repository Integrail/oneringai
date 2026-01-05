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
 *   /paste    - Paste image from clipboard (URL or file path)
 *   /images   - Show attached images
 *   Ctrl+V    - Paste image directly from clipboard
 *   Ctrl+C    - Exit the chat
 *
 * Image Support:
 *   - Press Ctrl+V (or Cmd+V on Mac) to paste image from clipboard
 *   - Type [img:URL] inline to attach image URL
 *   - Images are sent with your next message
 */

import 'dotenv/config';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import clipboardy from 'clipboardy';
import {
  OneRingAI,
  InputItem,
  MessageRole,
  ContentType,
  MessageBuilder,
} from '../src/index.js';
import { readClipboardImage, hasClipboardImage } from '../src/utils/clipboardImage.js';

// Configure readline for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '👤 You: ',
});

// Conversation state
let conversationHistory: InputItem[] = [];
let isProcessing = false;
let pendingImages: string[] = []; // URLs or data URIs of images to send
let currentLine = ''; // Track current input line

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
  console.log('║      🤖 Interactive AI Chat Assistant with Vision         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Welcome! I\'m an AI assistant powered by GPT-4o (with vision).');
  console.log('Ask me anything, and I can even analyze images!');
  console.log('');
  console.log('Commands:');
  console.log('  /exit     - Exit the chat');
  console.log('  /clear    - Clear conversation history');
  console.log('  /history  - Show conversation history');
  console.log('  /paste    - Paste image URL from clipboard');
  console.log('  /images   - Show attached images');
  console.log('  Ctrl+V    - Paste image directly from clipboard');
  console.log('  Ctrl+C    - Exit the chat');
  console.log('');
  console.log('Image Support:');
  console.log('  • Press Ctrl+V (Cmd+V on Mac) to paste screenshots!');
  console.log('  • Take a screenshot (Cmd+Ctrl+Shift+4) and paste it');
  console.log('  • Type [img:URL] inline to attach an image');
  console.log('  • Images are sent with your next message');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Enable raw mode for keypress detection
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Handle keypress events for Ctrl+V detection
  process.stdin.on('keypress', async (chunk, key) => {
    if (!key) return;

    // Detect Ctrl+V (or Cmd+V)
    if (key.ctrl && key.name === 'v' && !isProcessing) {
      // Prevent default paste behavior
      await handleClipboardPaste();
      return;
    }

    // Let readline handle other keys
  });

  // Show prompt
  rl.prompt();

  // Handle user input
  rl.on('line', async (input: string) => {
    let userInput = input.trim();

    // Skip empty input
    if (!userInput) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (userInput.startsWith('/')) {
      await handleCommand(userInput);
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
      // Check for inline image URLs [img:URL]
      const imageMatches = Array.from(userInput.matchAll(/\[img:([^\]]+)\]/g));
      for (const match of imageMatches) {
        const imageUrl = match[1]?.trim();
        if (imageUrl) {
          await addImage(imageUrl);
          // Remove the [img:URL] from the text
          userInput = userInput.replace(match[0], '').trim();
        }
      }

      // Build the message with text and images
      const builder = new MessageBuilder();

      if (pendingImages.length > 0) {
        // Add message with images
        builder.addUserMessageWithImages(userInput, pendingImages);
        console.log(`\n📸 Sending message with ${pendingImages.length} image(s)...\n`);
      } else {
        // Add simple text message
        builder.addUserMessage(userInput);
      }

      // Add conversation history
      const messages = [...conversationHistory, ...builder.build()];

      // Show thinking indicator
      process.stdout.write('🤖 Assistant: ');
      const thinkingInterval = startThinkingAnimation();

      // Generate response with vision-capable model
      const response = await client.text.generateRaw(messages, {
        provider: 'openai',
        model: 'gpt-4o', // Vision-capable model
        instructions:
          'You are a helpful, friendly, and knowledgeable AI assistant with vision capabilities. Be conversational, concise, and engaging. Use a warm tone. When analyzing images, be detailed and helpful.',
        temperature: 0.7,
        max_output_tokens: 500,
      });

      // Stop thinking animation
      stopThinkingAnimation(thinkingInterval);

      // Display assistant response
      const assistantText = response.output_text || '';
      console.log(assistantText);
      console.log('');

      // Update conversation history
      conversationHistory.push(...builder.build());
      conversationHistory.push(
        ...response.output.filter(
          (item): item is InputItem =>
            item.type === 'message' || item.type === 'compaction'
        )
      );

      // Clear pending images after sending
      pendingImages = [];

      // Show token usage
      const tokens = response.usage;
      console.log(
        `\x1b[90m[Tokens: ${tokens.total_tokens} total (${tokens.input_tokens} in, ${tokens.output_tokens} out) | Messages: ${Math.floor(conversationHistory.length / 2)}]\x1b[0m`
      );
      console.log('');
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      console.log('');
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
 * Handle Ctrl+V / Cmd+V clipboard paste for images
 */
async function handleClipboardPaste() {
  // Show loading indicator
  process.stdout.write('\r📋 Reading clipboard...');

  const result = await readClipboardImage();

  if (result.success && result.dataUri) {
    pendingImages.push(result.dataUri);

    // Calculate size in KB
    const sizeKB = Math.round((result.dataUri.length * 3) / 4 / 1024);

    // Clear the loading message and show success
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(`📎 [image #${pendingImages.length}] Pasted from clipboard (${sizeKB}KB ${result.format || 'PNG'})`);
    console.log('💡 Image will be sent with your next message');
    console.log('');
  } else {
    // Clear the loading message and show error
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log('❌ Could not read image from clipboard');

    if (result.error?.includes('pngpaste') || result.error?.includes('osascript')) {
      console.log('');
      console.log('💡 To enable clipboard image paste on Mac:');
      console.log('   1. Install pngpaste: brew install pngpaste');
      console.log('   2. Or copy image URLs instead and use /paste');
    } else if (result.error) {
      console.log(`   ${result.error}`);
    }

    console.log('');
    console.log('📝 Alternative: Use /paste to paste image URLs');
    console.log('');
  }

  rl.prompt();
}

/**
 * Add an image to pending images
 */
async function addImage(urlOrPath: string): Promise<void> {
  try {
    // Check if it's a URL
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      pendingImages.push(urlOrPath);
      console.log(
        `📎 [image #${pendingImages.length}] ${urlOrPath.substring(0, 60)}${urlOrPath.length > 60 ? '...' : ''}`
      );
      return;
    }

    // Check if it's a data URI
    if (urlOrPath.startsWith('data:image/')) {
      pendingImages.push(urlOrPath);
      const sizeKB = Math.round((urlOrPath.length * 3) / 4 / 1024);
      console.log(`📎 [image #${pendingImages.length}] (base64 data, ${sizeKB}KB)`);
      return;
    }

    // Try as file path
    const resolvedPath = path.resolve(urlOrPath);
    if (fs.existsSync(resolvedPath)) {
      const ext = path.extname(resolvedPath).toLowerCase();
      const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

      if (!supportedExts.includes(ext)) {
        console.log(`❌ Unsupported file type: ${ext}`);
        console.log(`   Supported: ${supportedExts.join(', ')}`);
        return;
      }

      // Convert to base64 data URI
      const imageBuffer = fs.readFileSync(resolvedPath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`;
      const dataUri = `data:${mimeType};base64,${base64Image}`;

      pendingImages.push(dataUri);
      const sizeKB = Math.round(imageBuffer.length / 1024);
      console.log(`📎 [image #${pendingImages.length}] ${path.basename(resolvedPath)} (${sizeKB}KB)`);
      return;
    }

    // Not a valid URL or file path
    console.log(`❌ Invalid image: Not a URL or existing file path`);
    console.log(`   Tried: ${urlOrPath}`);
  } catch (error: any) {
    console.log(`❌ Error adding image: ${error.message}`);
  }
}

/**
 * Handle special commands
 */
async function handleCommand(command: string) {
  const cmd = command.toLowerCase().split(' ')[0];
  const args = command.substring(cmd.length).trim();

  switch (cmd) {
    case '/exit':
    case '/quit':
    case '/q':
      console.log('\n👋 Goodbye! Thanks for chatting!');
      process.exit(0);
      break;

    case '/clear':
      conversationHistory = [];
      pendingImages = [];
      console.clear();
      console.log('✅ Conversation history and pending images cleared');
      console.log('');
      break;

    case '/history':
      showHistory();
      break;

    case '/paste':
      await handleTextPaste();
      break;

    case '/images':
      showImages();
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
 * Handle /paste command - read text from clipboard (URLs/paths)
 */
async function handleTextPaste() {
  try {
    console.log('📋 Reading text from clipboard...');
    const clipboardContent = await clipboardy.read();

    if (!clipboardContent || clipboardContent.trim().length === 0) {
      console.log('❌ Clipboard is empty');
      console.log('');
      return;
    }

    // Check if it's an image URL or path
    const trimmed = clipboardContent.trim();
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:image/') ||
      fs.existsSync(trimmed)
    ) {
      await addImage(trimmed);
    } else {
      console.log('❌ Clipboard does not contain an image URL or file path');
      console.log(`   Found: ${trimmed.substring(0, 100)}${trimmed.length > 100 ? '...' : ''}`);
      console.log('');
      console.log('💡 Tips:');
      console.log('   • For image URLs: Copy URL, then /paste');
      console.log('   • For screenshots: Press Ctrl+V to paste image data directly');
    }

    console.log('');
  } catch (error: any) {
    console.log(`❌ Error reading clipboard: ${error.message}`);
    console.log('');
  }
}

/**
 * Show pending images
 */
function showImages() {
  if (pendingImages.length === 0) {
    console.log('📭 No pending images');
    console.log('');
    console.log('💡 Add images with:');
    console.log('   • Ctrl+V - Paste screenshot/image data');
    console.log('   • /paste - Paste URL from clipboard');
    console.log('   • [img:URL] - Inline in your message');
    console.log('');
    return;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📸 Pending Images (will be sent with next message)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 0; i < pendingImages.length; i++) {
    const img = pendingImages[i];
    if (img.startsWith('data:')) {
      const sizeKB = Math.round((img.length * 3) / 4 / 1024);
      console.log(`${i + 1}. [clipboard image] (${sizeKB}KB)`);
    } else if (img.startsWith('http')) {
      console.log(`${i + 1}. ${img.substring(0, 80)}${img.length > 80 ? '...' : ''}`);
    } else {
      console.log(`${i + 1}. ${img}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
        (c) =>
          c.type === ContentType.INPUT_TEXT || c.type === ContentType.OUTPUT_TEXT
      );
      const imageContent = item.content.filter(
        (c) => c.type === ContentType.INPUT_IMAGE_URL
      );

      console.log(`${role}:`);

      if (textContent && 'text' in textContent) {
        console.log(textContent.text);
      }

      if (imageContent.length > 0) {
        console.log(`📸 [${imageContent.length} image(s)]`);
      }

      console.log('');
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
  console.log('  /clear            - Clear conversation history and pending images');
  console.log('  /history          - Show conversation history');
  console.log('  /paste            - Paste image URL from clipboard');
  console.log('  /images           - Show pending images');
  console.log('  /help             - Show this help message');
  console.log('  Ctrl+V            - Paste image directly from clipboard');
  console.log('  Ctrl+C            - Exit the chat');
  console.log('');
  console.log('📸 Image Support:');
  console.log('  • Press Ctrl+V (Cmd+V on Mac) to paste screenshots!');
  console.log('  • Take screenshot: Cmd+Ctrl+Shift+4 (saves to clipboard)');
  console.log('  • Type [img:URL] inline: "What is this? [img:URL]"');
  console.log('  • Supports: Screenshots, URLs, file paths, base64');
  console.log('  • Images are sent with your next message');
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

// Enable keypress events
readline.emitKeypressEvents(process.stdin);

// Run the interactive chat
main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
