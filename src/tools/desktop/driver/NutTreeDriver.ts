/**
 * NutTreeDriver - Desktop automation driver using @nut-tree-fork/nut-js
 *
 * Handles:
 * - Dynamic import of @nut-tree-fork/nut-js (optional peer dep)
 * - Scale factor detection for Retina/HiDPI displays
 * - Coordinate conversion: physical pixels (screenshot space) ↔ logical OS coords
 * - PNG encoding of raw RGBA screenshots
 */

import type {
  IDesktopDriver,
  DesktopPoint,
  DesktopScreenSize,
  DesktopScreenshot,
  DesktopWindow,
  MouseButton,
} from '../types.js';

// Key name → nut-tree Key enum mapping
const KEY_MAP: Record<string, string> = {
  // Modifiers
  ctrl: 'LeftControl',
  control: 'LeftControl',
  cmd: 'LeftCmd',
  command: 'LeftCmd',
  meta: 'LeftCmd',
  super: 'LeftCmd',
  alt: 'LeftAlt',
  option: 'LeftAlt',
  shift: 'LeftShift',

  // Navigation
  enter: 'Return',
  return: 'Return',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  space: 'Space',

  // Arrow keys
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',

  // Function keys
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4',
  f5: 'F5', f6: 'F6', f7: 'F7', f8: 'F8',
  f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',

  // Other
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  printscreen: 'Print',
  capslock: 'CapsLock',
  numlock: 'NumLock',
  scrolllock: 'ScrollLock',
};

/**
 * Parse a key combo string like "ctrl+c", "cmd+shift+s", "enter"
 * Returns nut-tree Key enum values.
 */
export function parseKeyCombo(keys: string, KeyEnum: Record<string, any>): any[] {
  const parts = keys.toLowerCase().split('+').map((k) => k.trim());
  const result: any[] = [];

  for (const part of parts) {
    // Check key map first
    const mapped = KEY_MAP[part];
    if (mapped && KeyEnum[mapped] !== undefined) {
      result.push(KeyEnum[mapped]);
      continue;
    }

    // Single character → look up directly
    if (part.length === 1) {
      const upper = part.toUpperCase();
      if (KeyEnum[upper] !== undefined) {
        result.push(KeyEnum[upper]);
        continue;
      }
    }

    // Try PascalCase match (e.g., "Tab" → Key.Tab)
    const pascal = part.charAt(0).toUpperCase() + part.slice(1);
    if (KeyEnum[pascal] !== undefined) {
      result.push(KeyEnum[pascal]);
      continue;
    }

    // Try exact match (case-sensitive)
    if (KeyEnum[part] !== undefined) {
      result.push(KeyEnum[part]);
      continue;
    }

    throw new Error(`Unknown key: "${part}". Available modifiers: ctrl, cmd, alt, shift. Common keys: enter, tab, escape, space, up, down, left, right, f1-f12, a-z, 0-9`);
  }

  return result;
}

/**
 * Encode raw RGBA pixel data to PNG using pngjs.
 */
async function encodeRGBAToPNG(
  data: Buffer | Uint8Array,
  width: number,
  height: number,
): Promise<Buffer> {
  // Dynamic import of pngjs
  const { PNG } = await import('pngjs');

  const png = new PNG({ width, height });
  // Copy RGBA data
  const sourceBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  sourceBuffer.copy(png.data, 0, 0, width * height * 4);
  // Encode
  return PNG.sync.write(png);
}

// ============================================================================
// NutTreeDriver
// ============================================================================

export class NutTreeDriver implements IDesktopDriver {
  private _isInitialized = false;
  private _scaleFactor = 1;

  // Lazy-loaded nut-tree modules
  private _nut: any = null;

  // Cache of Window objects keyed by windowHandle, populated by getWindowList()
  private _windowCache = new Map<number, any>();

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  get scaleFactor(): number {
    return this._scaleFactor;
  }

  async initialize(): Promise<void> {
    if (this._isInitialized) return;

    // Dynamic import - fails gracefully if not installed
    try {
      this._nut = await import('@nut-tree-fork/nut-js');
    } catch {
      throw new Error(
        '@nut-tree-fork/nut-js is not installed. Install it to use desktop automation tools:\n' +
        '  npm install @nut-tree-fork/nut-js',
      );
    }

    // Configure mouse and keyboard for speed and precision
    try {
      const { mouse, keyboard } = this._nut;
      if (mouse.config) {
        mouse.config.mouseSpeed = 10000;   // Maximum speed to minimize travel time
        mouse.config.autoDelayMs = 0;      // No delays between mouse actions
      }
      if (keyboard.config) {
        keyboard.config.autoDelayMs = 0;   // No delays between keystrokes (fast typing)
      }
    } catch {
      // Config may not be available in all versions
    }

    // Detect scale factor by comparing logical screen size to screenshot dimensions
    try {
      const { screen } = this._nut;
      const logicalWidth = await screen.width();
      const screenshotImage = await screen.grab();
      const physicalWidth = screenshotImage.width;
      this._scaleFactor = physicalWidth / logicalWidth;
    } catch (err: any) {
      // On macOS, permission errors are common on first use
      if (err.message?.includes('permission') || err.message?.includes('accessibility')) {
        throw new Error(
          'Desktop automation requires accessibility permissions.\n' +
          'On macOS: System Settings → Privacy & Security → Accessibility → Enable your terminal app.',
        );
      }
      // Fall back to scale factor 1 if detection fails
      this._scaleFactor = 1;
    }

    this._isInitialized = true;
  }

  private assertInitialized(): void {
    if (!this._isInitialized) {
      throw new Error('NutTreeDriver not initialized. Call initialize() first.');
    }
  }

  /** Convert physical (screenshot) coords to logical (OS) coords */
  private toLogical(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round(x / this._scaleFactor),
      y: Math.round(y / this._scaleFactor),
    };
  }

  /** Convert logical (OS) coords to physical (screenshot) coords */
  private toPhysical(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.round(x * this._scaleFactor),
      y: Math.round(y * this._scaleFactor),
    };
  }

  // ===== Screen =====

  async screenshot(region?: { x: number; y: number; width: number; height: number }): Promise<DesktopScreenshot> {
    this.assertInitialized();
    const { screen } = this._nut;

    let image: any;
    if (region) {
      const { Region } = this._nut;
      // Convert region from physical to logical coords
      const logTopLeft = this.toLogical(region.x, region.y);
      const logicalWidth = Math.round(region.width / this._scaleFactor);
      const logicalHeight = Math.round(region.height / this._scaleFactor);
      const nutRegion = new Region(logTopLeft.x, logTopLeft.y, logicalWidth, logicalHeight);
      image = await screen.grabRegion(nutRegion);
    } else {
      image = await screen.grab();
    }

    // Encode raw RGBA to PNG
    const pngBuffer = await encodeRGBAToPNG(image.data, image.width, image.height);
    const base64 = pngBuffer.toString('base64');

    return {
      base64,
      width: image.width,
      height: image.height,
    };
  }

  async getScreenSize(): Promise<DesktopScreenSize> {
    this.assertInitialized();
    const { screen } = this._nut;

    const logicalWidth = await screen.width();
    const logicalHeight = await screen.height();

    return {
      physicalWidth: Math.round(logicalWidth * this._scaleFactor),
      physicalHeight: Math.round(logicalHeight * this._scaleFactor),
      logicalWidth,
      logicalHeight,
      scaleFactor: this._scaleFactor,
    };
  }

  // ===== Mouse =====

  async mouseMove(x: number, y: number): Promise<void> {
    this.assertInitialized();
    const { mouse, straightTo, Point } = this._nut;
    const logical = this.toLogical(x, y);
    // Note: mouse.setPosition() is broken in @nut-tree-fork/nut-js (no-ops silently).
    // Use mouse.move(straightTo(...)) instead — with high mouseSpeed it's near-instant.
    await mouse.move(straightTo(new Point(logical.x, logical.y)));
  }

  async mouseClick(x: number, y: number, button: MouseButton, clickCount: number): Promise<void> {
    this.assertInitialized();
    const { mouse, straightTo, Point, Button } = this._nut;

    // Map button
    const nutButton = button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT;

    // Move to target position before clicking
    const logical = this.toLogical(x, y);
    await mouse.move(straightTo(new Point(logical.x, logical.y)));

    // Click the specified number of times
    for (let i = 0; i < clickCount; i++) {
      await mouse.click(nutButton);
    }
  }

  async mouseDrag(startX: number, startY: number, endX: number, endY: number, button: MouseButton): Promise<void> {
    this.assertInitialized();
    const { mouse, straightTo, Point, Button } = this._nut;

    const nutButton = button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT;
    const logicalStart = this.toLogical(startX, startY);
    const logicalEnd = this.toLogical(endX, endY);

    // Move to start, press, drag to end, release
    await mouse.move(straightTo(new Point(logicalStart.x, logicalStart.y)));
    await mouse.pressButton(nutButton);
    await mouse.move(straightTo(new Point(logicalEnd.x, logicalEnd.y)));
    await mouse.releaseButton(nutButton);
  }

  async mouseScroll(deltaX: number, deltaY: number, x?: number, y?: number): Promise<void> {
    this.assertInitialized();
    const { mouse, straightTo, Point } = this._nut;

    // Move to position first if specified
    if (x !== undefined && y !== undefined) {
      const logical = this.toLogical(x, y);
      await mouse.move(straightTo(new Point(logical.x, logical.y)));
    }

    // nut-tree scroll: positive = down, negative = up
    if (deltaY !== 0) {
      if (deltaY > 0) {
        await mouse.scrollDown(Math.abs(deltaY));
      } else {
        await mouse.scrollUp(Math.abs(deltaY));
      }
    }

    if (deltaX !== 0) {
      if (deltaX > 0) {
        await mouse.scrollRight(Math.abs(deltaX));
      } else {
        await mouse.scrollLeft(Math.abs(deltaX));
      }
    }
  }

  async getCursorPosition(): Promise<DesktopPoint> {
    this.assertInitialized();
    const { mouse } = this._nut;

    const pos = await mouse.getPosition();
    // Convert from logical to physical (screenshot) coords
    return this.toPhysical(pos.x, pos.y);
  }

  // ===== Keyboard =====

  async keyboardType(text: string, delay?: number): Promise<void> {
    this.assertInitialized();
    const { keyboard } = this._nut;

    const prevDelay = keyboard.config.autoDelayMs;
    if (delay !== undefined) {
      keyboard.config.autoDelayMs = delay;
    }

    try {
      await keyboard.type(text);
    } finally {
      // Restore default delay if we changed it
      if (delay !== undefined) {
        keyboard.config.autoDelayMs = prevDelay;
      }
    }
  }

  async keyboardKey(keys: string): Promise<void> {
    this.assertInitialized();
    const { keyboard, Key } = this._nut;

    const parsedKeys = parseKeyCombo(keys, Key);

    if (parsedKeys.length === 1) {
      await keyboard.pressKey(parsedKeys[0]);
      await keyboard.releaseKey(parsedKeys[0]);
    } else {
      // Press all keys in order, then release in reverse
      for (const key of parsedKeys) {
        await keyboard.pressKey(key);
      }
      for (const key of [...parsedKeys].reverse()) {
        await keyboard.releaseKey(key);
      }
    }
  }

  // ===== Windows =====

  async getWindowList(): Promise<DesktopWindow[]> {
    this.assertInitialized();
    const { getWindows } = this._nut;

    try {
      const windows = await getWindows();
      const result: DesktopWindow[] = [];
      // Cache window objects by handle for focusWindow() lookup
      this._windowCache.clear();

      for (const win of windows) {
        try {
          // windowHandle is the unique OS window identifier (private in TS, accessible at runtime)
          const handle = (win as any).windowHandle as number;
          if (handle === undefined || handle === null) continue;

          const title = await win.title;
          const region = await win.region;

          this._windowCache.set(handle, win);

          result.push({
            id: handle,
            title: title || '',
            bounds: region ? {
              x: Math.round(region.left * this._scaleFactor),
              y: Math.round(region.top * this._scaleFactor),
              width: Math.round(region.width * this._scaleFactor),
              height: Math.round(region.height * this._scaleFactor),
            } : undefined,
          });
        } catch {
          // Skip windows that can't be queried
        }
      }

      return result;
    } catch {
      // Window listing may not be supported on all platforms
      return [];
    }
  }

  async focusWindow(windowId: number): Promise<void> {
    this.assertInitialized();

    // Try cached window first (from most recent getWindowList call)
    let target = this._windowCache.get(windowId);

    if (!target) {
      // Cache miss — re-fetch windows and find by windowHandle
      const { getWindows } = this._nut;
      const windows = await getWindows();
      target = windows.find((w: any) => (w as any).windowHandle === windowId);
    }

    if (!target) {
      throw new Error(`Window with ID ${windowId} not found. Call desktop_window_list first to get current window IDs.`);
    }

    await target.focus();
  }
}
