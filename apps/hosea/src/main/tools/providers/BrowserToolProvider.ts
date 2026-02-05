/**
 * BrowserToolProvider
 *
 * Provides browser automation tools to the UnifiedToolCatalog.
 * These tools require runtime context (BrowserService, instanceId) so they
 * use the createTool factory pattern.
 */

import type { ToolFunction } from '@everworker/oneringai';
import type {
  IToolProvider,
  UnifiedToolEntry,
  ToolCreationContext,
} from '../UnifiedToolCatalog.js';
import type { BrowserService } from '../../BrowserService.js';
import { createBrowserTools, BROWSER_TOOL_NAMES } from '../../browser/index.js';

/**
 * Browser tool metadata for display in UI
 */
const BROWSER_TOOL_METADATA: Array<{
  name: string;
  displayName: string;
  description: string;
  implemented: boolean;
}> = [
  // Navigation tools
  {
    name: 'browser_navigate',
    displayName: 'Navigate',
    description: 'Navigate to a URL and wait for page load',
    implemented: true,
  },
  {
    name: 'browser_get_state',
    displayName: 'Get State',
    description: 'Get current browser/page state (URL, title, loading, viewport)',
    implemented: true,
  },
  {
    name: 'browser_go_back',
    displayName: 'Go Back',
    description: 'Navigate back in history',
    implemented: true,
  },
  {
    name: 'browser_go_forward',
    displayName: 'Go Forward',
    description: 'Navigate forward in history',
    implemented: true,
  },
  {
    name: 'browser_reload',
    displayName: 'Reload',
    description: 'Reload the current page',
    implemented: true,
  },
  // Interaction tools
  {
    name: 'browser_click',
    displayName: 'Click',
    description: 'Click an element by CSS selector or text content',
    implemented: true,
  },
  {
    name: 'browser_type',
    displayName: 'Type',
    description: 'Type text into an input element with optional delay',
    implemented: true,
  },
  {
    name: 'browser_select',
    displayName: 'Select',
    description: 'Select option(s) from a dropdown by value, label, or index',
    implemented: true,
  },
  {
    name: 'browser_scroll',
    displayName: 'Scroll',
    description: 'Scroll the page or element in any direction',
    implemented: true,
  },
  {
    name: 'browser_wait',
    displayName: 'Wait',
    description: 'Wait for element visibility or custom JS condition',
    implemented: true,
  },
  // Content extraction tools
  {
    name: 'browser_get_content',
    displayName: 'Get Content',
    description: 'Extract page content as markdown, text, html, json, or accessibility tree',
    implemented: true,
  },
  {
    name: 'browser_find_elements',
    displayName: 'Find Elements',
    description: 'Find elements by selector, text, or role with detailed info',
    implemented: true,
  },
  {
    name: 'browser_screenshot',
    displayName: 'Screenshot',
    description: 'Capture screenshot of page or specific element',
    implemented: true,
  },
  {
    name: 'browser_evaluate',
    displayName: 'Evaluate',
    description: 'Execute JavaScript in page context',
    implemented: true,
  },
  // Cookie management tools
  {
    name: 'browser_export_cookies',
    displayName: 'Export Cookies',
    description: 'Export all cookies from the session as JSON',
    implemented: true,
  },
  {
    name: 'browser_import_cookies',
    displayName: 'Import Cookies',
    description: 'Import cookies to restore session or authentication',
    implemented: true,
  },
  {
    name: 'browser_clear_cookies',
    displayName: 'Clear Cookies',
    description: 'Clear all cookies from the browser session',
    implemented: true,
  },
  // Popup/Overlay handling tools
  {
    name: 'browser_detect_overlays',
    displayName: 'Detect Overlays',
    description: 'Detect popups, modals, cookie consent banners, and other overlays',
    implemented: true,
  },
  {
    name: 'browser_dismiss_overlay',
    displayName: 'Dismiss Overlay',
    description: 'Close/dismiss a popup, modal, or cookie consent banner',
    implemented: true,
  },
];

/**
 * Extended context for browser tool creation
 */
export interface BrowserToolCreationContext extends ToolCreationContext {
  browserService: BrowserService;
}

/**
 * Provider for browser automation tools
 */
export class BrowserToolProvider implements IToolProvider {
  readonly name = 'browser';
  readonly source = 'hosea' as const;

  private browserService: BrowserService | null = null;
  private cachedEntries: UnifiedToolEntry[] | null = null;

  constructor(browserService?: BrowserService) {
    this.browserService = browserService || null;
  }

  /**
   * Set the BrowserService (can be set after construction)
   */
  setBrowserService(browserService: BrowserService): void {
    this.browserService = browserService;
    this.cachedEntries = null; // Invalidate cache
  }

  /**
   * Get all browser tools as UnifiedToolEntry
   */
  getTools(): UnifiedToolEntry[] {
    if (this.cachedEntries) {
      return this.cachedEntries;
    }

    const browserService = this.browserService;

    this.cachedEntries = BROWSER_TOOL_METADATA
      .filter((meta) => meta.implemented) // Only show implemented tools
      .map((meta) => ({
        name: meta.name,
        exportName: meta.name.replace(/_/g, ''),
        displayName: meta.displayName,
        category: 'browser' as const,
        categoryDisplayName: 'Browser Automation',
        description: meta.description,
        safeByDefault: false, // Browser tools require approval
        source: 'hosea' as const,
        // Factory function - creates tool at runtime with context
        // NOTE: Dynamic UI emission is handled by HoseaUIPlugin via the execution pipeline
        createTool: (ctx: ToolCreationContext): ToolFunction => {
          if (!browserService) {
            throw new Error(
              'BrowserService not available - cannot create browser tools'
            );
          }
          // Create all browser tools and find the one we need
          const tools = createBrowserTools(browserService, () => ctx.instanceId);
          const tool = tools.find(
            (t) => t.definition.function.name === meta.name
          );
          if (!tool) {
            throw new Error(`Browser tool '${meta.name}' not found in factory`);
          }
          return tool;
        },
      }));

    return this.cachedEntries;
  }

  /**
   * Get a specific tool by name
   */
  getToolByName(name: string): UnifiedToolEntry | undefined {
    return this.getTools().find((entry) => entry.name === name);
  }

  /**
   * Get all browser tool names (including not-yet-implemented)
   */
  getAllBrowserToolNames(): readonly string[] {
    return BROWSER_TOOL_NAMES;
  }

  /**
   * Check if BrowserService is available
   */
  hasBrowserService(): boolean {
    return this.browserService !== null;
  }

  /**
   * Invalidate the cache
   */
  invalidateCache(): void {
    this.cachedEntries = null;
  }
}
