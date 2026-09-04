import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AstraCommand } from '../../../../apps/amos/src/commands/commands/AstraCommand.js';
import {
  DEFAULT_CONFIG,
  type CommandContext,
  type IAgentRunner,
  type IAmosApp,
} from '../../../../apps/amos/src/config/types.js';

describe('AstraCommand reasoning continuation', () => {
  let command: AstraCommand;
  let app: IAmosApp;
  let runner: IAgentRunner;
  const runAstraDirect = vi.fn();

  beforeEach(() => {
    command = new AstraCommand();
    runAstraDirect.mockReset();
    runner = {
      isReady: () => true,
      getReasoningEffort: () => 'medium',
      runAstraDirect,
    } as unknown as IAgentRunner;
    const config = structuredClone(DEFAULT_CONFIG);
    config.activeConnector = 'openai-main';
    config.activeVendor = 'openai';
    config.activeModel = 'gpt-6-astra';
    app = {
      getConfig: () => config,
      getAgent: () => runner,
      getConnectorManager: () => ({
        get: () => ({ name: 'openai-main', vendor: 'openai' }),
      }),
    } as unknown as IAmosApp;
  });

  it('places configuration_update before the next user message', async () => {
    runAstraDirect
      .mockResolvedValueOnce({ responseId: 'resp_1', text: 'initial' })
      .mockResolvedValueOnce({ responseId: 'resp_2', text: 'continued' });

    await command.execute(context(['ask', 'Start', 'the', 'analysis']));
    const result = await command.execute(context([
      'reasoning',
      'high',
      'Now',
      'check',
      'edge',
      'cases',
    ]));

    expect(result.success).toBe(true);
    expect(runAstraDirect).toHaveBeenLastCalledWith([
      { type: 'configuration_update', reasoning: { effort: 'high' } },
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Now check edge cases' }],
      },
    ], { previousResponseId: 'resp_1' });
  });

  it('rejects reasoning efforts Astra does not support', async () => {
    const result = await command.execute(context([
      'reasoning',
      'minimal',
      'Continue',
    ]));

    expect(result.success).toBe(false);
    expect(result.message).toContain('low, medium, high, xhigh, max');
    expect(runAstraDirect).not.toHaveBeenCalled();
  });

  it('invalidates stored continuation state when the Agent is replaced', async () => {
    runAstraDirect.mockResolvedValueOnce({ responseId: 'resp_1', text: 'initial' });
    await command.execute(context(['ask', 'Start']));

    command.reset();
    const result = await command.execute(context(['reasoning', 'high', 'Continue']));

    expect(result.success).toBe(false);
    expect(result.message).toContain('/astra ask');
    expect(runAstraDirect).toHaveBeenCalledTimes(1);
  });

  function context(args: string[]): CommandContext {
    return { app, args, rawInput: `/astra ${args.join(' ')}` };
  }
});
