import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../src/core/Agent.js';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import type { ToolFunction } from '../../../src/domain/entities/Tool.js';
import {
  AGENT_PACKAGE_PROTOCOL_VERSION,
  AgentPackageCompatibilityError,
  AgentPackageToolServer,
  type AgentPackageContextFactory,
  assertAgentPackageCompatible,
  createRemoteTool,
  exportAgentPackage,
  hydrateAgentPackage,
} from '../../../src/portable/index.js';

const localTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'local_echo',
      description: 'Echo locally',
      parameters: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: false,
      },
    },
  },
  execute: async ({ value }) => ({ local: value }),
};

const remoteTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'remote_lookup',
      description: 'Look up data on the source runtime',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
  execute: vi.fn(async ({ id }) => ({ id, source: 'server' })),
};

const failingRemoteTool: ToolFunction = {
  definition: {
    type: 'function',
    function: {
      name: 'remote_failure',
      description: 'Fail without leaking server details',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  execute: async () => { throw new Error('internal credential: server-secret'); },
};

const trustedContextFactory: AgentPackageContextFactory = ({
  package: packageValue,
  model,
  userId,
  identities,
}) => ({
  model,
  agentId: packageValue.agent.id,
  systemPrompt: packageValue.agent.instructions,
  userId,
  identities,
  features: {
    workingMemory: true,
    inContextMemory: true,
    persistentInstructions: false,
    userInfo: false,
    toolCatalog: false,
    sharedWorkspace: false,
    memory: false,
    memoryWrite: false,
  },
});

describe('portable agent packages', () => {
  beforeEach(() => {
    Connector.clear();
    vi.clearAllMocks();
  });

  it('hydrates the effective agent with local and session-bound remote tools', async () => {
    const sourceConnector = Connector.create({
      name: 'server-openai',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'server-secret' },
    });
    const desktopConnector = Connector.create({
      name: 'desktop-icos-proxy',
      vendor: Vendor.OpenAI,
      baseURL: 'https://icos.test/api/v1/proxy/server-openai',
      auth: { type: 'api_key', apiKey: 'desktop-session-token' },
    });
    const desktopRealtimeConnector = Connector.create({
      name: 'desktop-realtime-control',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'unused-with-webrtc-channel' },
    });
    const source = Agent.create({
      connector: sourceConnector,
      model: 'gpt-5.6-terra',
      name: 'effective-agent',
      userId: 'server-user-must-not-ship',
      instructions: 'Composed platform and tenant instructions.',
      temperature: 0.2,
      promptCache: { mode: 'auto', ttl: 'extended' },
      dataHandling: { allowProviderCaching: true, allowProviderTools: true },
      vendorOptions: { apiKey: 'vendor-secret-must-not-ship' },
      nativeTools: [{
        capability: 'remote_mcp',
        server: {
          name: 'sensitive-mcp',
          url: 'https://mcp.example.test',
          authorization: { connector: 'server-mcp-credential' },
        },
        options: { headers: { authorization: 'Bearer native-tool-secret' } },
      }],
      limits: { maxToolCalls: 5 },
      tools: [localTool, remoteTool],
    });
    source.context.addUserMessage('existing context');
    source.tools.register(localTool, {
      namespace: 'desktop',
      category: 'local-utilities',
      tags: ['portable'],
    });

    const packageValue = exportAgentPackage(source, {
      packageId: 'pkg-1',
      revision: 7,
      toolPlacement: (name) => name === 'local_echo' ? 'local' : 'remote',
      realtime: {
        provider: 'openai',
        connectorName: 'server-openai',
        model: 'gpt-realtime-2.1',
        voice: 'marin',
      },
    });
    const toolServer = new AgentPackageToolServer(source, packageValue);
    const remoteTransport = { execute: (request: unknown) => toolServer.execute(request) };

    const hydrated = await hydrateAgentPackage(packageValue, {
      connectorResolver: () => ({ connector: desktopConnector, model: 'gpt-5.6-terra' }),
      permissions: { autoApproveAll: true },
      contextFactory: trustedContextFactory,
      userId: 'desktop-user',
      localToolResolver: (descriptor) => descriptor.definition.function.name === 'local_echo'
        ? localTool
        : undefined,
      remoteToolTransport: remoteTransport,
      agentConfig: {
        vendorOptions: { suppliedBy: 'trusted-desktop-host' },
        nativeTools: [{ capability: 'web_search' }],
        promptCache: { mode: 'off' },
        dataHandling: { allowProviderCaching: false, allowProviderTools: false },
      },
    });

    expect(packageValue.protocolVersion).toBe(AGENT_PACKAGE_PROTOCOL_VERSION);
    expect(packageValue).not.toHaveProperty('userId');
    expect(JSON.stringify(packageValue)).not.toContain('server-secret');
    expect(JSON.stringify(packageValue)).not.toContain('server-user-must-not-ship');
    expect(JSON.stringify(packageValue)).not.toContain('vendor-secret-must-not-ship');
    expect(JSON.stringify(packageValue)).not.toContain('native-tool-secret');
    expect(JSON.stringify(packageValue)).not.toContain('server-mcp-credential');
    expect(packageValue.agent.runtime).not.toHaveProperty('vendorOptions');
    expect(packageValue.agent.runtime).not.toHaveProperty('nativeTools');
    expect(packageValue.agent.runtime).not.toHaveProperty('promptCache');
    expect(packageValue.agent.runtime).not.toHaveProperty('dataHandling');
    expect(packageValue.agent.context.state).not.toHaveProperty('systemPrompt');
    expect(packageValue.agent.realtime?.voice).toBe('marin');
    expect(hydrated.connector.name).toBe('desktop-icos-proxy');
    expect(hydrated.userId).toBe('desktop-user');
    expect(hydrated.getTemperature()).toBe(0.2);
    expect(hydrated.getRuntimeConfigSnapshot()).toMatchObject({
      vendorOptions: { suppliedBy: 'trusted-desktop-host' },
      nativeTools: [{ capability: 'web_search' }],
      promptCache: { mode: 'off' },
      dataHandling: { allowProviderCaching: false, allowProviderTools: false },
    });
    expect(hydrated.context.systemPrompt).toBe('Composed platform and tenant instructions.');
    const hydratedVoice = await hydrateAgentPackage(packageValue, {
      executionProfile: 'realtime',
      connectorResolver: (reference, profile) => {
        expect(profile).toBe('realtime');
        expect(reference).toEqual({ name: 'server-openai', model: 'gpt-realtime-2.1' });
        return { connector: desktopRealtimeConnector, model: 'gpt-realtime-2.1' };
      },
      permissions: { autoApproveAll: true },
      contextFactory: trustedContextFactory,
      userId: 'desktop-user',
      localToolResolver: (descriptor) => descriptor.definition.function.name === 'local_echo'
        ? localTool
        : undefined,
      remoteToolTransport: remoteTransport,
    });
    expect(hydratedVoice.model).toBe('gpt-realtime-2.1');
    expect(hydratedVoice.connector.name).toBe('desktop-realtime-control');
    const editedPackage = structuredClone(packageValue);
    editedPackage.agent.instructions = 'Client-adjusted instructions.';
    const edited = await hydrateAgentPackage(editedPackage, {
      connector: desktopConnector,
      model: 'gpt-5.6-terra',
      permissions: { autoApproveAll: true },
      contextFactory: trustedContextFactory,
      userId: 'desktop-user',
      localToolResolver: (descriptor) => descriptor.definition.function.name === 'local_echo'
        ? localTool
        : undefined,
      remoteToolTransport: remoteTransport,
    });
    expect(edited.context.systemPrompt).toBe('Client-adjusted instructions.');
    expect(hydrated.tools.getRegistration('local_echo')).toMatchObject({
      namespace: 'desktop',
      category: 'local-utilities',
      tags: ['portable'],
    });
    await expect(hydrated.tools.execute('local_echo', { value: 'hello' }))
      .resolves.toEqual({ local: 'hello' });
    await expect(hydrated.tools.execute('remote_lookup', { id: '42' }))
      .resolves.toEqual({ id: '42', source: 'server' });

    await toolServer.close();
    edited.destroy();
    hydratedVoice.destroy();
    hydrated.destroy();
    source.destroy();
  });

  it('fails closed for incompatible packages and unresolved executable tools', async () => {
    const connector = Connector.create({
      name: 'portable-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({
      connector,
      model: 'gpt-5.6-terra',
      tools: [localTool],
    });
    const packageValue = exportAgentPackage(source, {
      toolPlacement: (name) => name === 'local_echo' ? 'local' : 'omit',
    });

    await expect(hydrateAgentPackage(packageValue, {
      connector,
      model: 'gpt-5.6-terra',
      permissions: {},
      contextFactory: trustedContextFactory,
    })).rejects.toThrow(
      "Local tool 'local_echo' could not be resolved",
    );
    await expect(hydrateAgentPackage({
      ...packageValue,
      protocolVersion: 99,
    } as any, {
      connector,
      model: 'gpt-5.6-terra',
      permissions: {},
      contextFactory: trustedContextFactory,
    })).rejects.toBeInstanceOf(AgentPackageCompatibilityError);

    source.destroy();
  });

  it('rejects open-ended Realtime session data that could carry credentials', () => {
    const connector = Connector.create({
      name: 'portable-realtime-secrets',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model' });

    expect(() => exportAgentPackage(source, {
      realtime: {
        provider: 'openai',
        connectorName: 'realtime',
        model: 'gpt-realtime-2.1',
        session: {
          tools: [{ type: 'mcp', authorization: 'Bearer must-not-ship' }],
        },
      } as any,
    })).toThrow("agent.realtime contains unsupported field 'session'");

    source.destroy();
  });

  it('uses only trusted host context policy when package feature flags are modified', async () => {
    const connector = Connector.create({
      name: 'portable-context-policy',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model' });
    const packageValue = exportAgentPackage(source);
    packageValue.agent.context.features.toolCatalog = true;

    const hydrated = await hydrateAgentPackage(packageValue, {
      connector,
      model: 'trusted-model',
      permissions: {},
      contextFactory: ({ package: received, model }) => ({
        model,
        agentId: received.agent.id,
        systemPrompt: received.agent.instructions,
        features: { toolCatalog: false },
        toolCategories: [],
      }),
    });

    expect(hydrated.context.features.toolCatalog).toBe(false);
    expect(hydrated.context.getPlugin('tool_catalog')).toBeNull();
    expect(hydrated.listTools()).not.toContain('tool_catalog_load');

    hydrated.destroy();
    source.destroy();
  });

  it('rejects malformed runtime values before Agent creation', () => {
    const connector = Connector.create({
      name: 'portable-runtime-validation',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model' });
    const packageValue = exportAgentPackage(source);
    const invalidValues: Array<[string, (value: any) => void, string]> = [
      ['temperature type', (value) => { value.agent.runtime.temperature = 'hot'; }, 'temperature'],
      ['iteration range', (value) => { value.agent.runtime.maxIterations = -1; }, 'maxIterations'],
      ['limits shape', (value) => { value.agent.runtime.limits = 'unlimited'; }, 'limits'],
      [
        'nested retry range',
        (value) => { value.agent.runtime.emptyResponseRetry = { maxRetries: -1 }; },
        'maxRetries',
      ],
      [
        'enabled thinking zero budget',
        (value) => { value.agent.runtime.thinking = { enabled: true, budgetTokens: 0 }; },
        'budgetTokens',
      ],
    ];

    for (const [, mutate, expectedField] of invalidValues) {
      const invalid = structuredClone(packageValue);
      mutate(invalid);
      expect(() => assertAgentPackageCompatible(invalid)).toThrow(expectedField);
    }

    const governancePolicy = structuredClone(packageValue) as any;
    governancePolicy.agent.runtime.dataHandling = { allowProviderTools: true };
    expect(() => assertAgentPackageCompatible(governancePolicy)).toThrow(
      "agent.runtime contains unsupported field 'dataHandling'",
    );

    source.destroy();
  });

  it('round-trips zero values that select disabled or default runtime behavior', async () => {
    const connector = Connector.create({
      name: 'portable-zero-values',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({
      connector,
      model: 'source-model',
      maxIterations: 0,
      thinking: { enabled: false, budgetTokens: 0 },
      limits: {
        maxExecutionTime: 0,
        maxToolCalls: 0,
        maxContextSize: 0,
        maxInputMessages: 0,
      },
      errorHandling: { maxConsecutiveErrors: 0 },
    });

    const packageValue = exportAgentPackage(source);
    expect(() => assertAgentPackageCompatible(packageValue)).not.toThrow();
    const hydrated = await hydrateAgentPackage(packageValue, {
      connector,
      model: 'trusted-model',
      permissions: {},
      contextFactory: trustedContextFactory,
    });

    expect(hydrated.getRuntimeConfigSnapshot()).toMatchObject({
      maxIterations: 0,
      thinking: { enabled: false, budgetTokens: 0 },
      limits: {
        maxExecutionTime: 0,
        maxToolCalls: 0,
        maxContextSize: 0,
        maxInputMessages: 0,
      },
      errorHandling: { maxConsecutiveErrors: 0 },
    });
    hydrated.destroy();
    source.destroy();
  });

  it('projects portable fields before cloning host-local provider callbacks', () => {
    const connector = Connector.create({
      name: 'portable-provider-callback',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({
      connector,
      model: 'source-model',
      temperature: 0.4,
      vendorOptions: {
        transformRequest: () => ({ authorization: 'must-stay-on-host' }),
      },
    });

    const packageValue = exportAgentPackage(source);

    expect(packageValue.agent.runtime).toEqual({ temperature: 0.4 });
    expect(JSON.stringify(packageValue)).not.toContain('must-stay-on-host');
    source.destroy();
  });

  it('rejects malformed portable feature flags and conversation entries', () => {
    const connector = Connector.create({
      name: 'portable-context-shapes',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model' });
    const packageValue = exportAgentPackage(source);
    const malformedFeature = structuredClone(packageValue) as any;
    malformedFeature.agent.context.features.workingMemory = 'enabled';
    expect(() => assertAgentPackageCompatible(malformedFeature)).toThrow(
      'agent.context.features.workingMemory must be boolean',
    );

    const missingFeature = structuredClone(packageValue) as any;
    delete missingFeature.agent.context.features.memoryWrite;
    expect(() => assertAgentPackageCompatible(missingFeature)).toThrow(
      'agent.context.features.memoryWrite must be boolean',
    );

    const malformedMessage = structuredClone(packageValue) as any;
    malformedMessage.agent.context.state.conversation = [{
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 42 }],
    }];
    expect(() => assertAgentPackageCompatible(malformedMessage)).toThrow(
      'conversation[0].content[0].text must be a string',
    );

    const unsupportedItem = structuredClone(packageValue) as any;
    unsupportedItem.agent.context.state.conversation = [{
      type: 'reasoning', id: 'reasoning-1', summary: 'not an InputItem',
    }];
    expect(() => assertAgentPackageCompatible(unsupportedItem)).toThrow(
      "conversation[0].type must be 'message' or 'compaction'",
    );
    source.destroy();
  });

  it('enforces package and remote argument limits in UTF-8 bytes', async () => {
    const connector = Connector.create({
      name: 'portable-utf8-limits',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model', tools: [remoteTool] });
    const packageValue = exportAgentPackage(source, {
      packageId: 'utf8-package',
      toolPlacement: () => 'remote',
    });
    const oversizedPackage = structuredClone(packageValue);
    oversizedPackage.metadata = { payload: 'é'.repeat(5_000_001) };
    expect(() => assertAgentPackageCompatible(oversizedPackage)).toThrow(
      'Agent package exceeds 10000000 bytes',
    );

    const server = new AgentPackageToolServer(source, packageValue);
    const oversizedArguments = await server.execute({
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: packageValue.packageId,
      requestId: 'utf8-arguments',
      toolName: 'remote_lookup',
      arguments: { payload: 'é'.repeat(500_001) },
    });
    expect(oversizedArguments).toMatchObject({
      ok: false,
      error: { code: 'invalid_request', message: 'arguments exceeds 1000000 bytes' },
    });
    await server.close();
    source.destroy();
  });

  it('rejects non-JSON and open-ended remote requests without executing tools', async () => {
    const connector = Connector.create({
      name: 'portable-request-validation',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const execute = vi.fn(async () => ({ accepted: true }));
    const source = Agent.create({
      connector,
      model: 'source-model',
      tools: [{ ...remoteTool, execute }],
    });
    const packageValue = exportAgentPackage(source, {
      packageId: 'strict-requests',
      toolPlacement: () => 'remote',
    });
    const server = new AgentPackageToolServer(source, packageValue);
    const baseRequest = {
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: packageValue.packageId,
      toolName: 'remote_lookup',
    };
    const requests = [
      { ...baseRequest, requestId: 'nan', arguments: { value: Number.NaN } },
      { ...baseRequest, requestId: 'undefined', arguments: { value: undefined } },
      { ...baseRequest, requestId: 'date', arguments: { value: new Date() } },
      { ...baseRequest, requestId: 'function', arguments: { value: () => undefined } },
      { ...baseRequest, requestId: 'extra', arguments: {}, unexpected: true },
    ];

    for (const request of requests) {
      await expect(server.execute(request)).resolves.toMatchObject({
        ok: false,
        error: { code: 'invalid_request' },
      });
    }
    expect(execute).not.toHaveBeenCalled();

    await server.close();
    source.destroy();
  });

  it('rejects forged and branch-invalid remote transport responses', async () => {
    const descriptor = {
      definition: remoteTool.definition,
      placement: 'remote' as const,
    };
    const invalidResponses: Array<(request: any) => any> = [
      (request) => ({
        protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
        packageId: request.packageId,
        requestId: request.requestId,
        ok: 'false',
        result: { forged: true },
      }),
      (request) => ({
        protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
        packageId: request.packageId,
        requestId: request.requestId,
        ok: true,
        result: { accepted: true },
        error: { code: 'forged', message: 'wrong branch' },
      }),
      (request) => ({
        protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
        packageId: request.packageId,
        requestId: request.requestId,
        ok: false,
        error: { code: 500, message: 'wrong type' },
      }),
      (request) => ({
        protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
        packageId: request.packageId,
        requestId: request.requestId,
        ok: true,
        result: { callback: () => 'not wire data' },
      }),
    ];

    for (const makeResponse of invalidResponses) {
      const tool = createRemoteTool('malicious-package', descriptor, {
        execute: async (request) => makeResponse(request),
      });
      await expect(tool.execute({ id: '42' })).rejects.toBeInstanceOf(
        AgentPackageCompatibilityError,
      );
    }
  });

  it('bounds remote results on both sides of the transport', async () => {
    const connector = Connector.create({
      name: 'portable-result-limits',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const oversizedTool: ToolFunction = {
      definition: {
        type: 'function',
        function: {
          name: 'oversized_result',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      execute: async () => ({ payload: 'é'.repeat(500_001) }),
    };
    const source = Agent.create({ connector, model: 'source-model', tools: [oversizedTool] });
    const packageValue = exportAgentPackage(source, {
      packageId: 'bounded-results',
      toolPlacement: () => 'remote',
    });
    const server = new AgentPackageToolServer(source, packageValue);
    await expect(server.execute({
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: packageValue.packageId,
      requestId: 'oversized-server-result',
      toolName: 'oversized_result',
      arguments: {},
    })).resolves.toMatchObject({
      ok: false,
      error: { code: 'tool_failed' },
    });

    const descriptor = packageValue.agent.tools[0]!;
    const clientTool = createRemoteTool(packageValue.packageId, descriptor, {
      execute: async (request) => ({
        protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
        packageId: request.packageId,
        requestId: request.requestId,
        ok: true,
        result: { payload: 'é'.repeat(500_001) },
      }),
    });
    await expect(clientTool.execute({})).rejects.toMatchObject({
      name: 'AgentPackageCompatibilityError',
      message: 'remote tool response result exceeds 1000000 bytes',
    });

    await server.close();
    source.destroy();
  });

  it('requires an explicit effective template after context instructions change', () => {
    const connector = Connector.create({
      name: 'portable-instruction-drift',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({
      connector,
      model: 'source-model',
      instructions: 'Original safety rules.',
    });
    source.context.systemPrompt = 'Replacement safety rules.';

    expect(() => exportAgentPackage(source)).toThrow(
      'Agent context instructions changed after creation',
    );
    const packageValue = exportAgentPackage(source, {
      instructionTemplate: 'Replacement safety rules.',
    });
    expect(packageValue.agent.instructions).toBe('Replacement safety rules.');

    source.destroy();
  });

  it('recreates context-owned tools locally and rerenders templates for the trusted host', async () => {
    const sourceConnector = Connector.create({
      name: 'template-source',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'source-secret' },
    });
    const desktopConnector = Connector.create({
      name: 'template-desktop',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'desktop-secret' },
    });
    const source = Agent.create({
      connector: sourceConnector,
      model: 'source-text-model',
      userId: 'source-tenant-user',
      name: 'template-agent',
      instructions: 'Serve {{USER_ID}} with {{MODEL}}.',
    });
    expect(source.listTools().some((name) => name.startsWith('store_'))).toBe(true);

    const packageValue = exportAgentPackage(source, {
      realtime: {
        provider: 'openai',
        connectorName: 'source-realtime',
        model: 'source-realtime-model',
      },
    });
    expect(packageValue.agent.tools).toEqual([]);
    expect(packageValue.agent.instructions).toBe('Serve {{USER_ID}} with {{MODEL}}.');
    expect(JSON.stringify(packageValue)).not.toContain('source-tenant-user');

    const hydrated = await hydrateAgentPackage(packageValue, {
      executionProfile: 'realtime',
      connector: desktopConnector,
      model: 'trusted-realtime-model',
      userId: 'desktop-user',
      permissions: { autoApproveAll: true },
      contextFactory: trustedContextFactory,
    });
    expect(hydrated.context.systemPrompt).toBe('Serve desktop-user with trusted-realtime-model.');
    expect(hydrated.listTools().some((name) => name.startsWith('store_'))).toBe(true);

    hydrated.destroy();
    source.destroy();
  });

  it('rejects portable tools that collide with trusted context tools', async () => {
    const connector = Connector.create({
      name: 'portable-tool-collision',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model', tools: [remoteTool] });
    const packageValue = exportAgentPackage(source, { toolPlacement: () => 'remote' });
    packageValue.agent.tools[0]!.definition.function.name = 'store_set';

    await expect(hydrateAgentPackage(packageValue, {
      connector,
      model: 'trusted-model',
      permissions: {},
      contextFactory: trustedContextFactory,
      remoteToolTransport: { execute: vi.fn() },
    })).rejects.toThrow("Portable tool 'store_set' conflicts with a trusted host tool");
    expect(() => new AgentPackageToolServer(source, packageValue)).toThrow(
      "Remote tool 'store_set' conflicts with a source context tool",
    );

    source.destroy();
  });

  it('requires trusted connector, model, and permission authority during hydration', async () => {
    const connector = Connector.create({
      name: 'trusted-hydration',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model', tools: [localTool] });
    const packageValue = exportAgentPackage(source, { toolPlacement: () => 'local' });

    await expect(hydrateAgentPackage(packageValue, undefined as any)).rejects.toThrow(
      'Trusted hydration options are required',
    );
    await expect(hydrateAgentPackage(packageValue, {
      connector,
      permissions: {},
      contextFactory: trustedContextFactory,
      localToolResolver: () => localTool,
    } as any)).rejects.toThrow('resolved model must be a non-empty string');
    await expect(hydrateAgentPackage(packageValue, {
      connector,
      model: 'trusted-model',
      localToolResolver: () => localTool,
    } as any)).rejects.toThrow('Trusted host permissions are required');
    await expect(hydrateAgentPackage(packageValue, {
      connector,
      model: 'trusted-model',
      permissions: {},
      localToolResolver: () => localTool,
    } as any)).rejects.toThrow('Trusted host contextFactory is required');

    const hydrated = await hydrateAgentPackage(packageValue, {
      connector,
      model: 'trusted-model',
      permissions: { autoApproveAll: true, blocklist: ['local_echo'] },
      contextFactory: trustedContextFactory,
      localToolResolver: () => localTool,
    });
    expect(hydrated.model).toBe('trusted-model');
    expect(hydrated.toolIsBlocked('local_echo')).toBe(true);

    hydrated.destroy();
    source.destroy();
  });

  it('rejects malformed timestamps, placements, duplicate tools, and prompt copies', async () => {
    const connector = Connector.create({
      name: 'strict-package',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({ connector, model: 'source-model', tools: [localTool] });
    const packageValue = exportAgentPackage(source, { toolPlacement: () => 'local' });
    const hydrate = (value: unknown) => hydrateAgentPackage(value as any, {
      connector,
      model: 'trusted-model',
      permissions: {},
      contextFactory: trustedContextFactory,
      localToolResolver: () => localTool,
    });

    await expect(hydrate({ ...packageValue, expiresAt: 'not-a-date' })).rejects.toThrow(
      'expiresAt must be a valid timestamp',
    );
    const invalidPlacement = structuredClone(packageValue) as any;
    invalidPlacement.agent.tools[0].placement = 'somewhere';
    await expect(hydrate(invalidPlacement)).rejects.toThrow("placement must be 'local' or 'remote'");
    const duplicate = structuredClone(packageValue);
    duplicate.agent.tools.push(structuredClone(duplicate.agent.tools[0]!));
    await expect(hydrate(duplicate)).rejects.toThrow("Duplicate portable tool 'local_echo'");
    const promptCopy = structuredClone(packageValue) as any;
    promptCopy.agent.context.state.systemPrompt = 'stale-rendered-copy';
    await expect(hydrate(promptCopy)).rejects.toThrow(
      "agent.context.state contains unsupported field 'systemPrompt'",
    );

    source.destroy();
  });

  it('rejects cross-package and non-allowlisted remote tool requests', async () => {
    const connector = Connector.create({
      name: 'portable-server-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({
      connector,
      model: 'gpt-5.6-terra',
      tools: [remoteTool],
    });
    const packageValue = exportAgentPackage(source, {
      packageId: 'allowed-package',
      toolPlacement: () => 'remote',
    });
    const server = new AgentPackageToolServer(source, packageValue);

    const wrongPackage = await server.execute({
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: 'another-package',
      requestId: 'request-1',
      toolName: 'remote_lookup',
      arguments: { id: '42' },
    });
    const unknownTool = await server.execute({
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: 'allowed-package',
      requestId: 'request-2',
      toolName: 'not_exported',
      arguments: {},
    });

    expect(wrongPackage).toMatchObject({ ok: false, error: { code: 'invalid_request' } });
    expect(unknownTool).toMatchObject({ ok: false, error: { code: 'tool_not_allowed' } });
    await server.close();
    source.destroy();
  });

  it('does not expose server tool error details through the remote protocol', async () => {
    const connector = Connector.create({
      name: 'portable-error-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const source = Agent.create({
      connector,
      model: 'gpt-5.6-terra',
      tools: [failingRemoteTool],
    });
    const packageValue = exportAgentPackage(source, {
      packageId: 'error-package',
      toolPlacement: () => 'remote',
    });
    const server = new AgentPackageToolServer(source, packageValue);

    const response = await server.execute({
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: 'error-package',
      requestId: 'request-failure',
      toolName: 'remote_failure',
      arguments: {},
    });

    expect(response).toMatchObject({
      ok: false,
      error: { code: 'tool_failed', message: "Tool 'remote_failure' failed" },
    });
    expect(JSON.stringify(response)).not.toContain('server-secret');
    await server.close('failed');
    source.destroy();
  });

  it('deduplicates remote request retries and rejects request ID reuse', async () => {
    const connector = Connector.create({
      name: 'portable-idempotency-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const execute = vi.fn(async ({ id }) => ({ id, changed: true }));
    const destructiveTool: ToolFunction = {
      ...remoteTool,
      execute,
    };
    const source = Agent.create({ connector, model: 'source-model', tools: [destructiveTool] });
    const packageValue = exportAgentPackage(source, {
      packageId: 'idempotent-package',
      toolPlacement: () => 'remote',
    });
    const server = new AgentPackageToolServer(source, packageValue);
    const request = {
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: packageValue.packageId,
      requestId: 'stable-request-id',
      toolName: 'remote_lookup',
      arguments: { id: '42' },
    };

    const [first, retry] = await Promise.all([
      server.execute(request),
      server.execute(structuredClone(request)),
    ]);
    const mismatch = await server.execute({ ...request, arguments: { id: '43' } });

    expect(first).toEqual(retry);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(mismatch).toMatchObject({ ok: false, error: { code: 'invalid_request' } });
    await server.close();
    source.destroy();
  });

  it('waits for active remote tools before completing the external execution', async () => {
    const connector = Connector.create({
      name: 'portable-close-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const slowTool: ToolFunction = {
      definition: {
        type: 'function',
        function: {
          name: 'remote_slow',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      execute: async () => { await pending; return { done: true }; },
    };
    const source = Agent.create({ connector, model: 'gpt-5.6-terra', tools: [slowTool] });
    const packageValue = exportAgentPackage(source, { toolPlacement: () => 'remote' });
    const server = new AgentPackageToolServer(source, packageValue);
    const execution = server.execute({
      protocolVersion: AGENT_PACKAGE_PROTOCOL_VERSION,
      packageId: packageValue.packageId,
      requestId: 'slow-request',
      toolName: 'remote_slow',
      arguments: {},
    });
    await vi.waitFor(() => expect(source.isRunning()).toBe(true));

    let firstClosed = false;
    let secondClosed = false;
    const firstClosing = server.close().then(() => { firstClosed = true; });
    const secondClosing = server.close().then(() => { secondClosed = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(firstClosed).toBe(false);
    expect(secondClosed).toBe(false);
    release();

    await expect(execution).resolves.toMatchObject({ ok: true, result: { done: true } });
    await Promise.all([firstClosing, secondClosing]);
    expect(source.isRunning()).toBe(false);
    source.destroy();
  });
});
