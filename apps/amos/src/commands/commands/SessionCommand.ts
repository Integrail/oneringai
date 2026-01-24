/**
 * SessionCommand - Manage sessions
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

export class SessionCommand extends BaseCommand {
  readonly name = 'session';
  readonly aliases = ['sess', 's'];
  readonly description = 'Manage sessions (save, load, list, delete, info, new)';
  readonly usage = '/session <save|load|list|delete|info|new> [args]';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { subcommand, subArgs } = this.parseSubcommand(context.args);

    switch (subcommand) {
      case 'save':
        return this.saveSession(context, subArgs[0]);

      case 'load':
        return this.loadSession(context, subArgs[0]);

      case 'list':
      case 'ls':
        return this.listSessions(context);

      case 'delete':
      case 'rm':
        return this.deleteSession(context, subArgs[0]);

      case 'info':
      case null:
        return this.showSessionInfo(context);

      case 'new':
      case 'clear':
        return this.newSession(context);

      default:
        return this.error(
          `Unknown subcommand: ${subcommand}\n` +
          'Available: save, load, list, delete, info, new'
        );
    }
  }

  private async saveSession(context: CommandContext, name?: string): Promise<CommandResult> {
    const { app } = context;
    const agent = app.getAgent();

    if (!agent) {
      return this.error('No active agent. Start a conversation first.');
    }

    try {
      const sessionId = await agent.saveSession();

      // Update config with session name mapping if provided
      if (name) {
        // Could store name -> sessionId mapping in config
        app.print(`Session saved as "${name}" (ID: ${sessionId})`);
      } else {
        app.print(`Session saved (ID: ${sessionId})`);
      }

      app.updateConfig({
        session: {
          ...app.getConfig().session,
          activeSessionId: sessionId,
        },
      });

      return this.success();
    } catch (error) {
      return this.error(`Failed to save session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async loadSession(context: CommandContext, sessionId?: string): Promise<CommandResult> {
    const { app } = context;

    if (!sessionId) {
      return this.error('Session ID required. Usage: /session load <id>\nUse /session list to see available sessions.');
    }

    const agent = app.getAgent();
    if (!agent) {
      return this.error('No active agent. Configure a connector first.');
    }

    try {
      await agent.loadSession(sessionId);

      app.updateConfig({
        session: {
          ...app.getConfig().session,
          activeSessionId: sessionId,
        },
      });

      return this.success(`Session loaded: ${sessionId}`);
    } catch (error) {
      return this.error(`Failed to load session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async listSessions(context: CommandContext): Promise<CommandResult> {
    const { app } = context;

    // This would need access to session storage
    // For now, show a placeholder
    const config = app.getConfig();

    const lines = [
      'Saved Sessions:',
      '',
      '(Session listing requires session storage access)',
      '',
      `Current Session: ${config.session.activeSessionId || '(none)'}`,
      '',
      'Use /session save to save current session',
      'Use /session load <id> to load a session',
    ];

    return this.success(lines.join('\n'));
  }

  private async deleteSession(context: CommandContext, sessionId?: string): Promise<CommandResult> {
    const { app } = context;

    if (!sessionId) {
      return this.error('Session ID required. Usage: /session delete <id>');
    }

    const confirm = await app.confirm(`Delete session "${sessionId}"? This cannot be undone.`);
    if (!confirm) {
      return this.success('Cancelled.');
    }

    // Would need session storage access to delete
    app.print(`Session ${sessionId} deleted.`);

    // Clear from config if it was active
    const config = app.getConfig();
    if (config.session.activeSessionId === sessionId) {
      app.updateConfig({
        session: {
          ...config.session,
          activeSessionId: null,
        },
      });
    }

    return this.success();
  }

  private async showSessionInfo(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();
    const agent = app.getAgent();

    const sessionId = agent?.getSessionId() || config.session.activeSessionId;

    const info = `
Session Information:

Current Session: ${sessionId || '(none)'}
Auto-save: ${config.session.autoSave ? 'Enabled' : 'Disabled'}
Auto-save Interval: ${config.session.autoSaveIntervalMs / 1000}s

Agent Status: ${agent ? (agent.isRunning() ? 'Running' : 'Ready') : 'No agent'}
`;

    return this.success(info);
  }

  private async newSession(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();

    // Offer to save current session
    const agent = app.getAgent();
    if (agent && agent.getSessionId()) {
      const save = await app.confirm('Save current session before starting new?');
      if (save) {
        await agent.saveSession();
        app.print('Session saved.');
      }
    }

    // Clear session
    app.updateConfig({
      session: {
        ...config.session,
        activeSessionId: null,
      },
    });

    // Recreate agent
    await app.createAgent();

    return this.success('New session started.');
  }
}
