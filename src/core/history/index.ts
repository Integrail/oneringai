/**
 * History management module exports
 */

// Re-export interfaces (ConversationHistoryManager deleted - AgentContext is the single history manager)
export type {
  IHistoryManager,
  IHistoryStorage,
  HistoryMessage,
  IHistoryManagerConfig,
  HistoryManagerEvents,
  SerializedHistoryState,
} from '../../domain/interfaces/IHistoryManager.js';
export { DEFAULT_HISTORY_MANAGER_CONFIG } from '../../domain/interfaces/IHistoryManager.js';
