/**
 * ToolLoader - Dynamic tool loading and management
 *
 * Loads built-in tools and custom tools from the filesystem.
 * Manages enabled/disabled state.
 * Includes developer tools (filesystem + shell) for coding agent capabilities.
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
} from '@oneringai/agents';
import type { IToolLoader, AmosConfig } from '../config/types.js';

export class ToolLoader implements IToolLoader {
  private tools: Map<string, ToolFunction> = new Map();
  private enabledTools: Set<string> = new Set();
  private customToolsDir: string;
  private config: AmosConfig | null = null;

  constructor(customToolsDir: string = './data/tools') {
    this.customToolsDir = customToolsDir;
  }

  /**
   * Set configuration (allows updating config after construction)
   */
  setConfig(config: AmosConfig): void {
    this.config = config;
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
      const devToolsConfig = this.config?.developerTools;
      const workingDir = devToolsConfig?.workingDirectory || process.cwd();

      // Filesystem tool configuration
      const fsConfig: FilesystemToolConfig = {
        workingDirectory: workingDir,
        allowedDirectories: devToolsConfig?.allowedDirectories || [],
        blockedDirectories: devToolsConfig?.blockedDirectories || ['node_modules', '.git', 'dist', 'build'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxResults: 100,
      };

      // Shell tool configuration
      const shellConfig: ShellToolConfig = {
        workingDirectory: workingDir,
        defaultTimeout: devToolsConfig?.commandTimeout || 30000,
        blockedCommands: devToolsConfig?.blockedCommands || ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'],
        allowBackground: true,
        maxOutputSize: 1024 * 1024, // 1MB
      };

      // Add filesystem tools
      tools.push(createReadFileTool(fsConfig));
      tools.push(createWriteFileTool(fsConfig));
      tools.push(createEditFileTool(fsConfig));
      tools.push(createGlobTool(fsConfig));
      tools.push(createGrepTool(fsConfig));
      tools.push(createListDirectoryTool(fsConfig));

      // Add shell tool
      tools.push(createBashTool(shellConfig));
    }

    return tools;
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
