/**
 * Look Inside components — Shared UI for inspecting agent context.
 */

// Main panel
export { LookInsidePanel } from './LookInsidePanel';

// View context content (no modal wrapper)
export { ViewContextContent } from './ViewContextContent';

// Collapsible section (reusable)
export { CollapsibleSection } from './CollapsibleSection';

// Individual sections (for composable use)
export { ContextWindowSection } from './sections/ContextWindowSection';
export { TokenBreakdownSection } from './sections/TokenBreakdownSection';
export { SystemPromptSection } from './sections/SystemPromptSection';
export { ToolsSection } from './sections/ToolsSection';
export { GenericPluginSection } from './sections/GenericPluginSection';

// Plugin renderers
export { WorkingMemoryRenderer } from './plugins/WorkingMemoryRenderer';
export { InContextMemoryRenderer } from './plugins/InContextMemoryRenderer';
export { PersistentInstructionsRenderer } from './plugins/PersistentInstructionsRenderer';
export { UserInfoRenderer } from './plugins/UserInfoRenderer';

// Plugin renderer registry
export {
  registerPluginRenderer,
  getPluginRenderer,
  getRegisteredPluginNames,
} from './plugins/registry';

// Types
export type {
  LookInsidePanelProps,
  ViewContextContentProps,
  CollapsibleSectionProps,
  PluginRenderer,
  PluginRendererProps,
  IContextSnapshot,
  IPluginSnapshot,
  IToolSnapshot,
  IViewContextData,
  IViewContextComponent,
} from './types';

// Utilities
export {
  formatBytes,
  formatNumber,
  getUtilizationColor,
  getUtilizationLabel,
  truncateText,
  formatPluginName,
  formatTimestamp,
} from './utils';
