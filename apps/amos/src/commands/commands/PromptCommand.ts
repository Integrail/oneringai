/**
 * PromptCommand - Manage system prompt templates
 *
 * Subcommands:
 * - /prompt list - List all available prompts
 * - /prompt show <name> - Show a prompt's content
 * - /prompt use <name> - Select a prompt for the current session
 * - /prompt clear - Clear the active prompt (use defaults)
 * - /prompt create <name> - Create a new prompt
 * - /prompt edit <name> - Edit an existing prompt
 * - /prompt delete <name> - Delete a prompt
 * - /prompt current - Show the currently active prompt
 * - /prompt reload - Reload prompts from disk
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

export class PromptCommand extends BaseCommand {
  readonly name = 'prompt';
  readonly aliases = ['p', 'prompts'];
  readonly description = 'Manage system prompt templates';
  readonly usage = '/prompt <list|show|use|clear|create|edit|delete|current|reload> [args]';

  get detailedHelp(): string {
    return `
/prompt - Manage System Prompt Templates

System prompts define the agent's personality and capabilities.
Prompts are stored as markdown files in data/prompts/.

USAGE:
  /prompt              List all available prompts
  /prompt list         Same as above
  /prompt show <name>  Display a prompt's content
  /prompt use <name>   Set active prompt (recreates agent)
  /prompt current      Show the currently active prompt
  /prompt clear        Clear active prompt (use defaults)
  /prompt create <name> Create a new prompt interactively
  /prompt edit <name>  Edit an existing prompt
  /prompt delete <name> Delete a prompt
  /prompt reload       Reload prompts from disk

EXAMPLES:
  /prompt list               Show available prompts
  /prompt use coding-agent   Use the coding agent prompt
  /prompt show research      View the research prompt
  /prompt create my-prompt   Create a custom prompt
  /prompt clear              Reset to default instructions

ALIASES:
  /p, /prompts
`;
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { app, args } = context;
    const { subcommand, subArgs } = this.parseSubcommand(args);

    const promptManager = app.getPromptManager();

    switch (subcommand) {
      case 'list':
      case 'ls':
      case '':
        return this.listPrompts(app, promptManager);

      case 'show':
      case 'view':
        return this.showPrompt(app, promptManager, subArgs[0]);

      case 'use':
      case 'select':
      case 'set':
        return this.usePrompt(app, promptManager, subArgs[0]);

      case 'clear':
      case 'none':
        return this.clearPrompt(app, promptManager);

      case 'create':
      case 'new':
      case 'add':
        return this.createPrompt(app, promptManager, subArgs[0]);

      case 'edit':
      case 'update':
        return this.editPrompt(app, promptManager, subArgs[0]);

      case 'delete':
      case 'remove':
      case 'rm':
        return this.deletePrompt(app, promptManager, subArgs[0]);

      case 'current':
      case 'active':
        return this.showCurrent(app, promptManager);

      case 'reload':
      case 'refresh':
        return this.reloadPrompts(app, promptManager);

      default:
        return this.error(`Unknown subcommand: ${subcommand}\n\nUsage: ${this.usage}`);
    }
  }

  /**
   * List all available prompts
   */
  private async listPrompts(app: any, promptManager: any): Promise<CommandResult> {
    const prompts = promptManager.list();
    const activeName = promptManager.getActiveName?.() ?? app.getConfig().prompts.activePrompt;

    if (prompts.length === 0) {
      app.printInfo('No prompts found. Create one with: /prompt create <name>');
      return this.success();
    }

    app.print('\n📝 Available Prompts:\n');

    const headers = ['Name', 'Description', 'Active'];
    const rows = prompts.map((p: any) => [
      p.name,
      p.description ? (p.description.length > 50 ? p.description.slice(0, 47) + '...' : p.description) : '-',
      p.name === activeName ? '✓' : '',
    ]);

    app.print(this.formatTable(headers, rows));

    app.print(`\nTotal: ${prompts.length} prompt(s)`);
    if (activeName) {
      app.printInfo(`Active prompt: ${activeName}`);
    } else {
      app.printDim('No active prompt (using default system instructions)');
    }

    return this.success();
  }

  /**
   * Show a prompt's content
   */
  private async showPrompt(app: any, promptManager: any, name?: string): Promise<CommandResult> {
    if (!name) {
      return this.error('Please specify a prompt name: /prompt show <name>');
    }

    const prompt = promptManager.get(name);
    if (!prompt) {
      return this.error(`Prompt "${name}" not found`);
    }

    app.print(`\n📝 Prompt: ${prompt.name}\n`);

    if (prompt.description) {
      app.printDim(`Description: ${prompt.description}`);
    }

    app.print('\n--- Content ---\n');
    app.print(prompt.content);
    app.print('\n--- End ---\n');

    return this.success();
  }

  /**
   * Select a prompt for the current session
   */
  private async usePrompt(app: any, promptManager: any, name?: string): Promise<CommandResult> {
    if (!name) {
      // Show selection menu
      const prompts = promptManager.list();
      if (prompts.length === 0) {
        return this.error('No prompts available. Create one with: /prompt create <name>');
      }

      const options = prompts.map((p: any) => p.name);
      const selected = await app.select('Select a prompt:', options);
      name = selected;
    }

    const prompt = promptManager.get(name);
    if (!prompt) {
      return this.error(`Prompt "${name}" not found`);
    }

    // Set as active
    promptManager.setActive(name);

    // Update config
    const config = app.getConfig();
    config.prompts.activePrompt = name;
    app.updateConfig({ prompts: config.prompts });
    await app.saveConfig();

    // Recreate agent with new instructions
    if (app.getAgent()) {
      app.printInfo('Recreating agent with new prompt...');
      await app.createAgent();
    }

    return this.success(`Prompt "${name}" is now active`);
  }

  /**
   * Clear the active prompt
   */
  private async clearPrompt(app: any, promptManager: any): Promise<CommandResult> {
    promptManager.setActive(null);

    // Update config
    const config = app.getConfig();
    config.prompts.activePrompt = null;
    app.updateConfig({ prompts: config.prompts });
    await app.saveConfig();

    // Recreate agent
    if (app.getAgent()) {
      app.printInfo('Recreating agent with default instructions...');
      await app.createAgent();
    }

    return this.success('Active prompt cleared. Using default system instructions.');
  }

  /**
   * Create a new prompt
   */
  private async createPrompt(app: any, promptManager: any, name?: string): Promise<CommandResult> {
    if (!name) {
      name = await app.prompt('Enter prompt name (letters, numbers, hyphens, underscores):');
      if (!name) {
        return this.error('Prompt name is required');
      }
    }

    // Check if exists
    if (promptManager.get(name)) {
      return this.error(`Prompt "${name}" already exists. Use /prompt edit ${name} to modify.`);
    }

    // Get description
    const description = await app.prompt('Enter description (optional):');

    // Get content
    app.print('\nEnter prompt content (type END on a new line to finish):');
    const lines: string[] = [];
    let line: string;
    while ((line = await app.prompt('')) !== 'END') {
      lines.push(line);
    }

    const content = lines.join('\n');
    if (!content.trim()) {
      return this.error('Prompt content cannot be empty');
    }

    try {
      await promptManager.create(name, content, description);
      app.printSuccess(`Prompt "${name}" created successfully!`);

      const useNow = await app.confirm('Use this prompt now?');
      if (useNow) {
        return this.usePrompt(app, promptManager, name);
      }

      return this.success();
    } catch (error) {
      return this.error(`Failed to create prompt: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Edit an existing prompt
   */
  private async editPrompt(app: any, promptManager: any, name?: string): Promise<CommandResult> {
    if (!name) {
      const prompts = promptManager.list();
      if (prompts.length === 0) {
        return this.error('No prompts available to edit');
      }

      const options = prompts.map((p: any) => p.name);
      name = await app.select('Select a prompt to edit:', options);
    }

    const prompt = promptManager.get(name);
    if (!prompt) {
      return this.error(`Prompt "${name}" not found`);
    }

    app.print(`\nEditing prompt: ${name}`);
    app.print('\nCurrent content:');
    app.printDim(prompt.content.split('\n').slice(0, 5).join('\n') + (prompt.content.split('\n').length > 5 ? '\n...' : ''));

    // Ask what to edit
    const editWhat = await app.select('What would you like to edit?', [
      'content',
      'description',
      'both',
      'cancel',
    ]);

    if (editWhat === 'cancel') {
      return this.success('Edit cancelled');
    }

    let newContent = prompt.content;
    let newDescription = prompt.description;

    if (editWhat === 'description' || editWhat === 'both') {
      app.print(`\nCurrent description: ${prompt.description || '(none)'}`);
      newDescription = await app.prompt('Enter new description (or press Enter to keep):') || prompt.description;
    }

    if (editWhat === 'content' || editWhat === 'both') {
      app.print('\nEnter new content (type END on a new line to finish):');
      const lines: string[] = [];
      let line: string;
      while ((line = await app.prompt('')) !== 'END') {
        lines.push(line);
      }

      if (lines.length > 0) {
        newContent = lines.join('\n');
      }
    }

    try {
      await promptManager.update(name, newContent, newDescription);

      // If this is the active prompt, recreate agent
      const activeName = promptManager.getActiveName?.() ?? app.getConfig().prompts.activePrompt;
      if (activeName === name && app.getAgent()) {
        app.printInfo('Recreating agent with updated prompt...');
        await app.createAgent();
      }

      return this.success(`Prompt "${name}" updated successfully!`);
    } catch (error) {
      return this.error(`Failed to update prompt: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Delete a prompt
   */
  private async deletePrompt(app: any, promptManager: any, name?: string): Promise<CommandResult> {
    if (!name) {
      const prompts = promptManager.list();
      if (prompts.length === 0) {
        return this.error('No prompts available to delete');
      }

      const options = prompts.map((p: any) => p.name);
      name = await app.select('Select a prompt to delete:', options);
    }

    const prompt = promptManager.get(name);
    if (!prompt) {
      return this.error(`Prompt "${name}" not found`);
    }

    const confirmed = await app.confirm(`Are you sure you want to delete prompt "${name}"?`);
    if (!confirmed) {
      return this.success('Deletion cancelled');
    }

    try {
      const wasActive = promptManager.getActiveName?.() === name || app.getConfig().prompts.activePrompt === name;

      await promptManager.delete(name);

      // Update config if this was active
      if (wasActive) {
        const config = app.getConfig();
        config.prompts.activePrompt = null;
        app.updateConfig({ prompts: config.prompts });
        await app.saveConfig();

        if (app.getAgent()) {
          app.printInfo('Recreating agent with default instructions...');
          await app.createAgent();
        }
      }

      return this.success(`Prompt "${name}" deleted`);
    } catch (error) {
      return this.error(`Failed to delete prompt: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Show the currently active prompt
   */
  private async showCurrent(app: any, promptManager: any): Promise<CommandResult> {
    const active = promptManager.getActive();

    if (!active) {
      app.printInfo('No active prompt. Using default system instructions.');
      app.printDim('Set a prompt with: /prompt use <name>');
      return this.success();
    }

    return this.showPrompt(app, promptManager, active.name);
  }

  /**
   * Reload prompts from disk
   */
  private async reloadPrompts(app: any, promptManager: any): Promise<CommandResult> {
    try {
      await promptManager.reload();
      const prompts = promptManager.list();
      return this.success(`Reloaded ${prompts.length} prompt(s) from disk`);
    } catch (error) {
      return this.error(`Failed to reload prompts: ${error instanceof Error ? error.message : error}`);
    }
  }
}
