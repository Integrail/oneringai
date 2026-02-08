/**
 * Analytics service — aggregation queries for admin dashboard
 */
import { queryAll } from '../db/queries.js';

export interface PlatformOverview {
  totalUsers: number;
  activeUsers: number;
  totalTokensUsed: number;
  totalTokensGranted: number;
  totalRequests: number;
  requestsToday: number;
}

export async function getPlatformOverview(db: D1Database): Promise<PlatformOverview> {
  const results = await db.batch([
    db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').bind('active'),
    db.prepare('SELECT COUNT(*) as count FROM users'),
    db.prepare('SELECT COALESCE(SUM(lifetime_used), 0) as total FROM token_balances'),
    db.prepare('SELECT COALESCE(SUM(lifetime_granted), 0) as total FROM token_balances'),
    db.prepare('SELECT COUNT(*) as count FROM usage_log'),
    db.prepare("SELECT COUNT(*) as count FROM usage_log WHERE created_at >= date('now')"),
  ]);

  return {
    activeUsers: (results[0]?.results?.[0] as { count: number } | undefined)?.count ?? 0,
    totalUsers: (results[1]?.results?.[0] as { count: number } | undefined)?.count ?? 0,
    totalTokensUsed: (results[2]?.results?.[0] as { total: number } | undefined)?.total ?? 0,
    totalTokensGranted: (results[3]?.results?.[0] as { total: number } | undefined)?.total ?? 0,
    totalRequests: (results[4]?.results?.[0] as { count: number } | undefined)?.count ?? 0,
    requestsToday: (results[5]?.results?.[0] as { count: number } | undefined)?.count ?? 0,
  };
}

export interface UsageByService {
  serviceId: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokenCost: number;
}

export async function getUsageByService(
  db: D1Database,
  days: number = 30,
): Promise<UsageByService[]> {
  return queryAll(
    db,
    `SELECT service_id as serviceId,
            COUNT(*) as requestCount,
            COALESCE(SUM(input_tokens), 0) as totalInputTokens,
            COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
            COALESCE(SUM(token_cost), 0) as totalTokenCost
     FROM usage_log
     WHERE created_at >= date('now', '-' || ? || ' days')
     GROUP BY service_id
     ORDER BY totalTokenCost DESC`,
    days,
  );
}

export interface UsageByUser {
  userId: string;
  email: string;
  requestCount: number;
  totalTokenCost: number;
}

export async function getTopUsers(
  db: D1Database,
  limit: number = 20,
  days: number = 30,
): Promise<UsageByUser[]> {
  return queryAll(
    db,
    `SELECT u.user_id as userId, users.email,
            COUNT(*) as requestCount,
            COALESCE(SUM(u.token_cost), 0) as totalTokenCost
     FROM usage_log u
     JOIN users ON users.id = u.user_id
     WHERE u.created_at >= date('now', '-' || ? || ' days')
     GROUP BY u.user_id
     ORDER BY totalTokenCost DESC
     LIMIT ?`,
    days, limit,
  );
}

export interface DailyUsage {
  date: string;
  requestCount: number;
  totalTokenCost: number;
}

export async function getDailyUsage(
  db: D1Database,
  days: number = 30,
): Promise<DailyUsage[]> {
  return queryAll(
    db,
    `SELECT date(created_at) as date,
            COUNT(*) as requestCount,
            COALESCE(SUM(token_cost), 0) as totalTokenCost
     FROM usage_log
     WHERE created_at >= date('now', '-' || ? || ' days')
     GROUP BY date(created_at)
     ORDER BY date ASC`,
    days,
  );
}
