/**
 * Interactive chat example - Multi-provider support with vision
 *
 * Usage:
 *   npm run example:chat
 *
 * Features:
 *   • Auto-detects available providers from .env
 *   • Lets you choose which AI provider to chat with
 *   • Supports vision and clipboard paste (Ctrl+V)
 *   • Switch providers mid-conversation with /switch
 *
 * Commands:
 *   /exit     - Exit the chat
 *   /clear    - Clear conversation history
 *   /history  - Show conversation history
 *   /switch   - Change AI provider
 *   /provider - Show current provider info
 *   /images   - Show attached images
 *   Ctrl+V    - Paste image from clipboard
 *   Ctrl+C    - Exit the chat
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
  oauthRegistry,
  authenticatedFetch,
  ToolFunction,
  tools,
} from '../src/index.js';
import { readClipboardImage } from '../src/utils/clipboardImage.js';

// Provider information interface
interface ProviderInfo {
  name: string;
  displayName: string;
  model: string;
  apiKey: string;
  description: string;
  hasVision: boolean;
  baseURL?: string;
}

// Configure readline for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '👤 You: ',
});

// Global state
let conversationHistory: InputItem[] = [];
let isProcessing = false;
let pendingImages: string[] = [];
let selectedProvider: ProviderInfo;
let availableProviders: ProviderInfo[];
let client: OneRingAI;

/**
 * Detect available providers from environment variables
 */
function detectAvailableProviders(): ProviderInfo[] {
  const providers: ProviderInfo[] = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      displayName: 'OpenAI',
      model: 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
      description: 'Best for vision and general use',
      hasVision: true,
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      name: 'anthropic',
      displayName: 'Anthropic (Claude)',
      model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5 (latest)
      apiKey: process.env.ANTHROPIC_API_KEY,
      description: 'Best for coding and analysis',
      hasVision: true,
    });
  }

  if (process.env.GOOGLE_API_KEY) {
    providers.push({
      name: 'google',
      displayName: 'Google (Gemini)',
      model: 'gemini-3-flash-preview', // Gemini 3 Flash (latest!)
      apiKey: process.env.GOOGLE_API_KEY,
      description: 'Latest Gemini 3, Pro-level at Flash speed',
      hasVision: true,
    });
  }

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'groq',
      displayName: 'Groq',
      model: 'llama-3.1-70b-versatile',
      apiKey: process.env.GROQ_API_KEY,
      description: 'Fastest inference (100-300ms)',
      hasVision: false,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  if (process.env.TOGETHER_API_KEY) {
    providers.push({
      name: 'together-ai',
      displayName: 'Together AI',
      model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      apiKey: process.env.TOGETHER_API_KEY,
      description: 'Cost-effective Llama models',
      hasVision: false,
      baseURL: 'https://api.together.xyz/v1',
    });
  }

  if (process.env.GROK_API_KEY) {
    providers.push({
      name: 'grok',
      displayName: 'Grok (xAI)',
      model: 'grok-2-vision',
      apiKey: process.env.GROK_API_KEY,
      description: 'Latest from xAI',
      hasVision: true,
      baseURL: 'https://api.x.ai/v1',
    });
  }

  // Check Vertex AI (requires GCP project)
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION) {
    providers.push({
      name: 'vertex-ai',
      displayName: 'Google Vertex AI',
      model: 'gemini-3-flash-preview',
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION,
      description: 'Enterprise Gemini with SLA & advanced features',
      hasVision: true,
    } as any);
  }

  return providers;
}

/**
 * Let user select a provider
 */
async function selectProvider(providers: ProviderInfo[]): Promise<ProviderInfo> {
  // If only one provider, auto-select
  if (providers.length === 1) {
    const selected = providers[0];
    console.log(`\n✅ Auto-selected: ${selected.displayName} (only provider configured)\n`);
    return selected;
  }

  // Show provider menu
  console.log('\n🤖 Available AI Providers:\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    const visionBadge = p.hasVision ? ' 🖼️' : '';
    console.log(`${i + 1}. ${p.displayName}${visionBadge}`);
    console.log(`   Model: ${p.model}`);
    console.log(`   ${p.description}`);
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Prompt for selection
  return new Promise((resolve) => {
    const askSelection = () => {
      rl.question(`Select a provider (1-${providers.length}): `, (answer) => {
        const selection = parseInt(answer.trim());

        if (selection >= 1 && selection <= providers.length) {
          const selected = providers[selection - 1];
          console.log(`\n✅ Selected: ${selected!.displayName} (${selected!.model})\n`);
          resolve(selected!);
        } else {
          console.log('❌ Invalid selection. Please try again.\n');
          askSelection();
        }
      });
    };

    askSelection();
  });
}

async function main() {
  // Detect available providers
  availableProviders = detectAvailableProviders();

  // Check if any providers are available
  if (availableProviders.length === 0) {
    console.error('❌ No API keys found!\n');
    console.error('Please add at least one API key to your .env file:');
    console.error('  OPENAI_API_KEY=sk-...');
    console.error('  ANTHROPIC_API_KEY=sk-ant-...');
    console.error('  GOOGLE_API_KEY=...');
    console.error('  GROQ_API_KEY=gsk_...');
    console.error('  TOGETHER_API_KEY=...');
    console.error('  GROK_API_KEY=...\n');
    console.error('See .env.example for all options.');
    process.exit(1);
  }

  // Build provider config
  const providerConfig: any = {};
  for (const p of availableProviders) {
    if (p.name === 'vertex-ai') {
      // Vertex AI uses different config
      providerConfig[p.name] = {
        projectId: (p as any).projectId,
        location: (p as any).location,
      };
    } else {
      providerConfig[p.name] = {
        apiKey: p.apiKey,
        ...(p.baseURL && { baseURL: p.baseURL }),
      };
    }
  }

  // Create client with all available providers
  client = new OneRingAI({
    providers: providerConfig,
  });

  // Let user select provider
  selectedProvider = await selectProvider(availableProviders);

  // ========== Register Microsoft Graph OAuth (if configured) ==========
  if (
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_TENANT_ID
  ) {
    oauthRegistry.register('microsoft', {
      displayName: 'Microsoft Graph API',
      description: 'Access Microsoft 365: users, mail, calendar, files, teams',
      baseURL: 'https://graph.microsoft.com',
      oauth: {
        flow: 'client_credentials',
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tokenUrl: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
        scope: 'https://graph.microsoft.com/.default',
      },
    });
  }

  // ========== Create Microsoft Graph tool (if registered) ==========
  const microsoftTool: ToolFunction | null = oauthRegistry.has('microsoft')
    ? {
        definition: {
          type: 'function',
          function: {
            name: 'microsoft_graph',
            description: `Access Microsoft Graph API to read organization data.

WHEN TO USE:
- Simple, single Microsoft Graph API calls
- User asks about Microsoft data directly (not code execution)

WHEN NOT TO USE:
- User explicitly says "run code" or "execute code" → Use execute_javascript instead!
- Need to process/transform data → Use execute_javascript instead!
- Need to call multiple APIs → Use execute_javascript instead!

Can access:
- Users (/v1.0/users) - List all users
- Mail (/v1.0/users/{id}/messages) - Read mailboxes
- Calendar (/v1.0/users/{id}/calendar/events) - Calendar events
- Files (/v1.0/drives/{id}/root/children) - OneDrive files
- Teams (/v1.0/teams) - Teams and channels

IMPORTANT: Use application permissions (no specific user context).
Example endpoints:
- "/v1.0/users" - List all users
- "/v1.0/users?$top=5" - List 5 users
- "/v1.0/users?$filter=startswith(displayName,'A')" - Filter users`,

            parameters: {
              type: 'object',
              properties: {
                endpoint: {
                  type: 'string',
                  description:
                    'Microsoft Graph endpoint path starting with /v1.0/ (e.g., "/v1.0/users", "/v1.0/users/{user-id}/messages")',
                },
                method: {
                  type: 'string',
                  enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                  description: 'HTTP method (default: GET)',
                },
              },
              required: ['endpoint'],
            },
          },
        },
        execute: async (args: { endpoint: string; method?: string }) => {
          try {
            const url = args.endpoint.startsWith('http')
              ? args.endpoint
              : `https://graph.microsoft.com${args.endpoint}`;

            const response = await authenticatedFetch(url, { method: args.method || 'GET' }, 'microsoft');

            if (!response.ok) {
              return {
                error: `Microsoft Graph API error: ${response.status} ${response.statusText}`,
                status: response.status,
              };
            }

            const data: any = await response.json();
            return data;
          } catch (error) {
            return { error: (error as Error).message };
          }
        },
      }
    : null;

  // Display welcome message
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      🤖 Interactive AI Chat Assistant with Vision         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Provider: ${selectedProvider.displayName}`);
  console.log(`Model: ${selectedProvider.model}`);
  console.log(`Vision: ${selectedProvider.hasVision ? '✅ Enabled' : '❌ Not available'}`);

  // Show capabilities
  if (microsoftTool) {
    console.log(`Microsoft Graph: ✅ Available (access M365 data)`);
  }
  console.log(`Code Execution: ✅ Available (run JavaScript)`);
  if (oauthRegistry.listProviderNames().length > 0) {
    console.log(`OAuth Providers: ${oauthRegistry.listProviderNames().join(', ')}`);
  }

  console.log('');
  console.log('Commands:');
  console.log('  /exit     - Exit the chat');
  console.log('  /clear    - Clear conversation history');
  console.log('  /history  - Show conversation history');
  console.log('  /switch   - Change AI provider');
  console.log('  /provider - Show current provider info');
  console.log('  /images   - Show attached images');
  if (microsoftTool) {
    console.log('  /msgraph  - Microsoft Graph info');
  }
  console.log('  /tools    - Show available tools');
  console.log('  Ctrl+V    - Paste image directly');
  console.log('  Ctrl+C    - Exit');
  console.log('');

  if (selectedProvider.hasVision) {
    console.log('📸 Image Support:');
    console.log('  • Press Ctrl+V (Cmd+V on Mac) to paste screenshots!');
    console.log('  • Take screenshot: Cmd+Ctrl+Shift+4 (Mac) / Win+Shift+S (Win)');
    console.log('  • Type [img:URL] inline to attach images');
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // ========== Create agent once (not per message!) ==========
  const agentTools: ToolFunction[] = [];

  if (microsoftTool) {
    agentTools.push(microsoftTool);
  }

  agentTools.push(tools.executeJavaScript);

  let instructions = 'You are a helpful, friendly, and knowledgeable AI assistant';

  if (microsoftTool) {
    instructions += ' with access to Microsoft Graph API';
  }

  instructions += ' and JavaScript code execution capabilities';
  instructions += '. Be conversational, concise, and engaging. Use a warm tone. When analyzing images, be detailed and helpful.';

  if (microsoftTool) {
    instructions += '\n\nYou can access Microsoft 365 data using the microsoft_graph tool.';
  }

  instructions += '\n\nYou can execute JavaScript code using the execute_javascript tool when:';
  instructions += '\n- User explicitly asks to "run code" or "execute JavaScript"';
  instructions += '\n- Need to process data from multiple API calls';
  instructions += '\n- Need complex data transformations';
  instructions += '\n\nIn execute_javascript, you have:';
  instructions += '\n- authenticatedFetch(url, options, provider) for OAuth-authenticated API calls';
  instructions += `\n- Available OAuth providers: ${oauthRegistry.listProviderNames().join(', ') || 'none (register providers first)'}`;
  instructions += '\n- Standard JavaScript globals (JSON, Math, Date, etc.)';
  instructions += '\n- Console output (console.log)';
  instructions += '\n\nIMPORTANT: When user says "run code" or "execute code", you MUST use the execute_javascript tool, not describe what code would do.';

  // Create agent ONCE
  const agent = client.agents.create({
    provider: selectedProvider.name,
    model: selectedProvider.model,
    tools: agentTools,
    instructions,
    temperature: 0.7,
    maxIterations: 10,
  });

  // Enable raw mode for keypress detection
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Handle keypress events for Ctrl+V detection
  process.stdin.on('keypress', async (chunk, key) => {
    if (!key) return;

    // Detect Ctrl+V (or Cmd+V)
    if (key.ctrl && key.name === 'v' && !isProcessing) {
      await handleClipboardPaste();
      return;
    }
  });

  // Show prompt
  rl.prompt();

  // Handle user input
  rl.on('line', async (input: string) => {
    let userInput = input.trim();

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
          userInput = userInput.replace(match[0], '').trim();
        }
      }

      // Warn if images with non-vision provider
      if (pendingImages.length > 0 && !selectedProvider.hasVision) {
        console.log(`\n⚠️  Warning: ${selectedProvider.displayName} does not support vision`);
        console.log('   Your image(s) will NOT be sent to the AI');
        console.log('   Use /switch to change to a vision-capable provider\n');
        pendingImages = [];
      }

      // Build the message
      const builder = new MessageBuilder();

      if (pendingImages.length > 0) {
        builder.addUserMessageWithImages(userInput, pendingImages);
        console.log(`\n📸 Sending message with ${pendingImages.length} image(s)...\n`);
      } else {
        builder.addUserMessage(userInput);
      }

      const messages = [...conversationHistory, ...builder.build()];

      // Show thinking indicator
      process.stdout.write('🤖 Assistant: ');
      const thinkingInterval = startThinkingAnimation();

      // Use the pre-created agent (with tools)
      const response = await agent.run(messages);

      stopThinkingAnimation(thinkingInterval);

      const assistantText = response.output_text || '';
      console.log(assistantText);
      console.log('');

      // Update history
      conversationHistory.push(...builder.build());
      conversationHistory.push(
        ...response.output.filter(
          (item): item is InputItem =>
            item.type === 'message' || item.type === 'compaction'
        )
      );

      pendingImages = [];

      // Show token usage
      const tokens = response.usage;
      console.log(
        `\x1b[90m[${selectedProvider.displayName} | Tokens: ${tokens.total_tokens} (${tokens.input_tokens} in, ${tokens.output_tokens} out) | Messages: ${Math.floor(conversationHistory.length / 2)}]\x1b[0m`
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

  rl.on('close', () => {
    console.log('\n\n👋 Goodbye! Thanks for chatting!');
    process.exit(0);
  });
}

/**
 * Handle Ctrl+V / Cmd+V clipboard paste
 */
async function handleClipboardPaste() {
  process.stdout.write('\r📋 Reading clipboard...');

  const result = await readClipboardImage();

  if (result.success && result.dataUri) {
    pendingImages.push(result.dataUri);
    const sizeKB = Math.round((result.dataUri.length * 3) / 4 / 1024);

    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log(`📎 [image #${pendingImages.length}] Pasted from clipboard (${sizeKB}KB ${result.format || 'PNG'})`);

    if (!selectedProvider.hasVision) {
      console.log(`⚠️  Note: ${selectedProvider.displayName} does not support vision`);
      console.log('   Use /switch to change to a vision-capable provider');
    } else {
      console.log('💡 Image will be sent with your next message');
    }

    console.log('');
  } else {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    console.log('❌ Could not read image from clipboard');

    if (result.error?.includes('pngpaste') || result.error?.includes('osascript')) {
      console.log('');
      console.log('💡 To enable clipboard image paste on Mac:');
      console.log('   brew install pngpaste');
    } else if (result.error) {
      console.log(`   ${result.error}`);
    }

    console.log('');
  }

  rl.prompt();
}

/**
 * Add an image to pending images
 */
async function addImage(urlOrPath: string): Promise<void> {
  try {
    if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
      pendingImages.push(urlOrPath);
      console.log(
        `📎 [image #${pendingImages.length}] ${urlOrPath.substring(0, 60)}${urlOrPath.length > 60 ? '...' : ''}`
      );
      return;
    }

    if (urlOrPath.startsWith('data:image/')) {
      pendingImages.push(urlOrPath);
      const sizeKB = Math.round((urlOrPath.length * 3) / 4 / 1024);
      console.log(`📎 [image #${pendingImages.length}] (base64 data, ${sizeKB}KB)`);
      return;
    }

    const resolvedPath = path.resolve(urlOrPath);
    if (fs.existsSync(resolvedPath)) {
      const ext = path.extname(resolvedPath).toLowerCase();
      const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

      if (!supportedExts.includes(ext)) {
        console.log(`❌ Unsupported file type: ${ext}`);
        console.log(`   Supported: ${supportedExts.join(', ')}`);
        return;
      }

      const imageBuffer = fs.readFileSync(resolvedPath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`;
      const dataUri = `data:${mimeType};base64,${base64Image}`;

      pendingImages.push(dataUri);
      const sizeKB = Math.round(imageBuffer.length / 1024);
      console.log(`📎 [image #${pendingImages.length}] ${path.basename(resolvedPath)} (${sizeKB}KB)`);
      return;
    }

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

    case '/switch':
      await handleSwitch();
      break;

    case '/provider':
      showProviderInfo();
      break;

    case '/msgraph':
      showMicrosoftGraphInfo();
      break;

    case '/tools':
      showAvailableTools();
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
 * Handle provider switching
 */
async function handleSwitch() {
  if (availableProviders.length <= 1) {
    console.log('❌ Only one provider configured\n');
    console.log('Add more API keys to .env to switch providers:');
    console.log('  ANTHROPIC_API_KEY=sk-ant-...');
    console.log('  GOOGLE_API_KEY=...');
    console.log('  GROQ_API_KEY=gsk_...\n');
    return;
  }

  const newProvider = await selectProvider(availableProviders);
  selectedProvider = newProvider;

  console.log(`✅ Switched to ${selectedProvider.displayName}`);
  console.log(`   Model: ${selectedProvider.model}`);
  console.log(`   Vision: ${selectedProvider.hasVision ? '✅ Enabled' : '❌ Not available'}`);
  console.log('📝 Note: Conversation history will be preserved\n');
}

/**
 * Show current provider info
 */
function showProviderInfo() {
  console.log(`\n📊 Current Provider\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  Name: ${selectedProvider.displayName}`);
  console.log(`  Model: ${selectedProvider.model}`);
  console.log(`  Vision: ${selectedProvider.hasVision ? '✅ Enabled' : '❌ Not available'}`);
  console.log(`  ${selectedProvider.description}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Show Microsoft Graph info
 */
function showMicrosoftGraphInfo() {
  if (!oauthRegistry.has('microsoft')) {
    console.log('\n❌ Microsoft Graph not configured\n');
    console.log('To enable Microsoft Graph:');
    console.log('  1. Set up app at https://portal.azure.com');
    console.log('  2. Add to .env:');
    console.log('     MICROSOFT_CLIENT_ID=...');
    console.log('     MICROSOFT_CLIENT_SECRET=...');
    console.log('     MICROSOFT_TENANT_ID=...');
    console.log('  3. Restart chat\n');
    return;
  }

  console.log('\n🔷 Microsoft Graph API\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('  Status: ✅ Available');
  console.log('  Base URL: https://graph.microsoft.com');
  console.log('  Auth: Client Credentials (app token)');
  console.log('');
  console.log('  Available data:');
  console.log('    • Organization users');
  console.log('    • User mailboxes');
  console.log('    • Calendars & events');
  console.log('    • OneDrive files');
  console.log('    • Teams & channels');
  console.log('');
  console.log('  Example queries:');
  console.log('    "How many users are in my organization?"');
  console.log('    "List the first 5 users"');
  console.log('    "Show me user details"');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Show available tools
 */
function showAvailableTools() {
  console.log('\n🛠️  Available Tools\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('1. execute_javascript');
  console.log('   • Execute JavaScript code in sandbox');
  console.log('   • Access to authenticatedFetch');
  console.log(`   • OAuth providers: ${oauthRegistry.listProviderNames().join(', ') || 'none'}`);
  console.log('   • Use for: Complex logic, multi-API calls, data processing');
  console.log('');

  if (oauthRegistry.has('microsoft')) {
    console.log('2. microsoft_graph');
    console.log('   • Access Microsoft 365 APIs');
    console.log('   • Endpoints: /v1.0/users, /v1.0/me/messages, etc.');
    console.log('   • Use for: M365 data (users, mail, files, calendar)');
    console.log('');
  }

  console.log('Example queries:');
  console.log('  "Execute JavaScript to calculate the Fibonacci sequence"');
  console.log('  "Run code to fetch and process API data"');
  if (oauthRegistry.has('microsoft')) {
    console.log('  "How many users are in my org?" (uses microsoft_graph)');
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Handle /paste command

/**
 * Handle /paste command
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
      const preview = trimmed.substring(0, 100);
      if (trimmed.length > 100) {
        console.log('   Found: ' + preview + '...');
      } else {
        console.log('   Found: ' + preview);
      }
      console.log('');
      console.log('💡 Tip: Press Ctrl+V to paste image data directly');
    }

    console.log('');
  } catch (error: any) {
    console.log('❌ Error reading clipboard: ' + (error.message || 'Unknown error'));
    console.log('');
  }
}


/**
 * Show pending images
 */
function showImages() {
  if (pendingImages.length === 0) {
    console.log('📭 No pending images\n');
    console.log('💡 Add images with:');
    console.log('   • Ctrl+V - Paste screenshot/image data');
    console.log('   • [img:URL] - Inline in your message\n');
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
    console.log('📭 No conversation history yet\n');
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
  console.log('  /clear            - Clear conversation history and images');
  console.log('  /history          - Show conversation history');
  console.log('  /switch           - Change AI provider');
  console.log('  /provider         - Show current provider info');
  console.log('  /images           - Show pending images');
  console.log('  /help             - Show this help message');
  if (oauthRegistry.has('microsoft')) {
    console.log('  /msgraph          - Microsoft Graph info');
  }
  console.log('  /tools            - Show available tools');
  console.log('  Ctrl+V            - Paste image from clipboard');
  console.log('  Ctrl+C            - Exit\n');

  if (selectedProvider.hasVision) {
    console.log('📸 Image Support:');
    console.log('  • Ctrl+V - Paste screenshots directly');
    console.log('  • [img:URL] - Attach image inline');
    console.log('  • Images sent with your next message\n');
  } else {
    console.log('⚠️  Vision not available with current provider');
    console.log('   Use /switch to change to: OpenAI, Anthropic, Google, or Grok\n');
  }

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
