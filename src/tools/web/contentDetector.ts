/**
 * Content quality detection for web scraping
 * Detects if content is valid, requires JavaScript, or has errors
 */

import type { CheerioAPI } from 'cheerio';

export interface QualityResult {
  score: number; // 0-100
  requiresJS: boolean;
  suggestion?: string;
  issues: string[];
}

/**
 * Detect content quality from HTML and extracted text
 */
export function detectContentQuality(
  html: string,
  text: string,
  $: CheerioAPI
): QualityResult {
  const issues: string[] = [];
  let score = 100;
  let requiresJS = false;

  // Check 1: Empty or very short content
  if (text.length < 100) {
    issues.push('Very little text content extracted');
    score -= 40;
    requiresJS = true;
  }

  // Check 2: Detect common error patterns
  const errorPatterns = [
    { pattern: /access denied/i, penalty: 50 },
    { pattern: /403 forbidden/i, penalty: 50 },
    { pattern: /404 not found/i, penalty: 50 },
    { pattern: /page not found/i, penalty: 40 },
    { pattern: /cloudflare/i, penalty: 30 },
    { pattern: /please enable javascript/i, penalty: 40 },
    { pattern: /requires javascript/i, penalty: 40 },
    { pattern: /robot|bot detection/i, penalty: 30 },
  ];

  for (const { pattern, penalty } of errorPatterns) {
    if (pattern.test(html) || pattern.test(text)) {
      issues.push(`Error pattern detected: ${pattern.source}`);
      score -= penalty;
    }
  }

  // Check 3: Mostly script tags (code dumps)
  const scriptCount = $('script').length;
  const textLength = text.length;

  if (scriptCount > 10 && textLength < 500) {
    issues.push('Page is mostly JavaScript code (code dump)');
    score -= 40;
    requiresJS = true;
  }

  // Check 4: High script-to-content ratio
  const scriptLength = $('script').text().length;
  if (scriptLength > textLength * 2 && textLength < 1000) {
    issues.push('High JavaScript-to-content ratio');
    score -= 20;
    requiresJS = true;
  }

  // Check 5: Common JS framework markers
  const jsFrameworks = [
    { pattern: /\breact\b/i, name: 'React' },
    { pattern: /\bvue\b/i, name: 'Vue' },
    { pattern: /\bangular\b/i, name: 'Angular' },
    { pattern: /__NEXT_DATA__/i, name: 'Next.js' },
    { pattern: /\bwebpack\b/i, name: 'Webpack' },
    { pattern: /_app-.*\.js/i, name: 'SPA' },
  ];

  for (const framework of jsFrameworks) {
    if (framework.pattern.test(html)) {
      issues.push(`${framework.name} framework detected`);
      requiresJS = true;
    }
  }

  // Check 6: Empty body with divs (typical SPA)
  const bodyText = $('body').text().trim();
  const divCount = $('div').length;

  if (bodyText.length < 100 && divCount > 5) {
    issues.push('Empty body with many divs (likely Single Page App)');
    score -= 30;
    requiresJS = true;
  }

  // Check 7: Noscript tag with meaningful content
  const noscript = $('noscript').text();
  if (noscript.length > 50) {
    issues.push('Noscript tag present (site requires JavaScript)');
    requiresJS = true;
  }

  // Check 8: Very few paragraphs/headings (typical of SPA skeleton)
  const paragraphCount = $('p').length;
  const headingCount = $('h1, h2, h3, h4, h5, h6').length;

  if (paragraphCount < 3 && headingCount < 2 && textLength < 500) {
    issues.push('Very few content elements (likely needs JavaScript)');
    score -= 20;
    requiresJS = true;
  }

  // Generate suggestion
  let suggestion: string | undefined;
  if (requiresJS && score < 50) {
    suggestion =
      'Content quality is low. This appears to be a JavaScript-rendered site. Use the web_fetch_js tool for better results.';
  } else if (score < 30) {
    suggestion = 'Content extraction failed or page has errors. Check the URL and try again.';
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    requiresJS,
    suggestion,
    issues,
  };
}

/**
 * Check if content looks like an error page
 */
export function isErrorPage(statusCode: number, html: string, text: string): boolean {
  if (statusCode >= 400) return true;

  const errorIndicators = [
    /404|not found/i,
    /403|forbidden|access denied/i,
    /500|internal server error/i,
    /503|service unavailable/i,
  ];

  for (const pattern of errorIndicators) {
    if (pattern.test(html) || pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract clean text content from HTML
 */
export function extractCleanText($: CheerioAPI): string {
  // Remove unwanted elements
  $('script, style, noscript, iframe, nav, footer, header, aside').remove();

  // Remove common ad/tracking divs
  $('[class*="ad-"], [class*="advertisement"], [id*="ad-"]').remove();
  $('[class*="cookie"], [class*="gdpr"]').remove();

  // Get text from main content areas (prioritized)
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '#content',
    '.post',
    '.article',
  ];

  for (const selector of mainSelectors) {
    const mainContent = $(selector).text().trim();
    if (mainContent.length > 200) {
      return mainContent;
    }
  }

  // Fallback to body
  return $('body').text().trim();
}
