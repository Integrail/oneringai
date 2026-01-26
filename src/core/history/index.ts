/**
 * History management module exports
 */

export { ConversationHistoryManager } from './ConversationHistoryManager.js';
export type { ConversationHistoryManagerConfig } from './ConversationHistoryManager.js';

// Re-export interfaces
export type {
  IHistoryManager,
  IHistoryStorage,
  HistoryMessage,
  IHistoryManagerConfig,
  HistoryManagerEvents,
  SerializedHistoryState,
} from '../../domain/interfaces/IHistoryManager.js';
export { DEFAULT_HISTORY_MANAGER_CONFIG } from '../../domain/interfaces/IHistoryManager.js';
