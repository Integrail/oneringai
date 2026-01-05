# Interactive Chat with Vision - User Guide

## Overview

The interactive chat now supports sending images to the AI! You can paste images from your clipboard, use inline syntax, or reference local files.

## Quick Start

```bash
npm run example:chat
```

## How to Send Images

### Method 1: Ctrl+V / Cmd+V - Direct Screenshot Paste (Easiest! 🎉)

**Just like in Claude Code!**

1. **Take a screenshot**:
   - **Mac**: Press **Cmd+Ctrl+Shift+4**, then select area
   - **Windows**: Press **Win+Shift+S**, then select area
   - **Linux**: Use your screenshot tool (varies)

2. **Press Ctrl+V (or Cmd+V) in the chat**:
   ```
   👤 You: [Press Cmd+V]
   📋 Reading clipboard...
   📎 [image #1] Pasted from clipboard (128KB PNG)
   💡 Image will be sent with your next message
   ```

3. **Type your message**:
   ```
   👤 You: What do you see in this screenshot?
   📸 Sending message with 1 image(s)...

   🤖 Assistant: I can see...
   ```

**Setup (Mac only):**
For the best experience on Mac, install `pngpaste`:
```bash
brew install pngpaste
```

Without it, the chat will use AppleScript (slightly slower but works).

### Method 2: /paste Command (URLs/Paths)

1. **Copy an image URL** to your clipboard
   - Right-click an image → "Copy Image Address"
   - Or copy the URL from your browser

2. **Type `/paste` in the chat**
   ```
   👤 You: /paste
   📋 Reading from clipboard...
   📎 [image #1] https://example.com/image.jpg
   ```

3. **Send your message** - the image will be included
   ```
   👤 You: What is in this image?
   📸 Sending message with 1 image(s)...

   🤖 Assistant: I can see a beautiful landscape with...
   ```

### Method 2: Inline URLs

Type `[img:URL]` anywhere in your message:

```
👤 You: What is this? [img:https://example.com/photo.jpg]
📎 [image #1] https://example.com/photo.jpg

📸 Sending message with 1 image(s)...
🤖 Assistant: This is a photo of...
```

The `[img:URL]` part will be removed from your text automatically.

### Method 3: Local Files

Use file paths (absolute or relative):

```
👤 You: /paste
📋 Reading from clipboard...  [paste a file path like /Users/you/photo.jpg]
📎 [image #1] photo.jpg

👤 You: Describe this photo
📸 Sending message with 1 image(s)...
```

Or inline:
```
👤 You: Analyze [img:./photos/vacation.jpg]
```

## Multiple Images

You can attach multiple images before sending:

```
👤 You: /paste
📎 [image #1] https://example.com/img1.jpg

👤 You: [img:https://example.com/img2.jpg]
📎 [image #2] https://example.com/img2.jpg

👤 You: /images
📸 Pending Images (will be sent with next message)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. https://example.com/img1.jpg
2. https://example.com/img2.jpg

👤 You: Compare these two images
📸 Sending message with 2 image(s)...
```

## Commands

| Command | Description |
|---------|-------------|
| `/paste` | Paste image URL/path from clipboard |
| `/images` | Show pending images (not yet sent) |
| `[img:URL]` | Attach image inline |
| `/history` | View conversation (shows image indicators) |
| `/clear` | Clear history and pending images |
| `/exit` | Exit the chat |
| `/help` | Show help |

## Supported Image Formats

### URLs
- ✅ `https://example.com/image.jpg`
- ✅ `https://example.com/image.png`
- ✅ `https://example.com/image.gif`
- ✅ `https://example.com/image.webp`

### File Paths
- ✅ Absolute: `/Users/name/photos/image.jpg`
- ✅ Relative: `./photos/image.jpg`
- ✅ Supported extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

### Data URIs
- ✅ `data:image/jpeg;base64,/9j/4AAQSkZJRg...`

## Examples

### Example 1: Analyze a Screenshot

```
👤 You: /paste  [after copying a screenshot URL]
📎 [image #1] screenshot.png

👤 You: What do you see in this screenshot?
📸 Sending message with 1 image(s)...

🤖 Assistant: I can see a code editor with TypeScript code...
```

### Example 2: Compare Two Photos

```
👤 You: /paste
📎 [image #1] before.jpg

👤 You: /paste
📎 [image #2] after.jpg

👤 You: What changed between these photos?
📸 Sending message with 2 image(s)...

🤖 Assistant: The main differences I notice are...
```

### Example 3: Ask Follow-up Questions

```
👤 You: /paste
📎 [image #1] diagram.png

👤 You: Explain this diagram
📸 Sending message with 1 image(s)...

🤖 Assistant: This diagram shows a system architecture with...

👤 You: What's the purpose of the database component?

🤖 Assistant: The database component serves to...
```

### Example 4: Mix Text and Images

```
👤 You: I need help understanding this chart [img:https://example.com/chart.png]. Specifically, what does the spike at 3PM mean?

📎 [image #1] https://example.com/chart.png

📸 Sending message with 1 image(s)...

🤖 Assistant: Looking at the chart, the spike at 3PM represents...
```

## Tips & Tricks

### 1. **Check Pending Images**
Before sending, use `/images` to see what will be sent:
```
👤 You: /images
📸 Pending Images (will be sent with next message)
```

### 2. **Clear Images Without Sending**
Use `/clear` to reset:
```
👤 You: /clear
✅ Conversation history and pending images cleared
```

### 3. **View History with Images**
```
👤 You: /history
📜 Conversation History
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 You:
What is in this image?
📸 [1 image(s)]

🤖 Assistant:
I can see...
```

### 4. **Local Files Are Auto-Converted**
Local files are automatically converted to base64 data URIs:
- No need to upload to a URL
- Works offline
- Included directly in the API call

### 5. **Use Inline for Quick Questions**
```
👤 You: Is this a cat or dog? [img:https://example.com/pet.jpg]
```

## Troubleshooting

### "Clipboard is empty"
- Make sure you copied something first (Ctrl+C or Cmd+C)
- Try copying the URL again

### "Clipboard does not contain an image URL"
- The clipboard contains text, but not an image URL
- Copy the image URL or file path, not the image itself
- Example: Right-click image → "Copy Image Address"

### "Invalid image: Not a URL or existing file path"
- Check the URL is complete (starts with `http://` or `https://`)
- Check the file path exists
- Use quotes if the path has spaces: `"/path/with spaces/image.jpg"`

### "Unsupported file type"
- Only `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` are supported
- Convert your image to a supported format

### Images not showing in response
- Make sure you're using GPT-4o or GPT-4-vision model (the example uses GPT-4o)
- Check the image URL is accessible
- For local files, make sure they exist and are readable

### High token usage
- Images use ~85-340 tokens each depending on size
- Use smaller images or lower resolution
- Consider the image detail level (see IMAGE_INPUT_SUPPORT.md)

## Technical Details

- **Model**: GPT-4o (vision-capable)
- **Token cost**: ~85-340 tokens per image
- **Max images**: ~10 images per message (recommended)
- **File conversion**: Local files → base64 → data URI
- **History**: Images are preserved in conversation history

## Next Steps

- Try it: `npm run example:chat`
- Read full vision guide: `IMAGE_INPUT_SUPPORT.md`
- See programmatic examples: `npm run example:vision`

Enjoy chatting with vision! 🖼️🤖
