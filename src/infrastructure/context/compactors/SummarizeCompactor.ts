/**
 * Summarize Compactor
 *
 * Uses LLM to create intelligent summaries of context components before compaction.
 * This preserves the semantic meaning of content while reducing token count.
 *
 * Supports different summarization strategies based on content type:
 * - Conversation history: Preserves decisions, facts, and preferences
 * - Tool outputs (search/scrape): Preserves key findings, sources, and data
 */

import type {
  IContextCompactor,
  IContextComponent,
  ITokenEstimator,
} from '../../../core/context/types.js';
import type { ITextProvider } from '../../../domain/interfaces/ITextProvider.js';

/**
 * Configuration for the SummarizeCompactor
 */
export interface SummarizeCompactorConfig {
  /** Text provider for LLM-based summarization */
  textProvider: ITextProvider;

  /** Model to use for summarization (optional - uses provider default) */
  model?: string;

  /** Maximum tokens for the summary (default: 500) */
  maxSummaryTokens?: number;

  /** Preserve markdown structure like headings and lists (default: true) */
  preserveStructure?: boolean;

  /** Fall back to truncation if LLM summarization fails (default: true) */
  fallbackToTruncate?: boolean;

  /** Temperature for summarization (default: 0.3 for deterministic output) */
  temperature?: number;
}

/**
 * Content type hint for selecting appropriate summarization prompt
 */
export type SummarizeContentType =
  | 'conversation'
  | 'tool_output'
  | 'search_results'
  | 'scrape_results'
  | 'generic';

/**
 * Summarization prompts for different content types
 */
const SUMMARIZATION_PROMPTS: Record<SummarizeContentType, string> = {
  conversation: `Summarize this conversation history, preserving:
- Key decisions made by the user or assistant
- Important facts and data discovered
- User preferences expressed
- Unresolved questions or pending items
- Any errors or issues encountered

Focus on information that would be needed to continue the conversation coherently.
Be concise but preserve critical context.`,

  tool_output: `Summarize these tool outputs, preserving:
- Key results and findings from each tool call
- Important data values (numbers, dates, names, IDs)
- Error messages or warnings
- Status information
- Dependencies or relationships between results

Prioritize factual data over explanatory text.`,

  search_results: `Summarize these search results, preserving:
- Key findings relevant to the task
- Source URLs and their main points (keep URLs intact)
- Factual data (numbers, dates, names, statistics)
- Contradictions or disagreements between sources
- Credibility indicators (official sources, recent dates)

Format as a bulleted list organized by topic or source.`,

  scrape_results: `Summarize this scraped web content, preserving:
- Main topic and key points
- Factual data (numbers, dates, names, prices, specifications)
- Important quotes or statements
- Source attribution (keep the URL)
- Any structured data (tables, lists)

Discard navigation elements, ads, and boilerplate text.`,

  generic: `Summarize this content, preserving:
- Main points and key information
- Important data and facts
- Relationships and dependencies
- Actionable items

Be concise while retaining critical information.`,
};

/**
 * SummarizeCompactor - LLM-based context compaction
 *
 * Uses AI to intelligently summarize content, preserving semantic meaning
 * while significantly reducing token count.
 */
export class SummarizeCompactor implements IContextCompactor {
  readonly name = 'summarize';
  readonly priority = 5; // Run before truncate (10)

  private config: Required<SummarizeCompactorConfig>;
  private estimator: ITokenEstimator;

  constructor(estimator: ITokenEstimator, config: SummarizeCompactorConfig) {
    this.estimator = estimator;
    this.config = {
      textProvider: config.textProvider,
      model: config.model ?? '',
      maxSummaryTokens: config.maxSummaryTokens ?? 500,
      preserveStructure: config.preserveStructure ?? true,
      fallbackToTruncate: config.fallbackToTruncate ?? true,
      temperature: config.temperature ?? 0.3,
    };
  }

  /**
   * Check if this compactor can handle the component
   */
  canCompact(component: IContextComponent): boolean {
    return (
      component.compactable && component.metadata?.strategy === 'summarize'
    );
  }

  /**
   * Compact the component by summarizing its content
   */
  async compact(
    component: IContextComponent,
    targetTokens: number
  ): Promise<IContextComponent> {
    // Stringify content for processing
    const contentStr = this.stringifyContent(component.content);
    const currentTokens = this.estimator.estimateTokens(contentStr);

    // If already small enough, return unchanged
    if (currentTokens <= targetTokens) {
      return component;
    }

    // Determine content type from metadata or component name
    const contentType = this.detectContentType(component);

    try {
      // Attempt LLM summarization
      const summary = await this.summarize(contentStr, contentType, targetTokens);

      // Verify we achieved meaningful reduction
      const summaryTokens = this.estimator.estimateTokens(summary);
      if (summaryTokens >= currentTokens * 0.9) {
        // Less than 10% reduction - fallback to truncation if enabled
        if (this.config.fallbackToTruncate) {
          return this.truncateFallback(component, contentStr, targetTokens);
        }
      }

      return {
        ...component,
        content: summary,
        metadata: {
          ...component.metadata,
          summarized: true,
          summarizedFrom: currentTokens,
          summarizedTo: summaryTokens,
          reductionPercent: Math.round(
            ((currentTokens - summaryTokens) / currentTokens) * 100
          ),
          contentType,
        },
      };
    } catch (error) {
      // LLM failed - use fallback if configured
      if (this.config.fallbackToTruncate) {
        console.warn(
          `SummarizeCompactor: LLM summarization failed for ${component.name}, falling back to truncation:`,
          error instanceof Error ? error.message : String(error)
        );
        return this.truncateFallback(component, contentStr, targetTokens);
      }

      // Re-throw if no fallback
      throw error;
    }
  }

  /**
   * Estimate how many tokens could be saved by summarization
   */
  estimateSavings(component: IContextComponent): number {
    const current = this.estimator.estimateDataTokens(component.content);
    // Summarization typically achieves 70-85% reduction
    return Math.floor(current * 0.8);
  }

  /**
   * Perform LLM-based summarization
   */
  private async summarize(
    content: string,
    contentType: SummarizeContentType,
    targetTokens: number
  ): Promise<string> {
    const systemPrompt = SUMMARIZATION_PROMPTS[contentType];
    const maxSummaryTokens = Math.min(targetTokens, this.config.maxSummaryTokens);

    const structureInstructions = this.config.preserveStructure
      ? '\n\nPreserve formatting structure (headings, bullet points, numbered lists) where appropriate.'
      : '';

    const prompt = `${systemPrompt}${structureInstructions}

Target summary length: approximately ${maxSummaryTokens} tokens (${maxSummaryTokens * 4} characters).

Content to summarize:
---
${content}
---

Provide the summary:`;

    const response = await this.config.textProvider.generate({
      model: this.config.model || 'gpt-4o-mini', // Use a fast, cheap model for summarization
      input: prompt,
      temperature: this.config.temperature,
      max_output_tokens: maxSummaryTokens + 100, // Allow some buffer
    });

    return response.output_text || content;
  }

  /**
   * Fallback to simple truncation when LLM fails
   */
  private truncateFallback(
    component: IContextComponent,
    contentStr: string,
    targetTokens: number
  ): IContextComponent {
    const targetChars = targetTokens * 4; // ~4 chars per token
    const truncated =
      contentStr.substring(0, targetChars) +
      '\n\n[... content truncated due to context limits ...]';

    return {
      ...component,
      content: truncated,
      metadata: {
        ...component.metadata,
        truncated: true,
        truncatedFrom: contentStr.length,
        truncatedTo: truncated.length,
        summarizationFailed: true,
      },
    };
  }

  /**
   * Detect content type from component metadata or name
   */
  private detectContentType(component: IContextComponent): SummarizeContentType {
    // Check metadata first
    if (component.metadata?.contentType) {
      return component.metadata.contentType as SummarizeContentType;
    }

    // Infer from component name
    const name = component.name.toLowerCase();

    if (
      name.includes('conversation') ||
      name.includes('history') ||
      name.includes('messages')
    ) {
      return 'conversation';
    }

    if (name.includes('search')) {
      return 'search_results';
    }

    if (name.includes('scrape') || name.includes('fetch')) {
      return 'scrape_results';
    }

    if (name.includes('tool') || name.includes('output')) {
      return 'tool_output';
    }

    return 'generic';
  }

  /**
   * Convert content to string for processing
   */
  private stringifyContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      // Handle message arrays (conversation history)
      return content
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            // Handle message objects with role/content
            if ('role' in item && 'content' in item) {
              return `[${item.role}]: ${item.content}`;
            }
            // Handle tool output objects
            if ('tool' in item && 'output' in item) {
              return `[${item.tool}]: ${JSON.stringify(item.output)}`;
            }
          }
          return JSON.stringify(item);
        })
        .join('\n\n');
    }

    // Default to JSON serialization
    return JSON.stringify(content, null, 2);
  }
}
