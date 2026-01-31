/**
 * HTML to Markdown conversion utilities
 * Uses Readability for article extraction and Turndown for markdown conversion
 */

import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import type { Node as TurndownNode } from 'turndown';

// Lazy-loaded jsdom to avoid bundling issues in Electron
let JSDOM: typeof import('jsdom').JSDOM | null = null;

async function getJSDOM(): Promise<typeof import('jsdom').JSDOM> {
  if (!JSDOM) {
    const jsdom = await import('jsdom');
    JSDOM = jsdom.JSDOM;
  }
  return JSDOM;
}

export interface MarkdownResult {
  markdown: string;
  title: string;
  byline?: string;
  excerpt?: string;
  wasReadabilityUsed: boolean;
  wasTruncated: boolean;
}

/**
 * Convert HTML to clean markdown
 *
 * Uses Readability to extract main article content (strips ads, nav, footer, etc.)
 * then converts to markdown with Turndown.
 *
 * @param html - Raw HTML string
 * @param url - URL of the page (used for resolving relative links)
 * @param maxLength - Maximum length of output markdown (default: 50000)
 * @returns MarkdownResult with cleaned content
 */
export async function htmlToMarkdown(
  html: string,
  url: string,
  maxLength: number = 50000
): Promise<MarkdownResult> {
  // 1. Parse HTML with JSDOM (lazy-loaded)
  const JSDOMClass = await getJSDOM();
  const dom = new JSDOMClass(html, { url });
  const document = dom.window.document;

  let title = document.title || '';
  let byline: string | undefined;
  let excerpt: string | undefined;
  let contentHtml = html;
  let wasReadabilityUsed = false;

  // 2. Try Readability for article extraction (strips ads, nav, footer, etc.)
  try {
    // Clone document for Readability (it modifies the DOM)
    const clonedDoc = document.cloneNode(true) as typeof document;
    const reader = new Readability(clonedDoc);
    const article = reader.parse();

    if (article && article.content && article.content.length > 100) {
      contentHtml = article.content;
      title = article.title || title;
      byline = article.byline || undefined;
      excerpt = article.excerpt || undefined;
      wasReadabilityUsed = true;
    }
  } catch {
    // Readability failed, use full HTML
  }

  // 3. Convert to Markdown with Turndown
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_',
  });

  // Remove script, style, nav, footer, aside, iframe tags
  turndown.remove(['script', 'style', 'nav', 'footer', 'aside', 'iframe', 'noscript']);

  // Custom rule for code blocks to preserve formatting
  turndown.addRule('pre', {
    filter: ['pre'],
    replacement: (content: string, node: TurndownNode) => {
      const element = node as unknown as Element;
      const code = element.querySelector?.('code');
      const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
      const text = code?.textContent || content;
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    },
  });

  // Convert to markdown
  let markdown = turndown.turndown(contentHtml);

  // 4. Clean up excessive whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/^\s+|\s+$/g, '') // Trim start/end
    .replace(/[ \t]+$/gm, ''); // Remove trailing spaces on lines

  // 5. Truncate at paragraph boundary if needed
  let wasTruncated = false;
  if (markdown.length > maxLength) {
    // Find last paragraph break before maxLength
    const truncateAt = markdown.lastIndexOf('\n\n', maxLength);
    if (truncateAt > maxLength * 0.5) {
      markdown = markdown.slice(0, truncateAt) + '\n\n...[content truncated]';
    } else {
      // No good break point, just truncate
      markdown = markdown.slice(0, maxLength) + '...[truncated]';
    }
    wasTruncated = true;
  }

  return {
    markdown,
    title,
    byline,
    excerpt,
    wasReadabilityUsed,
    wasTruncated,
  };
}

/**
 * Quick check if HTML likely needs JavaScript rendering
 * (Useful for fallback decisions)
 */
export function likelyNeedsJavaScript(html: string): boolean {
  const jsFrameworkPatterns = [
    /__NEXT_DATA__/i,
    /\breact-root\b/i,
    /\bng-app\b/i,
    /\bdata-v-/i, // Vue scoped styles
    /\bapp-root\b/i,
    /\bnuxt\b/i,
  ];

  return jsFrameworkPatterns.some((pattern) => pattern.test(html));
}
