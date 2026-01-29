/**
 * Mock Connector Setup
 *
 * Creates connectors with MockLLMProvider for deterministic testing
 */

import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import { MockLLMProvider } from './MockLLMProvider.js';

// Store mock providers by connector name
const mockProviders = new Map<string, MockLLMProvider>();

/**
 * Create a mock connector with deterministic LLM responses
 */
export function createMockConnector(name: string = 'mock-test'): MockLLMProvider {
  const mockProvider = new MockLLMProvider();
  mockProviders.set(name, mockProvider);

  // Register a custom provider factory that returns our mock
  // We'll use the Vendor.Custom type and inject the provider directly
  Connector.create({
    name,
    vendor: Vendor.Custom,
    auth: { type: 'none' },
    options: {
      provider: mockProvider,
    },
  });

  return mockProvider;
}

/**
 * Get the mock provider for a connector
 */
export function getMockProvider(name: string = 'mock-test'): MockLLMProvider | undefined {
  return mockProviders.get(name);
}

/**
 * Reset all mock providers
 */
export function resetMockProviders(): void {
  mockProviders.forEach((provider) => provider.reset());
  mockProviders.clear();
}
