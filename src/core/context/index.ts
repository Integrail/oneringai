/**
 * Core context management module
 *
 * Architecture Overview:
 * ======================
 *
 * For most users, import `AgentContext` from the main package:
 *   import { AgentContext } from '@everworker/oneringai';
 *
 * AgentContext (via AgentContextNextGen) is the unified context manager that handles:
 * - Conversation history
 * - Tool management
 * - Plugins (WorkingMemory, InContextMemory, PersistentInstructions)
 * - Token budget management
 * - Compaction strategies
 *
 * This module exports:
 * - Types for context strategies
 * - SmartCompactor for LLM-powered compaction
 * - ContextGuardian for hard limit enforcement
 *
 * @example
 * ```typescript
 * // Simple API (recommended for most users)
 * import { AgentContext } from '@everworker/oneringai';
 *
 * const ctx = AgentContext.create({ model: 'gpt-4', tools: [myTool] });
 * ctx.addMessage('user', 'Hello');
 * const prepared = await ctx.prepare('New message');
 * ```
 */

// Types
export * from './types.js';

// ============================================================================
// SmartCompactor - LLM-powered intelligent context compaction
// ============================================================================

export { SmartCompactor, createSmartCompactor } from './SmartCompactor.js';
export type {
  SmartCompactorConfig,
  SmartCompactionResult,
  CompactionSummary,
  SpilledData,
} from './SmartCompactor.js';

// ============================================================================
// ContextGuardian - Hard limit enforcement (mandatory safety)
// ============================================================================

export { ContextGuardian } from './ContextGuardian.js';
export type {
  ContextGuardianConfig,
  GuardianValidation,
  DegradationResult,
} from './ContextGuardian.js';
