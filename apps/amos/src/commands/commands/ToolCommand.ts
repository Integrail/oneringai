/**
 * ToolCommand - Manage tools at runtime
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

export class ToolCommand extends BaseCommand {
  readonly name = 'tool';
  readonly aliases = ['t', 'tools'];
  readonly description = 'Manage tools (list, enable, disable, info, reload)';
  readonly usage = '/tool <list|enable|disable|info|reload> [name]';

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

      default:
        return this.error(
          `Unknown subcommand: ${subcommand}\n` +
          'Available: list, enable, disable, info, reload'
        );
    }
  }

  private async listTools(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const toolLoader = app.getToolLoader();
    const tools = toolLoader.getAllTools();

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

    for (const [category, categoryTools] of categorized) {
      lines.push(`${category}:`);
      for (const tool of categoryTools) {
        const enabled = toolLoader.isEnabled(tool.definition.function.name);
        const marker = enabled ? '✓' : '○';
        const name = tool.definition.function.name;
        const desc = tool.definition.function.description?.slice(0, 50) || '';
        lines.push(`  ${marker} ${name.padEnd(25)} ${desc}${desc.length >= 50 ? '...' : ''}`);
      }
      lines.push('');
    }

    lines.push('Legend: ✓ enabled, ○ disabled');
    lines.push('Use /tool enable <name> or /tool disable <name> to toggle');

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

    const info = `
Tool: ${func.name}
Status: ${enabled ? 'Enabled' : 'Disabled'}

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
}
