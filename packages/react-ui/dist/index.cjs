"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/markdown/MermaidDiagram.tsx
var MermaidDiagram_exports = {};
__export(MermaidDiagram_exports, {
  MermaidDiagram: () => MermaidDiagram,
  default: () => MermaidDiagram_default
});
function MermaidDiagram({ code, onError }) {
  const containerRef = (0, import_react4.useRef)(null);
  const [svg, setSvg] = (0, import_react4.useState)(null);
  const [isRendering, setIsRendering] = (0, import_react4.useState)(true);
  const uniqueId = (0, import_react4.useId)().replace(/:/g, "_");
  (0, import_react4.useEffect)(() => {
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
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "mermaid-diagram mermaid-diagram--loading", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "rui-spinner", role: "status", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "rui-visually-hidden", children: "Rendering diagram..." }) }) });
  }
  if (!svg) {
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "mermaid-diagram mermaid-diagram--empty", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: "No diagram to render" }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
    "div",
    {
      ref: containerRef,
      className: "mermaid-diagram",
      dangerouslySetInnerHTML: { __html: svg }
    }
  );
}
var import_react4, import_jsx_runtime13, MermaidDiagram_default;
var init_MermaidDiagram = __esm({
  "src/markdown/MermaidDiagram.tsx"() {
    "use strict";
    import_react4 = require("react");
    import_jsx_runtime13 = require("react/jsx-runtime");
    MermaidDiagram_default = MermaidDiagram;
  }
});

// src/markdown/VegaChart.tsx
var VegaChart_exports = {};
__export(VegaChart_exports, {
  VegaChart: () => VegaChart,
  default: () => VegaChart_default
});
function VegaChart({
  code,
  isLite = true,
  onError
}) {
  const containerRef = (0, import_react5.useRef)(null);
  const [containerWidth, setContainerWidth] = (0, import_react5.useState)(600);
  const [parseError, setParseError] = (0, import_react5.useState)(null);
  const [VegaLiteComp, setVegaLiteComp] = (0, import_react5.useState)(null);
  (0, import_react5.useEffect)(() => {
    import("react-vega").then((mod) => setVegaLiteComp(() => mod.VegaLite)).catch(() => {
      setParseError("react-vega is not installed. Install it to render Vega charts.");
    });
  }, []);
  (0, import_react5.useEffect)(() => {
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
  const spec = (0, import_react5.useMemo)(() => {
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
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "vega-chart vega-chart--error", children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: "vega-chart__error-text", children: [
      "Error: ",
      parseError
    ] }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { ref: containerRef, className: "vega-chart", children: spec && VegaLiteComp && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    VegaLiteComp,
    {
      spec,
      actions: { export: true, source: false, compiled: false, editor: false },
      onError: handleVegaError
    }
  ) });
}
var import_react5, import_jsx_runtime14, VegaChart_default;
var init_VegaChart = __esm({
  "src/markdown/VegaChart.tsx"() {
    "use strict";
    import_react5 = require("react");
    import_jsx_runtime14 = require("react/jsx-runtime");
    VegaChart_default = VegaChart;
  }
});

// src/markdown/MarkmapRenderer.tsx
var MarkmapRenderer_exports = {};
__export(MarkmapRenderer_exports, {
  MarkmapRenderer: () => MarkmapRenderer,
  default: () => MarkmapRenderer_default
});
function MarkmapRenderer({
  code,
  onError
}) {
  const svgRef = (0, import_react6.useRef)(null);
  const markmapRef = (0, import_react6.useRef)(null);
  const [isRendered, setIsRendered] = (0, import_react6.useState)(false);
  const [error, setError] = (0, import_react6.useState)(null);
  const calculateHeight = (0, import_react6.useCallback)((content) => {
    const lines = content.split("\n").filter((line) => line.trim());
    const depth = Math.max(
      ...lines.map((line) => {
        const match = line.match(/^(\s*)/);
        return match ? Math.floor(match[1].length / 2) : 0;
      })
    );
    return Math.max(300, Math.min(600, 200 + lines.length * 20 + depth * 40));
  }, []);
  (0, import_react6.useEffect)(() => {
    let mounted = true;
    const renderMarkmap = async () => {
      if (!svgRef.current || !code.trim()) return;
      try {
        const { Transformer } = await import("markmap-lib");
        const { Markmap, loadCSS, loadJS } = await import("markmap-view");
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
  const handleZoomIn = (0, import_react6.useCallback)(() => {
    if (markmapRef.current) {
      const svg = markmapRef.current.svg;
      const transform = svg.node()?.getAttribute("transform") || "";
      const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
      const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      markmapRef.current.rescale(Math.min(currentScale * 1.2, 3));
    }
  }, []);
  const handleZoomOut = (0, import_react6.useCallback)(() => {
    if (markmapRef.current) {
      const svg = markmapRef.current.svg;
      const transform = svg.node()?.getAttribute("transform") || "";
      const scaleMatch = transform.match(/scale\(([\d.]+)\)/);
      const currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      markmapRef.current.rescale(Math.max(currentScale / 1.2, 0.3));
    }
  }, []);
  const handleFit = (0, import_react6.useCallback)(() => {
    if (markmapRef.current) {
      markmapRef.current.fit();
    }
  }, []);
  if (error) {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "markmap-renderer markmap-renderer--error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "markmap-renderer__error-text", children: [
      "Error: ",
      error
    ] }) });
  }
  const height = calculateHeight(code);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "markmap-renderer", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "markmap-renderer__controls", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { className: "markmap-renderer__btn", onClick: handleZoomIn, title: "Zoom In", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react.ZoomIn, { size: 14 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { className: "markmap-renderer__btn", onClick: handleZoomOut, title: "Zoom Out", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react.ZoomOut, { size: 14 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("button", { className: "markmap-renderer__btn", onClick: handleFit, title: "Fit to View", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_lucide_react.Maximize2, { size: 14 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "svg",
      {
        ref: svgRef,
        className: "markmap-renderer__svg",
        style: { width: "100%", height: `${height}px` }
      }
    ),
    !isRendered && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "markmap-renderer__loading", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "rui-spinner", role: "status", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "rui-visually-hidden", children: "Rendering mindmap..." }) }) })
  ] });
}
var import_react6, import_lucide_react, import_jsx_runtime15, MarkmapRenderer_default;
var init_MarkmapRenderer = __esm({
  "src/markdown/MarkmapRenderer.tsx"() {
    "use strict";
    import_react6 = require("react");
    import_lucide_react = require("lucide-react");
    import_jsx_runtime15 = require("react/jsx-runtime");
    MarkmapRenderer_default = MarkmapRenderer;
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ChatControls: () => ChatControls,
  CodeBlock: () => CodeBlock,
  CollapsibleSection: () => CollapsibleSection,
  ContextDisplayPanel: () => ContextDisplayPanel,
  ContextEntryCard: () => ContextEntryCard,
  ContextWindowSection: () => ContextWindowSection,
  ExecutionProgress: () => ExecutionProgress,
  ExportMessage: () => ExportMessage,
  GenericPluginSection: () => GenericPluginSection,
  InContextMemoryRenderer: () => InContextMemoryRenderer,
  InlineToolCall: () => InlineToolCall,
  LookInsidePanel: () => LookInsidePanel,
  MarkdownRenderer: () => MarkdownRenderer,
  MarkmapRenderer: () => MarkmapRenderer,
  MermaidDiagram: () => MermaidDiagram,
  MessageList: () => MessageList,
  PersistentInstructionsRenderer: () => PersistentInstructionsRenderer,
  RenderErrorBoundary: () => RenderErrorBoundary,
  StreamingText: () => StreamingText,
  SystemPromptSection: () => SystemPromptSection,
  ThinkingBlock: () => ThinkingBlock,
  TokenBreakdownSection: () => TokenBreakdownSection,
  ToolCallCard: () => ToolCallCard,
  ToolsSection: () => ToolsSection,
  UserInfoRenderer: () => UserInfoRenderer,
  VegaChart: () => VegaChart,
  ViewContextContent: () => ViewContextContent,
  WorkingMemoryRenderer: () => WorkingMemoryRenderer,
  formatBytes: () => formatBytes,
  formatNumber: () => formatNumber,
  formatPluginName: () => formatPluginName,
  formatTimestamp: () => formatTimestamp,
  formatValueForDisplay: () => formatValueForDisplay,
  getPluginRenderer: () => getPluginRenderer,
  getRegisteredPluginNames: () => getRegisteredPluginNames,
  getUtilizationColor: () => getUtilizationColor,
  getUtilizationLabel: () => getUtilizationLabel,
  registerPluginRenderer: () => registerPluginRenderer,
  truncateText: () => truncateText,
  useDynamicUIChangeDetection: () => useDynamicUIChangeDetection,
  useMarkdownContext: () => useMarkdownContext,
  useOrderPersistence: () => useOrderPersistence
});
module.exports = __toCommonJS(index_exports);

// src/look-inside/LookInsidePanel.tsx
var import_react3 = require("react");

// src/look-inside/CollapsibleSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var CollapsibleSection = ({
  title,
  id,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  badge,
  icon,
  children,
  className
}) => {
  const [internalExpanded, setInternalExpanded] = (0, import_react.useState)(defaultExpanded);
  const isControlled = controlledExpanded !== void 0;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const toggle = (0, import_react.useCallback)(() => {
    if (onToggle) {
      onToggle(id);
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [id, onToggle]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: `look-inside-section ${expanded ? "look-inside-section-expanded" : ""} ${className ?? ""}`,
      "data-section-id": id,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            className: "look-inside-section-header",
            onClick: toggle,
            "aria-expanded": expanded,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "look-inside-section-chevron", children: expanded ? "\u25BE" : "\u25B8" }),
              icon && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "look-inside-section-icon", children: icon }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "look-inside-section-title", children: title }),
              badge !== void 0 && badge !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "look-inside-section-badge", children: badge })
            ]
          }
        ),
        expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "look-inside-section-content", children })
      ]
    }
  );
};

// src/look-inside/utils.ts
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
function formatNumber(n) {
  return n.toLocaleString();
}
function getUtilizationColor(percent) {
  if (percent >= 90) return "look-inside-utilization-critical";
  if (percent >= 70) return "look-inside-utilization-warning";
  return "look-inside-utilization-normal";
}
function getUtilizationLabel(percent) {
  if (percent >= 90) return "Critical";
  if (percent >= 70) return "Warning";
  return "Normal";
}
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}
function formatPluginName(name) {
  return name.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function formatTimestamp(ts) {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 6e4) return "just now";
  if (diff < 36e5) return `${Math.floor(diff / 6e4)}m ago`;
  if (diff < 864e5) return `${Math.floor(diff / 36e5)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// src/look-inside/sections/ContextWindowSection.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var ContextWindowSection = ({
  budget,
  messagesCount,
  toolCallsCount,
  strategy
}) => {
  const colorClass = getUtilizationColor(budget.utilizationPercent);
  const label = getUtilizationLabel(budget.utilizationPercent);
  const pct = Math.min(budget.utilizationPercent, 100);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-context-window", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "look-inside-progress-bar-container", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: `look-inside-progress-bar ${colorClass}`,
        style: { width: `${pct}%` },
        role: "progressbar",
        "aria-valuenow": pct,
        "aria-valuemin": 0,
        "aria-valuemax": 100
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-context-stats", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: `look-inside-utilization-label ${colorClass}`, children: [
        pct.toFixed(1),
        "% \u2014 ",
        label
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "look-inside-context-stat", children: [
        formatNumber(budget.totalUsed),
        " / ",
        formatNumber(budget.maxTokens),
        " tokens"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-context-details", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-label", children: "Available" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "look-inside-stat-value", children: [
          formatNumber(budget.available),
          " tokens"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-label", children: "Response Reserve" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "look-inside-stat-value", children: [
          formatNumber(budget.responseReserve),
          " tokens"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-label", children: "Messages" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-value", children: messagesCount })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-label", children: "Tool Calls" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-value", children: toolCallsCount })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-label", children: "Strategy" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "look-inside-stat-value", children: strategy })
      ] })
    ] })
  ] });
};

// src/look-inside/sections/TokenBreakdownSection.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var TokenBreakdownSection = ({
  budget
}) => {
  const { breakdown } = budget;
  const total = budget.totalUsed || 1;
  const items = [
    { name: "System Prompt", tokens: breakdown.systemPrompt, percent: breakdown.systemPrompt / total * 100 },
    { name: "Persistent Instructions", tokens: breakdown.persistentInstructions, percent: breakdown.persistentInstructions / total * 100 },
    { name: "Plugin Instructions", tokens: breakdown.pluginInstructions, percent: breakdown.pluginInstructions / total * 100 },
    ...Object.entries(breakdown.pluginContents).map(([name, tokens]) => ({
      name: `Plugin: ${formatPluginLabel(name)}`,
      tokens,
      percent: tokens / total * 100
    })),
    { name: "Tools", tokens: breakdown.tools, percent: breakdown.tools / total * 100 },
    { name: "Conversation", tokens: breakdown.conversation, percent: breakdown.conversation / total * 100 },
    { name: "Current Input", tokens: breakdown.currentInput, percent: breakdown.currentInput / total * 100 }
  ].filter((item) => item.tokens > 0);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "look-inside-token-breakdown", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "look-inside-breakdown-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "look-inside-breakdown-label", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "look-inside-breakdown-name", children: item.name }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "look-inside-breakdown-tokens", children: [
        formatNumber(item.tokens),
        " (",
        item.percent.toFixed(1),
        "%)"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "look-inside-breakdown-bar-container", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        className: "look-inside-breakdown-bar",
        style: { width: `${Math.max(item.percent, 0.5)}%` }
      }
    ) })
  ] }, item.name)) });
};
function formatPluginLabel(name) {
  return name.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// src/look-inside/sections/SystemPromptSection.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var SystemPromptSection = ({
  content
}) => {
  if (!content) {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "look-inside-system-prompt", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "look-inside-muted", children: "No system prompt configured" }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "look-inside-system-prompt", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { children: content }) }) });
};

// src/look-inside/sections/ToolsSection.tsx
var import_react2 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var ToolsSection = ({ tools }) => {
  const [filter, setFilter] = (0, import_react2.useState)("");
  const filtered = (0, import_react2.useMemo)(() => {
    if (!filter) return tools;
    const lower = filter.toLowerCase();
    return tools.filter(
      (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower) || t.namespace && t.namespace.toLowerCase().includes(lower)
    );
  }, [tools, filter]);
  const enabledCount = tools.filter((t) => t.enabled).length;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "look-inside-tools", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "look-inside-tools-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "look-inside-tools-count", children: [
        enabledCount,
        " / ",
        tools.length,
        " enabled"
      ] }),
      tools.length > 5 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "input",
        {
          type: "text",
          className: "look-inside-tools-filter",
          placeholder: "Filter tools...",
          value: filter,
          onChange: (e) => setFilter(e.target.value)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "look-inside-tools-list", children: [
      filtered.map((tool) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "div",
        {
          className: `look-inside-tool-item ${!tool.enabled ? "look-inside-tool-disabled" : ""}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "look-inside-tool-name", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: `look-inside-tool-badge ${tool.enabled ? "look-inside-badge-on" : "look-inside-badge-off"}`, children: tool.enabled ? "ON" : "OFF" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: tool.name }),
              tool.namespace && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "look-inside-tool-namespace", children: tool.namespace })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "look-inside-tool-meta", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "look-inside-tool-desc", children: truncateText(tool.description, 120) }),
              tool.callCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "look-inside-tool-calls", children: [
                tool.callCount,
                " call",
                tool.callCount !== 1 ? "s" : ""
              ] })
            ] })
          ]
        },
        tool.name
      )),
      filtered.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "look-inside-muted", children: filter ? "No tools match filter" : "No tools registered" })
    ] })
  ] });
};

// src/look-inside/sections/GenericPluginSection.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var GenericPluginSection = ({
  plugin
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "look-inside-generic-plugin", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "look-inside-plugin-meta", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "look-inside-stat-label", children: "Tokens" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "look-inside-stat-value", children: formatNumber(plugin.tokenSize) }),
      plugin.compactable && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "look-inside-badge-compactable", children: "compactable" })
    ] }),
    plugin.formattedContent ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: plugin.formattedContent }) }) : plugin.contents != null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: JSON.stringify(plugin.contents, null, 2) }) }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "look-inside-muted", children: "No content" })
  ] });
};

// src/look-inside/plugins/WorkingMemoryRenderer.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var WorkingMemoryRenderer = ({
  plugin,
  onEntryClick,
  entryValues,
  loadingEntryKey
}) => {
  const raw = plugin.contents;
  const entries = Array.isArray(raw) ? raw : raw?.entries ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "look-inside-muted", children: "No entries in working memory" });
  }
  const isClickable = !!onEntryClick;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "look-inside-working-memory", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " entr",
      entries.length === 1 ? "y" : "ies"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "look-inside-entry-list", children: entries.map((entry) => {
      const scope = typeof entry.scope === "object" ? JSON.stringify(entry.scope) : String(entry.scope ?? "session");
      const isLoading = loadingEntryKey === entry.key;
      const hasValue = entryValues?.has(entry.key) ?? false;
      const isExpanded = hasValue || isLoading;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "div",
        {
          className: `look-inside-entry-item ${isClickable ? "look-inside-entry-clickable" : ""} ${isExpanded ? "look-inside-entry-expanded" : ""}`,
          onClick: isClickable ? () => onEntryClick(entry.key) : void 0,
          role: isClickable ? "button" : void 0,
          tabIndex: isClickable ? 0 : void 0,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "look-inside-entry-header", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("code", { className: "look-inside-entry-key", children: entry.key }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: `look-inside-priority look-inside-priority-${entry.basePriority ?? "normal"}`, children: entry.basePriority ?? "normal" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "look-inside-entry-desc", children: entry.description }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "look-inside-entry-meta", children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
                "Scope: ",
                scope
              ] }),
              entry.tier && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
                "Tier: ",
                entry.tier
              ] }),
              entry.sizeBytes != null && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
                "Size: ",
                formatBytes(entry.sizeBytes)
              ] }),
              entry.updatedAt && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { children: formatTimestamp(entry.updatedAt) })
            ] }),
            isLoading && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "look-inside-entry-loading", children: "Loading value..." }),
            hasValue && !isLoading && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("pre", { className: "look-inside-code-block-sm", children: JSON.stringify(entryValues.get(entry.key), null, 2) })
          ]
        },
        entry.key
      );
    }) })
  ] });
};

// src/look-inside/plugins/InContextMemoryRenderer.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var InContextMemoryRenderer = ({
  plugin
}) => {
  const entries = plugin.contents ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "look-inside-muted", children: "No entries in context memory" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "look-inside-in-context-memory", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " entr",
      entries.length === 1 ? "y" : "ies"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "look-inside-entry-list", children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "look-inside-entry-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "look-inside-entry-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("code", { className: "look-inside-entry-key", children: entry.key }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: `look-inside-priority look-inside-priority-${entry.priority}`, children: entry.priority })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "look-inside-entry-desc", children: entry.description }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "look-inside-entry-value", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("pre", { className: "look-inside-code-block-sm", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("code", { children: typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value, null, 2) }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "look-inside-entry-meta", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { children: formatTimestamp(entry.updatedAt) }) })
    ] }, entry.key)) })
  ] });
};

// src/look-inside/plugins/PersistentInstructionsRenderer.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var PersistentInstructionsRenderer = ({
  plugin
}) => {
  const entries = plugin.contents ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "look-inside-muted", children: "No persistent instructions" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "look-inside-persistent-instructions", children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " instruction",
      entries.length !== 1 ? "s" : ""
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "look-inside-entry-list", children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "look-inside-entry-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "look-inside-entry-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { className: "look-inside-entry-key", children: entry.id }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "look-inside-entry-meta-inline", children: formatTimestamp(entry.updatedAt) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("pre", { className: "look-inside-code-block-sm", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { children: entry.content }) })
    ] }, entry.id)) })
  ] });
};

// src/look-inside/plugins/UserInfoRenderer.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var UserInfoRenderer = ({
  plugin
}) => {
  const entries = plugin.contents ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "look-inside-muted", children: "No user info stored" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "look-inside-user-info", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " entr",
      entries.length === 1 ? "y" : "ies"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "look-inside-entry-list", children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "look-inside-entry-item", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "look-inside-entry-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("code", { className: "look-inside-entry-key", children: entry.key }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "look-inside-entry-type", children: entry.valueType })
      ] }),
      entry.description && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "look-inside-entry-desc", children: entry.description }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "look-inside-entry-value", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("pre", { className: "look-inside-code-block-sm", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("code", { children: typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value, null, 2) }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "look-inside-entry-meta", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: formatTimestamp(entry.updatedAt) }) })
    ] }, entry.key)) })
  ] });
};

// src/look-inside/plugins/registry.ts
var renderers = /* @__PURE__ */ new Map();
renderers.set("working_memory", WorkingMemoryRenderer);
renderers.set("in_context_memory", InContextMemoryRenderer);
renderers.set("persistent_instructions", PersistentInstructionsRenderer);
renderers.set("user_info", UserInfoRenderer);
function registerPluginRenderer(name, renderer) {
  renderers.set(name, renderer);
}
function getPluginRenderer(name) {
  return renderers.get(name) ?? null;
}
function getRegisteredPluginNames() {
  return Array.from(renderers.keys());
}

// src/look-inside/LookInsidePanel.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
var LookInsidePanel = ({
  snapshot,
  loading = false,
  agentName,
  headerActions,
  onViewFullContext,
  onForceCompaction,
  className,
  pluginRenderers,
  defaultExpanded = ["context", "tools"],
  onMemoryEntryClick,
  memoryEntryValues,
  loadingMemoryKey
}) => {
  const initialized = (0, import_react3.useRef)(false);
  const [expandedSet, setExpandedSet] = (0, import_react3.useState)(() => new Set(defaultExpanded));
  if (!initialized.current) {
    initialized.current = true;
  }
  const toggleSection = (0, import_react3.useCallback)((id) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const isSectionExpanded = (0, import_react3.useCallback)((id) => expandedSet.has(id), [expandedSet]);
  const resolveRenderer = (0, import_react3.useMemo)(() => {
    return (pluginName) => {
      if (pluginRenderers?.[pluginName]) return pluginRenderers[pluginName];
      return getPluginRenderer(pluginName);
    };
  }, [pluginRenderers]);
  if (loading) {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: `look-inside-panel look-inside-loading ${className ?? ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "look-inside-spinner", children: "Loading..." }) });
  }
  if (!snapshot || !snapshot.available) {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: `look-inside-panel look-inside-unavailable ${className ?? ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "look-inside-muted", children: "Context not available" }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: `look-inside-panel ${className ?? ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "look-inside-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "look-inside-header-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "look-inside-title", children: agentName ? `${agentName} \u2014 Look Inside` : "Look Inside" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "look-inside-model-badge", children: snapshot.model })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "look-inside-header-actions", children: [
        onViewFullContext && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "button",
          {
            type: "button",
            className: "look-inside-btn look-inside-btn-secondary",
            onClick: onViewFullContext,
            children: "View Full Context"
          }
        ),
        onForceCompaction && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "button",
          {
            type: "button",
            className: "look-inside-btn look-inside-btn-secondary",
            onClick: onForceCompaction,
            children: "Force Compaction"
          }
        ),
        headerActions
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      CollapsibleSection,
      {
        title: "Context Window",
        id: "context",
        onToggle: toggleSection,
        expanded: isSectionExpanded("context"),
        badge: `${snapshot.budget.utilizationPercent.toFixed(0)}%`,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          ContextWindowSection,
          {
            budget: snapshot.budget,
            messagesCount: snapshot.messagesCount,
            toolCallsCount: snapshot.toolCallsCount,
            strategy: snapshot.strategy
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      CollapsibleSection,
      {
        title: "Token Breakdown",
        id: "tokens",
        onToggle: toggleSection,
        expanded: isSectionExpanded("tokens"),
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(TokenBreakdownSection, { budget: snapshot.budget })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      CollapsibleSection,
      {
        title: "System Prompt",
        id: "system-prompt",
        onToggle: toggleSection,
        expanded: isSectionExpanded("system-prompt"),
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SystemPromptSection, { content: snapshot.systemPrompt })
      }
    ),
    snapshot.plugins.map((plugin) => {
      const Renderer = resolveRenderer(plugin.name) ?? GenericPluginSection;
      const extraProps = plugin.name === "working_memory" ? { onEntryClick: onMemoryEntryClick, entryValues: memoryEntryValues, loadingEntryKey: loadingMemoryKey } : {};
      return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        CollapsibleSection,
        {
          title: plugin.displayName,
          id: `plugin-${plugin.name}`,
          onToggle: toggleSection,
          expanded: isSectionExpanded(`plugin-${plugin.name}`),
          badge: plugin.tokenSize > 0 ? `${plugin.tokenSize} tok` : void 0,
          children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Renderer, { plugin, ...extraProps })
        },
        plugin.name
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      CollapsibleSection,
      {
        title: "Tools",
        id: "tools",
        onToggle: toggleSection,
        expanded: isSectionExpanded("tools"),
        badge: snapshot.tools.length,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(ToolsSection, { tools: snapshot.tools })
      }
    )
  ] });
};

// src/look-inside/ViewContextContent.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var ViewContextContent = ({
  data,
  loading = false,
  error = null,
  onCopyAll,
  className
}) => {
  if (loading) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: `look-inside-view-context look-inside-loading ${className ?? ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "look-inside-spinner", children: "Preparing context..." }) });
  }
  if (error) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: `look-inside-view-context look-inside-error ${className ?? ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "look-inside-error-message", children: error }) });
  }
  if (!data || !data.available) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: `look-inside-view-context ${className ?? ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "look-inside-muted", children: "Context not available" }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: `look-inside-view-context ${className ?? ""}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "look-inside-view-context-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "look-inside-view-context-total", children: [
        "Total: ",
        formatNumber(data.totalTokens),
        " tokens (",
        data.components.length,
        " component",
        data.components.length !== 1 ? "s" : "",
        ")"
      ] }),
      onCopyAll && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        "button",
        {
          type: "button",
          className: "look-inside-btn look-inside-btn-secondary",
          onClick: onCopyAll,
          children: "Copy All"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "look-inside-view-context-components", children: data.components.map((component, index) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "look-inside-view-context-component", children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "look-inside-view-context-component-header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "look-inside-view-context-component-name", children: component.name }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: "look-inside-view-context-component-tokens", children: [
          "~",
          formatNumber(component.tokenEstimate),
          " tokens"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("code", { children: component.content }) })
    ] }, index)) })
  ] });
};

// src/markdown/MarkdownRenderer.tsx
var import_react8 = require("react");
var import_react_markdown = __toESM(require("react-markdown"), 1);
var import_remark_gfm = __toESM(require("remark-gfm"), 1);
var import_remark_math = __toESM(require("remark-math"), 1);
var import_rehype_katex = __toESM(require("rehype-katex"), 1);

// src/markdown/CodeBlock.tsx
var import_react7 = require("react");
var import_react_syntax_highlighter = require("react-syntax-highlighter");
var import_prism = require("react-syntax-highlighter/dist/esm/styles/prism");
var import_lucide_react2 = require("lucide-react");
var import_jsx_runtime16 = require("react/jsx-runtime");
var MermaidDiagram2 = (0, import_react7.lazy)(() => Promise.resolve().then(() => (init_MermaidDiagram(), MermaidDiagram_exports)));
var VegaChart2 = (0, import_react7.lazy)(() => Promise.resolve().then(() => (init_VegaChart(), VegaChart_exports)));
var MarkmapRenderer2 = (0, import_react7.lazy)(() => Promise.resolve().then(() => (init_MarkmapRenderer(), MarkmapRenderer_exports)));
var LoadingFallback = () => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__loading", children: [
  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: "rui-spinner", role: "status", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "rui-visually-hidden", children: "Loading..." }) }),
  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: "Rendering..." })
] });
var StreamingPreview = ({ language, code }) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__streaming-preview", children: [
  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__streaming-header", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Loader, { size: 14, className: "code-block__streaming-spinner" }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("span", { children: [
      "Receiving ",
      language,
      " content..."
    ] })
  ] }),
  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("pre", { className: "code-block__streaming-code", children: code })
] });
var ErrorFallback = ({ error, code }) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__error", children: [
  /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__error-header", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.AlertCircle, { size: 16 }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: "Rendering Error" })
  ] }),
  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("p", { className: "code-block__error-message", children: error }),
  /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("pre", { className: "code-block__error-code", children: code })
] });
var isSpecialBlock = (lang) => {
  const specialLangs = ["mermaid", "vega", "vega-lite", "markmap", "mindmap"];
  return specialLangs.includes(lang.toLowerCase());
};
function CodeBlock({ language, code, isStreaming = false }) {
  const [copied, setCopied] = (0, import_react7.useState)(false);
  const [error, setError] = (0, import_react7.useState)(null);
  const [shouldRender, setShouldRender] = (0, import_react7.useState)(!isStreaming);
  const normalizedLang = language.toLowerCase();
  const isSpecial = isSpecialBlock(normalizedLang);
  (0, import_react7.useEffect)(() => {
    if (!isStreaming && isSpecial) {
      setError(null);
      setShouldRender(true);
    } else if (isStreaming && isSpecial) {
      setShouldRender(false);
    }
  }, [isStreaming, isSpecial, code]);
  const handleCopy = (0, import_react7.useCallback)(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [code]);
  const handleError = (0, import_react7.useCallback)((err) => {
    setError(err.message);
  }, []);
  if (normalizedLang === "mermaid") {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block code-block--mermaid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "code-block__language", children: "mermaid" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { className: "code-block__copy", onClick: handleCopy, title: "Copy code", children: copied ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Check, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Copy, { size: 14 }) })
      ] }),
      isStreaming || !shouldRender ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(StreamingPreview, { language: "mermaid", code }) : error ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(ErrorFallback, { error, code }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_react7.Suspense, { fallback: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(LoadingFallback, {}), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MermaidDiagram2, { code, onError: handleError }) })
    ] });
  }
  if (normalizedLang === "vega" || normalizedLang === "vega-lite") {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: `code-block code-block--${normalizedLang}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "code-block__language", children: normalizedLang }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { className: "code-block__copy", onClick: handleCopy, title: "Copy code", children: copied ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Check, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Copy, { size: 14 }) })
      ] }),
      isStreaming || !shouldRender ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(StreamingPreview, { language: normalizedLang, code }) : error ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(ErrorFallback, { error, code }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_react7.Suspense, { fallback: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(LoadingFallback, {}), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(VegaChart2, { code, isLite: normalizedLang === "vega-lite", onError: handleError }) })
    ] });
  }
  if (normalizedLang === "markmap" || normalizedLang === "mindmap") {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block code-block--markmap", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__header", children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "code-block__language", children: "mindmap" }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { className: "code-block__copy", onClick: handleCopy, title: "Copy code", children: copied ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Check, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Copy, { size: 14 }) })
      ] }),
      isStreaming || !shouldRender ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(StreamingPreview, { language: "markmap", code }) : error ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(ErrorFallback, { error, code }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_react7.Suspense, { fallback: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(LoadingFallback, {}), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MarkmapRenderer2, { code, onError: handleError }) })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: "code-block__header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: "code-block__language", children: language || "text" }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("button", { className: "code-block__copy", onClick: handleCopy, title: "Copy code", children: copied ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Check, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_lucide_react2.Copy, { size: 14 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
      import_react_syntax_highlighter.Prism,
      {
        style: import_prism.oneDark,
        language: normalizedLang || "text",
        PreTag: "div",
        className: "code-block__content",
        showLineNumbers: code.split("\n").length > 5,
        wrapLines: true,
        customStyle: {
          margin: 0,
          borderRadius: "0 0 8px 8px",
          fontSize: "13px"
        },
        children: code
      }
    )
  ] });
}

// src/markdown/MarkdownRenderer.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
var MarkdownContext = (0, import_react8.createContext)({ isStreaming: false });
var useMarkdownContext = () => (0, import_react8.useContext)(MarkdownContext);
function findMatchingBrace(text, startIndex) {
  let depth = 0;
  for (let i = startIndex; i < text.length; i++) {
    if (i > 0 && text[i - 1] === "\\") {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && text[j] === "\\") {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 1) continue;
    }
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
function escapeDollarsInTextCommands(mathContent) {
  const textCommands = ["text", "mathrm", "mbox", "textrm", "textsf", "texttt", "textnormal", "textsc"];
  let result = mathContent;
  for (const cmd of textCommands) {
    const cmdPattern = `\\${cmd}{`;
    let searchPos = 0;
    while (true) {
      const cmdStart = result.indexOf(cmdPattern, searchPos);
      if (cmdStart === -1) break;
      const braceStart = cmdStart + cmdPattern.length;
      const braceEnd = findMatchingBrace(result, braceStart - 1);
      if (braceEnd === -1) {
        searchPos = braceStart;
        continue;
      }
      const textContent = result.substring(braceStart, braceEnd);
      let escapedContent = "";
      let i = 0;
      while (i < textContent.length) {
        if (textContent[i] === "$") {
          if (i < textContent.length - 1 && textContent[i + 1] === "$") {
            escapedContent += "$$";
            i += 2;
            continue;
          }
          const dollarStart = i;
          i++;
          const closingDollar = textContent.indexOf("$", i);
          if (closingDollar !== -1 && (closingDollar === textContent.length - 1 || textContent[closingDollar + 1] !== "$")) {
            const mathExpr = textContent.substring(dollarStart + 1, closingDollar);
            escapedContent += `\\(${mathExpr}\\)`;
            i = closingDollar + 1;
          } else {
            escapedContent += "$";
            i++;
          }
        } else {
          escapedContent += textContent[i];
          i++;
        }
      }
      if (escapedContent !== textContent) {
        result = result.substring(0, braceStart) + escapedContent + result.substring(braceEnd);
        searchPos = braceStart + escapedContent.length;
      } else {
        searchPos = braceEnd + 1;
      }
    }
  }
  return result;
}
function convertBoxDrawingTables(text) {
  const lines = text.split("\n");
  const result = [];
  const BOX_BORDER_CHARS = /[┌┐└┘├┤┬┴┼─╔╗╚╝╠╣╦╩╬═]/;
  const BOX_DATA_CHAR = /[│║]/;
  const isBoxLine = (line) => BOX_DATA_CHAR.test(line) || BOX_BORDER_CHARS.test(line);
  const isBorderLine = (line) => {
    const trimmed = line.trim();
    return BOX_BORDER_CHARS.test(trimmed) && !BOX_DATA_CHAR.test(trimmed) && /^[┌┐└┘├┤┬┴┼─╔╗╚╝╠╣╦╩╬═\s]+$/.test(trimmed);
  };
  const isDataLine = (line) => BOX_DATA_CHAR.test(line);
  const extractCells = (line) => {
    const parts = line.split(/[│║]/);
    return parts.length >= 3 ? parts.slice(1, -1).map((c) => c.trim()) : parts.map((c) => c.trim());
  };
  const convertBlock = (blockLines) => {
    const mergedRows = [];
    let currentGroup = [];
    const flushGroup = () => {
      if (currentGroup.length === 0) return;
      const colCount2 = currentGroup[0].length;
      const merged = Array(colCount2).fill("");
      for (const cellRow of currentGroup) {
        for (let c = 0; c < colCount2 && c < cellRow.length; c++) {
          if (cellRow[c]) merged[c] = merged[c] ? `${merged[c]} ${cellRow[c]}` : cellRow[c];
        }
      }
      mergedRows.push(merged);
      currentGroup = [];
    };
    for (const line of blockLines) {
      if (isBorderLine(line)) {
        flushGroup();
        continue;
      }
      if (isDataLine(line)) currentGroup.push(extractCells(line));
    }
    flushGroup();
    if (mergedRows.length === 0) return blockLines;
    const colCount = mergedRows[0].length;
    const gfmLines = [];
    gfmLines.push(`| ${mergedRows[0].map((c) => c || " ").join(" | ")} |`);
    gfmLines.push(`|${Array(colCount).fill("---").join("|")}|`);
    for (let i2 = 1; i2 < mergedRows.length; i2++) {
      const row = mergedRows[i2].slice(0, colCount);
      while (row.length < colCount) row.push("");
      gfmLines.push(`| ${row.join(" | ")} |`);
    }
    return gfmLines;
  };
  let i = 0;
  while (i < lines.length) {
    if (isBoxLine(lines[i])) {
      const blockStart = i;
      while (i < lines.length && isBoxLine(lines[i])) i++;
      result.push(...convertBlock(lines.slice(blockStart, i)));
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  return result.join("\n");
}
function preprocessMarkdown(content) {
  if (!content || typeof content !== "string") return "";
  let processed = content;
  const codeBlocks = [];
  let codeBlockIndex = 0;
  processed = processed.replace(/```[\w]*\n?[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_PLACEHOLDER_${codeBlockIndex}__`;
    codeBlocks.push({ placeholder, content: match });
    codeBlockIndex++;
    return placeholder;
  });
  processed = convertBoxDrawingTables(processed);
  processed = processed.replace(/\r\n/g, "\n");
  processed = processed.replace(/\\verb\|([^\r\n|]*?)\|/g, (_match, body) => {
    const escaped = String(body).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
    return `\`${escaped}\``;
  });
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, mathContent) => {
    const lines = match.split("\n");
    if (lines.length >= 3 && lines[0].trim() === "$$" && lines[lines.length - 1].trim() === "$$") {
      return match;
    }
    if (!mathContent || typeof mathContent !== "string") return match;
    try {
      const normalized = mathContent.trim().replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n");
      return `

$$
${normalized}
$$

`;
    } catch {
      return match;
    }
  });
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, mathContent) => {
    if (!mathContent || typeof mathContent !== "string") return _match;
    try {
      const normalized = mathContent.trim().replace(/\s+/g, " ");
      return `

$$
${normalized}
$$

`;
    } catch {
      return _match;
    }
  });
  let inlineMathIndex = 0;
  const inlineMathGroups = [];
  while (true) {
    const openPos = processed.indexOf("\\(", inlineMathIndex);
    if (openPos === -1) break;
    const closePos = processed.indexOf("\\)", openPos + 2);
    if (closePos === -1) break;
    const mathContent = processed.substring(openPos + 2, closePos).trim();
    let normalized = escapeDollarsInTextCommands(mathContent);
    if (normalized) {
      inlineMathGroups.push({ start: openPos, end: closePos + 2, parts: [normalized] });
    }
    inlineMathIndex = closePos + 2;
  }
  inlineMathGroups.reverse().forEach(({ start, end, parts }) => {
    const combined = parts.join(" ");
    processed = `${processed.substring(0, start)}$${combined}$${processed.substring(end)}`;
  });
  codeBlocks.forEach(({ placeholder, content: content2 }) => {
    processed = processed.replace(placeholder, () => content2);
  });
  return processed;
}
var AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".aac", ".flac", ".opus", ".pcm", ".webm"];
var VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
function hasExtension(url, extensions) {
  const lower = url.toLowerCase().split("?")[0];
  return extensions.some((ext) => lower.endsWith(ext));
}
function CodeComponent({ className, children }) {
  const { isStreaming } = useMarkdownContext();
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");
  const isInline = !match && !code.includes("\n");
  if (isInline) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("code", { className: "inline-code", children });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(CodeBlock, { language, code, isStreaming });
}
var markdownComponents = {
  code: CodeComponent,
  table({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: "table-responsive", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("table", { className: "markdown-table", children }) });
  },
  a({ href, children, ...props }) {
    if (href && hasExtension(href, AUDIO_EXTENSIONS)) {
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("audio", { controls: true, className: "markdown-audio", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("source", { src: href }) });
    }
    if (href && hasExtension(href, VIDEO_EXTENSIONS)) {
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("video", { controls: true, className: "markdown-video", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("source", { src: href }) });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("a", { href, target: "_blank", rel: "noopener noreferrer", ...props, children });
  },
  img({ src, alt, ...props }) {
    if (src && hasExtension(src, AUDIO_EXTENSIONS)) {
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("audio", { controls: true, className: "markdown-audio", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("source", { src }) });
    }
    if (src && hasExtension(src, VIDEO_EXTENSIONS)) {
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("video", { controls: true, className: "markdown-video", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("source", { src }) });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("img", { src, alt: alt || "", className: "markdown-image", loading: "lazy", ...props });
  },
  blockquote({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("blockquote", { className: "markdown-blockquote", children });
  },
  hr() {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("hr", { className: "markdown-hr" });
  },
  ul({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("ul", { className: "markdown-list", children });
  },
  ol({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("ol", { className: "markdown-list markdown-list--ordered", children });
  },
  h1({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h1", { className: "markdown-heading markdown-h1", children });
  },
  h2({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h2", { className: "markdown-heading markdown-h2", children });
  },
  h3({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h3", { className: "markdown-heading markdown-h3", children });
  },
  h4({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h4", { className: "markdown-heading markdown-h4", children });
  },
  h5({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h5", { className: "markdown-heading markdown-h5", children });
  },
  h6({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("h6", { className: "markdown-heading markdown-h6", children });
  },
  p({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("p", { className: "markdown-paragraph", children });
  }
};
var KATEX_MACROS = {
  "\\arcsinh": "\\operatorname{arcsinh}",
  "\\arccosh": "\\operatorname{arccosh}",
  "\\arctanh": "\\operatorname{arctanh}",
  "\\arccoth": "\\operatorname{arccoth}",
  "\\arcsech": "\\operatorname{arcsech}",
  "\\arccsch": "\\operatorname{arccsch}",
  "\\sgn": "\\operatorname{sgn}"
};
var MarkdownRenderer = (0, import_react8.memo)(function MarkdownRenderer2({
  content,
  children,
  className = "",
  isStreaming = false
}) {
  const rawContent = content ?? children ?? "";
  const processedContent = (0, import_react8.useMemo)(() => {
    try {
      return preprocessMarkdown(rawContent);
    } catch (error) {
      console.error("Error preprocessing markdown:", error);
      return rawContent;
    }
  }, [rawContent]);
  const contextValue = (0, import_react8.useMemo)(() => ({ isStreaming }), [isStreaming]);
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MarkdownContext.Provider, { value: contextValue, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: `markdown-content ${className}`, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
    import_react_markdown.default,
    {
      remarkPlugins: [import_remark_gfm.default, import_remark_math.default],
      rehypePlugins: [
        [import_rehype_katex.default, {
          throwOnError: false,
          strict: false,
          trust: true,
          macros: KATEX_MACROS
        }]
      ],
      components: markdownComponents,
      children: processedContent
    }
  ) }) });
});

// src/markdown/index.ts
init_MermaidDiagram();
init_VegaChart();
init_MarkmapRenderer();

// src/markdown/RenderErrorBoundary.tsx
var import_react9 = require("react");
var import_jsx_runtime18 = require("react/jsx-runtime");
var RenderErrorBoundary = class extends import_react9.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, _errorInfo) {
    if (!this.isBenignError(error)) {
      console.warn(
        `Renderer error (${this.props.rendererType || "unknown"}):`,
        error.message
      );
    }
  }
  isBenignError(error) {
    const benignPatterns = [
      /translate\(NaN,NaN\)/,
      /Expected number/,
      /katex/i,
      /vega/i,
      /mermaid/i,
      /markmap/i
    ];
    return benignPatterns.some((pattern) => pattern.test(error.message));
  }
  render() {
    if (this.state.hasError) {
      const rendererType = this.props.rendererType || "content";
      const fallbackMessage = this.props.fallbackMessage || `Error rendering ${rendererType}`;
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "render-error-boundary", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("small", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("strong", { children: fallbackMessage }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "render-error-boundary__detail", children: "The content may contain formatting issues that prevent proper rendering." })
      ] }) });
    }
    return this.props.children;
  }
};

// src/chat/MessageList.tsx
var import_react13 = require("react");
var import_lucide_react5 = require("lucide-react");

// src/chat/StreamingText.tsx
var import_react10 = require("react");
var import_jsx_runtime19 = require("react/jsx-runtime");
var StreamingText = (0, import_react10.memo)(
  ({ text, isStreaming = false, renderMarkdown = true, className = "", showCursor = true }) => {
    if (!text && !isStreaming) {
      return null;
    }
    const cursorElement = isStreaming && showCursor && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: "streaming-cursor", "aria-hidden": "true", children: "|" });
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: `streaming-text ${className}`, children: renderMarkdown ? /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "streaming-text__markdown", children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MarkdownRenderer, { content: text, isStreaming }),
      cursorElement
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: "streaming-text__plain", children: [
      text,
      cursorElement
    ] }) });
  }
);
StreamingText.displayName = "StreamingText";

// src/chat/ThinkingBlock.tsx
var import_react11 = require("react");
var import_lucide_react3 = require("lucide-react");
var import_jsx_runtime20 = require("react/jsx-runtime");
var ThinkingBlock = (0, import_react11.memo)(
  ({ content, isStreaming = false, defaultCollapsed = true, className = "" }) => {
    const [collapsed, setCollapsed] = (0, import_react11.useState)(defaultCollapsed);
    const toggle = (0, import_react11.useCallback)(() => setCollapsed((prev) => !prev), []);
    if (!content && !isStreaming) {
      return null;
    }
    return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: `thinking-block ${isStreaming ? "thinking-block--streaming" : ""} ${className}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("button", { className: "thinking-block__header", onClick: toggle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react3.Brain, { size: 14, className: "thinking-block__icon" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "thinking-block__label", children: isStreaming ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "thinking-block__dots", children: "Thinking" }) : "Thought process" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: "thinking-block__chevron", children: collapsed ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react3.ChevronDown, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_lucide_react3.ChevronUp, { size: 14 }) })
      ] }),
      !collapsed && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: "thinking-block__content", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("pre", { className: "thinking-block__text", children: content }) })
    ] });
  }
);
ThinkingBlock.displayName = "ThinkingBlock";

// src/chat/ToolCallCard.tsx
var import_react12 = require("react");
var import_lucide_react4 = require("lucide-react");
var import_jsx_runtime21 = require("react/jsx-runtime");
var TOOL_CATEGORIES = {
  read_file: { category: "File", color: "#3b82f6" },
  write_file: { category: "File", color: "#3b82f6" },
  edit_file: { category: "File", color: "#3b82f6" },
  glob: { category: "File", color: "#3b82f6" },
  grep: { category: "File", color: "#3b82f6" },
  list_directory: { category: "File", color: "#3b82f6" },
  bash: { category: "Shell", color: "#10b981" },
  web_search: { category: "Web", color: "#8b5cf6" },
  web_scrape: { category: "Web", color: "#8b5cf6" },
  web_fetch: { category: "Web", color: "#8b5cf6" },
  memory_store: { category: "Memory", color: "#f59e0b" },
  memory_retrieve: { category: "Memory", color: "#f59e0b" },
  memory_list: { category: "Memory", color: "#f59e0b" },
  memory_delete: { category: "Memory", color: "#f59e0b" },
  context_set: { category: "Context", color: "#ec4899" },
  context_get: { category: "Context", color: "#ec4899" },
  context_delete: { category: "Context", color: "#ec4899" },
  context_list: { category: "Context", color: "#ec4899" }
};
function getToolInfo(name) {
  return TOOL_CATEGORIES[name] || { category: "Tool", color: "#6b7280" };
}
function formatDuration(ms) {
  if (ms < 1e3) return `${ms}ms`;
  return `${(ms / 1e3).toFixed(1)}s`;
}
function truncateString(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
function formatJson(obj, maxLength) {
  try {
    const json = JSON.stringify(obj, null, 2);
    if (maxLength && json.length > maxLength) {
      return json.slice(0, maxLength) + "\n... (truncated)";
    }
    return json;
  } catch {
    return String(obj);
  }
}
var ToolCallCard = (0, import_react12.memo)(
  ({ tool, expanded: initialExpanded = false, className = "" }) => {
    const [expanded, setExpanded] = (0, import_react12.useState)(initialExpanded);
    const { name, description, status, durationMs, error, args, result } = tool;
    const { category, color } = getToolInfo(name);
    const hasDetails = args || result !== void 0 || error;
    const toggleExpand = (0, import_react12.useCallback)(() => {
      if (hasDetails) setExpanded((prev) => !prev);
    }, [hasDetails]);
    const statusIcon = {
      pending: null,
      running: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.Loader, { size: 14, className: "tool-call__status-icon tool-call__status-icon--spin" }),
      complete: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.Check, { size: 14, className: "tool-call__status-icon tool-call__status-icon--success" }),
      error: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.AlertCircle, { size: 14, className: "tool-call__status-icon tool-call__status-icon--error" })
    }[status];
    return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: `tool-call tool-call--${status} ${className}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
        "div",
        {
          className: "tool-call__header",
          onClick: toggleExpand,
          style: { cursor: hasDetails ? "pointer" : "default" },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "tool-call__icon", style: { backgroundColor: color }, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.Wrench, { size: 12 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__category", style: { color }, children: category }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__name", children: name }),
            description && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__description", title: description, children: truncateString(description, 100) }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "tool-call__status", children: [
              statusIcon,
              status === "complete" && durationMs !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "tool-call__duration", children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.Clock, { size: 12 }),
                formatDuration(durationMs)
              ] })
            ] }),
            error && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__error-badge", children: "error" }),
            hasDetails && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__chevron", children: expanded ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.ChevronUp, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.ChevronDown, { size: 14 }) })
          ]
        }
      ),
      error && !expanded && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: "tool-call__error", children: error }),
      expanded && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "tool-call__details", children: [
        args && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "tool-call__detail-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__detail-label", children: "Args:" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("pre", { className: "tool-call__detail-pre", children: formatJson(args) })
        ] }),
        error && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "tool-call__detail-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__detail-label tool-call__detail-label--error", children: "Error:" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__error", children: error })
        ] }),
        error && result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "tool-call__detail-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__detail-label", children: "Result:" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("pre", { className: "tool-call__detail-pre", children: formatJson(result) })
        ] }),
        !error && status === "complete" && result !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: "tool-call__detail-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "tool-call__detail-label", children: "Result:" }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("pre", { className: "tool-call__detail-pre", children: formatJson(result, 2e3) })
        ] })
      ] })
    ] });
  }
);
ToolCallCard.displayName = "ToolCallCard";
function InlineToolCall({ name, description, status }) {
  const { category, color } = getToolInfo(name);
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: `inline-tool-call inline-tool-call--${status}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: "inline-tool-call__badge", style: { backgroundColor: color }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.Wrench, { size: 10 }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "inline-tool-call__category", children: category })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "inline-tool-call__name", children: name }),
    description && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: "inline-tool-call__description", children: truncateString(description, 50) }),
    status === "running" && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_lucide_react4.Loader, { size: 12, className: "inline-tool-call__spinner" })
  ] });
}

// src/chat/MessageList.tsx
var import_jsx_runtime22 = require("react/jsx-runtime");
var MessageWithControls = (0, import_react13.memo)(({ message, index, onCopyMessage }) => {
  const [isHovered, setIsHovered] = (0, import_react13.useState)(false);
  const [copied, setCopied] = (0, import_react13.useState)(false);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";
  const handleCopy = (0, import_react13.useCallback)(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
      onCopyMessage?.(message.content);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  }, [message.content, onCopyMessage]);
  if (isUser) {
    return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message rui-message--user", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__bubble", children: message.content }) });
  }
  if (isSystem) {
    return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message rui-message--system", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__content", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("small", { className: "rui-message__system-text", children: message.content }) }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
    "div",
    {
      className: "rui-message rui-message--assistant",
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      children: [
        message.thinking && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
          ThinkingBlock,
          {
            content: message.thinking,
            isStreaming: message.isStreaming
          }
        ),
        message.toolCalls && message.toolCalls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__tool-calls", children: message.toolCalls.map((tc) => /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(ToolCallCard, { tool: tc }, tc.id)) }),
        message.error && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__error", children: message.error }),
        message.content && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__content", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
          RenderErrorBoundary,
          {
            rendererType: "markdown message",
            fallbackMessage: "Error rendering message content",
            children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(MarkdownRenderer, { content: message.content, isStreaming: message.isStreaming })
          }
        ) }),
        message.timestamp && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__time", children: new Date(message.timestamp).toLocaleTimeString() }),
        isAssistant && isHovered && message.content && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__controls", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
          "button",
          {
            className: "rui-message__control-btn",
            onClick: handleCopy,
            title: "Copy markdown content",
            children: copied ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react5.Check, { size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_lucide_react5.Copy, { size: 12 })
          }
        ) })
      ]
    }
  );
});
MessageWithControls.displayName = "MessageWithControls";
var MessageList = (0, import_react13.memo)(
  ({
    messages,
    streamingText = "",
    streamingThinking = "",
    isStreaming = false,
    autoScroll = true,
    hideThinking = false,
    className = "",
    renderMessage,
    onCopyMessage
  }) => {
    const endRef = (0, import_react13.useRef)(null);
    const containerRef = (0, import_react13.useRef)(null);
    (0, import_react13.useEffect)(() => {
      if (!autoScroll || !containerRef.current) return;
      const container = containerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }
    }, [messages, streamingText, streamingThinking, autoScroll]);
    return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: `rui-message-list ${className}`, ref: containerRef, children: [
      messages.map(
        (message, index) => renderMessage ? renderMessage(message, index) : /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
          MessageWithControls,
          {
            message,
            index,
            onCopyMessage
          },
          message.id || index
        )
      ),
      streamingThinking && !hideThinking && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(ThinkingBlock, { content: streamingThinking, isStreaming }),
      (streamingText || isStreaming && !hideThinking && !streamingThinking) && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message rui-message--assistant", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: "rui-message__content", children: streamingText ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
        StreamingText,
        {
          text: streamingText,
          isStreaming,
          renderMarkdown: true
        }
      ) : isStreaming && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("span", { className: "rui-message__thinking-dots", children: "Thinking" }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { ref: endRef })
    ] });
  }
);
MessageList.displayName = "MessageList";

// src/chat/ExecutionProgress.tsx
var import_react14 = require("react");
var import_lucide_react6 = require("lucide-react");
var import_jsx_runtime23 = require("react/jsx-runtime");
var CYCLING_INITIAL_MESSAGES = [
  "Analyzing your request...",
  "Consulting my expertise...",
  "Processing information...",
  "Considering the details...",
  "Processing your request...",
  "Analyzing the task...",
  "Reviewing the information...",
  "Thinking this through...",
  "Gathering my thoughts...",
  "Focusing on your question..."
];
var CYCLING_PROCESSING_MESSAGES = [
  "Thinking through the best approach...",
  "Coordinating next steps...",
  "Evaluating options...",
  "Working on this...",
  "Piecing this together...",
  "Working through the details...",
  "Evaluating next steps...",
  "Ensuring accuracy...",
  "Reviewing related items...",
  "Verifying assumptions..."
];
var getRandomInterval = () => Math.floor(Math.random() * 3e3) + 2e3;
var formatToolName = (name) => {
  let display = name.replace(/^(github-EW_|mcp_|v25_)/, "");
  display = display.replace(/_/g, " ");
  return display;
};
var getActiveDescription = (tools) => {
  const running = tools.filter((t) => t.status === "running");
  if (running.length === 0) return null;
  const latest = running[running.length - 1];
  return latest.description || `Running ${formatToolName(latest.name)}`;
};
var ExecutionProgress = (0, import_react14.memo)(
  ({ tools, activeCount, isComplete }) => {
    const [expanded, setExpanded] = (0, import_react14.useState)(false);
    const [cyclingMessage, setCyclingMessage] = (0, import_react14.useState)(CYCLING_INITIAL_MESSAGES[0]);
    const timerRef = (0, import_react14.useRef)(null);
    (0, import_react14.useEffect)(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (isComplete || activeCount > 0) return;
      const interval = getRandomInterval();
      timerRef.current = setTimeout(() => {
        setCyclingMessage((prev) => {
          const pool = tools.length > 0 ? CYCLING_PROCESSING_MESSAGES : CYCLING_INITIAL_MESSAGES;
          const filtered = pool.filter((m) => m !== prev);
          return filtered[Math.floor(Math.random() * filtered.length)];
        });
      }, interval);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [cyclingMessage, isComplete, activeCount, tools.length]);
    (0, import_react14.useEffect)(() => {
      if (tools.length > 0) {
        setCyclingMessage((prev) => {
          if (CYCLING_INITIAL_MESSAGES.includes(prev)) {
            return CYCLING_PROCESSING_MESSAGES[Math.floor(Math.random() * CYCLING_PROCESSING_MESSAGES.length)];
          }
          return prev;
        });
      }
    }, [tools.length > 0]);
    const headerTitle = (0, import_react14.useMemo)(() => {
      if (isComplete) return tools.length === 0 ? "Finished" : "Work Summary";
      const activeDesc = getActiveDescription(tools);
      if (activeDesc) return activeDesc;
      return cyclingMessage;
    }, [isComplete, tools, cyclingMessage]);
    const runningToolName = (0, import_react14.useMemo)(() => {
      const running = tools.filter((t) => t.status === "running");
      return running.length > 0 ? running[running.length - 1].name : null;
    }, [tools]);
    const toggleExpanded = (0, import_react14.useCallback)(() => setExpanded((prev) => !prev), []);
    const hasTools = tools.length > 0;
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: "execution-progress", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
        "div",
        {
          className: "execution-progress__header",
          onClick: hasTools ? toggleExpanded : void 0,
          style: { cursor: hasTools ? "pointer" : "default" },
          children: [
            isComplete ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_lucide_react6.CheckCircle, { size: 16, className: "execution-progress__icon execution-progress__icon--success" }) : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_lucide_react6.Loader, { size: 16, className: "execution-progress__icon execution-progress__icon--spin" }),
            !isComplete && runningToolName && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "execution-progress__tool-badge", children: runningToolName }),
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "execution-progress__title", children: headerTitle }),
            !isComplete && tools.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: "execution-progress__count", children: [
              "(",
              tools.length,
              " tools)"
            ] }),
            hasTools && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: "execution-progress__chevron", children: expanded ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_lucide_react6.ChevronUp, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_lucide_react6.ChevronDown, { size: 14 }) })
          ]
        }
      ),
      expanded && hasTools && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: "execution-progress__body", children: tools.map((tool) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(ToolCallCard, { tool }, tool.id)) })
    ] });
  }
);
ExecutionProgress.displayName = "ExecutionProgress";

// src/chat/ChatControls.tsx
var import_react15 = require("react");
var import_lucide_react7 = require("lucide-react");
var import_jsx_runtime24 = require("react/jsx-runtime");
var ChatControls = (0, import_react15.memo)(
  ({
    isRunning = false,
    isPaused = false,
    hasError = false,
    onPause,
    onResume,
    onCancel,
    disabled = false,
    className = "",
    size
  }) => {
    if (!isRunning && !isPaused) {
      return null;
    }
    const sizeClass = size ? `chat-controls--${size}` : "";
    return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: `chat-controls ${sizeClass} ${className}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: "chat-controls__buttons", children: [
        isPaused ? /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(
          "button",
          {
            className: "chat-controls__btn chat-controls__btn--resume",
            onClick: onResume,
            disabled: disabled || !onResume,
            title: "Resume execution",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react7.Play, { size: 14 }),
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: "Resume" })
            ]
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(
          "button",
          {
            className: "chat-controls__btn chat-controls__btn--pause",
            onClick: onPause,
            disabled: disabled || !onPause || !isRunning,
            title: "Pause execution",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react7.Pause, { size: 14 }),
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: "Pause" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(
          "button",
          {
            className: "chat-controls__btn chat-controls__btn--cancel",
            onClick: onCancel,
            disabled: disabled || !onCancel,
            title: "Cancel execution",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react7.XCircle, { size: 14 }),
              /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { children: "Cancel" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: "chat-controls__status", children: isPaused ? /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("span", { className: "chat-controls__status-text chat-controls__status-text--paused", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react7.Pause, { size: 14 }),
        " Paused"
      ] }) : isRunning ? /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("span", { className: "chat-controls__status-text chat-controls__status-text--running", children: [
        /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_lucide_react7.Loader, { size: 14, className: "chat-controls__spinner" }),
        " Running"
      ] }) : hasError ? /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: "chat-controls__status-text chat-controls__status-text--error", children: "Error" }) : null })
    ] });
  }
);
ChatControls.displayName = "ChatControls";

// src/chat/ExportMessage.tsx
var import_react16 = require("react");
var import_lucide_react8 = require("lucide-react");
var import_jsx_runtime25 = require("react/jsx-runtime");
var ExportMessage = ({
  messageElement,
  markdownContent,
  onExport,
  className = "",
  disabled = false
}) => {
  const [isExporting, setIsExporting] = (0, import_react16.useState)(false);
  const [showMenu, setShowMenu] = (0, import_react16.useState)(false);
  const menuRef = (0, import_react16.useRef)(null);
  (0, import_react16.useEffect)(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);
  const handleExport = (0, import_react16.useCallback)(async (format) => {
    if (!onExport) return;
    try {
      setIsExporting(true);
      setShowMenu(false);
      await onExport(format);
    } catch (err) {
      console.error(`${format.toUpperCase()} export failed:`, err);
    } finally {
      setIsExporting(false);
    }
  }, [onExport]);
  if (!onExport) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: `export-message ${className}`, ref: menuRef, children: [
    /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
      "button",
      {
        className: "export-message__btn",
        onClick: () => setShowMenu(!showMenu),
        disabled: disabled || isExporting,
        title: "Export this message",
        children: isExporting ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(import_lucide_react8.Loader, { size: 14, className: "export-message__spinner" }) : /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(import_lucide_react8.Upload, { size: 14 })
      }
    ),
    showMenu && /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: "export-message__menu", children: [
      /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
        "button",
        {
          className: "export-message__menu-item",
          onClick: () => handleExport("pdf"),
          disabled: isExporting,
          children: "Export as PDF"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
        "button",
        {
          className: "export-message__menu-item",
          onClick: () => handleExport("docx"),
          disabled: isExporting,
          children: "Export as DOCX"
        }
      )
    ] })
  ] });
};
ExportMessage.displayName = "ExportMessage";

// src/context-display/ContextDisplayPanel.tsx
var import_react19 = require("react");
var import_lucide_react10 = require("lucide-react");

// src/context-display/ContextEntryCard.tsx
var import_react17 = require("react");
var import_lucide_react9 = require("lucide-react");

// src/context-display/utils.ts
var MAX_JSON_LENGTH = 5e4;
function formatValueForDisplay(value) {
  if (typeof value === "string") return value;
  if (value === null || value === void 0) return String(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    const json = JSON.stringify(value, null, 2);
    if (json.length > MAX_JSON_LENGTH) {
      return "```json\n" + json.slice(0, MAX_JSON_LENGTH) + "\n... (truncated)\n```";
    }
    return "```json\n" + json + "\n```";
  } catch {
    return "`[Object \u2014 cannot serialize]`";
  }
}
var PRIORITY_CLASSES = {
  low: "cdp-priority--low",
  normal: "cdp-priority--normal",
  high: "cdp-priority--high",
  critical: "cdp-priority--critical"
};

// src/context-display/ContextEntryCard.tsx
var import_jsx_runtime26 = require("react/jsx-runtime");
var MIN_TEXTAREA_ROWS = 6;
var ContextEntryCard = ({
  entry,
  isCollapsed,
  isMaximized,
  isHighlighted,
  forceExpanded,
  enableDragAndDrop,
  isDragging,
  dropPosition,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  enableEditing,
  onSaveEntry,
  isPinned,
  onPinToggle,
  onCollapseToggle,
  onMaximizeToggle
}) => {
  const displayValue = (0, import_react17.useMemo)(() => formatValueForDisplay(entry.value), [entry.value]);
  const [isEditing, setIsEditing] = (0, import_react17.useState)(false);
  const [editValue, setEditValue] = (0, import_react17.useState)(displayValue);
  const [isSaving, setIsSaving] = (0, import_react17.useState)(false);
  (0, import_react17.useEffect)(() => {
    setEditValue(displayValue);
  }, [displayValue]);
  const hasChanges = editValue !== displayValue;
  const isDragDisabled = !enableDragAndDrop || forceExpanded || isMaximized;
  const handleSave = (0, import_react17.useCallback)(async () => {
    if (!onSaveEntry || !hasChanges) return;
    setIsSaving(true);
    try {
      await onSaveEntry(entry.key, editValue);
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ContextEntryCard] Save failed:", message);
    } finally {
      setIsSaving(false);
    }
  }, [onSaveEntry, entry.key, editValue, hasChanges]);
  const handleEditToggle = (0, import_react17.useCallback)(() => {
    if (isEditing && hasChanges) {
      setEditValue(displayValue);
    }
    setIsEditing((prev) => !prev);
  }, [isEditing, hasChanges, displayValue]);
  const handleKeyDown = (0, import_react17.useCallback)(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onCollapseToggle(entry.key);
      }
    },
    [entry.key, onCollapseToggle]
  );
  const cardClasses = [
    "cdp-card",
    isHighlighted && !forceExpanded ? "cdp-card--highlight" : "",
    isMaximized && !forceExpanded ? "cdp-card--maximized" : "",
    isCollapsed ? "cdp-card--collapsed" : "",
    isPinned ? "cdp-card--pinned" : "",
    forceExpanded ? "cdp-card--export" : "",
    isDragging ? "cdp-card--dragging" : "",
    dropPosition === "above" ? "cdp-card--drop-above" : "",
    dropPosition === "below" ? "cdp-card--drop-below" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(
    "div",
    {
      "data-entry-key": entry.key,
      className: cardClasses,
      role: "listitem",
      draggable: !isDragDisabled,
      onDragStart: (e) => !isDragDisabled && onDragStart(entry.key, e),
      onDragOver: (e) => !isDragDisabled && onDragOver(entry.key, e),
      onDragLeave: !isDragDisabled ? onDragLeave : void 0,
      onDrop: (e) => !isDragDisabled && onDrop(entry.key, e),
      onDragEnd: !isDragDisabled ? onDragEnd : void 0,
      children: [
        !forceExpanded && /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(
          "div",
          {
            className: "cdp-card__header",
            role: "button",
            tabIndex: 0,
            "aria-expanded": !isCollapsed,
            onClick: () => onCollapseToggle(entry.key),
            onKeyDown: handleKeyDown,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)("div", { className: "cdp-card__title", children: [
                !isDragDisabled && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                  "span",
                  {
                    className: "cdp-drag-handle",
                    onClick: (e) => e.stopPropagation(),
                    title: "Drag to reorder",
                    children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.GripVertical, { size: 12 })
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: "cdp-card__collapse-icon", children: isCollapsed ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.ChevronRight, { size: 12 }) : /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.ChevronDown, { size: 12 }) }),
                /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                  "span",
                  {
                    className: "cdp-card__key",
                    title: `${entry.key}${entry.priority ? ` [${entry.priority}]` : ""}`,
                    children: entry.description || entry.key
                  }
                ),
                entry.priority && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("span", { className: `cdp-priority ${PRIORITY_CLASSES[entry.priority] || ""}`, children: entry.priority })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(
                "div",
                {
                  className: "cdp-card__actions",
                  role: "toolbar",
                  "aria-label": "Entry actions",
                  onClick: (e) => e.stopPropagation(),
                  children: [
                    isEditing && hasChanges && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                      "button",
                      {
                        className: "cdp-action-btn cdp-action-btn--save",
                        onClick: handleSave,
                        disabled: isSaving,
                        title: "Save changes",
                        children: isSaving ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.Loader2, { size: 14, className: "cdp-spinner" }) : /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.Check, { size: 14 })
                      }
                    ),
                    enableEditing && !forceExpanded && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                      "button",
                      {
                        className: `cdp-action-btn ${isEditing ? "cdp-action-btn--active" : ""}`,
                        onClick: handleEditToggle,
                        title: isEditing ? "Exit edit mode" : "Edit raw markdown",
                        children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.Pencil, { size: 14 })
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                      "button",
                      {
                        className: `cdp-action-btn ${isMaximized ? "cdp-action-btn--active" : ""}`,
                        onClick: () => onMaximizeToggle(entry.key),
                        title: isMaximized ? "Exit full view" : "Full view",
                        children: isMaximized ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.Minimize2, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.Maximize2, { size: 14 })
                      }
                    ),
                    onPinToggle && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
                      "button",
                      {
                        className: `cdp-action-btn ${isPinned ? "cdp-action-btn--active" : ""}`,
                        onClick: () => onPinToggle(entry.key, !isPinned),
                        title: isPinned ? "Unpin (stop always showing)" : "Pin (always show this entry)",
                        children: isPinned ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.Pin, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_lucide_react9.PinOff, { size: 14 })
                      }
                    )
                  ]
                }
              )
            ]
          }
        ),
        !isCollapsed && /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "cdp-card__body", children: isEditing ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(
          "textarea",
          {
            className: "cdp-edit-textarea",
            value: editValue,
            onChange: (e) => setEditValue(e.target.value),
            rows: Math.max(MIN_TEXTAREA_ROWS, editValue.split("\n").length + 1),
            disabled: isSaving,
            "aria-label": `Edit ${entry.key}`
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { className: "cdp-card__markdown", children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(MarkdownRenderer, { content: displayValue }) }) })
      ]
    }
  );
};

// src/context-display/useOrderPersistence.ts
var import_react18 = require("react");
var DEFAULT_STORAGE_KEY = "rui-context-order";
function loadSavedOrder(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
  }
  return [];
}
function saveOrder(storageKey, keys) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
  }
}
function reconcileOrder(savedOrder, currentKeys) {
  const currentSet = new Set(currentKeys);
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const key of savedOrder) {
    if (currentSet.has(key) && !seen.has(key)) {
      result.push(key);
      seen.add(key);
    }
  }
  for (const key of currentKeys) {
    if (!seen.has(key)) {
      result.push(key);
    }
  }
  return result;
}
function useOrderPersistence(visibleEntries, storageKey = DEFAULT_STORAGE_KEY) {
  const [orderedKeys, setOrderedKeys] = (0, import_react18.useState)(() => loadSavedOrder(storageKey));
  const { sortedEntries, reconciledOrder } = (0, import_react18.useMemo)(() => {
    const currentKeys = visibleEntries.map((e) => e.key);
    const reconciled = reconcileOrder(orderedKeys, currentKeys);
    const entryMap = new Map(visibleEntries.map((e) => [e.key, e]));
    const sorted = reconciled.map((key) => entryMap.get(key)).filter((e) => e !== void 0);
    return { sortedEntries: sorted, reconciledOrder: reconciled };
  }, [visibleEntries, orderedKeys]);
  (0, import_react18.useEffect)(() => {
    if (reconciledOrder.length !== orderedKeys.length || reconciledOrder.some((k, i) => k !== orderedKeys[i])) {
      setOrderedKeys(reconciledOrder);
      saveOrder(storageKey, reconciledOrder);
    }
  }, [reconciledOrder, orderedKeys, storageKey]);
  const saveCurrentOrder = (keys) => {
    setOrderedKeys(keys);
    saveOrder(storageKey, keys);
  };
  return { sortedEntries, orderedKeys, setOrderedKeys, saveCurrentOrder };
}

// src/context-display/ContextDisplayPanel.tsx
var import_jsx_runtime27 = require("react/jsx-runtime");
var ContextDisplayPanel = ({
  entries,
  highlightKey,
  title = "Current Context",
  storageKey = "rui-context-order",
  className,
  enableDragAndDrop = true,
  enableEditing = false,
  enableExport = false,
  onSaveEntry,
  onExport,
  onPinToggle,
  pinnedKeys,
  onMaximizedChange,
  filterEntries,
  entriesRef: externalEntriesRef
}) => {
  const [collapsedKeys, setCollapsedKeys] = (0, import_react19.useState)(/* @__PURE__ */ new Set());
  const [maximizedKey, setMaximizedKey] = (0, import_react19.useState)(null);
  const [pendingExportFormat, setPendingExportFormat] = (0, import_react19.useState)(null);
  const [draggedKey, setDraggedKey] = (0, import_react19.useState)(null);
  const [dropTarget, setDropTarget] = (0, import_react19.useState)(null);
  const [exportDropdownOpen, setExportDropdownOpen] = (0, import_react19.useState)(false);
  const internalEntriesRef = (0, import_react19.useRef)(null);
  const dropdownRef = (0, import_react19.useRef)(null);
  const actualEntriesRef = externalEntriesRef || internalEntriesRef;
  const pinnedSet = (0, import_react19.useMemo)(() => new Set(pinnedKeys ?? []), [pinnedKeys]);
  const visibleEntries = (0, import_react19.useMemo)(() => {
    if (filterEntries) return filterEntries(entries);
    return entries.filter((e) => e.showInUI);
  }, [entries, filterEntries]);
  const { sortedEntries, orderedKeys, setOrderedKeys, saveCurrentOrder } = useOrderPersistence(visibleEntries, storageKey);
  const displayedEntries = enableDragAndDrop ? sortedEntries : visibleEntries;
  (0, import_react19.useEffect)(() => {
    if (!highlightKey) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        const el = actualEntriesRef.current?.querySelector(
          `[data-entry-key="${CSS.escape(highlightKey)}"]`
        );
        if (!el) return;
        let scrollParent = el.parentElement;
        while (scrollParent) {
          const style = getComputedStyle(scrollParent);
          if (style.overflowY === "auto" || style.overflowY === "scroll") break;
          scrollParent = scrollParent.parentElement;
        }
        if (!scrollParent) return;
        const elRect = el.getBoundingClientRect();
        const parentRect = scrollParent.getBoundingClientRect();
        if (elRect.top < parentRect.top || elRect.bottom > parentRect.bottom) {
          scrollParent.scrollTo({
            top: scrollParent.scrollTop + (elRect.top - parentRect.top) - 16,
            behavior: "smooth"
          });
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [highlightKey, actualEntriesRef]);
  (0, import_react19.useEffect)(() => {
    if (!exportDropdownOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportDropdownOpen]);
  const combinedMarkdown = (0, import_react19.useMemo)(
    () => displayedEntries.map((e) => {
      const header = `## ${e.description || e.key}`;
      const priority = e.priority ? ` \`[${e.priority}]\`` : "";
      return `${header}${priority}

${formatValueForDisplay(e.value)}`;
    }).join("\n\n---\n\n"),
    [displayedEntries]
  );
  (0, import_react19.useEffect)(() => {
    if (!pendingExportFormat || !onExport) return;
    const frameId = requestAnimationFrame(() => {
      const doExport = async () => {
        try {
          await onExport(pendingExportFormat, {
            element: actualEntriesRef.current,
            markdownContent: combinedMarkdown
          });
        } catch (err) {
          console.error("Export failed:", err);
        } finally {
          setPendingExportFormat(null);
        }
      };
      doExport();
    });
    return () => cancelAnimationFrame(frameId);
  }, [pendingExportFormat, combinedMarkdown, onExport, actualEntriesRef]);
  const handleCollapseToggle = (0, import_react19.useCallback)((key) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const handleMaximizeToggle = (0, import_react19.useCallback)(
    (key) => {
      setMaximizedKey((prev) => {
        const next = prev === key ? null : key;
        onMaximizedChange?.(next !== null);
        return next;
      });
    },
    [onMaximizedChange]
  );
  const handleDragStart = (0, import_react19.useCallback)((key, e) => {
    setDraggedKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  }, []);
  const handleDragOver = (0, import_react19.useCallback)((key, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropTarget({ key, position: e.clientY < midY ? "above" : "below" });
  }, []);
  const handleDragLeave = (0, import_react19.useCallback)(() => {
    setDropTarget(null);
  }, []);
  const handleDrop = (0, import_react19.useCallback)(
    (targetKey, e) => {
      e.preventDefault();
      const sourceKey = e.dataTransfer.getData("text/plain");
      if (!sourceKey || sourceKey === targetKey) {
        setDraggedKey(null);
        setDropTarget(null);
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const insertAfter = e.clientY >= rect.top + rect.height / 2;
      setOrderedKeys((prev) => {
        const next = prev.filter((k) => k !== sourceKey);
        const targetIdx = next.indexOf(targetKey);
        if (targetIdx === -1) return prev;
        const insertIdx = insertAfter ? targetIdx + 1 : targetIdx;
        next.splice(insertIdx, 0, sourceKey);
        saveCurrentOrder(next);
        return next;
      });
      setDraggedKey(null);
      setDropTarget(null);
    },
    [setOrderedKeys, saveCurrentOrder]
  );
  const handleDragEnd = (0, import_react19.useCallback)(() => {
    setDraggedKey(null);
    setDropTarget(null);
  }, []);
  if (visibleEntries.length === 0) return null;
  const isExporting = !!pendingExportFormat;
  const isMaximized = maximizedKey !== null;
  const entriesToRender = isExporting ? displayedEntries : isMaximized ? displayedEntries.filter((e) => e.key === maximizedKey) : displayedEntries;
  const panelClasses = [
    "cdp-panel",
    isMaximized && !isExporting ? "cdp-panel--maximized" : "",
    className ?? ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: panelClasses, children: [
    !isExporting && /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "cdp-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_lucide_react10.Database, { size: 14, className: "cdp-header__icon" }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "cdp-header__title", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { className: "cdp-header__count", children: visibleEntries.length }),
      enableExport && onExport && /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "cdp-export", ref: dropdownRef, children: [
        /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
          "button",
          {
            className: "cdp-action-btn cdp-export__trigger",
            onClick: () => setExportDropdownOpen((prev) => !prev),
            disabled: isExporting,
            title: pendingExportFormat ? `Exporting to ${String(pendingExportFormat).toUpperCase()}...` : "Export",
            children: isExporting ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_lucide_react10.Loader2, { size: 14, className: "cdp-spinner" }) : /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_lucide_react10.Upload, { size: 14 })
          }
        ),
        exportDropdownOpen && /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)("div", { className: "cdp-export__menu", role: "menu", children: [
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
            "button",
            {
              className: "cdp-export__item",
              role: "menuitem",
              onClick: () => {
                setPendingExportFormat("pdf");
                setExportDropdownOpen(false);
              },
              children: "Export as PDF"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
            "button",
            {
              className: "cdp-export__item",
              role: "menuitem",
              onClick: () => {
                setPendingExportFormat("docx");
                setExportDropdownOpen(false);
              },
              children: "Export as DOCX"
            }
          )
        ] })
      ] }),
      isMaximized && /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(
        "button",
        {
          className: "cdp-header__exit-maximize",
          onClick: () => {
            setMaximizedKey(null);
            onMaximizedChange?.(false);
          },
          title: "Exit full view",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_lucide_react10.Minimize2, { size: 12 }),
            /* @__PURE__ */ (0, import_jsx_runtime27.jsx)("span", { children: "Exit" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
      "div",
      {
        ref: actualEntriesRef,
        className: "cdp-entries",
        role: "list",
        "aria-label": "Context entries",
        children: entriesToRender.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(
          ContextEntryCard,
          {
            entry,
            isCollapsed: isExporting ? false : collapsedKeys.has(entry.key),
            isMaximized: isExporting ? false : maximizedKey === entry.key,
            isHighlighted: highlightKey === entry.key,
            forceExpanded: isExporting,
            enableDragAndDrop: enableDragAndDrop && !isExporting && !isMaximized,
            isDragging: draggedKey === entry.key,
            dropPosition: dropTarget?.key === entry.key ? dropTarget.position : null,
            enableEditing: enableEditing && !isExporting,
            onSaveEntry,
            isPinned: pinnedSet.has(entry.key),
            onPinToggle,
            onCollapseToggle: handleCollapseToggle,
            onMaximizeToggle: handleMaximizeToggle,
            onDragStart: handleDragStart,
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop,
            onDragEnd: handleDragEnd
          },
          entry.key
        ))
      }
    )
  ] });
};

// src/context-display/useDynamicUIChangeDetection.ts
var import_react20 = require("react");
var HIGHLIGHT_DURATION_MS = 1500;
function useDynamicUIChangeDetection(entries, onEntryChanged) {
  const prevEntriesRef = (0, import_react20.useRef)(/* @__PURE__ */ new Map());
  const [highlightKey, setHighlightKey] = (0, import_react20.useState)(null);
  const timeoutRef = (0, import_react20.useRef)(null);
  (0, import_react20.useEffect)(() => {
    const visible = entries.filter((e) => e.showInUI);
    const prev = prevEntriesRef.current;
    let changedKey = null;
    for (const entry of visible) {
      const prevUpdatedAt = prev.get(entry.key);
      if (prevUpdatedAt === void 0 || prevUpdatedAt !== entry.updatedAt) {
        changedKey = entry.key;
        break;
      }
    }
    const next = /* @__PURE__ */ new Map();
    for (const entry of visible) {
      next.set(entry.key, entry.updatedAt);
    }
    prevEntriesRef.current = next;
    if (changedKey) {
      onEntryChanged?.(changedKey);
      setHighlightKey(changedKey);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setHighlightKey(null), HIGHLIGHT_DURATION_MS);
    }
  }, [entries, onEntryChanged]);
  (0, import_react20.useEffect)(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);
  return highlightKey;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ChatControls,
  CodeBlock,
  CollapsibleSection,
  ContextDisplayPanel,
  ContextEntryCard,
  ContextWindowSection,
  ExecutionProgress,
  ExportMessage,
  GenericPluginSection,
  InContextMemoryRenderer,
  InlineToolCall,
  LookInsidePanel,
  MarkdownRenderer,
  MarkmapRenderer,
  MermaidDiagram,
  MessageList,
  PersistentInstructionsRenderer,
  RenderErrorBoundary,
  StreamingText,
  SystemPromptSection,
  ThinkingBlock,
  TokenBreakdownSection,
  ToolCallCard,
  ToolsSection,
  UserInfoRenderer,
  VegaChart,
  ViewContextContent,
  WorkingMemoryRenderer,
  formatBytes,
  formatNumber,
  formatPluginName,
  formatTimestamp,
  formatValueForDisplay,
  getPluginRenderer,
  getRegisteredPluginNames,
  getUtilizationColor,
  getUtilizationLabel,
  registerPluginRenderer,
  truncateText,
  useDynamicUIChangeDetection,
  useMarkdownContext,
  useOrderPersistence
});
//# sourceMappingURL=index.cjs.map