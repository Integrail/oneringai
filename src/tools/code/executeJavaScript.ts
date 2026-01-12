/**
 * JavaScript Execution Tool
 * Executes JavaScript in a sandboxed VM with OAuth integration
 */

import * as vm from 'vm';
import { ToolFunction } from '../../domain/entities/Tool.js';
import { oauthRegistry } from '../../plugins/oauth/OAuthRegistry.js';
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

export const executeJavaScript: ToolFunction<ExecuteJSArgs, ExecuteJSResult> = {
  definition: {
    type: 'function',
    function: {
      name: 'execute_javascript',
      description: `Execute JavaScript code in a secure sandbox with OAuth authentication.

IMPORTANT: This tool runs JavaScript code in a sandboxed environment with access to authenticated APIs.

AVAILABLE IN CONTEXT:

1. INPUT/OUTPUT:
   - input: any data passed to your code
   - output: SET THIS variable to return your result

2. AUTHENTICATED FETCH:
   - authenticatedFetch(url, options, provider)
     • url: Full URL or path
     • options: Standard fetch options
     • provider: OAuth provider name
     • Returns: Promise<Response>

   Registered OAuth providers: ${oauthRegistry.listProviderNames().join(', ') || 'none'}

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
  const response = await authenticatedFetch(url, options, provider);
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
}`,

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

    // OAuth registry info
    oauth: {
      listProviders: () => oauthRegistry.listProviderNames(),
      getProviderInfo: (name: string) => {
        try {
          const provider = oauthRegistry.get(name);
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
