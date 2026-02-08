/**
 * Admin audit log — view admin action history
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { queryAll } from '../../db/queries.js';

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  created_at: string;
}

const adminAudit = new Hono<{ Bindings: Env }>();

/** GET /admin/audit — list audit log entries */
adminAudit.get('/', async (c) => {
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const action = c.req.query('action');

  let entries: AuditLogEntry[];
  if (action) {
    entries = await queryAll<AuditLogEntry>(
      c.env.DB,
      `SELECT a.*, u.email as admin_email
       FROM admin_audit_log a JOIN users u ON u.id = a.admin_id
       WHERE a.action LIKE ?
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      `%${action}%`, limit, offset,
    );
  } else {
    entries = await queryAll<AuditLogEntry>(
      c.env.DB,
      `SELECT a.*, u.email as admin_email
       FROM admin_audit_log a JOIN users u ON u.id = a.admin_id
       ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      limit, offset,
    );
  }

  return c.json(entries.map((e) => ({
    ...e,
    details: e.details ? JSON.parse(e.details) : null,
  })));
});

export { adminAudit };
