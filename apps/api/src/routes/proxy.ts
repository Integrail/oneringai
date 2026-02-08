/**
 * Proxy route — ALL /proxy/:serviceId/*
 *
 * Flow:
 * 1. JWT auth → get userId
 * 2. Resolve service from registry
 * 3. Determine credential (platform key, specific, or default)
 * 4. Decrypt credential
 * 5. Check balance
 * 6. Build target URL
 * 7. Inject auth
 * 8. Forward request
 * 9. Handle response (streaming or buffered)
 * 10. Extract usage, deduct tokens, log
 */
import { Hono } from 'hono';
import type { Env } from '../env.js';
import { requireAuth } from '../middleware/jwt.js';
import { checkBalance } from '../middleware/balanceCheck.js';
import { resolveService } from '../services/serviceRegistry.js';
import { decryptCredential, getDefaultCredential } from './credentials.js';
import { buildTargetURL } from '../proxy/router.js';
import { injectAuth } from '../proxy/authInjector.js';
import { createSSEPassthrough } from '../proxy/streamHandler.js';
import { extractUsageFromJSON } from '../proxy/usageExtractor.js';
import { calculateTokenCost, calculateFlatCost, recordUsage } from '../services/metering.js';

const proxy = new Hono<{ Bindings: Env }>();

proxy.use('*', requireAuth);
proxy.use('*', checkBalance);

/**
 * ALL /proxy/:serviceId/*
 * Matches any method (GET, POST, PUT, DELETE, etc.)
 */
proxy.all('/:serviceId{.+?}/*', async (c) => {
  const userId = c.get('userId');
  const serviceId = c.req.param('serviceId');
  const startTime = Date.now();

  // 1. Resolve service
  const service = await resolveService(c.env.DB, serviceId, userId);
  if (!service) {
    return c.json({ error: 'not_found', message: `Service '${serviceId}' not found` }, 404);
  }

  // 2. Determine credential
  let apiKey: string | null = null;
  let credentialType: 'platform' | 'user' | 'custom' = 'user';

  const usePlatformKey = c.req.header('X-Use-Platform-Key') === 'true';
  const credentialId = c.req.header('X-Credential-Id');

  if (usePlatformKey && service.platformKeyEnabled) {
    // Platform key from KV
    apiKey = await c.env.KV.get(`platform_key:${serviceId}`);
    credentialType = 'platform';
  } else if (credentialId) {
    // Specific credential
    apiKey = await decryptCredential(c.env.DB, credentialId, userId, c.env.ENCRYPTION_KEY);
    credentialType = 'user';
  } else {
    // Default credential for service
    apiKey = await getDefaultCredential(c.env.DB, userId, serviceId, c.env.ENCRYPTION_KEY);
    credentialType = 'user';
  }

  if (!apiKey) {
    return c.json(
      {
        error: 'no_credential',
        message: `No API key found for service '${serviceId}'. Add one via POST /credentials.`,
      },
      401,
    );
  }

  // 3. Build target URL
  // Extract remaining path after /proxy/:serviceId/
  const url = new URL(c.req.url);
  const proxyPrefix = `/proxy/${serviceId}`;
  const remainingPath = url.pathname.slice(proxyPrefix.length);
  const targetURL = buildTargetURL(service, remainingPath, url.search.slice(1));

  // 4. Inject auth
  const auth = injectAuth(service.authType, apiKey, service.authConfig);

  // If query params from auth injection, append to URL
  let finalURL = targetURL;
  if (auth.queryParams) {
    const sep = finalURL.includes('?') ? '&' : '?';
    const qs = new URLSearchParams(auth.queryParams).toString();
    finalURL = `${finalURL}${sep}${qs}`;
  }

  // 5. Build outgoing request
  const requestHeaders = new Headers();

  // Forward relevant headers
  const contentType = c.req.header('Content-Type');
  if (contentType) requestHeaders.set('Content-Type', contentType);
  const accept = c.req.header('Accept');
  if (accept) requestHeaders.set('Accept', accept);

  // Inject auth headers
  for (const [key, value] of Object.entries(auth.headers)) {
    requestHeaders.set(key, value);
  }

  // Forward body for non-GET requests
  let body: BodyInit | null = null;
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    body = c.req.raw.body;
  }

  // 6. Forward request
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(finalURL, {
      method: c.req.method,
      headers: requestHeaders,
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream request failed';
    return c.json({ error: 'upstream_error', message }, 502);
  }

  const latencyMs = Date.now() - startTime;
  const statusCode = upstreamResponse.status;

  // 7. Handle response
  const isSSE = upstreamResponse.headers.get('content-type')?.includes('text/event-stream');

  if (isSSE && upstreamResponse.body) {
    // Streaming response
    const { readable, usagePromise } = createSSEPassthrough(
      upstreamResponse.body,
      service.meteringConfig,
    );

    // Defer usage recording after stream completes
    const ctx = c.executionCtx;
    ctx.waitUntil(
      usagePromise.then(async (usage) => {
        const tokenCost = (usage.inputTokens > 0 || usage.outputTokens > 0)
          ? await calculateTokenCost(c.env.DB, usage.model, usage.inputTokens, usage.outputTokens, service.pricingMultiplier)
          : calculateFlatCost(service.meteringConfig, service.pricingMultiplier);

        if (tokenCost > 0) {
          await recordUsage(c.env.DB, userId, serviceId, usage, tokenCost, latencyMs, statusCode, credentialType);
        }
      }),
    );

    // Return streaming response
    return new Response(readable, {
      status: statusCode,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Buffered response
  const responseBody = await upstreamResponse.text();
  let tokenCost = 0;

  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>;
    const usage = extractUsageFromJSON(parsed, service.meteringConfig);

    tokenCost = (usage.inputTokens > 0 || usage.outputTokens > 0)
      ? await calculateTokenCost(c.env.DB, usage.model, usage.inputTokens, usage.outputTokens, service.pricingMultiplier)
      : calculateFlatCost(service.meteringConfig, service.pricingMultiplier);

    if (tokenCost > 0) {
      // Record in background
      c.executionCtx.waitUntil(
        recordUsage(c.env.DB, userId, serviceId, usage, tokenCost, latencyMs, statusCode, credentialType),
      );
    }
  } catch {
    // Non-JSON response or parse error — charge flat cost if configured
    tokenCost = calculateFlatCost(service.meteringConfig, service.pricingMultiplier);
    if (tokenCost > 0) {
      c.executionCtx.waitUntil(
        recordUsage(c.env.DB, userId, serviceId, { model: null, inputTokens: 0, outputTokens: 0 }, tokenCost, latencyMs, statusCode, credentialType),
      );
    }
  }

  // Forward response with original status and headers
  const responseHeaders = new Headers();
  const ct = upstreamResponse.headers.get('Content-Type');
  if (ct) responseHeaders.set('Content-Type', ct);

  return new Response(responseBody, {
    status: statusCode,
    headers: responseHeaders,
  });
});

export { proxy };
