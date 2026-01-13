/**
 * JavaScript Execution Tool
 * Executes JavaScript in a sandboxed VM with connector integration
 * Connectors provide authenticated access to external APIs (GitHub, Microsoft, etc.)
 */

import * as vm from 'vm';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { connectorRegistry, ConnectorRegistry } from '../../plugins/oauth/ConnectorRegistry.js';
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
 * Generate the tool description with current connectors
 */
function generateDescription(registry: ConnectorRegistry): string {
  const connectors = registry.listConnectors();
  const connectorList = connectors.length > 0
    ? connectors
        .map(c => `   • "${c.name}": ${c.displayName}\n     ${c.config.description}\n     Base URL: ${c.baseURL}`)
        .join('\n\n')
    : '   No connectors registered yet. Register connectors with connectorRegistry.register().';

  return `Execute JavaScript code in a secure sandbox with connector integration.

IMPORTANT: This tool runs JavaScript code in a sandboxed environment with authenticated access to external APIs via connectors.

AVAILABLE IN CONTEXT:

1. INPUT/OUTPUT:
   - input: any data passed to your code
   - output: SET THIS variable to return your result

2. AUTHENTICATED FETCH:
   - authenticatedFetch(url, options, connector, userId?)
     • url: Full URL or path
     • options: Standard fetch options { method: 'GET'|'POST'|..., body: ..., headers: ... }
     • connector: Connector name (see below)
     • userId: (optional) User identifier for multi-user apps
     • Returns: Promise<Response>

   REGISTERED CONNECTORS:
${connectorList}

3. STANDARD FETCH:
   - fetch(url, options) - No authentication

4. CONNECTOR REGISTRY:
   - connectors.list() - List available connectors
   - connectors.get(name) - Get connector details

5. UTILITIES:
   - console.log/error/warn
   - Buffer, JSON, Math, Date
   - setTimeout, setInterval, Promise

CODE PATTERN:
Always wrap your code in an async IIFE:

(async () => {
  // Your code here

  // Single-user mode (default)
  const response = await authenticatedFetch(url, options, 'github');

  // OR Multi-user mode (if your app has multiple users)
  const response = await authenticatedFetch(url, options, 'github', userId);

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
 * Create an execute_javascript tool with the current connector registry state
 * Use this factory when you need the tool to reflect currently registered connectors
 *
 * @param registry - ConnectorRegistry instance (defaults to global connectorRegistry)
 */
export function createExecuteJavaScriptTool(registry: ConnectorRegistry = connectorRegistry): ToolFunction<ExecuteJSArgs, ExecuteJSResult> {
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
 * Default executeJavaScript tool (uses global connectorRegistry)
 * NOTE: The description is generated at module load time. If you register
 * connectors after importing this, use createExecuteJavaScriptTool() instead.
 */
export const executeJavaScript: ToolFunction<ExecuteJSArgs, ExecuteJSResult> = createExecuteJavaScriptTool(connectorRegistry);

/**
 * Execute code in Node.js vm module
 */
async function executeInVM(
  code: string,
  input: any,
  timeout: number,
  logs: string[],
  registry: ConnectorRegistry = connectorRegistry
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

    // Connector registry info (uses the provided registry)
    connectors: {
      list: () => registry.listConnectorNames(),
      get: (name: string) => {
        try {
          const connector = registry.get(name);
          return {
            displayName: connector.displayName,
            description: connector.config.description,
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

  return result;
}
