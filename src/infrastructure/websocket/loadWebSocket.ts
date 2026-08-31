/**
 * Load `ws` without its optional native buffer accelerator.
 *
 * Some application bundlers replace an unresolved optional `bufferutil`
 * import with a truthy module stub. `ws` then selects that stub for masking
 * client frames and crashes on the first payload of 48 bytes or more because
 * the stub has no `mask()` function. The pure-JavaScript implementation is
 * always available and is the portable choice for a library transport.
 */
let webSocketModulePromise: Promise<typeof import('ws')> | null = null;

export function loadWebSocketModule(): Promise<typeof import('ws')> {
  if (!webSocketModulePromise) {
    webSocketModulePromise = loadPortableWebSocketModule().catch((error) => {
      webSocketModulePromise = null;
      throw error;
    });
  }
  return webSocketModulePromise;
}

async function loadPortableWebSocketModule(): Promise<typeof import('ws')> {
  const previous = process.env.WS_NO_BUFFER_UTIL;
  process.env.WS_NO_BUFFER_UTIL = '1';
  try {
    return await import('ws' as string) as typeof import('ws');
  } finally {
    if (previous === undefined) delete process.env.WS_NO_BUFFER_UTIL;
    else process.env.WS_NO_BUFFER_UTIL = previous;
  }
}
