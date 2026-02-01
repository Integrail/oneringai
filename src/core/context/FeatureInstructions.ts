/**
 * FeatureInstructions - Runtime usage instructions for enabled AgentContext features
 *
 * These instructions are injected into the LLM context to provide guidance on
 * efficient, autonomous use of memory, context, and other features.
 *
 * Token budget (~1,450 tokens total when all features enabled):
 * - Introspection (always): ~300 tokens
 * - Working Memory: ~500 tokens
 * - In-Context Memory: ~350 tokens
 * - Persistent Instructions: ~300 tokens
 */

import type { IContextComponent } from './types.js';
import type { AgentContextFeatures } from '../AgentContext.js';

// ============================================================================
// Instruction Constants
// ============================================================================

/**
 * Introspection instructions (always included)
 * ~300 tokens
 */
export const INTROSPECTION_INSTRUCTIONS = `## Context Budget Management

### Monitoring
Check budget with \`context_stats()\`:
- \`remaining_percent\` > 50%: Comfortable
- \`remaining_percent\` 20-50%: Consider cleanup
- \`remaining_percent\` < 20%: Aggressive cleanup needed

### When to Check
- After storing large outputs
- Before intensive multi-step operations
- Periodically during long conversations

### Response to Low Budget
1. Summarize raw memory entries
2. Delete consumed in-context entries
3. Run \`memory_cleanup_raw()\` if applicable`;

/**
 * Working Memory instructions
 * ~500 tokens
 */
export const WORKING_MEMORY_INSTRUCTIONS = `## Working Memory Usage

### Decision Matrix
| Data Type | Storage | Why |
|-----------|---------|-----|
| Large outputs (>2KB) | memory_store | Keeps context lean |
| Intermediate results | memory_store (tier: raw) | Can summarize later |
| Final findings | memory_store (tier: findings) | Persists across cleanup |
| Fast-changing state | context_set | Immediate visibility |
| User preferences | instructions_append | Cross-session persistence |

### Naming Conventions
- \`raw.<source>.<id>\` - Raw data (e.g., \`raw.web.page1\`)
- \`summary.<topic>\` - Summarized content
- \`findings.<category>\` - Final insights
- \`data.<type>\` - Reference data

### Workflow
1. Store raw data: \`memory_store({ key: "raw.web.page1", value: "...", tier: "raw" })\`
2. Process and summarize
3. Store summary: \`memory_store({ key: "summary.research", value: "...", tier: "summary" })\`
4. Cleanup raw: \`memory_cleanup_raw()\` (removes tier=raw entries)
5. Keep findings: \`memory_store({ key: "findings.conclusion", value: "...", tier: "findings" })\`

### Query Patterns
- List all: \`memory_query()\`
- List by tier: \`memory_query({ tier: "findings" })\`
- Search pattern: \`memory_query({ pattern: "raw.*" })\`
- Retrieve values: \`memory_query({ pattern: "findings.*", includeValues: true })\`
- With stats: \`memory_query({ includeStats: true })\``;

/**
 * In-Context Memory instructions
 * ~350 tokens
 */
export const IN_CONTEXT_MEMORY_INSTRUCTIONS = `## In-Context Memory Usage

Values stored here are **immediately visible** in your context - no retrieval needed.

### When to Use
- Current state/status that changes during execution
- Flags, counters, progress indicators
- Small accumulated results (<500 tokens each)

### When NOT to Use
- Large data (use Working Memory instead)
- Rarely accessed reference data

### Naming Conventions
- \`state.<name>\` - Current state
- \`progress.<task>\` - Progress tracking
- \`flags.<name>\` - Boolean flags
- \`prefs.<name>\` - Session preferences

### Priority Levels
- \`low\` - Evicted first when space needed
- \`normal\` - Default
- \`high\` - Evicted only if necessary
- \`critical\` - Never auto-evicted

### Best Practices
- Keep values small (<500 tokens)
- Delete entries when no longer needed: \`context_delete({ key: "state.temp" })\`
- Use appropriate priority based on importance`;

/**
 * Persistent Instructions instructions
 * ~300 tokens
 */
export const PERSISTENT_INSTRUCTIONS_INSTRUCTIONS = `## Persistent Instructions Usage

Persistent instructions survive across sessions. Use for stable user preferences and workflows.

### When to Use
- User preferences (coding style, communication preferences)
- Project-specific guidelines
- Workflow templates

### When NOT to Use
- Secrets or credentials (security risk)
- Session-specific temporary data
- Frequently changing information

### Best Practices
- Prefer \`instructions_append\` over \`instructions_set\` (preserves existing content)
- Use markdown headers for organization
- Keep concise - these consume context every session
- Review periodically with \`instructions_get\``;

/**
 * Tool Output Tracking instructions
 * ~200 tokens
 */
export const TOOL_OUTPUT_TRACKING_INSTRUCTIONS = `## Tool Output Tracking

Recent tool outputs are tracked and available in context. This helps you reference previous results.

### Automatic Behavior
- Tool outputs are automatically tracked
- Oldest outputs are evicted when space is needed
- Large outputs may be truncated in context

### Best Practices
- Reference previous outputs by tool name
- For large outputs, immediately extract and store key information in memory
- Don't rely on tool outputs persisting - they are compacted aggressively`;

/**
 * Auto-Spill instructions
 * ~250 tokens
 */
export const AUTO_SPILL_INSTRUCTIONS = `## Auto-Spill (Large Output Management)

Large tool outputs (>10KB) are automatically stored in Working Memory's raw tier.

### What Happens
- Large outputs from web_fetch, read_file, research_* tools are auto-stored
- You'll see: "[Large output spilled to memory: key]"
- Use \`memory_retrieve(key)\` to access the full content

### Workflow
1. Tool returns large output → auto-stored as \`raw.autospill.*\`
2. Retrieve when needed: \`memory_retrieve({ key: "raw.autospill.*" })\`
3. Process and summarize the content
4. Store summary: \`memory_store({ key: "summary.*", tier: "summary", value: "..." })\`
5. Cleanup raw: \`memory_cleanup_raw()\`

### Note
Auto-spilled entries are automatically cleaned up after being consumed (summarized).`;

// ============================================================================
// Builder Function
// ============================================================================

/**
 * Build feature instructions component based on enabled features
 *
 * @param features - Resolved feature configuration (all required)
 * @returns Context component with feature instructions, or null if nothing to include
 *
 * @example
 * ```typescript
 * const features = { memory: true, inContextMemory: true, history: true, permissions: true, persistentInstructions: false };
 * const component = buildFeatureInstructions(features);
 * if (component) {
 *   components.push(component);
 * }
 * ```
 */
export function buildFeatureInstructions(
  features: Required<AgentContextFeatures>
): IContextComponent | null {
  const sections: string[] = [];

  // Always include introspection (context_stats is always available)
  sections.push(INTROSPECTION_INSTRUCTIONS);

  // Working Memory (if enabled)
  if (features.memory) {
    sections.push(WORKING_MEMORY_INSTRUCTIONS);
  }

  // In-Context Memory (if enabled)
  if (features.inContextMemory) {
    sections.push(IN_CONTEXT_MEMORY_INSTRUCTIONS);
  }

  // Persistent Instructions (if enabled)
  if (features.persistentInstructions) {
    sections.push(PERSISTENT_INSTRUCTIONS_INSTRUCTIONS);
  }

  // Tool Output Tracking (if enabled)
  if (features.toolOutputTracking) {
    sections.push(TOOL_OUTPUT_TRACKING_INSTRUCTIONS);
  }

  // Auto-Spill (if enabled and memory is also enabled)
  if (features.autoSpill && features.memory) {
    sections.push(AUTO_SPILL_INSTRUCTIONS);
  }

  // If only introspection is included (minimal features), still return it
  // as it provides valuable guidance for context management
  if (sections.length === 0) {
    return null;
  }

  const content = sections.join('\n\n');

  return {
    name: 'feature_instructions',
    content,
    priority: 1, // High priority - keep in context
    compactable: true, // Can be compacted if absolutely necessary
    metadata: {
      featureCount: sections.length,
      memoryEnabled: features.memory,
      inContextMemoryEnabled: features.inContextMemory,
      persistentInstructionsEnabled: features.persistentInstructions,
      toolOutputTrackingEnabled: features.toolOutputTracking,
      autoSpillEnabled: features.autoSpill,
    },
  };
}

/**
 * Get all instruction constants (for testing or direct access)
 */
export function getAllInstructions(): Record<string, string> {
  return {
    introspection: INTROSPECTION_INSTRUCTIONS,
    workingMemory: WORKING_MEMORY_INSTRUCTIONS,
    inContextMemory: IN_CONTEXT_MEMORY_INSTRUCTIONS,
    persistentInstructions: PERSISTENT_INSTRUCTIONS_INSTRUCTIONS,
    toolOutputTracking: TOOL_OUTPUT_TRACKING_INSTRUCTIONS,
    autoSpill: AUTO_SPILL_INSTRUCTIONS,
  };
}
