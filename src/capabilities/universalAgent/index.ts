/**
 * UniversalAgent capability exports
 */

export { UniversalAgent } from './UniversalAgent.js';
export type { UniversalAgentEvents } from './UniversalAgent.js';

export { ModeManager } from './ModeManager.js';
export type { ModeManagerEvents } from './ModeManager.js';

export {
  getMetaTools,
  isMetaTool,
  META_TOOL_NAMES,
  startPlanningTool,
  modifyPlanTool,
  reportProgressTool,
  requestApprovalTool,
} from './metaTools.js';

export type {
  UniversalAgentConfig,
  UniversalAgentSessionConfig,
  UniversalAgentPlanningConfig,
  UniversalResponse,
  UniversalEvent,
  AgentMode,
  TaskProgress,
  IntentAnalysis,
  PlanChange,
  ExecutionResult,
  ToolCallResult,
  ModeState,
  StartPlanningArgs,
  ModifyPlanArgs,
  ReportProgressArgs,
  RequestApprovalArgs,
} from './types.js';
