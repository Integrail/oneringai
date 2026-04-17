/**
 * Profile generator contract.
 *
 * The memory layer is LLM-agnostic — consumers construct a generator from
 * their LLM of choice (e.g. a oneringai Agent + prompt template) and pass
 * it into MemorySystem via config.
 *
 * The generator is responsible for:
 *   - producing the living markdown body (`details`)
 *   - producing a 1-paragraph gist used as embedding input (`summaryForEmbedding`)
 *
 * It receives the prior profile (if any) so it can evolve rather than rewrite.
 */

export type { IProfileGenerator } from '../types.js';
