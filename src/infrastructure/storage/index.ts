/**
 * Storage infrastructure exports
 */

export {
  InMemoryStorage,
  InMemoryPlanStorage,
  InMemoryAgentStateStorage,
  createAgentStorage,
} from './InMemoryStorage.js';

export type { IAgentStorage } from './InMemoryStorage.js';

// Persistent instructions storage
export { FilePersistentInstructionsStorage } from './FilePersistentInstructionsStorage.js';
export type { FilePersistentInstructionsStorageConfig } from './FilePersistentInstructionsStorage.js';

// Context storage (for AgentContext session persistence)
export { FileContextStorage, createFileContextStorage } from './FileContextStorage.js';
export type { FileContextStorageConfig } from './FileContextStorage.js';

// Agent definition storage (for agent configuration persistence)
export { FileAgentDefinitionStorage, createFileAgentDefinitionStorage } from './FileAgentDefinitionStorage.js';
export type { FileAgentDefinitionStorageConfig } from './FileAgentDefinitionStorage.js';

// Media storage (for multimedia tool outputs)
export { FileMediaStorage, createFileMediaStorage } from './FileMediaStorage.js';
export type { FileMediaStorageConfig } from './FileMediaStorage.js';

// Custom tool storage (for user-created custom tools)
export { FileCustomToolStorage, createFileCustomToolStorage } from './FileCustomToolStorage.js';
export type { FileCustomToolStorageConfig } from './FileCustomToolStorage.js';

// User info storage (for user-specific preferences and context)
export { FileUserInfoStorage } from './FileUserInfoStorage.js';
export type { FileUserInfoStorageConfig } from './FileUserInfoStorage.js';

// Routine definition storage (for reusable task-based workflows)
export { FileRoutineDefinitionStorage, createFileRoutineDefinitionStorage } from './FileRoutineDefinitionStorage.js';
export type { FileRoutineDefinitionStorageConfig } from './FileRoutineDefinitionStorage.js';
