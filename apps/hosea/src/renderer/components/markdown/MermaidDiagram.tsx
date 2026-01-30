/**
 * Mermaid Diagram Renderer
 * Renders mermaid diagram code into SVG
 */

import React, { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  code: string;
  onError?: (error: Error) => void;
}

// Initialize mermaid with configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'inherit',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    useMaxWidth: true,
  },
  gantt: {
    useMaxWidth: true,
  },
});

export function MermaidDiagram({ code, onError }: MermaidDiagramProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const uniqueId = useId().replace(/:/g, '_');

  useEffect(() => {
    let mounted = true;

    const renderDiagram = async () => {
      if (!code.trim()) {
        setIsRendering(false);
        return;
      }

      try {
        setIsRendering(true);

        // Preprocess the code to fix common issues
        let processedCode = code.trim();

        // Remove unsupported diagram types and convert to flowchart
        if (processedCode.startsWith('usecase')) {
          processedCode = processedCode.replace(/^usecase/, 'flowchart TD');
        }

        // Fix common syntax issues
        processedCode = processedCode
          .replace(/<br>/gi, '<br/>')
          .replace(/\s*<--\s*/g, ' --> '); // Fix reverse arrows

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${uniqueId}`,
          processedCode
        );

        if (mounted) {
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (mounted) {
          setIsRendering(false);
          if (onError) {
            onError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      }
    };

    renderDiagram();

    return () => {
      mounted = false;
    };
  }, [code, uniqueId, onError]);

  if (isRendering) {
    return (
      <div className="mermaid-diagram mermaid-diagram--loading">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Rendering diagram...</span>
        </div>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="mermaid-diagram mermaid-diagram--empty">
        <span>No diagram to render</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default MermaidDiagram;
