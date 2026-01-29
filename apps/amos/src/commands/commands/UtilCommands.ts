/**
 * Utility Commands - clear, exit, status, history
 *
 * Phase 2 Improvements:
 * - StatusCommand now shows context metrics from UniversalAgent
 * - HistoryCommand now shows actual conversation history
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult, ContextMetrics } from '../../config/types.js';

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

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
 *
 * Phase 2: Now shows context metrics from UniversalAgent including:
 * - History message count
 * - Memory statistics
 * - Current mode and plan status
 */
export class StatusCommand extends BaseCommand {
  readonly name = 'status';
  readonly aliases = ['st'];
  readonly description = 'Show current status';
  readonly usage = '/status';

  get detailedHelp(): string {
    return `
/status - Show Current Status

Displays comprehensive status information about AMOS including:
  - Agent status (Ready, Running, Paused, Not initialized)
  - Active connector, vendor, and model
  - Planning configuration
  - Enabled tools count
  - Session information
  - Context metrics (history, memory, mode)

USAGE:
  /status

ALIASES:
  /st
`;
  }

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

    // Get context metrics (Phase 2)
    let contextSection = '';
    if (agent?.isReady()) {
      const metrics = await agent.getContextMetrics();
      if (metrics) {
        contextSection = this.formatContextMetrics(metrics);
      }
    }

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
${contextSection}
Type /help for available commands
`;

    return this.success(status);
  }

  /**
   * Format context metrics section
   */
  private formatContextMetrics(metrics: ContextMetrics): string {
    const modeIcon = metrics.mode === 'planning' ? '📋' :
                     metrics.mode === 'executing' ? '⚡' : '💬';

    return `
Context:
  Mode: ${modeIcon} ${metrics.mode}${metrics.hasPlan ? ' (plan active)' : ''}
  History: ${metrics.historyMessageCount} messages
  Memory: ${metrics.memoryStats.totalEntries} entries (${formatBytes(metrics.memoryStats.totalSizeBytes)})
`;
  }
}

/**
 * HistoryCommand - Show conversation history
 *
 * Phase 2: Now shows actual conversation history from UniversalAgent context
 */
export class HistoryCommand extends BaseCommand {
  readonly name = 'history';
  readonly aliases = ['hist'];
  readonly description = 'Show conversation history';
  readonly usage = '/history [count]';

  get detailedHelp(): string {
    return `
/history - Show Conversation History

Displays recent messages from the conversation with timestamps.
Shows user, assistant, and system messages.

USAGE:
  /history          Show last 10 messages
  /history [count]  Show last [count] messages

EXAMPLES:
  /history          Show last 10 messages
  /history 20       Show last 20 messages
  /history 5        Show last 5 messages

ALIASES:
  /hist
`;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { app, args } = context;
    const agent = app.getAgent();

    if (!agent?.isReady()) {
      return this.error('Agent not initialized. Start a conversation first.');
    }

    const count = args[0] ? parseInt(args[0]) : 10;
    const history = await agent.getConversationHistory(count);

    if (history.length === 0) {
      return this.success('No conversation history yet.\n\nStart a conversation to see history here.');
    }

    const lines: string[] = [
      `Last ${history.length} message${history.length !== 1 ? 's' : ''}:`,
      '',
    ];

    for (const entry of history) {
      const roleIcon = entry.role === 'user' ? '👤' :
                       entry.role === 'assistant' ? '🤖' : '⚙️';
      const roleLabel = entry.role.charAt(0).toUpperCase() + entry.role.slice(1);
      const time = entry.timestamp.toLocaleTimeString();

      // Truncate long content
      const maxLength = 200;
      const content = entry.content.length > maxLength
        ? entry.content.substring(0, maxLength) + '...'
        : entry.content;

      lines.push(`${roleIcon} [${time}] ${roleLabel}:`);
      lines.push(`   ${content.replace(/\n/g, '\n   ')}`);
      lines.push('');
    }

    lines.push('Use /history [count] to show more or fewer messages');

    return this.success(lines.join('\n'));
  }
}

/**
 * PlanCommand - Control planning mode settings
 *
 * Quick toggle for auto-planning behavior.
 */
export class PlanCommand extends BaseCommand {
  readonly name = 'plan';
  readonly aliases = ['planning'];
  readonly description = 'Control planning mode settings';
  readonly usage = '/plan [on|off|status]';

  get detailedHelp(): string {
    return `
/plan - Control Planning Mode Settings

Quick control over automatic planning behavior. When auto-detect is ON,
the agent will automatically create multi-step plans for complex requests.
When OFF, it will execute requests directly without planning.

USAGE:
  /plan           Show current planning settings
  /plan status    Same as above
  /plan on        Enable auto-planning detection
  /plan off       Disable auto-planning (execute directly)
  /plan toggle    Toggle auto-planning on/off

EXAMPLES:
  /plan off       Disable planning for simple requests
  /plan on        Re-enable automatic planning
  /plan           Check current settings

ALIASES:
  /planning
`;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { app, args } = context;
    const { subcommand } = this.parseSubcommand(args);

    switch (subcommand) {
      case 'on':
      case 'enable':
        return this.setAutoDetect(app, true);

      case 'off':
      case 'disable':
        return this.setAutoDetect(app, false);

      case 'toggle':
        const currentConfig = app.getConfig();
        return this.setAutoDetect(app, !currentConfig.planning.autoDetect);

      case 'status':
      case null:
        return this.showStatus(app);

      default:
        return this.error(`Unknown subcommand: ${subcommand}\n\nUsage: ${this.usage}`);
    }
  }

  private async setAutoDetect(app: any, enabled: boolean): Promise<CommandResult> {
    const config = app.getConfig();
    config.planning.autoDetect = enabled;
    app.updateConfig({ planning: config.planning });
    await app.saveConfig();

    // Recreate agent if it exists to pick up new settings
    if (app.getAgent()) {
      await app.createAgent();
    }

    const status = enabled ? 'ON' : 'OFF';
    const description = enabled
      ? 'Agent will automatically create plans for complex tasks.'
      : 'Agent will execute requests directly without planning.';

    return this.success(`Auto-planning: ${status}\n${description}`);
  }

  private showStatus(app: any): CommandResult {
    const config = app.getConfig();
    const planning = config.planning;

    const autoStatus = planning.autoDetect ? 'ON' : 'OFF';
    const enabledStatus = planning.enabled ? 'Yes' : 'No';
    const approvalStatus = planning.requireApproval ? 'Yes' : 'No';

    const lines = [
      'Planning Settings:',
      '',
      `  Auto-detect: ${autoStatus}`,
      `  Planning enabled: ${enabledStatus}`,
      `  Require approval: ${approvalStatus}`,
      '',
      'Commands:',
      '  /plan on      Enable auto-planning',
      '  /plan off     Disable auto-planning (direct execution)',
      '  /plan toggle  Toggle auto-planning',
    ];

    return this.success(lines.join('\n'));
  }
}
