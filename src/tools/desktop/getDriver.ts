/**
 * Lazy singleton driver accessor for desktop tools.
 *
 * First call initializes the driver (dynamic import + scale detection).
 * Subsequent calls reuse the same instance.
 */

import type { IDesktopDriver } from './types.js';
import type { DesktopToolConfig } from './types.js';
import { NutTreeDriver } from './driver/NutTreeDriver.js';

let defaultDriver: IDesktopDriver | null = null;

/**
 * Get (or create) the desktop driver instance.
 * If config.driver is provided, uses that instead of the default.
 */
export async function getDesktopDriver(config?: DesktopToolConfig): Promise<IDesktopDriver> {
  // Custom driver takes precedence
  if (config?.driver) {
    if (!config.driver.isInitialized) {
      await config.driver.initialize();
    }
    return config.driver;
  }

  // Lazy-init default driver
  if (!defaultDriver) {
    defaultDriver = new NutTreeDriver();
  }

  if (!defaultDriver.isInitialized) {
    await defaultDriver.initialize();
  }

  return defaultDriver;
}

/**
 * Reset the default driver (for testing).
 */
export function resetDefaultDriver(): void {
  defaultDriver = null;
}
