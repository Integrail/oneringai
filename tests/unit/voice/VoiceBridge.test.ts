import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../src/core/Agent.js';
import { Connector } from '../../../src/core/Connector.js';
import { Vendor } from '../../../src/core/Vendor.js';
import { VoiceBridge } from '../../../src/capabilities/voice/VoiceBridge.js';
import { RealtimePipeline } from '../../../src/capabilities/voice/pipelines/RealtimePipeline.js';
import type {
  AudioFrame,
  ITelephonyAdapter,
  OutboundCallConfig,
  TelephonyAdapterEvents,
} from '../../../src/capabilities/voice/types.js';

class MockTelephonyAdapter extends EventEmitter implements ITelephonyAdapter {
  sendAudio = vi.fn((_callId: string, _frame: AudioFrame) => undefined);
  hangup = vi.fn(async (_callId: string) => undefined);
  makeCall = vi.fn(async (_config: OutboundCallConfig) => 'outbound-call');
  getActiveCalls = vi.fn(() => [] as string[]);
  destroy = vi.fn(async () => undefined);

  override on<K extends keyof TelephonyAdapterEvents>(
    event: K,
    handler: TelephonyAdapterEvents[K],
  ): this {
    return super.on(event, handler);
  }

  override off<K extends keyof TelephonyAdapterEvents>(
    event: K,
    handler: TelephonyAdapterEvents[K],
  ): this {
    return super.off(event, handler);
  }
}

describe('VoiceBridge agentFactory', () => {
  beforeEach(() => {
    Connector.clear();
    vi.restoreAllMocks();
  });

  it('uses a fresh asynchronously resolved Agent for each call', async () => {
    const connector = Connector.create({
      name: 'voice-factory-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    vi.spyOn(RealtimePipeline.prototype, 'init').mockResolvedValue(undefined);
    vi.spyOn(RealtimePipeline.prototype, 'destroy').mockResolvedValue(undefined);
    const createdAgents: Agent[] = [];
    const factory = vi.fn(async (session) => {
      const agent = Agent.create({
        connector,
        model: 'gpt-realtime-2.1',
        name: `call-${session.callId}`,
        instructions: `Caller ${session.from}`,
      });
      createdAgents.push(agent);
      return agent;
    });
    const bridge = VoiceBridge.create({
      agentFactory: factory,
      pipeline: 'realtime',
      voice: 'marin',
    });
    const adapter = new MockTelephonyAdapter();
    bridge.attach(adapter);

    adapter.emit('call:connected', 'call-1', {
      callId: 'call-1', from: '+1000', to: '+2000', metadata: {},
    });
    adapter.emit('call:connected', 'call-2', {
      callId: 'call-2', from: '+3000', to: '+2000', metadata: {},
    });
    await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(bridge.getActiveSessions()).toHaveLength(2));

    expect(createdAgents[0]).not.toBe(createdAgents[1]);
    expect(createdAgents.map((agent) => agent.name).sort()).toEqual(['call-call-1', 'call-call-2']);
    await bridge.destroy();
    expect(createdAgents.every((agent) => agent.isDestroyed)).toBe(true);
  });

  it('publishes teardown ownership before a connected session emits ending', async () => {
    const connector = Connector.create({
      name: 'voice-teardown-ownership',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    vi.spyOn(RealtimePipeline.prototype, 'init').mockResolvedValue(undefined);
    const destroyPipeline = vi
      .spyOn(RealtimePipeline.prototype, 'destroy')
      .mockResolvedValue(undefined);
    const bridge = VoiceBridge.create({
      agentFactory: async () => Agent.create({ connector, model: 'gpt-realtime-2.1' }),
      pipeline: 'realtime',
    });
    const adapter = new MockTelephonyAdapter();
    bridge.on('error', () => undefined);
    bridge.attach(adapter);

    adapter.emit('call:connected', 'connected-hangup', {
      callId: 'connected-hangup', from: '+1000', to: '+2000', metadata: {},
    });
    await vi.waitFor(() => expect(bridge.getActiveSessions()[0]?.state).toBe('connected'));
    const sessionId = bridge.getActiveSessions()[0]!.sessionId;

    await expect(bridge.hangup(sessionId)).resolves.toBeUndefined();

    expect(bridge.getSession(sessionId)?.state).toBe('ended');
    expect(adapter.hangup).toHaveBeenCalledTimes(1);
    expect(adapter.hangup).toHaveBeenCalledWith('connected-hangup');
    expect(destroyPipeline).toHaveBeenCalledTimes(1);
    await bridge.destroy();
  });

  it('ends and hangs up a call when its Agent factory fails', async () => {
    vi.spyOn(RealtimePipeline.prototype, 'init').mockResolvedValue(undefined);
    const bridge = VoiceBridge.create({
      agentFactory: async () => { throw new Error('scope resolution failed'); },
      pipeline: 'realtime',
    });
    const adapter = new MockTelephonyAdapter();
    const errors: Error[] = [];
    bridge.on('error', (error) => errors.push(error));
    bridge.attach(adapter);

    adapter.emit('call:connected', 'bad-call', {
      callId: 'bad-call', from: '+1000', to: '+2000', metadata: {},
    });
    await vi.waitFor(() => expect(adapter.hangup).toHaveBeenCalledWith('bad-call'));

    expect(errors[0]?.message).toBe('scope resolution failed');
    expect(bridge.getActiveSessions()).toEqual([]);
    await bridge.destroy();
  });

  it('rejects an Agent instance reused across calls', async () => {
    const connector = Connector.create({
      name: 'voice-factory-reuse-test',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    const sharedAgent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    vi.spyOn(RealtimePipeline.prototype, 'init').mockResolvedValue(undefined);
    vi.spyOn(RealtimePipeline.prototype, 'destroy').mockResolvedValue(undefined);
    const bridge = VoiceBridge.create({
      agentFactory: async () => sharedAgent,
      pipeline: 'realtime',
    });
    const adapter = new MockTelephonyAdapter();
    const errors: Error[] = [];
    bridge.on('error', (error) => errors.push(error));
    bridge.attach(adapter);

    adapter.emit('call:connected', 'first-call', {
      callId: 'first-call', from: '+1000', to: '+2000', metadata: {},
    });
    await vi.waitFor(() => expect(bridge.getActiveSessions()).toHaveLength(1));
    adapter.emit('call:connected', 'second-call', {
      callId: 'second-call', from: '+3000', to: '+2000', metadata: {},
    });
    await vi.waitFor(() => expect(adapter.hangup).toHaveBeenCalledWith('second-call'));

    expect(errors.some((error) => error.message.includes('fresh Agent'))).toBe(true);
    expect(bridge.getActiveSessions()).toHaveLength(1);
    await bridge.destroy();
    expect(sharedAgent.isDestroyed).toBe(true);
  });

  it('destroys an Agent returned after its call already ended', async () => {
    const connector = Connector.create({
      name: 'voice-factory-ended-race',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    let resolveFactory!: (agent: Agent) => void;
    const factoryResult = new Promise<Agent>((resolve) => { resolveFactory = resolve; });
    const factory = vi.fn(async () => factoryResult);
    const init = vi.spyOn(RealtimePipeline.prototype, 'init').mockResolvedValue(undefined);
    const bridge = VoiceBridge.create({
      agentFactory: factory,
      pipeline: 'realtime',
    });
    const adapter = new MockTelephonyAdapter();
    bridge.on('error', () => undefined);
    bridge.attach(adapter);

    adapter.emit('call:connected', 'ended-during-factory', {
      callId: 'ended-during-factory', from: '+1000', to: '+2000', metadata: {},
    });
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());
    adapter.emit('call:ended', 'ended-during-factory', 'caller_hangup');
    await vi.waitFor(() => expect(bridge.getActiveSessions()).toEqual([]));

    const lateAgent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    resolveFactory(lateAgent);
    await vi.waitFor(() => expect(lateAgent.isDestroyed).toBe(true));
    expect(init).not.toHaveBeenCalled();

    await bridge.destroy();
  });

  it('destroys an Agent returned after the bridge was destroyed', async () => {
    const connector = Connector.create({
      name: 'voice-factory-destroy-race',
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: 'test' },
    });
    let resolveFactory!: (agent: Agent) => void;
    const factoryResult = new Promise<Agent>((resolve) => { resolveFactory = resolve; });
    const factory = vi.fn(async () => factoryResult);
    const init = vi.spyOn(RealtimePipeline.prototype, 'init').mockResolvedValue(undefined);
    const bridge = VoiceBridge.create({
      agentFactory: factory,
      pipeline: 'realtime',
    });
    const adapter = new MockTelephonyAdapter();
    bridge.on('error', () => undefined);
    bridge.attach(adapter);

    adapter.emit('call:connected', 'destroyed-during-factory', {
      callId: 'destroyed-during-factory', from: '+1000', to: '+2000', metadata: {},
    });
    await vi.waitFor(() => expect(factory).toHaveBeenCalledOnce());
    await bridge.destroy();

    const lateAgent = Agent.create({ connector, model: 'gpt-realtime-2.1' });
    resolveFactory(lateAgent);
    await vi.waitFor(() => expect(lateAgent.isDestroyed).toBe(true));
    expect(init).not.toHaveBeenCalled();
  });
});
