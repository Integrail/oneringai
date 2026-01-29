/**
 * ToolCommand - Manage tools at runtime
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

export class ToolCommand extends BaseCommand {
  readonly name = 'tool';
  readonly aliases = ['t', 'tools'];
  readonly description = 'Manage tools and permissions';
  readonly usage = '/tool <list|enable|disable|info|reload|approve|revoke|allowlist|blocklist|permissions> [name]';

  get detailedHelp(): string {
    return `
/tool - Manage Tools and Permissions

Control which tools are available to the agent and manage permissions.

USAGE:
  /tool                    List all tools with status
  /tool list               Same as above
  /tool enable <name>      Enable a tool
  /tool disable <name>     Disable a tool
  /tool info <name>        Show tool details and parameters
  /tool reload             Reload all tools from disk

PERMISSION COMMANDS:
  /tool approve <name>     Approve tool for this session
  /tool revoke <name>      Revoke tool approval
  /tool allowlist [add|remove|list|clear] [name]
                           Manage always-allowed tools
  /tool blocklist [add|remove|list|clear] [name]
                           Manage always-blocked tools
  /tool permissions [name] Show permission settings

EXAMPLES:
  /tool list               Show all tools
  /tool enable bash        Enable shell commands
  /tool info read_file     Show read_file tool details
  /tool allowlist add bash Always allow bash
  /tool blocklist rm -rf   Block dangerous commands

ALIASES:
  /t, /tools
`;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { subcommand, subArgs } = this.parseSubcommand(context.args);

    switch (subcommand) {
      case 'list':
      case 'ls':
      case null:
        return this.listTools(context);

      case 'enable':
      case 'on':
        return this.enableTool(context, subArgs[0]);

      case 'disable':
      case 'off':
        return this.disableTool(context, subArgs[0]);

      case 'info':
      case 'show':
        return this.showToolInfo(context, subArgs[0]);

      case 'reload':
      case 'refresh':
        return this.reloadTools(context);

      // Permission commands
      case 'approve':
        return this.approveTool(context, subArgs[0]);

      case 'revoke':
        return this.revokeTool(context, subArgs[0]);

      case 'allowlist':
      case 'allow':
        return this.allowlistTool(context, subArgs[0], subArgs[1]);

      case 'blocklist':
      case 'block':
        return this.blocklistTool(context, subArgs[0], subArgs[1]);

      case 'permissions':
      case 'perms':
      case 'perm':
        return this.showPermissions(context, subArgs[0]);

      default:
        return this.error(
          `Unknown subcommand: ${subcommand}\n` +
          'Available: list, enable, disable, info, reload, approve, revoke, allowlist, blocklist, permissions'
        );
    }
  }

  private async listTools(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const toolLoader = app.getToolLoader();
    const tools = toolLoader.getAllTools();
    const agent = app.getAgent();
    const config = app.getConfig();

    if (tools.length === 0) {
      return this.success('No tools available.');
    }

    const lines = ['Available Tools:', ''];

    // Group by namespace/category
    const categorized = new Map<string, typeof tools>();
    for (const tool of tools) {
      const category = this.getToolCategory(tool.definition.function.name);
      const list = categorized.get(category) || [];
      list.push(tool);
      categorized.set(category, list);
    }

    const approvedTools = agent?.getApprovedTools() ?? [];

    for (const [category, categoryTools] of categorized) {
      lines.push(`${category}:`);
      for (const tool of categoryTools) {
        const enabled = toolLoader.isEnabled(tool.definition.function.name);
        const name = tool.definition.function.name;
        const desc = tool.definition.function.description?.slice(0, 40) || '';

        // Determine permission marker
        let permMarker = '';
        if (config.permissions.blocklist.includes(name)) {
          permMarker = ' [blocked]';
        } else if (config.permissions.allowlist.includes(name)) {
          permMarker = ' [allowed]';
        } else if (approvedTools.includes(name)) {
          permMarker = ' [approved]';
        }

        const statusMarker = enabled ? '✓' : '○';
        lines.push(`  ${statusMarker} ${name.padEnd(22)}${permMarker.padEnd(12)} ${desc}${desc.length >= 40 ? '...' : ''}`);
      }
      lines.push('');
    }

    lines.push('Legend: ✓ enabled, ○ disabled');
    lines.push('Permission: [allowed] always allowed, [blocked] always blocked, [approved] session approved');
    lines.push('');
    lines.push('Commands: /tool enable|disable|info|approve|revoke|allowlist|blocklist|permissions <name>');

    return this.success(lines.join('\n'));
  }

  private async enableTool(context: CommandContext, name?: string): Promise<CommandResult> {
    if (!name) {
      return this.error('Tool name required. Usage: /tool enable <name>');
    }

    const { app } = context;
    const toolLoader = app.getToolLoader();
    const tool = toolLoader.getTool(name);

    if (!tool) {
      return this.error(`Tool "${name}" not found. Use /tool list to see available tools.`);
    }

    if (toolLoader.isEnabled(name)) {
      return this.success(`Tool "${name}" is already enabled.`);
    }

    toolLoader.enableTool(name);

    // Update config
    const config = app.getConfig();
    const enabledTools = config.tools.enabledTools.filter((t) => t !== name);
    enabledTools.push(name);
    const disabledTools = config.tools.disabledTools.filter((t) => t !== name);
    app.updateConfig({
      tools: {
        ...config.tools,
        enabledTools,
        disabledTools,
      },
    });

    return this.success(`Tool "${name}" enabled.`);
  }

  private async disableTool(context: CommandContext, name?: string): Promise<CommandResult> {
    if (!name) {
      return this.error('Tool name required. Usage: /tool disable <name>');
    }

    const { app } = context;
    const toolLoader = app.getToolLoader();
    const tool = toolLoader.getTool(name);

    if (!tool) {
      return this.error(`Tool "${name}" not found. Use /tool list to see available tools.`);
    }

    if (!toolLoader.isEnabled(name)) {
      return this.success(`Tool "${name}" is already disabled.`);
    }

    toolLoader.disableTool(name);

    // Update config
    const config = app.getConfig();
    const enabledTools = config.tools.enabledTools.filter((t) => t !== name);
    const disabledTools = config.tools.disabledTools.filter((t) => t !== name);
    disabledTools.push(name);
    app.updateConfig({
      tools: {
        ...config.tools,
        enabledTools,
        disabledTools,
      },
    });

    return this.success(`Tool "${name}" disabled.`);
  }

  private async showToolInfo(context: CommandContext, name?: string): Promise<CommandResult> {
    if (!name) {
      return this.error('Tool name required. Usage: /tool info <name>');
    }

    const { app } = context;
    const toolLoader = app.getToolLoader();
    const tool = toolLoader.getTool(name);

    if (!tool) {
      return this.error(`Tool "${name}" not found. Use /tool list to see available tools.`);
    }

    const func = tool.definition.function;
    const enabled = toolLoader.isEnabled(name);

    const params = func.parameters as {
      type: string;
      properties?: Record<string, { type: string; description?: string }>;
      required?: string[];
    };

    let paramsStr = '(none)';
    if (params.properties) {
      const required = new Set(params.required || []);
      paramsStr = Object.entries(params.properties)
        .map(([key, val]) => {
          const req = required.has(key) ? '*' : '';
          return `  ${key}${req}: ${val.type}${val.description ? ` - ${val.description}` : ''}`;
        })
        .join('\n');
    }

    // Get permission info
    const agent = app.getAgent();
    const config = app.getConfig();
    const isAllowlisted = config.permissions.allowlist.includes(name);
    const isBlocklisted = config.permissions.blocklist.includes(name);
    const isApproved = agent?.getApprovedTools().includes(name) ?? false;
    const needsApproval = agent?.toolNeedsApproval(name) ?? !isAllowlisted;
    const isBlocked = agent?.toolIsBlocked(name) ?? isBlocklisted;

    let permStatus = 'Normal';
    if (isAllowlisted) permStatus = 'Allowlisted (always allowed)';
    else if (isBlocklisted || isBlocked) permStatus = 'Blocklisted (always blocked)';
    else if (isApproved) permStatus = 'Session approved';
    else if (needsApproval) permStatus = 'Requires approval';

    const info = `
Tool: ${func.name}
Status: ${enabled ? 'Enabled' : 'Disabled'}
Permission: ${permStatus}

Description:
  ${func.description || '(no description)'}

Parameters:
${paramsStr}

(* = required)
`;

    return this.success(info);
  }

  private async reloadTools(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const toolLoader = app.getToolLoader();

    try {
      await toolLoader.reloadTools();
      const tools = toolLoader.getAllTools();
      return this.success(`Reloaded ${tools.length} tools.`);
    } catch (error) {
      return this.error(`Failed to reload tools: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getToolCategory(name: string): string {
    // Categorize by prefix or known categories
    if (name.startsWith('file_') || name.startsWith('fs_')) return 'File System';
    if (name.startsWith('web_') || name.startsWith('http_')) return 'Web';
    if (name.startsWith('db_') || name.startsWith('sql_')) return 'Database';
    if (name.startsWith('code_') || name.startsWith('exec_')) return 'Code Execution';
    if (name.startsWith('_')) return 'Internal';
    return 'General';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Permission Commands
  // ─────────────────────────────────────────────────────────────────────────────

  private async approveTool(context: CommandContext, name?: string): Promise<CommandResult> {
    if (!name) {
      return this.error('Tool name required. Usage: /tool approve <name>');
    }

    const { app } = context;
    const agent = app.getAgent();

    if (!agent) {
      return this.error('No active agent. Use /connector use <name> first.');
    }

    const toolLoader = app.getToolLoader();
    const tool = toolLoader.getTool(name);

    if (!tool) {
      return this.error(`Tool "${name}" not found. Use /tool list to see available tools.`);
    }

    if (agent.toolIsBlocked(name)) {
      return this.error(`Tool "${name}" is blocklisted. Use /tool blocklist remove ${name} first.`);
    }

    agent.approveToolForSession(name);

    // Update persistent config
    const config = app.getConfig();
    if (!config.permissions.allowlist.includes(name)) {
      // Optionally add to allowlist for persistence
    }

    return this.success(`Tool "${name}" approved for this session.`);
  }

  private async revokeTool(context: CommandContext, name?: string): Promise<CommandResult> {
    if (!name) {
      return this.error('Tool name required. Usage: /tool revoke <name>');
    }

    const { app } = context;
    const agent = app.getAgent();

    if (!agent) {
      return this.error('No active agent. Use /connector use <name> first.');
    }

    agent.revokeToolApproval(name);

    return this.success(`Tool "${name}" approval revoked. Will require approval again.`);
  }

  private async allowlistTool(
    context: CommandContext,
    action?: string,
    name?: string
  ): Promise<CommandResult> {
    const { app } = context;
    const agent = app.getAgent();

    // If only one arg, treat it as the tool name for "add"
    if (action && !name && action !== 'list' && action !== 'clear') {
      name = action;
      action = 'add';
    }

    switch (action) {
      case 'add':
        if (!name) {
          return this.error('Tool name required. Usage: /tool allowlist add <name>');
        }
        if (!agent) {
          return this.error('No active agent. Use /connector use <name> first.');
        }

        agent.allowlistTool(name);

        // Persist to config
        const configAdd = app.getConfig();
        if (!configAdd.permissions.allowlist.includes(name)) {
          configAdd.permissions.allowlist.push(name);
          // Remove from blocklist if present
          configAdd.permissions.blocklist = configAdd.permissions.blocklist.filter(t => t !== name);
          app.updateConfig({ permissions: configAdd.permissions });
        }

        return this.success(`Tool "${name}" added to allowlist (always allowed).`);

      case 'remove':
        if (!name) {
          return this.error('Tool name required. Usage: /tool allowlist remove <name>');
        }
        if (!agent) {
          return this.error('No active agent. Use /connector use <name> first.');
        }

        agent.removeFromAllowlist(name);

        // Update config
        const configRm = app.getConfig();
        configRm.permissions.allowlist = configRm.permissions.allowlist.filter(t => t !== name);
        app.updateConfig({ permissions: configRm.permissions });

        return this.success(`Tool "${name}" removed from allowlist.`);

      case 'list':
      case undefined:
        const allowlist = agent?.getAllowlist() ?? app.getConfig().permissions.allowlist;
        if (allowlist.length === 0) {
          return this.success('Allowlist is empty. Use /tool allowlist add <name> to add tools.');
        }
        return this.success(`Allowlisted tools (always allowed):\n  ${allowlist.join('\n  ')}`);

      case 'clear':
        if (agent) {
          const currentAllowlist = agent.getAllowlist();
          for (const tool of currentAllowlist) {
            agent.removeFromAllowlist(tool);
          }
        }
        const configClear = app.getConfig();
        configClear.permissions.allowlist = [];
        app.updateConfig({ permissions: configClear.permissions });
        return this.success('Allowlist cleared.');

      default:
        return this.error(
          `Unknown action: ${action}\n` +
          'Usage: /tool allowlist [add|remove|list|clear] [name]'
        );
    }
  }

  private async blocklistTool(
    context: CommandContext,
    action?: string,
    name?: string
  ): Promise<CommandResult> {
    const { app } = context;
    const agent = app.getAgent();

    // If only one arg, treat it as the tool name for "add"
    if (action && !name && action !== 'list' && action !== 'clear') {
      name = action;
      action = 'add';
    }

    switch (action) {
      case 'add':
        if (!name) {
          return this.error('Tool name required. Usage: /tool blocklist add <name>');
        }
        if (!agent) {
          return this.error('No active agent. Use /connector use <name> first.');
        }

        agent.blocklistTool(name);

        // Persist to config
        const configAdd = app.getConfig();
        if (!configAdd.permissions.blocklist.includes(name)) {
          configAdd.permissions.blocklist.push(name);
          // Remove from allowlist if present
          configAdd.permissions.allowlist = configAdd.permissions.allowlist.filter(t => t !== name);
          app.updateConfig({ permissions: configAdd.permissions });
        }

        return this.success(`Tool "${name}" added to blocklist (always blocked).`);

      case 'remove':
        if (!name) {
          return this.error('Tool name required. Usage: /tool blocklist remove <name>');
        }
        if (!agent) {
          return this.error('No active agent. Use /connector use <name> first.');
        }

        agent.removeFromBlocklist(name);

        // Update config
        const configRm = app.getConfig();
        configRm.permissions.blocklist = configRm.permissions.blocklist.filter(t => t !== name);
        app.updateConfig({ permissions: configRm.permissions });

        return this.success(`Tool "${name}" removed from blocklist.`);

      case 'list':
      case undefined:
        const blocklist = agent?.getBlocklist() ?? app.getConfig().permissions.blocklist;
        if (blocklist.length === 0) {
          return this.success('Blocklist is empty. Use /tool blocklist add <name> to block tools.');
        }
        return this.success(`Blocklisted tools (always blocked):\n  ${blocklist.join('\n  ')}`);

      case 'clear':
        if (agent) {
          const currentBlocklist = agent.getBlocklist();
          for (const tool of currentBlocklist) {
            agent.removeFromBlocklist(tool);
          }
        }
        const configClear = app.getConfig();
        configClear.permissions.blocklist = [];
        app.updateConfig({ permissions: configClear.permissions });
        return this.success('Blocklist cleared.');

      default:
        return this.error(
          `Unknown action: ${action}\n` +
          'Usage: /tool blocklist [add|remove|list|clear] [name]'
        );
    }
  }

  private async showPermissions(context: CommandContext, name?: string): Promise<CommandResult> {
    const { app } = context;
    const agent = app.getAgent();
    const config = app.getConfig();

    if (name) {
      // Show permissions for a specific tool
      const toolLoader = app.getToolLoader();
      const tool = toolLoader.getTool(name);

      if (!tool) {
        return this.error(`Tool "${name}" not found.`);
      }

      const isAllowlisted = config.permissions.allowlist.includes(name);
      const isBlocklisted = config.permissions.blocklist.includes(name);
      const isApproved = agent?.getApprovedTools().includes(name) ?? false;
      const needsApproval = agent?.toolNeedsApproval(name) ?? true;
      const isBlocked = agent?.toolIsBlocked(name) ?? isBlocklisted;
      const override = config.permissions.toolOverrides[name];

      const lines = [
        `Permission info for: ${name}`,
        '',
        `  Status:`,
        `    Allowlisted: ${isAllowlisted ? 'Yes' : 'No'}`,
        `    Blocklisted: ${isBlocklisted ? 'Yes' : 'No'}`,
        `    Session approved: ${isApproved ? 'Yes' : 'No'}`,
        `    Needs approval: ${needsApproval ? 'Yes' : 'No'}`,
        `    Currently blocked: ${isBlocked ? 'Yes' : 'No'}`,
        '',
        `  Overrides:`,
        override ? `    Scope: ${override.scope ?? 'default'}` : '    (none)',
        override?.riskLevel ? `    Risk level: ${override.riskLevel}` : '',
      ].filter(Boolean);

      return this.success(lines.join('\n'));
    }

    // Show general permission settings
    const approvedTools = agent?.getApprovedTools() ?? [];
    const allowlist = agent?.getAllowlist() ?? config.permissions.allowlist;
    const blocklist = agent?.getBlocklist() ?? config.permissions.blocklist;

    const lines = [
      'Tool Permission Settings:',
      '',
      `  Default scope: ${config.permissions.defaultScope}`,
      `  Default risk level: ${config.permissions.defaultRiskLevel}`,
      `  Interactive prompts: ${config.permissions.promptForApproval ? 'Enabled' : 'Disabled'}`,
      '',
      `  Allowlist (${allowlist.length}):`,
      allowlist.length > 0 ? allowlist.map(t => `    - ${t}`).join('\n') : '    (empty)',
      '',
      `  Blocklist (${blocklist.length}):`,
      blocklist.length > 0 ? blocklist.map(t => `    - ${t}`).join('\n') : '    (empty)',
      '',
      `  Session approved (${approvedTools.length}):`,
      approvedTools.length > 0 ? approvedTools.map(t => `    - ${t}`).join('\n') : '    (none)',
      '',
      'Commands:',
      '  /tool approve <name>       Approve for session',
      '  /tool revoke <name>        Revoke approval',
      '  /tool allowlist <name>     Always allow',
      '  /tool blocklist <name>     Always block',
      '  /tool permissions <name>   Show tool permissions',
    ];

    return this.success(lines.join('\n'));
  }
}
