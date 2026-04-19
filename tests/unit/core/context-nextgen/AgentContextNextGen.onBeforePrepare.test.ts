/**
 * AgentContextNextGen — onBeforePrepare hook dispatch.
 *
 * Verifies:
 *   - Sync throws from the hook are caught and logged, prepare() completes.
 *   - Async rejections from the hook are caught (M-3 fix) and logged.
 *   - Hook receives a snapshot of messages + currentInput.
 */

import { describe, it, expect, vi } from 'vitest';
import { AgentContextNextGen } from '@/core/context-nextgen/AgentContextNextGen.js';
import type { IContextPluginNextGen } from '@/core/context-nextgen/types.js';
import type { ToolFunction } from '@/domain/entities/Tool.js';

function makeSideEffectPlugin(
  name: string,
  behavior: () => void | Promise<void>,
): IContextPluginNextGen {
  return {
    name,
    getInstructions: () => null,
    getContent: async () => null,
    getContents: () => ({}),
    getTokenSize: () => 0,
    getInstructionsTokenSize: () => 0,
    isCompactable: () => false,
    compact: async () => 0,
    getTools: () => [] as ToolFunction[],
    destroy: () => {},
    getState: () => ({}),
    restoreState: () => {},
    onBeforePrepare: (snapshot) => behavior() as unknown as void,
  };
}

describe('AgentContextNextGen.prepare() — onBeforePrepare dispatch', () => {
  it('catches sync throws from the hook — prepare still completes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = new AgentContextNextGen({ agentId: 'test' });
    const plugin = makeSideEffectPlugin('throwy-sync', () => {
      throw new Error('sync boom');
    });
    ctx.registerPlugin(plugin);
    ctx.addUserMessage([{ type: 'input_text', text: 'hi' }]);
    const prepared = await ctx.prepare();
    expect(prepared).toBeDefined();
    // The warn captured the throw.
    const warns = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
    expect(warns.some((w) => w.includes('throwy-sync'))).toBe(true);
    warnSpy.mockRestore();
    ctx.destroy();
  });

  it('catches ASYNC rejections from the hook — prepare still completes (M-3)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = new AgentContextNextGen({ agentId: 'test' });
    const plugin: IContextPluginNextGen = {
      name: 'throwy-async',
      getInstructions: () => null,
      getContent: async () => null,
      getContents: () => ({}),
      getTokenSize: () => 0,
      getInstructionsTokenSize: () => 0,
      isCompactable: () => false,
      compact: async () => 0,
      getTools: () => [],
      destroy: () => {},
      getState: () => ({}),
      restoreState: () => {},
      // Declared as `void` but returning a rejecting Promise — same shape as
      // `async onBeforePrepare()` that throws asynchronously.
      onBeforePrepare: (_s) =>
        Promise.reject(new Error('async boom')) as unknown as void,
    };
    ctx.registerPlugin(plugin);
    ctx.addUserMessage([{ type: 'input_text', text: 'hi' }]);
    const prepared = await ctx.prepare();
    expect(prepared).toBeDefined();
    // Give the microtask queue a chance to surface the async rejection log.
    await new Promise((r) => setTimeout(r, 5));
    const warns = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
    expect(warns.some((w) => w.includes('throwy-async') && w.includes('asynchronously'))).toBe(true);
    warnSpy.mockRestore();
    ctx.destroy();
  });

  it('passes the current conversation + current input as a snapshot', async () => {
    const ctx = new AgentContextNextGen({ agentId: 'test' });
    let capturedMessagesLen = -1;
    let capturedInputLen = -1;
    ctx.registerPlugin({
      name: 'observer',
      getInstructions: () => null,
      getContent: async () => null,
      getContents: () => ({}),
      getTokenSize: () => 0,
      getInstructionsTokenSize: () => 0,
      isCompactable: () => false,
      compact: async () => 0,
      getTools: () => [],
      destroy: () => {},
      getState: () => ({}),
      restoreState: () => {},
      onBeforePrepare: (snapshot) => {
        capturedMessagesLen = snapshot.messages.length;
        capturedInputLen = snapshot.currentInput.length;
      },
    });
    ctx.addUserMessage([{ type: 'input_text', text: 'first' }]);
    await ctx.prepare();
    // Before any assistant response, _conversation is empty; currentInput has 1.
    expect(capturedMessagesLen).toBe(0);
    expect(capturedInputLen).toBe(1);
    ctx.destroy();
  });
});
