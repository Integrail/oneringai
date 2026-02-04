/**
 * Browser Stealth Configuration
 *
 * Anti-bot bypass techniques for Electron browser automation.
 * These scripts help avoid detection by bot-detection services like
 * Cloudflare, PerimeterX, DataDome, etc.
 */

// ============ Configuration Types ============

export interface StealthConfig {
  /** Enable stealth mode (default: true) */
  enabled: boolean;
  /** Custom user agent (null = use realistic default) */
  userAgent: string | null;
  /** Platform to emulate */
  platform: 'Windows' | 'macOS' | 'Linux';
  /** Accept-Language header value */
  acceptLanguage: string;
  /** WebGL fingerprint spoofing */
  webgl: {
    vendor: string;
    renderer: string;
  };
  /** Timezone to spoof (IANA format, e.g., 'America/New_York') */
  timezone?: string;
  /** Screen dimensions to spoof */
  screen?: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
  };
}

// ============ Default Configuration ============

export const DEFAULT_STEALTH_CONFIG: StealthConfig = {
  enabled: true,
  userAgent: null, // Will use realistic default
  platform: 'macOS',
  acceptLanguage: 'en-US,en;q=0.9',
  webgl: {
    vendor: 'Intel Inc.',
    renderer: 'Intel Iris Pro OpenGL Engine',
  },
  screen: {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1055,
    colorDepth: 24,
    pixelDepth: 24,
  },
};

// ============ Realistic User Agents ============

const USER_AGENTS: Record<StealthConfig['platform'], string[]> = {
  Windows: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ],
  macOS: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ],
  Linux: [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ],
};

// ============ WebGL Fingerprints ============

const WEBGL_FINGERPRINTS: Record<StealthConfig['platform'], Array<{ vendor: string; renderer: string }>> = {
  Windows: [
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  ],
  macOS: [
    { vendor: 'Intel Inc.', renderer: 'Intel Iris Pro OpenGL Engine' },
    { vendor: 'Apple Inc.', renderer: 'Apple M1 Pro' },
    { vendor: 'Apple Inc.', renderer: 'Apple M2' },
    { vendor: 'Intel Inc.', renderer: 'Intel(R) UHD Graphics 630' },
  ],
  Linux: [
    { vendor: 'Intel', renderer: 'Mesa Intel(R) UHD Graphics 630 (CFL GT2)' },
    { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce GTX 1080/PCIe/SSE2' },
    { vendor: 'AMD', renderer: 'AMD Radeon RX 580 (POLARIS10 / DRM 3.40.0 / 5.8.0-43-generic, LLVM 11.0.0)' },
  ],
};

// ============ Helper Functions ============

/**
 * Get a realistic user agent for the specified platform
 */
export function getRealisticUserAgent(platform: StealthConfig['platform']): string {
  const agents = USER_AGENTS[platform];
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Get a realistic WebGL fingerprint for the specified platform
 */
export function getRealisticWebGLFingerprint(platform: StealthConfig['platform']): { vendor: string; renderer: string } {
  const fingerprints = WEBGL_FINGERPRINTS[platform];
  return fingerprints[Math.floor(Math.random() * fingerprints.length)];
}

/**
 * Get Sec-CH-UA headers for modern Chrome
 */
export function getSecChUaHeaders(userAgent: string): Record<string, string> {
  // Extract Chrome version from user agent
  const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
  const chromeVersion = chromeMatch ? chromeMatch[1] : '122';

  return {
    'Sec-CH-UA': `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not-A.Brand";v="99"`,
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': userAgent.includes('Windows')
      ? '"Windows"'
      : userAgent.includes('Mac')
        ? '"macOS"'
        : '"Linux"',
  };
}

// ============ Stealth Script Generation ============

/**
 * Generate the stealth injection script
 * This script should be injected into every page via dom-ready event
 */
export function getStealthScript(config: StealthConfig): string {
  const webglVendor = config.webgl.vendor;
  const webglRenderer = config.webgl.renderer;
  const screen = config.screen || DEFAULT_STEALTH_CONFIG.screen!;

  return `
(function() {
  'use strict';

  // ========== 1. Navigator.webdriver ==========
  // Most basic bot detection - webdriver property
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  } catch(e) {}

  // Delete the property entirely if possible
  try {
    delete Object.getPrototypeOf(navigator).webdriver;
  } catch(e) {}

  // ========== 2. Chrome Runtime Object ==========
  // Headless Chrome detection often checks for window.chrome
  if (!window.chrome) {
    window.chrome = {};
  }
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: function() { return { onMessage: { addListener: function() {} }, postMessage: function() {} }; },
      sendMessage: function() {},
      onMessage: { addListener: function() {} },
      id: undefined
    };
  }

  // ========== 3. Navigator.plugins ==========
  // Real browsers have plugins, headless doesn't
  const makePluginArray = () => {
    const plugins = [
      { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
      { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', length: 1 },
      { name: 'Native Client', description: '', filename: 'internal-nacl-plugin', length: 2 },
      { name: 'Chromium PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1 },
      { name: 'Chromium PDF Viewer', description: '', filename: 'internal-pdf-viewer', length: 1 }
    ];

    const pluginArray = Object.create(PluginArray.prototype);
    plugins.forEach((p, i) => {
      const plugin = Object.create(Plugin.prototype);
      Object.defineProperties(plugin, {
        name: { value: p.name },
        description: { value: p.description },
        filename: { value: p.filename },
        length: { value: p.length }
      });
      pluginArray[i] = plugin;
      pluginArray[p.name] = plugin;
    });

    Object.defineProperty(pluginArray, 'length', { value: plugins.length });
    Object.defineProperty(pluginArray, 'item', { value: (i) => pluginArray[i] || null });
    Object.defineProperty(pluginArray, 'namedItem', { value: (n) => pluginArray[n] || null });
    Object.defineProperty(pluginArray, 'refresh', { value: () => {} });

    return pluginArray;
  };

  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => makePluginArray(),
      configurable: true
    });
  } catch(e) {}

  // ========== 4. Navigator.languages ==========
  try {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true
    });
  } catch(e) {}

  // ========== 5. WebGL Fingerprint ==========
  const getParameterProxyHandler = {
    apply: function(target, thisArg, argumentsList) {
      const param = argumentsList[0];
      const result = target.apply(thisArg, argumentsList);

      // UNMASKED_VENDOR_WEBGL
      if (param === 37445) {
        return '${webglVendor}';
      }
      // UNMASKED_RENDERER_WEBGL
      if (param === 37446) {
        return '${webglRenderer}';
      }
      return result;
    }
  };

  try {
    // Override for WebGL1
    const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = new Proxy(getParameterOrig, getParameterProxyHandler);

    // Override for WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameterOrig2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = new Proxy(getParameterOrig2, getParameterProxyHandler);
    }
  } catch(e) {}

  // ========== 6. Permissions API ==========
  // Some sites check permission states
  try {
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: 'prompt', onchange: null });
      }
      return originalQuery.call(window.navigator.permissions, parameters);
    };
  } catch(e) {}

  // ========== 7. Console.debug Trap ==========
  // Some detection scripts use console.debug
  try {
    const originalDebug = console.debug;
    console.debug = function() {
      // Check if being called for detection
      if (arguments[0] && typeof arguments[0] === 'string' &&
          (arguments[0].includes('webdriver') || arguments[0].includes('selenium'))) {
        return;
      }
      return originalDebug.apply(console, arguments);
    };
  } catch(e) {}

  // ========== 8. Screen Properties ==========
  try {
    Object.defineProperty(screen, 'width', { get: () => ${screen.width} });
    Object.defineProperty(screen, 'height', { get: () => ${screen.height} });
    Object.defineProperty(screen, 'availWidth', { get: () => ${screen.availWidth} });
    Object.defineProperty(screen, 'availHeight', { get: () => ${screen.availHeight} });
    Object.defineProperty(screen, 'colorDepth', { get: () => ${screen.colorDepth} });
    Object.defineProperty(screen, 'pixelDepth', { get: () => ${screen.pixelDepth} });
  } catch(e) {}

  // ========== 9. Remove Electron Artifacts ==========
  try {
    delete window.process;
    delete window.require;
    delete window.__dirname;
    delete window.__filename;
    delete window.module;
    delete window.exports;
    delete window.Buffer;
  } catch(e) {}

  // Remove from navigator
  try {
    delete navigator.userAgentData;  // Can reveal Electron
  } catch(e) {}

  // ========== 10. Hardware Concurrency ==========
  // Realistic CPU cores
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
      configurable: true
    });
  } catch(e) {}

  // ========== 11. Device Memory ==========
  try {
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
      configurable: true
    });
  } catch(e) {}

  // ========== 12. Connection Type ==========
  try {
    if (navigator.connection) {
      Object.defineProperty(navigator.connection, 'rtt', { get: () => 50 });
      Object.defineProperty(navigator.connection, 'downlink', { get: () => 10 });
      Object.defineProperty(navigator.connection, 'effectiveType', { get: () => '4g' });
    }
  } catch(e) {}

  // ========== 13. Battery API ==========
  // Return realistic battery
  try {
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null
      });
    }
  } catch(e) {}

  // ========== 14. Notification Permission ==========
  try {
    Object.defineProperty(Notification, 'permission', {
      get: () => 'default',
      configurable: true
    });
  } catch(e) {}

  // ========== 15. iframe contentWindow ==========
  // Some detection creates an iframe and checks properties
  const originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
  if (originalContentWindow) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get: function() {
        const win = originalContentWindow.get.call(this);
        if (win) {
          try {
            Object.defineProperty(win.navigator, 'webdriver', {
              get: () => undefined
            });
          } catch(e) {}
        }
        return win;
      }
    });
  }

  // ========== 16. Automation Flags ==========
  // Various automation detection properties
  try {
    Object.defineProperty(navigator, 'automationController', { get: () => undefined });
    Object.defineProperty(document, '$cdc_asdjflasutopfhvcZLmcfl_', { get: () => undefined });
    Object.defineProperty(document, '$chrome_asyncScriptInfo', { get: () => undefined });
    Object.defineProperty(document, '$wdc_', { get: () => undefined });
  } catch(e) {}

  // ========== 17. Function.prototype.toString ==========
  // Prevent detection of modified native functions
  const nativeToString = Function.prototype.toString;
  const proxyToString = new Proxy(nativeToString, {
    apply: function(target, thisArg, argumentsList) {
      // Return native function string for our proxied functions
      if (thisArg === navigator.permissions.query) {
        return 'function query() { [native code] }';
      }
      if (thisArg === navigator.getBattery) {
        return 'function getBattery() { [native code] }';
      }
      return target.apply(thisArg, argumentsList);
    }
  });
  Function.prototype.toString = proxyToString;

  console.log('[Stealth] Anti-bot protections applied');
})();
`;
}

/**
 * Get HTTP headers to add/modify for anti-detection
 */
export function getStealthHeaders(config: StealthConfig): Record<string, string> {
  const userAgent = config.userAgent || getRealisticUserAgent(config.platform);
  const secChUaHeaders = getSecChUaHeaders(userAgent);

  return {
    'Accept-Language': config.acceptLanguage,
    ...secChUaHeaders,
  };
}

/**
 * Get list of headers to remove (Electron-specific headers)
 */
export function getHeadersToRemove(): string[] {
  return ['X-Electron-App', 'X-Electron-Version', 'X-Electron-Renderer'];
}
