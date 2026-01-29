/**
 * ToolLoader - Dynamic tool loading and management
 *
 * Loads built-in tools and custom tools from the filesystem.
 * Manages enabled/disabled state.
 * Includes developer tools (filesystem + shell) for coding agent capabilities.
 * Includes external tools (web search, scrape, fetch) with connector support.
 *
 * Phase 1.3 Improvements:
 * - Extracted developer tools config building to dedicated function (DRY)
 * Phase 2: External Tools
 * - Added external tools integration (webSearch, webScrape, webFetch)
 */

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ToolFunction } from '@oneringai/agents';
import {
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createGlobTool,
  createGrepTool,
  createListDirectoryTool,
  createBashTool,
  type FilesystemToolConfig,
  type ShellToolConfig,
  webFetch,
  webSearch,
} from '@oneringai/agents';
// Note: webScrape needs to be imported separately as it may not be in main exports
import type { IToolLoader, AmosConfig, IConnectorManager } from '../config/types.js';
import { ExternalToolManager, type ExternalToolInfo } from './ExternalToolManager.js';

// ─────────────────────────────────────────────────────────────────────────────
// Developer Tools Configuration (Phase 1.3 - Extracted)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build configuration for developer tools (filesystem + shell)
 *
 * Extracted to a separate function for:
 * 1. DRY - Reusable configuration logic
 * 2. Testability - Can be unit tested independently
 * 3. Clarity - Configuration logic is isolated
 */
export function buildDeveloperToolsConfig(config: AmosConfig | null): {
  filesystem: FilesystemToolConfig;
  shell: ShellToolConfig;
} {
  const devToolsConfig = config?.developerTools;
  const workingDir = devToolsConfig?.workingDirectory || process.cwd();

  return {
    filesystem: {
      workingDirectory: workingDir,
      allowedDirectories: devToolsConfig?.allowedDirectories || [],
      blockedDirectories: devToolsConfig?.blockedDirectories || ['node_modules', '.git', 'dist', 'build'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxResults: 100,
    },
    shell: {
      workingDirectory: workingDir,
      defaultTimeout: devToolsConfig?.commandTimeout || 30000,
      blockedCommands: devToolsConfig?.blockedCommands || ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'],
      allowBackground: true,
      maxOutputSize: 1024 * 1024, // 1MB
    },
  };
}

/**
 * Create all developer tools with given configuration
 *
 * Returns an array of all developer tools:
 * - Filesystem: read_file, write_file, edit_file, glob, grep, list_directory
 * - Shell: bash
 */
export function createDeveloperTools(config: AmosConfig | null): ToolFunction[] {
  const { filesystem: fsConfig, shell: shellConfig } = buildDeveloperToolsConfig(config);

  return [
    // Filesystem tools
    createReadFileTool(fsConfig),
    createWriteFileTool(fsConfig),
    createEditFileTool(fsConfig),
    createGlobTool(fsConfig),
    createGrepTool(fsConfig),
    createListDirectoryTool(fsConfig),
    // Shell tool
    createBashTool(shellConfig),
  ];
}

export class ToolLoader implements IToolLoader {
  private tools: Map<string, ToolFunction> = new Map();
  private enabledTools: Set<string> = new Set();
  private customToolsDir: string;
  private config: AmosConfig | null = null;
  private externalToolManager: ExternalToolManager | null = null;

  constructor(customToolsDir: string = './data/tools') {
    this.customToolsDir = customToolsDir;
  }

  /**
   * Set configuration (allows updating config after construction)
   */
  setConfig(config: AmosConfig): void {
    this.config = config;
    // Update external tool manager config if it exists
    if (this.externalToolManager && config.externalTools) {
      this.externalToolManager.updateConfig(config.externalTools);
    }
  }

  /**
   * Set the external tool manager
   */
  setExternalToolManager(manager: ExternalToolManager): void {
    this.externalToolManager = manager;
  }

  /**
   * Get external tool info (for status display)
   */
  getExternalToolInfo(): ExternalToolInfo[] {
    return this.externalToolManager?.getAllToolInfo() || [];
  }

  /**
   * Get the external tool manager
   */
  getExternalToolManager(): ExternalToolManager | null {
    return this.externalToolManager;
  }

  /**
   * Initialize - load all tools
   */
  async initialize(): Promise<void> {
    // Load built-in tools
    const builtinTools = this.loadBuiltinTools();
    for (const tool of builtinTools) {
      const name = tool.definition.function.name;
      this.tools.set(name, tool);
      this.enabledTools.add(name); // Enable by default
    }

    // Load custom tools
    await this.loadCustomTools(this.customToolsDir);
  }

  /**
   * Load built-in tools
   */
  loadBuiltinTools(): ToolFunction[] {
    const tools: ToolFunction[] = [];

    // Calculator tool
    tools.push({
      definition: {
        type: 'function',
        function: {
          name: 'calculate',
          description: 'Perform mathematical calculations. Supports basic arithmetic and common functions.',
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'The mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "sin(3.14)")',
              },
            },
            required: ['expression'],
          },
        },
      },
      execute: async (args: { expression: string }) => {
        try {
          // Safe math evaluation (no eval)
          const result = this.evaluateMath(args.expression);
          return { result, expression: args.expression };
        } catch (error) {
          return { error: `Failed to evaluate: ${error instanceof Error ? error.message : String(error)}` };
        }
      },
    });

    // Current time tool
    tools.push({
      definition: {
        type: 'function',
        function: {
          name: 'get_current_time',
          description: 'Get the current date and time',
          parameters: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'Timezone (e.g., "America/New_York", "UTC"). Defaults to local timezone.',
              },
            },
          },
        },
      },
      execute: async (args: { timezone?: string }) => {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: args.timezone || undefined,
        };

        try {
          const formatted = now.toLocaleDateString('en-US', options);
          return {
            formatted,
            iso: now.toISOString(),
            timestamp: now.getTime(),
            timezone: args.timezone || 'local',
          };
        } catch {
          return {
            formatted: now.toString(),
            iso: now.toISOString(),
            timestamp: now.getTime(),
            timezone: 'local',
          };
        }
      },
    });

    // Random number generator
    tools.push({
      definition: {
        type: 'function',
        function: {
          name: 'random_number',
          description: 'Generate a random number within a range',
          parameters: {
            type: 'object',
            properties: {
              min: {
                type: 'number',
                description: 'Minimum value (inclusive)',
              },
              max: {
                type: 'number',
                description: 'Maximum value (inclusive)',
              },
              integer: {
                type: 'boolean',
                description: 'Whether to return an integer (default: true)',
              },
            },
            required: ['min', 'max'],
          },
        },
      },
      execute: async (args: { min: number; max: number; integer?: boolean }) => {
        const { min, max, integer = true } = args;
        const random = Math.random() * (max - min) + min;
        const result = integer ? Math.floor(random) : random;
        return { result, min, max, integer };
      },
    });

    // Echo tool (useful for testing)
    tools.push({
      definition: {
        type: 'function',
        function: {
          name: 'echo',
          description: 'Echo back the input message (useful for testing)',
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to echo',
              },
            },
            required: ['message'],
          },
        },
      },
      execute: async (args: { message: string }) => {
        return { echo: args.message };
      },
    });

    // Developer tools (filesystem + shell) - only if enabled
    if (this.config?.developerTools?.enabled !== false) {
      // Use extracted helper function (Phase 1.3 - DRY)
      const devTools = createDeveloperTools(this.config);
      tools.push(...devTools);
    }

    // External tools (web search, scrape, fetch) - based on config
    this.loadExternalTools(tools);

    return tools;
  }

  /**
   * Load external tools based on configuration
   * External tools require connectors to be configured
   */
  private loadExternalTools(tools: ToolFunction[]): void {
    const externalConfig = this.config?.externalTools;
    if (!externalConfig?.enabled) return;

    // web_fetch - Always available (no connector needed)
    if (externalConfig.webFetchEnabled) {
      tools.push(webFetch);
    }

    // web_search - Requires connector
    if (this.externalToolManager) {
      const searchTool = this.externalToolManager.createSearchTool(webSearch);
      if (searchTool) {
        tools.push(searchTool);
      } else if (externalConfig.search === null) {
        // Add unconfigured tool so user can see it exists
        // but mark it as disabled
        tools.push(webSearch);
        // Don't enable it - will be filtered out
      }
    } else if (externalConfig.search?.enabled && externalConfig.search?.connectorName) {
      // Direct config without manager (fallback)
      const connectorName = externalConfig.search.connectorName;
      tools.push({
        ...webSearch,
        execute: async (args: any) => {
          return webSearch.execute({
            ...args,
            connectorName: args.connectorName || connectorName,
          });
        },
      });
    }

    // Note: webScrape would be added here similarly when available
    // For now, we only support webFetch and webSearch
  }

  /**
   * Load custom tools from a directory
   */
  async loadCustomTools(directory: string): Promise<ToolFunction[]> {
    const tools: ToolFunction[] = [];

    if (!existsSync(directory)) {
      return tools;
    }

    try {
      const files = await readdir(directory);

      for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;

        try {
          // Handle both absolute and relative paths
          const baseDir = isAbsolute(directory) ? directory : resolve(process.cwd(), directory);
          const filePath = join(baseDir, file);
          const fileUrl = pathToFileURL(filePath).href;
          const module = await import(fileUrl);

          // Expect default export or named 'tool' export
          const tool = module.default || module.tool;

          if (this.isValidTool(tool)) {
            const name = tool.definition.function.name;
            this.tools.set(name, tool);
            this.enabledTools.add(name);
            tools.push(tool);
          }
        } catch (error) {
          console.error(`Failed to load custom tool ${file}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to read custom tools directory:`, error);
    }

    return tools;
  }

  /**
   * Reload all tools
   */
  async reloadTools(): Promise<void> {
    // Remember enabled state
    const wasEnabled = new Set(this.enabledTools);

    // Clear and reload
    this.tools.clear();
    this.enabledTools.clear();

    await this.initialize();

    // Restore enabled state where possible
    for (const name of wasEnabled) {
      if (this.tools.has(name)) {
        this.enabledTools.add(name);
      }
    }
  }

  /**
   * Get all tools
   */
  getAllTools(): ToolFunction[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolFunction | null {
    return this.tools.get(name) || null;
  }

  /**
   * Enable a tool
   */
  enableTool(name: string): void {
    if (this.tools.has(name)) {
      this.enabledTools.add(name);
    }
  }

  /**
   * Disable a tool
   */
  disableTool(name: string): void {
    this.enabledTools.delete(name);
  }

  /**
   * Check if a tool is enabled
   */
  isEnabled(name: string): boolean {
    return this.enabledTools.has(name);
  }

  /**
   * Get all enabled tools
   */
  getEnabledTools(): ToolFunction[] {
    return Array.from(this.tools.entries())
      .filter(([name]) => this.enabledTools.has(name))
      .map(([, tool]) => tool);
  }

  /**
   * Apply enable/disable state from config
   */
  applyConfig(enabledTools: string[], disabledTools: string[]): void {
    // Disable specified tools
    for (const name of disabledTools) {
      this.disableTool(name);
    }

    // Enable specified tools (overrides disabled)
    for (const name of enabledTools) {
      this.enableTool(name);
    }
  }

  /**
   * Validate that an object is a valid ToolFunction
   */
  private isValidTool(obj: unknown): obj is ToolFunction {
    if (!obj || typeof obj !== 'object') return false;
    const tool = obj as Record<string, unknown>;
    if (!tool.definition || typeof tool.definition !== 'object') return false;
    if (typeof tool.execute !== 'function') return false;

    const def = tool.definition as Record<string, unknown>;
    if (def.type !== 'function') return false;
    if (!def.function || typeof def.function !== 'object') return false;

    const func = def.function as Record<string, unknown>;
    if (typeof func.name !== 'string') return false;

    return true;
  }

  /**
   * Safe math expression evaluator
   */
  private evaluateMath(expression: string): number {
    // Define allowed functions
    const mathFunctions: Record<string, (...args: number[]) => number> = {
      abs: Math.abs,
      acos: Math.acos,
      asin: Math.asin,
      atan: Math.atan,
      ceil: Math.ceil,
      cos: Math.cos,
      exp: Math.exp,
      floor: Math.floor,
      log: Math.log,
      log10: Math.log10,
      max: Math.max,
      min: Math.min,
      pow: Math.pow,
      random: Math.random,
      round: Math.round,
      sin: Math.sin,
      sqrt: Math.sqrt,
      tan: Math.tan,
    };

    // Replace function names with placeholders
    let processed = expression.toLowerCase();

    // Simple tokenizer for basic math
    // This is a basic implementation - a real one would use a proper parser
    const tokens = processed.match(/[\d.]+|[+\-*/^()%]|[a-z]+/g) || [];

    let result = 0;
    let currentOp = '+';
    let current = 0;
    const stack: number[] = [];
    const opStack: string[] = [];

    for (const token of tokens) {
      if (/^\d/.test(token)) {
        current = parseFloat(token);
      } else if (token in mathFunctions) {
        // Handle function - simplified, assumes single argument
        // A real implementation would parse parentheses properly
        continue;
      } else if ('+-*/^%'.includes(token)) {
        // Apply previous operation
        result = this.applyOp(result, current, currentOp);
        currentOp = token;
        current = 0;
      } else if (token === '(') {
        stack.push(result);
        opStack.push(currentOp);
        result = 0;
        currentOp = '+';
      } else if (token === ')') {
        result = this.applyOp(result, current, currentOp);
        current = result;
        result = stack.pop() || 0;
        currentOp = opStack.pop() || '+';
      }
    }

    // Final operation
    result = this.applyOp(result, current, currentOp);

    return result;
  }

  private applyOp(a: number, b: number, op: string): number {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : NaN;
      case '^': return Math.pow(a, b);
      case '%': return a % b;
      default: return b;
    }
  }
}
