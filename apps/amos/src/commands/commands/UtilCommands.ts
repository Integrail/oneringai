/**
 * Utility Commands - clear, exit, etc.
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

/**
 * ClearCommand - Clear the screen
 */
export class ClearCommand extends BaseCommand {
  readonly name = 'clear';
  readonly aliases = ['cls'];
  readonly description = 'Clear the screen';
  readonly usage = '/clear';

  async execute(_context: CommandContext): Promise<CommandResult> {
    return this.clear();
  }
}

/**
 * ExitCommand - Exit AMOS
 */
export class ExitCommand extends BaseCommand {
  readonly name = 'exit';
  readonly aliases = ['quit', 'q', 'bye'];
  readonly description = 'Exit AMOS';
  readonly usage = '/exit';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();

    // Save session if auto-save is enabled and we have an agent
    const agent = app.getAgent();
    if (config.session.autoSave && agent) {
      try {
        await agent.saveSession();
        app.print('Session saved.');
      } catch {
        // Ignore save errors on exit
      }
    }

    // Save config
    await app.saveConfig();

    return this.exit('Goodbye!');
  }
}

/**
 * StatusCommand - Show current status
 */
export class StatusCommand extends BaseCommand {
  readonly name = 'status';
  readonly aliases = ['st'];
  readonly description = 'Show current status';
  readonly usage = '/status';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();
    const agent = app.getAgent();
    const toolLoader = app.getToolLoader();

    const agentStatus = agent
      ? agent.isRunning()
        ? 'Running'
        : agent.isPaused()
          ? 'Paused'
          : 'Ready'
      : 'Not initialized';

    const enabledTools = toolLoader.getEnabledTools();

    const status = `
╔═══════════════════════════════════════════════════════════════╗
║                      AMOS Status                              ║
╚═══════════════════════════════════════════════════════════════╝

Agent:
  Status: ${agentStatus}
  Connector: ${config.activeConnector || '(none)'}
  Vendor: ${config.activeVendor || config.defaults.vendor}
  Model: ${config.activeModel || config.defaults.model}

Planning:
  Enabled: ${config.planning.enabled ? 'Yes' : 'No'}
  Auto-detect: ${config.planning.autoDetect ? 'Yes' : 'No'}
  Require Approval: ${config.planning.requireApproval ? 'Yes' : 'No'}

Tools:
  Enabled: ${enabledTools.length} tools
  ${enabledTools.slice(0, 5).map((t) => t.definition.function.name).join(', ')}${enabledTools.length > 5 ? '...' : ''}

Session:
  ID: ${config.session.activeSessionId || '(none)'}
  Auto-save: ${config.session.autoSave ? 'Yes' : 'No'}

Type /help for available commands
`;

    return this.success(status);
  }
}

/**
 * HistoryCommand - Show conversation history
 */
export class HistoryCommand extends BaseCommand {
  readonly name = 'history';
  readonly aliases = ['hist'];
  readonly description = 'Show conversation history';
  readonly usage = '/history [count]';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args } = context;

    // This would need access to agent's conversation history
    const count = args[0] ? parseInt(args[0]) : 10;

    const lines = [
      `Last ${count} messages:`,
      '',
      '(Conversation history display coming soon)',
      '',
      'Use /session save to persist conversation',
    ];

    return this.success(lines.join('\n'));
  }
}
