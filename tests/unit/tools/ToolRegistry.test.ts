/**
 * Unit tests for ToolRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToolRegistry, ConnectorToolEntry } from '../../../src/tools/ToolRegistry.js';
import { ToolRegistryEntry, toolRegistry } from '../../../src/tools/registry.generated.js';
import { Connector } from '../../../src/core/Connector.js';
import { Services } from '../../../src/domain/entities/Services.js';
import { ConnectorTools } from '../../../src/tools/connector/ConnectorTools.js';

describe('ToolRegistry', () => {
  beforeEach(() => {
    // Clear any existing connectors and caches
    Connector.clear();
    ConnectorTools.clearCache();
  });

  afterEach(() => {
    // Clean up
    Connector.clear();
    ConnectorTools.clearCache();
  });

  describe('getBuiltInTools()', () => {
    it('should return all built-in tools from registry.generated.ts', () => {
      const tools = ToolRegistry.getBuiltInTools();

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(toolRegistry.length);
    });

    it('should return a copy (not mutate the original registry)', () => {
      const tools1 = ToolRegistry.getBuiltInTools();
      const tools2 = ToolRegistry.getBuiltInTools();

      // Should be different array instances
      expect(tools1).not.toBe(tools2);

      // But same content
      expect(tools1.length).toBe(tools2.length);

      // Mutating returned array should not affect registry
      tools1.pop();
      const tools3 = ToolRegistry.getBuiltInTools();
      expect(tools3.length).toBe(toolRegistry.length);
    });

    it('should include known tools: read_file, write_file, bash, glob, grep', () => {
      const tools = ToolRegistry.getBuiltInTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('bash');
      expect(toolNames).toContain('glob');
      expect(toolNames).toContain('grep');
    });

    it('should include all expected fields for each entry', () => {
      const tools = ToolRegistry.getBuiltInTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.displayName).toBeDefined();
        expect(typeof tool.displayName).toBe('string');
        expect(tool.category).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.tool).toBeDefined();
        expect(typeof tool.safeByDefault).toBe('boolean');
      }
    });
  });

  describe('getConnectorTools(connectorName)', () => {
    it('should return tools for a connector with baseURL', () => {
      Connector.create({
        name: 'test-api',
        displayName: 'Test API',
        baseURL: 'https://api.example.com',
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tools = ToolRegistry.getConnectorTools('test-api');

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].connectorName).toBe('test-api');
    });

    it('should return empty array for non-existent connector', () => {
      const tools = ToolRegistry.getConnectorTools('non-existent-connector');

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });

    it('should include connectorName and category in each entry', () => {
      Connector.create({
        name: 'github-test',
        displayName: 'GitHub Test',
        serviceType: Services.Github,
        baseURL: 'https://api.github.com',
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tools = ToolRegistry.getConnectorTools('github-test');

      for (const tool of tools) {
        expect(tool.connectorName).toBe('github-test');
        expect(tool.category).toBe('connector');
      }
    });

    it('should include serviceType when detected', () => {
      Connector.create({
        name: 'github-service',
        displayName: 'GitHub',
        serviceType: Services.Github,
        baseURL: 'https://api.github.com',
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const tools = ToolRegistry.getConnectorTools('github-service');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].serviceType).toBe('github');
    });
  });

  describe('getAllConnectorTools()', () => {
    it('should return tools from all service connectors', () => {
      Connector.create({
        name: 'service-a',
        displayName: 'Service A',
        serviceType: 'custom-a',
        baseURL: 'https://api-a.example.com',
        auth: { type: 'api_key', apiKey: 'key-a' },
      });

      Connector.create({
        name: 'service-b',
        displayName: 'Service B',
        serviceType: 'custom-b',
        baseURL: 'https://api-b.example.com',
        auth: { type: 'api_key', apiKey: 'key-b' },
      });

      const tools = ToolRegistry.getAllConnectorTools();

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThanOrEqual(2);

      const connectorNames = tools.map((t) => t.connectorName);
      expect(connectorNames).toContain('service-a');
      expect(connectorNames).toContain('service-b');
    });

    it('should skip AI provider connectors (have vendor, no serviceType)', () => {
      // AI provider connector (should be skipped)
      Connector.create({
        name: 'openai-test',
        vendor: 'openai',
        auth: { type: 'api_key', apiKey: 'sk-test' },
      });

      // Service connector (should be included)
      Connector.create({
        name: 'github-test',
        serviceType: Services.Github,
        baseURL: 'https://api.github.com',
        auth: { type: 'api_key', apiKey: 'test' },
      });

      const tools = ToolRegistry.getAllConnectorTools();
      const connectorNames = tools.map((t) => t.connectorName);

      expect(connectorNames).not.toContain('openai-test');
      expect(connectorNames).toContain('github-test');
    });

    it('should return empty array when no service connectors exist', () => {
      // Only create an AI provider connector
      Connector.create({
        name: 'anthropic-test',
        vendor: 'anthropic',
        auth: { type: 'api_key', apiKey: 'sk-test' },
      });

      const tools = ToolRegistry.getAllConnectorTools();

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
  });

  describe('getAllTools()', () => {
    it('should combine built-in and connector tools', () => {
      Connector.create({
        name: 'api-service',
        displayName: 'API Service',
        serviceType: 'custom',
        baseURL: 'https://api.example.com',
        auth: { type: 'api_key', apiKey: 'test-key' },
      });

      const allTools = ToolRegistry.getAllTools();
      const builtInTools = ToolRegistry.getBuiltInTools();
      const connectorTools = ToolRegistry.getAllConnectorTools();

      expect(allTools.length).toBe(builtInTools.length + connectorTools.length);
    });

    it('should return only built-in tools when no connectors exist', () => {
      const allTools = ToolRegistry.getAllTools();
      const builtInTools = ToolRegistry.getBuiltInTools();

      expect(allTools.length).toBe(builtInTools.length);
    });

    it('should maintain correct order: built-in first, then connector', () => {
      Connector.create({
        name: 'test-service',
        displayName: 'Test Service',
        serviceType: 'test',
        baseURL: 'https://test.example.com',
        auth: { type: 'api_key', apiKey: 'test' },
      });

      const allTools = ToolRegistry.getAllTools();
      const builtInCount = ToolRegistry.getBuiltInTools().length;

      // First tools should be built-in (no connectorName)
      for (let i = 0; i < builtInCount; i++) {
        expect(ToolRegistry.isConnectorTool(allTools[i])).toBe(false);
      }

      // Remaining tools should be connector tools
      for (let i = builtInCount; i < allTools.length; i++) {
        expect(ToolRegistry.isConnectorTool(allTools[i])).toBe(true);
      }
    });
  });

  describe('getToolsByService(serviceType)', () => {
    it('should filter connector tools by service type', () => {
      Connector.create({
        name: 'github-main',
        displayName: 'GitHub Main',
        serviceType: Services.Github,
        baseURL: 'https://api.github.com',
        auth: { type: 'api_key', apiKey: 'gh-key' },
      });

      Connector.create({
        name: 'slack-main',
        displayName: 'Slack Main',
        serviceType: Services.Slack,
        baseURL: 'https://slack.com/api',
        auth: { type: 'api_key', apiKey: 'slack-key' },
      });

      const githubTools = ToolRegistry.getToolsByService('github');

      expect(githubTools).toBeDefined();
      expect(githubTools.length).toBeGreaterThan(0);
      for (const tool of githubTools) {
        expect(tool.serviceType).toBe('github');
      }
    });

    it('should return empty array for unknown service type', () => {
      const tools = ToolRegistry.getToolsByService('unknown-service');

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
  });

  describe('getToolsByConnector(connectorName)', () => {
    it('should filter tools by connector name', () => {
      Connector.create({
        name: 'my-connector',
        displayName: 'My Connector',
        serviceType: 'custom',
        baseURL: 'https://my-api.example.com',
        auth: { type: 'api_key', apiKey: 'my-key' },
      });

      Connector.create({
        name: 'other-connector',
        displayName: 'Other Connector',
        serviceType: 'other',
        baseURL: 'https://other-api.example.com',
        auth: { type: 'api_key', apiKey: 'other-key' },
      });

      const tools = ToolRegistry.getToolsByConnector('my-connector');

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.connectorName).toBe('my-connector');
      }
    });

    it('should return empty array for non-existent connector', () => {
      const tools = ToolRegistry.getToolsByConnector('non-existent');

      expect(tools).toBeDefined();
      expect(tools.length).toBe(0);
    });
  });

  describe('isConnectorTool()', () => {
    it('should return true for ConnectorToolEntry', () => {
      Connector.create({
        name: 'test-connector',
        displayName: 'Test',
        serviceType: 'test',
        baseURL: 'https://test.example.com',
        auth: { type: 'api_key', apiKey: 'test' },
      });

      const connectorTools = ToolRegistry.getConnectorTools('test-connector');

      expect(connectorTools.length).toBeGreaterThan(0);
      expect(ToolRegistry.isConnectorTool(connectorTools[0])).toBe(true);
    });

    it('should return false for ToolRegistryEntry', () => {
      const builtInTools = ToolRegistry.getBuiltInTools();

      expect(builtInTools.length).toBeGreaterThan(0);
      expect(ToolRegistry.isConnectorTool(builtInTools[0])).toBe(false);
    });

    it('should work correctly in getAllTools iteration', () => {
      Connector.create({
        name: 'iter-connector',
        displayName: 'Iter',
        serviceType: 'iter',
        baseURL: 'https://iter.example.com',
        auth: { type: 'api_key', apiKey: 'iter' },
      });

      const allTools = ToolRegistry.getAllTools();
      let builtInCount = 0;
      let connectorCount = 0;

      for (const tool of allTools) {
        if (ToolRegistry.isConnectorTool(tool)) {
          connectorCount++;
          // Type narrowing should work
          expect(tool.connectorName).toBeDefined();
        } else {
          builtInCount++;
        }
      }

      expect(builtInCount).toBe(ToolRegistry.getBuiltInTools().length);
      expect(connectorCount).toBe(ToolRegistry.getAllConnectorTools().length);
    });
  });

  describe('ConnectorToolEntry properties', () => {
    it('should have displayName derived from tool name', () => {
      Connector.create({
        name: 'display-test',
        displayName: 'Display Test',
        serviceType: 'custom',
        baseURL: 'https://display.example.com',
        auth: { type: 'api_key', apiKey: 'test' },
      });

      const tools = ToolRegistry.getConnectorTools('display-test');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].displayName).toBeDefined();
      expect(typeof tools[0].displayName).toBe('string');
      expect(tools[0].displayName.length).toBeGreaterThan(0);
    });

    it('should have description from tool definition', () => {
      Connector.create({
        name: 'desc-test',
        displayName: 'Desc Test',
        baseURL: 'https://desc.example.com',
        auth: { type: 'api_key', apiKey: 'test' },
      });

      const tools = ToolRegistry.getConnectorTools('desc-test');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].description).toBeDefined();
      expect(typeof tools[0].description).toBe('string');
    });

    it('should have safeByDefault set to false for connector tools', () => {
      Connector.create({
        name: 'safe-test',
        displayName: 'Safe Test',
        serviceType: 'test',
        baseURL: 'https://safe.example.com',
        auth: { type: 'api_key', apiKey: 'test' },
      });

      const tools = ToolRegistry.getConnectorTools('safe-test');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].safeByDefault).toBe(false);
    });

    it('should have requiresConnector set to true', () => {
      Connector.create({
        name: 'req-test',
        displayName: 'Req Test',
        serviceType: 'test',
        baseURL: 'https://req.example.com',
        auth: { type: 'api_key', apiKey: 'test' },
      });

      const tools = ToolRegistry.getConnectorTools('req-test');

      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].requiresConnector).toBe(true);
    });
  });
});
