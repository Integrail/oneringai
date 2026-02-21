"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CollapsibleSection: () => CollapsibleSection,
  ContextWindowSection: () => ContextWindowSection,
  GenericPluginSection: () => GenericPluginSection,
  InContextMemoryRenderer: () => InContextMemoryRenderer,
  LookInsidePanel: () => LookInsidePanel,
  PersistentInstructionsRenderer: () => PersistentInstructionsRenderer,
  SystemPromptSection: () => SystemPromptSection,
  TokenBreakdownSection: () => TokenBreakdownSection,
  ToolsSection: () => ToolsSection,
  UserInfoRenderer: () => UserInfoRenderer,
  ViewContextContent: () => ViewContextContent,
  WorkingMemoryRenderer: () => WorkingMemoryRenderer,
  formatBytes: () => formatBytes,
  formatNumber: () => formatNumber,
  formatPluginName: () => formatPluginName,
  formatTimestamp: () => formatTimestamp,
  getPluginRenderer: () => getPluginRenderer,
  getRegisteredPluginNames: () => getRegisteredPluginNames,
  getUtilizationColor: () => getUtilizationColor,
  getUtilizationLabel: () => getUtilizationLabel,
  registerPluginRenderer: () => registerPluginRenderer,
  truncateText: () => truncateText
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CollapsibleSection,
  ContextWindowSection,
  GenericPluginSection,
  InContextMemoryRenderer,
  LookInsidePanel,
  PersistentInstructionsRenderer,
  SystemPromptSection,
  TokenBreakdownSection,
  ToolsSection,
  UserInfoRenderer,
  ViewContextContent,
  WorkingMemoryRenderer,
  formatBytes,
  formatNumber,
  formatPluginName,
  formatTimestamp,
  getPluginRenderer,
  getRegisteredPluginNames,
  getUtilizationColor,
  getUtilizationLabel,
  registerPluginRenderer,
  truncateText
});
//# sourceMappingURL=index.cjs.map