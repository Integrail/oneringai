/**
 * Hosea Tool Registration
 *
 * Registers Hosea-specific tool categories (browser, desktop) with the core
 * ToolCatalogRegistry at app startup. Replaces the old provider-based
 * UnifiedToolCatalog architecture.
 */

import { ToolCatalogRegistry, desktopTools } from '@everworker/oneringai';
import type { CatalogToolEntry, ToolFunction } from '@everworker/oneringai';
import type { BrowserService } from '../BrowserService.js';
import { createBrowserTools } from '../browser/index.js';

// ============================================================================
// Browser Tool Metadata
// ============================================================================

const BROWSER_TOOL_METADATA: Array<{
  name: string;
  displayName: string;
  description: string;
  implemented: boolean;
}> = [
  // Navigation tools
  { name: 'browser_navigate', displayName: 'Navigate', description: 'Navigate to a URL and wait for page load', implemented: true },
  { name: 'browser_get_state', displayName: 'Get State', description: 'Get current browser/page state (URL, title, loading, viewport)', implemented: true },
  { name: 'browser_go_back', displayName: 'Go Back', description: 'Navigate back in history', implemented: true },
  { name: 'browser_go_forward', displayName: 'Go Forward', description: 'Navigate forward in history', implemented: true },
  { name: 'browser_reload', displayName: 'Reload', description: 'Reload the current page', implemented: true },
  // Interaction tools
  { name: 'browser_click', displayName: 'Click', description: 'Click an element by CSS selector or text content', implemented: true },
  { name: 'browser_type', displayName: 'Type', description: 'Type text into an input element with optional delay', implemented: true },
  { name: 'browser_select', displayName: 'Select', description: 'Select option(s) from a dropdown by value, label, or index', implemented: true },
  { name: 'browser_scroll', displayName: 'Scroll', description: 'Scroll the page or element in any direction', implemented: true },
  { name: 'browser_wait', displayName: 'Wait', description: 'Wait for element visibility or custom JS condition', implemented: true },
  // Content extraction tools
  { name: 'browser_get_content', displayName: 'Get Content', description: 'Extract page content as markdown, text, html, json, or accessibility tree', implemented: true },
  { name: 'browser_find_elements', displayName: 'Find Elements', description: 'Find elements by selector, text, or role with detailed info', implemented: true },
  { name: 'browser_screenshot', displayName: 'Screenshot', description: 'Capture screenshot of page or specific element', implemented: true },
  { name: 'browser_evaluate', displayName: 'Evaluate', description: 'Execute JavaScript in page context', implemented: true },
  // Cookie management tools
  { name: 'browser_export_cookies', displayName: 'Export Cookies', description: 'Export all cookies from the session as JSON', implemented: true },
  { name: 'browser_import_cookies', displayName: 'Import Cookies', description: 'Import cookies to restore session or authentication', implemented: true },
  { name: 'browser_clear_cookies', displayName: 'Clear Cookies', description: 'Clear all cookies from the browser session', implemented: true },
  // Popup/Overlay handling tools
  { name: 'browser_detect_overlays', displayName: 'Detect Overlays', description: 'Detect popups, modals, cookie consent banners, and other overlays', implemented: true },
  { name: 'browser_dismiss_overlay', displayName: 'Dismiss Overlay', description: 'Close/dismiss a popup, modal, or cookie consent banner', implemented: true },
];

// ============================================================================
// Desktop Tool Metadata
// ============================================================================

const DESKTOP_TOOL_METADATA: Array<{
  name: string;
  displayName: string;
  description: string;
}> = [
  { name: 'desktop_screenshot', displayName: 'Screenshot', description: 'Capture a screenshot of the entire screen or a specific region' },
  { name: 'desktop_mouse_move', displayName: 'Mouse Move', description: 'Move the mouse cursor to a position on screen' },
  { name: 'desktop_mouse_click', displayName: 'Mouse Click', description: 'Click the mouse at a position (left/right/middle, single/double)' },
  { name: 'desktop_mouse_drag', displayName: 'Mouse Drag', description: 'Drag from one position to another' },
  { name: 'desktop_mouse_scroll', displayName: 'Mouse Scroll', description: 'Scroll the mouse wheel (up/down/left/right)' },
  { name: 'desktop_get_cursor', displayName: 'Get Cursor', description: 'Get the current mouse cursor position' },
  { name: 'desktop_keyboard_type', displayName: 'Keyboard Type', description: 'Type text using the keyboard' },
  { name: 'desktop_keyboard_key', displayName: 'Keyboard Key', description: 'Press keyboard shortcuts or special keys (e.g., ctrl+c, enter)' },
  { name: 'desktop_get_screen_size', displayName: 'Screen Size', description: 'Get screen dimensions and scale factor' },
  { name: 'desktop_window_list', displayName: 'Window List', description: 'List all visible windows with IDs and titles' },
  { name: 'desktop_window_focus', displayName: 'Window Focus', description: 'Bring a specific window to the foreground' },
];

// ============================================================================
// Registration Functions
// ============================================================================

/** Mutable reference to current browser service for factory closures */
let _browserService: BrowserService | null = null;

/**
 * Register Hosea-specific tool categories with ToolCatalogRegistry.
 *
 * Call this at app startup (in AgentService constructor). Browser tools use
 * factories since they need a BrowserService instance at runtime.
 *
 * @param browserService - Optional browser service (can be set later via updateBrowserService)
 */
export function registerHoseaTools(browserService?: BrowserService): void {
  if (browserService) {
    _browserService = browserService;
  }

  // ---- Browser category ----
  ToolCatalogRegistry.registerCategory({
    name: 'browser',
    displayName: 'Browser Automation',
    description: 'Navigate, interact, extract content from web pages',
  });

  const browserEntries: CatalogToolEntry[] = BROWSER_TOOL_METADATA
    .filter(m => m.implemented)
    .map(meta => ({
      name: meta.name,
      displayName: meta.displayName,
      description: meta.description,
      safeByDefault: false,
      source: 'hosea',
      createTool: (ctx: Record<string, unknown>): ToolFunction => {
        if (!_browserService) {
          throw new Error('BrowserService not available - cannot create browser tools');
        }
        const tools = createBrowserTools(_browserService, () => ctx.instanceId as string);
        const tool = tools.find(t => t.definition.function.name === meta.name);
        if (!tool) {
          throw new Error(`Browser tool '${meta.name}' not found in factory`);
        }
        return tool;
      },
    }));
  ToolCatalogRegistry.registerTools('browser', browserEntries);

  // ---- Desktop category ----
  ToolCatalogRegistry.registerCategory({
    name: 'desktop',
    displayName: 'Desktop Automation',
    description: 'Screenshot, mouse, keyboard, and window automation',
  });

  const desktopEntries: CatalogToolEntry[] = DESKTOP_TOOL_METADATA.map(meta => {
    const tool = desktopTools.find(t => t.definition.function.name === meta.name);
    return {
      tool,
      name: meta.name,
      displayName: meta.displayName,
      description: meta.description,
      safeByDefault: false,
      source: 'hosea',
    };
  });
  ToolCatalogRegistry.registerTools('desktop', desktopEntries);
}

/**
 * Update the BrowserService reference used by browser tool factories.
 * Call this when BrowserService becomes available after initial registration.
 */
export function updateBrowserService(browserService: BrowserService): void {
  _browserService = browserService;
}

/**
 * Invalidate and re-register all Hosea tools.
 * Call this after connector changes to refresh the catalog.
 */
export function invalidateHoseaTools(): void {
  // Remove Hosea categories so they can be re-registered fresh
  ToolCatalogRegistry.unregisterCategory('browser');
  ToolCatalogRegistry.unregisterCategory('desktop');
  // Re-register with current browser service
  registerHoseaTools();
}
