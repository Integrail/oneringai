// src/markdown/MermaidDiagram.tsx
import { useEffect, useRef, useState, useId } from "react";
import { jsx } from "react/jsx-runtime";
function MermaidDiagram({ code, onError }) {
  const containerRef = useRef(null);
  const [svg, setSvg] = useState(null);
  const [isRendering, setIsRendering] = useState(true);
  const uniqueId = useId().replace(/:/g, "_");
  useEffect(() => {
    let mounted = true;
    const renderDiagram = async () => {
      if (!code.trim()) {
        setIsRendering(false);
        return;
      }
      try {
        setIsRendering(true);
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          fontFamily: "inherit",
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
          sequence: { useMaxWidth: true },
          gantt: { useMaxWidth: true }
        });
        let processedCode = code.trim();
        if (processedCode.startsWith("usecase")) {
          processedCode = processedCode.replace(/^usecase/, "flowchart TD");
        }
        processedCode = processedCode.replace(/<br>/gi, "<br/>").replace(/\s*<--\s*/g, " --> ");
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${uniqueId}`,
          processedCode
        );
        if (mounted) {
          setSvg(renderedSvg);
          setIsRendering(false);
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
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
    return /* @__PURE__ */ jsx("div", { className: "mermaid-diagram mermaid-diagram--loading", children: /* @__PURE__ */ jsx("div", { className: "rui-spinner", role: "status", children: /* @__PURE__ */ jsx("span", { className: "rui-visually-hidden", children: "Rendering diagram..." }) }) });
  }
  if (!svg) {
    return /* @__PURE__ */ jsx("div", { className: "mermaid-diagram mermaid-diagram--empty", children: /* @__PURE__ */ jsx("span", { children: "No diagram to render" }) });
  }
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: containerRef,
      className: "mermaid-diagram",
      dangerouslySetInnerHTML: { __html: svg }
    }
  );
}
var MermaidDiagram_default = MermaidDiagram;

export {
  MermaidDiagram,
  MermaidDiagram_default
};
//# sourceMappingURL=chunk-GBLSWHXJ.js.map