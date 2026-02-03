/**
 * MCP Server Templates Registry
 *
 * Static registry of popular/public MCP servers with pre-configured settings.
 * These templates help users quickly add MCP servers without manual configuration.
 */

/**
 * Category for MCP server templates
 */
export type MCPTemplateCategory =
  | 'core'        // Official MCP reference servers
  | 'developer'   // GitHub, Git, code tools
  | 'database'    // PostgreSQL, SQLite, Redis
  | 'cloud'       // AWS, Azure, Google
  | 'productivity' // Notion, Slack, Linear
  | 'search'      // Brave, Exa, web search
  | 'utility';    // Test, reference servers

/**
 * Configuration for environment variable fields
 */
export interface EnvFieldConfig {
  /** Environment variable name (e.g., 'GITHUB_PERSONAL_ACCESS_TOKEN') */
  key: string;
  /** Human-readable label (e.g., 'GitHub Token') */
  label: string;
  /** Description of what this variable is for */
  description: string;
  /** Whether this field is required */
  required: boolean;
  /** Whether to hide input (for secrets) */
  secret?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * Configuration for argument fields that need user input
 */
export interface ArgFieldConfig {
  /** Placeholder in args to replace (e.g., '{PATH}') */
  key: string;
  /** Human-readable label (e.g., 'Directory Path') */
  label: string;
  /** Description of what this argument is for */
  description: string;
  /** Whether this field is required */
  required: boolean;
  /** Type of input */
  type: 'path' | 'string' | 'number';
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: string;
}

/**
 * MCP Server Template definition
 */
export interface MCPServerTemplate {
  /** Unique template ID (e.g., 'filesystem') */
  id: string;
  /** Default server name */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what this server does */
  description: string;
  /** Category for grouping */
  category: MCPTemplateCategory;
  /** Transport type */
  transport: 'stdio' | 'http' | 'https';
  /** Transport configuration */
  transportConfig: {
    /** Command for stdio transport */
    command?: string;
    /** Arguments for stdio transport */
    args?: string[];
    /** URL for HTTP transport */
    url?: string;
  };
  /** Required environment variables */
  requiredEnv?: EnvFieldConfig[];
  /** Required user-configurable arguments */
  requiredArgs?: ArgFieldConfig[];
  /** Link to documentation */
  docsUrl?: string;
  /** GitHub/source repository URL */
  sourceUrl?: string;
  /** Tags for filtering/search */
  tags?: string[];
  /** Popularity rating (1-5) for sorting */
  popularity?: number;
}

/**
 * Category metadata for display
 */
export const CATEGORY_INFO: Record<MCPTemplateCategory, { label: string; description: string }> = {
  core: { label: 'Core', description: 'Official MCP reference servers' },
  developer: { label: 'Developer', description: 'GitHub, Git, and code tools' },
  database: { label: 'Database', description: 'PostgreSQL, SQLite, Redis' },
  cloud: { label: 'Cloud', description: 'AWS, Google, Slack services' },
  productivity: { label: 'Productivity', description: 'Notion, Linear, project tools' },
  search: { label: 'Search', description: 'Web search providers' },
  utility: { label: 'Utility', description: 'Test and reference servers' },
};

/**
 * All category values in display order
 */
export const CATEGORY_ORDER: MCPTemplateCategory[] = [
  'core',
  'developer',
  'database',
  'cloud',
  'productivity',
  'search',
  'utility',
];

/**
 * Registry of MCP server templates
 */
export const MCP_TEMPLATES: MCPServerTemplate[] = [
  // === CORE ===
  {
    id: 'filesystem',
    name: 'filesystem',
    displayName: 'Filesystem',
    description: 'Secure file operations with configurable access controls',
    category: 'core',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '{PATH}'],
    },
    requiredArgs: [
      {
        key: '{PATH}',
        label: 'Directory Path',
        description: 'Path to the directory to allow file access',
        required: true,
        type: 'path',
        placeholder: '/path/to/directory',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    tags: ['files', 'read', 'write'],
    popularity: 5,
  },
  {
    id: 'memory',
    name: 'memory',
    displayName: 'Memory',
    description: 'Knowledge graph-based persistent memory system',
    category: 'core',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
    },
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    tags: ['memory', 'knowledge', 'persistence'],
    popularity: 5,
  },
  {
    id: 'git',
    name: 'git',
    displayName: 'Git',
    description: 'Tools to read, search, and manipulate Git repositories',
    category: 'core',
    transport: 'stdio',
    transportConfig: {
      command: 'uvx',
      args: ['mcp-server-git', '--repository', '{PATH}'],
    },
    requiredArgs: [
      {
        key: '{PATH}',
        label: 'Repository Path',
        description: 'Path to the Git repository',
        required: true,
        type: 'path',
        placeholder: '/path/to/repo',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    tags: ['git', 'version control', 'repository'],
    popularity: 5,
  },
  {
    id: 'fetch',
    name: 'fetch',
    displayName: 'Fetch',
    description: 'Web content fetching and conversion for efficient LLM usage',
    category: 'core',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
    },
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    tags: ['web', 'http', 'scraping'],
    popularity: 4,
  },
  {
    id: 'time',
    name: 'time',
    displayName: 'Time',
    description: 'Time and timezone conversion capabilities',
    category: 'core',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-time'],
    },
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    tags: ['time', 'timezone', 'date'],
    popularity: 3,
  },
  {
    id: 'sequential-thinking',
    name: 'sequential-thinking',
    displayName: 'Sequential Thinking',
    description: 'Dynamic and reflective problem-solving through thought sequences',
    category: 'core',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequentialthinking'],
    },
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    tags: ['thinking', 'reasoning', 'planning'],
    popularity: 4,
  },

  // === DEVELOPER ===
  {
    id: 'github',
    name: 'github',
    displayName: 'GitHub',
    description: 'Repository management, file operations, and GitHub API integration',
    category: 'developer',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
    },
    requiredEnv: [
      {
        key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        label: 'GitHub Token',
        description: 'Personal access token with repo permissions',
        required: true,
        secret: true,
        placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/github',
    tags: ['github', 'git', 'repository', 'code'],
    popularity: 5,
  },
  {
    id: 'gitlab',
    name: 'gitlab',
    displayName: 'GitLab',
    description: 'GitLab API integration for projects, issues, and merge requests',
    category: 'developer',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gitlab'],
    },
    requiredEnv: [
      {
        key: 'GITLAB_PERSONAL_ACCESS_TOKEN',
        label: 'GitLab Token',
        description: 'Personal access token',
        required: true,
        secret: true,
        placeholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      },
      {
        key: 'GITLAB_API_URL',
        label: 'GitLab URL',
        description: 'GitLab instance URL (default: gitlab.com)',
        required: false,
        placeholder: 'https://gitlab.com',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab',
    tags: ['gitlab', 'git', 'repository'],
    popularity: 3,
  },
  {
    id: 'playwright',
    name: 'playwright',
    displayName: 'Playwright',
    description: 'Browser automation enabling LLMs to interact with web pages',
    category: 'developer',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@executeautomation/playwright-mcp-server'],
    },
    docsUrl: 'https://github.com/executeautomation/playwright-mcp-server',
    tags: ['browser', 'automation', 'testing', 'web'],
    popularity: 5,
  },
  {
    id: 'puppeteer',
    name: 'puppeteer',
    displayName: 'Puppeteer',
    description: 'Browser automation and web scraping with Puppeteer',
    category: 'developer',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    },
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer',
    tags: ['browser', 'automation', 'scraping'],
    popularity: 4,
  },

  // === DATABASE ===
  {
    id: 'postgres',
    name: 'postgres',
    displayName: 'PostgreSQL',
    description: 'Read-only PostgreSQL database access with schema inspection',
    category: 'database',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', '{CONNECTION_STRING}'],
    },
    requiredArgs: [
      {
        key: '{CONNECTION_STRING}',
        label: 'Connection String',
        description: 'PostgreSQL connection URL',
        required: true,
        type: 'string',
        placeholder: 'postgresql://user:pass@localhost/db',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
    tags: ['database', 'sql', 'postgres'],
    popularity: 4,
  },
  {
    id: 'sqlite',
    name: 'sqlite',
    displayName: 'SQLite',
    description: 'SQLite database operations with business intelligence capabilities',
    category: 'database',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '{PATH}'],
    },
    requiredArgs: [
      {
        key: '{PATH}',
        label: 'Database Path',
        description: 'Path to SQLite database file',
        required: true,
        type: 'path',
        placeholder: '/path/to/database.db',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
    tags: ['database', 'sql', 'sqlite'],
    popularity: 4,
  },
  {
    id: 'redis',
    name: 'redis',
    displayName: 'Redis',
    description: 'Redis database operations for key-value storage',
    category: 'database',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-redis'],
    },
    requiredEnv: [
      {
        key: 'REDIS_URL',
        label: 'Redis URL',
        description: 'Redis connection URL',
        required: false,
        placeholder: 'redis://localhost:6379',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/redis',
    tags: ['database', 'redis', 'cache'],
    popularity: 3,
  },

  // === CLOUD ===
  {
    id: 'aws-kb',
    name: 'aws-kb',
    displayName: 'AWS Knowledge Base',
    description: 'Retrieval from AWS Bedrock Knowledge Bases using Bedrock Agent Runtime',
    category: 'cloud',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-aws-kb-retrieval'],
    },
    requiredEnv: [
      {
        key: 'AWS_ACCESS_KEY_ID',
        label: 'AWS Access Key',
        description: 'AWS access key ID',
        required: true,
        secret: true,
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
      },
      {
        key: 'AWS_SECRET_ACCESS_KEY',
        label: 'AWS Secret Key',
        description: 'AWS secret access key',
        required: true,
        secret: true,
      },
      {
        key: 'AWS_REGION',
        label: 'AWS Region',
        description: 'AWS region',
        required: false,
        placeholder: 'us-east-1',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/aws-kb-retrieval',
    tags: ['aws', 'bedrock', 'knowledge base'],
    popularity: 3,
  },
  {
    id: 'google-drive',
    name: 'google-drive',
    displayName: 'Google Drive',
    description: 'Search and access files in Google Drive',
    category: 'cloud',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gdrive'],
    },
    requiredEnv: [
      {
        key: 'GDRIVE_CREDENTIALS',
        label: 'Credentials JSON',
        description: 'Google Drive OAuth credentials JSON',
        required: true,
        secret: true,
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive',
    tags: ['google', 'drive', 'files', 'cloud'],
    popularity: 4,
  },
  {
    id: 'google-maps',
    name: 'google-maps',
    displayName: 'Google Maps',
    description: 'Location services, directions, and place information',
    category: 'cloud',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-google-maps'],
    },
    requiredEnv: [
      {
        key: 'GOOGLE_MAPS_API_KEY',
        label: 'Google Maps API Key',
        description: 'Google Maps Platform API key',
        required: true,
        secret: true,
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps',
    tags: ['google', 'maps', 'location', 'directions'],
    popularity: 3,
  },
  {
    id: 'slack',
    name: 'slack',
    displayName: 'Slack',
    description: 'Channel management and messaging capabilities for Slack',
    category: 'cloud',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
    },
    requiredEnv: [
      {
        key: 'SLACK_BOT_TOKEN',
        label: 'Bot Token',
        description: 'Slack bot user OAuth token (xoxb-...)',
        required: true,
        secret: true,
        placeholder: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx',
      },
      {
        key: 'SLACK_TEAM_ID',
        label: 'Team ID',
        description: 'Slack workspace team ID',
        required: true,
        placeholder: 'T01234567',
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/slack',
    tags: ['slack', 'messaging', 'communication'],
    popularity: 4,
  },

  // === PRODUCTIVITY ===
  {
    id: 'notion',
    name: 'notion',
    displayName: 'Notion',
    description: 'Search and access Notion pages and databases',
    category: 'productivity',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', 'notion-mcp-server'],
    },
    requiredEnv: [
      {
        key: 'NOTION_API_KEY',
        label: 'Notion API Key',
        description: 'Notion integration token',
        required: true,
        secret: true,
        placeholder: 'secret_xxxxxxxxxxxxxxxxxxxx',
      },
    ],
    docsUrl: 'https://github.com/makenotion/notion-mcp-server',
    tags: ['notion', 'notes', 'wiki', 'database'],
    popularity: 4,
  },
  {
    id: 'sentry',
    name: 'sentry',
    displayName: 'Sentry',
    description: 'Retrieve and analyze issues from Sentry.io',
    category: 'productivity',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sentry'],
    },
    requiredEnv: [
      {
        key: 'SENTRY_AUTH_TOKEN',
        label: 'Sentry Auth Token',
        description: 'Sentry authentication token',
        required: true,
        secret: true,
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sentry',
    tags: ['sentry', 'errors', 'monitoring', 'debugging'],
    popularity: 3,
  },
  {
    id: 'linear',
    name: 'linear',
    displayName: 'Linear',
    description: 'Interact with Linear issues and projects',
    category: 'productivity',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', 'mcp-linear'],
    },
    requiredEnv: [
      {
        key: 'LINEAR_API_KEY',
        label: 'Linear API Key',
        description: 'Linear API key',
        required: true,
        secret: true,
      },
    ],
    sourceUrl: 'https://github.com/jerhadf/linear-mcp-server',
    tags: ['linear', 'issues', 'project management'],
    popularity: 3,
  },

  // === SEARCH ===
  {
    id: 'brave-search',
    name: 'brave-search',
    displayName: 'Brave Search',
    description: 'Web and local search using Brave Search API',
    category: 'search',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
    },
    requiredEnv: [
      {
        key: 'BRAVE_API_KEY',
        label: 'Brave API Key',
        description: 'Brave Search API key',
        required: true,
        secret: true,
      },
    ],
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
    tags: ['search', 'web', 'brave'],
    popularity: 4,
  },
  {
    id: 'exa',
    name: 'exa',
    displayName: 'Exa',
    description: 'Neural search API for high-quality web content',
    category: 'search',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@exa-labs/mcp-server-exa'],
    },
    requiredEnv: [
      {
        key: 'EXA_API_KEY',
        label: 'Exa API Key',
        description: 'Exa API key',
        required: true,
        secret: true,
      },
    ],
    sourceUrl: 'https://github.com/exa-labs/exa-mcp-server',
    tags: ['search', 'web', 'neural'],
    popularity: 3,
  },
  {
    id: 'tavily',
    name: 'tavily',
    displayName: 'Tavily',
    description: 'AI-powered search engine for LLMs',
    category: 'search',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', 'tavily-mcp'],
    },
    requiredEnv: [
      {
        key: 'TAVILY_API_KEY',
        label: 'Tavily API Key',
        description: 'Tavily API key',
        required: true,
        secret: true,
      },
    ],
    tags: ['search', 'web', 'ai'],
    popularity: 3,
  },

  // === UTILITY ===
  {
    id: 'everything',
    name: 'everything',
    displayName: 'Everything (Test)',
    description: 'Reference server demonstrating all MCP protocol features',
    category: 'utility',
    transport: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    },
    docsUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/src/everything',
    tags: ['test', 'reference', 'demo'],
    popularity: 2,
  },
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: MCPTemplateCategory): MCPServerTemplate[] {
  return MCP_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): MCPServerTemplate | undefined {
  return MCP_TEMPLATES.find((t) => t.id === id);
}

/**
 * Search templates by query (searches name, displayName, description, tags)
 */
export function searchTemplates(query: string): MCPServerTemplate[] {
  const q = query.toLowerCase().trim();
  if (!q) return MCP_TEMPLATES;

  return MCP_TEMPLATES.filter((t) => {
    return (
      t.name.toLowerCase().includes(q) ||
      t.displayName.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}

/**
 * Get templates sorted by popularity
 */
export function getTemplatesSortedByPopularity(): MCPServerTemplate[] {
  return [...MCP_TEMPLATES].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
}
