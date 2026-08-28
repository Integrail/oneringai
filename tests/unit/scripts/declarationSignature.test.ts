import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import {
  getDeclarationSignature,
  hasPrivateModifier,
} from '../../../scripts/declarationSignature.js';

describe('getDeclarationSignature', () => {
  it('preserves object defaults and inline object parameter types', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile('fixture.ts', `
      class Fixture {
        async defaulted(options: { enabled?: boolean } = {}): Promise<void> {}
      }

      function defaulted(result: { status?: string } = {}): string {
        return result.status ?? 'ok';
      }
    `);

    const method = source.getClassOrThrow('Fixture').getMethodOrThrow('defaulted');
    const fn = source.getFunctionOrThrow('defaulted');

    expect(getDeclarationSignature(method)).toBe(
      'async defaulted(options: { enabled?: boolean } = {}): Promise<void>',
    );
    expect(getDeclarationSignature(fn)).toBe(
      'function defaulted(result: { status?: string } = {}): string',
    );
  });

  it('identifies private constructors, methods, and properties', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile('visibility.ts', `
      class Fixture {
        private constructor() {}
        private hiddenMethod(): void {}
        private hiddenProperty = true;
        visibleProperty = true;
      }
    `);
    const fixture = source.getClassOrThrow('Fixture');

    expect(hasPrivateModifier(fixture.getConstructors()[0]!)).toBe(true);
    expect(hasPrivateModifier(fixture.getMethodOrThrow('hiddenMethod'))).toBe(true);
    expect(hasPrivateModifier(fixture.getPropertyOrThrow('hiddenProperty'))).toBe(true);
    expect(hasPrivateModifier(fixture.getPropertyOrThrow('visibleProperty'))).toBe(false);
  });
});
