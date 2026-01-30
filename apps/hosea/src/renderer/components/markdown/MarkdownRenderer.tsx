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

  // Links open in external browser
  a({ href, children, ...props }) {
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
  img({ src, alt, ...props }) {
    return (
      <img
        src={src}
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
