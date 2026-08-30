import { describe, expect, it } from 'vitest';
import {
  createRegistrySourceHashChunk,
  normalizeRegistrySourcePath,
  normalizeRegistrySourceText,
} from '../../../scripts/tool-registry-hash.js';

describe('tool registry hash canonicalization', () => {
  it('normalizes Windows paths and checkout line endings', () => {
    expect(normalizeRegistrySourcePath('tools\\code\\executeJavaScript.ts'))
      .toBe('tools/code/executeJavaScript.ts');
    expect(normalizeRegistrySourceText('first\r\nsecond\rthird\n'))
      .toBe('first\nsecond\nthird\n');
  });

  it('produces the same hash chunk for equivalent Windows and Unix sources', () => {
    const windows = createRegistrySourceHashChunk(
      'tools\\code\\executeJavaScript.ts',
      'const first = 1;\r\nconst second = 2;\r\n',
    );
    const unix = createRegistrySourceHashChunk(
      'tools/code/executeJavaScript.ts',
      'const first = 1;\nconst second = 2;\n',
    );

    expect(windows).toBe(unix);
  });
});
