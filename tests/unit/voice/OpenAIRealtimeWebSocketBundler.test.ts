import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('OpenAI Realtime default WebSocket transport', () => {
  it('uses the portable masker when a bundler stubs the optional bufferutil module', async () => {
    const fixture = fileURLToPath(new URL('../../fixtures/realtime/ws-bundler-stub.ts', import.meta.url));
    const env = { ...process.env };
    delete env.WS_NO_BUFFER_UTIL;

    const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', fixture], {
        cwd: process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Bundler regression fixture did not exit:\n${output}`));
      }, 15_000);
      child.stdout.on('data', (chunk) => { output += chunk.toString(); });
      child.stderr.on('data', (chunk) => { output += chunk.toString(); });
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code, output });
      });
    });

    expect(result.code, result.output).toBe(0);
  }, 20_000);
});
