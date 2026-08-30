/** Normalize source paths so generated hashes do not depend on the host OS. */
export function normalizeRegistrySourcePath(path: string): string {
  return path.replaceAll('\\', '/');
}

/** Normalize checkout line endings without changing executable source text. */
export function normalizeRegistrySourceText(source: string): string {
  return source.replace(/\r\n?/g, '\n');
}

/** Build one unambiguous, platform-independent source entry for hashing. */
export function createRegistrySourceHashChunk(path: string, source: string): string {
  return `${normalizeRegistrySourcePath(path)}\0${normalizeRegistrySourceText(source)}\0`;
}
