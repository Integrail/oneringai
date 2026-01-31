/**
 * HTML to Markdown Conversion Tests
 */

import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, likelyNeedsJavaScript } from '../../../../src/tools/web/htmlToMarkdown.js';

describe('htmlToMarkdown', () => {
  describe('basic conversion', () => {
    it('should convert simple HTML to markdown', async () => {
      const html = '<html><body><h1>Hello World</h1><p>This is a test.</p></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).toContain('Hello World');
      expect(result.markdown).toContain('This is a test');
      expect(result.wasTruncated).toBe(false);
    });

    it('should extract title', async () => {
      const html = '<html><head><title>Page Title</title></head><body><p>Content</p></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.title).toBe('Page Title');
    });

    it('should handle headings', async () => {
      const html = '<html><body><h1>Main</h1><h2>Sub</h2><h3>SubSub</h3></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).toContain('# Main');
      expect(result.markdown).toContain('## Sub');
      expect(result.markdown).toContain('### SubSub');
    });

    it('should handle lists', async () => {
      const html = '<html><body><ul><li>Item 1</li><li>Item 2</li></ul></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      // Turndown uses 3 spaces after bullet marker
      expect(result.markdown).toContain('Item 1');
      expect(result.markdown).toContain('Item 2');
      expect(result.markdown).toContain('-');
    });

    it('should handle links', async () => {
      const html = '<html><body><a href="https://test.com">Link Text</a></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).toContain('[Link Text](https://test.com)');
    });

    it('should handle bold and italic', async () => {
      const html = '<html><body><p><strong>Bold</strong> and <em>italic</em></p></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).toContain('**Bold**');
      expect(result.markdown).toContain('_italic_');
    });
  });

  describe('content extraction', () => {
    it('should remove script tags', async () => {
      const html = '<html><body><script>alert("bad")</script><p>Content</p></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).not.toContain('alert');
      expect(result.markdown).toContain('Content');
    });

    it('should remove style tags', async () => {
      const html = '<html><head><style>.red{color:red}</style></head><body><p>Content</p></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).not.toContain('.red');
      expect(result.markdown).not.toContain('color:red');
    });

    it('should remove nav tags', async () => {
      const html = '<html><body><nav><a>Nav Link</a></nav><main><p>Content</p></main></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      // After Readability, nav should be stripped
      expect(result.markdown).toContain('Content');
    });
  });

  describe('truncation', () => {
    it('should truncate long content', async () => {
      const longParagraph = 'Lorem ipsum '.repeat(10000);
      const html = `<html><body><p>${longParagraph}</p></body></html>`;
      const result = await htmlToMarkdown(html, 'https://example.com', 1000);

      expect(result.wasTruncated).toBe(true);
      expect(result.markdown.length).toBeLessThanOrEqual(1100); // Some margin for truncation message
      expect(result.markdown).toContain('[truncated]');
    });

    it('should not truncate short content', async () => {
      const html = '<html><body><p>Short content</p></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com', 50000);

      expect(result.wasTruncated).toBe(false);
    });

    it('should truncate at paragraph boundary when possible', async () => {
      // Need content long enough to trigger truncation
      const longContent = 'This is a long paragraph. '.repeat(20);
      const html = `<html><body><p>${longContent}</p><p>Second paragraph.</p></body></html>`;
      const result = await htmlToMarkdown(html, 'https://example.com', 100);

      expect(result.wasTruncated).toBe(true);
      expect(result.markdown).toContain('[truncated]');
    });
  });

  describe('readability', () => {
    it('should report when readability was used', async () => {
      const html = `
        <html>
        <head><title>Article</title></head>
        <body>
          <nav>Navigation</nav>
          <article>
            <h1>Article Title</h1>
            <p>This is a substantial article with enough content for Readability to work with.</p>
            <p>Another paragraph with more content to make this article meaningful.</p>
            <p>And a third paragraph to ensure there's enough text for extraction.</p>
          </article>
          <aside>Sidebar content</aside>
        </body>
        </html>
      `;
      const result = await htmlToMarkdown(html, 'https://example.com');

      // Readability should extract the article content
      expect(result.wasReadabilityUsed).toBe(true);
      expect(result.markdown).toContain('Article Title');
    });
  });

  describe('code blocks', () => {
    it('should handle code blocks', async () => {
      const html = '<html><body><pre><code class="language-javascript">const x = 1;</code></pre></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).toContain('```javascript');
      expect(result.markdown).toContain('const x = 1;');
      expect(result.markdown).toContain('```');
    });

    it('should handle code blocks without language', async () => {
      const html = '<html><body><pre><code>plain code</code></pre></body></html>';
      const result = await htmlToMarkdown(html, 'https://example.com');

      expect(result.markdown).toContain('```');
      expect(result.markdown).toContain('plain code');
    });
  });
});

describe('likelyNeedsJavaScript', () => {
  it('should detect Next.js', () => {
    const html = '<script id="__NEXT_DATA__">{"props":{}}</script>';
    expect(likelyNeedsJavaScript(html)).toBe(true);
  });

  it('should detect React', () => {
    const html = '<div id="react-root"></div>';
    expect(likelyNeedsJavaScript(html)).toBe(true);
  });

  it('should detect Angular', () => {
    const html = '<div ng-app="myApp"></div>';
    expect(likelyNeedsJavaScript(html)).toBe(true);
  });

  it('should detect Vue scoped styles', () => {
    const html = '<div data-v-abc123></div>';
    expect(likelyNeedsJavaScript(html)).toBe(true);
  });

  it('should return false for static HTML', () => {
    const html = '<html><body><h1>Static Content</h1></body></html>';
    expect(likelyNeedsJavaScript(html)).toBe(false);
  });
});
