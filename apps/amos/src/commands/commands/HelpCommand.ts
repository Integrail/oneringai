/**
 * HelpCommand - Display help information
 */

import { BaseCommand } from '../BaseCommand.js';
import type { CommandContext, CommandResult } from '../../config/types.js';

export class HelpCommand extends BaseCommand {
  readonly name = 'help';
  readonly aliases = ['h', '?'];
  readonly description = 'Display help information';
  readonly usage = '/help [command]';

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, app } = context;

    if (args.length === 0) {
      // Show general help
      const help = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         AMOS - Advanced Multimodal                            ║
║                          Orchestration System                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝

COMMANDS:
  /help [cmd]         Show help (or help for specific command)
  /model [name]       Switch model or list available models
  /vendor [name]      Switch vendor or list available vendors
  /connector <sub>    Manage connectors (add, edit, delete, list, generate)
  /tool <sub>         Manage tools & permissions (list, enable, approve, blocklist...)
  /prompt <sub>       Manage system prompt templates (list, use, create, edit...)
  /session <sub>      Manage sessions (save, load, list, delete)
  /config <sub>       View/edit configuration
  /clear              Clear screen
  /exit               Exit AMOS

CHAT:
  Just type your message to chat with the AI agent.
  The agent supports planning mode for complex tasks.

CODING AGENT:
  AMOS includes full developer tools (filesystem + shell).
  Use "/prompt use coding-agent" for autonomous coding capabilities.

EXAMPLES:
  /model gpt-4o            Switch to GPT-4o model
  /vendor anthropic        Switch to Anthropic
  /connector list          List all connectors
  /tool list               List available tools
  /prompt use coding-agent Enable coding agent mode

Type /help <command> for detailed help on a specific command.
`;
      return this.success(help);
    }

    // Show help for specific command
    const commandName = args[0].toLowerCase().replace(/^\//, '');

    const helpTexts: Record<string, string> = {
      model: `
/model - Model Management

USAGE:
  /model              List available models for current vendor
  /model <name>       Switch to specified model
  /model info         Show current model info

EXAMPLES:
  /model gpt-4o
  /model claude-3-opus-20240229
  /model gemini-pro
`,
      vendor: `
/vendor - Vendor Management

USAGE:
  /vendor             List available vendors
  /vendor <name>      Switch to specified vendor
  /vendor info        Show current vendor info

SUPPORTED VENDORS:
  openai, anthropic, google, google-vertex, groq,
  together, grok, deepseek, mistral, perplexity, ollama

EXAMPLES:
  /vendor anthropic
  /vendor openai
`,
      connector: `
/connector - Connector Management

USAGE:
  /connector list              List all connectors
  /connector add               Add a new connector (interactive)
  /connector edit <name>       Edit an existing connector
  /connector delete <name>     Delete a connector
  /connector generate          Generate a connector with AI assistance
  /connector use <name>        Switch to a connector
  /connector info [name]       Show connector details

EXAMPLES:
  /connector list
  /connector add
  /connector use openai-main
  /connector generate
`,
      tool: `
/tool - Tool Management & Permissions

USAGE:
  /tool list                   List all tools
  /tool enable <name>          Enable a tool
  /tool disable <name>         Disable a tool
  /tool info <name>            Show tool details
  /tool reload                 Reload custom tools

PERMISSIONS:
  /tool approve <name>         Approve tool for session
  /tool revoke <name>          Revoke tool approval
  /tool allowlist <name>       Always allow a tool
  /tool allowlist remove <n>   Remove from allowlist
  /tool blocklist <name>       Always block a tool
  /tool blocklist remove <n>   Remove from blocklist
  /tool permissions            Show permission settings
  /tool permissions <name>     Show tool's permissions

BUILT-IN TOOLS:
  Basic:      calculate, get_current_time, random_number, echo
  Filesystem: read_file, write_file, edit_file, glob, grep, list_directory
  Shell:      bash

  Use "/prompt use coding-agent" for full coding agent capabilities.

EXAMPLES:
  /tool list
  /tool enable web_search
  /tool approve execute_code
  /tool blocklist dangerous_tool
  /tool permissions
`,
      prompt: `
/prompt - System Prompt Template Management

USAGE:
  /prompt                      List all prompts
  /prompt list                 List all prompts
  /prompt show <name>          Show a prompt's content
  /prompt use <name>           Select a prompt for the session
  /prompt clear                Clear active prompt (use defaults)
  /prompt current              Show the currently active prompt
  /prompt create <name>        Create a new prompt template
  /prompt edit <name>          Edit an existing prompt
  /prompt delete <name>        Delete a prompt
  /prompt reload               Reload prompts from disk

PROMPTS DIRECTORY:
  Prompts are stored as .md files in data/prompts/
  Each file can include YAML frontmatter with a description:

  ---
  description: A helpful coding assistant
  ---
  Your prompt content here...

EXAMPLES:
  /prompt list
  /prompt use coding-assistant
  /prompt create research-agent
  /prompt show default
`,
      session: `
/session - Session Management

USAGE:
  /session save [name]         Save current session
  /session load <id>           Load a session
  /session list                List saved sessions
  /session delete <id>         Delete a session
  /session info                Show current session info
  /session new                 Start a new session

EXAMPLES:
  /session save my-project
  /session list
  /session load abc123
`,
      config: `
/config - Configuration Management

USAGE:
  /config                      Show current configuration
  /config get <key>            Get a config value
  /config set <key> <value>    Set a config value
  /config reset                Reset to defaults

CONFIG KEYS:
  defaults.temperature         Default temperature (0.0-2.0)
  defaults.maxOutputTokens     Default max tokens
  planning.enabled             Enable planning mode
  planning.autoDetect          Auto-detect complex tasks
  planning.requireApproval     Require approval for plans
  ui.showTokenUsage            Show token usage
  ui.streamResponses           Stream responses
  permissions.defaultScope     Default permission scope (once|session|always|never)
  permissions.promptForApproval  Interactive approval prompts (true|false)

EXAMPLES:
  /config get defaults.temperature
  /config set defaults.temperature 0.8
`,
    };

    const helpText = helpTexts[commandName];
    if (helpText) {
      return this.success(helpText);
    }

    return this.error(`Unknown command: ${commandName}. Type /help for available commands.`);
  }
}
