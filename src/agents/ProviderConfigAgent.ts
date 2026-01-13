/**
 * Provider Config Agent
 *
 * AI-powered agent that helps users configure OAuth providers
 * Asks questions, guides setup, and generates JSON configuration
 */

import { OneRingAI } from '../client/OneRingAI.js';
import { Agent } from '../capabilities/agents/Agent.js';
import { MessageBuilder } from '../utils/messageBuilder.js';
import { InputItem } from '../domain/entities/Message.js';
import { ConnectorConfigResult } from '../domain/entities/Connector.js';

/**
 * Built-in agent for generating OAuth provider configurations
 */
export class ProviderConfigAgent {
  private agent: Agent | null = null;
  private conversationHistory: InputItem[] = [];

  constructor(private client: OneRingAI) {}

  /**
   * Start interactive configuration session
   * AI will ask questions and generate the connector config
   *
   * @param initialInput - Optional initial message (e.g., "I want to connect to GitHub")
   * @returns Promise<string | ConnectorConfigResult> - Either next question or final config
   */
  async run(initialInput?: string): Promise<string | ConnectorConfigResult> {
    // Create agent with specialized instructions
    this.agent = await this.client.agents.create({
      provider: this.getDefaultProvider(),
      model: this.getDefaultModel(),
      instructions: this.getSystemInstructions(),
      temperature: 0.1, // Very low temperature for consistent, focused behavior
      maxIterations: 10,
    });

    const builder = new MessageBuilder();

    // Add initial input or start prompt
    const startMessage = initialInput || 'I want to configure an OAuth provider';
    builder.addUserMessage(startMessage);

    // Store in history
    this.conversationHistory.push(...builder.build());

    // Run conversation - instructions from agent config are always included
    const response = await this.agent.run(this.conversationHistory);

    // Store assistant response in history
    this.conversationHistory.push(...response.output.filter(
      (item): item is InputItem =>
        item.type === 'message' || item.type === 'compaction'
    ));

    const responseText = response.output_text || '';

    // Check if AI generated a config
    if (responseText.includes('===CONFIG_START===')) {
      return this.extractConfig(responseText);
    }

    // Otherwise, return the conversational response
    return responseText;
  }

  /**
   * Continue conversation (for multi-turn interaction)
   *
   * @param userMessage - User's response
   * @returns Promise<string | ConnectorConfigResult> - Either next question or final config
   */
  async continue(userMessage: string): Promise<string | ConnectorConfigResult> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call run() first.');
    }

    const builder = new MessageBuilder();
    builder.addUserMessage(userMessage);

    // Update history with user message
    this.conversationHistory.push(...builder.build());

    // Run with full history
    const response = await this.agent.run(this.conversationHistory);

    // Store assistant response in history
    this.conversationHistory.push(...response.output.filter(
      (item): item is InputItem =>
        item.type === 'message' || item.type === 'compaction'
    ));

    const responseText = response.output_text || '';

    // Check if AI generated a config
    if (responseText.includes('===CONFIG_START===')) {
      return this.extractConfig(responseText);
    }

    // Otherwise, return the conversational response
    return responseText;
  }

  /**
   * Get system instructions for the agent
   */
  private getSystemInstructions(): string {
    return `You are a friendly OAuth Setup Assistant. Your ONLY job is to help users connect their apps to third-party services like Microsoft, Google, GitHub, etc.

YOU MUST NOT answer general questions. ONLY focus on helping set up API connections.

YOUR PROCESS (use NON-TECHNICAL, FRIENDLY language):

1. Ask which system they want to connect to (e.g., Microsoft, Google, GitHub, Salesforce, Slack)

2. Ask about HOW they want to use it (use SIMPLE language):
   - "Will your users log in with their [Provider] accounts?" → authorization_code
   - "Does your app need to access [Provider] without users logging in?" → client_credentials
   - "Is this just an API key from [Provider]?" → static_token

3. Ask BUSINESS questions about what they want to do (then YOU figure out the technical scopes):

   For Microsoft:
   - "Do you need to read user profiles?" → User.Read
   - "Do you need to read emails?" → Mail.Read
   - "Do you need to access calendar?" → Calendars.Read
   - "Do you need to read/write SharePoint files?" → Sites.Read.All or Sites.ReadWrite.All
   - "Do you need to access Teams?" → Team.ReadBasic.All
   - Combine multiple scopes if needed

   For Google:
   - "Do you need to read emails?" → https://www.googleapis.com/auth/gmail.readonly
   - "Do you need to access Google Drive?" → https://www.googleapis.com/auth/drive
   - "Do you need calendar access?" → https://www.googleapis.com/auth/calendar

   For GitHub:
   - "Do you need to read user info?" → user:email
   - "Do you need to access repositories?" → repo
   - "Do you need to read organization data?" → read:org

   For Salesforce:
   - "Do you need full access?" → full
   - "Do you need to access/manage data?" → api
   - "Do you need refresh tokens?" → refresh_token offline_access

4. DO NOT ask about redirect URI - it will be configured in code (use "http://localhost:3000/callback" as default)

5. Generate complete JSON configuration

CRITICAL RULES:
- Ask ONE simple question at a time
- Use BUSINESS language, NOT technical OAuth terms
- Ask "What do you want to do?" NOT "What scopes do you need?"
- YOU translate business needs into technical scopes
- Be friendly and conversational
- Provide specific setup URLs (e.g., https://portal.azure.com for Microsoft, https://github.com/settings/developers for GitHub)
- When you have all info, IMMEDIATELY output the config in this EXACT format:

===CONFIG_START===
{
  "name": "github",
  "config": {
    "displayName": "GitHub API",
    "description": "Access GitHub repositories and user data",
    "baseURL": "https://api.github.com",
    "auth": {
      "type": "oauth",
      "flow": "authorization_code",
      "clientId": "ENV:GITHUB_CLIENT_ID",
      "clientSecret": "ENV:GITHUB_CLIENT_SECRET",
      "authorizationUrl": "https://github.com/login/oauth/authorize",
      "tokenUrl": "https://github.com/login/oauth/access_token",
      "redirectUri": "http://localhost:3000/callback",
      "scope": "user:email repo"
    }
  },
  "setupInstructions": "1. Go to https://github.com/settings/developers\\n2. Create New OAuth App\\n3. Set Authorization callback URL\\n4. Copy Client ID and Client Secret",
  "envVariables": ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  "setupUrl": "https://github.com/settings/developers"
}
===CONFIG_END===

Use "ENV:VARIABLE_NAME" for values that should come from environment variables.

REMEMBER: Keep it conversational, ask one question at a time, and only output the config when you have all necessary information.`;
  }

  /**
   * Extract configuration from AI response
   */
  private extractConfig(responseText: string): ConnectorConfigResult {
    // Find config between markers
    const configMatch = responseText.match(/===CONFIG_START===\s*([\s\S]*?)\s*===CONFIG_END===/);

    if (!configMatch) {
      throw new Error('No configuration found in response. The AI may need more information.');
    }

    try {
      const configJson = configMatch[1]!.trim();
      const config = JSON.parse(configJson);

      return config as ConnectorConfigResult;
    } catch (error) {
      throw new Error(`Failed to parse configuration JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Get default provider for the agent
   */
  private getDefaultProvider(): string {
    // Try to find available provider from client config
    // For now, just use a common one
    return 'openai'; // Fallback, will be configurable
  }

  /**
   * Get default model
   */
  private getDefaultModel(): string {
    // Use GPT-4.1 for best instruction following
    return 'gpt-4.1';
  }

  /**
   * Reset conversation
   */
  reset(): void {
    this.conversationHistory = [];
    this.agent = null;
  }
}
