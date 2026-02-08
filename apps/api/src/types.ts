/**
 * API-specific types
 */

export interface JWTPayload {
  sub: string; // user ID
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  iat: number;
  exp: number;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'deleted';
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenBalance {
  user_id: string;
  current_balance: number;
  lifetime_granted: number;
  lifetime_used: number;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  type: 'grant' | 'usage' | 'purchase' | 'adjustment' | 'refund';
  amount: number;
  balance_after: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface ModelRow {
  id: string;
  vendor: string;
  name: string;
  description: string | null;
  max_input_tokens: number;
  max_output_tokens: number;
  vendor_input_cpm: number;
  vendor_output_cpm: number;
  vendor_input_cpm_cached: number | null;
  platform_input_tpm: number | null;
  platform_output_tpm: number | null;
  platform_fixed_cost: number | null;
  features: string;
  release_date: string | null;
  knowledge_cutoff: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceOverride {
  service_id: string;
  display_name: string | null;
  is_enabled: number;
  platform_key_enabled: number;
  metering_config: string;
  pricing_multiplier: number;
  created_at: string;
  updated_at: string;
}

export interface UserCredential {
  id: string;
  user_id: string;
  service_id: string;
  label: string | null;
  encrypted_key: string;
  iv: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface UsageLogEntry {
  id: string;
  user_id: string;
  service_id: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  token_cost: number;
  latency_ms: number | null;
  status_code: number | null;
  credential_type: 'platform' | 'user' | 'custom' | null;
  created_at: string;
}

export interface CustomService {
  id: string;
  user_id: string;
  name: string;
  base_url: string;
  auth_type: 'bearer' | 'api_key' | 'basic' | 'header' | 'query';
  auth_config: string;
  metering_config: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

/** API error response */
export interface ApiError {
  error: string;
  message: string;
  status: number;
}

/** Resolved service for proxy */
export interface ResolvedService {
  id: string;
  name: string;
  baseURL: string;
  authType: string;
  authConfig: Record<string, unknown>;
  meteringConfig: Record<string, unknown>;
  pricingMultiplier: number;
  platformKeyEnabled: boolean;
  source: 'custom' | 'override' | 'library';
}
