/**
 * Wrapper for dynamic import of optional peer dependencies.
 * Uses indirect evaluation so downstream bundlers (webpack, rspack)
 * cannot statically resolve the module specifier from dist output.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importOptional<T = any>(specifier: string): Promise<T> {
  // eslint-disable-next-line no-new-func
  return new Function('s', 'return import(s)')(specifier) as Promise<T>;
}
