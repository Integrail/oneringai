import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Agent } from '@/core/Agent.js';
import { Connector } from '@/core/Connector.js';
import { Vendor } from '@/core/Vendor.js';
import type { ToolFunction } from '@/domain/entities/Tool.js';
import { AgentRuntime, LocalExecutionBackend, OneRingAIDriver } from '@/agent-runtime/index.js';
import type { AgentRun, AgentRunEvent, AgentRunEventType } from '@/agent-runtime/index.js';
import { CodexSdkDriver } from '@/agent-runtime/codex.js';

dotenv.config({ quiet: true });

const enabled = process.env.RUN_LIVE_AGENT_RUNTIME === '1';
const connectorName = 'agent-runtime-live-openai';
const temporaryDirectories: string[] = [];

describe.skipIf(!enabled).sequential('Agent Runtime live providers', () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('RUN_LIVE_AGENT_RUNTIME=1 requires OPENAI_API_KEY');
    }
    Connector.remove(connectorName);
    Connector.create({
      name: connectorName,
      vendor: Vendor.OpenAI,
      auth: { type: 'api_key', apiKey: process.env.OPENAI_API_KEY },
    });
  });

  afterAll(async () => {
    Connector.remove(connectorName);
    await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it('executes a real OneRingAI agentic tool loop through the generic runtime', async () => {
    let probeCalls = 0;
    const probe: ToolFunction = {
      definition: {
        type: 'function',
        function: {
          name: 'runtime_live_probe',
          description: 'Required live-test probe. Call it exactly once before answering.',
          parameters: {
            type: 'object',
            properties: { request: { type: 'string' } },
            required: ['request'],
            additionalProperties: false,
          },
        },
      },
      execute: async () => {
        probeCalls++;
        return { marker: 'ONERING_LIVE_OK' };
      },
    };
    const driver = new OneRingAIDriver({
      trustAgentPolicy: true,
      factories: {
        live: ({ context }) => Agent.create({
          connector: connectorName,
          model: 'gpt-5.3-codex',
          userId: context.userId,
          instructions: 'Always follow the requested tool protocol exactly.',
          tools: [probe],
        }),
      },
    });
    const runtime = new AgentRuntime({ backend: new LocalExecutionBackend({ drivers: [driver] }) });
    try {
      const session = await runtime.agent({
        id: 'onering-live',
        driver: driver.id,
        model: 'gpt-5.3-codex',
        reasoning: { effort: 'low' },
        driverConfig: { source: { type: 'factory', name: 'live' } },
      }).openSession({
        context: { userId: 'live-test-user' },
        policy: localPolicy(),
        observation: { mode: 'live', detail: 'reasoning' },
        controlMode: 'observe-only',
      });
      const run = await session.run(
        'Call runtime_live_probe exactly once. After receiving its result, return JSON with marker ONERING_LIVE_OK.',
        {
          model: 'gpt-5.3-codex',
          reasoning: { effort: 'low' },
          responseFormat: {
            type: 'json_schema',
            name: 'onering_live_result',
            strict: true,
            schema: {
              type: 'object',
              properties: { marker: { type: 'string', enum: ['ONERING_LIVE_OK'] } },
              required: ['marker'],
              additionalProperties: false,
            },
          },
        },
      );
      const observation = observeDuringRun(run, ['tool.started', 'tool.progress', 'tool.completed']);
      const result = await run.result;
      const { events, sawActivityBeforeResult } = await observation;

      expect(result.status).toBe('completed');
      expect(result.outputParsed).toEqual({ marker: 'ONERING_LIVE_OK' });
      expect(result.configuration).toEqual({ model: 'gpt-5.3-codex', reasoning: { effort: 'low' } });
      expect(probeCalls).toBe(1);
      expect(events.some((event) => event.type === 'tool.completed')).toBe(true);
      expect(sawActivityBeforeResult).toBe(true);
    } finally {
      await runtime.destroy();
    }
  }, 180_000);

  it('executes a real Codex SDK task and keeps its API key out of the agent shell', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'oneringai-codex-live-'));
    temporaryDirectories.push(workspace);
    const driver = new CodexSdkDriver();
    const runtime = new AgentRuntime({ backend: new LocalExecutionBackend({ drivers: [driver] }) });
    try {
      const session = await runtime.agent({
        id: 'codex-live',
        driver: driver.id,
        connector: connectorName,
        model: 'gpt-5.3-codex',
        reasoning: { effort: 'low' },
        instructions: 'Follow the requested verification exactly. Never print environment-variable values.',
        driverConfig: { skipGitRepoCheck: true },
      }).openSession({
        context: { tenantId: 'live-test', userId: 'live-test-user' },
        workspace: { type: 'local-directory', path: workspace },
        policy: localPolicy(),
        observation: { mode: 'live', detail: 'reasoning' },
        controlMode: 'observe-only',
      });
      const schema = {
        type: 'object',
        properties: {
          marker: { type: 'string', enum: ['CODEX_LIVE_OK'] },
          credentialVisible: { type: 'boolean' },
        },
        required: ['marker', 'credentialVisible'],
        additionalProperties: false,
      };
      const run = await session.run(
        'Use a shell command that only tests whether CODEX_API_KEY is set; do not print its value. Return marker CODEX_LIVE_OK and credentialVisible=false when it is absent from the command environment.',
        {
          model: 'gpt-5.3-codex',
          reasoning: { effort: 'low' },
          responseFormat: { type: 'json_schema', name: 'live_result', strict: true, schema },
        },
      );
      const observation = observeDuringRun(run, ['command.started', 'command.output.delta', 'command.completed']);
      const result = await run.result;
      const { events, sawActivityBeforeResult } = await observation;

      expect(result.status).toBe('completed');
      expect(result.outputParsed).toEqual({ marker: 'CODEX_LIVE_OK', credentialVisible: false });
      expect(result.configuration).toEqual({ model: 'gpt-5.3-codex', reasoning: { effort: 'low' } });
      expect(events.some((event) => event.type === 'command.completed')).toBe(true);
      expect(sawActivityBeforeResult).toBe(true);
      const serialized = JSON.stringify({ result, events });
      if (serialized.includes(process.env.OPENAI_API_KEY!)) {
        throw new Error('Codex runtime result or normalized events exposed the OpenAI credential');
      }

      const continued = await session.run(
        'Continue this same thread and answer with the exact marker CODEX_CONTINUE_OK.',
        { model: 'gpt-5.3-codex', reasoning: { effort: 'low' } },
      );
      const continuedResult = await continued.result;
      expect(continuedResult.status).toBe('completed');
      expect(continuedResult.outputText).toContain('CODEX_CONTINUE_OK');
    } finally {
      await runtime.destroy();
    }
  }, 180_000);
});

function localPolicy() {
  return {
    filesystem: 'workspace-write' as const,
    commands: 'sandboxed' as const,
    sandboxNetwork: 'denied' as const,
    providerWebSearch: 'denied' as const,
    approvals: 'deny' as const,
    limits: {
      wallTimeMs: 150_000,
      eventBufferBytes: 2 * 1024 * 1024,
      outputBytes: 256 * 1024,
      artifactBytes: 256 * 1024,
    },
  };
}

async function observeDuringRun(
  run: AgentRun,
  activityTypes: AgentRunEventType[],
): Promise<{ events: AgentRunEvent[]; sawActivityBeforeResult: boolean }> {
  let resultSettled = false;
  void run.result.finally(() => { resultSettled = true; });
  let sawActivityBeforeResult = false;
  const events: AgentRunEvent[] = [];
  for await (const event of run.events()) {
    events.push(event);
    if (!resultSettled && activityTypes.includes(event.type)) sawActivityBeforeResult = true;
  }
  return { events, sawActivityBeforeResult };
}
