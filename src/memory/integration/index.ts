export { ConnectorEmbedder } from './ConnectorEmbedder.js';
export type { ConnectorEmbedderConfig } from './ConnectorEmbedder.js';

export {
  ConnectorProfileGenerator,
  parseProfileResponse,
} from './ConnectorProfileGenerator.js';
export type { ConnectorProfileGeneratorConfig } from './ConnectorProfileGenerator.js';

export { defaultProfilePrompt } from './defaultPrompt.js';
export type { PromptContext } from './defaultPrompt.js';

export { createMemorySystemWithConnectors } from './createMemorySystemWithConnectors.js';
export type {
  MemoryConnectorsConfig,
  MemorySystemWithConnectorsConfig,
} from './createMemorySystemWithConnectors.js';
