/**
 * DesktopToolProvider
 *
 * Provides OS-level desktop automation tools to the UnifiedToolCatalog.
 * These are static tools (no runtime context needed) from @everworker/oneringai.
 */

import { desktopTools, DESKTOP_TOOL_NAMES } from '@everworker/oneringai';
import type { IToolProvider, UnifiedToolEntry } from '../UnifiedToolCatalog.js';

/**
 * Desktop tool metadata for display in UI
 */
const DESKTOP_TOOL_METADATA: Array<{
  name: string;
  displayName: string;
  description: string;
}> = [
  {
    name: 'desktop_screenshot',
    displayName: 'Screenshot',
    description: 'Capture a screenshot of the entire screen or a specific region',
  },
  {
    name: 'desktop_mouse_move',
    displayName: 'Mouse Move',
    description: 'Move the mouse cursor to a position on screen',
  },
  {
    name: 'desktop_mouse_click',
    displayName: 'Mouse Click',
    description: 'Click the mouse at a position (left/right/middle, single/double)',
  },
  {
    name: 'desktop_mouse_drag',
    displayName: 'Mouse Drag',
    description: 'Drag from one position to another',
  },
  {
    name: 'desktop_mouse_scroll',
    displayName: 'Mouse Scroll',
    description: 'Scroll the mouse wheel (up/down/left/right)',
  },
  {
    name: 'desktop_get_cursor',
    displayName: 'Get Cursor',
    description: 'Get the current mouse cursor position',
  },
  {
    name: 'desktop_keyboard_type',
    displayName: 'Keyboard Type',
    description: 'Type text using the keyboard',
  },
  {
    name: 'desktop_keyboard_key',
    displayName: 'Keyboard Key',
    description: 'Press keyboard shortcuts or special keys (e.g., ctrl+c, enter)',
  },
  {
    name: 'desktop_get_screen_size',
    displayName: 'Screen Size',
    description: 'Get screen dimensions and scale factor',
  },
  {
    name: 'desktop_window_list',
    displayName: 'Window List',
    description: 'List all visible windows with IDs and titles',
  },
  {
    name: 'desktop_window_focus',
    displayName: 'Window Focus',
    description: 'Bring a specific window to the foreground',
  },
];

/**
 * Provider for OS-level desktop automation tools
 */
export class DesktopToolProvider implements IToolProvider {
  readonly name = 'desktop';
  readonly source = 'hosea' as const;

  private cachedEntries: UnifiedToolEntry[] | null = null;

  getTools(): UnifiedToolEntry[] {
    if (this.cachedEntries) {
      return this.cachedEntries;
    }

    this.cachedEntries = DESKTOP_TOOL_METADATA.map((meta) => {
      // Find the matching tool instance from the desktopTools bundle
      const tool = desktopTools.find(
        (t) => t.definition.function.name === meta.name,
      );

      return {
        name: meta.name,
        exportName: meta.name.replace(/_/g, ''),
        displayName: meta.displayName,
        category: 'desktop' as const,
        categoryDisplayName: 'Desktop Automation',
        description: meta.description,
        safeByDefault: false, // Desktop tools require approval
        source: 'hosea' as const,
        tool, // Direct reference - these are static tools
      };
    });

    return this.cachedEntries;
  }

  getToolByName(name: string): UnifiedToolEntry | undefined {
    return this.getTools().find((entry) => entry.name === name);
  }

  /**
   * Get all desktop tool names
   */
  getAllDesktopToolNames(): readonly string[] {
    return DESKTOP_TOOL_NAMES;
  }

  /**
   * Invalidate the cache
   */
  invalidateCache(): void {
    this.cachedEntries = null;
  }
}
