/**
 * ExternalCommand - Manage external tools (search, scrape, fetch)
 *
 * External tools are tools that require external API connectors:
 * - web_search: Requires Serper, Brave, Tavily, or RapidAPI
 * - web_scrape: Requires ZenRows (or similar)
 * - web_fetch: Free, no connector needed
 *
 * Subcommands:
 *   /external                    - Show status of all external tools
 *   /external list               - List all external tools with status
 *   /external setup              - Interactive setup for external tools
 *   /external setup <type>       - Setup specific tool type (search/scrape)
 *   /external enable <tool>      - Enable an external tool
 *   /external disable <tool>     - Disable an external tool
 *   /external providers          - List available providers
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult, ExternalProviderType } from '../../config/types.js';
import {
  SEARCH_PROVIDERS,
  SCRAPE_PROVIDERS,
  type ExternalToolInfo,
  type ConnectorRequirement,
} from '../../tools/ExternalToolManager.js';

export class ExternalCommand extends BaseCommand {
  readonly name = 'external';
  readonly aliases = ['ext'];
  readonly description = 'Manage external tools (search, scrape, fetch)';
  readonly usage = '/external [list|setup|enable|disable|providers]';

  get detailedHelp(): string {
    return `
/external - Manage External Tools

External tools are web tools that require API connectors:
  - web_search: Search the web (Serper, Brave, Tavily, RapidAPI)
  - web_scrape: Scrape web pages (ZenRows)
  - web_fetch: Simple HTTP fetch (free, no connector needed)

USAGE:
  /external              Show status of all external tools
  /external list         Same as above
  /external setup        Interactive setup wizard
  /external setup <type> Setup specific type (search/scrape)
  /external enable <tool>  Enable a tool (fetch/search/scrape)
  /external disable <tool> Disable a tool
  /external providers    List available providers and their APIs

EXAMPLES:
  /external setup search      Setup web search with Serper
  /external enable fetch      Enable web_fetch tool
  /external disable scrape    Disable web_scrape tool
  /external providers         Show all available providers
`;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args } = context;
    const { subcommand, subArgs } = this.parseSubcommand(args);

    switch (subcommand) {
      case null:
      case 'list':
        return this.showStatus(context);
      case 'setup':
        return this.setupTool(context, subArgs);
      case 'enable':
        return this.enableTool(context, subArgs);
      case 'disable':
        return this.disableTool(context, subArgs);
      case 'providers':
        return this.listProviders(context);
      default:
        return this.error(`Unknown subcommand: ${subcommand}\n\nUsage: ${this.usage}`);
    }
  }

  /**
   * Show status of all external tools
   */
  private async showStatus(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const toolLoader = app.getToolLoader();
    const toolInfo = toolLoader.getExternalToolInfo();
    const config = app.getConfig().externalTools;

    if (toolInfo.length === 0) {
      return this.success('No external tools configured.\n\nRun /external setup to configure external tools.');
    }

    const lines: string[] = [
      `External Tools (${config.enabled ? 'enabled' : 'disabled'})`,
      '────────────────────────────────────',
    ];

    for (const tool of toolInfo) {
      const statusIcon = tool.available ? '✅' : tool.requiresConnector ? '⚠️' : '✅';
      const statusText = tool.available
        ? 'Ready'
        : tool.requiresConnector
          ? 'Needs connector'
          : 'Disabled';

      lines.push(`${statusIcon} ${tool.displayName}`);
      lines.push(`   Tool: ${tool.name}`);
      lines.push(`   Status: ${statusText}`);

      if (tool.connectorName) {
        lines.push(`   Connector: ${tool.connectorName}`);
      } else if (tool.requiresConnector) {
        lines.push(`   Connector: Not configured`);
        lines.push(`   Providers: ${tool.supportedProviders.join(', ')}`);
      }

      lines.push('');
    }

    lines.push('Use /external setup to configure a tool');
    lines.push('Use /external providers to see available providers');

    return this.success(lines.join('\n'));
  }

  /**
   * Setup an external tool
   */
  private async setupTool(context: CommandContext, args: string[]): Promise<CommandResult> {
    const { app } = context;
    const toolType = args[0]?.toLowerCase();

    if (toolType && toolType !== 'search' && toolType !== 'scrape') {
      return this.error(`Unknown tool type: ${toolType}\n\nAvailable types: search, scrape`);
    }

    // If no type specified, ask which one to setup
    if (!toolType) {
      const types = ['search', 'scrape', 'cancel'];
      const choice = await app.select(
        'Which external tool would you like to setup?',
        types
      );

      if (choice === 'cancel') {
        return this.success('Setup cancelled.');
      }

      return this.setupProvider(context, choice as ExternalProviderType);
    }

    return this.setupProvider(context, toolType as ExternalProviderType);
  }

  /**
   * Get provider info by type and name
   */
  private getProviderInfo(type: ExternalProviderType, name: string): ConnectorRequirement | undefined {
    if (type === 'search') {
      return SEARCH_PROVIDERS[name as keyof typeof SEARCH_PROVIDERS];
    } else {
      return SCRAPE_PROVIDERS[name as keyof typeof SCRAPE_PROVIDERS];
    }
  }

  /**
   * Get all providers for a type
   */
  private getProviders(type: ExternalProviderType): Record<string, ConnectorRequirement> {
    return type === 'search'
      ? (SEARCH_PROVIDERS as Record<string, ConnectorRequirement>)
      : (SCRAPE_PROVIDERS as Record<string, ConnectorRequirement>);
  }

  /**
   * Setup a provider for a tool type
   */
  private async setupProvider(
    context: CommandContext,
    type: ExternalProviderType
  ): Promise<CommandResult> {
    const { app } = context;
    const providers = this.getProviders(type);
    const providerNames = Object.keys(providers);

    app.print(`\nSetting up ${type} provider...`);
    app.print('Available providers:');

    for (const [name, info] of Object.entries(providers)) {
      app.print(`  - ${name}: ${info.displayName}`);
    }

    const providerChoice = await app.select(
      '\nChoose a provider:',
      [...providerNames, 'cancel']
    );

    if (providerChoice === 'cancel') {
      return this.success('Setup cancelled.');
    }

    const providerInfo = this.getProviderInfo(type, providerChoice);
    if (!providerInfo) {
      return this.error(`Unknown provider: ${providerChoice}`);
    }

    app.print(`\nSetting up ${providerInfo.displayName}...`);
    app.print(`You'll need an API key. Get one from the provider's website.`);
    app.print(`Environment variable hint: ${providerInfo.envVarHint}`);

    // Ask for connector name
    const defaultConnectorName = `${type}-${providerChoice}`;
    const connectorNameInput = await app.prompt(
      `Connector name (default: ${defaultConnectorName}): `
    );
    const connectorName = connectorNameInput.trim() || defaultConnectorName;

    // Check if connector already exists
    const connectorManager = app.getConnectorManager();
    const existingConnector = connectorManager.get(connectorName);

    if (existingConnector) {
      const useExisting = await app.confirm(
        `Connector '${connectorName}' already exists. Use it?`
      );

      if (useExisting) {
        return this.configureProvider(context, type, connectorName);
      }

      return this.success('Setup cancelled. Choose a different connector name.');
    }

    // Get API key
    const apiKey = await app.prompt('API Key: ');
    if (!apiKey.trim()) {
      return this.error('API key is required.');
    }

    // Create the connector
    try {
      await connectorManager.add({
        name: connectorName,
        vendor: providerInfo.serviceType, // Use serviceType as vendor for external services
        auth: {
          type: 'api_key',
          apiKey: apiKey.trim(),
        },
        baseURL: providerInfo.baseURL,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Register the connector
      connectorManager.registerConnector(connectorName);

      app.printSuccess(`Connector '${connectorName}' created.`);

      // Configure the provider
      return this.configureProvider(context, type, connectorName);
    } catch (error) {
      return this.error(
        `Failed to create connector: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Configure a provider for a tool type
   */
  private async configureProvider(
    context: CommandContext,
    type: ExternalProviderType,
    connectorName: string
  ): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();

    // Update config
    const externalTools = { ...config.externalTools };
    externalTools[type] = {
      connectorName,
      enabled: true,
    };

    app.updateConfig({ externalTools });
    await app.saveConfig();

    // Get fresh config after update
    const updatedConfig = app.getConfig();

    // Update ToolLoader's config and ExternalToolManager's config BEFORE reloading
    // This ensures the new connector settings are used when tools are recreated
    const toolLoader = app.getToolLoader();
    toolLoader.setConfig(updatedConfig);

    // Also update the ExternalToolManager directly
    const externalToolManager = toolLoader.getExternalToolManager();
    if (externalToolManager) {
      externalToolManager.updateConfig(updatedConfig.externalTools);
    }

    // Now reload tools with the updated config
    await toolLoader.reloadTools();

    // Recreate agent to pick up the new tools
    // Agent stores tools at creation time, so tool changes require recreation
    if (app.getAgent()?.isReady()) {
      await app.createAgent();
    }

    return this.success(
      `${type} tool configured with connector '${connectorName}'.\n` +
        `The web_${type} tool is now available.`
    );
  }

  /**
   * Enable an external tool
   */
  private async enableTool(context: CommandContext, args: string[]): Promise<CommandResult> {
    const { app } = context;
    const toolName = args[0]?.toLowerCase();

    if (!toolName) {
      return this.error('Please specify a tool name.\n\nUsage: /external enable <tool>\nTools: fetch, search, scrape');
    }

    const config = app.getConfig();
    const externalTools = { ...config.externalTools };

    switch (toolName) {
      case 'fetch':
      case 'web_fetch':
        externalTools.webFetchEnabled = true;
        break;

      case 'search':
      case 'web_search':
        if (!externalTools.search?.connectorName) {
          return this.error(
            'Search tool has no connector configured.\n' +
              'Run /external setup search to configure a search provider.'
          );
        }
        externalTools.search = { ...externalTools.search, enabled: true };
        break;

      case 'scrape':
      case 'web_scrape':
        if (!externalTools.scrape?.connectorName) {
          return this.error(
            'Scrape tool has no connector configured.\n' +
              'Run /external setup scrape to configure a scrape provider.'
          );
        }
        externalTools.scrape = { ...externalTools.scrape, enabled: true };
        break;

      default:
        return this.error(`Unknown tool: ${toolName}\n\nAvailable tools: fetch, search, scrape`);
    }

    app.updateConfig({ externalTools });
    await app.saveConfig();

    // Update configs and reload tools
    const updatedConfig = app.getConfig();
    const toolLoader = app.getToolLoader();
    toolLoader.setConfig(updatedConfig);
    const externalToolManager = toolLoader.getExternalToolManager();
    if (externalToolManager) {
      externalToolManager.updateConfig(updatedConfig.externalTools);
    }
    await toolLoader.reloadTools();

    // Recreate agent to pick up the new tools
    if (app.getAgent()?.isReady()) {
      await app.createAgent();
    }

    return this.success(`Tool '${toolName}' enabled.`);
  }

  /**
   * Disable an external tool
   */
  private async disableTool(context: CommandContext, args: string[]): Promise<CommandResult> {
    const { app } = context;
    const toolName = args[0]?.toLowerCase();

    if (!toolName) {
      return this.error('Please specify a tool name.\n\nUsage: /external disable <tool>\nTools: fetch, search, scrape');
    }

    const config = app.getConfig();
    const externalTools = { ...config.externalTools };

    switch (toolName) {
      case 'fetch':
      case 'web_fetch':
        externalTools.webFetchEnabled = false;
        break;

      case 'search':
      case 'web_search':
        if (externalTools.search) {
          externalTools.search = { ...externalTools.search, enabled: false };
        }
        break;

      case 'scrape':
      case 'web_scrape':
        if (externalTools.scrape) {
          externalTools.scrape = { ...externalTools.scrape, enabled: false };
        }
        break;

      default:
        return this.error(`Unknown tool: ${toolName}\n\nAvailable tools: fetch, search, scrape`);
    }

    app.updateConfig({ externalTools });
    await app.saveConfig();

    // Update configs and reload tools
    const updatedConfig = app.getConfig();
    const toolLoader = app.getToolLoader();
    toolLoader.setConfig(updatedConfig);
    const externalToolManager = toolLoader.getExternalToolManager();
    if (externalToolManager) {
      externalToolManager.updateConfig(updatedConfig.externalTools);
    }
    await toolLoader.reloadTools();

    // Recreate agent to pick up the new tools
    if (app.getAgent()?.isReady()) {
      await app.createAgent();
    }

    return this.success(`Tool '${toolName}' disabled.`);
  }

  /**
   * List available providers
   */
  private async listProviders(context: CommandContext): Promise<CommandResult> {
    const lines: string[] = [
      'Available External Tool Providers',
      '────────────────────────────────────',
      '',
      'Search Providers (for web_search):',
    ];

    for (const [name, info] of Object.entries(SEARCH_PROVIDERS)) {
      lines.push(`  ${name.padEnd(12)} ${info.displayName}`);
      lines.push(`  ${' '.repeat(12)} API: ${info.baseURL}`);
      lines.push(`  ${' '.repeat(12)} Env: ${info.envVarHint}`);
      lines.push('');
    }

    lines.push('Scrape Providers (for web_scrape):');

    for (const [name, info] of Object.entries(SCRAPE_PROVIDERS)) {
      lines.push(`  ${name.padEnd(12)} ${info.displayName}`);
      lines.push(`  ${' '.repeat(12)} API: ${info.baseURL}`);
      lines.push(`  ${' '.repeat(12)} Env: ${info.envVarHint}`);
      lines.push('');
    }

    lines.push('Native Tools (no connector needed):');
    lines.push('  web_fetch    Simple HTTP fetch for static pages');
    lines.push('');
    lines.push('Run /external setup <type> to configure a provider');

    return this.success(lines.join('\n'));
  }
}
