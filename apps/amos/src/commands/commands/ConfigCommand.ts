/**
 * ConfigCommand - View and edit configuration
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

export class ConfigCommand extends BaseCommand {
  readonly name = 'config';
  readonly aliases = ['cfg', 'settings'];
  readonly description = 'View or edit configuration';
  readonly usage = '/config [get <key>|set <key> <value>|reset]';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { subcommand, subArgs } = this.parseSubcommand(context.args);

    switch (subcommand) {
      case 'get':
        return this.getConfig(context, subArgs[0]);

      case 'set':
        return this.setConfig(context, subArgs[0], subArgs.slice(1).join(' '));

      case 'reset':
        return this.resetConfig(context);

      case null:
        return this.showConfig(context);

      default:
        // Treat as key lookup
        return this.getConfig(context, subcommand);
    }
  }

  private async showConfig(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();

    const output = `
Current Configuration:

ACTIVE SETTINGS:
  Connector: ${config.activeConnector || '(none)'}
  Vendor: ${config.activeVendor || config.defaults.vendor}
  Model: ${config.activeModel || config.defaults.model}

DEFAULTS:
  Vendor: ${config.defaults.vendor}
  Model: ${config.defaults.model}
  Temperature: ${config.defaults.temperature}
  Max Output Tokens: ${config.defaults.maxOutputTokens}

PLANNING:
  Enabled: ${config.planning.enabled}
  Auto-detect: ${config.planning.autoDetect}
  Require Approval: ${config.planning.requireApproval}

SESSION:
  Auto-save: ${config.session.autoSave}
  Auto-save Interval: ${config.session.autoSaveIntervalMs / 1000}s
  Active Session: ${config.session.activeSessionId || '(none)'}

UI:
  Show Token Usage: ${config.ui.showTokenUsage}
  Show Timing: ${config.ui.showTiming}
  Stream Responses: ${config.ui.streamResponses}
  Color Output: ${config.ui.colorOutput}

TOOLS:
  Enabled: ${config.tools.enabledTools.length} tools
  Disabled: ${config.tools.disabledTools.length} tools
  Custom Tools Dir: ${config.tools.customToolsDir}

Use /config get <key> to view specific values
Use /config set <key> <value> to change values
`;

    return this.success(output);
  }

  private async getConfig(context: CommandContext, key?: string): Promise<CommandResult> {
    if (!key) {
      return this.showConfig(context);
    }

    const { app } = context;
    const config = app.getConfig();

    // Navigate to key
    const parts = key.split('.');
    let value: unknown = config;

    for (const part of parts) {
      if (value === null || value === undefined || typeof value !== 'object') {
        return this.error(`Config key not found: ${key}`);
      }
      value = (value as Record<string, unknown>)[part];
    }

    if (value === undefined) {
      return this.error(`Config key not found: ${key}`);
    }

    const formatted = typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);

    return this.success(`${key} = ${formatted}`);
  }

  private async setConfig(context: CommandContext, key?: string, value?: string): Promise<CommandResult> {
    if (!key) {
      return this.error('Key required. Usage: /config set <key> <value>');
    }

    if (value === undefined || value === '') {
      return this.error('Value required. Usage: /config set <key> <value>');
    }

    const { app } = context;

    // Parse value
    let parsedValue: unknown;
    if (value === 'true') {
      parsedValue = true;
    } else if (value === 'false') {
      parsedValue = false;
    } else if (value === 'null') {
      parsedValue = null;
    } else if (/^\d+$/.test(value)) {
      parsedValue = parseInt(value);
    } else if (/^\d*\.\d+$/.test(value)) {
      parsedValue = parseFloat(value);
    } else if (value.startsWith('[') || value.startsWith('{')) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }
    } else {
      parsedValue = value;
    }

    // Validate known keys
    const validKeys = new Set([
      'defaults.vendor',
      'defaults.model',
      'defaults.temperature',
      'defaults.maxOutputTokens',
      'planning.enabled',
      'planning.autoDetect',
      'planning.requireApproval',
      'session.autoSave',
      'session.autoSaveIntervalMs',
      'ui.showTokenUsage',
      'ui.showTiming',
      'ui.streamResponses',
      'ui.colorOutput',
      'tools.customToolsDir',
    ]);

    if (!validKeys.has(key)) {
      const suggestions = Array.from(validKeys)
        .filter((k) => k.includes(key.split('.')[0]))
        .slice(0, 5);

      let message = `Unknown config key: ${key}`;
      if (suggestions.length > 0) {
        message += `\nDid you mean: ${suggestions.join(', ')}?`;
      }
      return this.error(message);
    }

    // Validate value types
    const typeValidations: Record<string, (v: unknown) => boolean> = {
      'defaults.temperature': (v) => typeof v === 'number' && v >= 0 && v <= 2,
      'defaults.maxOutputTokens': (v) => typeof v === 'number' && v > 0,
      'session.autoSaveIntervalMs': (v) => typeof v === 'number' && v >= 1000,
    };

    const validator = typeValidations[key];
    if (validator && !validator(parsedValue)) {
      return this.error(`Invalid value for ${key}: ${value}`);
    }

    // Set the value
    const parts = key.split('.');
    const config = app.getConfig();
    let target: Record<string, unknown> = config as unknown as Record<string, unknown>;

    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]] as Record<string, unknown>;
    }

    target[parts[parts.length - 1]] = parsedValue;
    app.updateConfig(config);

    return this.success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
  }

  private async resetConfig(context: CommandContext): Promise<CommandResult> {
    const { app } = context;

    const confirm = await app.confirm('Reset all configuration to defaults? This will not delete connectors.');
    if (!confirm) {
      return this.success('Cancelled.');
    }

    // Reset to defaults but keep activeConnector
    const config = app.getConfig();
    const { DEFAULT_CONFIG } = await import('../../config/types.js');

    app.updateConfig({
      ...DEFAULT_CONFIG,
      activeConnector: config.activeConnector,
      activeVendor: config.activeVendor,
      activeModel: config.activeModel,
    });

    return this.success('Configuration reset to defaults.');
  }
}
