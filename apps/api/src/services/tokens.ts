/**
 * Token balance service — deduct, grant, check
 */
import type { TokenBalance, TokenTransaction } from '../types.js';
import { queryOne, queryAll } from '../db/queries.js';

/** Get current balance for a user */
export async function getBalance(db: D1Database, userId: string): Promise<TokenBalance | null> {
  return queryOne<TokenBalance>(db, 'SELECT * FROM token_balances WHERE user_id = ?', userId);
}

/** Check if user has sufficient balance */
export async function hasBalance(db: D1Database, userId: string, amount: number): Promise<boolean> {
  const balance = await getBalance(db, userId);
  return balance !== null && balance.current_balance >= amount;
}

/**
 * Deduct tokens atomically.
 * Returns the new balance, or null if insufficient funds.
 */
export async function deductTokens(
  db: D1Database,
  userId: string,
  amount: number,
  description: string,
  referenceId?: string,
): Promise<number | null> {
  const txnId = crypto.randomUUID();

  // Atomic: read balance, check, deduct, log — all in one batch
  const results = await db.batch([
    db.prepare('SELECT current_balance FROM token_balances WHERE user_id = ?').bind(userId),
    db.prepare(
      `UPDATE token_balances
       SET current_balance = current_balance - ?,
           lifetime_used = lifetime_used + ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND current_balance >= ?`,
    ).bind(amount, amount, userId, amount),
    db.prepare('SELECT current_balance FROM token_balances WHERE user_id = ?').bind(userId),
  ]);

  const afterRow = results[2]?.results?.[0] as { current_balance: number } | undefined;
  const updateMeta = results[1]?.meta;

  if (!updateMeta || (updateMeta.changes ?? 0) === 0) {
    return null; // Insufficient balance
  }

  const newBalance = afterRow?.current_balance ?? 0;

  // Log the transaction (separate — deduction already committed)
  await db.prepare(
    `INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, reference_id)
     VALUES (?, ?, 'usage', ?, ?, ?, ?)`,
  ).bind(txnId, userId, -amount, newBalance, description, referenceId ?? null).run();

  return newBalance;
}

/**
 * Grant tokens to a user (subscription, purchase, admin adjustment)
 */
export async function grantTokens(
  db: D1Database,
  userId: string,
  amount: number,
  type: 'grant' | 'purchase' | 'adjustment' | 'refund',
  description: string,
  referenceId?: string,
): Promise<number> {
  const txnId = crypto.randomUUID();

  const results = await db.batch([
    db.prepare(
      `UPDATE token_balances
       SET current_balance = current_balance + ?,
           lifetime_granted = lifetime_granted + ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
    ).bind(amount, amount, userId),
    db.prepare('SELECT current_balance FROM token_balances WHERE user_id = ?').bind(userId),
  ]);

  const row = results[1]?.results?.[0] as { current_balance: number } | undefined;
  const newBalance = row?.current_balance ?? amount;

  await db.prepare(
    `INSERT INTO token_transactions (id, user_id, type, amount, balance_after, description, reference_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(txnId, userId, type, amount, newBalance, description, referenceId ?? null).run();

  return newBalance;
}

/** Get transaction history */
export async function getTransactions(
  db: D1Database,
  userId: string,
  options: { limit?: number; offset?: number; type?: string } = {},
): Promise<TokenTransaction[]> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  if (options.type) {
    return queryAll<TokenTransaction>(
      db,
      'SELECT * FROM token_transactions WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      userId, options.type, limit, offset,
    );
  }

  return queryAll<TokenTransaction>(
    db,
    'SELECT * FROM token_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    userId, limit, offset,
  );
}
