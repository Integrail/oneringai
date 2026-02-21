// src/look-inside/LookInsidePanel.tsx
import { useMemo as useMemo2, useState as useState3, useCallback as useCallback2, useRef } from "react";

// src/look-inside/CollapsibleSection.tsx
import { useState, useCallback } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
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
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== void 0;
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const toggle = useCallback(() => {
    if (onToggle) {
      onToggle(id);
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [id, onToggle]);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: `look-inside-section ${expanded ? "look-inside-section-expanded" : ""} ${className ?? ""}`,
      "data-section-id": id,
      children: [
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: "look-inside-section-header",
            onClick: toggle,
            "aria-expanded": expanded,
            children: [
              /* @__PURE__ */ jsx("span", { className: "look-inside-section-chevron", children: expanded ? "\u25BE" : "\u25B8" }),
              icon && /* @__PURE__ */ jsx("span", { className: "look-inside-section-icon", children: icon }),
              /* @__PURE__ */ jsx("span", { className: "look-inside-section-title", children: title }),
              badge !== void 0 && badge !== null && /* @__PURE__ */ jsx("span", { className: "look-inside-section-badge", children: badge })
            ]
          }
        ),
        expanded && /* @__PURE__ */ jsx("div", { className: "look-inside-section-content", children })
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
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var ContextWindowSection = ({
  budget,
  messagesCount,
  toolCallsCount,
  strategy
}) => {
  const colorClass = getUtilizationColor(budget.utilizationPercent);
  const label = getUtilizationLabel(budget.utilizationPercent);
  const pct = Math.min(budget.utilizationPercent, 100);
  return /* @__PURE__ */ jsxs2("div", { className: "look-inside-context-window", children: [
    /* @__PURE__ */ jsx2("div", { className: "look-inside-progress-bar-container", children: /* @__PURE__ */ jsx2(
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
    /* @__PURE__ */ jsxs2("div", { className: "look-inside-context-stats", children: [
      /* @__PURE__ */ jsxs2("span", { className: `look-inside-utilization-label ${colorClass}`, children: [
        pct.toFixed(1),
        "% \u2014 ",
        label
      ] }),
      /* @__PURE__ */ jsxs2("span", { className: "look-inside-context-stat", children: [
        formatNumber(budget.totalUsed),
        " / ",
        formatNumber(budget.maxTokens),
        " tokens"
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "look-inside-context-details", children: [
      /* @__PURE__ */ jsxs2("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-label", children: "Available" }),
        /* @__PURE__ */ jsxs2("span", { className: "look-inside-stat-value", children: [
          formatNumber(budget.available),
          " tokens"
        ] })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-label", children: "Response Reserve" }),
        /* @__PURE__ */ jsxs2("span", { className: "look-inside-stat-value", children: [
          formatNumber(budget.responseReserve),
          " tokens"
        ] })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-label", children: "Messages" }),
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-value", children: messagesCount })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-label", children: "Tool Calls" }),
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-value", children: toolCallsCount })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "look-inside-stat-row", children: [
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-label", children: "Strategy" }),
        /* @__PURE__ */ jsx2("span", { className: "look-inside-stat-value", children: strategy })
      ] })
    ] })
  ] });
};

// src/look-inside/sections/TokenBreakdownSection.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsx3("div", { className: "look-inside-token-breakdown", children: items.map((item) => /* @__PURE__ */ jsxs3("div", { className: "look-inside-breakdown-row", children: [
    /* @__PURE__ */ jsxs3("div", { className: "look-inside-breakdown-label", children: [
      /* @__PURE__ */ jsx3("span", { className: "look-inside-breakdown-name", children: item.name }),
      /* @__PURE__ */ jsxs3("span", { className: "look-inside-breakdown-tokens", children: [
        formatNumber(item.tokens),
        " (",
        item.percent.toFixed(1),
        "%)"
      ] })
    ] }),
    /* @__PURE__ */ jsx3("div", { className: "look-inside-breakdown-bar-container", children: /* @__PURE__ */ jsx3(
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
import { jsx as jsx4 } from "react/jsx-runtime";
var SystemPromptSection = ({
  content
}) => {
  if (!content) {
    return /* @__PURE__ */ jsx4("div", { className: "look-inside-system-prompt", children: /* @__PURE__ */ jsx4("span", { className: "look-inside-muted", children: "No system prompt configured" }) });
  }
  return /* @__PURE__ */ jsx4("div", { className: "look-inside-system-prompt", children: /* @__PURE__ */ jsx4("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ jsx4("code", { children: content }) }) });
};

// src/look-inside/sections/ToolsSection.tsx
import { useState as useState2, useMemo } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var ToolsSection = ({ tools }) => {
  const [filter, setFilter] = useState2("");
  const filtered = useMemo(() => {
    if (!filter) return tools;
    const lower = filter.toLowerCase();
    return tools.filter(
      (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower) || t.namespace && t.namespace.toLowerCase().includes(lower)
    );
  }, [tools, filter]);
  const enabledCount = tools.filter((t) => t.enabled).length;
  return /* @__PURE__ */ jsxs4("div", { className: "look-inside-tools", children: [
    /* @__PURE__ */ jsxs4("div", { className: "look-inside-tools-header", children: [
      /* @__PURE__ */ jsxs4("span", { className: "look-inside-tools-count", children: [
        enabledCount,
        " / ",
        tools.length,
        " enabled"
      ] }),
      tools.length > 5 && /* @__PURE__ */ jsx5(
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
    /* @__PURE__ */ jsxs4("div", { className: "look-inside-tools-list", children: [
      filtered.map((tool) => /* @__PURE__ */ jsxs4(
        "div",
        {
          className: `look-inside-tool-item ${!tool.enabled ? "look-inside-tool-disabled" : ""}`,
          children: [
            /* @__PURE__ */ jsxs4("div", { className: "look-inside-tool-name", children: [
              /* @__PURE__ */ jsx5("span", { className: `look-inside-tool-badge ${tool.enabled ? "look-inside-badge-on" : "look-inside-badge-off"}`, children: tool.enabled ? "ON" : "OFF" }),
              /* @__PURE__ */ jsx5("code", { children: tool.name }),
              tool.namespace && /* @__PURE__ */ jsx5("span", { className: "look-inside-tool-namespace", children: tool.namespace })
            ] }),
            /* @__PURE__ */ jsxs4("div", { className: "look-inside-tool-meta", children: [
              /* @__PURE__ */ jsx5("span", { className: "look-inside-tool-desc", children: truncateText(tool.description, 120) }),
              tool.callCount > 0 && /* @__PURE__ */ jsxs4("span", { className: "look-inside-tool-calls", children: [
                tool.callCount,
                " call",
                tool.callCount !== 1 ? "s" : ""
              ] })
            ] })
          ]
        },
        tool.name
      )),
      filtered.length === 0 && /* @__PURE__ */ jsx5("div", { className: "look-inside-muted", children: filter ? "No tools match filter" : "No tools registered" })
    ] })
  ] });
};

// src/look-inside/sections/GenericPluginSection.tsx
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var GenericPluginSection = ({
  plugin
}) => {
  return /* @__PURE__ */ jsxs5("div", { className: "look-inside-generic-plugin", children: [
    /* @__PURE__ */ jsxs5("div", { className: "look-inside-plugin-meta", children: [
      /* @__PURE__ */ jsx6("span", { className: "look-inside-stat-label", children: "Tokens" }),
      /* @__PURE__ */ jsx6("span", { className: "look-inside-stat-value", children: formatNumber(plugin.tokenSize) }),
      plugin.compactable && /* @__PURE__ */ jsx6("span", { className: "look-inside-badge-compactable", children: "compactable" })
    ] }),
    plugin.formattedContent ? /* @__PURE__ */ jsx6("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ jsx6("code", { children: plugin.formattedContent }) }) : plugin.contents != null ? /* @__PURE__ */ jsx6("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ jsx6("code", { children: JSON.stringify(plugin.contents, null, 2) }) }) : /* @__PURE__ */ jsx6("div", { className: "look-inside-muted", children: "No content" })
  ] });
};

// src/look-inside/plugins/WorkingMemoryRenderer.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var WorkingMemoryRenderer = ({
  plugin,
  onEntryClick,
  entryValues,
  loadingEntryKey
}) => {
  const raw = plugin.contents;
  const entries = Array.isArray(raw) ? raw : raw?.entries ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ jsx7("div", { className: "look-inside-muted", children: "No entries in working memory" });
  }
  const isClickable = !!onEntryClick;
  return /* @__PURE__ */ jsxs6("div", { className: "look-inside-working-memory", children: [
    /* @__PURE__ */ jsxs6("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " entr",
      entries.length === 1 ? "y" : "ies"
    ] }),
    /* @__PURE__ */ jsx7("div", { className: "look-inside-entry-list", children: entries.map((entry) => {
      const scope = typeof entry.scope === "object" ? JSON.stringify(entry.scope) : String(entry.scope ?? "session");
      const isLoading = loadingEntryKey === entry.key;
      const hasValue = entryValues?.has(entry.key) ?? false;
      const isExpanded = hasValue || isLoading;
      return /* @__PURE__ */ jsxs6(
        "div",
        {
          className: `look-inside-entry-item ${isClickable ? "look-inside-entry-clickable" : ""} ${isExpanded ? "look-inside-entry-expanded" : ""}`,
          onClick: isClickable ? () => onEntryClick(entry.key) : void 0,
          role: isClickable ? "button" : void 0,
          tabIndex: isClickable ? 0 : void 0,
          children: [
            /* @__PURE__ */ jsxs6("div", { className: "look-inside-entry-header", children: [
              /* @__PURE__ */ jsx7("code", { className: "look-inside-entry-key", children: entry.key }),
              /* @__PURE__ */ jsx7("span", { className: `look-inside-priority look-inside-priority-${entry.basePriority ?? "normal"}`, children: entry.basePriority ?? "normal" })
            ] }),
            /* @__PURE__ */ jsx7("div", { className: "look-inside-entry-desc", children: entry.description }),
            /* @__PURE__ */ jsxs6("div", { className: "look-inside-entry-meta", children: [
              /* @__PURE__ */ jsxs6("span", { children: [
                "Scope: ",
                scope
              ] }),
              entry.tier && /* @__PURE__ */ jsxs6("span", { children: [
                "Tier: ",
                entry.tier
              ] }),
              entry.sizeBytes != null && /* @__PURE__ */ jsxs6("span", { children: [
                "Size: ",
                formatBytes(entry.sizeBytes)
              ] }),
              entry.updatedAt && /* @__PURE__ */ jsx7("span", { children: formatTimestamp(entry.updatedAt) })
            ] }),
            isLoading && /* @__PURE__ */ jsx7("div", { className: "look-inside-entry-loading", children: "Loading value..." }),
            hasValue && !isLoading && /* @__PURE__ */ jsx7("pre", { className: "look-inside-code-block-sm", children: JSON.stringify(entryValues.get(entry.key), null, 2) })
          ]
        },
        entry.key
      );
    }) })
  ] });
};

// src/look-inside/plugins/InContextMemoryRenderer.tsx
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var InContextMemoryRenderer = ({
  plugin
}) => {
  const entries = plugin.contents ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ jsx8("div", { className: "look-inside-muted", children: "No entries in context memory" });
  }
  return /* @__PURE__ */ jsxs7("div", { className: "look-inside-in-context-memory", children: [
    /* @__PURE__ */ jsxs7("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " entr",
      entries.length === 1 ? "y" : "ies"
    ] }),
    /* @__PURE__ */ jsx8("div", { className: "look-inside-entry-list", children: entries.map((entry) => /* @__PURE__ */ jsxs7("div", { className: "look-inside-entry-item", children: [
      /* @__PURE__ */ jsxs7("div", { className: "look-inside-entry-header", children: [
        /* @__PURE__ */ jsx8("code", { className: "look-inside-entry-key", children: entry.key }),
        /* @__PURE__ */ jsx8("span", { className: `look-inside-priority look-inside-priority-${entry.priority}`, children: entry.priority })
      ] }),
      /* @__PURE__ */ jsx8("div", { className: "look-inside-entry-desc", children: entry.description }),
      /* @__PURE__ */ jsx8("div", { className: "look-inside-entry-value", children: /* @__PURE__ */ jsx8("pre", { className: "look-inside-code-block-sm", children: /* @__PURE__ */ jsx8("code", { children: typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value, null, 2) }) }) }),
      /* @__PURE__ */ jsx8("div", { className: "look-inside-entry-meta", children: /* @__PURE__ */ jsx8("span", { children: formatTimestamp(entry.updatedAt) }) })
    ] }, entry.key)) })
  ] });
};

// src/look-inside/plugins/PersistentInstructionsRenderer.tsx
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
var PersistentInstructionsRenderer = ({
  plugin
}) => {
  const entries = plugin.contents ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ jsx9("div", { className: "look-inside-muted", children: "No persistent instructions" });
  }
  return /* @__PURE__ */ jsxs8("div", { className: "look-inside-persistent-instructions", children: [
    /* @__PURE__ */ jsxs8("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " instruction",
      entries.length !== 1 ? "s" : ""
    ] }),
    /* @__PURE__ */ jsx9("div", { className: "look-inside-entry-list", children: entries.map((entry) => /* @__PURE__ */ jsxs8("div", { className: "look-inside-entry-item", children: [
      /* @__PURE__ */ jsxs8("div", { className: "look-inside-entry-header", children: [
        /* @__PURE__ */ jsx9("code", { className: "look-inside-entry-key", children: entry.id }),
        /* @__PURE__ */ jsx9("span", { className: "look-inside-entry-meta-inline", children: formatTimestamp(entry.updatedAt) })
      ] }),
      /* @__PURE__ */ jsx9("pre", { className: "look-inside-code-block-sm", children: /* @__PURE__ */ jsx9("code", { children: entry.content }) })
    ] }, entry.id)) })
  ] });
};

// src/look-inside/plugins/UserInfoRenderer.tsx
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
var UserInfoRenderer = ({
  plugin
}) => {
  const entries = plugin.contents ?? [];
  if (entries.length === 0) {
    return /* @__PURE__ */ jsx10("div", { className: "look-inside-muted", children: "No user info stored" });
  }
  return /* @__PURE__ */ jsxs9("div", { className: "look-inside-user-info", children: [
    /* @__PURE__ */ jsxs9("div", { className: "look-inside-entry-count", children: [
      entries.length,
      " entr",
      entries.length === 1 ? "y" : "ies"
    ] }),
    /* @__PURE__ */ jsx10("div", { className: "look-inside-entry-list", children: entries.map((entry) => /* @__PURE__ */ jsxs9("div", { className: "look-inside-entry-item", children: [
      /* @__PURE__ */ jsxs9("div", { className: "look-inside-entry-header", children: [
        /* @__PURE__ */ jsx10("code", { className: "look-inside-entry-key", children: entry.key }),
        /* @__PURE__ */ jsx10("span", { className: "look-inside-entry-type", children: entry.valueType })
      ] }),
      entry.description && /* @__PURE__ */ jsx10("div", { className: "look-inside-entry-desc", children: entry.description }),
      /* @__PURE__ */ jsx10("div", { className: "look-inside-entry-value", children: /* @__PURE__ */ jsx10("pre", { className: "look-inside-code-block-sm", children: /* @__PURE__ */ jsx10("code", { children: typeof entry.value === "string" ? entry.value : JSON.stringify(entry.value, null, 2) }) }) }),
      /* @__PURE__ */ jsx10("div", { className: "look-inside-entry-meta", children: /* @__PURE__ */ jsx10("span", { children: formatTimestamp(entry.updatedAt) }) })
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
import { jsx as jsx11, jsxs as jsxs10 } from "react/jsx-runtime";
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
  const initialized = useRef(false);
  const [expandedSet, setExpandedSet] = useState3(() => new Set(defaultExpanded));
  if (!initialized.current) {
    initialized.current = true;
  }
  const toggleSection = useCallback2((id) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const isSectionExpanded = useCallback2((id) => expandedSet.has(id), [expandedSet]);
  const resolveRenderer = useMemo2(() => {
    return (pluginName) => {
      if (pluginRenderers?.[pluginName]) return pluginRenderers[pluginName];
      return getPluginRenderer(pluginName);
    };
  }, [pluginRenderers]);
  if (loading) {
    return /* @__PURE__ */ jsx11("div", { className: `look-inside-panel look-inside-loading ${className ?? ""}`, children: /* @__PURE__ */ jsx11("div", { className: "look-inside-spinner", children: "Loading..." }) });
  }
  if (!snapshot || !snapshot.available) {
    return /* @__PURE__ */ jsx11("div", { className: `look-inside-panel look-inside-unavailable ${className ?? ""}`, children: /* @__PURE__ */ jsx11("div", { className: "look-inside-muted", children: "Context not available" }) });
  }
  return /* @__PURE__ */ jsxs10("div", { className: `look-inside-panel ${className ?? ""}`, children: [
    /* @__PURE__ */ jsxs10("div", { className: "look-inside-header", children: [
      /* @__PURE__ */ jsxs10("div", { className: "look-inside-header-title", children: [
        /* @__PURE__ */ jsx11("span", { className: "look-inside-title", children: agentName ? `${agentName} \u2014 Look Inside` : "Look Inside" }),
        /* @__PURE__ */ jsx11("span", { className: "look-inside-model-badge", children: snapshot.model })
      ] }),
      /* @__PURE__ */ jsxs10("div", { className: "look-inside-header-actions", children: [
        onViewFullContext && /* @__PURE__ */ jsx11(
          "button",
          {
            type: "button",
            className: "look-inside-btn look-inside-btn-secondary",
            onClick: onViewFullContext,
            children: "View Full Context"
          }
        ),
        onForceCompaction && /* @__PURE__ */ jsx11(
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
    /* @__PURE__ */ jsx11(
      CollapsibleSection,
      {
        title: "Context Window",
        id: "context",
        onToggle: toggleSection,
        expanded: isSectionExpanded("context"),
        badge: `${snapshot.budget.utilizationPercent.toFixed(0)}%`,
        children: /* @__PURE__ */ jsx11(
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
    /* @__PURE__ */ jsx11(
      CollapsibleSection,
      {
        title: "Token Breakdown",
        id: "tokens",
        onToggle: toggleSection,
        expanded: isSectionExpanded("tokens"),
        children: /* @__PURE__ */ jsx11(TokenBreakdownSection, { budget: snapshot.budget })
      }
    ),
    /* @__PURE__ */ jsx11(
      CollapsibleSection,
      {
        title: "System Prompt",
        id: "system-prompt",
        onToggle: toggleSection,
        expanded: isSectionExpanded("system-prompt"),
        children: /* @__PURE__ */ jsx11(SystemPromptSection, { content: snapshot.systemPrompt })
      }
    ),
    snapshot.plugins.map((plugin) => {
      const Renderer = resolveRenderer(plugin.name) ?? GenericPluginSection;
      const extraProps = plugin.name === "working_memory" ? { onEntryClick: onMemoryEntryClick, entryValues: memoryEntryValues, loadingEntryKey: loadingMemoryKey } : {};
      return /* @__PURE__ */ jsx11(
        CollapsibleSection,
        {
          title: plugin.displayName,
          id: `plugin-${plugin.name}`,
          onToggle: toggleSection,
          expanded: isSectionExpanded(`plugin-${plugin.name}`),
          badge: plugin.tokenSize > 0 ? `${plugin.tokenSize} tok` : void 0,
          children: /* @__PURE__ */ jsx11(Renderer, { plugin, ...extraProps })
        },
        plugin.name
      );
    }),
    /* @__PURE__ */ jsx11(
      CollapsibleSection,
      {
        title: "Tools",
        id: "tools",
        onToggle: toggleSection,
        expanded: isSectionExpanded("tools"),
        badge: snapshot.tools.length,
        children: /* @__PURE__ */ jsx11(ToolsSection, { tools: snapshot.tools })
      }
    )
  ] });
};

// src/look-inside/ViewContextContent.tsx
import { jsx as jsx12, jsxs as jsxs11 } from "react/jsx-runtime";
var ViewContextContent = ({
  data,
  loading = false,
  error = null,
  onCopyAll,
  className
}) => {
  if (loading) {
    return /* @__PURE__ */ jsx12("div", { className: `look-inside-view-context look-inside-loading ${className ?? ""}`, children: /* @__PURE__ */ jsx12("div", { className: "look-inside-spinner", children: "Preparing context..." }) });
  }
  if (error) {
    return /* @__PURE__ */ jsx12("div", { className: `look-inside-view-context look-inside-error ${className ?? ""}`, children: /* @__PURE__ */ jsx12("div", { className: "look-inside-error-message", children: error }) });
  }
  if (!data || !data.available) {
    return /* @__PURE__ */ jsx12("div", { className: `look-inside-view-context ${className ?? ""}`, children: /* @__PURE__ */ jsx12("div", { className: "look-inside-muted", children: "Context not available" }) });
  }
  return /* @__PURE__ */ jsxs11("div", { className: `look-inside-view-context ${className ?? ""}`, children: [
    /* @__PURE__ */ jsxs11("div", { className: "look-inside-view-context-header", children: [
      /* @__PURE__ */ jsxs11("span", { className: "look-inside-view-context-total", children: [
        "Total: ",
        formatNumber(data.totalTokens),
        " tokens (",
        data.components.length,
        " component",
        data.components.length !== 1 ? "s" : "",
        ")"
      ] }),
      onCopyAll && /* @__PURE__ */ jsx12(
        "button",
        {
          type: "button",
          className: "look-inside-btn look-inside-btn-secondary",
          onClick: onCopyAll,
          children: "Copy All"
        }
      )
    ] }),
    /* @__PURE__ */ jsx12("div", { className: "look-inside-view-context-components", children: data.components.map((component, index) => /* @__PURE__ */ jsxs11("div", { className: "look-inside-view-context-component", children: [
      /* @__PURE__ */ jsxs11("div", { className: "look-inside-view-context-component-header", children: [
        /* @__PURE__ */ jsx12("span", { className: "look-inside-view-context-component-name", children: component.name }),
        /* @__PURE__ */ jsxs11("span", { className: "look-inside-view-context-component-tokens", children: [
          "~",
          formatNumber(component.tokenEstimate),
          " tokens"
        ] })
      ] }),
      /* @__PURE__ */ jsx12("pre", { className: "look-inside-code-block", children: /* @__PURE__ */ jsx12("code", { children: component.content }) })
    ] }, index)) })
  ] });
};
export {
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
};
//# sourceMappingURL=index.js.map