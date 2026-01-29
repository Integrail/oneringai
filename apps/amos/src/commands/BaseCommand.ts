/**
 * BaseCommand - Abstract base class for all commands
 *
 * Provides common functionality and structure for commands.
 */

import type { CommandContext, CommandResult, ICommand } from '../config/types.js';

export abstract class BaseCommand implements ICommand {
  abstract readonly name: string;
  abstract readonly aliases: string[];
  abstract readonly description: string;
  abstract readonly usage: string;

  /**
   * Detailed help text for this command.
   * Override in subclasses to provide command-specific help.
   * If not overridden, generates a basic help from name, description, and usage.
   */
  get detailedHelp(): string {
    const aliasStr = this.aliases.length > 0
      ? `\nAliases: ${this.aliases.map(a => '/' + a).join(', ')}`
      : '';

    return `/${this.name} - ${this.description}${aliasStr}\n\nUsage: ${this.usage}`;
  }

  /**
   * Execute the command
   */
  abstract execute(context: CommandContext): Promise<CommandResult>;

  /**
   * Helper to create a success result
   */
  protected success(message?: string, data?: unknown): CommandResult {
    return { success: true, message, data };
  }

  /**
   * Helper to create an error result
   */
  protected error(message: string): CommandResult {
    return { success: false, message };
  }

  /**
   * Helper to create an exit result
   */
  protected exit(message?: string): CommandResult {
    return { success: true, message, shouldExit: true };
  }

  /**
   * Helper to create a clear screen result
   */
  protected clear(): CommandResult {
    return { success: true, clearScreen: true };
  }

  /**
   * Parse subcommand and remaining args from args array
   */
  protected parseSubcommand(args: string[]): { subcommand: string | null; subArgs: string[] } {
    if (args.length === 0) {
      return { subcommand: null, subArgs: [] };
    }
    return {
      subcommand: args[0].toLowerCase(),
      subArgs: args.slice(1),
    };
  }

  /**
   * Format a table for display
   */
  protected formatTable(
    headers: string[],
    rows: string[][],
    options: { padding?: number; separator?: string } = {}
  ): string {
    const { padding = 2, separator = ' | ' } = options;

    // Calculate column widths
    const widths = headers.map((h, i) => {
      const maxRowWidth = Math.max(...rows.map((r) => (r[i] || '').length));
      return Math.max(h.length, maxRowWidth);
    });

    // Format header
    const headerRow = headers
      .map((h, i) => h.padEnd(widths[i] + padding))
      .join(separator);
    const divider = widths
      .map((w) => '-'.repeat(w + padding))
      .join(separator.replace(/./g, '-'));

    // Format rows
    const formattedRows = rows.map((row) =>
      row.map((cell, i) => (cell || '').padEnd(widths[i] + padding)).join(separator)
    );

    return [headerRow, divider, ...formattedRows].join('\n');
  }

  /**
   * Format a list for display
   */
  protected formatList(items: string[], bullet: string = '•'): string {
    return items.map((item) => `  ${bullet} ${item}`).join('\n');
  }
}
