/**
 * Admin routes — barrel with requireAdmin applied
 */
import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { requireAuth } from '../../middleware/jwt.js';
import { requireAdmin } from '../../middleware/adminAuth.js';
import { adminUsers } from './users.js';
import { adminTokens } from './tokens.js';
import { adminSubscriptions } from './subscriptions.js';
import { adminModels } from './models.js';
import { adminPricing } from './pricing.js';
import { adminAnalytics } from './analytics.js';
import { adminServices } from './services.js';
import { adminCredentials } from './credentials.js';
import { adminAudit } from './audit.js';

const admin = new Hono<{ Bindings: Env }>();

// All admin routes require auth + admin role
admin.use('*', requireAuth);
admin.use('*', requireAdmin);

admin.route('/users', adminUsers);
admin.route('/tokens', adminTokens);
admin.route('/subscriptions', adminSubscriptions);
admin.route('/models', adminModels);
admin.route('/pricing', adminPricing);
admin.route('/analytics', adminAnalytics);
admin.route('/services', adminServices);
admin.route('/credentials', adminCredentials);
admin.route('/audit', adminAudit);

export { admin };
