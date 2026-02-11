/**
 * Desktop Automation Tools - Types
 *
 * Interfaces and types for OS-level desktop automation (screenshot, mouse, keyboard, windows).
 * All coordinates are in PHYSICAL pixel space (screenshot space).
 * The driver converts to logical OS coords internally using scaleFactor.
 */

// ============================================================================
// Core Types
// ============================================================================

export type MouseButton = 'left' | 'right' | 'middle';

export interface DesktopPoint {
  x: number;
  y: number;
}

export interface DesktopScreenSize {
  /** Physical pixel width (screenshot space) */
  physicalWidth: number;
  /** Physical pixel height (screenshot space) */
  physicalHeight: number;
  /** Logical OS width */
  logicalWidth: number;
  /** Logical OS height */
  logicalHeight: number;
  /** Scale factor (physical / logical), e.g. 2.0 on Retina */
  scaleFactor: number;
}

export interface DesktopScreenshot {
  /** Base64-encoded PNG image data */
  base64: string;
  /** Width in physical pixels */
  width: number;
  /** Height in physical pixels */
  height: number;
}

export interface DesktopWindow {
  /** Window identifier (platform-specific) */
  id: number;
  /** Window title */
  title: string;
  /** Application name */
  appName?: string;
  /** Window bounds in physical pixel coords */
  bounds?: { x: number; y: number; width: number; height: number };
}

// ============================================================================
// Driver Interface
// ============================================================================

export interface IDesktopDriver {
  /** Initialize the driver (dynamic import, permission checks, scale detection) */
  initialize(): Promise<void>;

  /** Whether the driver is initialized */
  readonly isInitialized: boolean;

  /** Current scale factor (physical / logical) */
  readonly scaleFactor: number;

  // Screen
  screenshot(region?: { x: number; y: number; width: number; height: number }): Promise<DesktopScreenshot>;
  getScreenSize(): Promise<DesktopScreenSize>;

  // Mouse (all coords in physical pixels)
  mouseMove(x: number, y: number): Promise<void>;
  mouseClick(x: number, y: number, button: MouseButton, clickCount: number): Promise<void>;
  mouseDrag(startX: number, startY: number, endX: number, endY: number, button: MouseButton): Promise<void>;
  mouseScroll(deltaX: number, deltaY: number, x?: number, y?: number): Promise<void>;
  getCursorPosition(): Promise<DesktopPoint>;

  // Keyboard
  keyboardType(text: string, delay?: number): Promise<void>;
  keyboardKey(keys: string): Promise<void>;

  // Windows
  getWindowList(): Promise<DesktopWindow[]>;
  focusWindow(windowId: number): Promise<void>;
}

// ============================================================================
// Tool Configuration
// ============================================================================

export interface DesktopToolConfig {
  /** Custom driver implementation (defaults to NutTreeDriver) */
  driver?: IDesktopDriver;

  /**
   * Human-like delay range in ms added between actions.
   * Set to [0, 0] for instant actions.
   * Default: [50, 150]
   */
  humanDelay?: [number, number];

  /**
   * Whether to humanize mouse movements (curved path vs instant teleport).
   * Default: false
   */
  humanizeMovement?: boolean;
}

export const DEFAULT_DESKTOP_CONFIG: Required<DesktopToolConfig> = {
  driver: null as unknown as IDesktopDriver, // Lazy-initialized
  humanDelay: [50, 150],
  humanizeMovement: false,
};

/**
 * Apply a random human-like delay based on config.
 */
export async function applyHumanDelay(config: DesktopToolConfig): Promise<void> {
  const [min, max] = config.humanDelay ?? DEFAULT_DESKTOP_CONFIG.humanDelay;
  if (min === 0 && max === 0) return;
  const delay = min + Math.random() * (max - min);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

// ============================================================================
// Tool Arg/Result Interfaces
// ============================================================================

// --- Screenshot ---
export interface DesktopScreenshotArgs {
  region?: { x: number; y: number; width: number; height: number };
}

export interface DesktopScreenshotResult {
  success: boolean;
  width?: number;
  height?: number;
  /** Base64 PNG for text summary */
  base64?: string;
  /** Image array for multimodal provider handling */
  __images?: Array<{ base64: string; mediaType: string }>;
  error?: string;
}

// --- Mouse Move ---
export interface DesktopMouseMoveArgs {
  x: number;
  y: number;
}

export interface DesktopMouseMoveResult {
  success: boolean;
  x?: number;
  y?: number;
  error?: string;
}

// --- Mouse Click ---
export interface DesktopMouseClickArgs {
  x?: number;
  y?: number;
  button?: MouseButton;
  clickCount?: number;
}

export interface DesktopMouseClickResult {
  success: boolean;
  x?: number;
  y?: number;
  button?: MouseButton;
  clickCount?: number;
  error?: string;
}

// --- Mouse Drag ---
export interface DesktopMouseDragArgs {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  button?: MouseButton;
}

export interface DesktopMouseDragResult {
  success: boolean;
  error?: string;
}

// --- Mouse Scroll ---
export interface DesktopMouseScrollArgs {
  deltaX?: number;
  deltaY?: number;
  x?: number;
  y?: number;
}

export interface DesktopMouseScrollResult {
  success: boolean;
  error?: string;
}

// --- Get Cursor ---
export interface DesktopGetCursorResult {
  success: boolean;
  x?: number;
  y?: number;
  error?: string;
}

// --- Keyboard Type ---
export interface DesktopKeyboardTypeArgs {
  text: string;
  delay?: number;
}

export interface DesktopKeyboardTypeResult {
  success: boolean;
  error?: string;
}

// --- Keyboard Key ---
export interface DesktopKeyboardKeyArgs {
  keys: string;
}

export interface DesktopKeyboardKeyResult {
  success: boolean;
  error?: string;
}

// --- Get Screen Size ---
export interface DesktopGetScreenSizeResult {
  success: boolean;
  physicalWidth?: number;
  physicalHeight?: number;
  logicalWidth?: number;
  logicalHeight?: number;
  scaleFactor?: number;
  error?: string;
}

// --- Window List ---
export interface DesktopWindowListResult {
  success: boolean;
  windows?: DesktopWindow[];
  error?: string;
}

// --- Window Focus ---
export interface DesktopWindowFocusArgs {
  windowId: number;
}

export interface DesktopWindowFocusResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// Tool Name Constants
// ============================================================================

export const DESKTOP_TOOL_NAMES = [
  'desktop_screenshot',
  'desktop_mouse_move',
  'desktop_mouse_click',
  'desktop_mouse_drag',
  'desktop_mouse_scroll',
  'desktop_get_cursor',
  'desktop_keyboard_type',
  'desktop_keyboard_key',
  'desktop_get_screen_size',
  'desktop_window_list',
  'desktop_window_focus',
] as const;

export type DesktopToolName = (typeof DESKTOP_TOOL_NAMES)[number];
