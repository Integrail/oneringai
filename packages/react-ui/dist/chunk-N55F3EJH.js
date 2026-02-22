// src/markdown/VegaChart.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function VegaChart({
  code,
  isLite = true,
  onError
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [parseError, setParseError] = useState(null);
  const [VegaLiteComp, setVegaLiteComp] = useState(null);
  useEffect(() => {
    import("react-vega").then((mod) => setVegaLiteComp(() => mod.VegaLite)).catch(() => {
      setParseError("react-vega is not installed. Install it to render Vega charts.");
    });
  }, []);
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
    const timeoutId = setTimeout(measure, 10);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(containerRef.current);
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);
  const spec = useMemo(() => {
    try {
      const parsed = JSON.parse(code);
      if (!parsed.width) parsed.width = containerWidth;
      if (!parsed.height && !parsed.encoding?.row && !parsed.encoding?.column) {
        parsed.height = 300;
      }
      setParseError(null);
      return parsed;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to parse JSON";
      setParseError(errorMsg);
      if (onError) onError(new Error(errorMsg));
      return null;
    }
  }, [code, containerWidth, onError]);
  const handleVegaError = (error) => {
    console.error("Vega render error:", error);
    setParseError(error.message);
    if (onError) onError(error);
  };
  if (parseError) {
    return /* @__PURE__ */ jsx("div", { className: "vega-chart vega-chart--error", children: /* @__PURE__ */ jsxs("span", { className: "vega-chart__error-text", children: [
      "Error: ",
      parseError
    ] }) });
  }
  return /* @__PURE__ */ jsx("div", { ref: containerRef, className: "vega-chart", children: spec && VegaLiteComp && /* @__PURE__ */ jsx(
    VegaLiteComp,
    {
      spec,
      actions: { export: true, source: false, compiled: false, editor: false },
      onError: handleVegaError
    }
  ) });
}
var VegaChart_default = VegaChart;

export {
  VegaChart,
  VegaChart_default
};
//# sourceMappingURL=chunk-N55F3EJH.js.map