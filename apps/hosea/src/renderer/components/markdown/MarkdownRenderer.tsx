/**
 * Rich Markdown Renderer with support for:
 * - GitHub Flavored Markdown (tables, strikethrough, autolinks)
 * - Syntax-highlighted code blocks
 * - LaTeX math (inline and block)
 * - Mermaid diagrams
 * - Markmap mindmaps
 * - Vega/Vega-Lite charts
 */

import React, { useMemo, memo, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Components } from 'react-markdown';
import 'katex/dist/katex.min.css';

import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

// Context to pass streaming state to nested components
interface MarkdownContextValue {
  isStreaming: boolean;
}

const MarkdownContext = createContext<MarkdownContextValue>({ isStreaming: false });

export const useMarkdownContext = () => useContext(MarkdownContext);

// Code component that uses context
function CodeComponent({ node, className, children, ...props }: any) {
  const { isStreaming } = useMarkdownContext();
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const code = String(children).replace(/\n$/, '');

  // Check if this is inline code (no language specified and short)
  const isInline = !match && !code.includes('\n');

  if (isInline) {
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  }

  return <CodeBlock language={language} code={code} isStreaming={isStreaming} />;
}

// Audio file extensions for detecting audio links
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.opus', '.pcm', '.webm'];
// Video file extensions for detecting video links
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

/**
 * Resolve a local filesystem path or file:// URL to a local-media:// URL.
 * Returns the original URL unchanged for remote URLs.
 */
function resolveLocalMediaUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.startsWith('file://')) {
    return url.replace('file://', 'local-media://');
  }
  if (url.startsWith('/')) {
    return `local-media://${url}`;
  }
  return url;
}

/** Check if a URL points to a file with one of the given extensions */
function hasExtension(url: string, extensions: string[]): boolean {
  const lower = url.toLowerCase().split('?')[0]!; // strip query params
  return extensions.some(ext => lower.endsWith(ext));
}

// Custom components for react-markdown
const markdownComponents: Components = {
  // Code blocks with syntax highlighting and special renderers
  code: CodeComponent,

  // Tables with responsive wrapper
  table({ children }) {
    return (
      <div className="table-responsive">
        <table className="markdown-table">{children}</table>
      </div>
    );
  },

  // Links — render audio/video links as inline players, others open in external browser
  a({ href, children, ...props }) {
    if (href && hasExtension(href, AUDIO_EXTENSIONS)) {
      const resolvedHref = resolveLocalMediaUrl(href);
      return (
        <audio controls className="markdown-audio">
          <source src={resolvedHref} />
        </audio>
      );
    }
    if (href && hasExtension(href, VIDEO_EXTENSIONS)) {
      const resolvedHref = resolveLocalMediaUrl(href);
      return (
        <video controls className="markdown-video">
          <source src={resolvedHref} />
        </video>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Images with responsive styling
  // Local filesystem paths are converted to local-media:// protocol for Electron security
  // Also handles cases where LLM uses image syntax for audio/video by converting to player
  img({ src, alt, ...props }) {
    if (src && hasExtension(src, AUDIO_EXTENSIONS)) {
      const resolvedSrc = resolveLocalMediaUrl(src);
      return (
        <audio controls className="markdown-audio">
          <source src={resolvedSrc} />
        </audio>
      );
    }
    if (src && hasExtension(src, VIDEO_EXTENSIONS)) {
      const resolvedSrc = resolveLocalMediaUrl(src);
      return (
        <video controls className="markdown-video">
          <source src={resolvedSrc} />
        </video>
      );
    }
    const resolvedSrc = resolveLocalMediaUrl(src);
    return (
      <img
        src={resolvedSrc}
        alt={alt || ''}
        className="markdown-image"
        loading="lazy"
        {...props}
      />
    );
  },

  // Blockquotes with styling
  blockquote({ children }) {
    return <blockquote className="markdown-blockquote">{children}</blockquote>;
  },

  // Horizontal rule
  hr() {
    return <hr className="markdown-hr" />;
  },

  // Lists
  ul({ children }) {
    return <ul className="markdown-list">{children}</ul>;
  },

  ol({ children }) {
    return <ol className="markdown-list markdown-list--ordered">{children}</ol>;
  },

  // Headings
  h1({ children }) {
    return <h1 className="markdown-heading markdown-h1">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="markdown-heading markdown-h2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="markdown-heading markdown-h3">{children}</h3>;
  },
  h4({ children }) {
    return <h4 className="markdown-heading markdown-h4">{children}</h4>;
  },
  h5({ children }) {
    return <h5 className="markdown-heading markdown-h5">{children}</h5>;
  },
  h6({ children }) {
    return <h6 className="markdown-heading markdown-h6">{children}</h6>;
  },

  // Paragraphs
  p({ children }) {
    return <p className="markdown-paragraph">{children}</p>;
  },
};

// Memoized component to prevent unnecessary re-renders
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className = '',
  isStreaming = false,
}: MarkdownRendererProps): React.ReactElement {
  // Preprocess content to handle edge cases
  const processedContent = useMemo(() => {
    let processed = content;

    // Normalize line endings
    processed = processed.replace(/\r\n/g, '\n');

    // Ensure math blocks have proper spacing
    processed = processed.replace(/\$\$([^$]+)\$\$/g, '\n\n$$\n$1\n$$\n\n');

    // Convert \[...\] to $$...$$ for block math
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$\n$1\n$$\n\n');

    // Convert \(...\) to $...$ for inline math
    processed = processed.replace(/\\\((.*?)\\\)/g, '$$$1$$');

    return processed;
  }, [content]);

  const contextValue = useMemo(() => ({ isStreaming }), [isStreaming]);

  return (
    <MarkdownContext.Provider value={contextValue}>
      <div className={`markdown-content ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[
            [rehypeKatex, {
              throwOnError: false,
              strict: false,
              trust: true,
              macros: {
                '\\arcsinh': '\\operatorname{arcsinh}',
                '\\arccosh': '\\operatorname{arccosh}',
                '\\arctanh': '\\operatorname{arctanh}',
                '\\sgn': '\\operatorname{sgn}',
              }
            }]
          ]}
          components={markdownComponents}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </MarkdownContext.Provider>
  );
});

export default MarkdownRenderer;
