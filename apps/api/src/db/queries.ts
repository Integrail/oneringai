/**
 * Type-safe D1 query helpers
 */

/** Execute a query and return all rows */
export async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const result = params.length > 0 ? await stmt.bind(...params).all<T>() : await stmt.all<T>();
  return result.results ?? [];
}

/** Execute a query and return the first row */
export async function queryOne<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const result = params.length > 0 ? await stmt.bind(...params).first<T>() : await stmt.first<T>();
  return result ?? null;
}

/** Execute a write query (INSERT, UPDATE, DELETE) */
export async function execute(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  return params.length > 0 ? stmt.bind(...params).run() : stmt.run();
}
