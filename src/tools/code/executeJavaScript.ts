/**
 * JavaScript Execution Tool
 * Executes JavaScript in a sandboxed VM with OAuth integration
 */

import * as vm from 'vm';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { oauthRegistry, OAuthRegistry } from '../../plugins/oauth/OAuthRegistry.js';
import { authenticatedFetch } from '../../plugins/oauth/authenticatedFetch.js';

interface ExecuteJSArgs {
  code: string;
  input?: any;
  timeout?: number;
}

interface ExecuteJSResult {
  success: boolean;
  result: any;
  logs: string[];
  error?: string;
  executionTime: number;
}

/**
 * Generate the tool description with current OAuth providers
 */
function generateDescription(registry: OAuthRegistry): string {
  const providers = registry.listProviders();
  const providerList = providers.length > 0
    ? providers
        .map(p => `   • "${p.name}": ${p.displayName}\n     ${p.description}\n     Base URL: ${p.baseURL}`)
        .join('\n\n')
    : '   No OAuth providers registered yet. Register providers with oauthRegistry.register().';

  return `Execute JavaScript code in a secure sandbox with OAuth authentication.

IMPORTANT: This tool runs JavaScript code in a sandboxed environment with access to authenticated APIs.

AVAILABLE IN CONTEXT:

1. INPUT/OUTPUT:
   - input: any data passed to your code
   - output: SET THIS variable to return your result

2. AUTHENTICATED FETCH:
   - authenticatedFetch(url, options, provider, userId?)
     • url: Full URL or path
     • options: Standard fetch options { method: 'GET'|'POST'|..., body: ..., headers: ... }
     • provider: OAuth provider name (see below)
     • userId: (optional) User identifier for multi-user apps
     • Returns: Promise<Response>

   REGISTERED OAUTH PROVIDERS:
${providerList}

3. STANDARD FETCH:
   - fetch(url, options) - No authentication

4. OAUTH REGISTRY:
   - oauth.listProviders() - List available providers
   - oauth.getProviderInfo(name) - Get provider details

5. UTILITIES:
   - console.log/error/warn
   - Buffer, JSON, Math, Date
   - setTimeout, setInterval, Promise

CODE PATTERN:
Always wrap your code in an async IIFE:

(async () => {
  // Your code here

  // Single-user mode (default)
  const response = await authenticatedFetch(url, options, provider);

  // OR Multi-user mode (if your app has multiple users)
  const response = await authenticatedFetch(url, options, provider, userId);

  const data = await response.json();
  output = data;
})();

SECURITY:
- 10 second timeout (configurable)
- No file system access
- No process/child_process
- No require/import
- Memory limited

RETURNS:
{
  success: boolean,
  result: any,
  logs: string[],
  error?: string,
  executionTime: number
}`;
}

/**
 * Create an execute_javascript tool with the current OAuth registry state
 * Use this factory when you need the tool to reflect currently registered providers
 */
export function createExecuteJavaScriptTool(registry: OAuthRegistry = oauthRegistry): ToolFunction<ExecuteJSArgs, ExecuteJSResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'execute_javascript',
        description: generateDescription(registry),
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description:
                'JavaScript code to execute. MUST set the "output" variable. Wrap in async IIFE for async operations.',
            },
            input: {
              description: 'Optional input data available as "input" variable in your code',
            },
            timeout: {
              type: 'number',
              description: 'Execution timeout in milliseconds (default: 10000, max: 30000)',
            },
          },
          required: ['code'],
        },
      },
      blocking: true,
      timeout: 35000, // Tool timeout (slightly more than max code timeout)
    },

    execute: async (args: ExecuteJSArgs): Promise<ExecuteJSResult> => {
      const logs: string[] = [];
      const startTime = Date.now();

      try {
        // Validate timeout
        const timeout = Math.min(args.timeout || 10000, 30000);

        // Execute in VM with the specified registry
        const result = await executeInVM(args.code, args.input, timeout, logs, registry);

        return {
          success: true,
          result,
          logs,
          executionTime: Date.now() - startTime,
        };
      } catch (error) {
        return {
          success: false,
          result: null,
          logs,
          error: (error as Error).message,
          executionTime: Date.now() - startTime,
        };
      }
    },
  };
}

/**
 * Default executeJavaScript tool (uses global oauthRegistry)
 * NOTE: The description is generated at module load time. If you register
 * providers after importing this, use createExecuteJavaScriptTool() instead.
 */
export const executeJavaScript: ToolFunction<ExecuteJSArgs, ExecuteJSResult> = createExecuteJavaScriptTool(oauthRegistry);

/**
 * Execute code in Node.js vm module
 */
async function executeInVM(
  code: string,
  input: any,
  timeout: number,
  logs: string[],
  registry: OAuthRegistry = oauthRegistry
): Promise<any> {
  // Create sandbox context
  const sandbox: any = {
    // Input/output
    input: input || {},
    output: null,

    // Console (captured)
    console: {
      log: (...args: any[]) => logs.push(args.map((a) => String(a)).join(' ')),
      error: (...args: any[]) => logs.push('ERROR: ' + args.map((a) => String(a)).join(' ')),
      warn: (...args: any[]) => logs.push('WARN: ' + args.map((a) => String(a)).join(' ')),
    },

    // Authenticated fetch
    authenticatedFetch,

    // Standard fetch
    fetch: globalThis.fetch,

    // OAuth registry info (uses the provided registry)
    oauth: {
      listProviders: () => registry.listProviderNames(),
      getProviderInfo: (name: string) => {
        try {
          const provider = registry.get(name);
          return {
            displayName: provider.displayName,
            description: provider.description,
            baseURL: provider.baseURL,
          };
        } catch {
          return null;
        }
      },
    },

    // Standard globals
    Buffer,
    JSON,
    Math,
    Date,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    Promise,

    // Array/Object
    Array,
    Object,
    String,
    Number,
    Boolean,
  };

  // Create VM context
  const context = vm.createContext(sandbox);

  // Wrap user code in async IIFE if not already wrapped
  const wrappedCode = code.trim().startsWith('(async')
    ? code
    : `
    (async () => {
      ${code}
      return output;
    })()
  `;

  // Compile and run
  const script = new vm.Script(wrappedCode);
  const resultPromise = script.runInContext(context, {
    timeout,
    displayErrors: true,
  });

  // Wait for completion
  const result = await resultPromise;

  return result;
}
