import {
  importOptional
} from "./chunk-74H4V4J6.js";

// src/markdown/MarkmapRenderer.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
function MarkmapRenderer({
  code,
  onError
}) {
  const svgRef = useRef(null);
  const markmapRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);
  const [error, setError] = useState(null);
  const calculateHeight = useCallback((content) => {
    const lines = content.split("\n").filter((line) => line.trim());
    const depth = Math.max(
      ...lines.map((line) => {
        const match = line.match(/^(\s*)/);
        return match ? Math.floor(match[1].length / 2) : 0;
      })
    );
    return Math.max(300, Math.min(600, 200 + lines.length * 20 + depth * 40));
  }, []);
  useEffect(() => {
    let mounted = true;
    const renderMarkmap = async () => {
      if (!svgRef.current || !code.trim()) return;
      try {
        const { Transformer } = await importOptional("markmap-lib");
        const { Markmap, loadCSS, loadJS } = await importOptional("markmap-view");
        const transformer = new Transformer();
        const { root, features } = transformer.transform(code);
        const { styles, scripts } = transformer.getUsedAssets(features);
        if (styles) loadCSS(styles);
        if (scripts) await loadJS(scripts, { getMarkmap: () => ({ Markmap }) });
        if (!mounted) return;
        if (markmapRef.current) {
          markmapRef.current.destroy();
        }
        markmapRef.current = Markmap.create(svgRef.current, {
          duration: 300,
          fitRatio: 0.85,
          spacingHorizontal: 80,
          spacingVertical: 20,
          autoFit: true,
          initialExpandLevel: 3,
          color: (node) => {
            const colors = ["#5B8FF9", "#5AD8A6", "#F6BD16", "#E86452", "#6DC8EC", "#945FB9"];
            return colors[(node.state?.depth || 0) % colors.length];
          }
        });
        markmapRef.current.setData(root);
        markmapRef.current.fit();
        setIsRendered(true);
        setError(null);
      } catch (err) {
        console.error("Markmap render error:", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to render mindmap";
        setError(errorMsg);
        if (onError) onError(err instanceof Error ? err : new Error(errorMsg));
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
      const transform = svg.node()?.getAttribute("transform") || "";
      const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
      const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      markmapRef.current.rescale(Math.min(currentScale * 1.2, 3));
    }
  }, []);
  const handleZoomOut = useCallback(() => {
    if (markmapRef.current) {
      const svg = markmapRef.current.svg;
      const transform = svg.node()?.getAttribute("transform") || "";
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
    return /* @__PURE__ */ jsx("div", { className: "markmap-renderer markmap-renderer--error", children: /* @__PURE__ */ jsxs("span", { className: "markmap-renderer__error-text", children: [
      "Error: ",
      error
    ] }) });
  }
  const height = calculateHeight(code);
  return /* @__PURE__ */ jsxs("div", { className: "markmap-renderer", children: [
    /* @__PURE__ */ jsxs("div", { className: "markmap-renderer__controls", children: [
      /* @__PURE__ */ jsx("button", { className: "markmap-renderer__btn", onClick: handleZoomIn, title: "Zoom In", children: /* @__PURE__ */ jsx(ZoomIn, { size: 14 }) }),
      /* @__PURE__ */ jsx("button", { className: "markmap-renderer__btn", onClick: handleZoomOut, title: "Zoom Out", children: /* @__PURE__ */ jsx(ZoomOut, { size: 14 }) }),
      /* @__PURE__ */ jsx("button", { className: "markmap-renderer__btn", onClick: handleFit, title: "Fit to View", children: /* @__PURE__ */ jsx(Maximize2, { size: 14 }) })
    ] }),
    /* @__PURE__ */ jsx(
      "svg",
      {
        ref: svgRef,
        className: "markmap-renderer__svg",
        style: { width: "100%", height: `${height}px` }
      }
    ),
    !isRendered && /* @__PURE__ */ jsx("div", { className: "markmap-renderer__loading", children: /* @__PURE__ */ jsx("div", { className: "rui-spinner", role: "status", children: /* @__PURE__ */ jsx("span", { className: "rui-visually-hidden", children: "Rendering mindmap..." }) }) })
  ] });
}
var MarkmapRenderer_default = MarkmapRenderer;

export {
  MarkmapRenderer,
  MarkmapRenderer_default
};
//# sourceMappingURL=chunk-WCSWA75O.js.map