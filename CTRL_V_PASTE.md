# 📸 Ctrl+V Screenshot Paste - Just Like Claude Code!

## TL;DR

**Mac:**
```bash
brew install pngpaste  # One-time setup
npm run example:chat   # Start chat
# Press Cmd+Ctrl+Shift+4, then Cmd+V in chat
```

**Windows:**
```bash
npm run example:chat   # Start chat (no setup needed!)
# Press Win+Shift+S, then Ctrl+V in chat
```

## How It Works

### 1. Take a Screenshot

**Mac:** Press **Cmd+Ctrl+Shift+4**
- Cursor turns into crosshair
- Select the area you want to capture
- Image saved to clipboard (not file)

**Windows:** Press **Win+Shift+S**
- Screen dims
- Select area to capture
- Image copied to clipboard

**Linux:** Use your screenshot tool (varies)
- Make sure it copies to clipboard
- Install `xclip` or `wl-clipboard` first

### 2. Paste in Chat

**Just press Ctrl+V (or Cmd+V on Mac):**

```
👤 You: [Cmd+V]
📋 Reading clipboard...
📎 [image #1] Pasted from clipboard (128KB PNG)
💡 Image will be sent with your next message

👤 You: _
```

The image is now queued! Type your question:

```
👤 You: What do you see in this screenshot?
📸 Sending message with 1 image(s)...

🤖 Assistant: I can see a terminal window with...
[Tokens: 345 total (185 in, 160 out)]
```

## Real Usage Example

```
# Start the chat
$ npm run example:chat

╔════════════════════════════════════════════════════════════╗
║      🤖 Interactive AI Chat Assistant with Vision         ║
╚════════════════════════════════════════════════════════════╝

👤 You: [Take screenshot with Cmd+Ctrl+Shift+4]
👤 You: [Press Cmd+V]
📎 [image #1] Pasted from clipboard (156KB PNG)
💡 Image will be sent with your next message

👤 You: Explain what's happening in this code
📸 Sending message with 1 image(s)...

🤖 Assistant: Looking at your code screenshot, I can see a TypeScript
implementation of an agentic loop. The code handles tool execution in a
sophisticated way with blocking and non-blocking patterns...

[Tokens: 412 total (245 in, 167 out) | Messages: 1]

👤 You: What could be improved?

🤖 Assistant: Based on the code I analyzed, here are some suggestions:
1. Add error handling for the timeout scenarios...
```

## Setup Instructions

### macOS (Recommended)

Install `pngpaste` for the smoothest experience:

```bash
brew install pngpaste
```

**Without pngpaste:**
- Still works using AppleScript
- Slightly slower (~1-2 seconds)
- No installation required

### Linux

**X11 (Most desktop environments):**
```bash
# Ubuntu/Debian
sudo apt-get install xclip

# Fedora
sudo dnf install xclip

# Arch
sudo pacman -S xclip
```

**Wayland (Newer systems):**
```bash
# Ubuntu/Debian
sudo apt-get install wl-clipboard

# Fedora
sudo dnf install wl-clipboard
```

### Windows

**No setup needed!** Works out of the box with PowerShell.

## Features

### ✅ What's Supported

- **Screenshot paste** - Cmd+Ctrl+Shift+4 → Cmd+V
- **Copied images** - Right-click image → Copy → Cmd+V
- **Multiple images** - Paste multiple times before sending
- **Size display** - Shows image size: `(128KB PNG)`
- **Auto-conversion** - Converts to base64 data URI
- **Queue system** - Images queued until message sent
- **Cross-platform** - Mac, Windows, Linux

### ✅ Also Works With

- `/paste` - Paste image URLs from clipboard
- `[img:URL]` - Inline image URLs
- Local file paths - Auto-converted to base64

## Comparison: This vs Claude Code

| Feature | @oneringai/agents | Claude Code |
|---------|-------------------|-------------|
| Ctrl+V paste | ✅ | ✅ |
| Shows [image #1] | ✅ | ✅ |
| Multi-image | ✅ | ✅ |
| Size display | ✅ | ✅ |
| Vision analysis | ✅ GPT-4o | ✅ Claude |
| Implementation | **You own the code** | Proprietary |

## Commands Quick Reference

| Action | Command |
|--------|---------|
| **Paste screenshot** | **Cmd+V** or **Ctrl+V** |
| Paste image URL | `/paste` |
| Show pending images | `/images` |
| Clear images | `/clear` |
| View history | `/history` |
| Exit | `/exit` or Ctrl+C |

## Troubleshooting

### Mac: "Install pngpaste"

```bash
brew install pngpaste
```

Or just use it without - it works with AppleScript (slightly slower).

### Mac: Screenshot Shortcuts

- **Cmd+Shift+4** - Save to file ❌ (doesn't copy to clipboard)
- **Cmd+Ctrl+Shift+4** - Copy to clipboard ✅ (use this!)

### Linux: "No image in clipboard"

Install clipboard tools:
```bash
sudo apt-get install xclip  # X11
sudo apt-get install wl-clipboard  # Wayland
```

### "Image will be sent with your next message"

This is **normal**! Images are queued. Type a message to send:

```
👤 You: [Cmd+V]
📎 [image #1] Pasted ✅

👤 You: What is this?  ← Type anything to send
📸 Sending with 1 image...
```

## Advanced Usage

### Queue Multiple Screenshots

```
👤 You: [Take screenshot 1, Cmd+V]
📎 [image #1] Pasted (95KB PNG)

👤 You: [Take screenshot 2, Cmd+V]
📎 [image #2] Pasted (112KB PNG)

👤 You: [Take screenshot 3, Cmd+V]
📎 [image #3] Pasted (88KB PNG)

👤 You: /images
📸 Pending Images (will be sent with next message)
1. [clipboard image] (95KB)
2. [clipboard image] (112KB)
3. [clipboard image] (88KB)

👤 You: Compare these three screenshots and tell me what changed
📸 Sending message with 3 image(s)...
```

### Mix Methods

```
👤 You: [Cmd+V]  ← Paste screenshot
📎 [image #1] Pasted

👤 You: [img:https://example.com/diagram.png]  ← Add URL
📎 [image #2] https://example.com/diagram.png

👤 You: Compare my screenshot with this diagram
```

## Technical Implementation

### Platform-Specific Clipboard Reading

**macOS:**
```typescript
// 1. Try pngpaste (fastest)
exec('pngpaste /tmp/clipboard.png')

// 2. Fall back to AppleScript
exec('osascript -e "set theImage to the clipboard as «class PNGf»"')
```

**Linux:**
```typescript
// X11
exec('xclip -selection clipboard -t image/png -o > /tmp/clipboard.png')

// Wayland
exec('wl-paste -t image/png > /tmp/clipboard.png')
```

**Windows:**
```typescript
// PowerShell
exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetImage().Save(...)"')
```

### Key Components

1. **Keypress Detection** (`readline.emitKeypressEvents`)
   - Enables raw mode
   - Intercepts Ctrl+V
   - Calls clipboard handler

2. **Clipboard Image Reader** (`src/utils/clipboardImage.ts`)
   - Platform detection
   - Shell command execution
   - Base64 conversion
   - Error handling

3. **Message Builder** (`src/utils/messageBuilder.ts`)
   - Constructs proper InputItem format
   - Combines text + images
   - Type-safe builder pattern

## Why This Is Awesome

1. **Native UX** - Feels like Claude Code, VS Code, etc.
2. **Fast** - Screenshot → Paste → Ask (3 seconds total)
3. **No Upload** - Images embedded directly (base64)
4. **Multi-Platform** - Works everywhere
5. **Type-Safe** - Full TypeScript support
6. **Open Source** - You own the code!

## Try It Now!

```bash
# Mac (one-time setup)
brew install pngpaste

# Start chatting
npm run example:chat

# Take a screenshot: Cmd+Ctrl+Shift+4
# Press: Cmd+V
# Type: "What is this?"
# Watch the magic! ✨
```

---

**Feature added**: 2025-01-05
**Inspired by**: Claude Code's clipboard paste UX
**Supported platforms**: macOS, Windows, Linux
