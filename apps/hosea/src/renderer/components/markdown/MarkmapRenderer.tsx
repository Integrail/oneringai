/**
 * Markmap Mindmap Renderer
 * Renders markdown content as an interactive mindmap
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap, loadCSS, loadJS } from 'markmap-view';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface MarkmapRendererProps {
  code: string;
  onError?: (error: Error) => void;
}

// Create transformer instance
const transformer = new Transformer();

export function MarkmapRenderer({
  code,
  onError,
}: MarkmapRendererProps): React.ReactElement {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate dynamic height based on content complexity
  const calculateHeight = useCallback((content: string): number => {
    const lines = content.split('\n').filter((line) => line.trim());
    const depth = Math.max(
      ...lines.map((line) => {
        const match = line.match(/^(\s*)/);
        return match ? Math.floor(match[1].length / 2) : 0;
      })
    );
    // Base height + extra for depth and number of items
    return Math.max(300, Math.min(600, 200 + lines.length * 20 + depth * 40));
  }, []);

  useEffect(() => {
    let mounted = true;

    const renderMarkmap = async () => {
      if (!svgRef.current || !code.trim()) return;

      try {
        // Transform markdown to markmap data
        const { root, features } = transformer.transform(code);

        // Load required assets
        const { styles, scripts } = transformer.getUsedAssets(features);
        if (styles) loadCSS(styles);
        if (scripts) await loadJS(scripts, { getMarkmap: () => ({ Markmap }) });

        if (!mounted) return;

        // Clear previous instance
        if (markmapRef.current) {
          markmapRef.current.destroy();
        }

        // Create new markmap instance
        markmapRef.current = Markmap.create(svgRef.current, {
          duration: 300,
          fitRatio: 0.85,
          spacingHorizontal: 80,
          spacingVertical: 20,
          autoFit: true,
          initialExpandLevel: 3,
          color: (node: any) => {
            // Color based on depth
            const colors = [
              '#5B8FF9',
              '#5AD8A6',
              '#F6BD16',
              '#E86452',
              '#6DC8EC',
              '#945FB9',
            ];
            return colors[(node.state?.depth || 0) % colors.length];
          },
        });

        // Set the data
        markmapRef.current.setData(root);
        markmapRef.current.fit();

        setIsRendered(true);
        setError(null);
      } catch (err) {
        console.error('Markmap render error:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to render mindmap';
        setError(errorMsg);
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMsg));
        }
      }
    };

    renderMarkmap();

    return () => {
      mounted = false;
      if (markmapRef.current) {
        markmapRef.current.destroy();
        markmapRef.current = null;
      }
    };
  }, [code, onError]);

  const handleZoomIn = useCallback(() => {
    if (markmapRef.current) {
      const svg = markmapRef.current.svg;
      const transform = svg.node()?.getAttribute('transform') || '';
      const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
      const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      markmapRef.current.rescale(Math.min(currentScale * 1.2, 3));
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (markmapRef.current) {
      const svg = markmapRef.current.svg;
      const transform = svg.node()?.getAttribute('transform') || '';
      const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
      const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      markmapRef.current.rescale(Math.max(currentScale / 1.2, 0.3));
    }
  }, []);

  const handleFit = useCallback(() => {
    if (markmapRef.current) {
      markmapRef.current.fit();
    }
  }, []);

  if (error) {
    return (
      <div className="markmap-renderer markmap-renderer--error">
        <span className="markmap-renderer__error-text">Error: {error}</span>
      </div>
    );
  }

  const height = calculateHeight(code);

  return (
    <div className="markmap-renderer">
      <div className="markmap-renderer__controls">
        <button
          className="markmap-renderer__btn"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="markmap-renderer__btn"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          className="markmap-renderer__btn"
          onClick={handleFit}
          title="Fit to View"
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <svg
        ref={svgRef}
        className="markmap-renderer__svg"
        style={{ width: '100%', height: `${height}px` }}
      />
      {!isRendered && (
        <div className="markmap-renderer__loading">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Rendering mindmap...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarkmapRenderer;
