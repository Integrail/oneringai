/**
 * User CRUD service
 */
import type { User } from '../types.js';
import { queryOne, queryAll, execute } from '../db/queries.js';

export async function getUserById(db: D1Database, id: string): Promise<Omit<User, 'password_hash' | 'password_salt'> | null> {
  return queryOne(
    db,
    'SELECT id, email, role, status, name, created_at, updated_at FROM users WHERE id = ?',
    id,
  );
}

export async function getUserByEmail(db: D1Database, email: string): Promise<Omit<User, 'password_hash' | 'password_salt'> | null> {
  return queryOne(
    db,
    'SELECT id, email, role, status, name, created_at, updated_at FROM users WHERE email = ?',
    email.toLowerCase(),
  );
}

export async function listUsers(
  db: D1Database,
  options: { limit?: number; offset?: number; status?: string } = {},
): Promise<Omit<User, 'password_hash' | 'password_salt'>[]> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  if (options.status) {
    return queryAll(
      db,
      'SELECT id, email, role, status, name, created_at, updated_at FROM users WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      options.status, limit, offset,
    );
  }

  return queryAll(
    db,
    'SELECT id, email, role, status, name, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
    limit, offset,
  );
}

export async function updateUser(
  db: D1Database,
  id: string,
  updates: { role?: string; status?: string; name?: string },
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.role !== undefined) { sets.push('role = ?'); values.push(updates.role); }
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }

  if (sets.length === 0) return false;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const result = await execute(db, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...values);
  return (result.meta?.changes ?? 0) > 0;
}
