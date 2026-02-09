#!/usr/bin/env npx tsx
/**
 * Auto-generate tool registry from source files.
 *
 * This script scans all tool files in src/tools/ and extracts
 * tool definitions from both direct definitions and factory functions.
 *
 * Usage: npx tsx scripts/generate-tool-registry.ts
 * Or:    npm run generate:tools
 *
 * Output: src/tools/registry.generated.ts
 */

import { readdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TOOLS_DIR = join(ROOT, 'src/tools');
const OUTPUT_FILE = join(TOOLS_DIR, 'registry.generated.ts');

type ToolCategory = 'filesystem' | 'shell' | 'web' | 'code' | 'json' | 'connector' | 'other';

interface ToolMetadata {
  name: string;
  exportName: string;
  displayName: string;
  category: ToolCategory;
  description: string;
  importPath: string;
  requiresConnector: boolean;
  connectorServiceTypes?: string[];
  safeByDefault: boolean;
}

// Map directory names to categories
const dirToCategory: Record<string, ToolCategory> = {
  filesystem: 'filesystem',
  shell: 'shell',
  web: 'web',
  code: 'code',
  json: 'json',
  connector: 'connector',
};

// Tools that are safe by default (read-only or low risk)
const SAFE_TOOLS = new Set([
  'read_file',
  'glob',
  'grep',
  'list_directory',
  'web_fetch',
  'web_search',
  'web_scrape',
  'json_manipulate',
  'json_manipulator',
]);

// Tools that require a connector
const CONNECTOR_REQUIREMENTS: Record<string, string[]> = {
  web_search: ['serper', 'brave-search', 'tavily', 'rapidapi-websearch'],
  web_scrape: ['zenrows'],
};

function toDisplayName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function getToolDirs(): Promise<string[]> {
  const entries = await readdir(TOOLS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

async function getToolFiles(dir: string): Promise<string[]> {
  const dirPath = join(TOOLS_DIR, dir);
  const entries = await readdir(dirPath);
  return entries.filter(
    (f) =>
      f.endsWith('.ts') &&
      !f.endsWith('.test.ts') &&
      !f.endsWith('.d.ts') &&
      f !== 'index.ts' &&
      f !== 'types.ts' &&
      !f.startsWith('_')
  );
}

/**
 * Extract tool definition from source code using regex.
 * Handles both direct definitions and factory function patterns.
 */
async function extractToolFromSource(
  dir: string,
  file: string
): Promise<ToolMetadata | null> {
  const filePath = join(TOOLS_DIR, dir, file);
  const content = await readFile(filePath, 'utf-8');
  const category = dirToCategory[dir] || 'other';

  // Pattern: Look for function.name IMMEDIATELY after "function: {"
  // This is critical - the name must be the first property to avoid matching
  // name properties inside description strings (which contain examples)
  const nameMatch = content.match(/function:\s*\{\s*name:\s*['"]([^'"]+)['"]/);
  if (!nameMatch) {
    return null;
  }

  const name = nameMatch[1];

  // Extract description - find the description property that follows the name
  // Look for description: followed by backtick, single or double quote
  let description = '';
  const descStartMatch = content.match(/function:\s*\{[\s\S]*?description:\s*([`'"])/);
  if (descStartMatch) {
    const quote = descStartMatch[1];
    const descStartIndex = descStartMatch.index! + descStartMatch[0].length;
    // Find the closing quote (handling the fact that backtick strings can be multiline)
    let descEnd = descStartIndex;
    let escaped = false;
    for (let i = descStartIndex; i < content.length; i++) {
      const char = content[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        descEnd = i;
        break;
      }
    }
    const fullDesc = content.slice(descStartIndex, descEnd);
    // Get first sentence or first 200 chars
    description = fullDesc
      .split('\n\n')[0]
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }

  // Find the exported const name using line-by-line analysis
  // This avoids matching strings inside descriptions
  const lines = content.split('\n');
  let exportName: string | null = null;
  let factoryExportName: string | null = null;

  for (const line of lines) {
    // Skip lines that are clearly inside strings (start with quotes or have description-like content)
    const trimmedLine = line.trim();

    // Pattern 1: Factory pattern - "export const X = createYTool("
    const factoryMatch = trimmedLine.match(/^export\s+const\s+(\w+)\s*=\s*create\w+Tool\s*\(/);
    if (factoryMatch) {
      factoryExportName = factoryMatch[1];
      continue;
    }

    // Pattern 2: Direct definition with type annotation - "export const X: ToolFunction"
    const typedMatch = trimmedLine.match(/^export\s+const\s+(\w+)\s*:\s*ToolFunction/);
    if (typedMatch) {
      exportName = typedMatch[1];
      break; // Prefer typed exports
    }

    // Pattern 3: Direct definition with object - "export const X = {"
    const objectMatch = trimmedLine.match(/^export\s+const\s+(\w+)\s*=\s*\{/);
    if (objectMatch) {
      const potentialName = objectMatch[1];
      // Skip factory function declarations
      if (!potentialName.startsWith('create') || !potentialName.endsWith('Tool')) {
        exportName = potentialName;
      }
    }
  }

  // Determine final export name - prefer factory pattern result, then direct export
  const finalExportName = factoryExportName || exportName;

  if (!finalExportName) {
    return null;
  }

  return {
    name,
    exportName: finalExportName,
    displayName: toDisplayName(name),
    category,
    description,
    importPath: `./${dir}/${file.replace('.ts', '.js')}`,
    requiresConnector: CONNECTOR_REQUIREMENTS[name] !== undefined,
    connectorServiceTypes: CONNECTOR_REQUIREMENTS[name],
    safeByDefault: SAFE_TOOLS.has(name),
  };
}

async function generateRegistry(): Promise<void> {
  console.log('Generating tool registry from source files...\n');

  const tools: ToolMetadata[] = [];
  const dirs = await getToolDirs();

  for (const dir of dirs) {
    console.log(`Scanning ${dir}/...`);
    const files = await getToolFiles(dir);

    for (const file of files) {
      try {
        const metadata = await extractToolFromSource(dir, file);
        if (metadata) {
          console.log(`  ✓ ${metadata.name} (${metadata.exportName})`);
          tools.push(metadata);
        } else {
          console.log(`  - ${file} (no tool definition found)`);
        }
      } catch (error) {
        console.warn(`  ✗ ${file}: ${error}`);
      }
    }
  }

  if (tools.length === 0) {
    console.error('\nNo tools found! Check the tool file patterns.');
    process.exit(1);
  }

  // Sort by category then name
  tools.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  // Generate imports
  const imports = tools
    .map((t) => `import { ${t.exportName} } from '${t.importPath}';`)
    .join('\n');

  // Generate registry entries
  const registryEntries = tools
    .map((t) => {
      const lines = [
        `    name: '${t.name}',`,
        `    exportName: '${t.exportName}',`,
        `    displayName: '${t.displayName}',`,
        `    category: '${t.category}',`,
        `    description: ${JSON.stringify(t.description)},`,
        `    tool: ${t.exportName},`,
        `    safeByDefault: ${t.safeByDefault},`,
      ];
      if (t.requiresConnector) {
        lines.push(`    requiresConnector: true,`);
        lines.push(`    connectorServiceTypes: ${JSON.stringify(t.connectorServiceTypes)},`);
      }
      return `  {\n${lines.join('\n')}\n  }`;
    })
    .join(',\n');

  const output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 *
 * Generated by: scripts/generate-tool-registry.ts
 * Generated at: ${new Date().toISOString()}
 *
 * To regenerate: npm run generate:tools
 */

import type { ToolFunction } from '../domain/entities/Tool.js';

${imports}

/** Tool category for grouping */
export type ToolCategory = 'filesystem' | 'shell' | 'web' | 'code' | 'json' | 'connector' | 'other';

/** Metadata for a tool in the registry */
export interface ToolRegistryEntry {
  /** Tool name (matches definition.function.name) */
  name: string;
  /** Export variable name */
  exportName: string;
  /** Human-readable display name */
  displayName: string;
  /** Category for grouping */
  category: ToolCategory;
  /** Brief description */
  description: string;
  /** The actual tool function */
  tool: ToolFunction;
  /** Whether this tool is safe without explicit approval */
  safeByDefault: boolean;
  /** Whether this tool requires a connector */
  requiresConnector?: boolean;
  /** Supported connector service types (if requiresConnector) */
  connectorServiceTypes?: string[];
}

/** Complete registry of all built-in tools */
export const toolRegistry: ToolRegistryEntry[] = [
${registryEntries}
];

/** Get all built-in tools as ToolFunction array */
export function getAllBuiltInTools(): ToolFunction[] {
  return toolRegistry.map((entry) => entry.tool);
}

/** Get full tool registry with metadata */
export function getToolRegistry(): ToolRegistryEntry[] {
  return [...toolRegistry];
}

/** Get tools by category */
export function getToolsByCategory(category: ToolCategory): ToolRegistryEntry[] {
  return toolRegistry.filter((entry) => entry.category === category);
}

/** Get tool by name */
export function getToolByName(name: string): ToolRegistryEntry | undefined {
  return toolRegistry.find((entry) => entry.name === name);
}

/** Get tools that require connector configuration */
export function getToolsRequiringConnector(): ToolRegistryEntry[] {
  return toolRegistry.filter((entry) => entry.requiresConnector);
}

/** Get all unique category names */
export function getToolCategories(): ToolCategory[] {
  return [...new Set(toolRegistry.map((entry) => entry.category))];
}
`;

  await writeFile(OUTPUT_FILE, output);
  console.log(`\n✓ Generated ${OUTPUT_FILE}`);
  console.log(`  Total tools: ${tools.length}`);
  console.log(`  Categories: ${[...new Set(tools.map((t) => t.category))].join(', ')}`);
}

// Run
generateRegistry().catch((error) => {
  console.error('Failed to generate tool registry:', error);
  process.exit(1);
});
