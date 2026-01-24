/**
 * Structured logging infrastructure
 *
 * Provides framework-wide structured logging with context propagation.
 * Supports console output (default) with optional file output.
 *
 * Environment variables:
 * - LOG_LEVEL: trace|debug|info|warn|error|silent (default: info)
 * - LOG_FILE: Path to log file (optional, default: console output)
 * - LOG_PRETTY: true|false (default: true in development)
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Log level
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log levels as numbers (for comparison)
 */
const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100,
};

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Log level */
  level?: LogLevel;

  /** Pretty print for development */
  pretty?: boolean;

  /** Base context added to all logs */
  context?: Record<string, any>;

  /** Custom destination (default: console) */
  destination?: 'console' | 'stdout' | 'stderr';

  /** File path for file logging */
  filePath?: string;
}

/**
 * Log entry
 */
export interface LogEntry {
  level: LogLevel;
  time: number;
  msg: string;
  [key: string]: any;
}

/**
 * Framework logger
 */
export class FrameworkLogger {
  private config: LoggerConfig;
  private context: Record<string, any>;
  private levelValue: number;
  private fileStream?: fs.WriteStream;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: (config.level || process.env.LOG_LEVEL || 'info') as LogLevel,
      pretty: config.pretty ?? (process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development'),
      destination: config.destination || 'console',
      context: config.context || {},
      filePath: config.filePath || process.env.LOG_FILE,
    };

    this.context = this.config.context || {};
    this.levelValue = LOG_LEVEL_VALUES[this.config.level || 'info'];

    // Initialize file stream if file path is provided
    if (this.config.filePath) {
      this.initFileStream(this.config.filePath);
    }
  }

  /**
   * Initialize file stream for logging
   */
  private initFileStream(filePath: string): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create write stream with append mode
      this.fileStream = fs.createWriteStream(filePath, {
        flags: 'a', // append mode
        encoding: 'utf8',
      });

      // Handle stream errors
      this.fileStream.on('error', (err) => {
        console.error(`[Logger] File stream error: ${err.message}`);
        this.fileStream = undefined;
      });
    } catch (err) {
      console.error(`[Logger] Failed to initialize log file: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, any>): FrameworkLogger {
    return new FrameworkLogger({
      ...this.config,
      context: { ...this.context, ...context },
    });
  }

  /**
   * Trace log
   */
  trace(obj: Record<string, any> | string, msg?: string): void {
    this.log('trace', obj, msg);
  }

  /**
   * Debug log
   */
  debug(obj: Record<string, any> | string, msg?: string): void {
    this.log('debug', obj, msg);
  }

  /**
   * Info log
   */
  info(obj: Record<string, any> | string, msg?: string): void {
    this.log('info', obj, msg);
  }

  /**
   * Warn log
   */
  warn(obj: Record<string, any> | string, msg?: string): void {
    this.log('warn', obj, msg);
  }

  /**
   * Error log
   */
  error(obj: Record<string, any> | string, msg?: string): void {
    this.log('error', obj, msg);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, obj: Record<string, any> | string, msg?: string): void {
    // Check if this level should be logged
    if (LOG_LEVEL_VALUES[level] < this.levelValue) {
      return;
    }

    // Parse arguments
    let data: Record<string, any>;
    let message: string;

    if (typeof obj === 'string') {
      message = obj;
      data = {};
    } else {
      message = msg || '';
      data = obj;
    }

    // Create log entry
    const entry: LogEntry = {
      level,
      time: Date.now(),
      ...this.context,
      ...data,
      msg: message,
    };

    // Output
    this.output(entry);
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (this.config.pretty) {
      this.prettyPrint(entry);
    } else {
      this.jsonPrint(entry);
    }
  }

  /**
   * Pretty print for development
   */
  private prettyPrint(entry: LogEntry): void {
    const levelColors: Record<LogLevel, string> = {
      trace: '\x1b[90m', // Gray
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      silent: '',
    };

    const reset = '\x1b[0m';
    const color = this.fileStream ? '' : levelColors[entry.level] || ''; // No colors in file

    // Format time
    const time = new Date(entry.time).toISOString().substring(11, 23);

    // Format level
    const levelStr = entry.level.toUpperCase().padEnd(5);

    // Format context
    const contextParts: string[] = [];
    for (const [key, value] of Object.entries(entry)) {
      if (key !== 'level' && key !== 'time' && key !== 'msg') {
        contextParts.push(`${key}=${JSON.stringify(value)}`);
      }
    }
    const context = contextParts.length > 0 ? ` ${contextParts.join(' ')}` : '';

    // Output
    const output = `${color}[${time}] ${levelStr}${reset} ${entry.msg}${context}`;

    // Write to file if available
    if (this.fileStream) {
      // Strip ANSI color codes for file output
      const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
      this.fileStream.write(cleanOutput + '\n');
      return;
    }

    // Console output
    switch (entry.level) {
      case 'error':
      case 'warn':
        console.error(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * JSON print for production
   */
  private jsonPrint(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    // Write to file if available
    if (this.fileStream) {
      this.fileStream.write(json + '\n');
      return;
    }

    // Console output
    switch (this.config.destination) {
      case 'stderr':
        console.error(json);
        break;
      default:
        console.log(json);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.level) {
      this.levelValue = LOG_LEVEL_VALUES[config.level];
    }

    if (config.context) {
      this.context = { ...this.context, ...config.context };
    }

    // Reinitialize file stream if file path changed
    if (config.filePath !== undefined) {
      this.closeFileStream();
      if (config.filePath) {
        this.initFileStream(config.filePath);
      }
    }
  }

  /**
   * Close file stream
   */
  private closeFileStream(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
  }

  /**
   * Cleanup resources (call before process exit)
   */
  close(): void {
    this.closeFileStream();
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level || 'info';
  }

  /**
   * Check if level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVEL_VALUES[level] >= this.levelValue;
  }
}

/**
 * Global logger singleton
 */
export const logger = new FrameworkLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  pretty: process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development',
  filePath: process.env.LOG_FILE,
});

/**
 * Cleanup logger on process exit
 */
process.on('exit', () => {
  logger.close();
});

process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.close();
  process.exit(0);
});
