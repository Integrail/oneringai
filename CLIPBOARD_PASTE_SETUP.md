# Clipboard Image Paste Setup (Ctrl+V / Cmd+V)

## Overview

The interactive chat now supports **direct image pasting** from your clipboard using **Ctrl+V** (or **Cmd+V** on Mac), just like in Claude Code!

Take a screenshot, press Ctrl+V, and the image appears as `[image #1]` ready to send.

## How It Works

### macOS (Recommended Setup)

#### Option 1: Install `pngpaste` (Best Experience)

```bash
brew install pngpaste
```

Then in the chat:
1. Take a screenshot: **Cmd+Ctrl+Shift+4** (saves to clipboard)
2. Press **Cmd+V** in the chat
3. See: `📎 [image #1] Pasted from clipboard (45KB PNG)`
4. Type your message and press Enter

#### Option 2: Use Built-in AppleScript (No Install)

If you don't have `pngpaste`, the chat will automatically fall back to AppleScript:
- Slightly slower
- Same functionality
- No installation required

### Linux

#### X11 (Most Desktops)

Install `xclip`:
```bash
# Ubuntu/Debian
sudo apt-get install xclip

# Fedora
sudo dnf install xclip

# Arch
sudo pacman -S xclip
```

Then:
1. Take screenshot (varies by desktop)
2. Press **Ctrl+V** in the chat
3. Image appears as `[image #1]`

#### Wayland (Newer Systems)

Install `wl-clipboard`:
```bash
# Ubuntu/Debian
sudo apt-get install wl-clipboard

# Fedora
sudo dnf install wl-clipboard
```

### Windows

No installation needed! Uses built-in PowerShell:
1. Take screenshot: **Win+Shift+S**
2. Press **Ctrl+V** in the chat
3. Image appears as `[image #1]`

## Usage Examples

### Example 1: Analyze a Screenshot

```
# Step 1: Take a screenshot
Press Cmd+Ctrl+Shift+4 (Mac) or Win+Shift+S (Windows)
Select the area to capture

# Step 2: Paste in chat
👤 You: [Press Cmd+V]
📋 Reading clipboard...
📎 [image #1] Pasted from clipboard (128KB PNG)
💡 Image will be sent with your next message

# Step 3: Ask about it
👤 You: What do you see in this screenshot?
📸 Sending message with 1 image(s)...

🤖 Assistant: I can see a code editor with TypeScript code...
[Tokens: 345 total (185 in, 160 out)]
```

### Example 2: Multiple Screenshots

```
# Take first screenshot, paste
👤 You: [Cmd+V]
📎 [image #1] Pasted from clipboard (95KB PNG)

# Take second screenshot, paste
👤 You: [Cmd+V]
📎 [image #2] Pasted from clipboard (112KB PNG)

# Ask about both
👤 You: Compare these two screenshots and tell me what changed
📸 Sending message with 2 image(s)...

🤖 Assistant: Between the two screenshots, I notice...
```

### Example 3: Mix Screenshots with URLs

```
# Paste a screenshot
👤 You: [Cmd+V]
📎 [image #1] Pasted from clipboard (88KB PNG)

# Add a URL
👤 You: [img:https://example.com/diagram.png]
📎 [image #2] https://example.com/diagram.png

# Check what's queued
👤 You: /images
📸 Pending Images (will be sent with next message)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [clipboard image] (88KB)
2. https://example.com/diagram.png

# Send both
👤 You: Explain the relationship between these images
📸 Sending message with 2 image(s)...
```

## Troubleshooting

### Mac: "Could not read image from clipboard"

**Solution 1: Install pngpaste (Recommended)**
```bash
brew install pngpaste
```

**Solution 2: Check clipboard has an image**
- Make sure you actually took a screenshot (Cmd+Ctrl+Shift+4)
- Or copied an image (right-click → Copy Image)

**Solution 3: Verify screenshot settings**
- Cmd+Shift+4 saves to file (not clipboard)
- **Cmd+Ctrl+Shift+4** saves to clipboard ✅

### Linux: "No image in clipboard"

**Install clipboard tools:**
```bash
# For X11
sudo apt-get install xclip

# For Wayland
sudo apt-get install wl-clipboard
```

### Windows: PowerShell Issues

**If you see errors:**
1. Make sure PowerShell is available (it should be by default)
2. Try running PowerShell as administrator
3. Check Windows clipboard contains an image

### "Image will be sent with your next message"

This is **expected behavior** - images are queued and sent when you type a message:

```
👤 You: [Cmd+V]
📎 [image #1] Pasted
💡 Image will be sent with your next message  ← Normal!

👤 You: What is this?  ← Image sent here
📸 Sending message with 1 image(s)...
```

To send images immediately without text:
```
👤 You: [Cmd+V]
📎 [image #1] Pasted

👤 You: Describe this image  ← Just type something simple
```

## Keyboard Shortcuts Reference

| Shortcut | Action | Platform |
|----------|--------|----------|
| **Cmd+Ctrl+Shift+4** | Screenshot to clipboard | macOS |
| **Win+Shift+S** | Screenshot to clipboard | Windows |
| **Print Screen** | Screenshot (varies) | Linux |
| **Cmd+V** | Paste image | macOS |
| **Ctrl+V** | Paste image | Windows/Linux |
| **Ctrl+C** | Exit chat | All |

## Behind the Scenes

### What Happens When You Press Ctrl+V

1. **Keypress detected** - Raw mode intercepts Ctrl+V
2. **Clipboard read** - Platform-specific command reads image data
3. **Conversion** - Image converted to base64 data URI
4. **Display** - Shows `[image #1]` with size
5. **Queue** - Added to pending images
6. **Send** - Included with your next message

### Platform-Specific Commands

**macOS:**
```bash
# Try pngpaste first (if installed)
pngpaste /tmp/clipboard.png

# Fall back to AppleScript
osascript -e 'set theImage to the clipboard as «class PNGf»'
```

**Linux:**
```bash
# X11
xclip -selection clipboard -t image/png -o > /tmp/clipboard.png

# Wayland
wl-paste -t image/png > /tmp/clipboard.png
```

**Windows:**
```powershell
# PowerShell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::GetImage()
```

## File Size Considerations

### Clipboard Images
- Screenshots: Usually 50-500KB
- Copied images: Varies widely
- Compressed automatically by the system

### Token Usage
- Small images (low detail): ~85 tokens
- Large images (high detail): ~170-340 tokens
- Shown in response: `[Tokens: 345 total ...]`

### Optimization Tips
1. **Crop screenshots** before pasting (smaller = cheaper)
2. **Use built-in screenshot tools** (optimized compression)
3. **Check size** with `/images` before sending
4. **Consider image detail** - library uses 'auto' by default

## Comparison with Other Methods

| Method | Setup | Speed | Use Case |
|--------|-------|-------|----------|
| **Ctrl+V** | One-time install | Instant | Screenshots, copied images |
| `/paste` + URL | None | Fast | Web images, shared URLs |
| `[img:URL]` | None | Fast | Quick inline attachment |
| Local file path | None | Medium | Existing image files |

**Recommendation**: Use **Ctrl+V** for screenshots (fastest), URLs for web images.

## Advanced Usage

### Clear Images Before Sending

```
👤 You: [Cmd+V]
📎 [image #1] Pasted

👤 You: /images
📸 Pending Images...

👤 You: /clear  ← Removes the image
```

### Check Before Sending

```
👤 You: [Cmd+V]
📎 [image #1] Pasted (250KB PNG)

👤 You: /images  ← Review what will be sent
📸 Pending Images (will be sent with next message)
1. [clipboard image] (250KB)

👤 You: Analyze this
📸 Sending...
```

## Next Steps

1. **Install pngpaste** (Mac only): `brew install pngpaste`
2. **Run the chat**: `npm run example:chat`
3. **Take a screenshot**: Cmd+Ctrl+Shift+4
4. **Press Cmd+V** in the chat
5. **Type your question** and press Enter

Enjoy seamless screenshot analysis! 📸🤖
