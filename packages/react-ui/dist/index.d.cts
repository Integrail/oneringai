import React$1, { ReactNode } from 'react';
import { IPluginSnapshot, IContextSnapshot, IViewContextData, ContextBudget, IToolSnapshot } from '@everworker/oneringai';
export { IContextSnapshot, IPluginSnapshot, IToolSnapshot, IViewContextComponent, IViewContextData } from '@everworker/oneringai';

/**
 * UI prop types for Look Inside components.
 * Re-exports snapshot types from core library for convenience.
 */

/**
 * Renderer component for a specific plugin type.
 */
type PluginRenderer = React.ComponentType<PluginRendererProps>;
/**
 * Props passed to plugin renderer components.
 */
interface PluginRendererProps {
    /** Plugin snapshot data */
    plugin: IPluginSnapshot;
    /** Whether the section is currently expanded */
    expanded?: boolean;
    /** Optional CSS class */
    className?: string;
    /** Optional callback when a memory/entry item is clicked (for lazy value loading) */
    onEntryClick?: (key: string) => void;
    /** Optional map of loaded entry values (key → value) */
    entryValues?: Map<string, unknown>;
    /** Key currently being loaded */
    loadingEntryKey?: string | null;
}
/**
 * Props for the main LookInsidePanel component.
 */
interface LookInsidePanelProps {
    /** Context snapshot (null while loading or unavailable) */
    snapshot: IContextSnapshot | null;
    /** Loading state */
    loading?: boolean;
    /** Agent display name */
    agentName?: string;
    /** App-specific header actions (buttons, etc.) */
    headerActions?: ReactNode;
    /** Callback when "View Full Context" is requested */
    onViewFullContext?: () => void;
    /** Callback when "Force Compaction" is requested */
    onForceCompaction?: () => void;
    /** Optional CSS class */
    className?: string;
    /** Custom plugin renderers (keyed by plugin name) */
    pluginRenderers?: Record<string, PluginRenderer>;
    /** Section names to expand by default */
    defaultExpanded?: string[];
    /** Callback when a Working Memory entry is clicked (for lazy value loading) */
    onMemoryEntryClick?: (key: string) => void;
    /** Loaded memory entry values */
    memoryEntryValues?: Map<string, unknown>;
    /** Memory entry key currently being loaded */
    loadingMemoryKey?: string | null;
}
/**
 * Props for ViewContextContent component.
 */
interface ViewContextContentProps {
    /** View context data (from agent.getViewContext()) */
    data: IViewContextData | null;
    /** Loading state */
    loading?: boolean;
    /** Error message */
    error?: string | null;
    /** Callback when "Copy All" is clicked */
    onCopyAll?: () => void;
    /** Optional CSS class */
    className?: string;
}
/**
 * Props for CollapsibleSection component.
 */
interface CollapsibleSectionProps {
    /** Section title */
    title: string;
    /** Section identifier (for expand/collapse state) */
    id: string;
    /** Whether the section starts expanded (uncontrolled mode) */
    defaultExpanded?: boolean;
    /** Controlled expanded state (overrides defaultExpanded) */
    expanded?: boolean;
    /** Callback when toggled (for controlled mode) */
    onToggle?: (id: string) => void;
    /** Optional badge text (shown next to title) */
    badge?: string | number;
    /** Optional icon (ReactNode — app provides its own) */
    icon?: ReactNode;
    /** Children content */
    children: ReactNode;
    /** Optional CSS class */
    className?: string;
}

/**
 * LookInsidePanel — Main container that auto-renders plugin sections.
 *
 * Takes a serializable IContextSnapshot and renders all sections.
 * Plugin sections are auto-discovered from the snapshot — no hardcoding.
 */

declare const LookInsidePanel: React$1.FC<LookInsidePanelProps>;

/**
 * ViewContextContent — "View Full Context" content (no modal wrapper).
 *
 * Renders the prepared context breakdown with named components,
 * token estimates, and a "Copy All" button. Apps provide their own modal.
 */

declare const ViewContextContent: React$1.FC<ViewContextContentProps>;

/**
 * CollapsibleSection — Reusable expand/collapse wrapper.
 * Supports both uncontrolled (defaultExpanded) and controlled (expanded + onToggle) modes.
 */

declare const CollapsibleSection: React$1.FC<CollapsibleSectionProps>;

/**
 * ContextWindowSection — Progress bar + token stats.
 */

interface ContextWindowSectionProps {
    budget: ContextBudget;
    messagesCount: number;
    toolCallsCount: number;
    strategy: string;
}
declare const ContextWindowSection: React$1.FC<ContextWindowSectionProps>;

/**
 * TokenBreakdownSection — Bar chart from budget.breakdown.
 */

interface TokenBreakdownSectionProps {
    budget: ContextBudget;
}
declare const TokenBreakdownSection: React$1.FC<TokenBreakdownSectionProps>;

/**
 * SystemPromptSection — Code block display for system prompt.
 */

interface SystemPromptSectionProps {
    content: string | null;
}
declare const SystemPromptSection: React$1.FC<SystemPromptSectionProps>;

/**
 * ToolsSection — Tool list with enabled/disabled badges and call counts.
 */

interface ToolsSectionProps {
    tools: IToolSnapshot[];
}
declare const ToolsSection: React$1.FC<ToolsSectionProps>;

/**
 * GenericPluginSection — Fallback renderer for plugins without a custom renderer.
 * Shows formatted content (if available) or raw JSON contents.
 */

declare const GenericPluginSection: React$1.FC<PluginRendererProps>;

/**
 * WorkingMemoryRenderer — Displays working memory entries with key, scope, priority.
 * Supports optional click-to-expand for lazy value loading (e.g., via IPC in Hosea).
 */

declare const WorkingMemoryRenderer: React$1.FC<PluginRendererProps>;

/**
 * InContextMemoryRenderer — Displays in-context memory entries with priority badges.
 */

declare const InContextMemoryRenderer: React$1.FC<PluginRendererProps>;

/**
 * PersistentInstructionsRenderer — Displays persistent instruction entries.
 */

declare const PersistentInstructionsRenderer: React$1.FC<PluginRendererProps>;

/**
 * UserInfoRenderer — Displays user info entries.
 */

declare const UserInfoRenderer: React$1.FC<PluginRendererProps>;

/**
 * Plugin Renderer Registry — Maps plugin names to custom renderer components.
 *
 * Built-in renderers are registered by default. Apps can register
 * additional renderers for custom plugins.
 */

/**
 * Register a custom plugin renderer.
 */
declare function registerPluginRenderer(name: string, renderer: PluginRenderer): void;
/**
 * Get the renderer for a plugin (or null for fallback to GenericPluginSection).
 */
declare function getPluginRenderer(name: string): PluginRenderer | null;
/**
 * Get all registered renderer names.
 */
declare function getRegisteredPluginNames(): string[];

/**
 * Utility functions for Look Inside components.
 */
/**
 * Format bytes to a human-readable string.
 */
declare function formatBytes(bytes: number): string;
/**
 * Format a number with comma separators.
 */
declare function formatNumber(n: number): string;
/**
 * Get a CSS color class name based on utilization percentage.
 */
declare function getUtilizationColor(percent: number): string;
/**
 * Get a utilization label.
 */
declare function getUtilizationLabel(percent: number): string;
/**
 * Truncate text with ellipsis.
 */
declare function truncateText(text: string, maxLength: number): string;
/**
 * Format a plugin name to display name.
 * e.g., 'working_memory' → 'Working Memory'
 */
declare function formatPluginName(name: string): string;
/**
 * Format a timestamp to a relative or absolute string.
 */
declare function formatTimestamp(ts: number): string;

export { CollapsibleSection, type CollapsibleSectionProps, ContextWindowSection, GenericPluginSection, InContextMemoryRenderer, LookInsidePanel, type LookInsidePanelProps, PersistentInstructionsRenderer, type PluginRenderer, type PluginRendererProps, SystemPromptSection, TokenBreakdownSection, ToolsSection, UserInfoRenderer, ViewContextContent, type ViewContextContentProps, WorkingMemoryRenderer, formatBytes, formatNumber, formatPluginName, formatTimestamp, getPluginRenderer, getRegisteredPluginNames, getUtilizationColor, getUtilizationLabel, registerPluginRenderer, truncateText };
