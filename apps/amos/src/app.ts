/**
 * AmosApp - Main application class
 *
 * Ties together all components: config, connectors, tools, agent, UI.
 */

import { join } from 'node:path';
import type { ToolFunction, ApprovalDecision } from '@oneringai/agents';
import { ConfigManager } from './config/ConfigManager.js';
import type { AmosConfig, IAmosApp, IConnectorManager, IToolLoader, IAgentRunner, ToolApprovalContext } from './config/types.js';
import { ConnectorManager } from './connectors/ConnectorManager.js';
import { ToolLoader } from './tools/ToolLoader.js';
import { AgentRunner } from './agent/AgentRunner.js';
import { Terminal } from './ui/Terminal.js';
import {
  CommandProcessor,
  HelpCommand,
  ModelCommand,
  VendorCommand,
  ConnectorCommand,
  ToolCommand,
  SessionCommand,
  ConfigCommand,
  ClearCommand,
  ExitCommand,
  StatusCommand,
  HistoryCommand,
} from './commands/index.js';

export class AmosApp implements IAmosApp {
  private configManager: ConfigManager;
  private connectorManager: ConnectorManager;
  private toolLoader: ToolLoader;
  private agentRunner: AgentRunner | null = null;
  private terminal: Terminal;
  private commandProcessor: CommandProcessor;
  private dataDir: string;
  private running: boolean = false;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;

    // Initialize components
    this.configManager = new ConfigManager(dataDir);
    this.connectorManager = new ConnectorManager(join(dataDir, 'connectors'));
    this.toolLoader = new ToolLoader(join(dataDir, 'tools'));
    this.terminal = new Terminal();
    this.commandProcessor = new CommandProcessor(this);

    // Register commands
    this.registerCommands();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    // Load config
    await this.configManager.load();
    const config = this.configManager.get();

    // Initialize terminal
    this.terminal.initialize();
    this.terminal.setColorEnabled(config.ui.colorOutput);

    // Initialize connector manager
    await this.connectorManager.initialize();

    // Initialize tool loader
    await this.toolLoader.initialize();
    this.toolLoader.applyConfig(config.tools.enabledTools, config.tools.disabledTools);

    // Register active connector if configured
    if (config.activeConnector) {
      try {
        this.connectorManager.registerConnector(config.activeConnector);
      } catch {
        // Connector might not exist anymore
        this.configManager.update({ activeConnector: null });
      }
    }

    // Create agent if we have an active connector
    if (config.activeConnector) {
      await this.createAgent();
    }
  }

  /**
   * Run the main REPL loop
   */
  async run(): Promise<void> {
    this.running = true;

    // Print welcome banner
    this.printBanner();

    // Check if we need initial setup
    const connectors = this.connectorManager.list();
    if (connectors.length === 0) {
      this.terminal.printWarning('\nNo connectors configured. Let\'s set one up!\n');
      await this.runInitialSetup();
    }

    // Main REPL loop
    while (this.running) {
      try {
        const input = await this.terminal.readline(this.getPrompt());

        if (input === null) {
          // EOF
          this.running = false;
          break;
        }

        const trimmed = input.trim();
        if (!trimmed) continue;

        await this.processInput(trimmed);
      } catch (error) {
        this.terminal.printError(
          `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Cleanup
    await this.shutdown();
  }

  /**
   * Process user input
   */
  private async processInput(input: string): Promise<void> {
    // Check if it's a command
    if (this.commandProcessor.isCommand(input)) {
      const result = await this.commandProcessor.execute(input);

      if (result.clearScreen) {
        this.terminal.clear();
      }

      if (result.message) {
        if (result.success) {
          this.terminal.print(result.message);
        } else {
          this.terminal.printError(result.message);
        }
      }

      if (result.shouldExit) {
        this.running = false;
      }

      return;
    }

    // Otherwise, send to agent
    await this.runAgent(input);
  }

  /**
   * Run the agent with input
   */
  private async runAgent(input: string): Promise<void> {
    if (!this.agentRunner || !this.agentRunner.isReady()) {
      this.terminal.printError(
        'No agent configured. Use /connector add to set up a connector first.'
      );
      return;
    }

    const config = this.configManager.get();

    try {
      if (config.ui.streamResponses) {
        // Streaming mode
        let hasOutput = false;

        for await (const event of this.agentRunner.stream(input)) {
          switch (event.type) {
            case 'text:delta':
              if (!hasOutput) {
                this.terminal.print(''); // New line before response
                hasOutput = true;
              }
              this.terminal.write(event.delta || '');
              break;

            case 'text:done':
              if (hasOutput) {
                this.terminal.print(''); // End the line
              }
              break;

            case 'mode:changed':
              this.terminal.printDim(`\n[Mode: ${event.fromMode} → ${event.toMode}]`);
              break;

            case 'plan:created':
              if (event.plan) {
                this.terminal.printInfo('\n📋 Plan created:');
                this.terminal.print(`  Goal: ${event.plan.goal}`);
                event.plan.tasks.forEach((t, i) => {
                  this.terminal.print(`  ${i + 1}. ${t.name}`);
                });
              }
              break;

            case 'task:started':
              if (event.task) {
                this.terminal.printDim(`\n⏳ Starting: ${event.task.name}`);
              }
              break;

            case 'task:completed':
              if (event.task) {
                this.terminal.printSuccess(`✓ Completed: ${event.task.name}`);
              }
              break;

            case 'task:failed':
              if (event.task) {
                this.terminal.printError(`✗ Failed: ${event.task.name}`);
              }
              break;

            case 'tool:start':
              if (event.tool && config.ui.showTiming) {
                this.terminal.printDim(`  🔧 ${event.tool.name}...`);
              }
              break;

            case 'tool:complete':
              // Tool completed (already shown)
              break;

            case 'error':
              this.terminal.printError(`Error: ${event.error?.message || 'Unknown error'}`);
              break;

            case 'done':
              if (config.ui.showTokenUsage && event.usage) {
                this.terminal.printDim(
                  `\n[Tokens: ${event.usage.inputTokens} in / ${event.usage.outputTokens} out]`
                );
              }
              break;
          }
        }
      } else {
        // Non-streaming mode
        const spinner = this.terminal.showSpinner('Thinking...');

        try {
          const response = await this.agentRunner.run(input);
          spinner.stop();

          this.terminal.print('\n' + response.text);

          if (response.plan && response.needsUserAction) {
            this.terminal.printInfo('\n📋 Plan requires approval:');
            this.terminal.print(`  Goal: ${response.plan.goal}`);
            response.plan.tasks.forEach((t, i) => {
              this.terminal.print(`  ${i + 1}. ${t.name}`);
            });
            this.terminal.print('\nType "approve" to proceed or "reject" to cancel.');
          }

          if (config.ui.showTokenUsage && response.usage) {
            this.terminal.printDim(
              `\n[Tokens: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out]`
            );
          }

          if (config.ui.showTiming && response.duration) {
            this.terminal.printDim(`[Time: ${(response.duration / 1000).toFixed(2)}s]`);
          }
        } catch (error) {
          spinner.stop();
          throw error;
        }
      }
    } catch (error) {
      this.terminal.printError(
        `Agent error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run initial setup wizard
   */
  private async runInitialSetup(): Promise<void> {
    this.terminal.print('=== Initial Setup ===\n');

    // Execute connector add command
    const result = await this.commandProcessor.execute('/connector add');

    if (result.success) {
      this.terminal.printSuccess('\nSetup complete! You can now start chatting.');
      this.terminal.print('Type /help for available commands.\n');
    } else {
      this.terminal.printWarning(
        '\nSetup incomplete. Use /connector add to configure later.\n'
      );
    }
  }

  /**
   * Print welcome banner
   */
  private printBanner(): void {
    const banner = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     █████╗ ███╗   ███╗ ██████╗ ███████╗                                       ║
║    ██╔══██╗████╗ ████║██╔═══██╗██╔════╝                                       ║
║    ███████║██╔████╔██║██║   ██║███████╗                                       ║
║    ██╔══██║██║╚██╔╝██║██║   ██║╚════██║                                       ║
║    ██║  ██║██║ ╚═╝ ██║╚██████╔╝███████║                                       ║
║    ╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝                                       ║
║                                                                               ║
║              Advanced Multimodal Orchestration System                         ║
║                     Powered by OneRing AI Agents                              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;
    this.terminal.print(banner);

    const config = this.configManager.get();
    if (config.activeConnector) {
      this.terminal.printDim(
        `Active: ${config.activeConnector} | Model: ${config.activeModel || config.defaults.model}`
      );
    }
    this.terminal.print('');
    this.terminal.print('Type /help for commands, or just start chatting!');
    this.terminal.print('');
  }

  /**
   * Get the prompt string
   */
  private getPrompt(): string {
    const config = this.configManager.get();
    const mode = this.agentRunner?.getMode() || 'interactive';

    const modeIndicator = mode === 'planning' ? '📋 ' : mode === 'executing' ? '⚡ ' : '';
    const connectorPart = config.activeConnector
      ? `[${config.activeConnector}]`
      : '[no connector]';

    return `${modeIndicator}${connectorPart} > `;
  }

  /**
   * Register all commands
   */
  private registerCommands(): void {
    this.commandProcessor.registerAll([
      new HelpCommand(),
      new ModelCommand(),
      new VendorCommand(),
      new ConnectorCommand(),
      new ToolCommand(),
      new SessionCommand(),
      new ConfigCommand(),
      new ClearCommand(),
      new ExitCommand(),
      new StatusCommand(),
      new HistoryCommand(),
    ]);
  }

  /**
   * Shutdown the application
   */
  private async shutdown(): Promise<void> {
    this.terminal.print('\nShutting down...');

    // Save config
    if (this.configManager.isDirty()) {
      await this.configManager.save();
    }

    // Destroy agent
    if (this.agentRunner) {
      this.agentRunner.destroy();
    }

    // Close terminal
    this.terminal.close();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IAmosApp Implementation
  // ─────────────────────────────────────────────────────────────────────────────

  getConfig(): AmosConfig {
    return this.configManager.get();
  }

  updateConfig(partial: Partial<AmosConfig>): void {
    this.configManager.update(partial);
  }

  async saveConfig(): Promise<void> {
    await this.configManager.save();
  }

  getConnectorManager(): IConnectorManager {
    return this.connectorManager;
  }

  getToolLoader(): IToolLoader {
    return this.toolLoader;
  }

  getActiveTools(): ToolFunction[] {
    return this.toolLoader.getEnabledTools();
  }

  getAgent(): IAgentRunner | null {
    return this.agentRunner;
  }

  async createAgent(): Promise<void> {
    const config = this.configManager.get();

    if (!config.activeConnector) {
      throw new Error('No active connector configured');
    }

    // Ensure connector is registered
    if (!this.connectorManager.isRegistered(config.activeConnector)) {
      this.connectorManager.registerConnector(config.activeConnector);
    }

    // Get model
    const model = config.activeModel || config.defaults.model;

    // Create agent runner
    this.agentRunner = new AgentRunner(
      config,
      this.toolLoader.getEnabledTools(),
      join(this.dataDir, 'sessions')
    );

    // Set up interactive approval handler
    if (config.permissions.promptForApproval) {
      this.agentRunner.setApprovalHandler(
        async (context: ToolApprovalContext): Promise<ApprovalDecision> => {
          return this.handleToolApproval(context);
        }
      );
    }

    await this.agentRunner.initialize(config.activeConnector, model);
  }

  /**
   * Handle interactive tool approval
   */
  private async handleToolApproval(context: ToolApprovalContext): Promise<ApprovalDecision> {
    const riskIndicator = context.riskLevel === 'critical' ? '⚠️  CRITICAL' :
                          context.riskLevel === 'high' ? '⚠️  HIGH RISK' :
                          context.riskLevel === 'medium' ? '⚡ MEDIUM RISK' : '';

    this.terminal.print('');
    this.terminal.printWarning(`Tool "${context.toolName}" requires approval ${riskIndicator}`);

    if (context.reason) {
      this.terminal.print(`  Reason: ${context.reason}`);
    }

    if (context.args) {
      try {
        const argsStr = typeof context.args === 'string'
          ? context.args
          : JSON.stringify(context.args, null, 2);
        if (argsStr.length < 500) {
          this.terminal.printDim(`  Arguments: ${argsStr}`);
        } else {
          this.terminal.printDim(`  Arguments: ${argsStr.slice(0, 200)}...`);
        }
      } catch {
        // Ignore JSON stringify errors
      }
    }

    const options = ['yes', 'yes-session', 'yes-always', 'no', 'no-block'] as const;
    type ApprovalOption = typeof options[number];

    this.terminal.print('');
    this.terminal.print('Options:');
    this.terminal.print('  yes         - Allow this call only');
    this.terminal.print('  yes-session - Allow for this session');
    this.terminal.print('  yes-always  - Always allow (add to allowlist)');
    this.terminal.print('  no          - Deny this call');
    this.terminal.print('  no-block    - Always block (add to blocklist)');

    const answer = await this.terminal.select<ApprovalOption>(
      'Allow tool execution?',
      [...options]
    );

    switch (answer) {
      case 'yes':
        return { approved: true, scope: 'once' };

      case 'yes-session':
        return { approved: true, scope: 'session' };

      case 'yes-always':
        // Also add to allowlist in config
        const configAllow = this.configManager.get();
        if (!configAllow.permissions.allowlist.includes(context.toolName)) {
          configAllow.permissions.allowlist.push(context.toolName);
          this.configManager.update({ permissions: configAllow.permissions });
        }
        return { approved: true, scope: 'always' };

      case 'no-block':
        // Add to blocklist in config
        const configBlock = this.configManager.get();
        if (!configBlock.permissions.blocklist.includes(context.toolName)) {
          configBlock.permissions.blocklist.push(context.toolName);
          this.configManager.update({ permissions: configBlock.permissions });
        }
        return { approved: false, reason: 'User blocked tool' };

      case 'no':
      default:
        return { approved: false, reason: 'User denied' };
    }
  }

  destroyAgent(): void {
    if (this.agentRunner) {
      this.agentRunner.destroy();
      this.agentRunner = null;
    }
  }

  print(message: string): void {
    this.terminal.print(message);
  }

  printError(message: string): void {
    this.terminal.printError(message);
  }

  printSuccess(message: string): void {
    this.terminal.printSuccess(message);
  }

  printInfo(message: string): void {
    this.terminal.printInfo(message);
  }

  async prompt(question: string): Promise<string> {
    return this.terminal.prompt(question);
  }

  async confirm(question: string): Promise<boolean> {
    return this.terminal.confirm(question);
  }

  async select<T extends string>(question: string, options: T[]): Promise<T> {
    return this.terminal.select(question, options);
  }
}
