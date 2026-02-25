/**
 * Shared sandbox API description for custom tool meta-tools.
 *
 * Generates dynamic descriptions that include the full VM sandbox API
 * and all currently available connectors — regenerated each time
 * tool definitions are sent to the LLM via descriptionFactory.
 */

import type { ToolContext } from '../../domain/entities/Tool.js';
import { Connector } from '../../core/Connector.js';

/**
 * Format a single connector for display in tool descriptions.
 */
function formatConnectorEntry(c: Connector, accountId?: string): string {
  const parts: string[] = [];

  const serviceOrVendor = c.serviceType ?? c.vendor ?? undefined;
  if (serviceOrVendor) parts.push(`Service: ${serviceOrVendor}`);

  if (accountId) parts.push(`Account: "${accountId}"`);

  if (c.config.description) parts.push(c.config.description);

  if (c.baseURL) parts.push(`URL: ${c.baseURL}`);

  const label = accountId ? `"${c.name}" account "${accountId}"` : `"${c.name}"`;
  const details = parts.map(p => `     ${p}`).join('\n');
  return `   • ${label} (${c.displayName})\n${details}`;
}

/**
 * Build the connector/identity list section from current ToolContext.
 * If identities are set, list each identity entry. Otherwise list all connectors.
 */
export function buildConnectorList(context: ToolContext | undefined): string {
  const identities = context?.identities;
  const registry = context?.connectorRegistry ?? Connector.asRegistry();

  if (identities?.length) {
    const entries: string[] = [];
    for (const id of identities) {
      try {
        const connector = registry.get(id.connector);
        entries.push(formatConnectorEntry(connector, id.accountId));
      } catch {
        entries.push(`   • "${id.connector}"${id.accountId ? ` account "${id.accountId}"` : ''} — not available`);
      }
    }
    return entries.length > 0 ? entries.join('\n\n') : '   No connectors registered.';
  }

  const connectors = registry.listAll();
  if (connectors.length === 0) {
    return '   No connectors registered.';
  }

  return connectors.map(c => formatConnectorEntry(c)).join('\n\n');
}

/**
 * The complete sandbox API reference, shared by all tools that write/test custom tool code.
 */
export const SANDBOX_API_REFERENCE = `SANDBOX API (available inside custom tool code):

1. authenticatedFetch(url, options, connectorName, accountId?)
   Makes authenticated HTTP requests using the connector's credentials.
   Auth headers are added automatically — DO NOT set Authorization header manually.

   Parameters:
     • url: Full URL or path relative to the connector's base URL
       - Full: "https://api.github.com/user/repos"
       - Relative: "/user/repos" (resolved against connector's base URL)
     • options: Standard fetch options { method, headers, body }
       - For POST/PUT: set body to JSON.stringify(data) and headers to { 'Content-Type': 'application/json' }
     • connectorName: Name of a registered connector (see REGISTERED CONNECTORS below)
     • accountId (optional): Account alias for multi-account connectors (e.g., 'work', 'personal')

   Returns: Promise<Response>
     • response.ok — true if status 200-299
     • response.status — HTTP status code
     • await response.json() — parse JSON body
     • await response.text() — get text body

2. fetch(url, options) — Standard fetch without authentication

3. connectors.list() — Array of available connector names
4. connectors.get(name) — Connector info: { displayName, description, baseURL, serviceType }

VARIABLES:
   • input — the tool's input arguments (matches inputSchema)
   • output — SET THIS to return the tool's result to the caller

GLOBALS: console.log/error/warn, JSON, Math, Date, Buffer, Promise, Array, Object, String, Number, Boolean, setTimeout, setInterval, URL, URLSearchParams, RegExp, Map, Set, Error, TextEncoder, TextDecoder

LIMITS: No file system access, no require/import. Code runs in async context (await is available).`;

/**
 * Build a complete dynamic description for custom_tool_draft.
 */
export function buildDraftDescription(context: ToolContext | undefined): string {
  const connectorList = buildConnectorList(context);

  return `Validate a draft custom tool definition. Checks name format, schema structure, and code syntax.

When writing the "code" field, you have access to the full VM sandbox:

${SANDBOX_API_REFERENCE}

REGISTERED CONNECTORS:
${connectorList}

CODE EXAMPLES:

// Simple data processing tool
const items = input.data;
output = items.filter(i => i.score > 0.8).sort((a, b) => b.score - a.score);

// API tool using a connector
const resp = await authenticatedFetch('/user/repos', { method: 'GET' }, 'github');
const repos = await resp.json();
output = repos.map(r => ({ name: r.full_name, stars: r.stargazers_count }));

// Tool that chains multiple API calls
const users = await (await authenticatedFetch('/users', {}, 'my-api')).json();
const enriched = await Promise.all(users.map(async u => {
  const details = await (await authenticatedFetch(\`/users/\${u.id}\`, {}, 'my-api')).json();
  return { ...u, ...details };
}));
output = enriched;`;
}

/**
 * Build a complete dynamic description for custom_tool_test.
 */
export function buildTestDescription(context: ToolContext | undefined): string {
  const connectorList = buildConnectorList(context);

  return `Test custom tool code by executing it in the VM sandbox with provided test input. Returns execution result, captured logs, and timing.

The code runs in the same sandbox as execute_javascript:

${SANDBOX_API_REFERENCE}

REGISTERED CONNECTORS:
${connectorList}

The testInput you provide will be available as the \`input\` variable in the code.
Set \`output\` to the value you want returned.`;
}
