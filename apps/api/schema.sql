-- OneRingAI API — Full D1 Schema
-- Run: wrangler d1 execute oneringai-db --local --file=schema.sql

-- ============ Users & Auth ============

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ============ Token Balance & Billing ============

CREATE TABLE IF NOT EXISTS token_balances (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_balance INTEGER NOT NULL DEFAULT 500,
  lifetime_granted INTEGER NOT NULL DEFAULT 500,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start DATETIME,
  current_period_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS token_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('grant', 'usage', 'purchase', 'adjustment', 'refund')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON token_transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON token_transactions(created_at);

-- ============ Model Registry ============

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Context window
  max_input_tokens INTEGER NOT NULL,
  max_output_tokens INTEGER NOT NULL,

  -- Vendor pricing (cost per million tokens, in USD)
  vendor_input_cpm REAL NOT NULL,
  vendor_output_cpm REAL NOT NULL,
  vendor_input_cpm_cached REAL,

  -- Platform pricing (our token cost — what we charge users)
  platform_input_tpm INTEGER,
  platform_output_tpm INTEGER,
  platform_fixed_cost INTEGER,

  -- Features (JSON)
  features TEXT NOT NULL DEFAULT '{}',

  -- Metadata
  release_date TEXT,
  knowledge_cutoff TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_models_vendor ON models(vendor);
CREATE INDEX IF NOT EXISTS idx_models_active ON models(is_active);

-- ============ Service Configuration ============

CREATE TABLE IF NOT EXISTS service_overrides (
  service_id TEXT PRIMARY KEY,
  display_name TEXT,
  is_enabled INTEGER DEFAULT 1,
  platform_key_enabled INTEGER DEFAULT 0,

  -- Metering config (JSON): { usagePath, modelPath, inputTokensPath, outputTokensPath }
  metering_config TEXT DEFAULT '{}',

  -- Pricing multiplier (applied to vendor cost when no platform_*_tpm set)
  pricing_multiplier REAL DEFAULT 2.0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_services (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'bearer' CHECK (auth_type IN ('bearer', 'api_key', 'basic', 'header', 'query')),
  auth_config TEXT DEFAULT '{}',
  metering_config TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_custom_services_user ON custom_services(user_id);

-- ============ User Credentials ============

CREATE TABLE IF NOT EXISTS user_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  label TEXT,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, service_id, label)
);
CREATE INDEX IF NOT EXISTS idx_credentials_user ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_service ON user_credentials(user_id, service_id);

-- ============ Usage Logging ============

CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  token_cost INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  status_code INTEGER,
  credential_type TEXT CHECK (credential_type IN ('platform', 'user', 'custom')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_service ON usage_log(service_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at);

-- ============ Admin ============

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at);

CREATE TABLE IF NOT EXISTS custom_pricing (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  platform_input_tpm INTEGER,
  platform_output_tpm INTEGER,
  platform_fixed_cost INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, model)
);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_user ON custom_pricing(user_id);
