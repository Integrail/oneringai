/**
 * VendorCommand - Switch or list vendors at runtime
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';
import { Vendor } from '@oneringai/agents';

export class VendorCommand extends BaseCommand {
  readonly name = 'vendor';
  readonly aliases = ['v'];
  readonly description = 'Switch vendor or list available vendors';
  readonly usage = '/vendor [name|list|info]';

  private vendorInfo: Record<string, { name: string; defaultModel: string; description: string }> = {
    [Vendor.OpenAI]: {
      name: 'OpenAI',
      defaultModel: 'gpt-4o',
      description: 'GPT-4, GPT-4o, GPT-3.5, o1, o1-mini',
    },
    [Vendor.Anthropic]: {
      name: 'Anthropic',
      defaultModel: 'claude-3-opus-20240229',
      description: 'Claude 3 Opus, Sonnet, Haiku',
    },
    [Vendor.Google]: {
      name: 'Google AI',
      defaultModel: 'gemini-pro',
      description: 'Gemini Pro, Gemini Ultra',
    },
    [Vendor.GoogleVertex]: {
      name: 'Google Vertex AI',
      defaultModel: 'gemini-pro',
      description: 'Gemini via Vertex AI',
    },
    [Vendor.Groq]: {
      name: 'Groq',
      defaultModel: 'llama3-70b-8192',
      description: 'Fast inference for Llama, Mixtral',
    },
    [Vendor.Together]: {
      name: 'Together AI',
      defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
      description: 'Open source models hosted',
    },
    [Vendor.Grok]: {
      name: 'xAI Grok',
      defaultModel: 'grok-1',
      description: 'xAI Grok models',
    },
    [Vendor.DeepSeek]: {
      name: 'DeepSeek',
      defaultModel: 'deepseek-chat',
      description: 'DeepSeek coding and chat models',
    },
    [Vendor.Mistral]: {
      name: 'Mistral AI',
      defaultModel: 'mistral-large-latest',
      description: 'Mistral, Mixtral models',
    },
    [Vendor.Perplexity]: {
      name: 'Perplexity',
      defaultModel: 'pplx-70b-online',
      description: 'Perplexity online models',
    },
    [Vendor.Ollama]: {
      name: 'Ollama (Local)',
      defaultModel: 'llama3',
      description: 'Local models via Ollama',
    },
    [Vendor.Custom]: {
      name: 'Custom',
      defaultModel: 'custom',
      description: 'OpenAI-compatible API',
    },
  };

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, app } = context;

    if (args.length === 0 || args[0] === 'list') {
      return this.listVendors(context);
    }

    if (args[0] === 'info') {
      return this.showVendorInfo(context);
    }

    // Switch vendor
    const vendorName = args[0].toLowerCase();
    return this.switchVendor(context, vendorName);
  }

  private async listVendors(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();
    const currentVendor = config.activeVendor || config.defaults.vendor;
    const connectorManager = app.getConnectorManager();

    const lines = [
      'Available Vendors:',
      '',
    ];

    for (const [vendorId, info] of Object.entries(this.vendorInfo)) {
      const marker = vendorId === currentVendor ? '→ ' : '  ';
      const connectors = connectorManager.getVendorConnectors(vendorId);
      const connectorStr = connectors.length > 0
        ? ` (${connectors.length} connector${connectors.length > 1 ? 's' : ''})`
        : ' (no connectors)';

      lines.push(`${marker}${vendorId.padEnd(15)} ${info.name}${connectorStr}`);
      lines.push(`    ${info.description}`);
    }

    lines.push('');
    lines.push('Usage: /vendor <name> to switch');
    lines.push('Note: You need a connector for the vendor to use it.');

    return this.success(lines.join('\n'));
  }

  private async showVendorInfo(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();
    const currentVendor = config.activeVendor || config.defaults.vendor;
    const connectorManager = app.getConnectorManager();

    const info = this.vendorInfo[currentVendor];
    if (!info) {
      return this.success(`Current vendor: ${currentVendor}\n(No detailed info available)`);
    }

    const connectors = connectorManager.getVendorConnectors(currentVendor);
    const connectorList = connectors.length > 0
      ? connectors.map((c) => `  • ${c.name}`).join('\n')
      : '  (none configured)';

    const output = `
Vendor: ${info.name} (${currentVendor})

Description: ${info.description}
Default Model: ${info.defaultModel}

Configured Connectors:
${connectorList}

Current Settings:
  Active Model: ${config.activeModel || config.defaults.model}
  Active Connector: ${config.activeConnector || '(none)'}
`;

    return this.success(output);
  }

  private async switchVendor(context: CommandContext, vendorName: string): Promise<CommandResult> {
    const { app } = context;
    const connectorManager = app.getConnectorManager();

    // Validate vendor
    const vendorValues = Object.values(Vendor) as string[];
    if (!vendorValues.includes(vendorName)) {
      const suggestions = vendorValues
        .filter((v) => v.includes(vendorName))
        .slice(0, 3);

      let message = `Unknown vendor: ${vendorName}`;
      if (suggestions.length > 0) {
        message += `\nDid you mean: ${suggestions.join(', ')}?`;
      }
      message += '\nType /vendor list to see all vendors.';

      return this.error(message);
    }

    // Check for connectors
    const connectors = connectorManager.getVendorConnectors(vendorName);
    if (connectors.length === 0) {
      return this.error(
        `No connectors configured for ${vendorName}.\n` +
        `Use /connector add or /connector generate to create one.`
      );
    }

    // Get default model for vendor
    const vendorInfo = this.vendorInfo[vendorName];
    const defaultModel = vendorInfo?.defaultModel || 'default';

    // Update config
    app.updateConfig({
      activeVendor: vendorName,
      activeModel: defaultModel,
      activeConnector: connectors[0].name, // Use first connector
    });

    // Recreate agent with new vendor
    await app.createAgent();

    return this.success(
      `Switched to vendor: ${vendorName}\n` +
      `Using connector: ${connectors[0].name}\n` +
      `Default model: ${defaultModel}`
    );
  }
}
