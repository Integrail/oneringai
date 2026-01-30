/**
 * Vega/Vega-Lite Chart Renderer
 * Renders Vega or Vega-Lite JSON specifications as interactive charts
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { VegaLite } from 'react-vega';
import type { VisualizationSpec } from 'react-vega';

interface VegaChartProps {
  code: string;
  isLite?: boolean;
  onError?: (error: Error) => void;
}

export function VegaChart({
  code,
  isLite = true,
  onError,
}: VegaChartProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const [parseError, setParseError] = useState<string | null>(null);

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;

    const measure = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) {
          setContainerWidth(Math.max(width - 32, 300));
        }
      }
    };

    // Initial measure with small delay
    const timeoutId = setTimeout(measure, 10);

    // Re-measure on resize
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);

  // Parse spec with memoization
  const spec = useMemo<VisualizationSpec | null>(() => {
    try {
      const parsed = JSON.parse(code);

      // Set width if not specified
      if (!parsed.width) {
        parsed.width = containerWidth;
      }
      // Set height if not specified
      if (!parsed.height && !parsed.encoding?.row && !parsed.encoding?.column) {
        parsed.height = 300;
      }

      setParseError(null);
      return parsed;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to parse JSON';
      setParseError(errorMsg);
      if (onError) {
        onError(new Error(errorMsg));
      }
      return null;
    }
  }, [code, containerWidth, onError]);

  const handleVegaError = (error: Error) => {
    console.error('Vega render error:', error);
    setParseError(error.message);
    if (onError) {
      onError(error);
    }
  };

  if (parseError) {
    return (
      <div className="vega-chart vega-chart--error">
        <span className="vega-chart__error-text">Error: {parseError}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="vega-chart">
      {spec && (
        <VegaLite
          spec={spec as any}
          actions={{
            export: true,
            source: false,
            compiled: false,
            editor: false,
          }}
          onError={handleVegaError}
        />
      )}
    </div>
  );
}

export default VegaChart;
