# Quick Start Guide

## Try the Interactive Chat (Fastest Way!)

### 1. Set up your API key

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-key-here
```

Get your API key from: https://platform.openai.com/api-keys

### 2. Install dependencies

```bash
npm install
```

### 3. Start chatting!

```bash
npm run example:chat
```

That's it! You'll see:

```
╔════════════════════════════════════════════════════════════╗
║           🤖 Interactive AI Chat Assistant                ║
╚════════════════════════════════════════════════════════════╝

Welcome! I'm an AI assistant powered by GPT-4.
Ask me anything, and I'll do my best to help.

Commands:
  /exit     - Exit the chat
  /clear    - Clear conversation history
  /history  - Show conversation history
  Ctrl+C    - Exit the chat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 You: _
```

## Chat Commands

| Command | Description |
|---------|-------------|
| `/exit`, `/quit`, `/q` | Exit the chat |
| `/clear` | Clear conversation history and start fresh |
| `/history` | View the entire conversation |
| `/help` | Show available commands |
| `Ctrl+C` | Quick exit |

## Example Conversation

```
👤 You: What is quantum computing?
🤖 Assistant: Quantum computing is a revolutionary type of computing...
[Tokens: 234 total (15 in, 219 out) | Messages: 1]

👤 You: Can you explain it like I'm 10?
🤖 Assistant: Sure! Imagine regular computers as really smart people...
[Tokens: 412 total (245 in, 167 out) | Messages: 2]

👤 You: /history
📜 Conversation History
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 You:
What is quantum computing?

🤖 Assistant:
Quantum computing is a revolutionary type of computing...

👤 You:
Can you explain it like I'm 10?

🤖 Assistant:
Sure! Imagine regular computers as really smart people...

👤 You: /exit
👋 Goodbye! Thanks for chatting!
```

## Other Examples

### Agent with Tools
```bash
npm run example:agent
```
See an AI agent use custom tools (weather checker, calculator).

### Simple Text Generation
```bash
npm run example:text
```
Basic text generation and JSON output examples.

### Multi-turn Conversation
```bash
npm run example:conversation
```
Programmatic conversation with context preservation.

## Troubleshooting

### "API key not found"
Make sure your `.env` file exists and contains:
```
OPENAI_API_KEY=sk-your-actual-key-here
```

### "Module not found"
Run `npm install` first.

### Want to use a cheaper model?
Edit `examples/interactive-chat.ts` and change:
```typescript
model: 'gpt-3.5-turbo',  // Instead of 'gpt-4'
```

### Rate limits
If you hit rate limits:
- Use `gpt-3.5-turbo` instead of `gpt-4`
- Add delays between messages
- Check your OpenAI account limits

## Next Steps

- Read [README.md](./README.md) for full API documentation
- Check [EXAMPLES.md](./EXAMPLES.md) for detailed example explanations
- See [CLAUDE.md](./CLAUDE.md) for architecture and development guide
- Modify `examples/interactive-chat.ts` to customize the assistant's behavior
- Build your own chat application using this library!

## Tips for Better Conversations

1. **Be specific**: Clear questions get better answers
2. **Use /clear**: Start fresh if the context gets confusing
3. **Check /history**: Review what was discussed
4. **Experiment**: Try different types of questions - math, coding, creative writing, etc.

Enjoy chatting! 🎉
