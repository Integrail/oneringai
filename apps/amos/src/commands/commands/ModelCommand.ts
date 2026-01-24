/**
 * ModelCommand - Switch or list models at runtime
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';
import { MODEL_REGISTRY, getModelsByVendor, getModelInfo } from '@oneringai/agents';

export class ModelCommand extends BaseCommand {
  readonly name = 'model';
  readonly aliases = ['m'];
  readonly description = 'Switch model or list available models';
  readonly usage = '/model [name|list|info]';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, app } = context;
    const config = app.getConfig();

    if (args.length === 0 || args[0] === 'list') {
      return this.listModels(context);
    }

    if (args[0] === 'info') {
      return this.showModelInfo(context);
    }

    // Switch to model
    const modelName = args[0];
    return this.switchModel(context, modelName);
  }

  private async listModels(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();
    const currentVendor = config.activeVendor || config.defaults.vendor;
    const currentModel = config.activeModel || config.defaults.model;

    // Get models for current vendor
    const vendorModels = getModelsByVendor(currentVendor as any);

    if (vendorModels.length === 0) {
      // Show all models if vendor has none registered
      const allModels = Object.values(MODEL_REGISTRY);
      const lines = [
        `All Available Models:`,
        '',
      ];

      for (const model of allModels) {
        const marker = model.name === currentModel ? '→ ' : '  ';
        const features: string[] = [];
        if (model.features.vision) features.push('vision');
        if (model.features.reasoning) features.push('reasoning');
        if (model.features.functionCalling) features.push('tools');
        const featureStr = features.length > 0 ? ` [${features.join(', ')}]` : '';
        lines.push(`${marker}${model.name}${featureStr}`);
      }

      return this.success(lines.join('\n'));
    }

    const lines = [
      `Models for ${currentVendor}:`,
      '',
    ];

    for (const model of vendorModels) {
      const marker = model.name === currentModel ? '→ ' : '  ';
      const features: string[] = [];
      if (model.features.vision) features.push('vision');
      if (model.features.reasoning) features.push('reasoning');
      if (model.features.functionCalling) features.push('tools');
      const featureStr = features.length > 0 ? ` [${features.join(', ')}]` : '';

      lines.push(`${marker}${model.name}${featureStr}`);
      lines.push(`    Context: ${(model.features.input.tokens / 1000).toFixed(0)}K in / ${(model.features.output.tokens / 1000).toFixed(0)}K out`);
    }

    lines.push('');
    lines.push('Usage: /model <model-name> to switch');

    return this.success(lines.join('\n'));
  }

  private async showModelInfo(context: CommandContext): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();
    const currentModel = config.activeModel || config.defaults.model;

    const modelInfo = getModelInfo(currentModel);

    if (!modelInfo) {
      return this.success(`Current model: ${currentModel}\n(No detailed info available)`);
    }

    const features = modelInfo.features;
    const featureFlags = [
      features.vision ? '✓ Vision' : '✗ Vision',
      features.reasoning ? '✓ Reasoning' : '✗ Reasoning',
      features.functionCalling ? '✓ Function Calling' : '✗ Function Calling',
      features.streaming ? '✓ Streaming' : '✗ Streaming',
      features.structuredOutput ? '✓ Structured Output' : '✗ Structured Output',
    ];

    const info = `
Model: ${modelInfo.name}
Vendor: ${modelInfo.provider}

Context Window:
  Input:  ${(features.input.tokens / 1000).toFixed(0)}K tokens
  Output: ${(features.output.tokens / 1000).toFixed(0)}K tokens

Pricing (per million tokens):
  Input:  $${features.input.cpm.toFixed(2)}
  Output: $${features.output.cpm.toFixed(2)}

Features:
  ${featureFlags.join('\n  ')}

Release: ${modelInfo.releaseDate || 'Unknown'}
`;

    return this.success(info);
  }

  private async switchModel(context: CommandContext, modelName: string): Promise<CommandResult> {
    const { app } = context;
    const config = app.getConfig();

    // Validate model exists (either in registry or accept any)
    const modelInfo = getModelInfo(modelName);

    // Update config
    app.updateConfig({ activeModel: modelName });

    // Update agent if exists
    const agent = app.getAgent();
    if (agent) {
      agent.setModel(modelName);
    }

    const infoStr = modelInfo
      ? ` (${modelInfo.provider})`
      : ' (custom model)';

    return this.success(`Switched to model: ${modelName}${infoStr}`);
  }
}
