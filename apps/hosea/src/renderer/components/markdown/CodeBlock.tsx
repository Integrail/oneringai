/**
 * Code Block Component with syntax highlighting and special renderers
 * Supports: standard code, mermaid diagrams, vega/vega-lite charts, markmap mindmaps
 *
 * Special blocks (vega, mermaid, markmap) only render after streaming completes
 * to avoid parse errors from incomplete JSON/syntax.
 */

import React, { useState, useCallback, Suspense, lazy, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, AlertCircle, Loader } from 'lucide-react';

// Lazy load heavy components
const MermaidDiagram = lazy(() => import('./MermaidDiagram'));
const VegaChart = lazy(() => import('./VegaChart'));
const MarkmapRenderer = lazy(() => import('./MarkmapRenderer'));

interface CodeBlockProps {
  language: string;
  code: string;
  isStreaming?: boolean;
}

// Loading fallback for lazy-loaded components
const LoadingFallback = () => (
  <div className="code-block__loading">
    <div className="spinner-border spinner-border-sm" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
    <span>Rendering...</span>
  </div>
);

// Streaming preview for special blocks
const StreamingPreview = ({ language, code }: { language: string; code: string }) => (
  <div className="code-block__streaming-preview">
    <div className="code-block__streaming-header">
      <Loader size={14} className="code-block__streaming-spinner" />
      <span>Receiving {language} content...</span>
    </div>
    <pre className="code-block__streaming-code">{code}</pre>
  </div>
);

// Error boundary fallback
const ErrorFallback = ({ error, code }: { error: string; code: string }) => (
  <div className="code-block__error">
    <div className="code-block__error-header">
      <AlertCircle size={16} />
      <span>Rendering Error</span>
    </div>
    <p className="code-block__error-message">{error}</p>
    <pre className="code-block__error-code">{code}</pre>
  </div>
);

// Check if language is a special renderer type
const isSpecialBlock = (lang: string): boolean => {
  const specialLangs = ['mermaid', 'vega', 'vega-lite', 'markmap', 'mindmap'];
  return specialLangs.includes(lang.toLowerCase());
};

export function CodeBlock({ language, code, isStreaming = false }: CodeBlockProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldRender, setShouldRender] = useState(!isStreaming);

  const normalizedLang = language.toLowerCase();
  const isSpecial = isSpecialBlock(normalizedLang);

  // Reset error and allow re-render when streaming completes or code changes significantly
  useEffect(() => {
    if (!isStreaming && isSpecial) {
      // Streaming just completed - reset error and trigger render
      setError(null);
      setShouldRender(true);
    } else if (isStreaming && isSpecial) {
      // Currently streaming - don't render yet
      setShouldRender(false);
    }
  }, [isStreaming, isSpecial, code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  // Special renderers - show preview while streaming
  if (normalizedLang === 'mermaid') {
    return (
      <div className="code-block code-block--mermaid">
        <div className="code-block__header">
          <span className="code-block__language">mermaid</span>
          <button className="code-block__copy" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        {isStreaming || !shouldRender ? (
          <StreamingPreview language="mermaid" code={code} />
        ) : error ? (
          <ErrorFallback error={error} code={code} />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <MermaidDiagram code={code} onError={handleError} />
          </Suspense>
        )}
      </div>
    );
  }

  if (normalizedLang === 'vega' || normalizedLang === 'vega-lite') {
    return (
      <div className={`code-block code-block--${normalizedLang}`}>
        <div className="code-block__header">
          <span className="code-block__language">{normalizedLang}</span>
          <button className="code-block__copy" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        {isStreaming || !shouldRender ? (
          <StreamingPreview language={normalizedLang} code={code} />
        ) : error ? (
          <ErrorFallback error={error} code={code} />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <VegaChart code={code} isLite={normalizedLang === 'vega-lite'} onError={handleError} />
          </Suspense>
        )}
      </div>
    );
  }

  if (normalizedLang === 'markmap' || normalizedLang === 'mindmap') {
    return (
      <div className="code-block code-block--markmap">
        <div className="code-block__header">
          <span className="code-block__language">mindmap</span>
          <button className="code-block__copy" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        {isStreaming || !shouldRender ? (
          <StreamingPreview language="markmap" code={code} />
        ) : error ? (
          <ErrorFallback error={error} code={code} />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            <MarkmapRenderer code={code} onError={handleError} />
          </Suspense>
        )}
      </div>
    );
  }

  // Standard code block with syntax highlighting
  return (
    <div className="code-block">
      <div className="code-block__header">
        <span className="code-block__language">{language || 'text'}</span>
        <button className="code-block__copy" onClick={handleCopy} title="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={normalizedLang || 'text'}
        PreTag="div"
        className="code-block__content"
        showLineNumbers={code.split('\n').length > 5}
        wrapLines
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '13px',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default CodeBlock;
