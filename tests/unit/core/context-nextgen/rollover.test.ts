import { describe, expect, it, vi } from 'vitest';
import { AgentContextNextGen } from '@/core/context-nextgen/AgentContextNextGen.js';
import { ContentType } from '@/domain/entities/Content.js';
import { MessageRole } from '@/domain/entities/Message.js';
import type { InputItem, Message, OutputItem } from '@/domain/entities/Message.js';

function assistant(text: string): OutputItem[] {
  return [{
    type: 'message',
    role: MessageRole.ASSISTANT,
    content: [{ type: ContentType.OUTPUT_TEXT, text }],
  } as Message];
}

function addTurn(context: AgentContextNextGen, user: string, reply: string): void {
  context.addUserMessage(user);
  context.addAssistantResponse(assistant(reply));
}

function createContext(): AgentContextNextGen {
  return AgentContextNextGen.create({
    model: 'gpt-4.1',
    maxContextTokens: 128_000,
    features: { workingMemory: false, inContextMemory: false },
  });
}

describe('AgentContextNextGen.rollover()', () => {
  it('forces rollover below compaction thresholds and retains recent turns exactly', async () => {
    const context = createContext();
    addTurn(context, 'Question 1', 'Answer 1');
    addTurn(context, 'Question 2', 'Answer 2');
    addTurn(context, 'Question 3', 'Answer 3');
    addTurn(context, 'Question 4', 'Answer 4');
    const before = [...context.getConversation()];
    const summarize = vi.fn(async () => 'Questions 1 and 2 were resolved.');
    const rolledOver = vi.fn();
    context.on('context:rolled_over', rolledOver);

    const result = await context.rollover({
      preserveRecentTurns: 2,
      summarize,
      reason: 'provider-session-limit',
    });

    expect(result.performed).toBe(true);
    expect(result.itemsSummarized).toBe(4);
    expect(result.retainedTurns).toBe(2);
    expect(summarize).toHaveBeenCalledOnce();
    expect(summarize.mock.calls[0]![0].items).toEqual(before.slice(0, 4));

    const after = context.getConversation();
    expect(after).toHaveLength(5);
    expect(after.slice(1)).toEqual(before.slice(4));
    expect(after.slice(1).every((item, index) => item === before[index + 4])).toBe(true);
    expect(after[0]).toMatchObject({
      type: 'message',
      role: MessageRole.DEVELOPER,
    });
    expect(JSON.stringify(after[0])).toContain('Questions 1 and 2 were resolved.');
    expect(rolledOver).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ performed: true, retainedTurns: 2 }),
    }));
    context.destroy();
  });

  it('does not call the summarizer when all turns fit in the exact tail', async () => {
    const context = createContext();
    addTurn(context, 'Question 1', 'Answer 1');
    const before = [...context.getConversation()];
    const summarize = vi.fn(async () => 'unused');

    const result = await context.rollover({ preserveRecentTurns: 8, summarize });

    expect(result.performed).toBe(false);
    expect(summarize).not.toHaveBeenCalled();
    expect(context.getConversation()).toEqual(before);
    context.destroy();
  });

  it('preserves complete tool-call pairs in the exact retained turn', async () => {
    const context = createContext();
    addTurn(context, 'Old question', 'Old answer');
    context.addUserMessage('Use the lookup tool');
    context.addAssistantResponse([{
      type: 'message',
      role: MessageRole.ASSISTANT,
      content: [{
        type: ContentType.TOOL_USE,
        id: 'call_1',
        name: 'lookup',
        arguments: '{"id":1}',
      }],
    } as Message]);
    context.addToolResults([{ tool_use_id: 'call_1', content: 'result 1' }]);
    context.addAssistantResponse(assistant('Lookup completed'));
    const exactTurn = [...context.getConversation()].slice(2);

    await context.rollover({
      preserveRecentTurns: 1,
      summarize: async () => 'The old question was answered.',
    });

    const after = context.getConversation();
    expect(after.slice(1)).toEqual(exactTurn);
    expect(JSON.stringify(after)).toContain('"id":"call_1"');
    expect(JSON.stringify(after)).toContain('"tool_use_id":"call_1"');
    context.destroy();
  });

  it('is atomic on summarizer failure and passes a detached snapshot', async () => {
    const context = createContext();
    addTurn(context, 'Question 1', 'Answer 1');
    addTurn(context, 'Question 2', 'Answer 2');
    const before = structuredClone(context.getConversation()) as InputItem[];

    await expect(context.rollover({
      preserveRecentTurns: 1,
      summarize: async ({ items }) => {
        const first = items[0] as Message;
        first.content = [{ type: ContentType.INPUT_TEXT, text: 'mutated clone' }];
        throw new Error('summarizer unavailable');
      },
    })).rejects.toThrow('summarizer unavailable');

    expect(context.getConversation()).toEqual(before);
    context.destroy();
  });

  it('rejects rollover while a turn has pending input', async () => {
    const context = createContext();
    context.addUserMessage('Still active');
    const summarize = vi.fn(async () => 'unused');

    await expect(context.rollover({ summarize })).rejects.toThrow(
      'finish the active turn first',
    );
    expect(summarize).not.toHaveBeenCalled();
    context.destroy();
  });

  it('rejects overlapping rollovers without corrupting the first operation', async () => {
    const context = createContext();
    addTurn(context, 'Question 1', 'Answer 1');
    let releaseSummary!: (summary: string) => void;
    const pending = context.rollover({
      preserveRecentTurns: 0,
      summarize: () => new Promise<string>((resolve) => {
        releaseSummary = resolve;
      }),
    });
    await vi.waitFor(() => expect(releaseSummary).toBeTypeOf('function'));

    await expect(context.rollover({
      preserveRecentTurns: 0,
      summarize: async () => 'second',
    })).rejects.toThrow('already in progress');

    releaseSummary('first summary');
    await expect(pending).resolves.toMatchObject({ performed: true });
    expect(JSON.stringify(context.getConversation())).toContain('first summary');
    context.destroy();
  });

  it('leaves plugin state untouched', async () => {
    const context = AgentContextNextGen.create({
      model: 'gpt-4.1',
      features: { workingMemory: true, inContextMemory: true },
    });
    const memory = context.memory!;
    await memory.store('decision', 'Important decision', 'Keep this state', {
      priority: 'high',
    });
    addTurn(context, 'Question 1', 'Answer 1');
    addTurn(context, 'Question 2', 'Answer 2');
    const pluginStates = structuredClone(context.getState().pluginStates);

    await context.rollover({
      preserveRecentTurns: 1,
      summarize: async () => 'Question 1 was answered.',
    });

    expect(context.getState().pluginStates).toEqual(pluginStates);
    context.destroy();
  });
});
