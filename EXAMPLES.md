# Running Examples

This guide shows you how to run the example files in the `examples/` directory.

## Setup

### 1. Install Dependencies

If you haven't already:

```bash
npm install
```

### 2. Set Up Your API Key

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Then edit `.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

You can get an API key from [OpenAI Platform](https://platform.openai.com/api-keys).

### 3. Build the Library (Optional)

The examples import from the source files, so you don't need to build first. But if you want to test the built distribution:

```bash
npm run build
```

## Running Examples

### Option 1: Using npm scripts (Recommended)

```bash
# Run the agent with tools example
npm run example:agent

# Run the simple text generation example
npm run example:text

# Run the multi-turn conversation example
npm run example:conversation

# Run the interactive chat (talk with the AI)
npm run example:chat
```

### Option 2: Using tsx directly

```bash
# Run any example file
npx tsx examples/basic-agent.ts
npx tsx examples/simple-text.ts
npx tsx examples/multi-turn-conversation.ts
```

### Option 3: Load environment variables manually

If the `.env` file isn't loading automatically:

```bash
# On macOS/Linux
export OPENAI_API_KEY=sk-your-key-here
npm run example:agent

# On Windows (PowerShell)
$env:OPENAI_API_KEY="sk-your-key-here"
npm run example:agent

# On Windows (CMD)
set OPENAI_API_KEY=sk-your-key-here
npm run example:agent
```

## Examples Included

### 1. `basic-agent.ts` - Agent with Tool Calling

Demonstrates:
- Creating an agent with custom tools (weather checker, calculator)
- Tool execution with blocking behavior
- Multi-turn conversations where the agent calls tools

**Example output:**
```
🤖 Creating agent with tools...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Example 1: Weather Query
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌤️  Fetching weather for Tokyo...
✅ Weather data retrieved

📝 Agent Response:
The current weather in Tokyo is 22°C (Celsius) with partly cloudy conditions...
```

### 2. `simple-text.ts` - Simple Text Generation

Demonstrates:
- Basic text generation
- Using system instructions
- Structured JSON output with schema validation

### 3. `multi-turn-conversation.ts` - Multi-Turn Conversations

Demonstrates:
- Building conversation history
- Context preservation across turns
- Following up on previous responses

### 4. `interactive-chat.ts` - Interactive Chat Session ⭐

**Most Fun Example!** Have a real conversation with the AI:

```bash
npm run example:chat
```

Features:
- Real-time interactive chat
- Full conversation history maintained
- Special commands:
  - `/exit` - Exit the chat
  - `/clear` - Clear conversation history
  - `/history` - Show full conversation
  - `/help` - Show help
  - `Ctrl+C` - Exit
- Thinking animation while waiting
- Token usage stats

**Example session:**
```
╔════════════════════════════════════════════════════════════╗
║           🤖 Interactive AI Chat Assistant                ║
╚════════════════════════════════════════════════════════════╝

👤 You: What is the capital of France?
🤖 Assistant: The capital of France is Paris. It's one of the most...

[Tokens: 145 total (23 in, 122 out) | Messages: 1]

👤 You: What's special about it?
🤖 Assistant: Paris is special for many reasons! It's known as the...

👤 You: /exit
👋 Goodbye! Thanks for chatting!
```

## Troubleshooting

### "API key not found" error

Make sure:
1. Your `.env` file exists in the root directory
2. It contains `OPENAI_API_KEY=sk-...` with your actual key
3. The key starts with `sk-`

### "Module not found" error

Make sure you've installed dependencies:
```bash
npm install
```

### TypeScript errors

Make sure TypeScript is installed:
```bash
npm install --save-dev typescript tsx
```

### Rate limit errors

If you get rate limited by OpenAI:
- Wait a few seconds between runs
- Use a different model (gpt-3.5-turbo is cheaper and has higher limits)
- Check your OpenAI account usage limits

## Modifying Examples

Feel free to modify the example files:

1. **Change the model**: Replace `'gpt-4'` with `'gpt-3.5-turbo'` for faster, cheaper responses
2. **Add your own tools**: Create new ToolFunction objects
3. **Adjust parameters**: Change temperature, max tokens, etc.
4. **Try different prompts**: Experiment with different questions

Example:
```typescript
const agent = client.agents.create({
  provider: 'openai',
  model: 'gpt-3.5-turbo',  // Changed to 3.5-turbo
  temperature: 0.3,         // Lower temperature for more focused responses
  tools: [yourCustomTool]
});
```

## Next Steps

After running the examples:

1. Check out the [main README](./README.md) for full API documentation
2. Read the source code in `src/` to understand the implementation
3. Create your own examples with custom tools
4. Integrate the library into your own projects
