/**
 * Audit log middleware — records admin actions
 */
import { execute } from '../db/queries.js';

export async function logAdminAction(
  db: D1Database,
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  const id = crypto.randomUUID();
  await execute(
    db,
    'INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?)',
    id, adminId, action, targetType, targetId, details ? JSON.stringify(details) : null,
  );
}
