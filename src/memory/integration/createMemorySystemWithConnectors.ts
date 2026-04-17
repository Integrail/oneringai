/**
 * Convenience factory: build a MemorySystem wired to oneringai's Connector
 * system in one call. Specify the connector + model for embeddings and/or
 * profile generation; the factory constructs IEmbedder + IProfileGenerator
 * and hands them to MemorySystem.
 *
 * Everything is initialized once, up front. No connector lookups happen on
 * hot paths — the providers are constructed at factory invocation.
 */

import { MemorySystem } from '../MemorySystem.js';
import type { MemorySystemConfig } from '../types.js';
import { ConnectorEmbedder, type ConnectorEmbedderConfig } from './ConnectorEmbedder.js';
import {
  ConnectorProfileGenerator,
  type ConnectorProfileGeneratorConfig,
} from './ConnectorProfileGenerator.js';

export interface MemoryConnectorsConfig {
  embedding?: ConnectorEmbedderConfig;
  profile?: ConnectorProfileGeneratorConfig;
}

export type MemorySystemWithConnectorsConfig = Omit<
  MemorySystemConfig,
  'embedder' | 'profileGenerator'
> & {
  connectors?: MemoryConnectorsConfig;
};

export function createMemorySystemWithConnectors(
  config: MemorySystemWithConnectorsConfig,
): MemorySystem {
  const embedder = config.connectors?.embedding
    ? new ConnectorEmbedder(config.connectors.embedding)
    : undefined;
  const profileGenerator = config.connectors?.profile
    ? new ConnectorProfileGenerator(config.connectors.profile)
    : undefined;

  const { connectors: _connectors, ...base } = config;
  void _connectors;

  return new MemorySystem({
    ...base,
    embedder,
    profileGenerator,
  });
}
