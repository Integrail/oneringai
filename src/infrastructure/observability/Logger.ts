/**
 * Structured logging infrastructure
 *
 * Provides framework-wide structured logging with context propagation.
 * Supports console output (default) with optional pino integration.
 */

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

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: (config.level || process.env.LOG_LEVEL || 'info') as LogLevel,
      pretty: config.pretty ?? process.env.NODE_ENV === 'development',
      destination: config.destination || 'console',
      context: config.context || {},
    };

    this.context = this.config.context || {};
    this.levelValue = LOG_LEVEL_VALUES[this.config.level || 'info'];
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
    const color = levelColors[entry.level] || '';

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
  pretty: process.env.NODE_ENV === 'development',
});
