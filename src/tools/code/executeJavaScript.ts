/**
 * JavaScript Execution Tool
 * Executes JavaScript in a sandboxed VM with connector integration
 * Connectors provide authenticated access to external APIs (GitHub, Microsoft, etc.)
 */

import * as vm from 'vm';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { Connector } from '../../core/Connector.js';
import { authenticatedFetch } from '../../connectors/authenticatedFetch.js';

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
 * Generate the tool description with current connectors.
 * Called dynamically via descriptionFactory when tools are sent to LLM.
 */
function generateDescription(): string {
  const connectors = Connector.listAll();
  const connectorList = connectors.length > 0
    ? connectors
        .map(c => {
          const authType = c.config.auth?.type || 'none';
          return `   • "${c.name}": ${c.displayName}
     ${c.config.description || 'No description'}
     Base URL: ${c.baseURL}
     Auth: ${authType}`;
        })
        .join('\n\n')
    : '   No connectors registered.';

  return `Execute JavaScript code in a secure sandbox with authenticated API access.

AVAILABLE APIS:

1. authenticatedFetch(url, options, connectorName, userId?)
   Makes authenticated API calls using the connector's configured auth scheme.
   Auth headers are added automatically - DO NOT set Authorization header.

   Parameters:
     • url: Full URL or relative path (uses connector's baseURL)
       - Full: "https://api.github.com/user/repos"
       - Relative: "/user/repos" (appended to connector's baseURL)
     • options: Standard fetch options { method, body, headers }
     • connectorName: One of the registered connectors below
     • userId: (optional) For multi-tenant apps with per-user tokens

   Returns: Promise<Response>
     • response.ok - true if status 200-299
     • response.status - HTTP status code
     • response.json() - parse JSON body
     • response.text() - get text body

   Auth Schemes (handled automatically per connector):
     • Bearer tokens (GitHub, Slack, Stripe)
     • Bot tokens (Discord)
     • Basic auth (Twilio, Zendesk)
     • Custom headers (Shopify uses X-Shopify-Access-Token)

2. connectors.list() - List available connector names
3. connectors.get(name) - Get connector info { displayName, description, baseURL }
4. fetch(url, options) - Standard fetch (no auth)

INPUT/OUTPUT:
   • input - data passed to your code via the "input" parameter
   • output - SET THIS variable to return your result

UTILITIES: console.log/error/warn, Buffer, JSON, Math, Date, Promise

REGISTERED CONNECTORS:
${connectorList}

EXAMPLE:
(async () => {
  const response = await authenticatedFetch(
    '/user/repos',
    { method: 'GET' },
    'github'
  );

  if (!response.ok) {
    throw new Error(\`API error: \${response.status}\`);
  }

  const repos = await response.json();
  console.log(\`Found \${repos.length} repositories\`);

  output = repos;
})();

SECURITY: 10s timeout, no file system, no require/import.`;
}

/**
 * Create an execute_javascript tool.
 *
 * The tool uses `descriptionFactory` to generate a dynamic description that
 * always reflects the currently registered connectors. This ensures the LLM
 * sees up-to-date connector information even if connectors are registered
 * after the tool is created.
 */
export function createExecuteJavaScriptTool(): ToolFunction<ExecuteJSArgs, ExecuteJSResult> {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'execute_javascript',
        // Static fallback description (used if descriptionFactory is not supported)
        description: 'Execute JavaScript code in a secure sandbox with authenticated API access via connectors.',
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

    // Dynamic description - evaluated each time tool definitions are sent to LLM
    // This ensures the connector list is always current
    descriptionFactory: generateDescription,

    execute: async (args: ExecuteJSArgs): Promise<ExecuteJSResult> => {
      const logs: string[] = [];
      const startTime = Date.now();

      try {
        // Validate timeout
        const timeout = Math.min(args.timeout || 10000, 30000);

        // Execute in VM
        const result = await executeInVM(args.code, args.input, timeout, logs);

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
 * Default executeJavaScript tool instance.
 *
 * This tool uses `descriptionFactory` to generate dynamic descriptions,
 * so the connector list is always current when the tool is sent to the LLM.
 * You can use either this default instance or create new ones with
 * `createExecuteJavaScriptTool()` - both will have dynamic descriptions.
 */
export const executeJavaScript: ToolFunction<ExecuteJSArgs, ExecuteJSResult> = createExecuteJavaScriptTool();

/**
 * Execute code in Node.js vm module
 */
async function executeInVM(
  code: string,
  input: any,
  timeout: number,
  logs: string[]
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

    // Connector info
    connectors: {
      list: () => Connector.list(),
      get: (name: string) => {
        try {
          const connector = Connector.get(name);
          return {
            displayName: connector.displayName,
            description: connector.config.description || '',
            baseURL: connector.baseURL,
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

  // If result is undefined but output was set, use the output variable
  return result !== undefined ? result : sandbox.output;
}
