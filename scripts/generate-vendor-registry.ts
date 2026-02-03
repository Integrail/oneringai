#!/usr/bin/env npx tsx
/**
 * Auto-generate vendor registry from template files.
 *
 * This script scans all vendor template files in src/connectors/vendors/templates/
 * and generates a registry file with lookup functions.
 *
 * Usage: npx tsx scripts/generate-vendor-registry.ts
 * Or:    npm run generate:vendors
 *
 * Output: src/connectors/vendors/registry.generated.ts
 */

import { readdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TEMPLATES_DIR = join(ROOT, 'src/connectors/vendors/templates');
const OUTPUT_FILE = join(ROOT, 'src/connectors/vendors/registry.generated.ts');

interface TemplateInfo {
  exportName: string;
  vendorId: string;
  vendorName: string;
  serviceType: string;
  category: string;
  authMethods: string[];
  credentialsSetupURL?: string;
  importPath: string;
}

async function getTemplateFiles(): Promise<string[]> {
  const entries = await readdir(TEMPLATES_DIR);
  return entries.filter(
    (f) =>
      f.endsWith('.ts') &&
      f !== 'index.ts' &&
      !f.endsWith('.d.ts') &&
      !f.startsWith('_')
  );
}

/**
 * Extract template metadata from source file
 */
async function extractTemplatesFromFile(file: string): Promise<TemplateInfo[]> {
  const filePath = join(TEMPLATES_DIR, file);
  const content = await readFile(filePath, 'utf-8');
  const templates: TemplateInfo[] = [];

  // Find all exported const templates
  const exportMatches = content.matchAll(/export\s+const\s+(\w+Template)\s*:\s*VendorTemplate/g);

  for (const match of exportMatches) {
    const exportName = match[1];

    // Find the template definition
    const templateStart = content.indexOf(`const ${exportName}`);
    if (templateStart === -1) continue;

    // Find the template block - look for matching braces
    const blockStart = content.indexOf('{', templateStart);
    let braceCount = 0;
    let blockEnd = blockStart;
    for (let i = blockStart; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0) {
        blockEnd = i + 1;
        break;
      }
    }
    const templateBlock = content.slice(templateStart, blockEnd);

    // Extract fields
    const idMatch = templateBlock.match(/id:\s*['"]([^'"]+)['"]/);
    const nameMatch = templateBlock.match(/name:\s*['"]([^'"]+)['"]/);
    const serviceTypeMatch = templateBlock.match(/serviceType:\s*['"]([^'"]+)['"]/);
    const categoryMatch = templateBlock.match(/category:\s*['"]([^'"]+)['"]/);
    const setupURLMatch = templateBlock.match(/credentialsSetupURL:\s*['"]([^'"]+)['"]/);

    // Extract auth method IDs
    const authMethodIds: string[] = [];
    const authMatches = templateBlock.matchAll(/id:\s*['"]([^'"]+)['"]/g);
    let first = true;
    for (const authMatch of authMatches) {
      // Skip the first match (vendor id)
      if (first) {
        first = false;
        continue;
      }
      authMethodIds.push(authMatch[1]);
    }

    if (idMatch && nameMatch && serviceTypeMatch && categoryMatch) {
      templates.push({
        exportName,
        vendorId: idMatch[1],
        vendorName: nameMatch[1],
        serviceType: serviceTypeMatch[1],
        category: categoryMatch[1],
        authMethods: authMethodIds,
        credentialsSetupURL: setupURLMatch?.[1],
        importPath: `./${file.replace('.ts', '.js')}`,
      });
    }
  }

  return templates;
}

async function generateRegistry(): Promise<void> {
  console.log('Generating vendor registry from template files...\n');

  const templates: TemplateInfo[] = [];
  const files = await getTemplateFiles();

  for (const file of files) {
    console.log(`Scanning ${file}...`);
    try {
      const fileTemplates = await extractTemplatesFromFile(file);
      for (const t of fileTemplates) {
        console.log(`  ✓ ${t.vendorId} (${t.exportName})`);
        templates.push(t);
      }
    } catch (error) {
      console.warn(`  ✗ ${file}: ${error}`);
    }
  }

  if (templates.length === 0) {
    console.error('\nNo templates found! Check the template file patterns.');
    process.exit(1);
  }

  // Sort by category then vendor ID
  templates.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.vendorId.localeCompare(b.vendorId);
  });

  // Group by import path
  const importsByPath = new Map<string, string[]>();
  for (const t of templates) {
    const existing = importsByPath.get(t.importPath) ?? [];
    existing.push(t.exportName);
    importsByPath.set(t.importPath, existing);
  }

  // Generate imports
  const imports = Array.from(importsByPath.entries())
    .map(([path, names]) => `import { ${names.join(', ')} } from './templates/${path.replace('./', '')}';`)
    .join('\n');

  // Generate registry entries
  const registryEntries = templates
    .map((t) => {
      const lines = [
        `    id: '${t.vendorId}',`,
        `    name: '${t.vendorName}',`,
        `    serviceType: '${t.serviceType}',`,
        `    category: '${t.category}' as ServiceCategory,`,
        `    authMethods: ${JSON.stringify(t.authMethods)},`,
      ];
      if (t.credentialsSetupURL) {
        lines.push(`    credentialsSetupURL: '${t.credentialsSetupURL}',`);
      }
      lines.push(`    template: ${t.exportName},`);
      return `  {\n${lines.join('\n')}\n  }`;
    })
    .join(',\n');

  const output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 *
 * Generated by: scripts/generate-vendor-registry.ts
 * Generated at: ${new Date().toISOString()}
 *
 * To regenerate: npm run generate:vendors
 */

import type { VendorTemplate, VendorRegistryEntry, AuthTemplate } from './types.js';
import type { ServiceCategory } from '../../domain/entities/Services.js';

${imports}

/** Complete registry of all vendor templates */
export const vendorRegistry: VendorRegistryEntry[] = [
${registryEntries}
];

/** Map for fast lookup by vendor ID */
const vendorMap = new Map<string, VendorTemplate>(
  vendorRegistry.map((entry) => [entry.id, entry.template])
);

/** Get vendor template by ID */
export function getVendorTemplateById(id: string): VendorTemplate | undefined {
  return vendorMap.get(id);
}

/** Get auth template for a vendor */
export function getAuthTemplate(vendorId: string, authId: string): AuthTemplate | undefined {
  const template = vendorMap.get(vendorId);
  if (!template) return undefined;
  return template.authTemplates.find((a) => a.id === authId);
}

/** List all vendor IDs */
export function listAllVendorIds(): string[] {
  return vendorRegistry.map((entry) => entry.id);
}

/** Get all vendor registry entries */
export function getVendorRegistryEntries(): VendorRegistryEntry[] {
  return [...vendorRegistry];
}

/** Get vendors by category */
export function getVendorsByCategory(category: ServiceCategory): VendorRegistryEntry[] {
  return vendorRegistry.filter((entry) => entry.category === category);
}

/** Get vendors that support a specific auth type */
export function getVendorsByAuthType(authType: 'api_key' | 'oauth'): VendorRegistryEntry[] {
  return vendorRegistry.filter((entry) =>
    entry.template.authTemplates.some((a) => a.type === authType)
  );
}

/** Get all unique categories */
export function getVendorCategories(): ServiceCategory[] {
  return [...new Set(vendorRegistry.map((entry) => entry.category))];
}

/** Total number of vendors */
export const VENDOR_COUNT = ${templates.length};
`;

  await writeFile(OUTPUT_FILE, output);
  console.log(`\n✓ Generated ${OUTPUT_FILE}`);
  console.log(`  Total vendors: ${templates.length}`);
  console.log(
    `  Categories: ${[...new Set(templates.map((t) => t.category))].join(', ')}`
  );
}

// Run
generateRegistry().catch((error) => {
  console.error('Failed to generate vendor registry:', error);
  process.exit(1);
});
