/**
 * CustomToolDefinition - Entity for user-created custom tools
 *
 * Defines the structure for tools created by agents at runtime,
 * persisted to disk, and hydrated back into executable ToolFunctions.
 */

/**
 * Current format version for stored custom tool definitions
 */
export const CUSTOM_TOOL_DEFINITION_VERSION = 1;

/**
 * Test case for a custom tool
 */
export interface CustomToolTestCase {
  /** Human-readable label for this test case */
  label: string;
  /** Input to pass to the tool */
  input: unknown;
  /** Expected output (for validation) */
  expectedOutput?: unknown;
  /** Result from last test run */
  lastResult?: unknown;
  /** Error from last test run */
  lastError?: string;
}

/**
 * Metadata for a custom tool
 */
export interface CustomToolMetadata {
  /** Tags for categorization and search */
  tags?: string[];
  /** Category grouping */
  category?: string;
  /** Author/creator identifier */
  author?: string;
  /** The prompt that was used to generate this tool */
  generationPrompt?: string;
  /** Test cases for validation */
  testCases?: CustomToolTestCase[];
  /** Whether this tool requires a connector to function */
  requiresConnector?: boolean;
  /** Connector names this tool uses */
  connectorNames?: string[];
  /** Extensible metadata */
  [key: string]: unknown;
}

/**
 * Full custom tool definition - everything needed to hydrate into a ToolFunction
 */
export interface CustomToolDefinition {
  /** Format version for migration support */
  version: number;
  /** Unique tool name (must match /^[a-z][a-z0-9_]*$/) */
  name: string;
  /** Human-readable display name */
  displayName?: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
  /** JSON Schema for output (documentation only) */
  outputSchema?: Record<string, unknown>;
  /** JavaScript code to execute in VM sandbox */
  code: string;
  /** When the definition was created */
  createdAt: string;
  /** When the definition was last updated */
  updatedAt: string;
  /** Optional metadata */
  metadata?: CustomToolMetadata;
}

/**
 * Lightweight summary of a custom tool (no code) - used for listing
 */
export interface CustomToolSummary {
  /** Tool name */
  name: string;
  /** Human-readable display name */
  displayName?: string;
  /** Description */
  description: string;
  /** When created */
  createdAt: string;
  /** When last updated */
  updatedAt: string;
  /** Optional metadata */
  metadata?: CustomToolMetadata;
}
