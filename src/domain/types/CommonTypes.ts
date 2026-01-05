/**
 * Common shared types
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface RequestMetadata {
  requestId?: string;
  userId?: string;
  timestamp?: number;
  [key: string]: any;
}
