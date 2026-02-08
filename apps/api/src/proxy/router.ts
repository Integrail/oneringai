/**
 * Proxy URL router — builds target URL from service baseURL + remaining path
 */
import type { ResolvedService } from '../types.js';

/**
 * Build the target URL for the upstream service.
 * serviceId is stripped, everything after is appended to baseURL.
 *
 * Example:
 *   request: /proxy/openai/v1/chat/completions
 *   service.baseURL: https://api.openai.com
 *   → https://api.openai.com/v1/chat/completions
 */
export function buildTargetURL(
  service: ResolvedService,
  remainingPath: string,
  queryString: string,
): string {
  // Normalize: remove leading slash from path, remove trailing slash from baseURL
  const base = service.baseURL.replace(/\/+$/, '');
  const path = remainingPath.startsWith('/') ? remainingPath : `/${remainingPath}`;
  const qs = queryString ? `?${queryString}` : '';
  return `${base}${path}${qs}`;
}
