import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { importPKCS8, SignJWT } from 'jose';
import * as fs9 from 'fs';
import { promises } from 'fs';
import EventEmitter, { EventEmitter as EventEmitter$2 } from 'eventemitter3';
import OpenAI2 from 'openai';
import * as path3 from 'path';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { EventEmitter as EventEmitter$1 } from 'events';
import * as fs8 from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { load } from 'cheerio';
import * as vm from 'vm';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/domain/entities/Memory.ts
var Memory_exports = {};
__export(Memory_exports, {
  DEFAULT_MEMORY_CONFIG: () => DEFAULT_MEMORY_CONFIG,
  calculateEntrySize: () => calculateEntrySize,
  createMemoryEntry: () => createMemoryEntry,
  formatMemoryIndex: () => formatMemoryIndex,
  formatSizeHuman: () => formatSizeHuman,
  validateMemoryKey: () => validateMemoryKey
});
function validateMemoryKey(key) {
  if (!key || key.length === 0) {
    throw new Error("Memory key cannot be empty");
  }
  if (key.startsWith(".") || key.endsWith(".") || key.includes("..")) {
    throw new Error("Invalid memory key format: keys cannot start/end with dots or contain consecutive dots");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    throw new Error("Invalid memory key format: only alphanumeric, dots, dashes, and underscores allowed");
  }
}
function calculateEntrySize(value) {
  if (value === void 0) {
    return 0;
  }
  const serialized = JSON.stringify(value);
  return serialized.length;
}
function createMemoryEntry(input, config = DEFAULT_MEMORY_CONFIG) {
  validateMemoryKey(input.key);
  if (input.description.length > config.descriptionMaxLength) {
    throw new Error(`Description exceeds maximum length of ${config.descriptionMaxLength} characters`);
  }
  const now = Date.now();
  const sizeBytes = calculateEntrySize(input.value);
  return {
    key: input.key,
    description: input.description,
    value: input.value,
    sizeBytes,
    scope: input.scope ?? "task",
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 0
  };
}
function formatSizeHuman(bytes) {
  if (bytes === 0) return "0B";
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (bytes < 1024 * 1024) {
    return `${kb.toFixed(1).replace(/\.0$/, "")}KB`;
  }
  const mb = bytes / (1024 * 1024);
  if (bytes < 1024 * 1024 * 1024) {
    return `${mb.toFixed(1).replace(/\.0$/, "")}MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1).replace(/\.0$/, "")}GB`;
}
function formatMemoryIndex(index) {
  const lines = [];
  const utilPercent = Number.isInteger(index.utilizationPercent) ? index.utilizationPercent.toString() : index.utilizationPercent.toFixed(1).replace(/\.0$/, "");
  lines.push(`## Working Memory (${index.totalSizeHuman} / ${index.limitHuman} - ${utilPercent}%)`);
  lines.push("");
  if (index.entries.length === 0) {
    lines.push("Memory is empty.");
  } else {
    const persistent = index.entries.filter((e) => e.scope === "persistent");
    const task = index.entries.filter((e) => e.scope === "task");
    if (persistent.length > 0) {
      lines.push("**Persistent:**");
      for (const entry of persistent) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [scope: persistent]`);
      }
      lines.push("");
    }
    if (task.length > 0) {
      lines.push("**Task-scoped:**");
      for (const entry of task) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [scope: task]`);
      }
      lines.push("");
    }
    if (index.utilizationPercent > 80) {
      lines.push("\u26A0\uFE0F **Warning:** Memory utilization is high. Consider deleting unused entries.");
      lines.push("");
    }
  }
  lines.push('Use `memory_retrieve("key")` to load full content.');
  lines.push('Use `memory_persist("key")` to keep data after task completion.');
  return lines.join("\n");
}
var DEFAULT_MEMORY_CONFIG;
var init_Memory = __esm({
  "src/domain/entities/Memory.ts"() {
    DEFAULT_MEMORY_CONFIG = {
      descriptionMaxLength: 150,
      softLimitPercent: 80,
      contextAllocationPercent: 20
    };
  }
});
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 16;
var SALT_LENGTH = 64;
var TAG_LENGTH = 16;
var KEY_LENGTH = 32;
function encrypt(text, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, 1e5, KEY_LENGTH, "sha512");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, "hex")]);
  return result.toString("base64");
}
function decrypt(encryptedData, password) {
  const buffer = Buffer.from(encryptedData, "base64");
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, 1e5, KEY_LENGTH, "sha512");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}
function getEncryptionKey() {
  if (process.env.OAUTH_ENCRYPTION_KEY) {
    return process.env.OAUTH_ENCRYPTION_KEY;
  }
  if (!global.__oauthEncryptionKey) {
    global.__oauthEncryptionKey = crypto.randomBytes(32).toString("hex");
    console.warn(
      "WARNING: Using auto-generated encryption key. Tokens will not persist across restarts. Set OAUTH_ENCRYPTION_KEY environment variable for production!"
    );
  }
  return global.__oauthEncryptionKey;
}
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString("hex");
}

// src/connectors/oauth/infrastructure/storage/MemoryStorage.ts
var MemoryStorage = class {
  tokens = /* @__PURE__ */ new Map();
  // Stores encrypted tokens
  async storeToken(key, token) {
    const encryptionKey = getEncryptionKey();
    const plaintext = JSON.stringify(token);
    const encrypted = encrypt(plaintext, encryptionKey);
    this.tokens.set(key, encrypted);
  }
  async getToken(key) {
    const encrypted = this.tokens.get(key);
    if (!encrypted) {
      return null;
    }
    try {
      const encryptionKey = getEncryptionKey();
      const decrypted = decrypt(encrypted, encryptionKey);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error("Failed to decrypt token from memory:", error);
      this.tokens.delete(key);
      return null;
    }
  }
  async deleteToken(key) {
    this.tokens.delete(key);
  }
  async hasToken(key) {
    return this.tokens.has(key);
  }
  /**
   * Clear all tokens (useful for testing)
   */
  clearAll() {
    this.tokens.clear();
  }
  /**
   * Get number of stored tokens
   */
  size() {
    return this.tokens.size;
  }
};

// src/connectors/oauth/domain/TokenStore.ts
var TokenStore = class {
  storage;
  baseStorageKey;
  constructor(storageKey = "default", storage) {
    this.baseStorageKey = storageKey;
    this.storage = storage || new MemoryStorage();
  }
  /**
   * Get user-scoped storage key
   * For multi-user support, keys are scoped per user: "provider:userId"
   * For single-user (backward compatible), userId is omitted or "default"
   *
   * @param userId - User identifier (optional, defaults to single-user mode)
   * @returns Storage key scoped to user
   */
  getScopedKey(userId) {
    if (!userId || userId === "default") {
      return this.baseStorageKey;
    }
    return `${this.baseStorageKey}:${userId}`;
  }
  /**
   * Store token (encrypted by storage layer)
   * @param tokenResponse - Token response from OAuth provider
   * @param userId - Optional user identifier for multi-user support
   */
  async storeToken(tokenResponse, userId) {
    if (!tokenResponse.access_token) {
      throw new Error("OAuth response missing required access_token field");
    }
    if (typeof tokenResponse.access_token !== "string") {
      throw new Error("access_token must be a string");
    }
    if (tokenResponse.expires_in !== void 0 && tokenResponse.expires_in < 0) {
      throw new Error("expires_in must be positive");
    }
    const token = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in || 3600,
      token_type: tokenResponse.token_type || "Bearer",
      scope: tokenResponse.scope,
      obtained_at: Date.now()
    };
    const key = this.getScopedKey(userId);
    await this.storage.storeToken(key, token);
  }
  /**
   * Get access token
   * @param userId - Optional user identifier for multi-user support
   */
  async getAccessToken(userId) {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    if (!token) {
      throw new Error(`No token stored for ${userId ? `user: ${userId}` : "default user"}`);
    }
    return token.access_token;
  }
  /**
   * Get refresh token
   * @param userId - Optional user identifier for multi-user support
   */
  async getRefreshToken(userId) {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    if (!token?.refresh_token) {
      throw new Error(`No refresh token available for ${userId ? `user: ${userId}` : "default user"}`);
    }
    return token.refresh_token;
  }
  /**
   * Check if has refresh token
   * @param userId - Optional user identifier for multi-user support
   */
  async hasRefreshToken(userId) {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    return !!token?.refresh_token;
  }
  /**
   * Check if token is valid (not expired)
   *
   * @param bufferSeconds - Refresh this many seconds before expiry (default: 300 = 5 min)
   * @param userId - Optional user identifier for multi-user support
   */
  async isValid(bufferSeconds = 300, userId) {
    const key = this.getScopedKey(userId);
    const token = await this.storage.getToken(key);
    if (!token) {
      return false;
    }
    const expiresAt = token.obtained_at + token.expires_in * 1e3;
    const bufferMs = bufferSeconds * 1e3;
    return Date.now() < expiresAt - bufferMs;
  }
  /**
   * Clear stored token
   * @param userId - Optional user identifier for multi-user support
   */
  async clear(userId) {
    const key = this.getScopedKey(userId);
    await this.storage.deleteToken(key);
  }
  /**
   * Get full token info
   * @param userId - Optional user identifier for multi-user support
   */
  async getTokenInfo(userId) {
    const key = this.getScopedKey(userId);
    return this.storage.getToken(key);
  }
};
function generatePKCE() {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  const codeChallenge = base64URLEncode(hash);
  return {
    codeVerifier,
    codeChallenge
  };
}
function base64URLEncode(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function generateState() {
  return crypto.randomBytes(16).toString("hex");
}

// src/connectors/oauth/flows/AuthCodePKCE.ts
var AuthCodePKCEFlow = class {
  constructor(config) {
    this.config = config;
    const storageKey = config.storageKey || `auth_code:${config.clientId}`;
    this.tokenStore = new TokenStore(storageKey, config.storage);
  }
  tokenStore;
  // Store PKCE data per user with timestamps for cleanup
  codeVerifiers = /* @__PURE__ */ new Map();
  states = /* @__PURE__ */ new Map();
  // Store refresh locks per user to prevent concurrent refresh
  refreshLocks = /* @__PURE__ */ new Map();
  // PKCE data TTL: 15 minutes (auth flows should complete within this time)
  PKCE_TTL = 15 * 60 * 1e3;
  /**
   * Generate authorization URL for user to visit
   * Opens browser or redirects user to this URL
   *
   * @param userId - User identifier for multi-user support (optional)
   */
  async getAuthorizationUrl(userId) {
    if (!this.config.authorizationUrl) {
      throw new Error("authorizationUrl is required for authorization_code flow");
    }
    if (!this.config.redirectUri) {
      throw new Error("redirectUri is required for authorization_code flow");
    }
    this.cleanupExpiredPKCE();
    const userKey = userId || "default";
    const { codeVerifier, codeChallenge } = generatePKCE();
    this.codeVerifiers.set(userKey, { verifier: codeVerifier, timestamp: Date.now() });
    const state = generateState();
    this.states.set(userKey, { state, timestamp: Date.now() });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state
    });
    if (this.config.scope) {
      params.append("scope", this.config.scope);
    }
    if (this.config.usePKCE !== false) {
      params.append("code_challenge", codeChallenge);
      params.append("code_challenge_method", "S256");
    }
    const stateWithUser = userId ? `${state}::${userId}` : state;
    params.set("state", stateWithUser);
    return `${this.config.authorizationUrl}?${params.toString()}`;
  }
  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from callback
   * @param state - State parameter from callback (for CSRF verification, may include userId)
   * @param userId - User identifier (optional, can be extracted from state)
   */
  async exchangeCode(code, state, userId) {
    let actualState = state;
    let actualUserId = userId;
    if (state.includes("::")) {
      const parts = state.split("::");
      actualState = parts[0];
      actualUserId = parts[1];
    }
    const userKey = actualUserId || "default";
    const stateData = this.states.get(userKey);
    if (!stateData) {
      throw new Error(`No PKCE state found for user ${actualUserId}. Authorization flow may have expired (15 min TTL).`);
    }
    const expectedState = stateData.state;
    if (actualState !== expectedState) {
      throw new Error(`State mismatch for user ${actualUserId} - possible CSRF attack. Expected: ${expectedState}, Got: ${actualState}`);
    }
    if (!this.config.redirectUri) {
      throw new Error("redirectUri is required");
    }
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId
    });
    if (this.config.clientSecret) {
      params.append("client_secret", this.config.clientSecret);
    }
    const verifierData = this.codeVerifiers.get(userKey);
    if (this.config.usePKCE !== false && verifierData) {
      params.append("code_verifier", verifierData.verifier);
    }
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${error}`);
    }
    const data = await response.json();
    await this.tokenStore.storeToken(data, actualUserId);
    this.codeVerifiers.delete(userKey);
    this.states.delete(userKey);
  }
  /**
   * Get valid token (auto-refreshes if needed)
   * @param userId - User identifier for multi-user support
   */
  async getToken(userId) {
    const key = userId || "default";
    if (this.refreshLocks.has(key)) {
      return this.refreshLocks.get(key);
    }
    if (await this.tokenStore.isValid(this.config.refreshBeforeExpiry, userId)) {
      return this.tokenStore.getAccessToken(userId);
    }
    if (await this.tokenStore.hasRefreshToken(userId)) {
      const refreshPromise = this.refreshToken(userId);
      this.refreshLocks.set(key, refreshPromise);
      try {
        return await refreshPromise;
      } finally {
        this.refreshLocks.delete(key);
      }
    }
    throw new Error(`No valid token available for ${userId ? `user: ${userId}` : "default user"}. User needs to authorize (call startAuthFlow).`);
  }
  /**
   * Refresh access token using refresh token
   * @param userId - User identifier for multi-user support
   */
  async refreshToken(userId) {
    const refreshToken = await this.tokenStore.getRefreshToken(userId);
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId
    });
    if (this.config.clientSecret) {
      params.append("client_secret", this.config.clientSecret);
    }
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${error}`);
    }
    const data = await response.json();
    await this.tokenStore.storeToken(data, userId);
    return data.access_token;
  }
  /**
   * Check if token is valid
   * @param userId - User identifier for multi-user support
   */
  async isTokenValid(userId) {
    return this.tokenStore.isValid(this.config.refreshBeforeExpiry, userId);
  }
  /**
   * Revoke token (if supported by provider)
   * @param revocationUrl - Optional revocation endpoint
   * @param userId - User identifier for multi-user support
   */
  async revokeToken(revocationUrl, userId) {
    if (!revocationUrl) {
      await this.tokenStore.clear(userId);
      return;
    }
    try {
      const token = await this.tokenStore.getAccessToken(userId);
      await fetch(revocationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          token,
          client_id: this.config.clientId
        })
      });
    } finally {
      await this.tokenStore.clear(userId);
    }
  }
  /**
   * Clean up expired PKCE data to prevent memory leaks
   * Removes verifiers and states older than PKCE_TTL (15 minutes)
   */
  cleanupExpiredPKCE() {
    const now = Date.now();
    for (const [key, data] of this.codeVerifiers) {
      if (now - data.timestamp > this.PKCE_TTL) {
        this.codeVerifiers.delete(key);
        this.states.delete(key);
      }
    }
  }
};

// src/connectors/oauth/flows/ClientCredentials.ts
var ClientCredentialsFlow = class {
  constructor(config) {
    this.config = config;
    const storageKey = config.storageKey || `client_credentials:${config.clientId}`;
    this.tokenStore = new TokenStore(storageKey, config.storage);
  }
  tokenStore;
  /**
   * Get token using client credentials
   */
  async getToken() {
    if (await this.tokenStore.isValid(this.config.refreshBeforeExpiry)) {
      return this.tokenStore.getAccessToken();
    }
    return this.requestToken();
  }
  /**
   * Request a new token from the authorization server
   */
  async requestToken() {
    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString(
      "base64"
    );
    const params = new URLSearchParams({
      grant_type: "client_credentials"
    });
    if (this.config.scope) {
      params.append("scope", this.config.scope);
    }
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token request failed: ${response.status} ${response.statusText} - ${error}`);
    }
    const data = await response.json();
    await this.tokenStore.storeToken(data);
    return data.access_token;
  }
  /**
   * Refresh token (client credentials don't use refresh tokens)
   * Just requests a new token
   */
  async refreshToken() {
    await this.tokenStore.clear();
    return this.requestToken();
  }
  /**
   * Check if token is valid
   */
  async isTokenValid() {
    return this.tokenStore.isValid(this.config.refreshBeforeExpiry);
  }
};
var JWTBearerFlow = class {
  constructor(config) {
    this.config = config;
    const storageKey = config.storageKey || `jwt_bearer:${config.clientId}`;
    this.tokenStore = new TokenStore(storageKey, config.storage);
    if (config.privateKey) {
      this.privateKey = config.privateKey;
    } else if (config.privateKeyPath) {
      try {
        this.privateKey = fs9.readFileSync(config.privateKeyPath, "utf8");
      } catch (error) {
        throw new Error(`Failed to read private key from ${config.privateKeyPath}: ${error.message}`);
      }
    } else {
      throw new Error("JWT Bearer flow requires privateKey or privateKeyPath");
    }
  }
  tokenStore;
  privateKey;
  /**
   * Generate signed JWT assertion
   */
  async generateJWT() {
    const now = Math.floor(Date.now() / 1e3);
    const alg = this.config.tokenSigningAlg || "RS256";
    const key = await importPKCS8(this.privateKey, alg);
    const jwt = await new SignJWT({
      scope: this.config.scope || ""
    }).setProtectedHeader({ alg }).setIssuer(this.config.clientId).setSubject(this.config.clientId).setAudience(this.config.audience || this.config.tokenUrl).setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
    return jwt;
  }
  /**
   * Get token using JWT Bearer assertion
   */
  async getToken() {
    if (await this.tokenStore.isValid(this.config.refreshBeforeExpiry)) {
      return this.tokenStore.getAccessToken();
    }
    return this.requestToken();
  }
  /**
   * Request token using JWT assertion
   */
  async requestToken() {
    const assertion = await this.generateJWT();
    const params = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    });
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`JWT Bearer token request failed: ${response.status} ${response.statusText} - ${error}`);
    }
    const data = await response.json();
    await this.tokenStore.storeToken(data);
    return data.access_token;
  }
  /**
   * Refresh token (generate new JWT and request new token)
   */
  async refreshToken() {
    await this.tokenStore.clear();
    return this.requestToken();
  }
  /**
   * Check if token is valid
   */
  async isTokenValid() {
    return this.tokenStore.isValid(this.config.refreshBeforeExpiry);
  }
};

// src/connectors/oauth/flows/StaticToken.ts
var StaticTokenFlow = class {
  token;
  constructor(config) {
    if (!config.staticToken) {
      throw new Error("Static token flow requires staticToken in config");
    }
    this.token = config.staticToken;
  }
  /**
   * Get token (always returns the static token)
   */
  async getToken() {
    return this.token;
  }
  /**
   * Refresh token (no-op for static tokens)
   */
  async refreshToken() {
    return this.token;
  }
  /**
   * Token is always valid for static tokens
   */
  async isTokenValid() {
    return true;
  }
  /**
   * Update the static token
   */
  updateToken(newToken) {
    this.token = newToken;
  }
};

// src/connectors/oauth/OAuthManager.ts
var OAuthManager = class {
  flow;
  constructor(config) {
    this.validateConfig(config);
    switch (config.flow) {
      case "authorization_code":
        this.flow = new AuthCodePKCEFlow(config);
        break;
      case "client_credentials":
        this.flow = new ClientCredentialsFlow(config);
        break;
      case "jwt_bearer":
        this.flow = new JWTBearerFlow(config);
        break;
      case "static_token":
        this.flow = new StaticTokenFlow(config);
        break;
      default:
        throw new Error(`Unknown OAuth flow: ${config.flow}`);
    }
  }
  /**
   * Get valid access token
   * Automatically refreshes if expired
   *
   * @param userId - User identifier for multi-user support (optional)
   */
  async getToken(userId) {
    return this.flow.getToken(userId);
  }
  /**
   * Force refresh the token
   *
   * @param userId - User identifier for multi-user support (optional)
   */
  async refreshToken(userId) {
    return this.flow.refreshToken(userId);
  }
  /**
   * Check if current token is valid
   *
   * @param userId - User identifier for multi-user support (optional)
   */
  async isTokenValid(userId) {
    return this.flow.isTokenValid(userId);
  }
  // ==================== Authorization Code Flow Methods ====================
  /**
   * Start authorization flow (Authorization Code only)
   * Returns URL for user to visit
   *
   * @param userId - User identifier for multi-user support (optional)
   * @returns Authorization URL for the user to visit
   */
  async startAuthFlow(userId) {
    if (!(this.flow instanceof AuthCodePKCEFlow)) {
      throw new Error("startAuthFlow() is only available for authorization_code flow");
    }
    return this.flow.getAuthorizationUrl(userId);
  }
  /**
   * Handle OAuth callback (Authorization Code only)
   * Call this with the callback URL after user authorizes
   *
   * @param callbackUrl - Full callback URL with code and state parameters
   * @param userId - Optional user identifier (can be extracted from state if embedded)
   */
  async handleCallback(callbackUrl, userId) {
    if (!(this.flow instanceof AuthCodePKCEFlow)) {
      throw new Error("handleCallback() is only available for authorization_code flow");
    }
    const url = new URL(callbackUrl);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code) {
      throw new Error("Missing authorization code in callback URL");
    }
    if (!state) {
      throw new Error("Missing state parameter in callback URL");
    }
    await this.flow.exchangeCode(code, state, userId);
  }
  /**
   * Revoke token (if supported by provider)
   *
   * @param revocationUrl - Optional revocation endpoint URL
   * @param userId - User identifier for multi-user support (optional)
   */
  async revokeToken(revocationUrl, userId) {
    if (this.flow instanceof AuthCodePKCEFlow) {
      await this.flow.revokeToken(revocationUrl, userId);
    } else {
      throw new Error("Token revocation not implemented for this flow");
    }
  }
  // ==================== Validation ====================
  validateConfig(config) {
    if (!config.flow) {
      throw new Error("OAuth flow is required (authorization_code, client_credentials, jwt_bearer, or static_token)");
    }
    if (config.flow !== "static_token") {
      if (!config.tokenUrl) {
        throw new Error("tokenUrl is required");
      }
      if (!config.clientId) {
        throw new Error("clientId is required");
      }
    }
    switch (config.flow) {
      case "authorization_code":
        if (!config.authorizationUrl) {
          throw new Error("authorizationUrl is required for authorization_code flow");
        }
        if (!config.redirectUri) {
          throw new Error("redirectUri is required for authorization_code flow");
        }
        break;
      case "client_credentials":
        if (!config.clientSecret) {
          throw new Error("clientSecret is required for client_credentials flow");
        }
        break;
      case "jwt_bearer":
        if (!config.privateKey && !config.privateKeyPath) {
          throw new Error(
            "privateKey or privateKeyPath is required for jwt_bearer flow"
          );
        }
        break;
      case "static_token":
        if (!config.staticToken) {
          throw new Error("staticToken is required for static_token flow");
        }
        break;
    }
    if (config.storage && !process.env.OAUTH_ENCRYPTION_KEY) {
      console.warn(
        "WARNING: Using persistent storage without OAUTH_ENCRYPTION_KEY environment variable. Tokens will be encrypted with auto-generated key that changes on restart!"
      );
    }
  }
};

// src/core/Connector.ts
var Connector = class _Connector {
  // ============ Static Registry ============
  static registry = /* @__PURE__ */ new Map();
  static defaultStorage = new MemoryStorage();
  /**
   * Create and register a new connector
   * @param config - Must include `name` field
   */
  static create(config) {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error("Connector name is required");
    }
    if (_Connector.registry.has(config.name)) {
      throw new Error(`Connector '${config.name}' already exists. Use Connector.get() or choose a different name.`);
    }
    const connector = new _Connector(config);
    _Connector.registry.set(config.name, connector);
    return connector;
  }
  /**
   * Get a connector by name
   */
  static get(name) {
    const connector = _Connector.registry.get(name);
    if (!connector) {
      const available = _Connector.list().join(", ") || "none";
      throw new Error(`Connector '${name}' not found. Available: ${available}`);
    }
    return connector;
  }
  /**
   * Check if a connector exists
   */
  static has(name) {
    return _Connector.registry.has(name);
  }
  /**
   * List all registered connector names
   */
  static list() {
    return Array.from(_Connector.registry.keys());
  }
  /**
   * Remove a connector
   */
  static remove(name) {
    const connector = _Connector.registry.get(name);
    if (connector) {
      connector.dispose();
    }
    return _Connector.registry.delete(name);
  }
  /**
   * Clear all connectors (useful for testing)
   */
  static clear() {
    for (const connector of _Connector.registry.values()) {
      connector.dispose();
    }
    _Connector.registry.clear();
  }
  /**
   * Set default token storage for OAuth connectors
   */
  static setDefaultStorage(storage) {
    _Connector.defaultStorage = storage;
  }
  /**
   * Get all registered connectors
   */
  static listAll() {
    return Array.from(_Connector.registry.values());
  }
  /**
   * Get number of registered connectors
   */
  static size() {
    return _Connector.registry.size;
  }
  /**
   * Get connector descriptions formatted for tool parameters
   * Useful for generating dynamic tool descriptions
   */
  static getDescriptionsForTools() {
    const connectors = _Connector.listAll();
    if (connectors.length === 0) {
      return "No connectors registered yet.";
    }
    return connectors.map((c) => `  - "${c.name}": ${c.displayName} - ${c.config.description || "No description"}`).join("\n");
  }
  /**
   * Get connector info (for tools and documentation)
   */
  static getInfo() {
    const info = {};
    for (const connector of _Connector.registry.values()) {
      info[connector.name] = {
        displayName: connector.displayName,
        description: connector.config.description || "",
        baseURL: connector.baseURL
      };
    }
    return info;
  }
  // ============ Instance ============
  name;
  vendor;
  config;
  oauthManager;
  disposed = false;
  constructor(config) {
    this.name = config.name;
    this.vendor = config.vendor;
    this.config = config;
    if (config.auth.type === "oauth") {
      this.initOAuthManager(config.auth);
    } else if (config.auth.type === "jwt") {
      this.initJWTManager(config.auth);
    }
  }
  /**
   * Human-readable display name
   */
  get displayName() {
    return this.config.displayName || this.name;
  }
  /**
   * API base URL for this connector
   */
  get baseURL() {
    return this.config.baseURL || "";
  }
  /**
   * Get the API key (for api_key auth type)
   */
  getApiKey() {
    if (this.config.auth.type !== "api_key") {
      throw new Error(`Connector '${this.name}' does not use API key auth. Type: ${this.config.auth.type}`);
    }
    return this.config.auth.apiKey;
  }
  /**
   * Get the current access token (for OAuth, JWT, or API key)
   * Handles automatic refresh if needed
   */
  async getToken(userId) {
    if (this.config.auth.type === "api_key") {
      return this.config.auth.apiKey;
    }
    if (!this.oauthManager) {
      throw new Error(`OAuth manager not initialized for connector '${this.name}'`);
    }
    return this.oauthManager.getToken(userId);
  }
  /**
   * Start OAuth authorization flow
   * Returns the URL to redirect the user to
   */
  async startAuth(userId) {
    if (!this.oauthManager) {
      throw new Error(`Connector '${this.name}' is not an OAuth connector`);
    }
    return this.oauthManager.startAuthFlow(userId);
  }
  /**
   * Handle OAuth callback
   * Call this after user is redirected back from OAuth provider
   */
  async handleCallback(callbackUrl, userId) {
    if (!this.oauthManager) {
      throw new Error(`Connector '${this.name}' is not an OAuth connector`);
    }
    await this.oauthManager.handleCallback(callbackUrl, userId);
  }
  /**
   * Check if the connector has a valid token
   */
  async hasValidToken(userId) {
    try {
      if (this.config.auth.type === "api_key") {
        return true;
      }
      if (this.oauthManager) {
        const token = await this.oauthManager.getToken(userId);
        return !!token;
      }
      return false;
    } catch {
      return false;
    }
  }
  /**
   * Get vendor-specific options from config
   */
  getOptions() {
    return this.config.options ?? {};
  }
  /**
   * Dispose of resources
   */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.oauthManager = void 0;
  }
  // ============ Private ============
  initOAuthManager(auth) {
    const oauthConfig = {
      flow: auth.flow,
      clientId: auth.clientId,
      clientSecret: auth.clientSecret,
      tokenUrl: auth.tokenUrl,
      authorizationUrl: auth.authorizationUrl,
      redirectUri: auth.redirectUri,
      scope: auth.scope,
      usePKCE: auth.usePKCE,
      privateKey: auth.privateKey,
      privateKeyPath: auth.privateKeyPath,
      audience: auth.audience,
      refreshBeforeExpiry: auth.refreshBeforeExpiry,
      storage: _Connector.defaultStorage,
      storageKey: auth.storageKey ?? this.name
    };
    this.oauthManager = new OAuthManager(oauthConfig);
  }
  initJWTManager(auth) {
    this.oauthManager = new OAuthManager({
      flow: "jwt_bearer",
      clientId: auth.clientId,
      tokenUrl: auth.tokenUrl,
      privateKey: auth.privateKey,
      privateKeyPath: auth.privateKeyPath,
      scope: auth.scope,
      audience: auth.audience,
      storage: _Connector.defaultStorage,
      storageKey: this.name
    });
  }
};

// src/core/Vendor.ts
var Vendor = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  GoogleVertex: "google-vertex",
  Groq: "groq",
  Together: "together",
  Perplexity: "perplexity",
  Grok: "grok",
  DeepSeek: "deepseek",
  Mistral: "mistral",
  Ollama: "ollama",
  Custom: "custom"
  // OpenAI-compatible endpoint
};
var VENDORS = Object.values(Vendor);
function isVendor(value) {
  return VENDORS.includes(value);
}

// src/domain/errors/AIErrors.ts
var AIError = class _AIError extends Error {
  constructor(message, code, statusCode, originalError) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.name = "AIError";
    Object.setPrototypeOf(this, _AIError.prototype);
  }
};
var ProviderNotFoundError = class _ProviderNotFoundError extends AIError {
  constructor(providerName) {
    super(
      `Provider '${providerName}' not found. Did you configure it in OneRingAI constructor?`,
      "PROVIDER_NOT_FOUND",
      404
    );
    this.name = "ProviderNotFoundError";
    Object.setPrototypeOf(this, _ProviderNotFoundError.prototype);
  }
};
var ProviderAuthError = class _ProviderAuthError extends AIError {
  constructor(providerName, message = "Authentication failed") {
    super(
      `${providerName}: ${message}`,
      "PROVIDER_AUTH_ERROR",
      401
    );
    this.name = "ProviderAuthError";
    Object.setPrototypeOf(this, _ProviderAuthError.prototype);
  }
};
var ProviderRateLimitError = class _ProviderRateLimitError extends AIError {
  constructor(providerName, retryAfter) {
    super(
      `${providerName}: Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}ms` : ""}`,
      "PROVIDER_RATE_LIMIT",
      429
    );
    this.retryAfter = retryAfter;
    this.name = "ProviderRateLimitError";
    Object.setPrototypeOf(this, _ProviderRateLimitError.prototype);
  }
};
var ProviderContextLengthError = class _ProviderContextLengthError extends AIError {
  constructor(providerName, maxTokens, requestedTokens) {
    super(
      `${providerName}: Context length exceeded. Max: ${maxTokens}${requestedTokens ? `, Requested: ${requestedTokens}` : ""}`,
      "PROVIDER_CONTEXT_LENGTH_EXCEEDED",
      413
    );
    this.maxTokens = maxTokens;
    this.requestedTokens = requestedTokens;
    this.name = "ProviderContextLengthError";
    Object.setPrototypeOf(this, _ProviderContextLengthError.prototype);
  }
};
var ToolExecutionError = class _ToolExecutionError extends AIError {
  constructor(toolName, message, originalError) {
    super(
      `Tool '${toolName}' execution failed: ${message}`,
      "TOOL_EXECUTION_ERROR",
      500,
      originalError
    );
    this.originalError = originalError;
    this.name = "ToolExecutionError";
    Object.setPrototypeOf(this, _ToolExecutionError.prototype);
  }
};
var ToolTimeoutError = class _ToolTimeoutError extends AIError {
  constructor(toolName, timeoutMs) {
    super(
      `Tool '${toolName}' execution timed out after ${timeoutMs}ms`,
      "TOOL_TIMEOUT",
      408
    );
    this.timeoutMs = timeoutMs;
    this.name = "ToolTimeoutError";
    Object.setPrototypeOf(this, _ToolTimeoutError.prototype);
  }
};
var ToolNotFoundError = class _ToolNotFoundError extends AIError {
  constructor(toolName) {
    super(
      `Tool '${toolName}' not found. Did you register it with the agent?`,
      "TOOL_NOT_FOUND",
      404
    );
    this.name = "ToolNotFoundError";
    Object.setPrototypeOf(this, _ToolNotFoundError.prototype);
  }
};
var ModelNotSupportedError = class _ModelNotSupportedError extends AIError {
  constructor(providerName, model, capability) {
    super(
      `Model '${model}' from ${providerName} does not support ${capability}`,
      "MODEL_NOT_SUPPORTED",
      400
    );
    this.name = "ModelNotSupportedError";
    Object.setPrototypeOf(this, _ModelNotSupportedError.prototype);
  }
};
var InvalidConfigError = class _InvalidConfigError extends AIError {
  constructor(message) {
    super(message, "INVALID_CONFIG", 400);
    this.name = "InvalidConfigError";
    Object.setPrototypeOf(this, _InvalidConfigError.prototype);
  }
};
var InvalidToolArgumentsError = class _InvalidToolArgumentsError extends AIError {
  constructor(toolName, rawArguments, parseError) {
    super(
      `Invalid arguments for tool '${toolName}': ${parseError?.message || "Failed to parse JSON"}`,
      "INVALID_TOOL_ARGUMENTS",
      400,
      parseError
    );
    this.rawArguments = rawArguments;
    this.parseError = parseError;
    this.name = "InvalidToolArgumentsError";
    Object.setPrototypeOf(this, _InvalidToolArgumentsError.prototype);
  }
};
var ProviderError = class _ProviderError extends AIError {
  constructor(providerName, message, statusCode, originalError) {
    super(
      `${providerName}: ${message}`,
      "PROVIDER_ERROR",
      statusCode,
      originalError
    );
    this.providerName = providerName;
    this.name = "ProviderError";
    Object.setPrototypeOf(this, _ProviderError.prototype);
  }
};

// src/infrastructure/providers/base/BaseProvider.ts
var BaseProvider = class {
  constructor(config) {
    this.config = config;
  }
  /**
   * Validate provider configuration
   * Returns validation result with details
   */
  async validateConfig() {
    const validation = this.validateApiKey();
    return validation.isValid;
  }
  /**
   * Validate API key format and presence
   * Can be overridden by providers with specific key formats
   */
  validateApiKey() {
    const apiKey = this.config.apiKey;
    if (!apiKey || apiKey.trim().length === 0) {
      return { isValid: false };
    }
    const placeholders = [
      "your-api-key",
      "YOUR_API_KEY",
      "sk-xxx",
      "api-key-here",
      "REPLACE_ME",
      "<your-key>"
    ];
    if (placeholders.some((p) => apiKey.includes(p))) {
      return {
        isValid: false,
        warning: `API key appears to be a placeholder value`
      };
    }
    return this.validateProviderSpecificKeyFormat(apiKey);
  }
  /**
   * Override this method in provider implementations for specific key format validation
   */
  validateProviderSpecificKeyFormat(_apiKey) {
    return { isValid: true };
  }
  /**
   * Validate config and throw if invalid
   */
  assertValidConfig() {
    const validation = this.validateApiKey();
    if (!validation.isValid) {
      throw new InvalidConfigError(
        `Invalid API key for provider '${this.name}'${validation.warning ? `: ${validation.warning}` : ""}`
      );
    }
  }
  /**
   * Get API key from config
   */
  getApiKey() {
    return this.config.apiKey;
  }
  /**
   * Get base URL if configured
   */
  getBaseURL() {
    return this.config.baseURL;
  }
  /**
   * Get timeout configuration
   */
  getTimeout() {
    return this.config.timeout || 6e4;
  }
  /**
   * Get max retries configuration
   */
  getMaxRetries() {
    return this.config.maxRetries || 3;
  }
};
var DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeoutMs: 3e4,
  // 30 seconds
  windowMs: 6e4,
  // 1 minute
  isRetryable: () => true
  // All errors count by default
};
var CircuitOpenError = class extends Error {
  constructor(breakerName, nextRetryTime, failureCount, lastError) {
    const retryInSeconds = Math.ceil((nextRetryTime - Date.now()) / 1e3);
    super(
      `Circuit breaker '${breakerName}' is OPEN. Retry in ${retryInSeconds}s. (${failureCount} recent failures, last: ${lastError})`
    );
    this.breakerName = breakerName;
    this.nextRetryTime = nextRetryTime;
    this.failureCount = failureCount;
    this.lastError = lastError;
    this.name = "CircuitOpenError";
  }
};
var CircuitBreaker = class extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.lastStateChange = Date.now();
  }
  state = "closed";
  config;
  // Failure tracking
  failures = [];
  lastError = "";
  // Success tracking
  consecutiveSuccesses = 0;
  // Timing
  openedAt;
  lastStateChange;
  // Metrics
  totalRequests = 0;
  successCount = 0;
  failureCount = 0;
  rejectedCount = 0;
  lastFailureTime;
  lastSuccessTime;
  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    this.totalRequests++;
    const now = Date.now();
    switch (this.state) {
      case "open":
        if (this.openedAt && now - this.openedAt >= this.config.resetTimeoutMs) {
          this.transitionTo("half-open");
        } else {
          this.rejectedCount++;
          const nextRetry = (this.openedAt || now) + this.config.resetTimeoutMs;
          throw new CircuitOpenError(this.name, nextRetry, this.failures.length, this.lastError);
        }
        break;
    }
    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error);
      throw error;
    }
  }
  /**
   * Record successful execution
   */
  recordSuccess() {
    this.successCount++;
    this.lastSuccessTime = Date.now();
    this.consecutiveSuccesses++;
    if (this.state === "half-open") {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.transitionTo("closed");
      }
    } else if (this.state === "closed") {
      this.pruneOldFailures();
    }
  }
  /**
   * Record failed execution
   */
  recordFailure(error) {
    if (this.config.isRetryable && !this.config.isRetryable(error)) {
      return;
    }
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.lastError = error.message;
    this.consecutiveSuccesses = 0;
    this.failures.push({
      timestamp: Date.now(),
      error: error.message
    });
    this.pruneOldFailures();
    if (this.state === "half-open") {
      this.transitionTo("open");
    } else if (this.state === "closed") {
      if (this.failures.length >= this.config.failureThreshold) {
        this.transitionTo("open");
      }
    }
  }
  /**
   * Transition to new state
   */
  transitionTo(newState) {
    this.state = newState;
    this.lastStateChange = Date.now();
    switch (newState) {
      case "open":
        this.openedAt = Date.now();
        this.emit("opened", {
          name: this.name,
          failureCount: this.failures.length,
          lastError: this.lastError,
          nextRetryTime: this.openedAt + this.config.resetTimeoutMs
        });
        break;
      case "half-open":
        this.emit("half-open", {
          name: this.name,
          timestamp: Date.now()
        });
        break;
      case "closed":
        this.failures = [];
        this.consecutiveSuccesses = 0;
        this.openedAt = void 0;
        this.emit("closed", {
          name: this.name,
          successCount: this.consecutiveSuccesses,
          timestamp: Date.now()
        });
        break;
    }
  }
  /**
   * Remove failures outside the time window
   */
  pruneOldFailures() {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Get current metrics
   */
  getMetrics() {
    this.pruneOldFailures();
    const total = this.successCount + this.failureCount;
    const failureRate = total > 0 ? this.failureCount / total : 0;
    const successRate = total > 0 ? this.successCount / total : 0;
    return {
      name: this.name,
      state: this.state,
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      failureCount: this.failureCount,
      rejectedCount: this.rejectedCount,
      recentFailures: this.failures.length,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange,
      nextRetryTime: this.openedAt ? this.openedAt + this.config.resetTimeoutMs : void 0,
      failureRate,
      successRate
    };
  }
  /**
   * Manually reset circuit breaker (force close)
   */
  reset() {
    this.transitionTo("closed");
    this.totalRequests = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.rejectedCount = 0;
    this.lastFailureTime = void 0;
    this.lastSuccessTime = void 0;
  }
  /**
   * Check if circuit is allowing requests
   */
  isOpen() {
    if (this.state === "open" && this.openedAt) {
      const now = Date.now();
      if (now - this.openedAt >= this.config.resetTimeoutMs) {
        this.transitionTo("half-open");
        return false;
      }
      return true;
    }
    return false;
  }
  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
};
var LOG_LEVEL_VALUES = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100
};
var FrameworkLogger = class _FrameworkLogger {
  config;
  context;
  levelValue;
  fileStream;
  constructor(config = {}) {
    this.config = {
      level: config.level || process.env.LOG_LEVEL || "info",
      pretty: config.pretty ?? (process.env.LOG_PRETTY === "true" || process.env.NODE_ENV === "development"),
      destination: config.destination || "console",
      context: config.context || {},
      filePath: config.filePath || process.env.LOG_FILE
    };
    this.context = this.config.context || {};
    this.levelValue = LOG_LEVEL_VALUES[this.config.level || "info"];
    if (this.config.filePath) {
      this.initFileStream(this.config.filePath);
    }
  }
  /**
   * Initialize file stream for logging
   */
  initFileStream(filePath) {
    try {
      const dir = path3.dirname(filePath);
      if (!fs9.existsSync(dir)) {
        fs9.mkdirSync(dir, { recursive: true });
      }
      this.fileStream = fs9.createWriteStream(filePath, {
        flags: "a",
        // append mode
        encoding: "utf8"
      });
      this.fileStream.on("error", (err) => {
        console.error(`[Logger] File stream error: ${err.message}`);
        this.fileStream = void 0;
      });
    } catch (err) {
      console.error(`[Logger] Failed to initialize log file: ${err instanceof Error ? err.message : err}`);
    }
  }
  /**
   * Create child logger with additional context
   */
  child(context) {
    return new _FrameworkLogger({
      ...this.config,
      context: { ...this.context, ...context }
    });
  }
  /**
   * Trace log
   */
  trace(obj, msg) {
    this.log("trace", obj, msg);
  }
  /**
   * Debug log
   */
  debug(obj, msg) {
    this.log("debug", obj, msg);
  }
  /**
   * Info log
   */
  info(obj, msg) {
    this.log("info", obj, msg);
  }
  /**
   * Warn log
   */
  warn(obj, msg) {
    this.log("warn", obj, msg);
  }
  /**
   * Error log
   */
  error(obj, msg) {
    this.log("error", obj, msg);
  }
  /**
   * Internal log method
   */
  log(level, obj, msg) {
    if (LOG_LEVEL_VALUES[level] < this.levelValue) {
      return;
    }
    let data;
    let message;
    if (typeof obj === "string") {
      message = obj;
      data = {};
    } else {
      message = msg || "";
      data = obj;
    }
    const entry = {
      level,
      time: Date.now(),
      ...this.context,
      ...data,
      msg: message
    };
    this.output(entry);
  }
  /**
   * Output log entry
   */
  output(entry) {
    if (this.config.pretty) {
      this.prettyPrint(entry);
    } else {
      this.jsonPrint(entry);
    }
  }
  /**
   * Pretty print for development
   */
  prettyPrint(entry) {
    const levelColors = {
      trace: "\x1B[90m",
      // Gray
      debug: "\x1B[36m",
      // Cyan
      info: "\x1B[32m",
      // Green
      warn: "\x1B[33m",
      // Yellow
      error: "\x1B[31m",
      // Red
      silent: ""
    };
    const reset = "\x1B[0m";
    const color = this.fileStream ? "" : levelColors[entry.level] || "";
    const time = new Date(entry.time).toISOString().substring(11, 23);
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const contextParts = [];
    for (const [key, value] of Object.entries(entry)) {
      if (key !== "level" && key !== "time" && key !== "msg") {
        contextParts.push(`${key}=${JSON.stringify(value)}`);
      }
    }
    const context = contextParts.length > 0 ? ` ${contextParts.join(" ")}` : "";
    const output = `${color}[${time}] ${levelStr}${reset} ${entry.msg}${context}`;
    if (this.fileStream) {
      const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, "");
      this.fileStream.write(cleanOutput + "\n");
      return;
    }
    switch (entry.level) {
      case "error":
      case "warn":
        console.error(output);
        break;
      default:
        console.log(output);
    }
  }
  /**
   * JSON print for production
   */
  jsonPrint(entry) {
    const json = JSON.stringify(entry);
    if (this.fileStream) {
      this.fileStream.write(json + "\n");
      return;
    }
    switch (this.config.destination) {
      case "stderr":
        console.error(json);
        break;
      default:
        console.log(json);
    }
  }
  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    if (config.level) {
      this.levelValue = LOG_LEVEL_VALUES[config.level];
    }
    if (config.context) {
      this.context = { ...this.context, ...config.context };
    }
    if (config.filePath !== void 0) {
      this.closeFileStream();
      if (config.filePath) {
        this.initFileStream(config.filePath);
      }
    }
  }
  /**
   * Close file stream
   */
  closeFileStream() {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = void 0;
    }
  }
  /**
   * Cleanup resources (call before process exit)
   */
  close() {
    this.closeFileStream();
  }
  /**
   * Get current log level
   */
  getLevel() {
    return this.config.level || "info";
  }
  /**
   * Check if level is enabled
   */
  isLevelEnabled(level) {
    return LOG_LEVEL_VALUES[level] >= this.levelValue;
  }
};
var logger = new FrameworkLogger({
  level: process.env.LOG_LEVEL || "info",
  pretty: process.env.LOG_PRETTY === "true" || process.env.NODE_ENV === "development",
  filePath: process.env.LOG_FILE
});
process.on("exit", () => {
  logger.close();
});
process.on("SIGINT", () => {
  logger.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  logger.close();
  process.exit(0);
});

// src/infrastructure/observability/Metrics.ts
var NoOpMetrics = class {
  increment() {
  }
  gauge() {
  }
  timing() {
  }
  histogram() {
  }
};
var ConsoleMetrics = class {
  prefix;
  constructor(prefix = "oneringai") {
    this.prefix = prefix;
  }
  increment(metric, value = 1, tags) {
    this.log("COUNTER", metric, value, tags);
  }
  gauge(metric, value, tags) {
    this.log("GAUGE", metric, value, tags);
  }
  timing(metric, duration, tags) {
    this.log("TIMING", metric, `${duration}ms`, tags);
  }
  histogram(metric, value, tags) {
    this.log("HISTOGRAM", metric, value, tags);
  }
  log(type, metric, value, tags) {
    const fullMetric = `${this.prefix}.${metric}`;
    const tagsStr = tags ? ` ${JSON.stringify(tags)}` : "";
    console.log(`[METRIC:${type}] ${fullMetric}=${value}${tagsStr}`);
  }
};
var InMemoryMetrics = class {
  counters = /* @__PURE__ */ new Map();
  gauges = /* @__PURE__ */ new Map();
  timings = /* @__PURE__ */ new Map();
  histograms = /* @__PURE__ */ new Map();
  increment(metric, value = 1, tags) {
    const key = this.makeKey(metric, tags);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }
  gauge(metric, value, tags) {
    const key = this.makeKey(metric, tags);
    this.gauges.set(key, value);
  }
  timing(metric, duration, tags) {
    const key = this.makeKey(metric, tags);
    const timings = this.timings.get(key) || [];
    timings.push(duration);
    this.timings.set(key, timings);
  }
  histogram(metric, value, tags) {
    const key = this.makeKey(metric, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
  }
  makeKey(metric, tags) {
    if (!tags) return metric;
    const tagStr = Object.entries(tags).map(([k, v]) => `${k}:${v}`).sort().join(",");
    return `${metric}{${tagStr}}`;
  }
  /**
   * Get all metrics (for testing)
   */
  getMetrics() {
    return {
      counters: new Map(this.counters),
      gauges: new Map(this.gauges),
      timings: new Map(this.timings),
      histograms: new Map(this.histograms)
    };
  }
  /**
   * Clear all metrics
   */
  clear() {
    this.counters.clear();
    this.gauges.clear();
    this.timings.clear();
    this.histograms.clear();
  }
  /**
   * Get summary statistics for timings
   */
  getTimingStats(metric, tags) {
    const key = this.makeKey(metric, tags);
    const timings = this.timings.get(key);
    if (!timings || timings.length === 0) {
      return null;
    }
    const sorted = [...timings].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      count,
      min: sorted[0] ?? 0,
      max: sorted[count - 1] ?? 0,
      mean: sum / count,
      p50: sorted[Math.floor(count * 0.5)] ?? 0,
      p95: sorted[Math.floor(count * 0.95)] ?? 0,
      p99: sorted[Math.floor(count * 0.99)] ?? 0
    };
  }
};
function createMetricsCollector(type, prefix) {
  const collectorType = type || process.env.METRICS_COLLECTOR || "noop";
  switch (collectorType) {
    case "console":
      return new ConsoleMetrics(prefix);
    case "inmemory":
      return new InMemoryMetrics();
    default:
      return new NoOpMetrics();
  }
}
var metrics = createMetricsCollector(
  void 0,
  process.env.METRICS_PREFIX || "oneringai"
);
function setMetricsCollector(collector) {
  Object.assign(metrics, collector);
}

// src/infrastructure/providers/base/BaseTextProvider.ts
var BaseTextProvider = class extends BaseProvider {
  circuitBreaker;
  logger;
  _isObservabilityInitialized = false;
  constructor(config) {
    super(config);
    this.logger = logger.child({
      component: "Provider",
      provider: "unknown"
    });
  }
  /**
   * Auto-initialize observability on first use (lazy initialization)
   * This is called automatically by executeWithCircuitBreaker()
   * @internal
   */
  ensureObservabilityInitialized() {
    if (this._isObservabilityInitialized) {
      return;
    }
    const providerName = this.name || "unknown";
    const cbConfig = this.config.circuitBreaker || DEFAULT_CIRCUIT_BREAKER_CONFIG;
    this.circuitBreaker = new CircuitBreaker(
      `provider:${providerName}`,
      cbConfig
    );
    this.logger = logger.child({
      component: "Provider",
      provider: providerName
    });
    this.circuitBreaker.on("opened", (data) => {
      this.logger.warn(data, "Circuit breaker opened");
      metrics.increment("circuit_breaker.opened", 1, {
        breaker: data.name,
        provider: providerName
      });
    });
    this.circuitBreaker.on("closed", (data) => {
      this.logger.info(data, "Circuit breaker closed");
      metrics.increment("circuit_breaker.closed", 1, {
        breaker: data.name,
        provider: providerName
      });
    });
    this._isObservabilityInitialized = true;
  }
  /**
   * DEPRECATED: No longer needed, kept for backward compatibility
   * Observability is now auto-initialized on first use
   * @deprecated Initialization happens automatically
   */
  initializeObservability(_providerName) {
    this.ensureObservabilityInitialized();
  }
  /**
   * Execute with circuit breaker protection (helper for subclasses)
   */
  async executeWithCircuitBreaker(operation, model) {
    this.ensureObservabilityInitialized();
    const startTime = Date.now();
    const operationName = "llm.generate";
    this.logger.debug({
      operation: operationName,
      model
    }, "LLM call started");
    metrics.increment("provider.llm.request", 1, {
      provider: this.name,
      model: model || "unknown"
    });
    try {
      if (!this.circuitBreaker) {
        return await operation();
      }
      const result = await this.circuitBreaker.execute(operation);
      const duration = Date.now() - startTime;
      this.logger.info({
        operation: operationName,
        model,
        duration
      }, "LLM call completed");
      metrics.timing("provider.llm.latency", duration, {
        provider: this.name,
        model: model || "unknown"
      });
      metrics.increment("provider.llm.response", 1, {
        provider: this.name,
        model: model || "unknown",
        status: "success"
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        operation: operationName,
        model,
        error: error.message,
        duration
      }, "LLM call failed");
      metrics.increment("provider.llm.error", 1, {
        provider: this.name,
        model: model || "unknown",
        error: error.name
      });
      throw error;
    }
  }
  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    if (!this.circuitBreaker) {
      return null;
    }
    return this.circuitBreaker.getMetrics();
  }
  /**
   * Normalize input to string (helper for providers that don't support complex input)
   */
  normalizeInputToString(input) {
    if (typeof input === "string") {
      return input;
    }
    const textParts = [];
    for (const item of input) {
      if (item.type === "message") {
        for (const content of item.content) {
          if (content.type === "input_text") {
            textParts.push(content.text);
          } else if (content.type === "output_text") {
            textParts.push(content.text);
          }
        }
      }
    }
    return textParts.join("\n");
  }
};

// src/domain/entities/Message.ts
var MessageRole = /* @__PURE__ */ ((MessageRole2) => {
  MessageRole2["USER"] = "user";
  MessageRole2["ASSISTANT"] = "assistant";
  MessageRole2["DEVELOPER"] = "developer";
  return MessageRole2;
})(MessageRole || {});

// src/domain/entities/StreamEvent.ts
var StreamEventType = /* @__PURE__ */ ((StreamEventType2) => {
  StreamEventType2["RESPONSE_CREATED"] = "response.created";
  StreamEventType2["RESPONSE_IN_PROGRESS"] = "response.in_progress";
  StreamEventType2["OUTPUT_TEXT_DELTA"] = "response.output_text.delta";
  StreamEventType2["OUTPUT_TEXT_DONE"] = "response.output_text.done";
  StreamEventType2["TOOL_CALL_START"] = "response.tool_call.start";
  StreamEventType2["TOOL_CALL_ARGUMENTS_DELTA"] = "response.tool_call_arguments.delta";
  StreamEventType2["TOOL_CALL_ARGUMENTS_DONE"] = "response.tool_call_arguments.done";
  StreamEventType2["TOOL_EXECUTION_START"] = "response.tool_execution.start";
  StreamEventType2["TOOL_EXECUTION_DONE"] = "response.tool_execution.done";
  StreamEventType2["ITERATION_COMPLETE"] = "response.iteration.complete";
  StreamEventType2["RESPONSE_COMPLETE"] = "response.complete";
  StreamEventType2["ERROR"] = "response.error";
  return StreamEventType2;
})(StreamEventType || {});
function isStreamEvent(event, type) {
  return event.type === type;
}
function isOutputTextDelta(event) {
  return event.type === "response.output_text.delta" /* OUTPUT_TEXT_DELTA */;
}
function isToolCallArgumentsDelta(event) {
  return event.type === "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */;
}
function isToolCallArgumentsDone(event) {
  return event.type === "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */;
}
function isResponseComplete(event) {
  return event.type === "response.complete" /* RESPONSE_COMPLETE */;
}
function isErrorEvent(event) {
  return event.type === "response.error" /* ERROR */;
}

// src/infrastructure/providers/openai/OpenAITextProvider.ts
var OpenAITextProvider = class extends BaseTextProvider {
  name = "openai";
  capabilities = {
    text: true,
    images: true,
    videos: false,
    audio: true
  };
  client;
  constructor(config) {
    super(config);
    this.client = new OpenAI2({
      apiKey: this.getApiKey(),
      baseURL: this.getBaseURL(),
      organization: config.organization,
      timeout: this.getTimeout(),
      maxRetries: this.getMaxRetries()
    });
  }
  /**
   * Generate response using OpenAI Responses API
   */
  async generate(options) {
    return this.executeWithCircuitBreaker(async () => {
      try {
        const response = await this.client.chat.completions.create({
          model: options.model,
          messages: this.convertInput(options.input, options.instructions),
          tools: options.tools,
          tool_choice: options.tool_choice,
          temperature: options.temperature,
          max_tokens: options.max_output_tokens,
          response_format: options.response_format
        });
        return this.convertResponse(response);
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    }, options.model);
  }
  /**
   * Stream response using OpenAI Streaming API
   */
  async *streamGenerate(options) {
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages: this.convertInput(options.input, options.instructions),
        tools: options.tools,
        tool_choice: options.tool_choice,
        temperature: options.temperature,
        max_tokens: options.max_output_tokens,
        response_format: options.response_format,
        stream: true,
        stream_options: { include_usage: true }
      });
      let responseId = "";
      let sequenceNumber = 0;
      let hasUsage = false;
      const toolCallBuffers = /* @__PURE__ */ new Map();
      for await (const chunk of stream) {
        if (process.env.DEBUG_OPENAI && chunk.usage) {
          console.error("[DEBUG] OpenAI chunk has usage:", chunk.usage);
        }
        if (!responseId) {
          responseId = chunk.id;
          yield {
            type: "response.created" /* RESPONSE_CREATED */,
            response_id: responseId,
            model: chunk.model,
            created_at: chunk.created
          };
        }
        if (chunk.usage) {
          hasUsage = true;
          if (process.env.DEBUG_OPENAI) {
            console.error("[DEBUG] Emitting RESPONSE_COMPLETE with usage:", {
              prompt_tokens: chunk.usage.prompt_tokens,
              completion_tokens: chunk.usage.completion_tokens,
              total_tokens: chunk.usage.total_tokens
            });
          }
          yield {
            type: "response.complete" /* RESPONSE_COMPLETE */,
            response_id: responseId,
            status: "completed",
            usage: {
              input_tokens: chunk.usage.prompt_tokens || 0,
              output_tokens: chunk.usage.completion_tokens || 0,
              total_tokens: chunk.usage.total_tokens || 0
            },
            iterations: 1
          };
        }
        const choice = chunk.choices[0];
        if (!choice) continue;
        const delta = choice.delta;
        if (delta.content) {
          yield {
            type: "response.output_text.delta" /* OUTPUT_TEXT_DELTA */,
            response_id: responseId,
            item_id: `msg_${responseId}`,
            output_index: 0,
            content_index: 0,
            delta: delta.content,
            sequence_number: sequenceNumber++
          };
        }
        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const index = toolCall.index;
            if (!toolCallBuffers.has(index)) {
              const toolCallId = toolCall.id || `call_${responseId}_${index}`;
              const toolName = toolCall.function?.name || "";
              toolCallBuffers.set(index, {
                id: toolCallId,
                name: toolName,
                args: ""
              });
              yield {
                type: "response.tool_call.start" /* TOOL_CALL_START */,
                response_id: responseId,
                item_id: `msg_${responseId}`,
                tool_call_id: toolCallId,
                tool_name: toolName
              };
            }
            if (toolCall.function?.arguments) {
              const buffer = toolCallBuffers.get(index);
              buffer.args += toolCall.function.arguments;
              yield {
                type: "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */,
                response_id: responseId,
                item_id: `msg_${responseId}`,
                tool_call_id: buffer.id,
                tool_name: buffer.name,
                delta: toolCall.function.arguments,
                sequence_number: sequenceNumber++
              };
            }
          }
        }
        if (choice.finish_reason && toolCallBuffers.size > 0) {
          for (const buffer of toolCallBuffers.values()) {
            yield {
              type: "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */,
              response_id: responseId,
              tool_call_id: buffer.id,
              tool_name: buffer.name,
              arguments: buffer.args
            };
          }
        }
      }
      if (responseId && !hasUsage) {
        yield {
          type: "response.complete" /* RESPONSE_COMPLETE */,
          response_id: responseId,
          status: "completed",
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0
          },
          iterations: 1
        };
      }
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  /**
   * Get model capabilities
   */
  getModelCapabilities(model) {
    if (model.startsWith("gpt-4")) {
      return {
        supportsTools: true,
        supportsVision: model.includes("vision") || !model.includes("0613"),
        supportsJSON: true,
        supportsJSONSchema: true,
        maxTokens: model.includes("turbo") ? 128e3 : 8192,
        maxOutputTokens: 16384
      };
    }
    if (model.startsWith("gpt-3.5")) {
      return {
        supportsTools: true,
        supportsVision: false,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 16385,
        maxOutputTokens: 4096
      };
    }
    if (model.startsWith("o1") || model.startsWith("o3")) {
      return {
        supportsTools: false,
        supportsVision: true,
        supportsJSON: false,
        supportsJSONSchema: false,
        maxTokens: 2e5,
        maxOutputTokens: 1e5
      };
    }
    return {
      supportsTools: false,
      supportsVision: false,
      supportsJSON: false,
      supportsJSONSchema: false,
      maxTokens: 4096,
      maxOutputTokens: 4096
    };
  }
  /**
   * Convert our input format to OpenAI messages format
   * @param input - Input messages
   * @param instructions - Optional system instructions (prepended as DEVELOPER message for OpenAI)
   */
  convertInput(input, instructions) {
    const messages = [];
    if (typeof input === "string") {
      if (instructions) {
        messages.push({ role: "developer", content: instructions });
      }
      messages.push({ role: "user", content: input });
      return messages;
    }
    const hasDeveloperMessage = Array.isArray(input) && input.some(
      (item) => item.type === "message" && item.role === "developer"
    );
    if (instructions && !hasDeveloperMessage) {
      messages.push({
        role: "developer",
        content: instructions
      });
    }
    for (const item of input) {
      if (item.type === "message") {
        const message = {
          role: item.role,
          // Keep role as-is (developer, user, assistant)
          content: []
        };
        for (const content of item.content) {
          switch (content.type) {
            case "input_text":
              message.content.push({ type: "text", text: content.text });
              break;
            case "input_image_url":
              message.content.push({
                type: "image_url",
                image_url: content.image_url
              });
              break;
            case "output_text":
              message.content.push({ type: "text", text: content.text });
              break;
            case "tool_use":
              if (!message.tool_calls) {
                message.tool_calls = [];
              }
              message.tool_calls.push({
                id: content.id,
                type: "function",
                function: {
                  name: content.name,
                  arguments: content.arguments
                }
              });
              if (message.tool_calls.length > 0 && message.content.length === 0) {
                message.content = null;
              }
              break;
            case "tool_result":
              messages.push({
                role: "tool",
                tool_call_id: content.tool_use_id,
                content: typeof content.content === "string" ? content.content : JSON.stringify(content.content)
              });
              continue;
          }
        }
        if (Array.isArray(message.content) && message.content.length === 1 && message.content[0].type === "text") {
          message.content = message.content[0].text;
        }
        messages.push(message);
      }
    }
    return messages;
  }
  /**
   * Convert OpenAI response to our LLMResponse format
   */
  convertResponse(response) {
    const choice = response.choices[0];
    const message = choice?.message;
    const content = [];
    if (message?.content) {
      content.push({
        type: "output_text",
        text: message.content,
        annotations: []
      });
    }
    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === "function" && "function" in toolCall) {
          content.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments
          });
        }
      }
    }
    return {
      id: response.id,
      object: "response",
      created_at: response.created,
      status: choice?.finish_reason === "stop" ? "completed" : "incomplete",
      model: response.model,
      output: [
        {
          type: "message",
          id: response.id,
          role: "assistant" /* ASSISTANT */,
          content
        }
      ],
      output_text: message?.content || "",
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      }
    };
  }
  /**
   * Handle OpenAI-specific errors
   */
  handleError(error) {
    if (error.status === 401) {
      throw new ProviderAuthError("openai", "Invalid API key");
    }
    if (error.status === 429) {
      const retryAfter = error.headers?.["retry-after"];
      throw new ProviderRateLimitError(
        "openai",
        retryAfter ? parseInt(retryAfter) * 1e3 : void 0
      );
    }
    if (error.code === "context_length_exceeded" || error.status === 413) {
      throw new ProviderContextLengthError("openai", 128e3);
    }
    throw error;
  }
};

// src/domain/entities/Content.ts
var ContentType = /* @__PURE__ */ ((ContentType2) => {
  ContentType2["INPUT_TEXT"] = "input_text";
  ContentType2["INPUT_IMAGE_URL"] = "input_image_url";
  ContentType2["INPUT_FILE"] = "input_file";
  ContentType2["OUTPUT_TEXT"] = "output_text";
  ContentType2["TOOL_USE"] = "tool_use";
  ContentType2["TOOL_RESULT"] = "tool_result";
  return ContentType2;
})(ContentType || {});

// src/infrastructure/providers/shared/ToolConversionUtils.ts
function extractFunctionTools(tools) {
  return tools.filter((t) => t.type === "function");
}
function convertToolsToStandardFormat(tools) {
  return extractFunctionTools(tools).map((tool) => ({
    name: tool.function.name,
    description: tool.function.description || "",
    parameters: tool.function.parameters || { type: "object", properties: {} }
  }));
}
function transformForAnthropic(tool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  };
}

// src/infrastructure/providers/anthropic/AnthropicConverter.ts
var AnthropicConverter = class {
  /**
   * Convert our format → Anthropic Messages API format
   */
  convertRequest(options) {
    const messages = this.convertMessages(options.input);
    const tools = this.convertTools(options.tools);
    const params = {
      model: options.model,
      max_tokens: options.max_output_tokens || 4096,
      messages
    };
    if (options.instructions) {
      params.system = options.instructions;
    }
    if (tools && tools.length > 0) {
      params.tools = tools;
    }
    if (options.temperature !== void 0) {
      params.temperature = options.temperature;
    }
    return params;
  }
  /**
   * Convert our InputItem[] → Anthropic messages
   */
  convertMessages(input) {
    if (typeof input === "string") {
      return [{ role: "user", content: input }];
    }
    const messages = [];
    for (const item of input) {
      if (item.type === "message") {
        const role = item.role === "developer" /* DEVELOPER */ ? "user" : item.role;
        const content = this.convertContent(item.content);
        messages.push({
          role,
          content
        });
      }
    }
    return messages;
  }
  /**
   * Convert our Content[] → Anthropic content blocks
   */
  convertContent(content) {
    const blocks = [];
    for (const c of content) {
      switch (c.type) {
        case "input_text" /* INPUT_TEXT */:
        case "output_text" /* OUTPUT_TEXT */:
          blocks.push({
            type: "text",
            text: c.text
          });
          break;
        case "input_image_url" /* INPUT_IMAGE_URL */:
          if (c.image_url.url.startsWith("data:")) {
            const matches = c.image_url.url.match(/^data:image\/(\w+);base64,(.+)$/);
            if (matches) {
              const mediaType = `image/${matches[1]}`;
              const data = matches[2];
              blocks.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data
                }
              });
            }
          } else {
            blocks.push({
              type: "image",
              source: {
                type: "url",
                url: c.image_url.url
              }
            });
          }
          break;
        case "tool_result" /* TOOL_RESULT */:
          blocks.push({
            type: "tool_result",
            tool_use_id: c.tool_use_id,
            content: typeof c.content === "string" ? c.content : JSON.stringify(c.content),
            is_error: !!c.error
          });
          break;
        case "tool_use" /* TOOL_USE */:
          let parsedInput;
          try {
            parsedInput = JSON.parse(c.arguments);
          } catch (parseError) {
            throw new InvalidToolArgumentsError(
              c.name,
              c.arguments,
              parseError instanceof Error ? parseError : new Error(String(parseError))
            );
          }
          blocks.push({
            type: "tool_use",
            id: c.id,
            name: c.name,
            input: parsedInput
          });
          break;
      }
    }
    if (blocks.length === 1 && blocks[0]?.type === "text") {
      return blocks[0].text;
    }
    return blocks;
  }
  /**
   * Convert our Tool[] → Anthropic tools
   */
  convertTools(tools) {
    if (!tools || tools.length === 0) {
      return void 0;
    }
    const standardTools = convertToolsToStandardFormat(tools);
    return standardTools.map((tool) => ({
      ...transformForAnthropic(tool),
      input_schema: {
        type: "object",
        ...tool.parameters
      }
    }));
  }
  /**
   * Convert Anthropic response → our LLMResponse format
   */
  convertResponse(response) {
    const output = [
      {
        type: "message",
        id: response.id,
        role: "assistant" /* ASSISTANT */,
        content: this.convertAnthropicContent(response.content)
      }
    ];
    return {
      id: `resp_anthropic_${response.id}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1e3),
      status: this.mapStopReason(response.stop_reason),
      model: response.model,
      output,
      output_text: this.extractOutputText(response.content),
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }
  /**
   * Convert Anthropic content blocks → our Content[]
   */
  convertAnthropicContent(blocks) {
    const content = [];
    for (const block of blocks) {
      if (block.type === "text") {
        content.push({
          type: "output_text" /* OUTPUT_TEXT */,
          text: block.text,
          annotations: []
        });
      } else if (block.type === "tool_use") {
        content.push({
          type: "tool_use" /* TOOL_USE */,
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input)
          // Convert object to JSON string
        });
      }
    }
    return content;
  }
  /**
   * Extract output text from Anthropic content blocks
   */
  extractOutputText(blocks) {
    const textBlocks = blocks.filter(
      (b) => b.type === "text"
    );
    return textBlocks.map((b) => b.text).join("\n");
  }
  /**
   * Map Anthropic stop_reason → our status
   */
  mapStopReason(stopReason) {
    switch (stopReason) {
      case "end_turn":
        return "completed";
      case "tool_use":
        return "completed";
      // Tool use is normal completion
      case "max_tokens":
        return "incomplete";
      case "stop_sequence":
        return "completed";
      default:
        return "incomplete";
    }
  }
};

// src/infrastructure/providers/anthropic/AnthropicStreamConverter.ts
var AnthropicStreamConverter = class {
  responseId = "";
  model = "";
  sequenceNumber = 0;
  contentBlockIndex = /* @__PURE__ */ new Map();
  usage = { input_tokens: 0, output_tokens: 0 };
  /**
   * Convert Anthropic stream to our StreamEvent format
   */
  async *convertStream(anthropicStream, model) {
    this.model = model;
    this.sequenceNumber = 0;
    this.contentBlockIndex.clear();
    this.usage = { input_tokens: 0, output_tokens: 0 };
    for await (const event of anthropicStream) {
      const converted = this.convertEvent(event);
      if (converted) {
        for (const evt of converted) {
          yield evt;
        }
      }
    }
  }
  /**
   * Convert single Anthropic event to our event(s)
   */
  convertEvent(event) {
    const eventType = event.type;
    switch (eventType) {
      case "message_start":
        return this.handleMessageStart(event);
      case "content_block_start":
        return this.handleContentBlockStart(event);
      case "content_block_delta":
        return this.handleContentBlockDelta(event);
      case "content_block_stop":
        return this.handleContentBlockStop(event);
      case "message_delta":
        return this.handleMessageDelta(event);
      case "message_stop":
        return this.handleMessageStop();
      default:
        return [];
    }
  }
  /**
   * Handle message_start event
   */
  handleMessageStart(event) {
    this.responseId = event.message.id;
    if (event.message.usage) {
      this.usage.input_tokens = event.message.usage.input_tokens || 0;
    }
    return [
      {
        type: "response.created" /* RESPONSE_CREATED */,
        response_id: this.responseId,
        model: this.model,
        created_at: Date.now()
      }
    ];
  }
  /**
   * Handle content_block_start event
   */
  handleContentBlockStart(event) {
    const index = event.index;
    const block = event.content_block;
    if (block.type === "text") {
      this.contentBlockIndex.set(index, { type: "text" });
      return [];
    } else if (block.type === "tool_use") {
      this.contentBlockIndex.set(index, {
        type: "tool_use",
        id: block.id,
        name: block.name,
        accumulatedArgs: ""
        // Initialize args accumulator
      });
      return [
        {
          type: "response.tool_call.start" /* TOOL_CALL_START */,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          tool_call_id: block.id,
          tool_name: block.name
        }
      ];
    }
    return [];
  }
  /**
   * Handle content_block_delta event
   */
  handleContentBlockDelta(event) {
    const index = event.index;
    const delta = event.delta;
    const blockInfo = this.contentBlockIndex.get(index);
    if (!blockInfo) return [];
    if (delta.type === "text_delta") {
      return [
        {
          type: "response.output_text.delta" /* OUTPUT_TEXT_DELTA */,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          output_index: 0,
          content_index: index,
          delta: delta.text,
          sequence_number: this.sequenceNumber++
        }
      ];
    } else if (delta.type === "input_json_delta") {
      if (blockInfo.accumulatedArgs !== void 0) {
        blockInfo.accumulatedArgs += delta.partial_json;
      }
      return [
        {
          type: "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          tool_call_id: blockInfo.id || "",
          tool_name: blockInfo.name || "",
          delta: delta.partial_json,
          sequence_number: this.sequenceNumber++
        }
      ];
    }
    return [];
  }
  /**
   * Handle content_block_stop event
   */
  handleContentBlockStop(event) {
    const index = event.index;
    const blockInfo = this.contentBlockIndex.get(index);
    if (!blockInfo) return [];
    if (blockInfo.type === "tool_use") {
      return [
        {
          type: "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */,
          response_id: this.responseId,
          tool_call_id: blockInfo.id || "",
          tool_name: blockInfo.name || "",
          arguments: blockInfo.accumulatedArgs || "{}"
          // Use accumulated args
        }
      ];
    }
    return [];
  }
  /**
   * Handle message_delta event (usage info, stop_reason)
   */
  handleMessageDelta(event) {
    if (event.usage) {
      this.usage.output_tokens = event.usage.output_tokens || 0;
    }
    return [];
  }
  /**
   * Handle message_stop event (final event)
   */
  handleMessageStop() {
    return [
      {
        type: "response.complete" /* RESPONSE_COMPLETE */,
        response_id: this.responseId,
        status: "completed",
        usage: {
          input_tokens: this.usage.input_tokens,
          output_tokens: this.usage.output_tokens,
          total_tokens: this.usage.input_tokens + this.usage.output_tokens
        },
        iterations: 1
      }
    ];
  }
  /**
   * Clear all internal state
   * Should be called after each stream completes to prevent memory leaks
   */
  clear() {
    this.responseId = "";
    this.model = "";
    this.sequenceNumber = 0;
    this.contentBlockIndex.clear();
    this.usage = { input_tokens: 0, output_tokens: 0 };
  }
  /**
   * Reset converter state for a new stream
   * Alias for clear()
   */
  reset() {
    this.clear();
  }
};

// src/infrastructure/providers/anthropic/AnthropicTextProvider.ts
var AnthropicTextProvider = class extends BaseTextProvider {
  name = "anthropic";
  capabilities = {
    text: true,
    images: true,
    // Claude 3+ supports vision
    videos: false,
    audio: false
  };
  client;
  converter;
  streamConverter;
  constructor(config) {
    super(config);
    this.client = new Anthropic({
      apiKey: this.getApiKey(),
      baseURL: this.getBaseURL(),
      maxRetries: this.getMaxRetries()
    });
    this.converter = new AnthropicConverter();
    this.streamConverter = new AnthropicStreamConverter();
  }
  /**
   * Generate response using Anthropic Messages API
   */
  async generate(options) {
    return this.executeWithCircuitBreaker(async () => {
      try {
        const anthropicRequest = this.converter.convertRequest(options);
        const anthropicResponse = await this.client.messages.create({
          ...anthropicRequest,
          stream: false
        });
        return this.converter.convertResponse(anthropicResponse);
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    }, options.model);
  }
  /**
   * Stream response using Anthropic Messages API
   */
  async *streamGenerate(options) {
    try {
      const anthropicRequest = this.converter.convertRequest(options);
      const stream = await this.client.messages.create({
        ...anthropicRequest,
        stream: true
      });
      this.streamConverter.reset();
      yield* this.streamConverter.convertStream(stream, options.model);
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.streamConverter.clear();
    }
  }
  /**
   * Get model capabilities
   */
  getModelCapabilities(model) {
    if (model.includes("claude-sonnet-4") || model.includes("claude-opus-4") || model.includes("claude-haiku-4")) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        // Use prompt engineering
        maxTokens: 2e5,
        maxOutputTokens: 8192
      };
    }
    if (model.includes("claude-3-5-sonnet") || model.includes("claude-3-7-sonnet")) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 2e5,
        maxOutputTokens: 8192
      };
    }
    if (model.includes("claude-3-opus")) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 2e5,
        maxOutputTokens: 4096
      };
    }
    if (model.includes("claude-3-sonnet")) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 2e5,
        maxOutputTokens: 4096
      };
    }
    if (model.includes("claude-3-haiku")) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 2e5,
        maxOutputTokens: 4096
      };
    }
    return {
      supportsTools: true,
      supportsVision: true,
      supportsJSON: true,
      supportsJSONSchema: false,
      maxTokens: 2e5,
      maxOutputTokens: 4096
    };
  }
  /**
   * Handle Anthropic-specific errors
   */
  handleError(error) {
    if (error.status === 401) {
      throw new ProviderAuthError("anthropic", "Invalid API key");
    }
    if (error.status === 429) {
      const retryAfter = error.headers?.["retry-after"];
      throw new ProviderRateLimitError(
        "anthropic",
        retryAfter ? parseInt(retryAfter) * 1e3 : void 0
      );
    }
    if (error.type === "invalid_request_error" && (error.message?.includes("prompt is too long") || error.message?.includes("maximum context length"))) {
      throw new ProviderContextLengthError("anthropic", 2e5);
    }
    throw error;
  }
};

// src/utils/imageUtils.ts
var DEFAULT_TIMEOUT_MS = 3e4;
var DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
async function fetchImageAsBase64(url, options) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxSizeBytes = DEFAULT_MAX_SIZE_BYTES } = {};
  if (url.startsWith("data:image/")) {
    const matches = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (matches) {
      const base64Data = matches[2] || "";
      const size = calculateBase64Size(base64Data);
      if (size > maxSizeBytes) {
        throw new Error(`Image size (${formatBytes(size)}) exceeds maximum allowed (${formatBytes(maxSizeBytes)})`);
      }
      return {
        mimeType: matches[1] || "image/png",
        base64Data,
        size
      };
    }
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > maxSizeBytes) {
        throw new Error(
          `Image size (${formatBytes(size)}) exceeds maximum allowed (${formatBytes(maxSizeBytes)})`
        );
      }
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response body reader");
    }
    const chunks = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > maxSizeBytes) {
        reader.cancel();
        throw new Error(
          `Image size exceeds maximum allowed (${formatBytes(maxSizeBytes)})`
        );
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const base64Data = buffer.toString("base64");
    let mimeType = response.headers.get("content-type") || "image/png";
    if (!mimeType.startsWith("image/")) {
      mimeType = detectImageFormatFromBuffer(buffer);
    }
    return {
      mimeType,
      base64Data,
      size: buffer.length
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Image fetch timed out after ${timeoutMs}ms`);
    }
    throw new Error(`Failed to fetch image from URL: ${error.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
function detectImageFormatFromBuffer(buffer) {
  const magic = buffer.slice(0, 4).toString("hex");
  if (magic.startsWith("89504e47")) return "image/png";
  if (magic.startsWith("ffd8ff")) return "image/jpeg";
  if (magic.startsWith("47494638")) return "image/gif";
  if (magic.startsWith("52494646")) return "image/webp";
  throw new Error("URL does not point to a valid image");
}
function calculateBase64Size(base64Data) {
  const data = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  if (!data || data.length === 0) return 0;
  let padding = 0;
  if (data.endsWith("==")) padding = 2;
  else if (data.endsWith("=")) padding = 1;
  return Math.floor(data.length * 3 / 4) - padding;
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// src/infrastructure/providers/google/GoogleConverter.ts
var GoogleConverter = class {
  // Track tool call ID → tool name mapping for tool results
  toolCallMapping = /* @__PURE__ */ new Map();
  // Track tool call ID → thought signature for Gemini 3+
  thoughtSignatures = /* @__PURE__ */ new Map();
  /**
   * Convert our format → Google Gemini format
   */
  async convertRequest(options) {
    if (process.env.DEBUG_GOOGLE && Array.isArray(options.input)) {
      console.error("[DEBUG] Input messages:", JSON.stringify(options.input.map((msg) => ({
        type: msg.type,
        role: msg.role,
        contentTypes: msg.content?.map((c) => c.type)
      })), null, 2));
    }
    const contents = await this.convertMessages(options.input);
    const tools = this.convertTools(options.tools);
    if (process.env.DEBUG_GOOGLE) {
      console.error("[DEBUG] Final contents array length:", contents.length);
    }
    const request = {
      contents
    };
    if (options.instructions) {
      request.systemInstruction = { parts: [{ text: options.instructions }] };
    }
    if (tools && tools.length > 0) {
      request.tools = [{ functionDeclarations: tools }];
      request.toolConfig = {
        functionCallingConfig: {
          mode: options.tool_choice === "required" ? "ANY" : "AUTO"
        }
      };
    }
    request.generationConfig = {
      temperature: options.temperature,
      maxOutputTokens: options.max_output_tokens
    };
    if (tools && tools.length > 0) {
      request.generationConfig.allowCodeExecution = false;
    }
    if (options.response_format) {
      if (options.response_format.type === "json_object") {
        request.generationConfig.responseMimeType = "application/json";
      } else if (options.response_format.type === "json_schema") {
        request.generationConfig.responseMimeType = "application/json";
      }
    }
    return request;
  }
  /**
   * Convert our InputItem[] → Google contents
   */
  async convertMessages(input) {
    if (typeof input === "string") {
      return [
        {
          role: "user",
          parts: [{ text: input }]
        }
      ];
    }
    const contents = [];
    for (const item of input) {
      if (item.type === "message") {
        const role = item.role === "user" /* USER */ || item.role === "developer" /* DEVELOPER */ ? "user" : "model";
        const parts = await this.convertContentToParts(item.content);
        if (process.env.DEBUG_GOOGLE) {
          console.error(
            `[DEBUG] Converting message - role: ${item.role} \u2192 ${role}, parts: ${parts.length}`,
            parts.map((p) => Object.keys(p))
          );
        }
        if (parts.length > 0) {
          contents.push({
            role,
            parts
          });
        }
      }
    }
    return contents;
  }
  /**
   * Convert our Content[] → Google parts
   */
  async convertContentToParts(content) {
    const parts = [];
    for (const c of content) {
      switch (c.type) {
        case "input_text" /* INPUT_TEXT */:
        case "output_text" /* OUTPUT_TEXT */:
          parts.push({ text: c.text });
          break;
        case "input_image_url" /* INPUT_IMAGE_URL */:
          try {
            const imageData = await fetchImageAsBase64(c.image_url.url);
            parts.push({
              inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.base64Data
              }
            });
          } catch (error) {
            console.error(`Failed to fetch image: ${error.message}`);
            parts.push({
              text: `[Error: Could not load image from ${c.image_url.url}]`
            });
          }
          break;
        case "tool_use" /* TOOL_USE */:
          this.toolCallMapping.set(c.id, c.name);
          let parsedArgs;
          try {
            parsedArgs = JSON.parse(c.arguments);
          } catch (parseError) {
            throw new InvalidToolArgumentsError(
              c.name,
              c.arguments,
              parseError instanceof Error ? parseError : new Error(String(parseError))
            );
          }
          const functionCallPart = {
            functionCall: {
              name: c.name,
              args: parsedArgs
            }
          };
          const signature = this.thoughtSignatures.get(c.id);
          if (process.env.DEBUG_GOOGLE) {
            console.error(`[DEBUG] Looking up signature for tool ID: ${c.id}`);
            console.error(`[DEBUG] Found signature:`, signature ? "YES" : "NO");
            console.error(`[DEBUG] Available signatures:`, Array.from(this.thoughtSignatures.keys()));
          }
          if (signature) {
            functionCallPart.thoughtSignature = signature;
          }
          parts.push(functionCallPart);
          break;
        case "tool_result" /* TOOL_RESULT */:
          const functionName = this.toolCallMapping.get(c.tool_use_id) || this.extractToolName(c.tool_use_id);
          parts.push({
            functionResponse: {
              name: functionName,
              // Use actual function name from mapping
              response: {
                result: typeof c.content === "string" ? c.content : c.content
              }
            }
          });
          break;
      }
    }
    return parts;
  }
  /**
   * Convert our Tool[] → Google function declarations
   */
  convertTools(tools) {
    if (!tools || tools.length === 0) {
      return void 0;
    }
    const standardTools = convertToolsToStandardFormat(tools);
    return standardTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: this.convertParametersSchema(tool.parameters)
    }));
  }
  /**
   * Convert JSON Schema parameters to Google's format
   */
  convertParametersSchema(schema) {
    if (!schema) return void 0;
    const converted = {
      type: "OBJECT",
      // Google uses uppercase 'OBJECT'
      properties: {}
    };
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const prop = value;
        converted.properties[key] = {
          type: prop.type?.toUpperCase() || "STRING",
          description: prop.description
        };
        if (prop.enum) {
          converted.properties[key].enum = prop.enum;
        }
        if (prop.type === "object" && prop.properties) {
          converted.properties[key] = this.convertParametersSchema(prop);
        }
        if (prop.type === "array" && prop.items) {
          converted.properties[key].items = this.convertParametersSchema(prop.items);
        }
      }
    }
    if (schema.required) {
      converted.required = schema.required;
    }
    return converted;
  }
  /**
   * Convert Google response → our LLMResponse format
   */
  convertResponse(response) {
    const candidate = response.candidates?.[0];
    const geminiContent = candidate?.content;
    const content = this.convertGeminiPartsToContent(geminiContent?.parts || []);
    const output = [
      {
        type: "message",
        id: response.id || `google_msg_${randomUUID()}`,
        role: "assistant" /* ASSISTANT */,
        content
      }
    ];
    const outputText = this.extractOutputText(geminiContent?.parts || []);
    if (process.env.DEBUG_GOOGLE) {
      console.error("[DEBUG] Extracted output_text:", outputText);
      console.error("[DEBUG] Content array:", JSON.stringify(content, null, 2));
      console.error("[DEBUG] Raw parts:", JSON.stringify(geminiContent?.parts, null, 2));
    }
    return {
      id: `resp_google_${randomUUID()}`,
      object: "response",
      created_at: Math.floor(Date.now() / 1e3),
      status: this.mapFinishReason(candidate?.finishReason),
      model: response.modelVersion || "gemini",
      output,
      output_text: outputText,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount || 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount || 0,
        total_tokens: response.usageMetadata?.totalTokenCount || 0
      }
    };
  }
  /**
   * Convert Google parts → our Content[]
   */
  convertGeminiPartsToContent(parts) {
    const content = [];
    for (const part of parts) {
      if ("text" in part && part.text) {
        content.push({
          type: "output_text" /* OUTPUT_TEXT */,
          text: part.text,
          annotations: []
        });
      } else if ("functionCall" in part && part.functionCall) {
        const toolId = `google_${randomUUID()}`;
        const functionName = part.functionCall.name || "";
        if ("thoughtSignature" in part && part.thoughtSignature) {
          const sig = part.thoughtSignature;
          this.thoughtSignatures.set(toolId, sig);
          if (process.env.DEBUG_GOOGLE) {
            console.error(`[DEBUG] Captured thought signature for tool ID: ${toolId}`);
            console.error(`[DEBUG] Signature length:`, sig.length);
          }
        } else if (process.env.DEBUG_GOOGLE) {
          console.error(`[DEBUG] NO thought signature in part for ${functionName}`);
          console.error(`[DEBUG] Part keys:`, Object.keys(part));
        }
        content.push({
          type: "tool_use" /* TOOL_USE */,
          id: toolId,
          name: functionName,
          arguments: JSON.stringify(part.functionCall.args || {})
        });
      }
    }
    return content;
  }
  /**
   * Extract output text from Google parts
   */
  extractOutputText(parts) {
    return parts.filter((p) => "text" in p && typeof p.text === "string").map((p) => p.text).join("\n");
  }
  /**
   * Map Google finish reason → our status
   */
  mapFinishReason(finishReason) {
    switch (finishReason) {
      case "STOP":
        return "completed";
      case "MAX_TOKENS":
        return "incomplete";
      case "SAFETY":
      case "RECITATION":
        return "failed";
      case "OTHER":
      default:
        return "incomplete";
    }
  }
  /**
   * Extract tool name from tool_use_id using tracked mapping
   */
  extractToolName(toolUseId) {
    const name = this.toolCallMapping.get(toolUseId);
    if (name) {
      return name;
    }
    console.warn(`[GoogleConverter] Tool name not found for ID: ${toolUseId}`);
    return "unknown_tool";
  }
  /**
   * Clear all internal mappings
   * Should be called after each request/response cycle to prevent memory leaks
   */
  clearMappings() {
    this.toolCallMapping.clear();
    this.thoughtSignatures.clear();
  }
  /**
   * Reset converter state for a new request
   * Alias for clearMappings()
   */
  reset() {
    this.clearMappings();
  }
};
var GoogleStreamConverter = class {
  responseId = "";
  model = "";
  sequenceNumber = 0;
  isFirst = true;
  toolCallBuffers = /* @__PURE__ */ new Map();
  /**
   * Convert Google stream to our StreamEvent format
   */
  async *convertStream(googleStream, model) {
    this.model = model;
    this.sequenceNumber = 0;
    this.isFirst = true;
    this.toolCallBuffers.clear();
    let lastUsage = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0
    };
    for await (const chunk of googleStream) {
      if (this.isFirst) {
        this.responseId = this.generateResponseId();
        yield {
          type: "response.created" /* RESPONSE_CREATED */,
          response_id: this.responseId,
          model: this.model,
          created_at: Date.now()
        };
        this.isFirst = false;
      }
      const usage = this.extractUsage(chunk);
      if (usage) {
        lastUsage = usage;
      }
      const events = this.convertChunk(chunk);
      for (const event of events) {
        yield event;
      }
    }
    if (this.toolCallBuffers.size > 0) {
      for (const [toolCallId, buffer] of this.toolCallBuffers) {
        yield {
          type: "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */,
          response_id: this.responseId,
          tool_call_id: toolCallId,
          tool_name: buffer.name,
          arguments: buffer.args
        };
      }
    }
    yield {
      type: "response.complete" /* RESPONSE_COMPLETE */,
      response_id: this.responseId,
      status: "completed",
      usage: lastUsage,
      iterations: 1
    };
  }
  /**
   * Extract usage from Google chunk
   */
  extractUsage(chunk) {
    const usage = chunk.usageMetadata;
    if (!usage) return null;
    return {
      input_tokens: usage.promptTokenCount || 0,
      output_tokens: usage.candidatesTokenCount || 0,
      total_tokens: usage.totalTokenCount || 0
    };
  }
  /**
   * Convert single Google chunk to our event(s)
   */
  convertChunk(chunk) {
    const events = [];
    const candidate = chunk.candidates?.[0];
    if (!candidate?.content?.parts) return events;
    for (const part of candidate.content.parts) {
      if (part.text) {
        events.push({
          type: "response.output_text.delta" /* OUTPUT_TEXT_DELTA */,
          response_id: this.responseId,
          item_id: `msg_${this.responseId}`,
          output_index: 0,
          content_index: 0,
          delta: part.text,
          sequence_number: this.sequenceNumber++
        });
      } else if (part.functionCall) {
        const functionCall = part.functionCall;
        const toolName = functionCall.name || "unknown";
        const toolCallId = `call_${this.responseId}_${toolName}`;
        if (!this.toolCallBuffers.has(toolCallId)) {
          this.toolCallBuffers.set(toolCallId, {
            name: toolName,
            args: ""
          });
          events.push({
            type: "response.tool_call.start" /* TOOL_CALL_START */,
            response_id: this.responseId,
            item_id: `msg_${this.responseId}`,
            tool_call_id: toolCallId,
            tool_name: toolName
          });
        }
        if (functionCall.args) {
          const argsJson = JSON.stringify(functionCall.args);
          const buffer = this.toolCallBuffers.get(toolCallId);
          if (argsJson !== buffer.args) {
            const delta = argsJson.slice(buffer.args.length);
            buffer.args = argsJson;
            if (delta) {
              events.push({
                type: "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */,
                response_id: this.responseId,
                item_id: `msg_${this.responseId}`,
                tool_call_id: toolCallId,
                tool_name: toolName,
                delta,
                sequence_number: this.sequenceNumber++
              });
            }
          }
        }
      }
    }
    return events;
  }
  /**
   * Generate unique response ID using cryptographically secure UUID
   */
  generateResponseId() {
    return `resp_google_${randomUUID()}`;
  }
  /**
   * Clear all internal state
   * Should be called after each stream completes to prevent memory leaks
   */
  clear() {
    this.responseId = "";
    this.model = "";
    this.sequenceNumber = 0;
    this.isFirst = true;
    this.toolCallBuffers.clear();
  }
  /**
   * Reset converter state for a new stream
   * Alias for clear()
   */
  reset() {
    this.clear();
  }
};

// src/infrastructure/providers/google/GoogleTextProvider.ts
var GoogleTextProvider = class extends BaseTextProvider {
  name = "google";
  capabilities = {
    text: true,
    images: true,
    // Gemini supports vision
    videos: false,
    audio: false
  };
  client;
  converter;
  streamConverter;
  constructor(config) {
    super(config);
    this.client = new GoogleGenAI({
      apiKey: this.getApiKey()
    });
    this.converter = new GoogleConverter();
    this.streamConverter = new GoogleStreamConverter();
  }
  /**
   * Generate response using Google Gemini API
   */
  async generate(options) {
    return this.executeWithCircuitBreaker(async () => {
      try {
        const googleRequest = await this.converter.convertRequest(options);
        if (process.env.DEBUG_GOOGLE) {
          console.error("[DEBUG] Google Request:", JSON.stringify({
            model: options.model,
            tools: googleRequest.tools,
            toolConfig: googleRequest.toolConfig,
            contents: googleRequest.contents?.slice(0, 1)
            // First message only
          }, null, 2));
        }
        const result = await this.client.models.generateContent({
          model: options.model,
          contents: googleRequest.contents,
          config: {
            systemInstruction: googleRequest.systemInstruction,
            tools: googleRequest.tools,
            toolConfig: googleRequest.toolConfig,
            ...googleRequest.generationConfig
          }
        });
        if (process.env.DEBUG_GOOGLE) {
          console.error("[DEBUG] Google Response:", JSON.stringify({
            candidates: result.candidates?.map((c) => ({
              finishReason: c.finishReason,
              content: c.content
            })),
            usageMetadata: result.usageMetadata
          }, null, 2));
        }
        const response = this.converter.convertResponse(result);
        return response;
      } catch (error) {
        this.handleError(error);
        throw error;
      } finally {
        this.converter.clearMappings();
      }
    }, options.model);
  }
  /**
   * Stream response using Google Gemini API
   */
  async *streamGenerate(options) {
    try {
      const googleRequest = await this.converter.convertRequest(options);
      const stream = await this.client.models.generateContentStream({
        model: options.model,
        contents: googleRequest.contents,
        config: {
          systemInstruction: googleRequest.systemInstruction,
          tools: googleRequest.tools,
          toolConfig: googleRequest.toolConfig,
          ...googleRequest.generationConfig
        }
      });
      this.streamConverter.reset();
      yield* this.streamConverter.convertStream(stream, options.model);
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.converter.clearMappings();
      this.streamConverter.clear();
    }
  }
  /**
   * Get model capabilities
   */
  getModelCapabilities(model) {
    if (model.includes("gemini-3") || model.includes("gemini-2.5") || model.includes("gemini-2.0") || model.includes("gemini-1.5") || model.includes("gemini-pro") || model.includes("gemini-flash")) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 1048576,
        // 1M tokens
        maxOutputTokens: 8192
      };
    }
    return {
      supportsTools: true,
      supportsVision: true,
      supportsJSON: true,
      supportsJSONSchema: false,
      maxTokens: 1048576,
      maxOutputTokens: 8192
    };
  }
  /**
   * Handle Google-specific errors
   */
  handleError(error) {
    const errorMessage = error.message || "";
    if (error.status === 401 || errorMessage.includes("API key not valid")) {
      throw new ProviderAuthError("google", "Invalid API key");
    }
    if (error.status === 429 || errorMessage.includes("Resource exhausted")) {
      throw new ProviderRateLimitError("google");
    }
    if (errorMessage.includes("context length") || errorMessage.includes("too long")) {
      throw new ProviderContextLengthError("google", 1048576);
    }
    throw error;
  }
};
var VertexAITextProvider = class extends BaseTextProvider {
  name = "vertex-ai";
  capabilities = {
    text: true,
    images: true,
    videos: true,
    // Vertex AI supports video input
    audio: true
    // Vertex AI supports audio input
  };
  client;
  converter;
  config;
  constructor(config) {
    super(config);
    this.config = config;
    if (!config.projectId) {
      throw new InvalidConfigError("Vertex AI requires projectId");
    }
    if (!config.location) {
      throw new InvalidConfigError('Vertex AI requires location (e.g., "us-central1")');
    }
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "True";
    process.env.GOOGLE_CLOUD_PROJECT = config.projectId;
    process.env.GOOGLE_CLOUD_LOCATION = config.location;
    if (config.credentials) ;
    this.client = new GoogleGenAI({
      // No API key for Vertex AI - uses Application Default Credentials
    });
    this.converter = new GoogleConverter();
  }
  /**
   * Generate response using Vertex AI
   */
  async generate(options) {
    try {
      const googleRequest = await this.converter.convertRequest(options);
      const result = await this.client.models.generateContent({
        model: options.model,
        contents: googleRequest.contents,
        config: {
          systemInstruction: googleRequest.systemInstruction,
          tools: googleRequest.tools,
          toolConfig: googleRequest.toolConfig,
          ...googleRequest.generationConfig
        }
      });
      return this.converter.convertResponse(result);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  /**
   * Stream response using Vertex AI
   */
  async *streamGenerate(options) {
    try {
      const googleRequest = await this.converter.convertRequest(options);
      const stream = await this.client.models.generateContentStream({
        model: options.model,
        contents: googleRequest.contents,
        config: {
          systemInstruction: googleRequest.systemInstruction,
          tools: googleRequest.tools,
          toolConfig: googleRequest.toolConfig,
          ...googleRequest.generationConfig
        }
      });
      const streamConverter = new GoogleStreamConverter();
      yield* streamConverter.convertStream(stream, options.model);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  /**
   * Get model capabilities
   */
  getModelCapabilities(model) {
    if (model.includes("gemini-3") || model.includes("gemini-2.5") || model.includes("gemini-2.0") || model.includes("gemini-1.5") || model.includes("gemini-pro") || model.includes("gemini-flash")) {
      return {
        supportsTools: true,
        supportsVision: true,
        supportsJSON: true,
        supportsJSONSchema: false,
        maxTokens: 1048576,
        // 1M tokens
        maxOutputTokens: 8192
      };
    }
    return {
      supportsTools: true,
      supportsVision: true,
      supportsJSON: true,
      supportsJSONSchema: false,
      maxTokens: 1048576,
      maxOutputTokens: 8192
    };
  }
  /**
   * Handle Vertex AI-specific errors
   */
  handleError(error) {
    const errorMessage = error.message || "";
    if (error.status === 401 || error.status === 403 || errorMessage.includes("not authenticated") || errorMessage.includes("permission denied")) {
      throw new ProviderAuthError(
        "vertex-ai",
        "Authentication failed. Make sure you have set up Application Default Credentials or provided service account credentials."
      );
    }
    if (error.status === 429 || errorMessage.includes("Resource exhausted")) {
      throw new ProviderRateLimitError("vertex-ai");
    }
    if (errorMessage.includes("context length") || errorMessage.includes("too long")) {
      throw new ProviderContextLengthError("vertex-ai", 1048576);
    }
    throw error;
  }
};

// src/infrastructure/providers/generic/GenericOpenAIProvider.ts
var GenericOpenAIProvider = class extends OpenAITextProvider {
  name;
  capabilities;
  constructor(name, config, capabilities) {
    super(config);
    this.name = name;
    if (capabilities) {
      this.capabilities = {
        text: capabilities.text ?? true,
        images: capabilities.images ?? false,
        videos: capabilities.videos ?? false,
        audio: capabilities.audio ?? false
      };
    } else {
      this.capabilities = {
        text: true,
        images: false,
        // Conservative default
        videos: false,
        audio: false
      };
    }
  }
  /**
   * Override model capabilities for generic providers
   * Can be customized per provider
   */
  getModelCapabilities(model) {
    const hasVision = model.toLowerCase().includes("vision") || model.toLowerCase().includes("llava") || model.toLowerCase().includes("llama-3.2-90b");
    const isLargeContext = model.includes("128k") || model.includes("200k") || model.toLowerCase().includes("longtext");
    return {
      supportsTools: true,
      // Most OpenAI-compatible APIs support tools
      supportsVision: hasVision,
      supportsJSON: true,
      // Most support JSON mode
      supportsJSONSchema: false,
      // Conservative - not all support schema
      maxTokens: isLargeContext ? 128e3 : 32e3,
      // Conservative default
      maxOutputTokens: 4096
      // Common default
    };
  }
};

// src/core/createProvider.ts
function createProvider(connector) {
  const vendor = connector.vendor;
  if (!vendor) {
    throw new Error(
      `Connector '${connector.name}' has no vendor specified. Set vendor to create an AI provider.`
    );
  }
  const config = extractProviderConfig(connector);
  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAITextProvider({
        ...config,
        organization: connector.getOptions().organization,
        project: connector.getOptions().project
      });
    case Vendor.Anthropic:
      return new AnthropicTextProvider({
        ...config,
        anthropicVersion: connector.getOptions().anthropicVersion
      });
    case Vendor.Google:
      return new GoogleTextProvider(config);
    case Vendor.GoogleVertex:
      return new VertexAITextProvider({
        ...config,
        projectId: connector.getOptions().projectId || "",
        location: connector.getOptions().location || "us-central1"
      });
    // OpenAI-compatible providers (use connector.name for unique identification)
    case Vendor.Groq:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || "https://api.groq.com/openai/v1"
      });
    case Vendor.Together:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || "https://api.together.xyz/v1"
      });
    case Vendor.Perplexity:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || "https://api.perplexity.ai"
      });
    case Vendor.Grok:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || "https://api.x.ai/v1"
      });
    case Vendor.DeepSeek:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || "https://api.deepseek.com/v1"
      });
    case Vendor.Mistral:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || "https://api.mistral.ai/v1"
      });
    case Vendor.Ollama:
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL || "http://localhost:11434/v1"
      });
    case Vendor.Custom:
      if (!config.baseURL) {
        throw new Error(
          `Connector '${connector.name}' with Custom vendor requires baseURL`
        );
      }
      return new GenericOpenAIProvider(connector.name, {
        ...config,
        baseURL: config.baseURL
      });
    default:
      throw new Error(`Unknown vendor: ${vendor}`);
  }
}
function extractProviderConfig(connector) {
  const auth = connector.config.auth;
  let apiKey;
  if (auth.type === "api_key") {
    apiKey = auth.apiKey;
  } else if (auth.type === "oauth") {
    throw new Error(
      `Connector '${connector.name}' uses OAuth. Call connector.getToken() to get the access token first.`
    );
  } else if (auth.type === "jwt") {
    throw new Error(
      `Connector '${connector.name}' uses JWT auth. JWT auth for AI providers is not yet supported.`
    );
  } else {
    throw new Error(`Unknown auth type for connector '${connector.name}'`);
  }
  return {
    apiKey,
    baseURL: connector.config.baseURL,
    timeout: connector.getOptions().timeout,
    maxRetries: connector.getOptions().maxRetries
  };
}
var ToolManager = class extends EventEmitter$1 {
  registry = /* @__PURE__ */ new Map();
  namespaceIndex = /* @__PURE__ */ new Map();
  constructor() {
    super();
    this.namespaceIndex.set("default", /* @__PURE__ */ new Set());
  }
  // ==========================================================================
  // Registration
  // ==========================================================================
  /**
   * Register a tool with optional configuration
   */
  register(tool, options = {}) {
    const name = this.getToolName(tool);
    if (this.registry.has(name)) {
      const existing = this.registry.get(name);
      existing.tool = tool;
      if (options.enabled !== void 0) existing.enabled = options.enabled;
      if (options.namespace !== void 0) {
        this.moveToNamespace(name, existing.namespace, options.namespace);
        existing.namespace = options.namespace;
      }
      if (options.priority !== void 0) existing.priority = options.priority;
      if (options.conditions !== void 0) existing.conditions = options.conditions;
      return;
    }
    const namespace = options.namespace ?? "default";
    const registration = {
      tool,
      enabled: options.enabled ?? true,
      namespace,
      priority: options.priority ?? 0,
      conditions: options.conditions ?? [],
      metadata: {
        registeredAt: /* @__PURE__ */ new Date(),
        usageCount: 0,
        totalExecutionMs: 0,
        avgExecutionMs: 0,
        successCount: 0,
        failureCount: 0
      }
    };
    this.registry.set(name, registration);
    this.addToNamespace(name, namespace);
    this.emit("tool:registered", { name, namespace, enabled: registration.enabled });
  }
  /**
   * Register multiple tools at once
   */
  registerMany(tools, options = {}) {
    for (const tool of tools) {
      this.register(tool, options);
    }
  }
  /**
   * Unregister a tool by name
   */
  unregister(name) {
    const registration = this.registry.get(name);
    if (!registration) return false;
    this.removeFromNamespace(name, registration.namespace);
    this.registry.delete(name);
    this.emit("tool:unregistered", { name });
    return true;
  }
  /**
   * Clear all tools
   */
  clear() {
    this.registry.clear();
    this.namespaceIndex.clear();
    this.namespaceIndex.set("default", /* @__PURE__ */ new Set());
  }
  // ==========================================================================
  // Enable/Disable
  // ==========================================================================
  /**
   * Enable a tool by name
   */
  enable(name) {
    const registration = this.registry.get(name);
    if (!registration) return false;
    if (!registration.enabled) {
      registration.enabled = true;
      this.emit("tool:enabled", { name });
    }
    return true;
  }
  /**
   * Disable a tool by name (keeps it registered but inactive)
   */
  disable(name) {
    const registration = this.registry.get(name);
    if (!registration) return false;
    if (registration.enabled) {
      registration.enabled = false;
      this.emit("tool:disabled", { name });
    }
    return true;
  }
  /**
   * Toggle a tool's enabled state
   */
  toggle(name) {
    const registration = this.registry.get(name);
    if (!registration) return false;
    registration.enabled = !registration.enabled;
    this.emit(registration.enabled ? "tool:enabled" : "tool:disabled", { name });
    return registration.enabled;
  }
  /**
   * Check if a tool is enabled
   */
  isEnabled(name) {
    const registration = this.registry.get(name);
    return registration?.enabled ?? false;
  }
  /**
   * Set enabled state for multiple tools
   */
  setEnabled(names, enabled) {
    for (const name of names) {
      if (enabled) {
        this.enable(name);
      } else {
        this.disable(name);
      }
    }
  }
  // ==========================================================================
  // Namespaces
  // ==========================================================================
  /**
   * Set the namespace for a tool
   */
  setNamespace(toolName, namespace) {
    const registration = this.registry.get(toolName);
    if (!registration) return false;
    const oldNamespace = registration.namespace;
    if (oldNamespace === namespace) return true;
    this.moveToNamespace(toolName, oldNamespace, namespace);
    registration.namespace = namespace;
    return true;
  }
  /**
   * Enable all tools in a namespace
   */
  enableNamespace(namespace) {
    const tools = this.namespaceIndex.get(namespace);
    if (!tools) return;
    for (const name of tools) {
      this.enable(name);
    }
    this.emit("namespace:enabled", { namespace });
  }
  /**
   * Disable all tools in a namespace
   */
  disableNamespace(namespace) {
    const tools = this.namespaceIndex.get(namespace);
    if (!tools) return;
    for (const name of tools) {
      this.disable(name);
    }
    this.emit("namespace:disabled", { namespace });
  }
  /**
   * Get all namespace names
   */
  getNamespaces() {
    return Array.from(this.namespaceIndex.keys());
  }
  /**
   * Create a namespace with tools
   */
  createNamespace(namespace, tools, options = {}) {
    for (const tool of tools) {
      this.register(tool, { ...options, namespace });
    }
  }
  // ==========================================================================
  // Priority
  // ==========================================================================
  /**
   * Set priority for a tool
   */
  setPriority(name, priority) {
    const registration = this.registry.get(name);
    if (!registration) return false;
    registration.priority = priority;
    return true;
  }
  /**
   * Get priority for a tool
   */
  getPriority(name) {
    return this.registry.get(name)?.priority;
  }
  // ==========================================================================
  // Query
  // ==========================================================================
  /**
   * Get a tool by name
   */
  get(name) {
    return this.registry.get(name)?.tool;
  }
  /**
   * Check if a tool exists
   */
  has(name) {
    return this.registry.has(name);
  }
  /**
   * Get all enabled tools (sorted by priority)
   */
  getEnabled() {
    return this.getSortedByPriority().filter((reg) => reg.enabled).map((reg) => reg.tool);
  }
  /**
   * Get all tools (enabled and disabled)
   */
  getAll() {
    return Array.from(this.registry.values()).map((reg) => reg.tool);
  }
  /**
   * Get tools by namespace
   */
  getByNamespace(namespace) {
    const toolNames = this.namespaceIndex.get(namespace);
    if (!toolNames) return [];
    return Array.from(toolNames).map((name) => this.registry.get(name)).filter((reg) => reg.enabled).sort((a, b) => b.priority - a.priority).map((reg) => reg.tool);
  }
  /**
   * Get tool registration info
   */
  getRegistration(name) {
    return this.registry.get(name);
  }
  /**
   * List all tool names
   */
  list() {
    return Array.from(this.registry.keys());
  }
  /**
   * List enabled tool names
   */
  listEnabled() {
    return Array.from(this.registry.entries()).filter(([_, reg]) => reg.enabled).map(([name]) => name);
  }
  /**
   * Get count of registered tools
   */
  get size() {
    return this.registry.size;
  }
  // ==========================================================================
  // Selection
  // ==========================================================================
  /**
   * Select tools based on context (uses conditions and smart filtering)
   */
  selectForContext(context) {
    const sorted = this.getSortedByPriority();
    const selected = [];
    for (const reg of sorted) {
      if (!reg.enabled) continue;
      if (reg.conditions.length > 0) {
        const allConditionsMet = reg.conditions.every((cond) => cond.predicate(context));
        if (!allConditionsMet) continue;
      }
      if (context.recentTools?.includes(this.getToolName(reg.tool))) {
        continue;
      }
      selected.push(reg.tool);
    }
    if (context.tokenBudget !== void 0) {
      return this.filterByTokenBudget(selected, context.tokenBudget);
    }
    return selected;
  }
  /**
   * Select tools by matching capability description
   */
  selectByCapability(description) {
    const lowerDesc = description.toLowerCase();
    const keywords = lowerDesc.split(/\s+/);
    return this.getEnabled().filter((tool) => {
      const toolDesc = (tool.definition.function.description ?? "").toLowerCase();
      const toolName = tool.definition.function.name.toLowerCase();
      return keywords.some((kw) => toolDesc.includes(kw) || toolName.includes(kw));
    });
  }
  /**
   * Filter tools to fit within a token budget
   */
  selectWithinBudget(budget) {
    return this.filterByTokenBudget(this.getEnabled(), budget);
  }
  // ==========================================================================
  // Execution Tracking
  // ==========================================================================
  /**
   * Record tool execution (called by agent/loop)
   */
  recordExecution(name, executionMs, success) {
    const registration = this.registry.get(name);
    if (!registration) return;
    const meta = registration.metadata;
    meta.usageCount++;
    meta.lastUsed = /* @__PURE__ */ new Date();
    meta.totalExecutionMs += executionMs;
    meta.avgExecutionMs = meta.totalExecutionMs / meta.usageCount;
    if (success) {
      meta.successCount++;
    } else {
      meta.failureCount++;
    }
    this.emit("tool:executed", {
      name,
      executionMs,
      success,
      totalUsage: meta.usageCount
    });
  }
  // ==========================================================================
  // Statistics
  // ==========================================================================
  /**
   * Get comprehensive statistics
   */
  getStats() {
    const registrations = Array.from(this.registry.values());
    const enabledCount = registrations.filter((r) => r.enabled).length;
    const toolsByNamespace = {};
    for (const [ns, tools] of this.namespaceIndex) {
      toolsByNamespace[ns] = tools.size;
    }
    const mostUsed = registrations.filter((r) => r.metadata.usageCount > 0).sort((a, b) => b.metadata.usageCount - a.metadata.usageCount).slice(0, 10).map((r) => ({
      name: this.getToolName(r.tool),
      count: r.metadata.usageCount
    }));
    const totalExecutions = registrations.reduce((sum, r) => sum + r.metadata.usageCount, 0);
    return {
      totalTools: this.registry.size,
      enabledTools: enabledCount,
      disabledTools: this.registry.size - enabledCount,
      namespaces: this.getNamespaces(),
      toolsByNamespace,
      mostUsed,
      totalExecutions
    };
  }
  // ==========================================================================
  // Persistence
  // ==========================================================================
  /**
   * Get serializable state (for session persistence)
   */
  getState() {
    const enabled = {};
    const namespaces = {};
    const priorities = {};
    for (const [name, reg] of this.registry) {
      enabled[name] = reg.enabled;
      namespaces[name] = reg.namespace;
      priorities[name] = reg.priority;
    }
    return { enabled, namespaces, priorities };
  }
  /**
   * Load state (restores enabled/disabled, namespaces, priorities)
   * Note: Tools must be re-registered separately (they contain functions)
   */
  loadState(state) {
    for (const [name, isEnabled] of Object.entries(state.enabled)) {
      const reg = this.registry.get(name);
      if (reg) {
        reg.enabled = isEnabled;
      }
    }
    for (const [name, namespace] of Object.entries(state.namespaces)) {
      this.setNamespace(name, namespace);
    }
    for (const [name, priority] of Object.entries(state.priorities)) {
      this.setPriority(name, priority);
    }
  }
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  getToolName(tool) {
    return tool.definition.function.name;
  }
  getSortedByPriority() {
    return Array.from(this.registry.values()).sort((a, b) => b.priority - a.priority);
  }
  addToNamespace(toolName, namespace) {
    if (!this.namespaceIndex.has(namespace)) {
      this.namespaceIndex.set(namespace, /* @__PURE__ */ new Set());
    }
    this.namespaceIndex.get(namespace).add(toolName);
  }
  removeFromNamespace(toolName, namespace) {
    this.namespaceIndex.get(namespace)?.delete(toolName);
  }
  moveToNamespace(toolName, oldNamespace, newNamespace) {
    this.removeFromNamespace(toolName, oldNamespace);
    this.addToNamespace(toolName, newNamespace);
  }
  filterByTokenBudget(tools, budget) {
    const result = [];
    let usedTokens = 0;
    for (const tool of tools) {
      const toolTokens = this.estimateToolTokens(tool);
      if (usedTokens + toolTokens <= budget) {
        result.push(tool);
        usedTokens += toolTokens;
      }
    }
    return result;
  }
  estimateToolTokens(tool) {
    const def = tool.definition.function;
    const nameTokens = Math.ceil((def.name?.length ?? 0) / 4);
    const descTokens = Math.ceil((def.description?.length ?? 0) / 4);
    const paramTokens = def.parameters ? Math.ceil(JSON.stringify(def.parameters).length / 4) : 0;
    return nameTokens + descTokens + paramTokens + 20;
  }
};
var SessionManager = class extends EventEmitter$1 {
  storage;
  defaultMetadata;
  autoSaveTimers = /* @__PURE__ */ new Map();
  constructor(config) {
    super();
    this.storage = config.storage;
    this.defaultMetadata = config.defaultMetadata ?? {};
  }
  // ==========================================================================
  // Lifecycle
  // ==========================================================================
  /**
   * Create a new session
   */
  create(agentType, metadata) {
    const now = /* @__PURE__ */ new Date();
    const session = {
      id: this.generateId(),
      agentType,
      createdAt: now,
      lastActiveAt: now,
      history: { version: 1, entries: [] },
      toolState: { enabled: {}, namespaces: {}, priorities: {} },
      custom: {},
      metadata: {
        ...this.defaultMetadata,
        ...metadata
      }
    };
    this.emit("session:created", { sessionId: session.id, agentType });
    return session;
  }
  /**
   * Save a session to storage
   */
  async save(session) {
    try {
      session.lastActiveAt = /* @__PURE__ */ new Date();
      await this.storage.save(session);
      this.emit("session:saved", { sessionId: session.id });
    } catch (error) {
      this.emit("session:error", { sessionId: session.id, error, operation: "save" });
      throw error;
    }
  }
  /**
   * Load a session from storage
   */
  async load(sessionId) {
    try {
      const session = await this.storage.load(sessionId);
      if (session) {
        session.createdAt = new Date(session.createdAt);
        session.lastActiveAt = new Date(session.lastActiveAt);
        this.emit("session:loaded", { sessionId });
      }
      return session;
    } catch (error) {
      this.emit("session:error", { sessionId, error, operation: "load" });
      throw error;
    }
  }
  /**
   * Delete a session from storage
   */
  async delete(sessionId) {
    try {
      this.stopAutoSave(sessionId);
      await this.storage.delete(sessionId);
      this.emit("session:deleted", { sessionId });
    } catch (error) {
      this.emit("session:error", { sessionId, error, operation: "delete" });
      throw error;
    }
  }
  /**
   * Check if a session exists
   */
  async exists(sessionId) {
    return this.storage.exists(sessionId);
  }
  // ==========================================================================
  // Query
  // ==========================================================================
  /**
   * List sessions with optional filtering
   */
  async list(filter) {
    return this.storage.list(filter);
  }
  /**
   * Search sessions by query string
   */
  async search(query, filter) {
    if (this.storage.search) {
      return this.storage.search(query, filter);
    }
    const all = await this.storage.list(filter);
    const lowerQuery = query.toLowerCase();
    return all.filter(
      (s) => s.metadata.title?.toLowerCase().includes(lowerQuery) || s.metadata.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }
  // ==========================================================================
  // Advanced Operations
  // ==========================================================================
  /**
   * Fork a session (create a copy with new ID)
   */
  async fork(sessionId, newMetadata) {
    const original = await this.load(sessionId);
    if (!original) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const forked = {
      ...original,
      id: this.generateId(),
      createdAt: /* @__PURE__ */ new Date(),
      lastActiveAt: /* @__PURE__ */ new Date(),
      metadata: {
        ...original.metadata,
        ...newMetadata,
        forkedFrom: sessionId
      },
      // Deep clone mutable fields
      history: JSON.parse(JSON.stringify(original.history)),
      toolState: JSON.parse(JSON.stringify(original.toolState)),
      custom: JSON.parse(JSON.stringify(original.custom))
    };
    if (original.memory) {
      forked.memory = JSON.parse(JSON.stringify(original.memory));
    }
    if (original.plan) {
      forked.plan = JSON.parse(JSON.stringify(original.plan));
    }
    await this.save(forked);
    return forked;
  }
  /**
   * Update session metadata
   */
  async updateMetadata(sessionId, metadata) {
    const session = await this.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.metadata = { ...session.metadata, ...metadata };
    await this.save(session);
  }
  // ==========================================================================
  // Auto-Save
  // ==========================================================================
  /**
   * Enable auto-save for a session
   */
  enableAutoSave(session, intervalMs, onSave) {
    this.stopAutoSave(session.id);
    const timer = setInterval(async () => {
      try {
        await this.save(session);
        onSave?.(session);
      } catch (error) {
        this.emit("session:error", {
          sessionId: session.id,
          error,
          operation: "auto-save"
        });
      }
    }, intervalMs);
    this.autoSaveTimers.set(session.id, timer);
  }
  /**
   * Disable auto-save for a session
   */
  stopAutoSave(sessionId) {
    const timer = this.autoSaveTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.autoSaveTimers.delete(sessionId);
    }
  }
  /**
   * Stop all auto-save timers
   */
  stopAllAutoSave() {
    for (const timer of this.autoSaveTimers.values()) {
      clearInterval(timer);
    }
    this.autoSaveTimers.clear();
  }
  // ==========================================================================
  // Utilities
  // ==========================================================================
  /**
   * Generate a unique session ID
   */
  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `sess_${timestamp}_${random}`;
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAllAutoSave();
    this.removeAllListeners();
  }
};
function createEmptyHistory() {
  return { version: 1, entries: [] };
}
function createEmptyMemory() {
  return { version: 1, entries: [] };
}
function addHistoryEntry(history, type, content, metadata) {
  history.entries.push({
    type,
    content,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    metadata
  });
}

// src/capabilities/agents/ToolRegistry.ts
var ToolRegistry = class {
  tools = /* @__PURE__ */ new Map();
  circuitBreakers = /* @__PURE__ */ new Map();
  logger;
  constructor() {
    this.logger = logger.child({ component: "ToolRegistry" });
  }
  /**
   * Register a new tool
   */
  registerTool(tool) {
    this.tools.set(tool.definition.function.name, tool);
  }
  /**
   * Unregister a tool
   */
  unregisterTool(toolName) {
    this.tools.delete(toolName);
  }
  /**
   * Get or create circuit breaker for a tool
   */
  getCircuitBreaker(toolName, tool) {
    let breaker = this.circuitBreakers.get(toolName);
    if (!breaker) {
      const config = tool.circuitBreaker || {
        failureThreshold: 3,
        successThreshold: 2,
        resetTimeoutMs: 6e4,
        // 1 minute
        windowMs: 3e5
        // 5 minutes
      };
      breaker = new CircuitBreaker(`tool:${toolName}`, config);
      breaker.on("opened", (data) => {
        this.logger.warn(data, `Circuit breaker opened for tool: ${toolName}`);
        metrics.increment("circuit_breaker.opened", 1, {
          breaker: data.name,
          tool: toolName
        });
      });
      breaker.on("closed", (data) => {
        this.logger.info(data, `Circuit breaker closed for tool: ${toolName}`);
        metrics.increment("circuit_breaker.closed", 1, {
          breaker: data.name,
          tool: toolName
        });
      });
      this.circuitBreakers.set(toolName, breaker);
    }
    return breaker;
  }
  /**
   * Execute a tool function
   */
  async execute(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new ToolNotFoundError(toolName);
    }
    const breaker = this.getCircuitBreaker(toolName, tool);
    this.logger.debug({ toolName, args }, "Tool execution started");
    const startTime = Date.now();
    metrics.increment("tool.executed", 1, { tool: toolName });
    try {
      const result = await breaker.execute(async () => {
        return await tool.execute(args);
      });
      const duration = Date.now() - startTime;
      this.logger.debug({ toolName, duration }, "Tool execution completed");
      metrics.timing("tool.duration", duration, { tool: toolName });
      metrics.increment("tool.success", 1, { tool: toolName });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        toolName,
        error: error.message,
        duration
      }, "Tool execution failed");
      metrics.increment("tool.failed", 1, {
        tool: toolName,
        error: error.name
      });
      throw new ToolExecutionError(
        toolName,
        error.message,
        error
      );
    }
  }
  /**
   * Check if tool is available
   */
  hasToolFunction(toolName) {
    return this.tools.has(toolName);
  }
  /**
   * Get tool definition
   */
  getToolDefinition(toolName) {
    const tool = this.tools.get(toolName);
    return tool?.definition;
  }
  /**
   * List all registered tools
   */
  listTools() {
    return Array.from(this.tools.keys());
  }
  /**
   * Clear all registered tools
   */
  clear() {
    this.tools.clear();
    this.circuitBreakers.clear();
  }
  /**
   * Get circuit breaker states for all tools
   */
  getCircuitBreakerStates() {
    const states = /* @__PURE__ */ new Map();
    for (const [toolName, breaker] of this.circuitBreakers.entries()) {
      states.set(toolName, breaker.getState());
    }
    return states;
  }
  /**
   * Get circuit breaker metrics for a specific tool
   */
  getToolCircuitBreakerMetrics(toolName) {
    const breaker = this.circuitBreakers.get(toolName);
    return breaker?.getMetrics();
  }
  /**
   * Manually reset a tool's circuit breaker
   */
  resetToolCircuitBreaker(toolName) {
    const breaker = this.circuitBreakers.get(toolName);
    if (breaker) {
      breaker.reset();
      this.logger.info({ toolName }, "Tool circuit breaker manually reset");
    }
  }
};

// src/domain/entities/Tool.ts
var ToolCallState = /* @__PURE__ */ ((ToolCallState2) => {
  ToolCallState2["PENDING"] = "pending";
  ToolCallState2["EXECUTING"] = "executing";
  ToolCallState2["COMPLETED"] = "completed";
  ToolCallState2["FAILED"] = "failed";
  ToolCallState2["TIMEOUT"] = "timeout";
  return ToolCallState2;
})(ToolCallState || {});

// src/capabilities/agents/ExecutionContext.ts
var ExecutionContext = class {
  // Execution metadata
  executionId;
  startTime;
  iteration = 0;
  // Tool tracking
  toolCalls = /* @__PURE__ */ new Map();
  toolResults = /* @__PURE__ */ new Map();
  // Control state
  paused = false;
  pauseReason;
  cancelled = false;
  cancelReason;
  // User data (for hooks to share state)
  metadata = /* @__PURE__ */ new Map();
  // History storage (memory-safe)
  config;
  iterations = [];
  iterationSummaries = [];
  // Metrics
  metrics = {
    totalDuration: 0,
    llmDuration: 0,
    toolDuration: 0,
    hookDuration: 0,
    iterationCount: 0,
    toolCallCount: 0,
    toolSuccessCount: 0,
    toolFailureCount: 0,
    toolTimeoutCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    errors: []
  };
  // Audit trail
  auditTrail = [];
  constructor(executionId, config = {}) {
    this.executionId = executionId;
    this.startTime = /* @__PURE__ */ new Date();
    this.config = {
      maxHistorySize: config.maxHistorySize || 10,
      historyMode: config.historyMode || "summary",
      maxAuditTrailSize: config.maxAuditTrailSize || 1e3
    };
  }
  /**
   * Add iteration to history (memory-safe)
   */
  addIteration(record) {
    switch (this.config.historyMode) {
      case "none":
        break;
      case "summary":
        this.iterationSummaries.push({
          iteration: record.iteration,
          tokens: record.response.usage.total_tokens,
          toolCount: record.toolCalls.length,
          duration: record.endTime.getTime() - record.startTime.getTime(),
          timestamp: record.startTime
        });
        if (this.iterationSummaries.length > this.config.maxHistorySize) {
          this.iterationSummaries.shift();
        }
        break;
      case "full":
        this.iterations.push(record);
        if (this.iterations.length > this.config.maxHistorySize) {
          this.iterations.shift();
        }
        break;
    }
  }
  /**
   * Get iteration history
   */
  getHistory() {
    return this.config.historyMode === "full" ? this.iterations : this.iterationSummaries;
  }
  /**
   * Add audit entry
   */
  audit(type, details, hookName, toolName) {
    this.auditTrail.push({
      timestamp: /* @__PURE__ */ new Date(),
      type,
      hookName,
      toolName,
      details
    });
    if (this.auditTrail.length > this.config.maxAuditTrailSize) {
      this.auditTrail.shift();
    }
  }
  /**
   * Get audit trail
   */
  getAuditTrail() {
    return this.auditTrail;
  }
  /**
   * Update metrics
   */
  updateMetrics(update) {
    Object.assign(this.metrics, update);
  }
  /**
   * Add tool call to tracking
   */
  addToolCall(toolCall) {
    this.toolCalls.set(toolCall.id, toolCall);
    this.metrics.toolCallCount++;
  }
  /**
   * Add tool result to tracking
   */
  addToolResult(result) {
    this.toolResults.set(result.tool_use_id, result);
    if (result.state === "completed" /* COMPLETED */) {
      this.metrics.toolSuccessCount++;
    } else if (result.state === "failed" /* FAILED */) {
      this.metrics.toolFailureCount++;
    } else if (result.state === "timeout" /* TIMEOUT */) {
      this.metrics.toolTimeoutCount++;
    }
  }
  /**
   * Check resource limits
   */
  checkLimits(limits) {
    if (!limits) return;
    if (limits.maxExecutionTime) {
      const elapsed = Date.now() - this.startTime.getTime();
      if (elapsed > limits.maxExecutionTime) {
        throw new Error(
          `Execution time limit exceeded: ${elapsed}ms > ${limits.maxExecutionTime}ms`
        );
      }
    }
    if (limits.maxToolCalls && this.toolCalls.size > limits.maxToolCalls) {
      throw new Error(
        `Tool call limit exceeded: ${this.toolCalls.size} > ${limits.maxToolCalls}`
      );
    }
    if (limits.maxContextSize) {
      const size = this.estimateSize();
      if (size > limits.maxContextSize) {
        throw new Error(
          `Context size limit exceeded: ${size} bytes > ${limits.maxContextSize} bytes`
        );
      }
    }
  }
  /**
   * Estimate memory usage (rough approximation)
   */
  estimateSize() {
    try {
      const data = {
        toolCalls: Array.from(this.toolCalls.values()),
        toolResults: Array.from(this.toolResults.values()),
        iterations: this.config.historyMode === "full" ? this.iterations : this.iterationSummaries,
        auditTrail: this.auditTrail
      };
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
  /**
   * Cleanup resources and release memory
   * Clears all internal arrays and maps to allow garbage collection
   */
  cleanup() {
    const summary = {
      executionId: this.executionId,
      totalIterations: this.iteration,
      totalToolCalls: this.metrics.toolCallCount,
      totalDuration: Date.now() - this.startTime.getTime(),
      success: !this.cancelled && this.metrics.errors.length === 0
    };
    this.toolCalls.clear();
    this.toolResults.clear();
    this.metadata.clear();
    this.iterations.length = 0;
    this.iterationSummaries.length = 0;
    this.auditTrail.length = 0;
    this.metrics.errors.length = 0;
    this.metadata.set("execution_summary", summary);
  }
  /**
   * Get execution summary
   */
  getSummary() {
    return {
      executionId: this.executionId,
      startTime: this.startTime,
      currentIteration: this.iteration,
      paused: this.paused,
      cancelled: this.cancelled,
      metrics: { ...this.metrics },
      totalDuration: Date.now() - this.startTime.getTime()
    };
  }
};

// src/capabilities/agents/HookManager.ts
var HookManager = class {
  hooks = /* @__PURE__ */ new Map();
  timeout;
  parallel;
  // Per-hook error tracking: hookKey -> consecutive error count
  hookErrorCounts = /* @__PURE__ */ new Map();
  // Disabled hooks that exceeded error threshold
  disabledHooks = /* @__PURE__ */ new Set();
  maxConsecutiveErrors = 3;
  emitter;
  constructor(config = {}, emitter, errorHandling) {
    this.timeout = config.hookTimeout || 5e3;
    this.parallel = config.parallelHooks || false;
    this.emitter = emitter;
    this.maxConsecutiveErrors = errorHandling?.maxConsecutiveErrors || 3;
    this.registerFromConfig(config);
  }
  /**
   * Register hooks from configuration
   */
  registerFromConfig(config) {
    const hookNames = [
      "before:execution",
      "after:execution",
      "before:llm",
      "after:llm",
      "before:tool",
      "after:tool",
      "approve:tool",
      "pause:check"
    ];
    for (const name of hookNames) {
      const hook = config[name];
      if (hook) {
        this.register(name, hook);
      }
    }
  }
  /**
   * Register a hook
   */
  register(name, hook) {
    if (typeof hook !== "function") {
      throw new Error(`Hook must be a function, got: ${typeof hook}`);
    }
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    const existing = this.hooks.get(name);
    if (existing.length >= 10) {
      throw new Error(`Too many hooks for ${name} (max: 10)`);
    }
    existing.push(hook);
  }
  /**
   * Execute hooks for a given name
   */
  async executeHooks(name, context, defaultResult) {
    const hooks = this.hooks.get(name);
    if (!hooks || hooks.length === 0) {
      return defaultResult;
    }
    if (this.parallel && hooks.length > 1) {
      return this.executeHooksParallel(hooks, context, defaultResult);
    }
    return this.executeHooksSequential(hooks, context, defaultResult);
  }
  /**
   * Execute hooks sequentially
   */
  async executeHooksSequential(hooks, context, defaultResult) {
    let result = defaultResult;
    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i];
      const hookKey = this.getHookKey(hook, i);
      const hookResult = await this.executeHookSafely(hook, context, hookKey);
      if (hookResult === null) {
        continue;
      }
      result = { ...result, ...hookResult };
      if (hookResult.skip === true) {
        break;
      }
    }
    return result;
  }
  /**
   * Execute hooks in parallel
   */
  async executeHooksParallel(hooks, context, defaultResult) {
    const results = await Promise.all(
      hooks.map((hook, i) => {
        const hookKey = this.getHookKey(hook, i);
        return this.executeHookSafely(hook, context, hookKey);
      })
    );
    const validResults = results.filter((r) => r !== null);
    return validResults.reduce(
      (acc, hookResult) => ({ ...acc, ...hookResult }),
      defaultResult
    );
  }
  /**
   * Generate unique key for a hook
   */
  getHookKey(hook, index) {
    return `${hook.name || "anonymous"}_${index}`;
  }
  /**
   * Execute single hook with error isolation and timeout (with per-hook error tracking)
   */
  async executeHookSafely(hook, context, hookKey) {
    const key = hookKey || hook.name || "anonymous";
    if (this.disabledHooks.has(key)) {
      return null;
    }
    const startTime = Date.now();
    try {
      const result = await Promise.race([
        hook(context),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error("Hook timeout")), this.timeout)
        )
      ]);
      this.hookErrorCounts.delete(key);
      const duration = Date.now() - startTime;
      if (context.context?.updateMetrics) {
        context.context.updateMetrics({
          hookDuration: (context.context.metrics.hookDuration || 0) + duration
        });
      }
      return result;
    } catch (error) {
      const errorCount = (this.hookErrorCounts.get(key) || 0) + 1;
      this.hookErrorCounts.set(key, errorCount);
      this.emitter.emit("hook:error", {
        executionId: context.executionId,
        hookName: hook.name || "anonymous",
        error,
        consecutiveErrors: errorCount,
        timestamp: /* @__PURE__ */ new Date()
      });
      if (errorCount >= this.maxConsecutiveErrors) {
        this.disabledHooks.add(key);
        console.warn(
          `Hook "${key}" disabled after ${errorCount} consecutive failures. Last error: ${error.message}`
        );
      } else {
        console.warn(
          `Hook execution failed (${key}): ${error.message} (${errorCount}/${this.maxConsecutiveErrors} errors)`
        );
      }
      return null;
    }
  }
  /**
   * Check if there are any hooks registered
   */
  hasHooks(name) {
    const hooks = this.hooks.get(name);
    return !!hooks && hooks.length > 0;
  }
  /**
   * Get hook count
   */
  getHookCount(name) {
    if (name) {
      return this.hooks.get(name)?.length || 0;
    }
    return Array.from(this.hooks.values()).reduce((sum, arr) => sum + arr.length, 0);
  }
  /**
   * Clear all hooks and reset error tracking
   */
  clear() {
    this.hooks.clear();
    this.hookErrorCounts.clear();
    this.disabledHooks.clear();
  }
  /**
   * Re-enable a disabled hook
   */
  enableHook(hookKey) {
    this.disabledHooks.delete(hookKey);
    this.hookErrorCounts.delete(hookKey);
  }
  /**
   * Get list of disabled hooks
   */
  getDisabledHooks() {
    return Array.from(this.disabledHooks);
  }
};

// src/domain/entities/StreamState.ts
var StreamState = class {
  // Core identifiers
  responseId;
  model;
  createdAt;
  // Text accumulation: item_id -> text chunks
  textBuffers;
  // Tool call accumulation: tool_call_id -> buffer
  toolCallBuffers;
  // Completed tool calls
  completedToolCalls;
  // Tool execution results
  toolResults;
  // Metadata
  currentIteration;
  usage;
  status;
  startTime;
  endTime;
  // Statistics
  totalChunks;
  totalTextDeltas;
  totalToolCalls;
  constructor(responseId, model, createdAt) {
    this.responseId = responseId;
    this.model = model;
    this.createdAt = createdAt || Date.now();
    this.textBuffers = /* @__PURE__ */ new Map();
    this.toolCallBuffers = /* @__PURE__ */ new Map();
    this.completedToolCalls = [];
    this.toolResults = /* @__PURE__ */ new Map();
    this.currentIteration = 0;
    this.usage = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0
    };
    this.status = "in_progress";
    this.startTime = /* @__PURE__ */ new Date();
    this.totalChunks = 0;
    this.totalTextDeltas = 0;
    this.totalToolCalls = 0;
  }
  /**
   * Accumulate text delta for a specific item
   */
  accumulateTextDelta(itemId, delta) {
    if (!this.textBuffers.has(itemId)) {
      this.textBuffers.set(itemId, []);
    }
    this.textBuffers.get(itemId).push(delta);
    this.totalTextDeltas++;
    this.totalChunks++;
  }
  /**
   * Get complete accumulated text for an item
   */
  getCompleteText(itemId) {
    const chunks = this.textBuffers.get(itemId);
    return chunks ? chunks.join("") : "";
  }
  /**
   * Get all accumulated text (all items concatenated)
   */
  getAllText() {
    const allText = [];
    for (const chunks of this.textBuffers.values()) {
      allText.push(chunks.join(""));
    }
    return allText.join("");
  }
  /**
   * Start accumulating tool call arguments
   */
  startToolCall(toolCallId, toolName) {
    this.toolCallBuffers.set(toolCallId, {
      toolName,
      argumentChunks: [],
      isComplete: false,
      startTime: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Accumulate tool argument delta
   */
  accumulateToolArguments(toolCallId, delta) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    if (!buffer) {
      throw new Error(`Tool call buffer not found for id: ${toolCallId}`);
    }
    buffer.argumentChunks.push(delta);
    this.totalChunks++;
  }
  /**
   * Mark tool call arguments as complete
   */
  completeToolCall(toolCallId) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    if (!buffer) {
      throw new Error(`Tool call buffer not found for id: ${toolCallId}`);
    }
    buffer.isComplete = true;
    this.totalToolCalls++;
  }
  /**
   * Get complete tool arguments (joined chunks)
   */
  getCompleteToolArguments(toolCallId) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    if (!buffer) {
      throw new Error(`Tool call buffer not found for id: ${toolCallId}`);
    }
    return buffer.argumentChunks.join("");
  }
  /**
   * Check if tool call is complete
   */
  isToolCallComplete(toolCallId) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    return buffer ? buffer.isComplete : false;
  }
  /**
   * Get tool name for a tool call
   */
  getToolName(toolCallId) {
    return this.toolCallBuffers.get(toolCallId)?.toolName;
  }
  /**
   * Add completed tool call
   */
  addCompletedToolCall(toolCall) {
    this.completedToolCalls.push(toolCall);
  }
  /**
   * Get all completed tool calls
   */
  getCompletedToolCalls() {
    return [...this.completedToolCalls];
  }
  /**
   * Store tool execution result
   */
  setToolResult(toolCallId, result) {
    this.toolResults.set(toolCallId, result);
  }
  /**
   * Get tool execution result
   */
  getToolResult(toolCallId) {
    return this.toolResults.get(toolCallId);
  }
  /**
   * Update token usage (replaces values, doesn't accumulate)
   */
  updateUsage(usage) {
    if (usage.input_tokens !== void 0) {
      this.usage.input_tokens = usage.input_tokens;
    }
    if (usage.output_tokens !== void 0) {
      this.usage.output_tokens = usage.output_tokens;
    }
    if (usage.total_tokens !== void 0) {
      this.usage.total_tokens = usage.total_tokens;
    } else {
      this.usage.total_tokens = this.usage.input_tokens + this.usage.output_tokens;
    }
  }
  /**
   * Accumulate token usage (adds to existing values)
   */
  accumulateUsage(usage) {
    if (usage.input_tokens !== void 0) {
      this.usage.input_tokens += usage.input_tokens;
    }
    if (usage.output_tokens !== void 0) {
      this.usage.output_tokens += usage.output_tokens;
    }
    if (usage.total_tokens !== void 0) {
      this.usage.total_tokens += usage.total_tokens;
    } else {
      this.usage.total_tokens = this.usage.input_tokens + this.usage.output_tokens;
    }
  }
  /**
   * Mark stream as complete
   */
  markComplete(status = "completed") {
    this.status = status;
    this.endTime = /* @__PURE__ */ new Date();
  }
  /**
   * Get duration in milliseconds
   */
  getDuration() {
    const end = this.endTime || /* @__PURE__ */ new Date();
    return end.getTime() - this.startTime.getTime();
  }
  /**
   * Increment iteration counter
   */
  incrementIteration() {
    this.currentIteration++;
  }
  /**
   * Get summary statistics
   */
  getStatistics() {
    return {
      responseId: this.responseId,
      model: this.model,
      status: this.status,
      iterations: this.currentIteration,
      totalChunks: this.totalChunks,
      totalTextDeltas: this.totalTextDeltas,
      totalToolCalls: this.totalToolCalls,
      textItemsCount: this.textBuffers.size,
      toolCallBuffersCount: this.toolCallBuffers.size,
      completedToolCallsCount: this.completedToolCalls.length,
      durationMs: this.getDuration(),
      usage: { ...this.usage }
    };
  }
  /**
   * Check if stream has any accumulated text
   */
  hasText() {
    return this.textBuffers.size > 0;
  }
  /**
   * Check if stream has any tool calls
   */
  hasToolCalls() {
    return this.toolCallBuffers.size > 0;
  }
  /**
   * Clear all buffers (for memory management)
   */
  clear() {
    this.textBuffers.clear();
    this.toolCallBuffers.clear();
    this.completedToolCalls = [];
    this.toolResults.clear();
  }
  /**
   * Create a snapshot for checkpointing (error recovery)
   */
  createSnapshot() {
    return {
      responseId: this.responseId,
      model: this.model,
      createdAt: this.createdAt,
      textBuffers: new Map(this.textBuffers),
      toolCallBuffers: new Map(this.toolCallBuffers),
      completedToolCalls: [...this.completedToolCalls],
      toolResults: new Map(this.toolResults),
      currentIteration: this.currentIteration,
      usage: { ...this.usage },
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }
};

// src/capabilities/agents/AgenticLoop.ts
var AgenticLoop = class extends EventEmitter$2 {
  constructor(provider, toolExecutor, hookConfig, errorHandling) {
    super();
    this.provider = provider;
    this.toolExecutor = toolExecutor;
    this.hookManager = new HookManager(
      hookConfig || {},
      this,
      errorHandling
    );
  }
  hookManager;
  context = null;
  // Pause/resume state
  paused = false;
  pausePromise = null;
  resumeCallback = null;
  cancelled = false;
  // Mutex to prevent race conditions in pause/resume
  pauseResumeMutex = Promise.resolve();
  /**
   * Execute agentic loop with tool calling
   */
  async execute(config) {
    const executionId = `exec_${randomUUID()}`;
    this.context = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: config.historyMode || "summary",
      maxAuditTrailSize: 1e3
    });
    this.paused = false;
    this.cancelled = false;
    this.emit("execution:start", {
      executionId,
      config,
      timestamp: /* @__PURE__ */ new Date()
    });
    await this.hookManager.executeHooks("before:execution", {
      executionId,
      config,
      timestamp: /* @__PURE__ */ new Date()
    }, void 0);
    let currentInput = config.input;
    let iteration = 0;
    let finalResponse;
    try {
      while (iteration < config.maxIterations) {
        await this.checkPause();
        if (this.cancelled) {
          throw new Error("Execution cancelled");
        }
        this.context.checkLimits(config.limits);
        const pauseCheck = await this.hookManager.executeHooks("pause:check", {
          executionId,
          iteration,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, { shouldPause: false });
        if (pauseCheck.shouldPause) {
          this.pause(pauseCheck.reason || "Hook requested pause");
          await this.checkPause();
        }
        this.context.iteration = iteration;
        this.emit("iteration:start", {
          executionId,
          iteration,
          timestamp: /* @__PURE__ */ new Date()
        });
        const iterationStartTime = Date.now();
        const response = await this.generateWithHooks(config, currentInput, iteration, executionId);
        const toolCalls = this.extractToolCalls(response.output, config.tools);
        if (toolCalls.length > 0) {
          this.emit("tool:detected", {
            executionId,
            iteration,
            toolCalls,
            timestamp: /* @__PURE__ */ new Date()
          });
        }
        if (toolCalls.length === 0) {
          this.emit("iteration:complete", {
            executionId,
            iteration,
            response,
            timestamp: /* @__PURE__ */ new Date(),
            duration: Date.now() - iterationStartTime
          });
          finalResponse = response;
          break;
        }
        const toolResults = await this.executeToolsWithHooks(toolCalls, iteration, executionId, config);
        this.context.addIteration({
          iteration,
          request: {
            model: config.model,
            input: currentInput,
            instructions: config.instructions,
            tools: config.tools,
            temperature: config.temperature
          },
          response,
          toolCalls,
          toolResults,
          startTime: new Date(iterationStartTime),
          endTime: /* @__PURE__ */ new Date()
        });
        this.context.updateMetrics({
          iterationCount: iteration + 1,
          inputTokens: this.context.metrics.inputTokens + (response.usage?.input_tokens || 0),
          outputTokens: this.context.metrics.outputTokens + (response.usage?.output_tokens || 0),
          totalTokens: this.context.metrics.totalTokens + (response.usage?.total_tokens || 0)
        });
        this.emit("iteration:complete", {
          executionId,
          iteration,
          response,
          timestamp: /* @__PURE__ */ new Date(),
          duration: Date.now() - iterationStartTime
        });
        const newMessages = this.buildNewMessages(response.output, toolResults);
        currentInput = this.appendToContext(currentInput, newMessages);
        const maxInputMessages = config.limits?.maxInputMessages ?? 50;
        currentInput = this.applySlidingWindow(currentInput, maxInputMessages);
        iteration++;
      }
      if (iteration >= config.maxIterations) {
        throw new Error(`Max iterations (${config.maxIterations}) reached without completion`);
      }
      const totalDuration = Date.now() - this.context.startTime.getTime();
      this.context.updateMetrics({ totalDuration });
      await this.hookManager.executeHooks("after:execution", {
        executionId,
        response: finalResponse,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: totalDuration
      }, void 0);
      this.emit("execution:complete", {
        executionId,
        response: finalResponse,
        timestamp: /* @__PURE__ */ new Date(),
        duration: totalDuration
      });
      return finalResponse;
    } catch (error) {
      this.emit("execution:error", {
        executionId,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      this.context?.metrics.errors.push({
        type: "execution_error",
        message: error.message,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    } finally {
      this.context?.cleanup();
      this.hookManager.clear();
    }
  }
  /**
   * Execute agentic loop with streaming and tool calling
   */
  async *executeStreaming(config) {
    const executionId = `exec_${randomUUID()}`;
    this.context = new ExecutionContext(executionId, {
      maxHistorySize: 10,
      historyMode: config.historyMode || "summary",
      maxAuditTrailSize: 1e3
    });
    this.paused = false;
    this.cancelled = false;
    this.pausePromise = null;
    this.resumeCallback = null;
    const startTime = Date.now();
    let iteration = 0;
    let currentInput = config.input;
    const globalStreamState = new StreamState(executionId, config.model);
    try {
      this.emit("execution:start", {
        executionId,
        model: config.model,
        timestamp: /* @__PURE__ */ new Date()
      });
      await this.hookManager.executeHooks("before:execution", {
        executionId,
        config,
        timestamp: /* @__PURE__ */ new Date()
      }, void 0);
      while (iteration < config.maxIterations) {
        iteration++;
        await this.checkPause();
        if (this.cancelled) {
          this.emit("execution:cancelled", { executionId, iteration, timestamp: /* @__PURE__ */ new Date() });
          break;
        }
        if (this.context) {
          this.context.checkLimits(config.limits);
        }
        const pauseCheck = await this.hookManager.executeHooks("pause:check", {
          executionId,
          iteration,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, { shouldPause: false });
        if (pauseCheck.shouldPause) {
          this.pause();
        }
        this.emit("iteration:start", {
          executionId,
          iteration,
          timestamp: /* @__PURE__ */ new Date()
        });
        const iterationStreamState = new StreamState(executionId, config.model);
        const toolCallsMap = /* @__PURE__ */ new Map();
        yield* this.streamGenerateWithHooks(config, currentInput, iteration, executionId, iterationStreamState, toolCallsMap);
        globalStreamState.accumulateUsage(iterationStreamState.usage);
        const toolCalls = [];
        for (const [toolCallId, buffer] of toolCallsMap) {
          toolCalls.push({
            id: toolCallId,
            type: "function",
            function: {
              name: buffer.name,
              arguments: buffer.args
            },
            blocking: true,
            state: "pending" /* PENDING */
          });
        }
        if (toolCalls.length === 0) {
          yield {
            type: "response.iteration.complete" /* ITERATION_COMPLETE */,
            response_id: executionId,
            iteration,
            tool_calls_count: 0,
            has_more_iterations: false
          };
          yield {
            type: "response.complete" /* RESPONSE_COMPLETE */,
            response_id: executionId,
            status: "completed",
            usage: globalStreamState.usage,
            iterations: iteration,
            duration_ms: Date.now() - startTime
          };
          break;
        }
        const toolResults = [];
        for (const toolCall of toolCalls) {
          let parsedArgs;
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            yield {
              type: "response.tool_execution.done" /* TOOL_EXECUTION_DONE */,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: null,
              execution_time_ms: 0,
              error: `Invalid tool arguments JSON: ${error.message}`
            };
            continue;
          }
          yield {
            type: "response.tool_execution.start" /* TOOL_EXECUTION_START */,
            response_id: executionId,
            tool_call_id: toolCall.id,
            tool_name: toolCall.function.name,
            arguments: parsedArgs
          };
          const toolStartTime = Date.now();
          try {
            const result = await this.executeToolWithHooks(toolCall, iteration, executionId, config);
            toolResults.push(result);
            yield {
              type: "response.tool_execution.done" /* TOOL_EXECUTION_DONE */,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: result.content,
              execution_time_ms: Date.now() - toolStartTime
            };
          } catch (error) {
            yield {
              type: "response.tool_execution.done" /* TOOL_EXECUTION_DONE */,
              response_id: executionId,
              tool_call_id: toolCall.id,
              tool_name: toolCall.function.name,
              result: null,
              execution_time_ms: Date.now() - toolStartTime,
              error: error.message
            };
            const failureMode = config.errorHandling?.toolFailureMode || "continue";
            if (failureMode === "fail") {
              throw error;
            }
            toolResults.push({
              tool_use_id: toolCall.id,
              content: "",
              error: error.message,
              state: "failed" /* FAILED */
            });
          }
        }
        const assistantMessage = {
          type: "message",
          role: "assistant" /* ASSISTANT */,
          content: [
            {
              type: "output_text" /* OUTPUT_TEXT */,
              text: iterationStreamState.getAllText()
            },
            ...toolCalls.map((tc) => ({
              type: "tool_use" /* TOOL_USE */,
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments
            }))
          ]
        };
        const toolResultsMessage = {
          type: "message",
          role: "user" /* USER */,
          content: toolResults.map((tr) => ({
            type: "tool_result" /* TOOL_RESULT */,
            tool_use_id: tr.tool_use_id,
            content: tr.content,
            error: tr.error
          }))
        };
        const newMessages = [assistantMessage, toolResultsMessage];
        currentInput = this.appendToContext(currentInput, newMessages);
        const maxInputMessages = config.limits?.maxInputMessages ?? 50;
        currentInput = this.applySlidingWindow(currentInput, maxInputMessages);
        yield {
          type: "response.iteration.complete" /* ITERATION_COMPLETE */,
          response_id: executionId,
          iteration,
          tool_calls_count: toolCalls.length,
          has_more_iterations: true
        };
        if (this.context) {
          globalStreamState.incrementIteration();
        }
        iterationStreamState.clear();
        toolCallsMap.clear();
      }
      if (iteration >= config.maxIterations) {
        yield {
          type: "response.complete" /* RESPONSE_COMPLETE */,
          response_id: executionId,
          status: "incomplete",
          // Incomplete because we hit max iterations
          usage: globalStreamState.usage,
          iterations: iteration,
          duration_ms: Date.now() - startTime
        };
      }
      await this.hookManager.executeHooks("after:execution", {
        executionId,
        response: null,
        // We don't have a complete response in streaming
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: Date.now() - startTime
      }, void 0);
      this.emit("execution:complete", {
        executionId,
        iterations: iteration,
        duration: Date.now() - startTime,
        timestamp: /* @__PURE__ */ new Date()
      });
    } catch (error) {
      this.emit("execution:error", {
        executionId,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      yield {
        type: "response.error" /* ERROR */,
        response_id: executionId,
        error: {
          type: "execution_error",
          message: error.message
        },
        recoverable: false
      };
      throw error;
    } finally {
      globalStreamState.clear();
      this.context?.cleanup();
      this.hookManager.clear();
    }
  }
  /**
   * Stream LLM response with hooks
   * @private
   */
  async *streamGenerateWithHooks(config, input, iteration, executionId, streamState, toolCallsMap) {
    const llmStartTime = Date.now();
    let generateOptions = {
      model: config.model,
      input,
      instructions: config.instructions,
      tools: config.tools,
      tool_choice: "auto",
      temperature: config.temperature
    };
    await this.hookManager.executeHooks("before:llm", {
      executionId,
      iteration,
      options: generateOptions,
      context: this.context,
      timestamp: /* @__PURE__ */ new Date()
    }, {});
    this.emit("llm:request", {
      executionId,
      iteration,
      model: config.model,
      timestamp: /* @__PURE__ */ new Date()
    });
    try {
      for await (const event of this.provider.streamGenerate(generateOptions)) {
        if (event.type === "response.output_text.delta" /* OUTPUT_TEXT_DELTA */) {
          streamState.accumulateTextDelta(event.item_id, event.delta);
        } else if (event.type === "response.tool_call.start" /* TOOL_CALL_START */) {
          streamState.startToolCall(event.tool_call_id, event.tool_name);
          toolCallsMap.set(event.tool_call_id, { name: event.tool_name, args: "" });
        } else if (event.type === "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */) {
          streamState.accumulateToolArguments(event.tool_call_id, event.delta);
          const buffer = toolCallsMap.get(event.tool_call_id);
          if (buffer) {
            buffer.args += event.delta;
          }
        } else if (isToolCallArgumentsDone(event)) {
          streamState.completeToolCall(event.tool_call_id);
          const buffer = toolCallsMap.get(event.tool_call_id);
          if (buffer) {
            buffer.args = event.arguments;
          }
        } else if (event.type === "response.complete" /* RESPONSE_COMPLETE */) {
          streamState.updateUsage(event.usage);
          if (process.env.DEBUG_STREAMING) {
            console.error("[DEBUG] Captured usage from provider:", event.usage);
            console.error("[DEBUG] StreamState usage after update:", streamState.usage);
          }
          continue;
        }
        yield event;
      }
      if (this.context) {
        this.context.metrics.llmDuration += Date.now() - llmStartTime;
        this.context.metrics.inputTokens += streamState.usage.input_tokens;
        this.context.metrics.outputTokens += streamState.usage.output_tokens;
        this.context.metrics.totalTokens += streamState.usage.total_tokens;
      }
      if (process.env.DEBUG_STREAMING) {
        console.error("[DEBUG] Stream iteration complete, usage:", streamState.usage);
      }
      await this.hookManager.executeHooks("after:llm", {
        executionId,
        iteration,
        response: null,
        // Streaming doesn't have complete response yet
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: Date.now() - llmStartTime
      }, {});
      this.emit("llm:response", {
        executionId,
        iteration,
        timestamp: /* @__PURE__ */ new Date()
      });
    } catch (error) {
      this.emit("llm:error", {
        executionId,
        iteration,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    }
  }
  /**
   * Execute single tool with hooks
   * @private
   */
  async executeToolWithHooks(toolCall, iteration, executionId, config) {
    const toolStartTime = Date.now();
    toolCall.state = "executing" /* EXECUTING */;
    toolCall.startTime = /* @__PURE__ */ new Date();
    await this.hookManager.executeHooks("before:tool", {
      executionId,
      iteration,
      toolCall,
      context: this.context,
      timestamp: /* @__PURE__ */ new Date()
    }, {});
    if (this.hookManager.hasHooks("approve:tool")) {
      const approval = await this.hookManager.executeHooks("approve:tool", {
        executionId,
        iteration,
        toolCall,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date()
      }, { approved: true });
      if (!approval.approved) {
        throw new Error(`Tool execution rejected: ${approval.reason || "No reason provided"}`);
      }
    }
    this.emit("tool:start", {
      executionId,
      iteration,
      toolCall,
      timestamp: /* @__PURE__ */ new Date()
    });
    try {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await this.executeWithTimeout(
        () => this.toolExecutor.execute(toolCall.function.name, args),
        config.toolTimeout ?? 3e4
      );
      const toolResult = {
        tool_use_id: toolCall.id,
        content: result,
        executionTime: Date.now() - toolStartTime,
        state: "completed" /* COMPLETED */
      };
      toolCall.state = "completed" /* COMPLETED */;
      toolCall.endTime = /* @__PURE__ */ new Date();
      await this.hookManager.executeHooks("after:tool", {
        executionId,
        iteration,
        toolCall,
        result: toolResult,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date()
      }, {});
      if (this.context) {
        this.context.metrics.toolCallCount++;
        this.context.metrics.toolSuccessCount++;
        this.context.metrics.toolDuration += toolResult.executionTime || 0;
      }
      this.emit("tool:complete", {
        executionId,
        iteration,
        toolCall,
        result: toolResult,
        timestamp: /* @__PURE__ */ new Date()
      });
      return toolResult;
    } catch (error) {
      toolCall.state = "failed" /* FAILED */;
      toolCall.endTime = /* @__PURE__ */ new Date();
      toolCall.error = error.message;
      if (this.context) {
        this.context.metrics.toolFailureCount++;
      }
      this.emit("tool:error", {
        executionId,
        iteration,
        toolCall,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    }
  }
  /**
   * Generate LLM response with hooks
   */
  async generateWithHooks(config, input, iteration, executionId) {
    const llmStartTime = Date.now();
    let generateOptions = {
      model: config.model,
      input,
      instructions: config.instructions,
      tools: config.tools,
      tool_choice: "auto",
      temperature: config.temperature
    };
    const beforeLLM = await this.hookManager.executeHooks("before:llm", {
      executionId,
      iteration,
      options: generateOptions,
      context: this.context,
      timestamp: /* @__PURE__ */ new Date()
    }, {});
    if (beforeLLM.modified) {
      generateOptions = { ...generateOptions, ...beforeLLM.modified };
    }
    if (beforeLLM.skip) {
      throw new Error("LLM call skipped by hook");
    }
    this.emit("llm:request", {
      executionId,
      iteration,
      options: generateOptions,
      timestamp: /* @__PURE__ */ new Date()
    });
    try {
      const response = await this.provider.generate(generateOptions);
      const llmDuration = Date.now() - llmStartTime;
      this.context?.updateMetrics({
        llmDuration: (this.context.metrics.llmDuration || 0) + llmDuration
      });
      this.emit("llm:response", {
        executionId,
        iteration,
        response,
        timestamp: /* @__PURE__ */ new Date(),
        duration: llmDuration
      });
      await this.hookManager.executeHooks("after:llm", {
        executionId,
        iteration,
        response,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date(),
        duration: llmDuration
      }, {});
      return response;
    } catch (error) {
      this.emit("llm:error", {
        executionId,
        iteration,
        error,
        timestamp: /* @__PURE__ */ new Date()
      });
      throw error;
    }
  }
  /**
   * Execute tools with hooks
   */
  async executeToolsWithHooks(toolCalls, iteration, executionId, config) {
    const results = [];
    for (const toolCall of toolCalls) {
      this.context?.addToolCall(toolCall);
      await this.checkPause();
      const beforeTool = await this.hookManager.executeHooks("before:tool", {
        executionId,
        iteration,
        toolCall,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date()
      }, {});
      if (beforeTool.skip) {
        this.context?.audit("tool_skipped", { toolCall }, void 0, toolCall.function.name);
        const mockResult = {
          tool_use_id: toolCall.id,
          content: beforeTool.mockResult || "",
          state: "completed" /* COMPLETED */,
          executionTime: 0
        };
        results.push(mockResult);
        this.context?.addToolResult(mockResult);
        continue;
      }
      if (beforeTool.modified) {
        Object.assign(toolCall, beforeTool.modified);
        this.context?.audit("tool_modified", { modifications: beforeTool.modified }, void 0, toolCall.function.name);
      }
      if (this.hookManager.hasHooks("approve:tool")) {
        const approval = await this.hookManager.executeHooks("approve:tool", {
          executionId,
          iteration,
          toolCall,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, { approved: true });
        if (!approval.approved) {
          this.context?.audit("tool_rejected", { reason: approval.reason }, void 0, toolCall.function.name);
          const rejectedResult = {
            tool_use_id: toolCall.id,
            content: "",
            error: `Tool rejected: ${approval.reason || "Not approved"}`,
            state: "failed" /* FAILED */
          };
          results.push(rejectedResult);
          this.context?.addToolResult(rejectedResult);
          continue;
        }
        this.context?.audit("tool_approved", { reason: approval.reason }, void 0, toolCall.function.name);
      }
      toolCall.state = "executing" /* EXECUTING */;
      toolCall.startTime = /* @__PURE__ */ new Date();
      this.emit("tool:start", {
        executionId,
        iteration,
        toolCall,
        timestamp: /* @__PURE__ */ new Date()
      });
      const toolStartTime = Date.now();
      try {
        const timeout = config.toolTimeout ?? 3e4;
        const result = await this.executeWithTimeout(
          () => this.toolExecutor.execute(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          ),
          timeout
        );
        toolCall.state = "completed" /* COMPLETED */;
        toolCall.endTime = /* @__PURE__ */ new Date();
        let toolResult = {
          tool_use_id: toolCall.id,
          content: result,
          state: "completed" /* COMPLETED */,
          executionTime: Date.now() - toolStartTime
        };
        const afterTool = await this.hookManager.executeHooks("after:tool", {
          executionId,
          iteration,
          toolCall,
          result: toolResult,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, {});
        if (afterTool.modified) {
          toolResult = { ...toolResult, ...afterTool.modified };
        }
        results.push(toolResult);
        this.context?.addToolResult(toolResult);
        this.context?.updateMetrics({
          toolDuration: (this.context.metrics.toolDuration || 0) + toolResult.executionTime
        });
        this.emit("tool:complete", {
          executionId,
          iteration,
          toolCall,
          result: toolResult,
          timestamp: /* @__PURE__ */ new Date()
        });
      } catch (error) {
        toolCall.state = "failed" /* FAILED */;
        toolCall.endTime = /* @__PURE__ */ new Date();
        toolCall.error = error.message;
        const toolResult = {
          tool_use_id: toolCall.id,
          content: "",
          error: error.message,
          state: "failed" /* FAILED */
        };
        results.push(toolResult);
        this.context?.addToolResult(toolResult);
        this.context?.metrics.errors.push({
          type: "tool_error",
          message: error.message,
          timestamp: /* @__PURE__ */ new Date()
        });
        if (error instanceof ToolTimeoutError) {
          this.emit("tool:timeout", {
            executionId,
            iteration,
            toolCall,
            timeout: config.toolTimeout ?? 3e4,
            timestamp: /* @__PURE__ */ new Date()
          });
        } else {
          this.emit("tool:error", {
            executionId,
            iteration,
            toolCall,
            error,
            timestamp: /* @__PURE__ */ new Date()
          });
        }
        const failureMode = config.errorHandling?.toolFailureMode || "continue";
        if (failureMode === "fail") {
          throw error;
        }
      }
    }
    return results;
  }
  /**
   * Extract tool calls from response output
   */
  extractToolCalls(output, toolDefinitions) {
    const toolCalls = [];
    const toolMap = /* @__PURE__ */ new Map();
    for (const tool of toolDefinitions) {
      if (tool.type === "function") {
        toolMap.set(tool.function.name, tool);
      }
    }
    for (const item of output) {
      if (item.type === "message" && item.role === "assistant" /* ASSISTANT */) {
        for (const content of item.content) {
          if (content.type === "tool_use" /* TOOL_USE */) {
            const toolDef = toolMap.get(content.name);
            const isBlocking = toolDef?.blocking !== false;
            const toolCall = {
              id: content.id,
              type: "function",
              function: {
                name: content.name,
                arguments: content.arguments
              },
              blocking: isBlocking,
              state: "pending" /* PENDING */
            };
            toolCalls.push(toolCall);
          }
        }
      }
    }
    return toolCalls;
  }
  /**
   * Execute function with timeout
   */
  async executeWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError("tool", timeoutMs));
      }, timeoutMs);
      fn().then((result) => {
        clearTimeout(timer);
        resolve(result);
      }).catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  // ============ Shared Helper Methods ============
  // These methods provide unified logic for both execute() and executeStreaming()
  /**
   * Build new messages from tool results (assistant response + tool results)
   */
  buildNewMessages(previousOutput, toolResults) {
    const messages = [];
    for (const item of previousOutput) {
      if (item.type === "message") {
        messages.push(item);
      }
    }
    const toolResultContents = toolResults.map((result) => ({
      type: "tool_result" /* TOOL_RESULT */,
      tool_use_id: result.tool_use_id,
      content: result.content,
      error: result.error
    }));
    if (toolResultContents.length > 0) {
      messages.push({
        type: "message",
        role: "user" /* USER */,
        content: toolResultContents
      });
    }
    return messages;
  }
  /**
   * Append new messages to current context, preserving history
   * Unified logic for both execute() and executeStreaming()
   */
  appendToContext(currentInput, newMessages) {
    if (Array.isArray(currentInput)) {
      return [...currentInput, ...newMessages];
    }
    return [
      {
        type: "message",
        role: "user" /* USER */,
        content: [{ type: "input_text" /* INPUT_TEXT */, text: currentInput }]
      },
      ...newMessages
    ];
  }
  /**
   * Apply sliding window to prevent unbounded input growth
   * Preserves system/developer message at the start if present
   * IMPORTANT: Ensures tool_use and tool_result pairs are never broken
   */
  applySlidingWindow(input, maxMessages = 50) {
    if (input.length <= maxMessages) {
      return input;
    }
    const firstMessage = input[0];
    const isSystemMessage = firstMessage?.type === "message" && firstMessage.role === "developer" /* DEVELOPER */;
    const maxToKeep = isSystemMessage ? maxMessages - 1 : maxMessages;
    const safeCutIndex = this.findSafeToolBoundary(input, input.length - maxToKeep);
    const recentMessages = input.slice(safeCutIndex);
    if (isSystemMessage) {
      return [firstMessage, ...recentMessages];
    }
    return recentMessages;
  }
  /**
   * Find a safe index to cut the message array without breaking tool call/result pairs
   * A safe boundary is one where all tool_use IDs have matching tool_result IDs
   */
  findSafeToolBoundary(input, targetIndex) {
    let cutIndex = Math.max(0, Math.min(targetIndex, input.length - 1));
    while (cutIndex < input.length - 1) {
      if (this.isToolBoundarySafe(input, cutIndex)) {
        return cutIndex;
      }
      cutIndex++;
    }
    cutIndex = Math.max(0, targetIndex);
    while (cutIndex > 0) {
      if (this.isToolBoundarySafe(input, cutIndex)) {
        return cutIndex;
      }
      cutIndex--;
    }
    return Math.max(0, targetIndex);
  }
  /**
   * Check if cutting at this index would leave tool calls/results balanced
   * Returns true if all tool_use IDs in the slice have matching tool_result IDs
   */
  isToolBoundarySafe(input, startIndex) {
    const slicedMessages = input.slice(startIndex);
    const toolUseIds = /* @__PURE__ */ new Set();
    const toolResultIds = /* @__PURE__ */ new Set();
    for (const item of slicedMessages) {
      if (item.type !== "message") continue;
      for (const content of item.content) {
        if (content.type === "tool_use" /* TOOL_USE */) {
          toolUseIds.add(content.id);
        } else if (content.type === "tool_result" /* TOOL_RESULT */) {
          toolResultIds.add(content.tool_use_id);
        }
      }
    }
    for (const resultId of toolResultIds) {
      if (!toolUseIds.has(resultId)) {
        return false;
      }
    }
    for (const useId of toolUseIds) {
      if (!toolResultIds.has(useId)) {
        const lastMessage = slicedMessages[slicedMessages.length - 1];
        const isLastMessageWithThisToolUse = lastMessage?.type === "message" && lastMessage.role === "assistant" /* ASSISTANT */ && lastMessage.content.some(
          (c) => c.type === "tool_use" /* TOOL_USE */ && c.id === useId
        );
        if (!isLastMessageWithThisToolUse) {
          return false;
        }
      }
    }
    return true;
  }
  /**
   * Pause execution (thread-safe with mutex)
   */
  pause(reason) {
    this.pauseResumeMutex = this.pauseResumeMutex.then(() => {
      this._doPause(reason);
    });
  }
  /**
   * Internal pause implementation
   */
  _doPause(reason) {
    if (this.paused) return;
    this.paused = true;
    this.pausePromise = new Promise((resolve) => {
      this.resumeCallback = resolve;
    });
    if (this.context) {
      this.context.paused = true;
      this.context.pauseReason = reason;
      this.context.audit("execution_paused", { reason });
    }
    this.emit("execution:paused", {
      executionId: this.context?.executionId || "unknown",
      reason: reason || "Manual pause",
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Resume execution (thread-safe with mutex)
   */
  resume() {
    this.pauseResumeMutex = this.pauseResumeMutex.then(() => {
      this._doResume();
    });
  }
  /**
   * Internal resume implementation
   */
  _doResume() {
    if (!this.paused) return;
    this.paused = false;
    if (this.context) {
      this.context.paused = false;
      this.context.pauseReason = void 0;
      this.context.audit("execution_resumed", {});
    }
    if (this.resumeCallback) {
      this.resumeCallback();
      this.resumeCallback = null;
    }
    this.pausePromise = null;
    this.emit("execution:resumed", {
      executionId: this.context?.executionId || "unknown",
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Cancel execution
   */
  cancel(reason) {
    this.cancelled = true;
    if (this.context) {
      this.context.cancelled = true;
      this.context.cancelReason = reason;
    }
    if (this.paused) {
      this._doResume();
    }
    this.emit("execution:cancelled", {
      executionId: this.context?.executionId || "unknown",
      reason: reason || "Manual cancellation",
      timestamp: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Check if paused and wait
   */
  async checkPause() {
    if (this.paused && this.pausePromise) {
      await this.pausePromise;
    }
  }
  /**
   * Get current execution context
   */
  getContext() {
    return this.context;
  }
  /**
   * Check if currently executing
   */
  isRunning() {
    return this.context !== null && !this.cancelled;
  }
  /**
   * Check if paused
   */
  isPaused() {
    return this.paused;
  }
  /**
   * Check if cancelled
   */
  isCancelled() {
    return this.cancelled;
  }
};

// src/domain/interfaces/IDisposable.ts
function assertNotDestroyed(obj, operation) {
  if (obj.isDestroyed) {
    throw new Error(`Cannot ${operation}: instance has been destroyed`);
  }
}

// src/core/Agent.ts
var Agent = class _Agent extends EventEmitter$2 {
  // ============ Instance Properties ============
  name;
  connector;
  model;
  config;
  provider;
  toolRegistry;
  agenticLoop;
  cleanupCallbacks = [];
  boundListeners = /* @__PURE__ */ new Map();
  _isDestroyed = false;
  logger;
  // === NEW: Tool and Session Management ===
  _toolManager;
  _sessionManager = null;
  _session = null;
  _pendingSessionLoad = null;
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   * For simple cases, use addTool/removeTool instead.
   */
  get tools() {
    return this._toolManager;
  }
  // ============ Static Factory ============
  /**
   * Create a new agent
   *
   * @example
   * ```typescript
   * const agent = Agent.create({
   *   connector: 'openai',  // or Connector instance
   *   model: 'gpt-4',
   *   instructions: 'You are a helpful assistant',
   *   tools: [myTool]
   * });
   * ```
   */
  static create(config) {
    return new _Agent(config);
  }
  /**
   * Resume an agent from a saved session
   *
   * @example
   * ```typescript
   * const agent = await Agent.resume('session-123', {
   *   connector: 'openai',
   *   model: 'gpt-4',
   *   session: { storage: myStorage }
   * });
   * ```
   */
  static async resume(sessionId, config) {
    const agent = new _Agent({
      ...config,
      session: {
        ...config.session,
        id: sessionId
      }
    });
    if (agent._pendingSessionLoad) {
      await agent._pendingSessionLoad;
    }
    return agent;
  }
  // ============ Constructor ============
  constructor(config) {
    super();
    this.connector = typeof config.connector === "string" ? Connector.get(config.connector) : config.connector;
    this.name = config.name ?? `agent-${Date.now()}`;
    this.model = config.model;
    this.config = config;
    this.logger = logger.child({
      component: "Agent",
      agentName: this.name,
      model: this.model,
      connector: this.connector.name
    });
    this.logger.debug({ config }, "Agent created");
    metrics.increment("agent.created", 1, {
      model: this.model,
      connector: this.connector.name
    });
    this.provider = createProvider(this.connector);
    this._toolManager = config.toolManager ?? new ToolManager();
    if (config.tools) {
      for (const tool of config.tools) {
        this._toolManager.register(tool);
      }
    }
    this.toolRegistry = new ToolRegistry();
    if (config.tools) {
      for (const tool of config.tools) {
        this.toolRegistry.registerTool(tool);
      }
    }
    this._toolManager.on("tool:registered", ({ name }) => {
      const tool = this._toolManager.get(name);
      if (tool && !this.toolRegistry.hasToolFunction(name)) {
        this.toolRegistry.registerTool(tool);
      }
    });
    this._toolManager.on("tool:unregistered", ({ name }) => {
      if (this.toolRegistry.hasToolFunction(name)) {
        this.toolRegistry.unregisterTool(name);
      }
    });
    this.agenticLoop = new AgenticLoop(
      this.provider,
      this.toolRegistry,
      config.hooks,
      config.errorHandling
    );
    this.setupEventForwarding();
    if (config.session) {
      this._sessionManager = new SessionManager({ storage: config.session.storage });
      if (config.session.id) {
        this._pendingSessionLoad = this.loadSessionInternal(config.session.id);
      } else {
        this._session = this._sessionManager.create("agent", {
          title: this.name
        });
        if (config.session.autoSave) {
          const interval = config.session.autoSaveIntervalMs ?? 3e4;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      }
    }
  }
  /**
   * Internal method to load session
   */
  async loadSessionInternal(sessionId) {
    if (!this._sessionManager) return;
    try {
      const session = await this._sessionManager.load(sessionId);
      if (session) {
        this._session = session;
        if (session.toolState) {
          this._toolManager.loadState(session.toolState);
        }
        this.logger.info({ sessionId }, "Session loaded");
        if (this.config.session?.autoSave) {
          const interval = this.config.session.autoSaveIntervalMs ?? 3e4;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      } else {
        this.logger.warn({ sessionId }, "Session not found, creating new session");
        this._session = this._sessionManager.create("agent", {
          title: this.name
        });
      }
    } catch (error) {
      this.logger.error({ error: error.message, sessionId }, "Failed to load session");
      throw error;
    }
  }
  // ============ Main API ============
  /**
   * Run the agent with input
   */
  async run(input) {
    assertNotDestroyed(this, "run agent");
    const inputPreview = typeof input === "string" ? input.substring(0, 100) : `${input.length} messages`;
    this.logger.info({
      inputPreview,
      toolCount: this.config.tools?.length || 0
    }, "Agent run started");
    metrics.increment("agent.run.started", 1, {
      model: this.model,
      connector: this.connector.name
    });
    const startTime = Date.now();
    try {
      const enabledTools = this._toolManager.getEnabled();
      const tools = enabledTools.map((t) => t.definition);
      const loopConfig = {
        model: this.model,
        input,
        instructions: this.config.instructions,
        tools,
        temperature: this.config.temperature,
        maxIterations: this.config.maxIterations || 10,
        hooks: this.config.hooks,
        historyMode: this.config.historyMode,
        limits: this.config.limits,
        errorHandling: this.config.errorHandling
      };
      const response = await this.agenticLoop.execute(loopConfig);
      const duration = Date.now() - startTime;
      this.logger.info({
        duration
      }, "Agent run completed");
      metrics.timing("agent.run.duration", duration, {
        model: this.model,
        connector: this.connector.name
      });
      metrics.increment("agent.run.completed", 1, {
        model: this.model,
        connector: this.connector.name,
        status: "success"
      });
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        error: error.message,
        duration
      }, "Agent run failed");
      metrics.increment("agent.run.completed", 1, {
        model: this.model,
        connector: this.connector.name,
        status: "error"
      });
      throw error;
    }
  }
  /**
   * Stream response from the agent
   */
  async *stream(input) {
    assertNotDestroyed(this, "stream from agent");
    const inputPreview = typeof input === "string" ? input.substring(0, 100) : `${input.length} messages`;
    this.logger.info({
      inputPreview,
      toolCount: this.config.tools?.length || 0
    }, "Agent stream started");
    metrics.increment("agent.stream.started", 1, {
      model: this.model,
      connector: this.connector.name
    });
    const startTime = Date.now();
    try {
      const enabledTools = this._toolManager.getEnabled();
      const tools = enabledTools.map((t) => t.definition);
      const loopConfig = {
        model: this.model,
        input,
        instructions: this.config.instructions,
        tools,
        temperature: this.config.temperature,
        maxIterations: this.config.maxIterations || 10,
        hooks: this.config.hooks,
        historyMode: this.config.historyMode,
        limits: this.config.limits,
        errorHandling: this.config.errorHandling
      };
      yield* this.agenticLoop.executeStreaming(loopConfig);
      const duration = Date.now() - startTime;
      this.logger.info({ duration }, "Agent stream completed");
      metrics.timing("agent.stream.duration", duration, {
        model: this.model,
        connector: this.connector.name
      });
      metrics.increment("agent.stream.completed", 1, {
        model: this.model,
        connector: this.connector.name,
        status: "success"
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        error: error.message,
        duration
      }, "Agent stream failed");
      metrics.increment("agent.stream.completed", 1, {
        model: this.model,
        connector: this.connector.name,
        status: "error"
      });
      throw error;
    }
  }
  // ============ Tool Management ============
  /**
   * Add a tool to the agent
   */
  addTool(tool) {
    this._toolManager.register(tool);
    this.toolRegistry.registerTool(tool);
    if (!this.config.tools) {
      this.config.tools = [];
    }
    this.config.tools.push(tool);
  }
  /**
   * Remove a tool from the agent
   */
  removeTool(toolName) {
    this._toolManager.unregister(toolName);
    this.toolRegistry.unregisterTool(toolName);
    if (this.config.tools) {
      this.config.tools = this.config.tools.filter(
        (t) => t.definition.function.name !== toolName
      );
    }
  }
  /**
   * List registered tools (returns enabled tool names)
   */
  listTools() {
    return this._toolManager.listEnabled();
  }
  /**
   * Replace all tools with a new array
   */
  setTools(tools) {
    for (const name of this._toolManager.list()) {
      this._toolManager.unregister(name);
      this.toolRegistry.unregisterTool(name);
    }
    for (const tool of tools) {
      this._toolManager.register(tool);
      this.toolRegistry.registerTool(tool);
    }
    this.config.tools = [...tools];
  }
  // ============ Session Management (NEW) ============
  /**
   * Get the current session ID (if session is enabled)
   */
  getSessionId() {
    return this._session?.id ?? null;
  }
  /**
   * Check if this agent has session support enabled
   */
  hasSession() {
    return this._session !== null;
  }
  /**
   * Save the current session to storage
   * @throws Error if session is not enabled
   */
  async saveSession() {
    if (!this._sessionManager || !this._session) {
      throw new Error("Session not enabled. Configure session in AgentConfig to use this feature.");
    }
    this._session.toolState = this._toolManager.getState();
    await this._sessionManager.save(this._session);
    this.logger.debug({ sessionId: this._session.id }, "Session saved");
  }
  /**
   * Get the current session (for advanced use)
   */
  getSession() {
    return this._session;
  }
  /**
   * Update session custom data
   */
  updateSessionData(key, value) {
    if (!this._session) {
      throw new Error("Session not enabled");
    }
    this._session.custom[key] = value;
  }
  /**
   * Get session custom data
   */
  getSessionData(key) {
    return this._session?.custom[key];
  }
  // ============ Configuration Methods ============
  /**
   * Change the model
   */
  setModel(model) {
    this.model = model;
    this.config.model = model;
  }
  /**
   * Get current temperature
   */
  getTemperature() {
    return this.config.temperature;
  }
  /**
   * Change the temperature
   */
  setTemperature(temperature) {
    this.config.temperature = temperature;
  }
  // ============ Control Methods ============
  pause(reason) {
    this.agenticLoop.pause(reason);
  }
  resume() {
    this.agenticLoop.resume();
  }
  cancel(reason) {
    this.agenticLoop.cancel(reason);
  }
  // ============ Introspection ============
  getContext() {
    return this.agenticLoop.getContext();
  }
  getMetrics() {
    const context = this.agenticLoop.getContext();
    return context?.metrics || null;
  }
  getSummary() {
    const context = this.agenticLoop.getContext();
    return context?.getSummary() || null;
  }
  getAuditTrail() {
    const context = this.agenticLoop.getContext();
    return context?.getAuditTrail() || [];
  }
  /**
   * Get circuit breaker metrics for LLM provider
   */
  getProviderCircuitBreakerMetrics() {
    if ("getCircuitBreakerMetrics" in this.provider) {
      return this.provider.getCircuitBreakerMetrics();
    }
    return null;
  }
  /**
   * Get circuit breaker states for all tools
   */
  getToolCircuitBreakerStates() {
    return this.toolRegistry.getCircuitBreakerStates();
  }
  /**
   * Get circuit breaker metrics for a specific tool
   */
  getToolCircuitBreakerMetrics(toolName) {
    return this.toolRegistry.getToolCircuitBreakerMetrics(toolName);
  }
  /**
   * Manually reset a tool's circuit breaker
   */
  resetToolCircuitBreaker(toolName) {
    this.toolRegistry.resetToolCircuitBreaker(toolName);
    this.logger.info({ toolName }, "Tool circuit breaker reset by user");
  }
  isRunning() {
    return this.agenticLoop.isRunning();
  }
  isPaused() {
    return this.agenticLoop.isPaused();
  }
  isCancelled() {
    return this.agenticLoop.isCancelled();
  }
  // ============ Cleanup ============
  onCleanup(callback) {
    this.cleanupCallbacks.push(callback);
  }
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    this.logger.debug("Agent destroy started");
    try {
      this.agenticLoop.cancel("Agent destroyed");
    } catch {
    }
    for (const [eventName, handler] of this.boundListeners) {
      this.agenticLoop.off(eventName, handler);
    }
    this.boundListeners.clear();
    this.removeAllListeners();
    if (this._sessionManager) {
      if (this._session) {
        this._sessionManager.stopAutoSave(this._session.id);
      }
      this._sessionManager.destroy();
    }
    this._toolManager.removeAllListeners();
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        this.logger.error({ error: error.message }, "Cleanup callback error");
      }
    }
    this.cleanupCallbacks = [];
    metrics.increment("agent.destroyed", 1, {
      model: this.model,
      connector: this.connector.name
    });
    this.logger.debug("Agent destroyed");
  }
  // ============ Private ============
  setupEventForwarding() {
    const eventNames = [
      "execution:start",
      "execution:complete",
      "execution:error",
      "execution:paused",
      "execution:resumed",
      "execution:cancelled",
      "iteration:start",
      "iteration:complete",
      "llm:request",
      "llm:response",
      "llm:error",
      "tool:detected",
      "tool:start",
      "tool:complete",
      "tool:error",
      "tool:timeout",
      "hook:error"
    ];
    for (const eventName of eventNames) {
      const handler = (data) => {
        if (!this._isDestroyed) {
          this.emit(eventName, data);
        }
      };
      this.boundListeners.set(eventName, handler);
      this.agenticLoop.on(eventName, handler);
    }
  }
};

// src/infrastructure/providers/base/BaseMediaProvider.ts
var BaseMediaProvider = class extends BaseProvider {
  circuitBreaker;
  logger;
  _isObservabilityInitialized = false;
  constructor(config) {
    super(config);
    this.logger = logger.child({
      component: "MediaProvider",
      provider: "unknown"
    });
  }
  /**
   * Auto-initialize observability on first use (lazy initialization)
   * This is called automatically by executeWithCircuitBreaker()
   * @internal
   */
  ensureObservabilityInitialized() {
    if (this._isObservabilityInitialized) {
      return;
    }
    const providerName = this.name || "unknown";
    const cbConfig = this.config.circuitBreaker || DEFAULT_CIRCUIT_BREAKER_CONFIG;
    this.circuitBreaker = new CircuitBreaker(
      `media-provider:${providerName}`,
      cbConfig
    );
    this.logger = logger.child({
      component: "MediaProvider",
      provider: providerName
    });
    this.circuitBreaker.on("opened", (data) => {
      this.logger.warn(data, "Circuit breaker opened");
      metrics.increment("circuit_breaker.opened", 1, {
        breaker: data.name,
        provider: providerName
      });
    });
    this.circuitBreaker.on("closed", (data) => {
      this.logger.info(data, "Circuit breaker closed");
      metrics.increment("circuit_breaker.closed", 1, {
        breaker: data.name,
        provider: providerName
      });
    });
    this._isObservabilityInitialized = true;
  }
  /**
   * Execute operation with circuit breaker protection
   * Automatically records metrics and handles errors
   *
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for metrics (e.g., 'image.generate', 'audio.synthesize')
   * @param metadata - Additional metadata to log/record
   */
  async executeWithCircuitBreaker(operation, operationName, metadata) {
    this.ensureObservabilityInitialized();
    const startTime = Date.now();
    const metricLabels = {
      provider: this.name,
      operation: operationName,
      ...metadata
    };
    try {
      const result = await this.circuitBreaker.execute(operation);
      const duration = Date.now() - startTime;
      metrics.histogram(`${operationName}.duration`, duration, metricLabels);
      metrics.increment(`${operationName}.success`, 1, metricLabels);
      this.logger.debug(
        { operation: operationName, duration, ...metadata },
        "Operation completed successfully"
      );
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metrics.increment(`${operationName}.error`, 1, {
        ...metricLabels,
        error: error instanceof Error ? error.name : "unknown"
      });
      this.logger.error(
        {
          operation: operationName,
          duration,
          error: error instanceof Error ? error.message : String(error),
          ...metadata
        },
        "Operation failed"
      );
      throw error;
    }
  }
  /**
   * Log operation start with context
   * Useful for logging before async operations
   */
  logOperationStart(operation, context) {
    this.ensureObservabilityInitialized();
    this.logger.info({ operation, ...context }, `${operation} started`);
  }
  /**
   * Log operation completion with context
   */
  logOperationComplete(operation, context) {
    this.ensureObservabilityInitialized();
    this.logger.info({ operation, ...context }, `${operation} completed`);
  }
};

// src/domain/entities/SharedVoices.ts
var OPENAI_VOICES = [
  { id: "alloy", name: "Alloy", language: "multi", gender: "neutral", isDefault: true },
  { id: "ash", name: "Ash", language: "multi", gender: "male" },
  { id: "ballad", name: "Ballad", language: "multi", gender: "male" },
  { id: "coral", name: "Coral", language: "multi", gender: "female" },
  { id: "echo", name: "Echo", language: "multi", gender: "male" },
  { id: "fable", name: "Fable", language: "multi", gender: "neutral", accent: "british" },
  { id: "nova", name: "Nova", language: "multi", gender: "female" },
  { id: "onyx", name: "Onyx", language: "multi", gender: "male" },
  { id: "sage", name: "Sage", language: "multi", gender: "female" },
  { id: "shimmer", name: "Shimmer", language: "multi", gender: "female" },
  { id: "verse", name: "Verse", language: "multi", gender: "neutral" },
  { id: "marin", name: "Marin", language: "multi", gender: "female" },
  { id: "cedar", name: "Cedar", language: "multi", gender: "male" }
];
var GEMINI_VOICES = [
  { id: "Puck", name: "Puck", language: "multi", gender: "neutral", isDefault: true },
  { id: "Charon", name: "Charon", language: "multi", gender: "male" },
  { id: "Kore", name: "Kore", language: "multi", gender: "female" },
  { id: "Fenrir", name: "Fenrir", language: "multi", gender: "male" },
  { id: "Aoede", name: "Aoede", language: "multi", gender: "female" }
];
var COMMON_LANGUAGES = {
  /**
   * Languages supported by OpenAI TTS models (50+)
   * Source: https://platform.openai.com/docs/guides/text-to-speech
   */
  OPENAI_TTS: [
    "en",
    "es",
    "fr",
    "de",
    "it",
    "pt",
    "pl",
    "ru",
    "ja",
    "ko",
    "zh",
    "ar",
    "hi",
    "nl",
    "sv",
    "tr",
    "af",
    "hy",
    "az",
    "be",
    "bs",
    "bg",
    "ca",
    "hr",
    "cs",
    "da",
    "et",
    "fi",
    "gl",
    "el",
    "he",
    "hu",
    "is",
    "id",
    "lv",
    "lt",
    "mk",
    "ms",
    "mi",
    "ne",
    "no",
    "fa",
    "ro",
    "sr",
    "sk",
    "sl",
    "sw",
    "tl",
    "ta",
    "th",
    "uk",
    "ur",
    "vi",
    "cy"
  ],
  /**
   * Core languages supported by most vendors
   */
  CORE: ["en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "ru", "ar", "hi"]};
var AUDIO_FORMATS = {
  /**
   * OpenAI TTS output formats
   * Source: https://platform.openai.com/docs/guides/text-to-speech
   */
  OPENAI_TTS: ["mp3", "opus", "aac", "flac", "wav", "pcm"],
  /**
   * Google TTS output formats
   */
  GOOGLE_TTS: ["mp3", "wav", "ogg"],
  /**
   * Common STT input formats (widely supported)
   */
  STT_INPUT: ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "flac", "ogg"]
};

// src/infrastructure/providers/openai/OpenAITTSProvider.ts
var OpenAITTSProvider = class extends BaseMediaProvider {
  name = "openai-tts";
  vendor = "openai";
  capabilities = {
    text: false,
    images: false,
    videos: false,
    audio: true,
    features: {
      textToSpeech: true
    }
  };
  client;
  constructor(config) {
    super(config);
    this.client = new OpenAI2({
      apiKey: config.auth.type === "api_key" ? config.auth.apiKey : void 0,
      baseURL: config.baseURL,
      organization: config.organization,
      timeout: config.timeout ?? 6e4,
      maxRetries: config.maxRetries ?? 2
    });
  }
  /**
   * Synthesize speech from text
   */
  async synthesize(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          const format = this.mapFormat(options.format);
          const requestParams = {
            model: options.model,
            input: options.input,
            voice: options.voice,
            response_format: format,
            speed: options.speed
          };
          if (options.vendorOptions?.instructions) {
            requestParams.instructions = options.vendorOptions.instructions;
          }
          this.logOperationStart("tts.synthesize", {
            model: options.model,
            voice: options.voice,
            inputLength: options.input.length
          });
          const response = await this.client.audio.speech.create(requestParams);
          const arrayBuffer = await response.arrayBuffer();
          const audio = Buffer.from(arrayBuffer);
          this.logOperationComplete("tts.synthesize", {
            model: options.model,
            audioSize: audio.length
          });
          return {
            audio,
            format: options.format || "mp3",
            charactersUsed: options.input.length
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "tts.synthesize",
      { model: options.model, voice: options.voice }
    );
  }
  /**
   * List available voices (returns static list for OpenAI)
   */
  async listVoices() {
    return OPENAI_VOICES;
  }
  /**
   * Map semantic audio format to OpenAI format
   */
  mapFormat(format) {
    switch (format) {
      case "mp3":
        return "mp3";
      case "opus":
        return "opus";
      case "aac":
        return "aac";
      case "flac":
        return "flac";
      case "wav":
        return "wav";
      case "pcm":
        return "pcm";
      default:
        return "mp3";
    }
  }
  /**
   * Handle OpenAI API errors
   */
  handleError(error) {
    if (error instanceof OpenAI2.APIError) {
      const status = error.status;
      const message = error.message || "Unknown OpenAI API error";
      if (status === 401) {
        throw new ProviderAuthError("openai", "Invalid API key");
      }
      if (status === 429) {
        throw new ProviderRateLimitError("openai", message);
      }
      if (status === 400) {
        throw new ProviderError("openai", `Bad request: ${message}`);
      }
      throw new ProviderError("openai", message);
    }
    throw error;
  }
};
var OpenAISTTProvider = class extends BaseMediaProvider {
  name = "openai-stt";
  vendor = "openai";
  capabilities = {
    text: false,
    images: false,
    videos: false,
    audio: true,
    features: {
      speechToText: true
    }
  };
  client;
  constructor(config) {
    super(config);
    this.client = new OpenAI2({
      apiKey: config.auth.type === "api_key" ? config.auth.apiKey : void 0,
      baseURL: config.baseURL,
      organization: config.organization,
      timeout: config.timeout ?? 12e4,
      // 2 minutes for audio processing
      maxRetries: config.maxRetries ?? 2
    });
  }
  /**
   * Transcribe audio to text
   */
  async transcribe(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("stt.transcribe", {
            model: options.model,
            language: options.language,
            format: options.outputFormat
          });
          const audioFile = await this.prepareAudioFile(options.audio);
          const requestParams = {
            model: options.model,
            file: audioFile,
            language: options.language,
            prompt: options.prompt,
            temperature: options.temperature
          };
          if (options.outputFormat) {
            requestParams.response_format = this.mapOutputFormat(options.outputFormat);
          } else if (options.includeTimestamps) {
            requestParams.response_format = "verbose_json";
          }
          if (options.includeTimestamps && options.timestampGranularity) {
            requestParams.timestamp_granularities = [options.timestampGranularity];
          }
          if (options.model.includes("diarize") && options.vendorOptions?.max_speakers) {
            requestParams.max_speakers = options.vendorOptions.max_speakers;
          }
          const response = await this.client.audio.transcriptions.create(
            requestParams
          );
          this.logOperationComplete("stt.transcribe", {
            model: options.model,
            textLength: typeof response === "string" ? response.length : response.text?.length || 0
          });
          return this.convertResponse(response);
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "stt.transcribe",
      { model: options.model }
    );
  }
  /**
   * Translate audio to English text
   */
  async translate(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("stt.translate", {
            model: options.model
          });
          const audioFile = await this.prepareAudioFile(options.audio);
          const requestParams = {
            model: options.model,
            file: audioFile,
            prompt: options.prompt,
            temperature: options.temperature
          };
          if (options.outputFormat) {
            requestParams.response_format = this.mapOutputFormat(options.outputFormat);
          }
          const response = await this.client.audio.translations.create(
            requestParams
          );
          this.logOperationComplete("stt.translate", {
            model: options.model,
            textLength: typeof response === "string" ? response.length : response.text?.length || 0
          });
          return this.convertResponse(response);
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "stt.translate",
      { model: options.model }
    );
  }
  /**
   * Prepare audio file for API request
   * Handles both Buffer and file path inputs
   */
  async prepareAudioFile(audio) {
    if (Buffer.isBuffer(audio)) {
      const blob = new Blob([audio]);
      return new File([blob], "audio.wav", { type: "audio/wav" });
    } else if (typeof audio === "string") {
      return fs9.createReadStream(audio);
    } else {
      throw new Error("Invalid audio input: must be Buffer or file path");
    }
  }
  /**
   * Map semantic output format to OpenAI format
   */
  mapOutputFormat(format) {
    switch (format) {
      case "json":
        return "json";
      case "text":
        return "text";
      case "srt":
        return "srt";
      case "vtt":
        return "vtt";
      case "verbose_json":
        return "verbose_json";
      default:
        return "json";
    }
  }
  /**
   * Convert OpenAI response to our standard format
   */
  convertResponse(response) {
    if (typeof response === "string") {
      return { text: response };
    }
    const result = {
      text: response.text,
      language: response.language,
      durationSeconds: response.duration
    };
    if (response.words) {
      result.words = response.words.map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end
      }));
    }
    if (response.segments) {
      result.segments = response.segments.map((s) => ({
        id: s.id,
        text: s.text,
        start: s.start,
        end: s.end,
        tokens: s.tokens
      }));
    }
    return result;
  }
  /**
   * Handle OpenAI API errors
   */
  handleError(error) {
    if (error instanceof OpenAI2.APIError) {
      const status = error.status;
      const message = error.message || "Unknown OpenAI API error";
      if (status === 401) {
        throw new ProviderAuthError("openai", "Invalid API key");
      }
      if (status === 429) {
        throw new ProviderRateLimitError("openai", message);
      }
      if (status === 400) {
        throw new ProviderError("openai", `Bad request: ${message}`);
      }
      if (status === 413) {
        throw new ProviderError("openai", "Audio file too large (max 25MB)");
      }
      throw new ProviderError("openai", message);
    }
    throw error;
  }
};

// src/core/createAudioProvider.ts
function createTTSProvider(connector) {
  const vendor = connector.vendor;
  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAITTSProvider(extractOpenAIConfig(connector));
    case Vendor.Google:
      throw new Error(`Google TTS provider not yet implemented`);
    default:
      throw new Error(
        `No TTS provider available for vendor: ${vendor}. Supported vendors: ${Vendor.OpenAI}`
      );
  }
}
function createSTTProvider(connector) {
  const vendor = connector.vendor;
  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAISTTProvider(extractOpenAIConfig(connector));
    case Vendor.Groq:
      throw new Error(`Groq STT provider not yet implemented`);
    case Vendor.Google:
      throw new Error(`Google STT provider not yet implemented`);
    default:
      throw new Error(
        `No STT provider available for vendor: ${vendor}. Supported vendors: ${Vendor.OpenAI}, ${Vendor.Groq}`
      );
  }
}
function extractOpenAIConfig(connector) {
  const auth = connector.config.auth;
  if (auth.type !== "api_key") {
    throw new Error("OpenAI requires API key authentication");
  }
  const options = connector.getOptions();
  return {
    auth: {
      type: "api_key",
      apiKey: auth.apiKey
    },
    baseURL: connector.baseURL,
    organization: options.organization,
    timeout: options.timeout,
    maxRetries: options.maxRetries
  };
}

// src/domain/entities/RegistryUtils.ts
function createRegistryHelpers(registry) {
  return {
    /**
     * Get model information by name
     */
    getInfo: (modelName) => {
      return registry[modelName];
    },
    /**
     * Get all active models for a specific vendor
     */
    getByVendor: (vendor) => {
      return Object.values(registry).filter(
        (model) => model.provider === vendor && model.isActive
      );
    },
    /**
     * Get all currently active models (across all vendors)
     */
    getActive: () => {
      return Object.values(registry).filter((model) => model.isActive);
    },
    /**
     * Get all models (including inactive/deprecated)
     */
    getAll: () => {
      return Object.values(registry);
    },
    /**
     * Check if model exists in registry
     */
    has: (modelName) => {
      return modelName in registry;
    }
  };
}

// src/domain/entities/TTSModel.ts
var TTS_MODELS = {
  [Vendor.OpenAI]: {
    /** NEW: Instruction-steerable TTS with emotional control */
    GPT_4O_MINI_TTS: "gpt-4o-mini-tts",
    /** Fast, low-latency TTS */
    TTS_1: "tts-1",
    /** High-definition TTS */
    TTS_1_HD: "tts-1-hd"
  },
  [Vendor.Google]: {
    /** Gemini native TTS */
    GEMINI_TTS: "gemini-tts"
  }
};
var OPENAI_TTS_BASE = {
  voices: OPENAI_VOICES,
  formats: AUDIO_FORMATS.OPENAI_TTS,
  languages: COMMON_LANGUAGES.OPENAI_TTS,
  speed: { supported: true, min: 0.25, max: 4, default: 1 }
};
var TTS_MODEL_REGISTRY = {
  // ======================== OpenAI ========================
  "gpt-4o-mini-tts": {
    name: "gpt-4o-mini-tts",
    displayName: "GPT-4o Mini TTS",
    provider: Vendor.OpenAI,
    description: "Instruction-steerable TTS with emotional control via prompts",
    isActive: true,
    releaseDate: "2025-03-01",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/text-to-speech",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false,
        // Not implementing streaming in v1
        ssml: false,
        emotions: true,
        // Via instruction steering
        voiceCloning: true,
        wordTimestamps: false,
        instructionSteering: true
      },
      limits: { maxInputLength: 2e3 },
      vendorOptions: {
        instructions: {
          type: "string",
          description: 'Natural language instructions for voice style (e.g., "speak like a calm meditation guide")'
        }
      }
    },
    pricing: { per1kCharacters: 0.015, currency: "USD" }
  },
  "tts-1": {
    name: "tts-1",
    displayName: "TTS-1",
    provider: Vendor.OpenAI,
    description: "Fast, low-latency text-to-speech optimized for real-time use",
    isActive: true,
    releaseDate: "2023-11-06",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/text-to-speech",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false,
        // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false
      },
      limits: { maxInputLength: 4096 }
    },
    pricing: { per1kCharacters: 0.015, currency: "USD" }
  },
  "tts-1-hd": {
    name: "tts-1-hd",
    displayName: "TTS-1 HD",
    provider: Vendor.OpenAI,
    description: "High-definition text-to-speech with improved audio quality",
    isActive: true,
    releaseDate: "2023-11-06",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/text-to-speech",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      ...OPENAI_TTS_BASE,
      features: {
        streaming: false,
        // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false
      },
      limits: { maxInputLength: 4096 }
    },
    pricing: { per1kCharacters: 0.03, currency: "USD" }
  },
  // ======================== Google ========================
  "gemini-tts": {
    name: "gemini-tts",
    displayName: "Gemini TTS",
    provider: Vendor.Google,
    description: "Google Gemini native text-to-speech",
    isActive: true,
    sources: {
      documentation: "https://ai.google.dev/gemini-api/docs/text-to-speech",
      pricing: "https://ai.google.dev/pricing",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      voices: GEMINI_VOICES,
      formats: AUDIO_FORMATS.GOOGLE_TTS,
      languages: COMMON_LANGUAGES.CORE,
      speed: { supported: true, min: 0.5, max: 2 },
      features: {
        streaming: false,
        // Not implementing streaming in v1
        ssml: false,
        emotions: false,
        voiceCloning: false,
        wordTimestamps: false
      },
      limits: { maxInputLength: 8e3 }
    }
  }
};
var helpers = createRegistryHelpers(TTS_MODEL_REGISTRY);
var getTTSModelInfo = helpers.getInfo;
var getTTSModelsByVendor = helpers.getByVendor;
var getActiveTTSModels = helpers.getActive;
function getTTSModelsWithFeature(feature) {
  return Object.values(TTS_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}
function calculateTTSCost(modelName, characterCount) {
  const model = getTTSModelInfo(modelName);
  if (!model?.pricing) return null;
  return characterCount / 1e3 * model.pricing.per1kCharacters;
}
var TextToSpeech = class _TextToSpeech {
  provider;
  config;
  /**
   * Create a new TextToSpeech instance
   */
  static create(config) {
    return new _TextToSpeech(config);
  }
  constructor(config) {
    const connector = typeof config.connector === "string" ? Connector.get(config.connector) : config.connector;
    this.provider = createTTSProvider(connector);
    this.config = config;
  }
  // ======================== Synthesis Methods ========================
  /**
   * Synthesize speech from text
   *
   * @param text - Text to synthesize
   * @param options - Optional synthesis parameters
   * @returns Audio data and metadata
   */
  async synthesize(text, options) {
    const fullOptions = {
      model: this.config.model ?? this.getDefaultModel(),
      input: text,
      voice: options?.voice ?? this.config.voice ?? this.getDefaultVoice(),
      format: options?.format ?? this.config.format,
      speed: options?.speed ?? this.config.speed,
      vendorOptions: options?.vendorOptions
    };
    return this.provider.synthesize(fullOptions);
  }
  /**
   * Synthesize speech and save to file
   *
   * @param text - Text to synthesize
   * @param filePath - Output file path
   * @param options - Optional synthesis parameters
   */
  async toFile(text, filePath, options) {
    const response = await this.synthesize(text, options);
    await fs8.writeFile(filePath, response.audio);
  }
  // ======================== Introspection Methods ========================
  /**
   * Get model information for current or specified model
   */
  getModelInfo(model) {
    const targetModel = model ?? this.config.model ?? this.getDefaultModel();
    const info = getTTSModelInfo(targetModel);
    if (!info) {
      throw new Error(`Unknown TTS model: ${targetModel}`);
    }
    return info;
  }
  /**
   * Get model capabilities
   */
  getModelCapabilities(model) {
    return this.getModelInfo(model).capabilities;
  }
  /**
   * List all available voices for current model
   * For dynamic voice providers (e.g., ElevenLabs), fetches from API
   * For static providers (e.g., OpenAI), returns from registry
   */
  async listVoices(model) {
    if (this.provider.listVoices) {
      return this.provider.listVoices();
    }
    const caps = this.getModelCapabilities(model);
    return caps.voices;
  }
  /**
   * List all available models for this provider's vendor
   */
  listAvailableModels() {
    const vendor = this.provider.vendor;
    if (!vendor) {
      return [];
    }
    return getTTSModelsByVendor(vendor);
  }
  /**
   * Check if a specific feature is supported by the model
   */
  supportsFeature(feature, model) {
    const caps = this.getModelCapabilities(model);
    return Boolean(caps.features[feature]);
  }
  /**
   * Get supported audio formats for the model
   */
  getSupportedFormats(model) {
    return this.getModelCapabilities(model).formats;
  }
  /**
   * Get supported languages for the model
   */
  getSupportedLanguages(model) {
    return this.getModelCapabilities(model).languages;
  }
  /**
   * Check if speed control is supported
   */
  supportsSpeedControl(model) {
    return this.getModelCapabilities(model).speed.supported;
  }
  // ======================== Configuration Methods ========================
  /**
   * Update default model
   */
  setModel(model) {
    this.config.model = model;
  }
  /**
   * Update default voice
   */
  setVoice(voice) {
    this.config.voice = voice;
  }
  /**
   * Update default format
   */
  setFormat(format) {
    this.config.format = format;
  }
  /**
   * Update default speed
   */
  setSpeed(speed) {
    this.config.speed = speed;
  }
  // ======================== Private Methods ========================
  /**
   * Get default model (first active model for vendor)
   */
  getDefaultModel() {
    const models = this.listAvailableModels();
    const firstModel = models[0];
    if (!firstModel) {
      throw new Error("No TTS models available for this provider");
    }
    return firstModel.name;
  }
  /**
   * Get default voice (first or default-marked voice)
   */
  getDefaultVoice() {
    const caps = this.getModelInfo().capabilities;
    const defaultVoice = caps.voices.find((v) => v.isDefault);
    return defaultVoice?.id ?? caps.voices[0]?.id ?? "alloy";
  }
};

// src/domain/entities/STTModel.ts
var STT_MODELS = {
  [Vendor.OpenAI]: {
    /** NEW: GPT-4o based transcription */
    GPT_4O_TRANSCRIBE: "gpt-4o-transcribe",
    /** NEW: GPT-4o with speaker diarization */
    GPT_4O_TRANSCRIBE_DIARIZE: "gpt-4o-transcribe-diarize",
    /** Classic Whisper */
    WHISPER_1: "whisper-1"
  },
  [Vendor.Groq]: {
    /** Ultra-fast Whisper on Groq LPUs */
    WHISPER_LARGE_V3: "whisper-large-v3",
    /** Faster English-only variant */
    DISTIL_WHISPER: "distil-whisper-large-v3-en"
  }
};
var WHISPER_BASE_CAPABILITIES = {
  inputFormats: AUDIO_FORMATS.STT_INPUT,
  outputFormats: ["json", "text", "srt", "vtt", "verbose_json"],
  languages: [],
  // Auto-detect, 50+ languages
  timestamps: { supported: true, granularities: ["word", "segment"] }
};
var STT_MODEL_REGISTRY = {
  // ======================== OpenAI ========================
  "gpt-4o-transcribe": {
    name: "gpt-4o-transcribe",
    displayName: "GPT-4o Transcribe",
    provider: Vendor.OpenAI,
    description: "GPT-4o based transcription with superior accuracy and context understanding",
    isActive: true,
    releaseDate: "2025-04-01",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/speech-to-text",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        // Not implementing streaming in v1
        punctuation: true,
        profanityFilter: false
      },
      limits: { maxFileSizeMB: 25, maxDurationSeconds: 7200 }
    },
    pricing: { perMinute: 6e-3, currency: "USD" }
  },
  "gpt-4o-transcribe-diarize": {
    name: "gpt-4o-transcribe-diarize",
    displayName: "GPT-4o Transcribe + Diarization",
    provider: Vendor.OpenAI,
    description: "GPT-4o transcription with speaker identification",
    isActive: true,
    releaseDate: "2025-04-01",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/speech-to-text",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      outputFormats: ["json", "verbose_json"],
      features: {
        translation: true,
        diarization: true,
        // Built-in speaker identification
        streaming: false,
        punctuation: true,
        profanityFilter: false
      },
      limits: { maxFileSizeMB: 25, maxDurationSeconds: 7200 },
      vendorOptions: {
        max_speakers: {
          type: "number",
          description: "Maximum number of speakers to detect",
          min: 2,
          max: 10,
          default: 4
        }
      }
    },
    pricing: { perMinute: 0.012, currency: "USD" }
    // 2x for diarization
  },
  "whisper-1": {
    name: "whisper-1",
    displayName: "Whisper",
    provider: Vendor.OpenAI,
    description: "OpenAI's general-purpose speech recognition model",
    isActive: true,
    releaseDate: "2023-03-01",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/speech-to-text",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      inputFormats: ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"],
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false
      },
      limits: { maxFileSizeMB: 25 }
    },
    pricing: { perMinute: 6e-3, currency: "USD" }
  },
  // ======================== Groq ========================
  "whisper-large-v3": {
    name: "whisper-large-v3",
    displayName: "Whisper Large v3 (Groq)",
    provider: Vendor.Groq,
    description: "Ultra-fast Whisper on Groq LPUs - 12x cheaper than OpenAI",
    isActive: true,
    releaseDate: "2024-04-01",
    sources: {
      documentation: "https://console.groq.com/docs/speech-text",
      pricing: "https://groq.com/pricing/",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      ...WHISPER_BASE_CAPABILITIES,
      timestamps: { supported: true, granularities: ["segment"] },
      outputFormats: ["json", "text", "verbose_json"],
      features: {
        translation: true,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false
      },
      limits: { maxFileSizeMB: 25 }
    },
    pricing: { perMinute: 5e-4, currency: "USD" }
    // 12x cheaper!
  },
  "distil-whisper-large-v3-en": {
    name: "distil-whisper-large-v3-en",
    displayName: "Distil Whisper (Groq)",
    provider: Vendor.Groq,
    description: "Faster English-only Whisper variant on Groq",
    isActive: true,
    releaseDate: "2024-04-01",
    sources: {
      documentation: "https://console.groq.com/docs/speech-text",
      pricing: "https://groq.com/pricing/",
      lastVerified: "2026-01-24"
    },
    capabilities: {
      inputFormats: AUDIO_FORMATS.STT_INPUT,
      outputFormats: ["json", "text", "verbose_json"],
      languages: ["en"],
      // English only
      timestamps: { supported: true, granularities: ["segment"] },
      features: {
        translation: false,
        diarization: false,
        streaming: false,
        punctuation: true,
        profanityFilter: false
      },
      limits: { maxFileSizeMB: 25 }
    },
    pricing: { perMinute: 33e-5, currency: "USD" }
  }
};
var helpers2 = createRegistryHelpers(STT_MODEL_REGISTRY);
var getSTTModelInfo = helpers2.getInfo;
var getSTTModelsByVendor = helpers2.getByVendor;
var getActiveSTTModels = helpers2.getActive;
function getSTTModelsWithFeature(feature) {
  return Object.values(STT_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}
function calculateSTTCost(modelName, durationSeconds) {
  const model = getSTTModelInfo(modelName);
  if (!model?.pricing) return null;
  return durationSeconds / 60 * model.pricing.perMinute;
}
var SpeechToText = class _SpeechToText {
  provider;
  config;
  /**
   * Create a new SpeechToText instance
   */
  static create(config) {
    return new _SpeechToText(config);
  }
  constructor(config) {
    const connector = typeof config.connector === "string" ? Connector.get(config.connector) : config.connector;
    this.provider = createSTTProvider(connector);
    this.config = config;
  }
  // ======================== Transcription Methods ========================
  /**
   * Transcribe audio to text
   *
   * @param audio - Audio data as Buffer or file path
   * @param options - Optional transcription parameters
   * @returns Transcription result with text and metadata
   */
  async transcribe(audio, options) {
    const fullOptions = {
      model: this.config.model ?? this.getDefaultModel(),
      audio,
      language: options?.language ?? this.config.language,
      outputFormat: options?.outputFormat,
      includeTimestamps: options?.includeTimestamps,
      timestampGranularity: options?.timestampGranularity,
      prompt: options?.prompt,
      temperature: options?.temperature ?? this.config.temperature,
      vendorOptions: options?.vendorOptions
    };
    return this.provider.transcribe(fullOptions);
  }
  /**
   * Transcribe audio file by path
   *
   * @param filePath - Path to audio file
   * @param options - Optional transcription parameters
   */
  async transcribeFile(filePath, options) {
    const audio = await fs8.readFile(filePath);
    return this.transcribe(audio, options);
  }
  /**
   * Transcribe audio with word or segment timestamps
   *
   * @param audio - Audio data as Buffer or file path
   * @param granularity - Timestamp granularity ('word' or 'segment')
   * @param options - Optional transcription parameters
   */
  async transcribeWithTimestamps(audio, granularity = "segment", options) {
    return this.transcribe(audio, {
      ...options,
      outputFormat: "verbose_json",
      includeTimestamps: true,
      timestampGranularity: granularity
    });
  }
  /**
   * Translate audio to English text
   * Note: Only supported by some models (e.g., Whisper)
   *
   * @param audio - Audio data as Buffer or file path
   * @param options - Optional transcription parameters
   */
  async translate(audio, options) {
    if (!this.provider.translate) {
      throw new Error("Translation not supported by this provider");
    }
    const fullOptions = {
      model: this.config.model ?? this.getDefaultModel(),
      audio,
      outputFormat: options?.outputFormat,
      prompt: options?.prompt,
      temperature: options?.temperature ?? this.config.temperature,
      vendorOptions: options?.vendorOptions
    };
    return this.provider.translate(fullOptions);
  }
  // ======================== Introspection Methods ========================
  /**
   * Get model information for current or specified model
   */
  getModelInfo(model) {
    const targetModel = model ?? this.config.model ?? this.getDefaultModel();
    const info = getSTTModelInfo(targetModel);
    if (!info) {
      throw new Error(`Unknown STT model: ${targetModel}`);
    }
    return info;
  }
  /**
   * Get model capabilities
   */
  getModelCapabilities(model) {
    return this.getModelInfo(model).capabilities;
  }
  /**
   * List all available models for this provider's vendor
   */
  listAvailableModels() {
    const vendor = this.provider.vendor;
    if (!vendor) {
      return [];
    }
    return getSTTModelsByVendor(vendor);
  }
  /**
   * Check if a specific feature is supported by the model
   */
  supportsFeature(feature, model) {
    const caps = this.getModelCapabilities(model);
    return Boolean(caps.features[feature]);
  }
  /**
   * Get supported input audio formats
   */
  getSupportedInputFormats(model) {
    return this.getModelCapabilities(model).inputFormats;
  }
  /**
   * Get supported output formats
   */
  getSupportedOutputFormats(model) {
    return this.getModelCapabilities(model).outputFormats;
  }
  /**
   * Get supported languages (empty array = auto-detect all)
   */
  getSupportedLanguages(model) {
    return this.getModelCapabilities(model).languages;
  }
  /**
   * Check if timestamps are supported
   */
  supportsTimestamps(model) {
    return this.getModelCapabilities(model).timestamps.supported;
  }
  /**
   * Check if translation is supported
   */
  supportsTranslation(model) {
    return this.supportsFeature("translation", model);
  }
  /**
   * Check if speaker diarization is supported
   */
  supportsDiarization(model) {
    return this.supportsFeature("diarization", model);
  }
  /**
   * Get timestamp granularities supported
   */
  getTimestampGranularities(model) {
    return this.getModelCapabilities(model).timestamps.granularities;
  }
  // ======================== Configuration Methods ========================
  /**
   * Update default model
   */
  setModel(model) {
    this.config.model = model;
  }
  /**
   * Update default language
   */
  setLanguage(language) {
    this.config.language = language;
  }
  /**
   * Update default temperature
   */
  setTemperature(temperature) {
    this.config.temperature = temperature;
  }
  // ======================== Private Methods ========================
  /**
   * Get default model (first active model for vendor)
   */
  getDefaultModel() {
    const models = this.listAvailableModels();
    const firstModel = models[0];
    if (!firstModel) {
      throw new Error("No STT models available for this provider");
    }
    return firstModel.name;
  }
};

// src/domain/entities/Task.ts
function createTask(input) {
  const now = Date.now();
  const id = input.id ?? `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    name: input.name,
    description: input.description,
    status: "pending",
    dependsOn: input.dependsOn ?? [],
    externalDependency: input.externalDependency,
    condition: input.condition,
    execution: input.execution,
    expectedOutput: input.expectedOutput,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    createdAt: now,
    lastUpdatedAt: now,
    metadata: input.metadata
  };
}
function createPlan(input) {
  const now = Date.now();
  const id = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const tasks = input.tasks.map((taskInput) => createTask(taskInput));
  const nameToId = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    nameToId.set(task.name, task.id);
  }
  for (let i = 0; i < tasks.length; i++) {
    const taskInput = input.tasks[i];
    const task = tasks[i];
    if (taskInput.dependsOn && taskInput.dependsOn.length > 0) {
      task.dependsOn = taskInput.dependsOn.map((dep) => {
        if (dep.startsWith("task-")) {
          return dep;
        }
        const resolvedId = nameToId.get(dep);
        if (!resolvedId) {
          throw new Error(`Task dependency "${dep}" not found in plan`);
        }
        return resolvedId;
      });
    }
  }
  return {
    id,
    goal: input.goal,
    context: input.context,
    tasks,
    concurrency: input.concurrency,
    allowDynamicTasks: input.allowDynamicTasks ?? true,
    status: "pending",
    createdAt: now,
    lastUpdatedAt: now,
    metadata: input.metadata
  };
}
function canTaskExecute(task, allTasks) {
  if (task.status !== "pending") {
    return false;
  }
  if (task.dependsOn.length > 0) {
    for (const depId of task.dependsOn) {
      const depTask = allTasks.find((t) => t.id === depId);
      if (!depTask || depTask.status !== "completed") {
        return false;
      }
    }
  }
  return true;
}
function getNextExecutableTasks(plan) {
  const executable = plan.tasks.filter((task) => canTaskExecute(task, plan.tasks));
  if (executable.length === 0) {
    return [];
  }
  if (!plan.concurrency) {
    return [executable[0]];
  }
  const runningCount = plan.tasks.filter((t) => t.status === "in_progress").length;
  const availableSlots = plan.concurrency.maxParallelTasks - runningCount;
  if (availableSlots <= 0) {
    return [];
  }
  const parallelTasks = executable.filter((task) => task.execution?.parallel === true);
  if (parallelTasks.length === 0) {
    return [executable[0]];
  }
  let sortedTasks = [...parallelTasks];
  if (plan.concurrency.strategy === "priority") {
    sortedTasks.sort((a, b) => (b.execution?.priority ?? 0) - (a.execution?.priority ?? 0));
  }
  return sortedTasks.slice(0, availableSlots);
}
async function evaluateCondition(condition, memory) {
  const value = await memory.get(condition.memoryKey);
  switch (condition.operator) {
    case "exists":
      return value !== void 0;
    case "not_exists":
      return value === void 0;
    case "equals":
      return value === condition.value;
    case "contains":
      if (Array.isArray(value)) {
        return value.includes(condition.value);
      }
      if (typeof value === "string" && typeof condition.value === "string") {
        return value.includes(condition.value);
      }
      return false;
    case "truthy":
      return !!value;
    case "greater_than":
      if (typeof value === "number" && typeof condition.value === "number") {
        return value > condition.value;
      }
      return false;
    case "less_than":
      if (typeof value === "number" && typeof condition.value === "number") {
        return value < condition.value;
      }
      return false;
    default:
      return false;
  }
}
function updateTaskStatus(task, status) {
  const now = Date.now();
  const updated = {
    ...task,
    status,
    lastUpdatedAt: now
  };
  if (status === "in_progress") {
    if (!updated.startedAt) {
      updated.startedAt = now;
    }
    updated.attempts += 1;
  }
  if ((status === "completed" || status === "failed") && !updated.completedAt) {
    updated.completedAt = now;
  }
  return updated;
}

// src/domain/entities/AgentState.ts
function createAgentState(id, config, plan) {
  const now = Date.now();
  return {
    id,
    status: "idle",
    config,
    plan,
    memoryId: `memory-${id}`,
    conversationHistory: [],
    createdAt: now,
    lastActivityAt: now,
    metrics: {
      totalLLMCalls: 0,
      totalToolCalls: 0,
      totalTokensUsed: 0,
      totalCost: 0
    }
  };
}
function updateAgentStatus(state, status) {
  const now = Date.now();
  const updated = {
    ...state,
    status,
    lastActivityAt: now
  };
  if (status === "running" && !updated.startedAt) {
    updated.startedAt = now;
  }
  if (status === "suspended" && !updated.suspendedAt) {
    updated.suspendedAt = now;
  }
  if ((status === "completed" || status === "failed" || status === "cancelled") && !updated.completedAt) {
    updated.completedAt = now;
  }
  return updated;
}

// src/capabilities/taskAgent/TaskAgent.ts
init_Memory();

// src/infrastructure/storage/InMemoryStorage.ts
var InMemoryStorage = class {
  store = /* @__PURE__ */ new Map();
  async get(key) {
    return this.store.get(key);
  }
  async set(key, entry) {
    this.store.set(key, entry);
  }
  async delete(key) {
    this.store.delete(key);
  }
  async has(key) {
    return this.store.has(key);
  }
  async getAll() {
    return Array.from(this.store.values());
  }
  async getByScope(scope) {
    return Array.from(this.store.values()).filter((entry) => entry.scope === scope);
  }
  async clearScope(scope) {
    const toDelete = [];
    for (const [key, entry] of this.store.entries()) {
      if (entry.scope === scope) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      this.store.delete(key);
    }
  }
  async clear() {
    this.store.clear();
  }
  async getTotalSize() {
    let total = 0;
    for (const entry of this.store.values()) {
      total += entry.sizeBytes;
    }
    return total;
  }
};
var InMemoryPlanStorage = class {
  plans = /* @__PURE__ */ new Map();
  async savePlan(plan) {
    this.plans.set(plan.id, JSON.parse(JSON.stringify(plan)));
  }
  async getPlan(planId) {
    const plan = this.plans.get(planId);
    return plan ? JSON.parse(JSON.stringify(plan)) : void 0;
  }
  async updateTask(planId, task) {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }
    const taskIndex = plan.tasks.findIndex((t) => t.id === task.id);
    if (taskIndex === -1) {
      throw new Error(`Task ${task.id} not found in plan ${planId}`);
    }
    plan.tasks[taskIndex] = JSON.parse(JSON.stringify(task));
  }
  async addTask(planId, task) {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }
    plan.tasks.push(JSON.parse(JSON.stringify(task)));
  }
  async deletePlan(planId) {
    this.plans.delete(planId);
  }
  async listPlans(filter) {
    const allPlans = Array.from(this.plans.values());
    if (!filter || !filter.status) {
      return allPlans.map((p) => JSON.parse(JSON.stringify(p)));
    }
    return allPlans.filter((plan) => filter.status.includes(plan.status)).map((p) => JSON.parse(JSON.stringify(p)));
  }
  async findByWebhookId(webhookId) {
    for (const plan of this.plans.values()) {
      for (const task of plan.tasks) {
        if (task.externalDependency?.webhookId === webhookId) {
          return {
            plan: JSON.parse(JSON.stringify(plan)),
            task: JSON.parse(JSON.stringify(task))
          };
        }
      }
    }
    return void 0;
  }
};
var InMemoryAgentStateStorage = class {
  agents = /* @__PURE__ */ new Map();
  async save(state) {
    this.agents.set(state.id, JSON.parse(JSON.stringify(state)));
  }
  async load(agentId) {
    const state = this.agents.get(agentId);
    return state ? JSON.parse(JSON.stringify(state)) : void 0;
  }
  async delete(agentId) {
    this.agents.delete(agentId);
  }
  async list(filter) {
    const allStates = Array.from(this.agents.values());
    if (!filter || !filter.status) {
      return allStates.map((s) => JSON.parse(JSON.stringify(s)));
    }
    return allStates.filter((state) => filter.status.includes(state.status)).map((s) => JSON.parse(JSON.stringify(s)));
  }
  async patch(agentId, updates) {
    const state = this.agents.get(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not found`);
    }
    Object.assign(state, updates);
  }
};
function createAgentStorage(options = {}) {
  return {
    memory: options.memory ?? new InMemoryStorage(),
    plan: options.plan ?? new InMemoryPlanStorage(),
    agent: options.agent ?? new InMemoryAgentStateStorage()
  };
}

// src/capabilities/taskAgent/WorkingMemory.ts
init_Memory();
var WorkingMemory = class extends EventEmitter {
  storage;
  config;
  constructor(storage, config = DEFAULT_MEMORY_CONFIG) {
    super();
    this.storage = storage;
    this.config = config;
  }
  /**
   * Store a value in working memory
   */
  async store(key, description, value, scope = "task") {
    const { createMemoryEntry: createMemoryEntry2 } = await Promise.resolve().then(() => (init_Memory(), Memory_exports));
    const entry = createMemoryEntry2({ key, description, value, scope }, this.config);
    const currentSize = await this.storage.getTotalSize();
    const existing = await this.storage.get(key);
    const existingSize = existing?.sizeBytes ?? 0;
    const newTotalSize = currentSize - existingSize + entry.sizeBytes;
    const limit = this.getLimit();
    if (newTotalSize > limit) {
      throw new Error(`Memory limit exceeded: ${newTotalSize} bytes > ${limit} bytes`);
    }
    const utilization = newTotalSize / limit * 100;
    if (utilization > this.config.softLimitPercent) {
      this.emit("limit_warning", { utilizationPercent: utilization });
    }
    await this.storage.set(key, entry);
    this.emit("stored", { key, description });
  }
  /**
   * Retrieve a value from working memory
   */
  async retrieve(key) {
    const entry = await this.storage.get(key);
    if (!entry) {
      return void 0;
    }
    entry.lastAccessedAt = Date.now();
    entry.accessCount += 1;
    await this.storage.set(key, entry);
    this.emit("retrieved", { key });
    return entry.value;
  }
  /**
   * Retrieve multiple values
   */
  async retrieveMany(keys) {
    const result = {};
    for (const key of keys) {
      const value = await this.retrieve(key);
      if (value !== void 0) {
        result[key] = value;
      }
    }
    return result;
  }
  /**
   * Delete a value from working memory
   */
  async delete(key) {
    await this.storage.delete(key);
    this.emit("deleted", { key });
  }
  /**
   * Check if key exists
   */
  async has(key) {
    return this.storage.has(key);
  }
  /**
   * Promote a task-scoped entry to persistent
   */
  async persist(key) {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    if (entry.scope !== "persistent") {
      entry.scope = "persistent";
      await this.storage.set(key, entry);
    }
  }
  /**
   * Clear all entries of a specific scope
   */
  async clearScope(scope) {
    await this.storage.clearScope(scope);
  }
  /**
   * Clear all entries
   */
  async clear() {
    await this.storage.clear();
  }
  /**
   * Get memory index
   */
  async getIndex() {
    const { formatSizeHuman: formatSizeHuman2 } = await Promise.resolve().then(() => (init_Memory(), Memory_exports));
    const entries = await this.storage.getAll();
    const totalSizeBytes = await this.storage.getTotalSize();
    const limitBytes = this.getLimit();
    const sortedEntries = entries.sort((a, b) => {
      if (a.scope === "persistent" && b.scope !== "persistent") return -1;
      if (a.scope !== "persistent" && b.scope === "persistent") return 1;
      return 0;
    });
    const indexEntries = sortedEntries.map((entry) => ({
      key: entry.key,
      description: entry.description,
      size: formatSizeHuman2(entry.sizeBytes),
      scope: entry.scope
    }));
    return {
      entries: indexEntries,
      totalSizeBytes,
      totalSizeHuman: formatSizeHuman2(totalSizeBytes),
      limitBytes,
      limitHuman: formatSizeHuman2(limitBytes),
      utilizationPercent: totalSizeBytes / limitBytes * 100
    };
  }
  /**
   * Format index for context injection
   */
  async formatIndex() {
    const { formatMemoryIndex: formatMemoryIndex2 } = await Promise.resolve().then(() => (init_Memory(), Memory_exports));
    const index = await this.getIndex();
    return formatMemoryIndex2(index);
  }
  /**
   * Evict least recently used entries
   */
  async evictLRU(count) {
    const entries = await this.storage.getAll();
    const evictable = entries.filter((entry) => entry.scope === "task").sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    const toEvict = evictable.slice(0, count);
    const evictedKeys = [];
    for (const entry of toEvict) {
      await this.storage.delete(entry.key);
      evictedKeys.push(entry.key);
    }
    return evictedKeys;
  }
  /**
   * Evict largest entries first
   */
  async evictBySize(count) {
    const entries = await this.storage.getAll();
    const evictable = entries.filter((entry) => entry.scope === "task").sort((a, b) => b.sizeBytes - a.sizeBytes);
    const toEvict = evictable.slice(0, count);
    const evictedKeys = [];
    for (const entry of toEvict) {
      await this.storage.delete(entry.key);
      evictedKeys.push(entry.key);
    }
    return evictedKeys;
  }
  /**
   * Get limited memory access for tools
   */
  getAccess() {
    return {
      get: async (key) => this.retrieve(key),
      set: async (key, description, value) => this.store(key, description, value),
      delete: async (key) => this.delete(key),
      has: async (key) => this.has(key),
      list: async () => {
        const index = await this.getIndex();
        return index.entries.map((e) => ({ key: e.key, description: e.description }));
      }
    };
  }
  /**
   * Get the configured memory limit
   */
  getLimit() {
    return this.config.maxSizeBytes ?? 512 * 1024;
  }
};
var DEFAULT_CONTEXT_CONFIG = {
  maxContextTokens: 128e3,
  compactionThreshold: 0.75,
  hardLimit: 0.9,
  responseReserve: 0.15,
  tokenEstimator: "approximate"
};
var DEFAULT_COMPACTION_STRATEGY = {
  priority: ["toolOutputs", "history", "memory"],
  historyStrategy: "summarize",
  memoryStrategy: "lru",
  toolOutputMaxSize: 4e3
};
var ContextManager = class extends EventEmitter {
  config;
  strategy;
  lastBudget;
  constructor(config = DEFAULT_CONTEXT_CONFIG, strategy = DEFAULT_COMPACTION_STRATEGY) {
    super();
    this.config = config;
    this.strategy = strategy;
  }
  /**
   * Estimate token count for text
   */
  estimateTokens(text) {
    if (!text || text.length === 0) {
      return 0;
    }
    if (this.config.tokenEstimator === "approximate") {
      return Math.ceil(text.length / 4);
    }
    return Math.ceil(text.length / 4);
  }
  /**
   * Estimate budget for context components
   */
  estimateBudget(components) {
    const breakdown = {
      systemPrompt: this.estimateTokens(components.systemPrompt),
      instructions: this.estimateTokens(components.instructions),
      memoryIndex: this.estimateTokens(components.memoryIndex),
      conversationHistory: components.conversationHistory.reduce(
        (sum, msg) => sum + this.estimateTokens(msg.content),
        0
      ),
      currentInput: this.estimateTokens(components.currentInput)
    };
    const used = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    const total = this.config.maxContextTokens;
    const reserved = Math.floor(total * this.config.responseReserve);
    const available = total - reserved - used;
    const utilizationPercent = used / (total - reserved) * 100;
    const utilizationRatio = (used + reserved) / total;
    let status;
    if (utilizationRatio >= this.config.hardLimit) {
      status = "critical";
    } else if (utilizationRatio >= this.config.compactionThreshold) {
      status = "warning";
    } else {
      status = "ok";
    }
    return {
      total,
      reserved,
      used,
      available,
      utilizationPercent,
      status,
      breakdown
    };
  }
  /**
   * Prepare context, compacting if necessary
   */
  async prepareContext(components, memory, history) {
    let current = { ...components };
    let budget = this.estimateBudget(current);
    this.lastBudget = budget;
    if (budget.status === "ok") {
      return { components: current, budget, compacted: false };
    }
    this.emit("compacting", { reason: `Context at ${budget.utilizationPercent.toFixed(1)}%` });
    const log = [];
    let compactionRound = 0;
    const maxRounds = 3;
    while (budget.status !== "ok" && compactionRound < maxRounds) {
      compactionRound++;
      let didCompact = false;
      for (const target of this.strategy.priority) {
        budget = this.estimateBudget(current);
        if (budget.status === "ok") {
          break;
        }
        switch (target) {
          case "toolOutputs":
            if (current.conversationHistory.length > 0) {
              const before = JSON.stringify(current);
              current = this.truncateToolOutputsInHistory(current);
              if (JSON.stringify(current) !== before) {
                log.push(`Truncated tool outputs to ${this.strategy.toolOutputMaxSize} tokens`);
                didCompact = true;
              }
            }
            break;
          case "history":
            if (current.conversationHistory.length > 0) {
              if (this.strategy.historyStrategy === "truncate") {
                const keepRatio = Math.max(0.2, 1 - compactionRound * 0.3);
                const maxMessages = Math.max(1, Math.floor(current.conversationHistory.length * keepRatio));
                const before = current.conversationHistory.length;
                current.conversationHistory = current.conversationHistory.slice(-maxMessages);
                if (current.conversationHistory.length < before) {
                  log.push(`Truncated history to ${maxMessages} messages`);
                  didCompact = true;
                }
              } else {
                await history.summarize();
                log.push("Summarized conversation history");
                didCompact = true;
              }
            }
            break;
          case "memory":
            const entryCount = memory.getIndex ? (await memory.getIndex()).entries.length : 4;
            const evictCount = Math.max(1, Math.ceil(entryCount * 0.25));
            if (evictCount > 0) {
              const evicted = await memory.evictLRU(evictCount);
              if (evicted.length > 0) {
                log.push(`Evicted ${evicted.length} memory entries: ${evicted.join(", ")}`);
                didCompact = true;
                if (memory.formatIndex) {
                  current.memoryIndex = await memory.formatIndex();
                }
              }
            }
            break;
        }
      }
      if (!didCompact) {
        break;
      }
    }
    budget = this.estimateBudget(current);
    const totalCapacity = budget.total - budget.reserved;
    const overage = budget.used - totalCapacity;
    const overagePercent = overage / totalCapacity * 100;
    if (overage > 0 && overagePercent > 5) {
      throw new Error(
        `Cannot fit context within limits after compaction. Used: ${budget.used}, Available: ${totalCapacity} (${overagePercent.toFixed(1)}% over)`
      );
    }
    this.emit("compacted", { log });
    return { components: current, budget, compacted: true, compactionLog: log };
  }
  /**
   * Truncate tool outputs in conversation history
   */
  truncateToolOutputsInHistory(components) {
    const truncated = { ...components };
    truncated.conversationHistory = components.conversationHistory.map((msg) => {
      const tokens = this.estimateTokens(msg.content);
      if (tokens > this.strategy.toolOutputMaxSize) {
        const maxChars = this.strategy.toolOutputMaxSize * 4;
        return {
          ...msg,
          content: msg.content.substring(0, maxChars) + "\n[truncated...]"
        };
      }
      return msg;
    });
    return truncated;
  }
  /**
   * Truncate tool output to fit within limit
   */
  truncateToolOutput(output, maxTokens) {
    const serialized = JSON.stringify(output);
    const tokens = this.estimateTokens(serialized);
    if (tokens <= maxTokens) {
      return output;
    }
    return {
      _truncated: true,
      _summary: this.createOutputSummary(output, maxTokens),
      _originalSize: `${tokens} tokens`
    };
  }
  /**
   * Create summary of large output
   */
  createOutputSummary(output, maxTokens) {
    if (output === null) return "null";
    if (output === void 0) return "undefined";
    if (Array.isArray(output)) {
      const firstItem = output[0];
      const keys = firstItem && typeof firstItem === "object" ? Object.keys(firstItem) : [];
      return `Array with ${output.length} items${keys.length > 0 ? `, first item keys: ${keys.join(", ")}` : ""}`;
    }
    if (typeof output === "object") {
      const keys = Object.keys(output);
      return `Object with ${keys.length} keys: ${keys.slice(0, 10).join(", ")}${keys.length > 10 ? ` ... and ${keys.length - 10} more` : ""}`;
    }
    if (typeof output === "string") {
      const maxChars = maxTokens * 4;
      return output.length > maxChars ? output.substring(0, maxChars) + "..." : output;
    }
    return String(output);
  }
  /**
   * Check if output should be auto-stored in memory
   */
  shouldAutoStore(output, threshold) {
    const serialized = JSON.stringify(output);
    const tokens = this.estimateTokens(serialized);
    return tokens > threshold;
  }
  /**
   * Get current context budget
   */
  getCurrentBudget() {
    return this.lastBudget ?? null;
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Get current compaction strategy
   */
  getStrategy() {
    return { ...this.strategy };
  }
  /**
   * Update configuration
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }
};

// src/capabilities/taskAgent/IdempotencyCache.ts
var DEFAULT_IDEMPOTENCY_CONFIG = {
  defaultTtlMs: 36e5,
  // 1 hour
  maxEntries: 1e3
};
var IdempotencyCache = class {
  config;
  cache = /* @__PURE__ */ new Map();
  hits = 0;
  misses = 0;
  cleanupInterval;
  constructor(config = DEFAULT_IDEMPOTENCY_CONFIG) {
    this.config = config;
    this.cleanupInterval = setInterval(() => {
      this.pruneExpired();
    }, 3e5);
  }
  /**
   * Get cached result for tool call
   */
  async get(tool, args) {
    if (!tool.idempotency || tool.idempotency.safe) {
      this.misses++;
      return void 0;
    }
    const key = this.generateKey(tool, args);
    const cached = this.cache.get(key);
    if (!cached) {
      this.misses++;
      return void 0;
    }
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return void 0;
    }
    this.hits++;
    return cached.value;
  }
  /**
   * Cache result for tool call
   */
  async set(tool, args, result) {
    if (!tool.idempotency || tool.idempotency.safe) {
      return;
    }
    const key = this.generateKey(tool, args);
    const ttl = tool.idempotency.ttlMs ?? this.config.defaultTtlMs;
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value: result, expiresAt });
    if (this.cache.size > this.config.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }
  /**
   * Check if tool call is cached
   */
  async has(tool, args) {
    if (!tool.idempotency || tool.idempotency.safe) {
      return false;
    }
    const key = this.generateKey(tool, args);
    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
  /**
   * Invalidate cached result
   */
  async invalidate(tool, args) {
    if (!tool.idempotency) {
      return;
    }
    const key = this.generateKey(tool, args);
    this.cache.delete(key);
  }
  /**
   * Invalidate all cached results for a tool
   */
  async invalidateTool(tool) {
    const toolName = tool.definition.function.name;
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${toolName}:`)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
  /**
   * Prune expired entries from cache
   */
  pruneExpired() {
    const now = Date.now();
    const toDelete = [];
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        toDelete.push(key);
      }
    }
    toDelete.forEach((key) => this.cache.delete(key));
    return toDelete.length;
  }
  /**
   * Clear all cached results
   */
  async clear() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = void 0;
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    return {
      entries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate
    };
  }
  /**
   * Generate cache key for tool + args
   */
  generateKey(tool, args) {
    const toolName = tool.definition.function.name;
    if (tool.idempotency?.keyFn) {
      return `${toolName}:${tool.idempotency.keyFn(args)}`;
    }
    const sortedArgs = Object.keys(args).sort().reduce((obj, key) => {
      obj[key] = args[key];
      return obj;
    }, {});
    const argsHash = this.hashObject(sortedArgs);
    return `${toolName}:${argsHash}`;
  }
  /**
   * Simple hash function for objects
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
};

// src/capabilities/taskAgent/HistoryManager.ts
var DEFAULT_HISTORY_CONFIG = {
  maxDetailedMessages: 20,
  compressionStrategy: "summarize",
  summarizeBatchSize: 10,
  preserveToolCalls: true
};
var HistoryManager = class {
  messages = [];
  summaries = [];
  config;
  constructor(config = DEFAULT_HISTORY_CONFIG) {
    this.config = config;
  }
  /**
   * Add a message to history
   */
  addMessage(role, content) {
    this.messages.push({
      role,
      content,
      timestamp: Date.now()
    });
    if (this.messages.length > this.config.maxDetailedMessages) {
      this.compact();
    }
  }
  /**
   * Get all messages (including summaries as system messages)
   */
  getMessages() {
    const result = [];
    for (const summary of this.summaries) {
      result.push({
        role: "system",
        content: `[Summary of previous conversation]
${summary.content}`,
        timestamp: summary.timestamp
      });
    }
    result.push(...this.messages);
    return result;
  }
  /**
   * Get recent messages only (no summaries)
   */
  getRecentMessages() {
    return [...this.messages];
  }
  /**
   * Compact history (summarize or truncate old messages)
   */
  compact() {
    if (this.config.compressionStrategy === "truncate") {
      const toRemove = this.messages.length - this.config.maxDetailedMessages;
      this.messages = this.messages.slice(toRemove);
    } else if (this.config.compressionStrategy === "drop") {
      const toKeep = this.config.maxDetailedMessages;
      this.messages = this.messages.slice(-toKeep);
    }
  }
  /**
   * Summarize history (requires LLM - placeholder)
   */
  async summarize() {
    this.compact();
  }
  /**
   * Truncate messages to a limit
   */
  async truncate(messages, limit) {
    return messages.slice(-limit);
  }
  /**
   * Clear all history
   */
  clear() {
    this.messages = [];
    this.summaries = [];
  }
  /**
   * Get total message count
   */
  getMessageCount() {
    return this.messages.length;
  }
  /**
   * Get history state for persistence
   */
  getState() {
    return {
      messages: [...this.messages],
      summaries: [...this.summaries]
    };
  }
  /**
   * Restore history from state
   */
  restoreState(state) {
    this.messages = [...state.messages];
    this.summaries = [...state.summaries];
  }
};
var ExternalDependencyHandler = class extends EventEmitter {
  activePolls = /* @__PURE__ */ new Map();
  activeScheduled = /* @__PURE__ */ new Map();
  tools;
  constructor(tools = []) {
    super();
    this.tools = new Map(tools.map((t) => [t.definition.function.name, t]));
  }
  /**
   * Start handling a task's external dependency
   */
  async startWaiting(task) {
    if (!task.externalDependency) {
      return;
    }
    const dep = task.externalDependency;
    switch (dep.type) {
      case "webhook":
        break;
      case "poll":
        this.startPolling(task);
        break;
      case "scheduled":
        this.scheduleTask(task);
        break;
    }
  }
  /**
   * Stop waiting on a task's external dependency
   */
  stopWaiting(task) {
    if (!task.externalDependency) {
      return;
    }
    const pollTimer = this.activePolls.get(task.id);
    if (pollTimer) {
      clearInterval(pollTimer);
      this.activePolls.delete(task.id);
    }
    const scheduleTimer = this.activeScheduled.get(task.id);
    if (scheduleTimer) {
      clearTimeout(scheduleTimer);
      this.activeScheduled.delete(task.id);
    }
  }
  /**
   * Trigger a webhook
   */
  async triggerWebhook(webhookId, data) {
    this.emit("webhook:received", { webhookId, data });
  }
  /**
   * Complete a manual task
   */
  async completeManual(taskId, data) {
    this.emit("manual:completed", { taskId, data });
  }
  /**
   * Start polling for a task
   */
  startPolling(task) {
    const dep = task.externalDependency;
    const pollConfig = dep.pollConfig;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const tool = this.tools.get(pollConfig.toolName);
        if (!tool) {
          console.error(`Poll tool ${pollConfig.toolName} not found`);
          return;
        }
        const result = await tool.execute(pollConfig.toolArgs);
        if (result) {
          this.emit("poll:success", { taskId: task.id, data: result });
          this.stopWaiting(task);
          return;
        }
        if (attempts >= pollConfig.maxAttempts) {
          this.emit("poll:timeout", { taskId: task.id });
          this.stopWaiting(task);
        }
      } catch (error) {
        console.error(`Poll error for task ${task.id}:`, error);
      }
    };
    const timer = setInterval(poll, pollConfig.intervalMs);
    this.activePolls.set(task.id, timer);
    poll();
  }
  /**
   * Schedule a task to trigger at a specific time
   */
  scheduleTask(task) {
    const dep = task.externalDependency;
    const scheduledAt = dep.scheduledAt;
    const delay = scheduledAt - Date.now();
    if (delay <= 0) {
      this.emit("scheduled:triggered", { taskId: task.id });
      return;
    }
    const timer = setTimeout(() => {
      this.emit("scheduled:triggered", { taskId: task.id });
      this.activeScheduled.delete(task.id);
    }, delay);
    this.activeScheduled.set(task.id, timer);
  }
  /**
   * Cleanup all active dependencies
   */
  cleanup() {
    for (const timer of this.activePolls.values()) {
      clearInterval(timer);
    }
    this.activePolls.clear();
    for (const timer of this.activeScheduled.values()) {
      clearTimeout(timer);
    }
    this.activeScheduled.clear();
  }
  /**
   * Update available tools
   */
  updateTools(tools) {
    this.tools = new Map(tools.map((t) => [t.definition.function.name, t]));
  }
};

// src/domain/entities/Model.ts
var LLM_MODELS = {
  [Vendor.OpenAI]: {
    GPT_5_2_INSTANT: "gpt-5.2-instant",
    GPT_5_2_THINKING: "gpt-5.2-thinking",
    GPT_5_2_PRO: "gpt-5.2-pro",
    GPT_5_2_CODEX: "gpt-5.2-codex",
    GPT_5_1: "gpt-5.1",
    GPT_5: "gpt-5",
    GPT_5_MINI: "gpt-5-mini",
    GPT_5_NANO: "gpt-5-nano",
    GPT_4_1: "gpt-4.1",
    GPT_4_1_MINI: "gpt-4.1-mini",
    O3_MINI: "o3-mini"
  },
  [Vendor.Anthropic]: {
    CLAUDE_OPUS_4_5: "claude-opus-4-5-20251101",
    CLAUDE_SONNET_4_5: "claude-sonnet-4-5-20250929",
    CLAUDE_HAIKU_4_5: "claude-haiku-4-5-20251001",
    CLAUDE_OPUS_4_1: "claude-opus-4-1-20250805",
    CLAUDE_SONNET_4: "claude-sonnet-4-20250514"
  },
  [Vendor.Google]: {
    GEMINI_3_FLASH_PREVIEW: "gemini-3-flash-preview",
    GEMINI_3_PRO: "gemini-3-pro",
    GEMINI_3_PRO_IMAGE: "gemini-3-pro-image",
    GEMINI_2_5_PRO: "gemini-2.5-pro",
    GEMINI_2_5_FLASH: "gemini-2.5-flash",
    GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
    GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image"
  }
};
var MODEL_REGISTRY = {
  // ============================================================================
  // OpenAI Models (11 total)
  // ============================================================================
  "gpt-5.2-instant": {
    name: "gpt-5.2-instant",
    provider: Vendor.OpenAI,
    description: "Fast variant of GPT-5.2 with minimal reasoning step",
    isActive: true,
    releaseDate: "2025-12-11",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025
        // 90% discount
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 14
      }
    }
  },
  "gpt-5.2-thinking": {
    name: "gpt-5.2-thinking",
    provider: Vendor.OpenAI,
    description: "GPT-5.2 with extended reasoning capabilities and xhigh reasoning effort",
    isActive: true,
    releaseDate: "2025-12-11",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 14
      }
    }
  },
  "gpt-5.2-pro": {
    name: "gpt-5.2-pro",
    provider: Vendor.OpenAI,
    description: "Flagship GPT-5.2 model with advanced reasoning and highest quality",
    isActive: true,
    releaseDate: "2025-12-11",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 21,
        cpmCached: 0.025
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 168
      }
    }
  },
  "gpt-5.2-codex": {
    name: "gpt-5.2-codex",
    provider: Vendor.OpenAI,
    description: "Most advanced agentic coding model for complex software engineering",
    isActive: true,
    releaseDate: "2026-01-14",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.75,
        cpmCached: 0.025
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 14
      }
    }
  },
  "gpt-5.1": {
    name: "gpt-5.1",
    provider: Vendor.OpenAI,
    description: "Balanced GPT-5.1 model with expanded context window",
    isActive: true,
    releaseDate: "2025-11-13",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 272e3,
        text: true,
        image: true,
        cpm: 1.25,
        cpmCached: 0.025
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 10
      }
    }
  },
  "gpt-5": {
    name: "gpt-5",
    provider: Vendor.OpenAI,
    description: "Standard GPT-5 model with large context window",
    isActive: true,
    releaseDate: "2025-08-07",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.25,
        cpmCached: 0.025
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 10
      }
    }
  },
  "gpt-5-mini": {
    name: "gpt-5-mini",
    provider: Vendor.OpenAI,
    description: "Fast, cost-efficient version of GPT-5",
    isActive: true,
    releaseDate: "2025-08-07",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 0.25,
        cpmCached: 0.025
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 2
      }
    }
  },
  "gpt-5-nano": {
    name: "gpt-5-nano",
    provider: Vendor.OpenAI,
    description: "Fastest, most cost-effective version of GPT-5",
    isActive: true,
    releaseDate: "2025-08-07",
    knowledgeCutoff: "2025-08-31",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128e3,
        text: true,
        cpm: 0.05,
        cpmCached: 0.025
      },
      output: {
        tokens: 4096,
        text: true,
        cpm: 0.4
      }
    }
  },
  "gpt-4.1": {
    name: "gpt-4.1",
    provider: Vendor.OpenAI,
    description: "GPT-4.1 specialized for coding with large context window",
    isActive: true,
    releaseDate: "2025-06-01",
    knowledgeCutoff: "2025-04-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 0.5,
        cpmCached: 0.025
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 2
      }
    }
  },
  "gpt-4.1-mini": {
    name: "gpt-4.1-mini",
    provider: Vendor.OpenAI,
    description: "Efficient GPT-4.1 model with excellent instruction following",
    isActive: true,
    releaseDate: "2025-06-01",
    knowledgeCutoff: "2025-04-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 0.4,
        cpmCached: 0.025
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 1.6
      }
    }
  },
  "o3-mini": {
    name: "o3-mini",
    provider: Vendor.OpenAI,
    description: "Fast reasoning model tailored for coding, math, and science",
    isActive: true,
    releaseDate: "2025-01-01",
    knowledgeCutoff: "2023-10-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: false,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: false,
      input: {
        tokens: 2e5,
        text: true,
        cpm: 0.4
      },
      output: {
        tokens: 1e5,
        text: true,
        cpm: 1.6
      }
    }
  },
  // ============================================================================
  // Anthropic Models (5 total)
  // ============================================================================
  "claude-opus-4-5-20251101": {
    name: "claude-opus-4-5-20251101",
    provider: Vendor.Anthropic,
    description: "Flagship Claude model with extended thinking and 80.9% SWE-bench score",
    isActive: true,
    releaseDate: "2025-11-24",
    knowledgeCutoff: "2025-03-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 5,
        cpmCached: 0.5
        // 10x reduction for cache read
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 25
      }
    }
  },
  "claude-sonnet-4-5-20250929": {
    name: "claude-sonnet-4-5-20250929",
    provider: Vendor.Anthropic,
    description: "Balanced Claude model with computer use and extended thinking",
    isActive: true,
    releaseDate: "2025-09-29",
    knowledgeCutoff: "2025-03-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 15
      }
    }
  },
  "claude-haiku-4-5-20251001": {
    name: "claude-haiku-4-5-20251001",
    provider: Vendor.Anthropic,
    description: "Fastest Claude model with extended thinking and lowest latency",
    isActive: true,
    releaseDate: "2025-10-01",
    knowledgeCutoff: "2025-03-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 1,
        cpmCached: 0.1
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 5
      }
    }
  },
  "claude-opus-4-1-20250805": {
    name: "claude-opus-4-1-20250805",
    provider: Vendor.Anthropic,
    description: "Legacy Claude Opus 4.1 (67% more expensive than 4.5)",
    isActive: true,
    releaseDate: "2025-08-05",
    knowledgeCutoff: "2025-03-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 15,
        cpmCached: 1.5
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 75
      }
    }
  },
  "claude-sonnet-4-20250514": {
    name: "claude-sonnet-4-20250514",
    provider: Vendor.Anthropic,
    description: "Legacy Claude Sonnet 4 with optional 1M token context",
    isActive: true,
    releaseDate: "2025-05-14",
    knowledgeCutoff: "2025-03-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      extendedThinking: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        // Up to 1M with premium pricing beyond 200K
        text: true,
        image: true,
        cpm: 3,
        cpmCached: 0.3
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 15
      }
    }
  },
  // ============================================================================
  // Google Models (7 total)
  // ============================================================================
  "gemini-3-flash-preview": {
    name: "gemini-3-flash-preview",
    provider: Vendor.Google,
    description: "Pro-grade reasoning with Flash-level latency and efficiency",
    isActive: true,
    releaseDate: "2025-11-18",
    knowledgeCutoff: "2025-08-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.5
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 3
      }
    }
  },
  "gemini-3-pro": {
    name: "gemini-3-pro",
    provider: Vendor.Google,
    description: "Most advanced reasoning Gemini model with 1M token context",
    isActive: true,
    releaseDate: "2025-11-18",
    knowledgeCutoff: "2025-08-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 2
        // $2 up to 200K, $4 beyond
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 12
        // $12 up to 200K, $18 beyond
      }
    }
  },
  "gemini-3-pro-image": {
    name: "gemini-3-pro-image",
    provider: Vendor.Google,
    description: "Highest quality image generation model (Nano Banana Pro)",
    isActive: true,
    releaseDate: "2025-11-18",
    knowledgeCutoff: "2025-08-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 2
      },
      output: {
        tokens: 64e3,
        text: true,
        image: true,
        cpm: 120
        // For image output
      }
    }
  },
  "gemini-2.5-pro": {
    name: "gemini-2.5-pro",
    provider: Vendor.Google,
    description: "Balanced multimodal model built for agents",
    isActive: true,
    releaseDate: "2025-03-01",
    knowledgeCutoff: "2025-01-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 1.25
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 10
      }
    }
  },
  "gemini-2.5-flash": {
    name: "gemini-2.5-flash",
    provider: Vendor.Google,
    description: "Cost-effective model with upgraded reasoning",
    isActive: true,
    releaseDate: "2025-06-17",
    knowledgeCutoff: "2025-01-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.1
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 0.4
      }
    }
  },
  "gemini-2.5-flash-lite": {
    name: "gemini-2.5-flash-lite",
    provider: Vendor.Google,
    description: "Lowest latency Gemini model with 1M context",
    isActive: true,
    releaseDate: "2025-06-17",
    knowledgeCutoff: "2025-01-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: true,
      video: true,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        audio: true,
        video: true,
        cpm: 0.1
      },
      output: {
        tokens: 64e3,
        text: true,
        cpm: 0.4
      }
    }
  },
  "gemini-2.5-flash-image": {
    name: "gemini-2.5-flash-image",
    provider: Vendor.Google,
    description: "State-of-the-art image generation and editing (1290 tokens per image)",
    isActive: true,
    releaseDate: "2026-01-01",
    knowledgeCutoff: "2025-01-01",
    features: {
      reasoning: true,
      streaming: true,
      structuredOutput: false,
      functionCalling: false,
      fineTuning: false,
      predictedOutputs: false,
      realtime: false,
      vision: true,
      audio: false,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 1e6,
        text: true,
        image: true,
        cpm: 0.1
      },
      output: {
        tokens: 64e3,
        text: true,
        image: true,
        cpm: 30
        // For image output
      }
    }
  }
};
function getModelInfo(modelName) {
  return MODEL_REGISTRY[modelName];
}
function getModelsByVendor(vendor) {
  return Object.values(MODEL_REGISTRY).filter((model) => model.provider === vendor);
}
function getActiveModels() {
  return Object.values(MODEL_REGISTRY).filter((model) => model.isActive);
}
function calculateCost(model, inputTokens, outputTokens, options) {
  const modelInfo = getModelInfo(model);
  if (!modelInfo) {
    return null;
  }
  const inputCPM = options?.useCachedInput && modelInfo.features.input.cpmCached !== void 0 ? modelInfo.features.input.cpmCached : modelInfo.features.input.cpm;
  const outputCPM = modelInfo.features.output.cpm;
  const inputCost = inputTokens / 1e6 * inputCPM;
  const outputCost = outputTokens / 1e6 * outputCPM;
  return inputCost + outputCost;
}

// src/capabilities/taskAgent/PlanExecutor.ts
var PlanExecutor = class extends EventEmitter {
  agent;
  memory;
  contextManager;
  idempotencyCache;
  // TODO: Integrate in tool execution (Task #4)
  historyManager;
  externalHandler;
  checkpointManager;
  hooks;
  config;
  abortController;
  // Current execution metrics
  currentMetrics = {
    totalLLMCalls: 0,
    totalToolCalls: 0,
    totalTokensUsed: 0,
    totalCost: 0
  };
  // Reference to current agent state (for checkpointing)
  currentState = null;
  constructor(agent, memory, contextManager, idempotencyCache, historyManager, externalHandler, checkpointManager, hooks, config) {
    super();
    this.agent = agent;
    this.memory = memory;
    this.contextManager = contextManager;
    this.idempotencyCache = idempotencyCache;
    this.historyManager = historyManager;
    this.externalHandler = externalHandler;
    this.checkpointManager = checkpointManager;
    this.hooks = hooks;
    this.config = config;
    this.abortController = new AbortController();
  }
  /**
   * Execute a plan
   */
  async execute(plan, state) {
    this.currentState = state;
    this.checkpointManager.setCurrentState(state);
    this.currentMetrics = {
      totalLLMCalls: 0,
      totalToolCalls: 0,
      totalTokensUsed: 0,
      totalCost: 0
    };
    let iteration = 0;
    while (iteration < this.config.maxIterations) {
      iteration++;
      if (this.isPlanComplete(plan)) {
        break;
      }
      if (this.isPlanSuspended(plan)) {
        return {
          status: "suspended",
          completedTasks: plan.tasks.filter((t) => t.status === "completed").length,
          failedTasks: plan.tasks.filter((t) => t.status === "failed").length,
          skippedTasks: plan.tasks.filter((t) => t.status === "skipped").length,
          metrics: this.currentMetrics
        };
      }
      const nextTasks = getNextExecutableTasks(plan);
      if (nextTasks.length === 0) {
        break;
      }
      await Promise.all(
        nextTasks.map((task) => this.executeTask(plan, task))
      );
    }
    const hasFailures = plan.tasks.some((t) => t.status === "failed");
    const allComplete = plan.tasks.every(
      (t) => ["completed", "skipped", "failed"].includes(t.status)
    );
    return {
      status: hasFailures ? "failed" : allComplete ? "completed" : "suspended",
      completedTasks: plan.tasks.filter((t) => t.status === "completed").length,
      failedTasks: plan.tasks.filter((t) => t.status === "failed").length,
      skippedTasks: plan.tasks.filter((t) => t.status === "skipped").length,
      metrics: this.currentMetrics
    };
  }
  /**
   * Execute a single task
   */
  async executeTask(plan, task) {
    if (task.condition) {
      const conditionMet = await evaluateCondition(task.condition, {
        get: (key) => this.memory.retrieve(key)
      });
      if (!conditionMet) {
        if (task.condition.onFalse === "skip") {
          task.status = "skipped";
          this.emit("task:skipped", { task, reason: "condition_not_met" });
          return;
        } else if (task.condition.onFalse === "fail") {
          task.status = "failed";
          task.result = { success: false, error: "Condition not met" };
          this.emit("task:failed", { task, error: new Error("Condition not met") });
          return;
        }
        return;
      }
    }
    if (this.hooks?.beforeTask) {
      const taskContext = {
        taskId: task.id,
        taskName: task.name,
        attempt: task.attempts + 1
      };
      const hookResult = await this.hooks.beforeTask(task, taskContext);
      if (hookResult === "skip") {
        task.status = "skipped";
        this.emit("task:skipped", { task, reason: "hook_skip" });
        return;
      }
    }
    const updatedTask = updateTaskStatus(task, "in_progress");
    Object.assign(task, updatedTask);
    this.emit("task:start", { task });
    try {
      const taskPrompt = this.buildTaskPrompt(plan, task);
      await this.contextManager.prepareContext(
        {
          systemPrompt: this.buildSystemPrompt(plan),
          instructions: "",
          memoryIndex: await this.memory.formatIndex(),
          conversationHistory: this.historyManager.getRecentMessages().map((m) => ({
            role: m.role,
            content: m.content
          })),
          currentInput: taskPrompt
        },
        this.memory,
        this.historyManager
      );
      this.historyManager.addMessage("user", taskPrompt);
      this.emit("llm:call", { iteration: task.attempts });
      let messages = [{ role: "user", content: taskPrompt }];
      if (this.hooks?.beforeLLMCall) {
        messages = await this.hooks.beforeLLMCall(messages, {
          model: this.agent.model,
          temperature: 0.7
          // Default temperature
        });
      }
      const response = await this.agent.run(taskPrompt);
      if (response.usage) {
        this.currentMetrics.totalLLMCalls++;
        this.currentMetrics.totalTokensUsed += response.usage.total_tokens || 0;
        if (this.agent.model && response.usage.input_tokens && response.usage.output_tokens) {
          const cost = calculateCost(this.agent.model, response.usage.input_tokens, response.usage.output_tokens);
          if (cost !== null) {
            this.currentMetrics.totalCost += cost;
          }
        }
      }
      if (this.hooks?.afterLLMCall) {
        await this.hooks.afterLLMCall(response);
      }
      if (this.currentState) {
        await this.checkpointManager.onLLMCall(this.currentState);
      }
      this.historyManager.addMessage("assistant", response.output_text || "");
      const completedTask = updateTaskStatus(task, "completed");
      completedTask.result = {
        success: true,
        output: response.output_text
      };
      Object.assign(task, completedTask);
      this.emit("task:complete", { task, result: response });
      if (this.hooks?.afterTask) {
        await this.hooks.afterTask(task, {
          success: true,
          output: response.output_text
        });
      }
      if (task.externalDependency) {
        task.status = "waiting_external";
        if (this.currentState) {
          await this.checkpointManager.checkpoint(this.currentState, "before_external_wait");
        }
        await this.externalHandler.startWaiting(task);
        this.emit("task:waiting_external", { task });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      let errorAction = "retry";
      if (this.hooks?.onError) {
        const errorContext = {
          task,
          error: err,
          phase: "execution"
        };
        errorAction = await this.hooks.onError(err, errorContext);
      }
      if (errorAction === "skip") {
        task.status = "skipped";
        this.emit("task:skipped", { task, reason: "error_hook_skip" });
        return;
      } else if (errorAction === "fail") {
        const failedTask = updateTaskStatus(task, "failed");
        failedTask.result = {
          success: false,
          error: err.message
        };
        Object.assign(task, failedTask);
        this.emit("task:failed", { task, error: err });
        return;
      }
      if (task.attempts < task.maxAttempts) {
        const retryTask = updateTaskStatus(task, "pending");
        Object.assign(task, retryTask);
      } else {
        const failedTask = updateTaskStatus(task, "failed");
        failedTask.result = {
          success: false,
          error: err.message
        };
        Object.assign(task, failedTask);
        this.emit("task:failed", { task, error: err });
      }
    }
  }
  /**
   * Build system prompt for task execution
   */
  buildSystemPrompt(plan) {
    return `You are an autonomous agent executing a plan.

**Goal:** ${plan.goal}
${plan.context ? `**Context:** ${plan.context}
` : ""}
**Your Role:** Execute tasks step by step using the available tools. Use working memory to store and retrieve information between tasks.

**Important Instructions:**
1. When you complete a task successfully, acknowledge it clearly
2. Use memory_store to save important data for future tasks
3. Use memory_retrieve to access previously stored data
4. If a task requires information from a previous task, retrieve it from memory
5. Be systematic and thorough in completing each task`;
  }
  /**
   * Build prompt for a specific task
   */
  buildTaskPrompt(plan, task) {
    const prompt = [];
    prompt.push(`## Current Task: ${task.name}`);
    prompt.push("");
    prompt.push(`**Description:** ${task.description}`);
    if (task.expectedOutput) {
      prompt.push(`**Expected Output:** ${task.expectedOutput}`);
    }
    if (task.dependsOn.length > 0) {
      const deps = plan.tasks.filter((t) => task.dependsOn.includes(t.id)).map((t) => t.name);
      prompt.push(`**Dependencies Completed:** ${deps.join(", ")}`);
    }
    prompt.push("");
    prompt.push("Please complete this task using the available tools.");
    return prompt.join("\n");
  }
  /**
   * Check if plan is complete
   */
  isPlanComplete(plan) {
    return plan.tasks.every((t) => ["completed", "skipped", "failed"].includes(t.status));
  }
  /**
   * Check if plan is suspended (waiting on external)
   */
  isPlanSuspended(plan) {
    return plan.tasks.some((t) => t.status === "waiting_external");
  }
  /**
   * Cancel execution
   */
  cancel() {
    this.abortController.abort();
  }
  /**
   * Cleanup resources
   */
  cleanup() {
    this.abortController.abort();
  }
  /**
   * Get idempotency cache
   */
  getIdempotencyCache() {
    return this.idempotencyCache;
  }
};

// src/capabilities/taskAgent/CheckpointManager.ts
var DEFAULT_CHECKPOINT_STRATEGY = {
  afterToolCalls: 1,
  afterLLMCalls: 1,
  intervalMs: 3e4,
  // 30 seconds
  beforeExternalWait: true,
  mode: "async"
};
var CheckpointManager = class {
  storage;
  strategy;
  toolCallsSinceCheckpoint = 0;
  llmCallsSinceCheckpoint = 0;
  intervalTimer;
  pendingCheckpoints = /* @__PURE__ */ new Set();
  currentState = null;
  constructor(storage, strategy = DEFAULT_CHECKPOINT_STRATEGY) {
    this.storage = storage;
    this.strategy = strategy;
    if (this.strategy.intervalMs) {
      this.intervalTimer = setInterval(() => {
        this.checkIntervalCheckpoint();
      }, this.strategy.intervalMs);
    }
  }
  /**
   * Set the current agent state (for interval checkpointing)
   */
  setCurrentState(state) {
    this.currentState = state;
  }
  /**
   * Record a tool call (may trigger checkpoint)
   */
  async onToolCall(state) {
    this.toolCallsSinceCheckpoint++;
    if (this.strategy.afterToolCalls && this.toolCallsSinceCheckpoint >= this.strategy.afterToolCalls) {
      await this.checkpoint(state, "tool_calls");
    }
  }
  /**
   * Record an LLM call (may trigger checkpoint)
   */
  async onLLMCall(state) {
    this.llmCallsSinceCheckpoint++;
    if (this.strategy.afterLLMCalls && this.llmCallsSinceCheckpoint >= this.strategy.afterLLMCalls) {
      await this.checkpoint(state, "llm_calls");
    }
  }
  /**
   * Force a checkpoint
   */
  async checkpoint(state, reason) {
    const checkpointPromise = this.doCheckpoint(state, reason);
    if (this.strategy.mode === "sync") {
      await checkpointPromise;
    } else {
      this.pendingCheckpoints.add(checkpointPromise);
      checkpointPromise.finally(() => {
        this.pendingCheckpoints.delete(checkpointPromise);
      });
    }
  }
  /**
   * Perform the actual checkpoint
   */
  async doCheckpoint(state, _reason) {
    try {
      await this.storage.agent.save(state);
      await this.storage.plan.savePlan(state.plan);
      this.toolCallsSinceCheckpoint = 0;
      this.llmCallsSinceCheckpoint = 0;
    } catch (error) {
      console.error(`Checkpoint failed (${_reason}):`, error);
    }
  }
  /**
   * Check if interval-based checkpoint is needed
   */
  checkIntervalCheckpoint() {
    if (this.currentState) {
      this.checkpoint(this.currentState, "interval");
    }
  }
  /**
   * Wait for all pending checkpoints to complete
   */
  async flush() {
    await Promise.all(Array.from(this.pendingCheckpoints));
  }
  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
    await this.flush();
  }
};

// src/capabilities/taskAgent/memoryTools.ts
var memoryStoreDefinition = {
  type: "function",
  function: {
    name: "memory_store",
    description: "Store data in working memory for later use. Use this to save important information from tool outputs.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: 'Namespaced key (e.g., "user.profile", "order.items")'
        },
        description: {
          type: "string",
          description: "Brief description of what this data contains (max 150 chars)"
        },
        value: {
          description: "The data to store (can be any JSON value)"
        }
      },
      required: ["key", "description", "value"]
    }
  }
};
var memoryRetrieveDefinition = {
  type: "function",
  function: {
    name: "memory_retrieve",
    description: "Retrieve full data from working memory by key. Use when you need the complete data, not just the description.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key to retrieve"
        }
      },
      required: ["key"]
    }
  }
};
var memoryDeleteDefinition = {
  type: "function",
  function: {
    name: "memory_delete",
    description: "Delete data from working memory to free up space.",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key to delete"
        }
      },
      required: ["key"]
    }
  }
};
var memoryListDefinition = {
  type: "function",
  function: {
    name: "memory_list",
    description: "List all keys and their descriptions in working memory.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};
function createMemoryTools() {
  return [
    // memory_store
    {
      definition: memoryStoreDefinition,
      execute: async (args, context) => {
        if (!context || !context.memory) {
          return { error: "Memory tools require TaskAgent context" };
        }
        try {
          await context.memory.set(
            args.key,
            args.description,
            args.value
          );
          return { success: true, key: args.key };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
      idempotency: { safe: true },
      output: { expectedSize: "small" }
    },
    // memory_retrieve
    {
      definition: memoryRetrieveDefinition,
      execute: async (args, context) => {
        if (!context || !context.memory) {
          return { error: "Memory tools require TaskAgent context" };
        }
        const value = await context.memory.get(args.key);
        if (value === void 0) {
          return { error: `Key "${args.key}" not found in memory` };
        }
        return value;
      },
      idempotency: { safe: true },
      output: { expectedSize: "variable" }
    },
    // memory_delete
    {
      definition: memoryDeleteDefinition,
      execute: async (args, context) => {
        if (!context || !context.memory) {
          return { error: "Memory tools require TaskAgent context" };
        }
        await context.memory.delete(args.key);
        return { success: true, deleted: args.key };
      },
      idempotency: { safe: true },
      output: { expectedSize: "small" }
    },
    // memory_list
    {
      definition: memoryListDefinition,
      execute: async (_args, context) => {
        if (!context || !context.memory) {
          return { error: "Memory tools require TaskAgent context" };
        }
        return await context.memory.list();
      },
      idempotency: { safe: true },
      output: { expectedSize: "small" }
    }
  ];
}

// src/capabilities/taskAgent/contextTools.ts
function createContextTools() {
  return [
    createContextInspectTool(),
    createContextBreakdownTool(),
    createCacheStatsTool(),
    createMemoryStatsTool()
  ];
}
function createContextInspectTool() {
  return {
    definition: {
      type: "function",
      function: {
        name: "context_inspect",
        description: "Get detailed breakdown of current context budget and utilization. Shows total tokens, used tokens, available tokens, utilization percentage, and status (ok/warning/critical).",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    execute: async (_args, context) => {
      if (!context?.contextManager) {
        return {
          error: "Context manager not available",
          message: "This tool is only available within TaskAgent execution"
        };
      }
      const budget = context.contextManager.getCurrentBudget();
      if (!budget) {
        return {
          error: "No context budget available",
          message: "Context has not been prepared yet"
        };
      }
      return {
        total_tokens: budget.total,
        reserved_tokens: budget.reserved,
        used_tokens: budget.used,
        available_tokens: budget.available,
        utilization_percent: Math.round(budget.utilizationPercent * 10) / 10,
        status: budget.status,
        warning: budget.status === "warning" ? "Context approaching limit - automatic compaction may trigger" : budget.status === "critical" ? "Context at critical level - compaction will trigger" : null
      };
    },
    idempotency: {
      safe: true
      // Read-only operation
    }
  };
}
function createContextBreakdownTool() {
  return {
    definition: {
      type: "function",
      function: {
        name: "context_breakdown",
        description: "Get detailed token breakdown by component (system prompt, instructions, memory index, conversation history, current input). Useful for understanding what is consuming context space.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    execute: async (_args, context) => {
      if (!context?.contextManager) {
        return {
          error: "Context manager not available",
          message: "This tool is only available within TaskAgent execution"
        };
      }
      const budget = context.contextManager.getCurrentBudget();
      if (!budget) {
        return {
          error: "No context budget available",
          message: "Context has not been prepared yet"
        };
      }
      return {
        total_used: budget.used,
        breakdown: budget.breakdown,
        components: [
          {
            name: "system_prompt",
            tokens: budget.breakdown.systemPrompt,
            percent: Math.round(budget.breakdown.systemPrompt / budget.used * 1e3) / 10
          },
          {
            name: "instructions",
            tokens: budget.breakdown.instructions,
            percent: Math.round(budget.breakdown.instructions / budget.used * 1e3) / 10
          },
          {
            name: "memory_index",
            tokens: budget.breakdown.memoryIndex,
            percent: Math.round(budget.breakdown.memoryIndex / budget.used * 1e3) / 10
          },
          {
            name: "conversation_history",
            tokens: budget.breakdown.conversationHistory,
            percent: Math.round(budget.breakdown.conversationHistory / budget.used * 1e3) / 10
          },
          {
            name: "current_input",
            tokens: budget.breakdown.currentInput,
            percent: Math.round(budget.breakdown.currentInput / budget.used * 1e3) / 10
          }
        ]
      };
    },
    idempotency: {
      safe: true
      // Read-only operation
    }
  };
}
function createCacheStatsTool() {
  return {
    definition: {
      type: "function",
      function: {
        name: "cache_stats",
        description: "Get statistics about the tool call idempotency cache. Shows number of cached entries, cache hits, cache misses, and hit rate. Useful for understanding cache effectiveness.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    execute: async (_args, context) => {
      if (!context?.idempotencyCache) {
        return {
          error: "Idempotency cache not available",
          message: "This tool is only available within TaskAgent execution"
        };
      }
      const stats = context.idempotencyCache.getStats();
      return {
        entries: stats.entries,
        hits: stats.hits,
        misses: stats.misses,
        hit_rate: Math.round(stats.hitRate * 1e3) / 10,
        hit_rate_percent: `${Math.round(stats.hitRate * 100)}%`,
        effectiveness: stats.hitRate > 0.5 ? "high" : stats.hitRate > 0.2 ? "medium" : stats.hitRate > 0 ? "low" : "none"
      };
    },
    idempotency: {
      safe: true
      // Read-only operation
    }
  };
}
function createMemoryStatsTool() {
  return {
    definition: {
      type: "function",
      function: {
        name: "memory_stats",
        description: "Get detailed working memory utilization statistics. Shows total size, utilization percentage, number of entries, and breakdown by scope (persistent vs task-scoped).",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    execute: async (_args, context) => {
      if (!context?.memory) {
        return {
          error: "Working memory not available",
          message: "This tool is only available within TaskAgent execution"
        };
      }
      const index = await context.memory.list();
      return {
        entry_count: index.length,
        entries_by_scope: {
          total: index.length
          // Note: scope information not available through WorkingMemoryAccess interface
          // Would need to extend the interface or use a different approach
        },
        entries: index.map((entry) => ({
          key: entry.key,
          description: entry.description
        }))
      };
    },
    idempotency: {
      safe: true
      // Read-only operation
    }
  };
}

// src/capabilities/taskAgent/TaskAgent.ts
var TaskAgent = class _TaskAgent extends EventEmitter {
  id;
  state;
  storage;
  memory;
  hooks;
  executionPromise;
  // Internal components
  agent;
  contextManager;
  idempotencyCache;
  historyManager;
  externalHandler;
  planExecutor;
  checkpointManager;
  _tools = [];
  _toolManager;
  config;
  // Session management (NEW)
  _sessionManager = null;
  _session = null;
  // Event listener cleanup tracking
  eventCleanupFunctions = [];
  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   */
  get tools() {
    return this._toolManager;
  }
  constructor(id, state, storage, memory, config, hooks) {
    super();
    this.id = id;
    this.state = state;
    this.storage = storage;
    this.memory = memory;
    this.config = config;
    this.hooks = hooks;
    this._toolManager = config.toolManager ?? new ToolManager();
    const storedHandler = (data) => this.emit("memory:stored", data);
    const limitWarningHandler = (data) => this.emit("memory:limit_warning", { utilization: data.utilizationPercent });
    memory.on("stored", storedHandler);
    memory.on("limit_warning", limitWarningHandler);
    this.eventCleanupFunctions.push(() => memory.off("stored", storedHandler));
    this.eventCleanupFunctions.push(() => memory.off("limit_warning", limitWarningHandler));
    if (config.session) {
      this._sessionManager = new SessionManager({ storage: config.session.storage });
      if (config.session.id) ; else {
        this._session = this._sessionManager.create("task-agent", {
          title: `TaskAgent ${id}`
        });
      }
    }
  }
  /**
   * Create a new TaskAgent
   */
  static create(config) {
    const connector = typeof config.connector === "string" ? Connector.get(config.connector) : config.connector;
    if (!connector) {
      throw new Error(`Connector "${config.connector}" not found`);
    }
    const storage = config.storage ?? createAgentStorage({});
    const memoryConfig = config.memoryConfig ?? DEFAULT_MEMORY_CONFIG;
    const memory = new WorkingMemory(storage.memory, memoryConfig);
    const id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const emptyPlan = createPlan({ goal: "", tasks: [] });
    const agentConfig = {
      connectorName: typeof config.connector === "string" ? config.connector : connector.name,
      model: config.model,
      temperature: config.temperature,
      maxIterations: config.maxIterations,
      toolNames: (config.tools ?? []).map((t) => t.definition.function.name)
    };
    const state = createAgentState(id, agentConfig, emptyPlan);
    const taskAgent = new _TaskAgent(id, state, storage, memory, config, config.hooks);
    taskAgent.initializeComponents(config);
    return taskAgent;
  }
  /**
   * Wrap a tool with idempotency cache and enhanced context
   */
  wrapToolWithCache(tool) {
    return {
      ...tool,
      execute: async (args, context) => {
        const enhancedContext = {
          ...context,
          contextManager: this.contextManager,
          idempotencyCache: this.idempotencyCache
        };
        if (!this.idempotencyCache) {
          return tool.execute(args, enhancedContext);
        }
        const cached = await this.idempotencyCache.get(tool, args);
        if (cached !== void 0) {
          return cached;
        }
        const result = await tool.execute(args, enhancedContext);
        await this.idempotencyCache.set(tool, args, result);
        return result;
      }
    };
  }
  /**
   * Initialize internal components
   */
  initializeComponents(config) {
    const memoryTools = createMemoryTools();
    const contextTools = createContextTools();
    this._tools = [...config.tools ?? [], ...memoryTools, ...contextTools];
    for (const tool of this._tools) {
      this._toolManager.register(tool);
    }
    this.idempotencyCache = new IdempotencyCache(DEFAULT_IDEMPOTENCY_CONFIG);
    const enabledTools = this._toolManager.getEnabled();
    const cachedTools = enabledTools.map((tool) => this.wrapToolWithCache(tool));
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: cachedTools,
      instructions: config.instructions,
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 10
    });
    const modelInfo = getModelInfo(config.model);
    const contextTokens = modelInfo?.features.input.tokens ?? 128e3;
    this.contextManager = new ContextManager(
      {
        ...DEFAULT_CONTEXT_CONFIG,
        maxContextTokens: contextTokens
      },
      DEFAULT_COMPACTION_STRATEGY
    );
    this.historyManager = new HistoryManager(DEFAULT_HISTORY_CONFIG);
    this.externalHandler = new ExternalDependencyHandler(this._tools);
    this.checkpointManager = new CheckpointManager(this.storage, DEFAULT_CHECKPOINT_STRATEGY);
    this.planExecutor = new PlanExecutor(
      this.agent,
      this.memory,
      this.contextManager,
      this.idempotencyCache,
      this.historyManager,
      this.externalHandler,
      this.checkpointManager,
      this.hooks,
      {
        maxIterations: config.maxIterations ?? 100
      }
    );
    const taskStartHandler = (data) => this.emit("task:start", data);
    const taskCompleteHandler = (data) => {
      this.emit("task:complete", { task: data.task, result: { success: true, output: data.result } });
      if (this.hooks?.afterTask) {
        this.hooks.afterTask(data.task, { success: true, output: data.result });
      }
    };
    const taskFailedHandler = (data) => this.emit("task:failed", data);
    const taskSkippedHandler = (data) => this.emit("task:failed", { task: data.task, error: new Error(data.reason) });
    const taskWaitingExternalHandler = (data) => this.emit("task:waiting", { task: data.task, dependency: data.task.externalDependency });
    this.planExecutor.on("task:start", taskStartHandler);
    this.planExecutor.on("task:complete", taskCompleteHandler);
    this.planExecutor.on("task:failed", taskFailedHandler);
    this.planExecutor.on("task:skipped", taskSkippedHandler);
    this.planExecutor.on("task:waiting_external", taskWaitingExternalHandler);
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:start", taskStartHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:complete", taskCompleteHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:failed", taskFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:skipped", taskSkippedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:waiting_external", taskWaitingExternalHandler));
  }
  /**
   * Resume an existing agent from storage
   */
  static async resume(agentId, options) {
    const state = await options.storage.agent.load(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not found in storage`);
    }
    const config = {
      connector: state.config.connectorName,
      model: state.config.model,
      tools: options.tools ?? [],
      temperature: state.config.temperature,
      maxIterations: state.config.maxIterations,
      storage: options.storage,
      hooks: options.hooks
    };
    const memory = new WorkingMemory(options.storage.memory, DEFAULT_MEMORY_CONFIG);
    const taskAgent = new _TaskAgent(agentId, state, options.storage, memory, config, options.hooks);
    taskAgent.initializeComponents(config);
    return taskAgent;
  }
  /**
   * Start executing a plan
   */
  async start(planInput) {
    const plan = createPlan(planInput);
    this.state.plan = plan;
    this.state = updateAgentStatus(this.state, "running");
    if (this.hooks?.onStart) {
      await this.hooks.onStart(this, plan);
    }
    this.executionPromise = this.executePlan().then(async (result) => {
      if (this.hooks?.onComplete) {
        await this.hooks.onComplete(result);
      }
      return result;
    }).catch(async (error) => {
      if (this.hooks?.onError) {
        await this.hooks.onError(error, { error, phase: "execution" });
      }
      throw error;
    });
    await this.executionPromise.catch(() => {
    });
    return {
      agentId: this.id,
      planId: plan.id,
      wait: async () => {
        if (!this.executionPromise) {
          throw new Error("No execution in progress");
        }
        return this.executionPromise;
      },
      status: () => this.state.status
    };
  }
  /**
   * Pause execution
   */
  async pause() {
    this.state = updateAgentStatus(this.state, "suspended");
    this.state.plan.status = "suspended";
    this.emit("agent:suspended", { reason: "manual_pause" });
  }
  /**
   * Resume execution after pause
   */
  async resume() {
    this.state = updateAgentStatus(this.state, "running");
    this.state.plan.status = "running";
    this.emit("agent:resumed", {});
    await this.executePlan();
  }
  /**
   * Cancel execution
   */
  async cancel() {
    this.state = updateAgentStatus(this.state, "cancelled");
    this.state.plan.status = "cancelled";
  }
  /**
   * Trigger external dependency completion
   */
  async triggerExternal(webhookId, data) {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error("No plan running");
    }
    const task = plan.tasks.find((t) => t.externalDependency?.webhookId === webhookId);
    if (!task || !task.externalDependency) {
      throw new Error(`Task waiting on webhook ${webhookId} not found`);
    }
    task.externalDependency.state = "received";
    task.externalDependency.receivedData = data;
    task.externalDependency.receivedAt = Date.now();
    await this.resume();
  }
  /**
   * Manually complete a task
   */
  async completeTaskManually(taskId, result) {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error("No plan running");
    }
    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task || !task.externalDependency) {
      throw new Error(`Task ${taskId} not found or not waiting on manual input`);
    }
    task.externalDependency.state = "received";
    task.externalDependency.receivedData = result;
    task.externalDependency.receivedAt = Date.now();
  }
  /**
   * Update the plan
   */
  async updatePlan(updates) {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error("No plan running");
    }
    if (!plan.allowDynamicTasks && (updates.addTasks || updates.removeTasks)) {
      throw new Error("Dynamic tasks are disabled for this plan");
    }
    if (updates.addTasks) {
      for (const taskInput of updates.addTasks) {
        const task = createTask(taskInput);
        plan.tasks.push(task);
      }
    }
    if (updates.updateTasks) {
      for (const update of updates.updateTasks) {
        const task = plan.tasks.find((t) => t.id === update.id);
        if (task) {
          Object.assign(task, update);
        }
      }
    }
    if (updates.removeTasks) {
      plan.tasks = plan.tasks.filter((t) => !updates.removeTasks.includes(t.id));
    }
    plan.lastUpdatedAt = Date.now();
    this.emit("plan:updated", { plan });
  }
  /**
   * Get current agent state
   */
  getState() {
    return this.state;
  }
  /**
   * Get current plan
   */
  getPlan() {
    if (!this.state.plan || !this.state.plan.goal) {
      throw new Error("No plan started");
    }
    return this.state.plan;
  }
  /**
   * Get working memory
   */
  getMemory() {
    return this.memory;
  }
  // ============ Session Management (NEW) ============
  /**
   * Get the current session ID (if session is enabled)
   */
  getSessionId() {
    return this._session?.id ?? null;
  }
  /**
   * Check if this agent has session support enabled
   */
  hasSession() {
    return this._session !== null;
  }
  /**
   * Save the current session to storage
   * @throws Error if session is not enabled
   */
  async saveSession() {
    if (!this._sessionManager || !this._session) {
      throw new Error("Session not enabled. Configure session in TaskAgentConfig to use this feature.");
    }
    this._session.toolState = this._toolManager.getState();
    if (this.state.plan) {
      this._session.plan = {
        version: 1,
        data: this.state.plan
      };
    }
    const memoryEntries = await this.memory.getIndex();
    this._session.memory = {
      version: 1,
      entries: memoryEntries.entries.map((e) => ({
        key: e.key,
        description: e.description,
        value: null,
        // Don't serialize full values, they're in storage
        scope: e.scope,
        sizeBytes: 0
        // Size is stored as human-readable in index
      }))
    };
    await this._sessionManager.save(this._session);
  }
  /**
   * Get the current session (for advanced use)
   */
  getSession() {
    return this._session;
  }
  /**
   * Update session custom data
   */
  updateSessionData(key, value) {
    if (!this._session) {
      throw new Error("Session not enabled");
    }
    this._session.custom[key] = value;
  }
  /**
   * Get session custom data
   */
  getSessionData(key) {
    return this._session?.custom[key];
  }
  /**
   * Execute the plan (internal)
   */
  async executePlan() {
    const plan = this.state.plan;
    if (!this.planExecutor) {
      throw new Error("Plan executor not initialized");
    }
    try {
      const execResult = await this.planExecutor.execute(plan, this.state);
      if (execResult.metrics) {
        this.state.metrics.totalLLMCalls += execResult.metrics.totalLLMCalls;
        this.state.metrics.totalToolCalls += execResult.metrics.totalToolCalls;
        this.state.metrics.totalTokensUsed += execResult.metrics.totalTokensUsed;
        this.state.metrics.totalCost += execResult.metrics.totalCost;
      }
      if (execResult.status === "completed") {
        this.state = updateAgentStatus(this.state, "completed");
        plan.status = "completed";
      } else if (execResult.status === "failed") {
        this.state = updateAgentStatus(this.state, "failed");
        plan.status = "failed";
      } else if (execResult.status === "suspended") {
        this.state = updateAgentStatus(this.state, "suspended");
        plan.status = "suspended";
      }
      await this.checkpointManager?.checkpoint(this.state, "execution_complete");
      const result = {
        status: execResult.status === "suspended" ? "completed" : execResult.status,
        metrics: {
          totalTasks: plan.tasks.length,
          completedTasks: execResult.completedTasks,
          failedTasks: execResult.failedTasks,
          skippedTasks: execResult.skippedTasks
        }
      };
      this.emit("agent:completed", { result });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.state = updateAgentStatus(this.state, "failed");
      plan.status = "failed";
      try {
        await this.checkpointManager?.checkpoint(this.state, "execution_failed");
      } catch {
      }
      const result = {
        status: "failed",
        error: err.message,
        metrics: {
          totalTasks: plan.tasks.length,
          completedTasks: plan.tasks.filter((t) => t.status === "completed").length,
          failedTasks: plan.tasks.filter((t) => t.status === "failed").length,
          skippedTasks: plan.tasks.filter((t) => t.status === "skipped").length
        }
      };
      this.emit("agent:completed", { result });
      throw err;
    }
  }
  /**
   * Cleanup resources
   */
  async destroy() {
    this.eventCleanupFunctions.forEach((cleanup) => cleanup());
    this.eventCleanupFunctions = [];
    if (this._sessionManager) {
      if (this._session) {
        this._sessionManager.stopAutoSave(this._session.id);
      }
      this._sessionManager.destroy();
    }
    this._toolManager.removeAllListeners();
    this.externalHandler?.cleanup();
    await this.checkpointManager?.cleanup();
    this.planExecutor?.cleanup();
    this.agent?.destroy();
  }
};

// src/capabilities/taskAgent/PlanningAgent.ts
var PLANNING_SYSTEM_PROMPT = `You are an AI planning agent. Your job is to analyze goals and break them down into structured, executable task plans.

**Your Role:**
1. Analyze the user's goal and context
2. Break down the goal into logical, atomic tasks
3. Identify dependencies between tasks
4. Structure tasks for optimal execution (parallel where possible)
5. Use the planning tools to create the plan

**Planning Principles:**
- Each task should have a single, clear responsibility
- Tasks should be atomic (can't be broken down further meaningfully)
- Dependencies should be explicit (use dependsOn)
- Parallel tasks should be marked as such (execution.parallel)
- Task names should be descriptive snake_case (e.g., "fetch_user_data")
- Descriptions should be clear and actionable

**Available Planning Tools:**
- create_task: Add a task to the plan
- add_dependency: Link tasks with dependencies
- mark_parallel: Mark tasks that can run in parallel
- finalize_plan: Complete the planning phase

Always start by analyzing the goal, then create tasks one by one, building dependencies as you go.`;
var PlanningAgent = class _PlanningAgent {
  agent;
  config;
  currentTasks = [];
  planningComplete = false;
  constructor(agent, config) {
    this.agent = agent;
    this.config = config;
  }
  /**
   * Create a new PlanningAgent
   */
  static create(config) {
    const planningTools = createPlanningTools();
    const agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: planningTools,
      instructions: PLANNING_SYSTEM_PROMPT,
      temperature: config.planningTemperature ?? 0.3,
      // Lower temp for more structured output
      maxIterations: config.maxPlanningIterations ?? 20
    });
    return new _PlanningAgent(agent, config);
  }
  /**
   * Generate a plan from a goal
   */
  async generatePlan(input) {
    this.currentTasks = [];
    this.planningComplete = false;
    const prompt = this.buildPlanningPrompt(input);
    const response = await this.agent.run(prompt);
    if (!this.planningComplete && this.currentTasks.length > 0) {
      this.planningComplete = true;
    }
    const plan = createPlan({
      goal: input.goal,
      context: input.context,
      tasks: this.currentTasks,
      allowDynamicTasks: false
      // Plans are static by default
    });
    return {
      plan,
      reasoning: response.output_text || "Plan generated",
      complexity: this.estimateComplexity(this.currentTasks)
    };
  }
  /**
   * Validate and refine an existing plan
   */
  async refinePlan(plan, feedback) {
    this.currentTasks = plan.tasks.map((task) => ({
      name: task.name,
      description: task.description,
      dependsOn: task.dependsOn,
      expectedOutput: task.expectedOutput,
      condition: task.condition,
      execution: task.execution,
      externalDependency: task.externalDependency,
      maxAttempts: task.maxAttempts
    }));
    this.planningComplete = false;
    const prompt = `I have an existing plan that needs refinement based on feedback.

**Current Plan Goal:** ${plan.goal}
**Current Plan Context:** ${plan.context || "None"}

**Current Tasks:**
${this.currentTasks.map((t, i) => `${i + 1}. ${t.name}: ${t.description}${t.dependsOn?.length ? ` (depends on: ${t.dependsOn.join(", ")})` : ""}`).join("\n")}

**Feedback:** ${feedback}

Please refine the plan based on this feedback. You can:
- Add new tasks
- Modify existing task descriptions
- Change dependencies
- Remove unnecessary tasks
- Adjust parallel execution

Use the planning tools to make changes, then finalize when complete.`;
    const response = await this.agent.run(prompt);
    const refinedPlan = createPlan({
      goal: plan.goal,
      context: plan.context,
      tasks: this.currentTasks,
      allowDynamicTasks: false
    });
    return {
      plan: refinedPlan,
      reasoning: response.output_text || "Plan refined",
      complexity: this.estimateComplexity(this.currentTasks)
    };
  }
  /**
   * Build planning prompt from input
   */
  buildPlanningPrompt(input) {
    const parts = [];
    parts.push("Please create an execution plan for the following goal:\n");
    parts.push(`**Goal:** ${input.goal}
`);
    if (input.context) {
      parts.push(`**Context:** ${input.context}
`);
    }
    if (input.constraints && input.constraints.length > 0) {
      parts.push("\n**Constraints:**");
      input.constraints.forEach((c) => parts.push(`- ${c}`));
      parts.push("");
    }
    if (this.config.availableTools && this.config.availableTools.length > 0) {
      parts.push("\n**Available Tools for Execution:**");
      this.config.availableTools.forEach((tool) => {
        parts.push(`- ${tool.definition.function.name}: ${tool.definition.function.description}`);
      });
      parts.push("");
    }
    parts.push("\nAnalyze this goal and create a structured plan with clear tasks and dependencies.");
    parts.push("Use the planning tools to build the plan step by step.");
    return parts.join("\n");
  }
  /**
   * Estimate plan complexity
   */
  estimateComplexity(tasks) {
    const taskCount = tasks.length;
    const hasDependencies = tasks.some((t) => t.dependsOn && t.dependsOn.length > 0);
    const hasConditionals = tasks.some((t) => t.condition);
    const hasExternalDeps = tasks.some((t) => t.externalDependency);
    if (taskCount <= 3 && !hasDependencies && !hasConditionals && !hasExternalDeps) {
      return "low";
    }
    if (taskCount <= 10 && !hasConditionals && !hasExternalDeps) {
      return "medium";
    }
    return "high";
  }
  /**
   * Get current tasks (for tool access)
   */
  getCurrentTasks() {
    return [...this.currentTasks];
  }
  /**
   * Add task (called by planning tools)
   */
  addTask(task) {
    this.currentTasks.push(task);
  }
  /**
   * Update task (called by planning tools)
   */
  updateTask(name, updates) {
    const task = this.currentTasks.find((t) => t.name === name);
    if (task) {
      Object.assign(task, updates);
    }
  }
  /**
   * Remove task (called by planning tools)
   */
  removeTask(name) {
    const index = this.currentTasks.findIndex((t) => t.name === name);
    if (index >= 0) {
      this.currentTasks.splice(index, 1);
    }
  }
  /**
   * Mark planning as complete
   */
  finalizePlanning() {
    this.planningComplete = true;
  }
};
function createPlanningTools() {
  return [
    {
      definition: {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a new task in the plan with name, description, and optional dependencies",
          parameters: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: 'Task name in snake_case (e.g., "fetch_user_data")'
              },
              description: {
                type: "string",
                description: "Clear, actionable description of what this task does"
              },
              depends_on: {
                type: "array",
                items: { type: "string" },
                description: "Array of task names this task depends on (optional)"
              },
              parallel: {
                type: "boolean",
                description: "Whether this task can run in parallel with others (default: false)"
              },
              expected_output: {
                type: "string",
                description: "Description of expected output (optional)"
              }
            },
            required: ["name", "description"]
          }
        }
      },
      execute: async (args) => {
        return {
          success: true,
          message: `Task '${args.name}' created`
        };
      },
      idempotency: {
        safe: false
      }
    },
    {
      definition: {
        type: "function",
        function: {
          name: "finalize_plan",
          description: "Mark the planning phase as complete. Call this when all tasks have been created and the plan is ready.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      execute: async () => {
        return {
          success: true,
          message: "Plan finalized and ready for execution"
        };
      },
      idempotency: {
        safe: false
      }
    }
  ];
}

// src/core/context/types.ts
var DEFAULT_CONTEXT_CONFIG2 = {
  maxContextTokens: 128e3,
  compactionThreshold: 0.75,
  hardLimit: 0.9,
  responseReserve: 0.15,
  estimator: "approximate",
  autoCompact: true,
  strategy: "proactive",
  strategyOptions: {}
};

// src/core/context/strategies/ProactiveStrategy.ts
var ProactiveCompactionStrategy = class {
  name = "proactive";
  metrics = {
    compactionCount: 0,
    totalTokensFreed: 0,
    avgTokensFreedPerCompaction: 0
  };
  shouldCompact(budget, _config) {
    return budget.status === "warning" || budget.status === "critical";
  }
  async compact(components, budget, compactors, estimator) {
    const log = [];
    let current = [...components];
    const targetUsage = Math.floor(budget.total * 0.65);
    const tokensToFree = budget.used - targetUsage;
    let freedTokens = 0;
    let round = 0;
    const maxRounds = 3;
    const sortedComponents = current.filter((c) => c.compactable).sort((a, b) => b.priority - a.priority);
    while (freedTokens < tokensToFree && round < maxRounds) {
      round++;
      let roundFreed = 0;
      for (const component of sortedComponents) {
        if (freedTokens >= tokensToFree) break;
        const compactor = compactors.find((c) => c.canCompact(component));
        if (!compactor) continue;
        const beforeSize = this.estimateComponent(component, estimator);
        const reductionFactor = 0.5 - (round - 1) * 0.15;
        const targetSize = Math.floor(beforeSize * reductionFactor);
        const compacted = await compactor.compact(component, targetSize);
        const index = current.findIndex((c) => c.name === component.name);
        current[index] = compacted;
        const afterSize = this.estimateComponent(compacted, estimator);
        const saved = beforeSize - afterSize;
        freedTokens += saved;
        roundFreed += saved;
        log.push(
          `Round ${round}: ${compactor.name} compacted "${component.name}" by ${saved} tokens`
        );
      }
      if (roundFreed === 0) break;
    }
    this.metrics.compactionCount++;
    this.metrics.totalTokensFreed += freedTokens;
    this.metrics.avgTokensFreedPerCompaction = this.metrics.totalTokensFreed / this.metrics.compactionCount;
    return { components: current, log, tokensFreed: freedTokens };
  }
  estimateComponent(component, estimator) {
    if (typeof component.content === "string") {
      return estimator.estimateTokens(component.content);
    }
    return estimator.estimateDataTokens(component.content);
  }
  getMetrics() {
    return { ...this.metrics };
  }
};

// src/core/context/strategies/AggressiveStrategy.ts
var AggressiveCompactionStrategy = class {
  constructor(options = {}) {
    this.options = options;
  }
  name = "aggressive";
  shouldCompact(budget, _config) {
    const threshold = this.options.threshold ?? 0.6;
    const utilizationRatio = (budget.used + budget.reserved) / budget.total;
    return utilizationRatio >= threshold;
  }
  async compact(components, budget, compactors, estimator) {
    const log = [];
    let current = [...components];
    const target = this.options.target ?? 0.5;
    const targetUsage = Math.floor(budget.total * target);
    const tokensToFree = budget.used - targetUsage;
    let freedTokens = 0;
    const sortedComponents = current.filter((c) => c.compactable).sort((a, b) => b.priority - a.priority);
    for (const component of sortedComponents) {
      if (freedTokens >= tokensToFree) break;
      const compactor = compactors.find((c) => c.canCompact(component));
      if (!compactor) continue;
      const beforeSize = this.estimateComponent(component, estimator);
      const targetSize = Math.floor(beforeSize * 0.3);
      const compacted = await compactor.compact(component, targetSize);
      const index = current.findIndex((c) => c.name === component.name);
      current[index] = compacted;
      const afterSize = this.estimateComponent(compacted, estimator);
      const saved = beforeSize - afterSize;
      freedTokens += saved;
      log.push(`Aggressive: ${compactor.name} compacted "${component.name}" by ${saved} tokens`);
    }
    return { components: current, log, tokensFreed: freedTokens };
  }
  estimateComponent(component, estimator) {
    if (typeof component.content === "string") {
      return estimator.estimateTokens(component.content);
    }
    return estimator.estimateDataTokens(component.content);
  }
};

// src/core/context/strategies/LazyStrategy.ts
var LazyCompactionStrategy = class {
  name = "lazy";
  shouldCompact(budget, _config) {
    return budget.status === "critical";
  }
  async compact(components, budget, compactors, estimator) {
    const log = [];
    let current = [...components];
    const targetUsage = Math.floor(budget.total * 0.85);
    const tokensToFree = budget.used - targetUsage;
    let freedTokens = 0;
    const sortedComponents = current.filter((c) => c.compactable).sort((a, b) => b.priority - a.priority);
    for (const component of sortedComponents) {
      if (freedTokens >= tokensToFree) break;
      const compactor = compactors.find((c) => c.canCompact(component));
      if (!compactor) continue;
      const beforeSize = this.estimateComponent(component, estimator);
      const targetSize = Math.floor(beforeSize * 0.7);
      const compacted = await compactor.compact(component, targetSize);
      const index = current.findIndex((c) => c.name === component.name);
      current[index] = compacted;
      const afterSize = this.estimateComponent(compacted, estimator);
      const saved = beforeSize - afterSize;
      freedTokens += saved;
      log.push(`Lazy: ${compactor.name} compacted "${component.name}" by ${saved} tokens`);
    }
    return { components: current, log, tokensFreed: freedTokens };
  }
  estimateComponent(component, estimator) {
    if (typeof component.content === "string") {
      return estimator.estimateTokens(component.content);
    }
    return estimator.estimateDataTokens(component.content);
  }
};

// src/core/context/strategies/RollingWindowStrategy.ts
var RollingWindowStrategy = class {
  constructor(options = {}) {
    this.options = options;
  }
  name = "rolling-window";
  shouldCompact(_budget, _config) {
    return false;
  }
  async prepareComponents(components) {
    return components.map((component) => {
      if (Array.isArray(component.content)) {
        const maxMessages = this.options.maxMessages ?? 20;
        if (component.content.length > maxMessages) {
          return {
            ...component,
            content: component.content.slice(-maxMessages),
            metadata: {
              ...component.metadata,
              windowed: true,
              originalLength: component.content.length,
              keptLength: maxMessages
            }
          };
        }
      }
      return component;
    });
  }
  async compact() {
    return { components: [], log: [], tokensFreed: 0 };
  }
};

// src/core/context/strategies/AdaptiveStrategy.ts
var AdaptiveStrategy = class {
  constructor(options = {}) {
    this.options = options;
    this.currentStrategy = new ProactiveCompactionStrategy();
  }
  name = "adaptive";
  currentStrategy;
  metrics = {
    avgUtilization: 0,
    compactionFrequency: 0,
    lastCompactions: []
  };
  shouldCompact(budget, config) {
    this.updateMetrics(budget);
    this.maybeAdapt();
    return this.currentStrategy.shouldCompact(budget, config);
  }
  async compact(components, budget, compactors, estimator) {
    const result = await this.currentStrategy.compact(components, budget, compactors, estimator);
    this.metrics.lastCompactions.push(Date.now());
    const window = this.options.learningWindow ?? 10;
    if (this.metrics.lastCompactions.length > window) {
      this.metrics.lastCompactions.shift();
    }
    return {
      ...result,
      log: [`[Adaptive: using ${this.currentStrategy.name}]`, ...result.log]
    };
  }
  updateMetrics(budget) {
    const alpha = 0.1;
    this.metrics.avgUtilization = alpha * budget.utilizationPercent + (1 - alpha) * this.metrics.avgUtilization;
  }
  maybeAdapt() {
    const now = Date.now();
    if (this.metrics.lastCompactions.length >= 2) {
      const firstCompaction = this.metrics.lastCompactions[0];
      if (firstCompaction !== void 0) {
        const timeSpan = now - firstCompaction;
        this.metrics.compactionFrequency = this.metrics.lastCompactions.length / timeSpan * 6e4;
      }
    }
    const threshold = this.options.switchThreshold ?? 5;
    if (this.metrics.compactionFrequency > threshold) {
      if (this.currentStrategy.name !== "aggressive") {
        this.currentStrategy = new AggressiveCompactionStrategy();
      }
    } else if (this.metrics.compactionFrequency < 0.5 && this.metrics.avgUtilization < 70) {
      if (this.currentStrategy.name !== "lazy") {
        this.currentStrategy = new LazyCompactionStrategy();
      }
    } else {
      if (this.currentStrategy.name !== "proactive") {
        this.currentStrategy = new ProactiveCompactionStrategy();
      }
    }
  }
  getMetrics() {
    return {
      ...this.metrics,
      currentStrategy: this.currentStrategy.name
    };
  }
};

// src/core/context/strategies/index.ts
function createStrategy(name, options = {}) {
  switch (name) {
    case "proactive":
      return new ProactiveCompactionStrategy();
    case "aggressive":
      return new AggressiveCompactionStrategy(options);
    case "lazy":
      return new LazyCompactionStrategy();
    case "rolling-window":
      return new RollingWindowStrategy(options);
    case "adaptive":
      return new AdaptiveStrategy(options);
    default:
      throw new Error(`Unknown context strategy: ${name}`);
  }
}

// src/core/context/ContextManager.ts
var ContextManager2 = class extends EventEmitter {
  config;
  provider;
  estimator;
  compactors;
  strategy;
  lastBudget;
  constructor(provider, config = {}, compactors = [], estimator, strategy) {
    super();
    this.provider = provider;
    this.config = { ...DEFAULT_CONTEXT_CONFIG2, ...config };
    this.compactors = compactors.sort((a, b) => a.priority - b.priority);
    if (estimator) {
      this.estimator = estimator;
    } else if (typeof this.config.estimator === "string") {
      this.estimator = this.createEstimator(this.config.estimator);
    } else {
      this.estimator = this.config.estimator;
    }
    if (strategy) {
      this.strategy = strategy;
    } else {
      this.strategy = this.createStrategy(this.config.strategy || "proactive");
    }
  }
  /**
   * Prepare context for LLM call
   * Returns prepared components, automatically compacting if needed
   */
  async prepare() {
    let components = await this.provider.getComponents();
    if (this.strategy.prepareComponents) {
      components = await this.strategy.prepareComponents(components);
    }
    let budget = this.calculateBudget(components);
    this.lastBudget = budget;
    if (budget.status === "warning") {
      this.emit("budget_warning", { budget });
    } else if (budget.status === "critical") {
      this.emit("budget_critical", { budget });
    }
    const needsCompaction = this.config.autoCompact && this.strategy.shouldCompact(budget, this.config);
    if (needsCompaction) {
      return await this.compactWithStrategy(components, budget);
    }
    return {
      components,
      budget,
      compacted: false
    };
  }
  /**
   * Compact using the current strategy
   */
  async compactWithStrategy(components, budget) {
    this.emit("compacting", {
      reason: `Context at ${budget.utilizationPercent.toFixed(1)}%`,
      currentBudget: budget,
      strategy: this.strategy.name
    });
    const result = await this.strategy.compact(components, budget, this.compactors, this.estimator);
    let finalComponents = result.components;
    if (this.strategy.postProcess) {
      finalComponents = await this.strategy.postProcess(result.components, budget);
    }
    const newBudget = this.calculateBudget(finalComponents);
    if (newBudget.status === "critical") {
      throw new Error(
        `Cannot fit context within limits after compaction (strategy: ${this.strategy.name}). Used: ${newBudget.used}, Limit: ${budget.total - budget.reserved}`
      );
    }
    this.emit("compacted", {
      log: result.log,
      newBudget,
      tokensFreed: result.tokensFreed
    });
    await this.provider.applyCompactedComponents(finalComponents);
    return {
      components: finalComponents,
      budget: newBudget,
      compacted: true,
      compactionLog: result.log
    };
  }
  /**
   * Calculate budget for components
   */
  calculateBudget(components) {
    const breakdown = {};
    let used = 0;
    for (const component of components) {
      const tokens = this.estimateComponent(component);
      breakdown[component.name] = tokens;
      used += tokens;
    }
    const total = this.provider.getMaxContextSize();
    const reserved = Math.floor(total * this.config.responseReserve);
    const available = total - reserved - used;
    const utilizationRatio = (used + reserved) / total;
    const utilizationPercent = used / (total - reserved) * 100;
    let status;
    if (utilizationRatio >= this.config.hardLimit) {
      status = "critical";
    } else if (utilizationRatio >= this.config.compactionThreshold) {
      status = "warning";
    } else {
      status = "ok";
    }
    return {
      total,
      reserved,
      used,
      available,
      utilizationPercent,
      status,
      breakdown
    };
  }
  /**
   * Estimate tokens for a component
   */
  estimateComponent(component) {
    if (typeof component.content === "string") {
      return this.estimator.estimateTokens(component.content);
    }
    return this.estimator.estimateDataTokens(component.content);
  }
  /**
   * Switch to a different strategy at runtime
   */
  setStrategy(strategy) {
    const oldStrategy = this.strategy.name;
    this.strategy = typeof strategy === "string" ? this.createStrategy(strategy) : strategy;
    this.emit("strategy_switched", {
      from: oldStrategy,
      to: this.strategy.name,
      reason: "manual"
    });
  }
  /**
   * Get current strategy
   */
  getStrategy() {
    return this.strategy;
  }
  /**
   * Get strategy metrics
   */
  getStrategyMetrics() {
    return this.strategy.getMetrics?.() ?? {};
  }
  /**
   * Get current budget
   */
  getCurrentBudget() {
    return this.lastBudget ?? null;
  }
  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Update configuration
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }
  /**
   * Add compactor
   */
  addCompactor(compactor) {
    this.compactors.push(compactor);
    this.compactors.sort((a, b) => a.priority - b.priority);
  }
  /**
   * Get all compactors
   */
  getCompactors() {
    return [...this.compactors];
  }
  /**
   * Create estimator from name
   */
  createEstimator(_name) {
    return {
      estimateTokens: (text) => {
        if (!text || text.length === 0) return 0;
        return Math.ceil(text.length / 4);
      },
      estimateDataTokens: (data) => {
        const serialized = JSON.stringify(data);
        return Math.ceil(serialized.length / 4);
      }
    };
  }
  /**
   * Create strategy from name or config
   */
  createStrategy(strategy) {
    if (typeof strategy !== "string") {
      return strategy;
    }
    return createStrategy(strategy, this.config.strategyOptions || {});
  }
};

// src/infrastructure/context/providers/TaskAgentContextProvider.ts
var TaskAgentContextProvider = class {
  config;
  constructor(config) {
    this.config = config;
  }
  async getComponents() {
    const components = [];
    components.push({
      name: "system_prompt",
      content: this.buildSystemPrompt(),
      priority: 0,
      compactable: false
    });
    if (this.config.instructions) {
      components.push({
        name: "instructions",
        content: this.config.instructions,
        priority: 0,
        compactable: false
      });
    }
    components.push({
      name: "plan",
      content: this.serializePlan(this.config.plan),
      priority: 1,
      compactable: false
    });
    const memoryIndex = await this.config.memory.formatIndex();
    components.push({
      name: "memory_index",
      content: memoryIndex,
      priority: 8,
      compactable: true,
      metadata: {
        strategy: "evict",
        evict: async (count) => {
          await this.config.memory.evictLRU(count);
        },
        getUpdatedContent: async () => {
          return await this.config.memory.formatIndex();
        }
      }
    });
    const messages = this.config.historyManager.getRecentMessages();
    components.push({
      name: "conversation_history",
      content: messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      priority: 6,
      compactable: true,
      metadata: {
        strategy: "truncate",
        truncatable: true
      }
    });
    const toolOutputs = this.extractToolOutputs(messages);
    if (toolOutputs.length > 0) {
      components.push({
        name: "tool_outputs",
        content: toolOutputs,
        priority: 10,
        compactable: true,
        metadata: {
          strategy: "truncate",
          truncatable: true,
          maxTokens: 4e3
        }
      });
    }
    if (this.config.currentInput) {
      components.push({
        name: "current_input",
        content: this.config.currentInput,
        priority: 0,
        compactable: false
      });
    }
    return components;
  }
  async applyCompactedComponents(components) {
    const historyComponent = components.find((c) => c.name === "conversation_history");
    if (historyComponent && Array.isArray(historyComponent.content)) ;
  }
  getMaxContextSize() {
    const modelInfo = getModelInfo(this.config.model);
    return modelInfo?.features.input.tokens ?? 128e3;
  }
  /**
   * Update configuration (e.g., when task changes)
   */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
  }
  /**
   * Build system prompt for TaskAgent
   */
  buildSystemPrompt() {
    return `You are an autonomous task-based agent executing a plan.

Your capabilities:
- Access to working memory (use memory_store, memory_retrieve, memory_delete tools)
- Tool execution for completing tasks
- Context awareness (use context_inspect, context_breakdown tools)

Guidelines:
- Complete each task as specified in the plan
- Store important information in memory for later tasks
- Use tools efficiently
- Be concise but thorough
- Monitor your context usage`;
  }
  /**
   * Serialize plan for context
   */
  serializePlan(plan) {
    return `## Current Plan

**Goal**: ${plan.goal}

**Tasks**:
${plan.tasks.map((t, i) => {
      const status = t.status || "pending";
      const deps = t.dependsOn && t.dependsOn.length > 0 ? ` (depends on: ${t.dependsOn.join(", ")})` : "";
      return `${i + 1}. [${status}] ${t.name}: ${t.description}${deps}`;
    }).join("\n")}`;
  }
  /**
   * Extract tool outputs from conversation history
   */
  extractToolOutputs(messages) {
    const toolOutputs = [];
    for (const msg of messages) {
      if (msg.role === "assistant" && msg.toolCalls) {
        for (const toolCall of msg.toolCalls) {
          if (toolCall.result) {
            toolOutputs.push({
              tool: toolCall.name,
              output: toolCall.result
            });
          }
        }
      }
    }
    return toolOutputs;
  }
};

// src/infrastructure/context/compactors/TruncateCompactor.ts
var TruncateCompactor = class {
  constructor(estimator) {
    this.estimator = estimator;
  }
  name = "truncate";
  priority = 10;
  canCompact(component) {
    return component.compactable && (component.metadata?.strategy === "truncate" || component.metadata?.truncatable === true);
  }
  async compact(component, targetTokens) {
    if (typeof component.content === "string") {
      return this.truncateString(component, targetTokens);
    }
    if (Array.isArray(component.content)) {
      return this.truncateArray(component, targetTokens);
    }
    return component;
  }
  estimateSavings(component) {
    const current = this.estimator.estimateDataTokens(component.content);
    return Math.floor(current * 0.5);
  }
  truncateString(component, targetTokens) {
    const content = component.content;
    const currentTokens = this.estimator.estimateTokens(content);
    if (currentTokens <= targetTokens) {
      return component;
    }
    const targetChars = targetTokens * 4;
    const truncated = content.substring(0, targetChars) + "\n[truncated...]";
    return {
      ...component,
      content: truncated,
      metadata: {
        ...component.metadata,
        truncated: true,
        originalLength: content.length,
        truncatedLength: truncated.length
      }
    };
  }
  truncateArray(component, targetTokens) {
    const content = component.content;
    let tokens = 0;
    const kept = [];
    for (let i = content.length - 1; i >= 0; i--) {
      const item = content[i];
      const itemTokens = this.estimator.estimateDataTokens(item);
      if (tokens + itemTokens > targetTokens && kept.length > 0) {
        break;
      }
      kept.unshift(item);
      tokens += itemTokens;
    }
    const droppedLength = content.length - kept.length;
    if (droppedLength === 0) {
      return component;
    }
    return {
      ...component,
      content: kept,
      metadata: {
        ...component.metadata,
        truncated: true,
        originalLength: content.length,
        keptLength: kept.length,
        droppedLength
      }
    };
  }
};

// src/infrastructure/context/compactors/SummarizeCompactor.ts
var SummarizeCompactor = class {
  constructor(estimator) {
    this.estimator = estimator;
  }
  name = "summarize";
  priority = 5;
  canCompact(component) {
    return component.compactable && component.metadata?.strategy === "summarize";
  }
  async compact(component, _targetTokens) {
    console.warn("SummarizeCompactor not yet implemented - returning component unchanged");
    return component;
  }
  estimateSavings(component) {
    const current = this.estimator.estimateDataTokens(component.content);
    return Math.floor(current * 0.8);
  }
};

// src/infrastructure/context/compactors/MemoryEvictionCompactor.ts
var MemoryEvictionCompactor = class {
  constructor(estimator) {
    this.estimator = estimator;
  }
  name = "memory-eviction";
  priority = 8;
  canCompact(component) {
    return component.compactable && (component.metadata?.strategy === "evict" || component.name === "memory_index");
  }
  async compact(component, targetTokens) {
    if (component.metadata?.evict && typeof component.metadata.evict === "function") {
      const currentTokens = this.estimator.estimateDataTokens(component.content);
      const tokensToFree = Math.max(0, currentTokens - targetTokens);
      const avgEntrySize = component.metadata.avgEntrySize || 100;
      const entriesToEvict = Math.ceil(tokensToFree / avgEntrySize);
      if (entriesToEvict > 0) {
        await component.metadata.evict(entriesToEvict);
        if (component.metadata.getUpdatedContent && typeof component.metadata.getUpdatedContent === "function") {
          const updatedContent = await component.metadata.getUpdatedContent();
          return {
            ...component,
            content: updatedContent,
            metadata: {
              ...component.metadata,
              evicted: true,
              evictedCount: entriesToEvict
            }
          };
        }
      }
    }
    return component;
  }
  estimateSavings(component) {
    const avgEntrySize = component.metadata?.avgEntrySize || 100;
    return avgEntrySize * 2;
  }
};

// src/infrastructure/context/estimators/ApproximateEstimator.ts
var ApproximateTokenEstimator = class {
  /**
   * Estimate tokens for text using 4 chars per token heuristic
   */
  estimateTokens(text, _model) {
    if (!text || text.length === 0) {
      return 0;
    }
    return Math.ceil(text.length / 4);
  }
  /**
   * Estimate tokens for structured data
   */
  estimateDataTokens(data, _model) {
    if (data === null || data === void 0) {
      return 1;
    }
    try {
      const serialized = JSON.stringify(data);
      return this.estimateTokens(serialized);
    } catch {
      return 100;
    }
  }
};

// src/infrastructure/context/estimators/index.ts
function createEstimator(name) {
  switch (name) {
    case "approximate":
      return new ApproximateTokenEstimator();
    case "tiktoken":
      throw new Error('Tiktoken estimator not yet implemented. Use "approximate" for now.');
    default:
      throw new Error(`Unknown token estimator: ${name}`);
  }
}

// src/index.ts
init_Memory();

// src/infrastructure/storage/InMemorySessionStorage.ts
var InMemorySessionStorage = class {
  sessions = /* @__PURE__ */ new Map();
  async save(session) {
    this.sessions.set(session.id, JSON.parse(JSON.stringify(session)));
  }
  async load(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return JSON.parse(JSON.stringify(session));
  }
  async delete(sessionId) {
    this.sessions.delete(sessionId);
  }
  async exists(sessionId) {
    return this.sessions.has(sessionId);
  }
  async list(filter) {
    let sessions = Array.from(this.sessions.values());
    if (filter) {
      sessions = this.applyFilter(sessions, filter);
    }
    sessions.sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
    if (filter?.offset) {
      sessions = sessions.slice(filter.offset);
    }
    if (filter?.limit) {
      sessions = sessions.slice(0, filter.limit);
    }
    return sessions.map(this.toSummary);
  }
  async search(query, filter) {
    const lowerQuery = query.toLowerCase();
    let sessions = Array.from(this.sessions.values());
    sessions = sessions.filter((s) => {
      const titleMatch = s.metadata.title?.toLowerCase().includes(lowerQuery);
      const tagMatch = s.metadata.tags?.some(
        (t) => t.toLowerCase().includes(lowerQuery)
      );
      const idMatch = s.id.toLowerCase().includes(lowerQuery);
      return titleMatch || tagMatch || idMatch;
    });
    if (filter) {
      sessions = this.applyFilter(sessions, filter);
    }
    sessions.sort((a, b) => {
      const aTitle = a.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const bTitle = b.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      if (aTitle !== bTitle) return bTitle - aTitle;
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
    if (filter?.offset) {
      sessions = sessions.slice(filter.offset);
    }
    if (filter?.limit) {
      sessions = sessions.slice(0, filter.limit);
    }
    return sessions.map(this.toSummary);
  }
  /**
   * Clear all sessions (useful for testing)
   */
  clear() {
    this.sessions.clear();
  }
  /**
   * Get count of sessions
   */
  get size() {
    return this.sessions.size;
  }
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  applyFilter(sessions, filter) {
    return sessions.filter((s) => {
      if (filter.agentType && s.agentType !== filter.agentType) {
        return false;
      }
      if (filter.userId && s.metadata.userId !== filter.userId) {
        return false;
      }
      if (filter.tags && filter.tags.length > 0) {
        const sessionTags = s.metadata.tags ?? [];
        const hasMatchingTag = filter.tags.some((t) => sessionTags.includes(t));
        if (!hasMatchingTag) return false;
      }
      if (filter.createdAfter && new Date(s.createdAt) < filter.createdAfter) {
        return false;
      }
      if (filter.createdBefore && new Date(s.createdAt) > filter.createdBefore) {
        return false;
      }
      if (filter.activeAfter && new Date(s.lastActiveAt) < filter.activeAfter) {
        return false;
      }
      if (filter.activeBefore && new Date(s.lastActiveAt) > filter.activeBefore) {
        return false;
      }
      return true;
    });
  }
  toSummary(session) {
    return {
      id: session.id,
      agentType: session.agentType,
      createdAt: new Date(session.createdAt),
      lastActiveAt: new Date(session.lastActiveAt),
      metadata: session.metadata,
      messageCount: session.history.entries.length
    };
  }
};
var FileSessionStorage = class {
  directory;
  prettyPrint;
  extension;
  indexPath;
  index = null;
  constructor(config) {
    this.directory = config.directory;
    this.prettyPrint = config.prettyPrint ?? false;
    this.extension = config.extension ?? ".json";
    this.indexPath = join(this.directory, "_index.json");
  }
  async save(session) {
    await this.ensureDirectory();
    const filePath = this.getFilePath(session.id);
    const data = this.prettyPrint ? JSON.stringify(session, null, 2) : JSON.stringify(session);
    await promises.writeFile(filePath, data, "utf-8");
    await this.updateIndex(session);
  }
  async load(sessionId) {
    const filePath = this.getFilePath(sessionId);
    try {
      const data = await promises.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      if (error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }
  async delete(sessionId) {
    const filePath = this.getFilePath(sessionId);
    try {
      await promises.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    await this.removeFromIndex(sessionId);
  }
  async exists(sessionId) {
    const filePath = this.getFilePath(sessionId);
    try {
      await promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  async list(filter) {
    const index = await this.loadIndex();
    let entries = index.sessions;
    if (filter) {
      entries = this.applyFilter(entries, filter);
    }
    entries.sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
    if (filter?.offset) {
      entries = entries.slice(filter.offset);
    }
    if (filter?.limit) {
      entries = entries.slice(0, filter.limit);
    }
    return entries.map(this.indexEntryToSummary);
  }
  async search(query, filter) {
    const index = await this.loadIndex();
    const lowerQuery = query.toLowerCase();
    let entries = index.sessions.filter((e) => {
      const titleMatch = e.metadata.title?.toLowerCase().includes(lowerQuery);
      const tagMatch = e.metadata.tags?.some(
        (t) => t.toLowerCase().includes(lowerQuery)
      );
      const idMatch = e.id.toLowerCase().includes(lowerQuery);
      return titleMatch || tagMatch || idMatch;
    });
    if (filter) {
      entries = this.applyFilter(entries, filter);
    }
    entries.sort((a, b) => {
      const aTitle = a.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      const bTitle = b.metadata.title?.toLowerCase().includes(lowerQuery) ? 1 : 0;
      if (aTitle !== bTitle) return bTitle - aTitle;
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
    if (filter?.offset) {
      entries = entries.slice(filter.offset);
    }
    if (filter?.limit) {
      entries = entries.slice(0, filter.limit);
    }
    return entries.map(this.indexEntryToSummary);
  }
  /**
   * Rebuild the index by scanning all session files
   * Useful for recovery or migration
   */
  async rebuildIndex() {
    await this.ensureDirectory();
    const files = await promises.readdir(this.directory);
    const sessionFiles = files.filter(
      (f) => f.endsWith(this.extension) && !f.startsWith("_")
    );
    const entries = [];
    for (const file of sessionFiles) {
      try {
        const filePath = join(this.directory, file);
        const data = await promises.readFile(filePath, "utf-8");
        const session = JSON.parse(data);
        entries.push(this.sessionToIndexEntry(session));
      } catch {
      }
    }
    this.index = {
      version: 1,
      sessions: entries,
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.saveIndex();
  }
  /**
   * Get the storage directory path
   */
  getDirectory() {
    return this.directory;
  }
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  getFilePath(sessionId) {
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.directory, `${safeId}${this.extension}`);
  }
  async ensureDirectory() {
    try {
      await promises.mkdir(this.directory, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }
  async loadIndex() {
    if (this.index) {
      return this.index;
    }
    try {
      const data = await promises.readFile(this.indexPath, "utf-8");
      this.index = JSON.parse(data);
      return this.index;
    } catch (error) {
      if (error.code === "ENOENT") {
        this.index = {
          version: 1,
          sessions: [],
          lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
        };
        return this.index;
      }
      throw error;
    }
  }
  async saveIndex() {
    if (!this.index) return;
    this.index.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
    const data = this.prettyPrint ? JSON.stringify(this.index, null, 2) : JSON.stringify(this.index);
    await promises.writeFile(this.indexPath, data, "utf-8");
  }
  async updateIndex(session) {
    const index = await this.loadIndex();
    const entry = this.sessionToIndexEntry(session);
    const existingIdx = index.sessions.findIndex((e) => e.id === session.id);
    if (existingIdx >= 0) {
      index.sessions[existingIdx] = entry;
    } else {
      index.sessions.push(entry);
    }
    await this.saveIndex();
  }
  async removeFromIndex(sessionId) {
    await this.ensureDirectory();
    const index = await this.loadIndex();
    index.sessions = index.sessions.filter((e) => e.id !== sessionId);
    await this.saveIndex();
  }
  sessionToIndexEntry(session) {
    let createdAtStr;
    if (typeof session.createdAt === "string") {
      createdAtStr = session.createdAt;
    } else if (typeof session.createdAt === "number") {
      createdAtStr = new Date(session.createdAt).toISOString();
    } else if (session.createdAt instanceof Date) {
      createdAtStr = session.createdAt.toISOString();
    } else {
      createdAtStr = (/* @__PURE__ */ new Date()).toISOString();
    }
    let lastActiveAtStr;
    if (typeof session.lastActiveAt === "string") {
      lastActiveAtStr = session.lastActiveAt;
    } else if (typeof session.lastActiveAt === "number") {
      lastActiveAtStr = new Date(session.lastActiveAt).toISOString();
    } else if (session.lastActiveAt instanceof Date) {
      lastActiveAtStr = session.lastActiveAt.toISOString();
    } else {
      lastActiveAtStr = (/* @__PURE__ */ new Date()).toISOString();
    }
    return {
      id: session.id,
      agentType: session.agentType,
      createdAt: createdAtStr,
      lastActiveAt: lastActiveAtStr,
      metadata: {
        title: session.metadata.title,
        userId: session.metadata.userId,
        tags: session.metadata.tags
      },
      messageCount: session.history.entries.length
    };
  }
  indexEntryToSummary(entry) {
    return {
      id: entry.id,
      agentType: entry.agentType,
      createdAt: new Date(entry.createdAt),
      lastActiveAt: new Date(entry.lastActiveAt),
      metadata: entry.metadata,
      messageCount: entry.messageCount
    };
  }
  applyFilter(entries, filter) {
    return entries.filter((e) => {
      if (filter.agentType && e.agentType !== filter.agentType) {
        return false;
      }
      if (filter.userId && e.metadata.userId !== filter.userId) {
        return false;
      }
      if (filter.tags && filter.tags.length > 0) {
        const entryTags = e.metadata.tags ?? [];
        const hasMatchingTag = filter.tags.some((t) => entryTags.includes(t));
        if (!hasMatchingTag) return false;
      }
      if (filter.createdAfter && new Date(e.createdAt) < filter.createdAfter) {
        return false;
      }
      if (filter.createdBefore && new Date(e.createdAt) > filter.createdBefore) {
        return false;
      }
      if (filter.activeAfter && new Date(e.lastActiveAt) < filter.activeAfter) {
        return false;
      }
      if (filter.activeBefore && new Date(e.lastActiveAt) > filter.activeBefore) {
        return false;
      }
      return true;
    });
  }
};

// src/capabilities/agents/StreamHelpers.ts
var StreamHelpers = class {
  /**
   * Collect complete response from stream
   * Accumulates all events and reconstructs final LLMResponse
   */
  static async collectResponse(stream) {
    let state = null;
    for await (const event of stream) {
      if (!state && event.type === "response.created" /* RESPONSE_CREATED */) {
        state = new StreamState(event.response_id, event.model, event.created_at);
      }
      if (!state) continue;
      this.updateStateFromEvent(state, event);
    }
    if (!state) {
      throw new Error("No stream events received");
    }
    return this.reconstructLLMResponse(state);
  }
  /**
   * Get only text deltas from stream (for simple text streaming)
   * Filters out all other event types
   */
  static async *textOnly(stream) {
    for await (const event of stream) {
      if (isOutputTextDelta(event)) {
        yield event.delta;
      }
    }
  }
  /**
   * Filter stream events by type
   */
  static async *filterByType(stream, eventType) {
    for await (const event of stream) {
      if (event.type === eventType) {
        yield event;
      }
    }
  }
  /**
   * Accumulate text from stream into a single string
   */
  static async accumulateText(stream) {
    const chunks = [];
    for await (const event of stream) {
      if (isOutputTextDelta(event)) {
        chunks.push(event.delta);
      }
    }
    return chunks.join("");
  }
  /**
   * Buffer stream events into batches
   */
  static async *bufferEvents(stream, batchSize) {
    let buffer = [];
    for await (const event of stream) {
      buffer.push(event);
      if (buffer.length >= batchSize) {
        yield buffer;
        buffer = [];
      }
    }
    if (buffer.length > 0) {
      yield buffer;
    }
  }
  /**
   * Tap into stream without consuming it
   * Useful for logging or side effects
   */
  static async *tap(stream, callback) {
    for await (const event of stream) {
      await callback(event);
      yield event;
    }
  }
  /**
   * Take first N events from stream
   */
  static async *take(stream, count) {
    let taken = 0;
    for await (const event of stream) {
      if (taken >= count) break;
      yield event;
      taken++;
    }
  }
  /**
   * Skip first N events from stream
   */
  static async *skip(stream, count) {
    let skipped = 0;
    for await (const event of stream) {
      if (skipped < count) {
        skipped++;
        continue;
      }
      yield event;
    }
  }
  /**
   * Update StreamState from event
   * @private
   */
  static updateStateFromEvent(state, event) {
    switch (event.type) {
      case "response.output_text.delta" /* OUTPUT_TEXT_DELTA */:
        state.accumulateTextDelta(event.item_id, event.delta);
        break;
      case "response.tool_call.start" /* TOOL_CALL_START */:
        state.startToolCall(event.tool_call_id, event.tool_name);
        break;
      case "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */:
        state.accumulateToolArguments(event.tool_call_id, event.delta);
        break;
      case "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */:
        state.completeToolCall(event.tool_call_id);
        break;
      case "response.tool_execution.done" /* TOOL_EXECUTION_DONE */:
        state.setToolResult(event.tool_call_id, event.result);
        break;
      case "response.iteration.complete" /* ITERATION_COMPLETE */:
        state.incrementIteration();
        break;
      case "response.complete" /* RESPONSE_COMPLETE */:
        if (process.env.DEBUG_STREAMING) {
          console.error("[DEBUG] RESPONSE_COMPLETE event:", event.usage);
        }
        state.updateUsage(event.usage);
        state.markComplete(event.status);
        break;
    }
  }
  /**
   * Reconstruct LLMResponse from StreamState
   * @private
   */
  static reconstructLLMResponse(state) {
    const output = [];
    if (state.hasText()) {
      const textContent = state.getAllText();
      if (textContent) {
        output.push({
          type: "message",
          role: "assistant" /* ASSISTANT */,
          content: [
            {
              type: "output_text" /* OUTPUT_TEXT */,
              text: textContent
            }
          ]
        });
      }
    }
    const toolCalls = state.getCompletedToolCalls();
    if (toolCalls.length > 0) {
      const toolUseContent = toolCalls.map((tc) => ({
        type: "tool_use" /* TOOL_USE */,
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments
      }));
      const firstOutput = output[0];
      if (firstOutput && firstOutput.type === "message") {
        firstOutput.content.push(...toolUseContent);
      } else {
        output.push({
          type: "message",
          role: "assistant" /* ASSISTANT */,
          content: toolUseContent
        });
      }
    }
    const outputText = this.extractOutputText(output);
    return {
      id: state.responseId,
      object: "response",
      created_at: state.createdAt,
      status: state.status,
      model: state.model,
      output,
      output_text: outputText,
      usage: state.usage
    };
  }
  /**
   * Extract text from output items
   * @private
   */
  static extractOutputText(output) {
    const texts = [];
    for (const item of output) {
      if (item.type === "message") {
        for (const content of item.content) {
          if (content.type === "output_text" /* OUTPUT_TEXT */) {
            texts.push(content.text);
          }
        }
      }
    }
    return texts.join(" ").trim();
  }
};

// src/infrastructure/providers/base/ProviderErrorMapper.ts
var ProviderErrorMapper = class {
  /**
   * Map any provider error to our standard error types
   */
  static mapError(error, context) {
    const { providerName, maxContextTokens = 128e3 } = context;
    if (error instanceof AIError) {
      return error;
    }
    const status = error.status || error.statusCode || error.code;
    const message = error.message || String(error);
    const messageLower = message.toLowerCase();
    if (status === 401 || status === 403 || messageLower.includes("api key") || messageLower.includes("api_key") || messageLower.includes("authentication") || messageLower.includes("unauthorized") || messageLower.includes("invalid key") || messageLower.includes("permission denied")) {
      return new ProviderAuthError(providerName, message);
    }
    if (status === 429 || messageLower.includes("rate limit") || messageLower.includes("rate_limit") || messageLower.includes("too many requests") || messageLower.includes("resource exhausted") || messageLower.includes("quota exceeded")) {
      const retryAfter = this.extractRetryAfter(error);
      return new ProviderRateLimitError(providerName, retryAfter);
    }
    if (status === 413 || error.code === "context_length_exceeded" || messageLower.includes("context length") || messageLower.includes("context_length") || messageLower.includes("token limit") || messageLower.includes("too long") || messageLower.includes("maximum context") || messageLower.includes("max_tokens") || messageLower.includes("prompt is too long")) {
      return new ProviderContextLengthError(providerName, maxContextTokens);
    }
    return new ProviderError(providerName, message, status, error);
  }
  /**
   * Extract retry-after value from error headers or body
   */
  static extractRetryAfter(error) {
    const retryAfterHeader = error.headers?.["retry-after"] || error.headers?.["Retry-After"] || error.headers?.get?.("retry-after");
    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        return seconds * 1e3;
      }
    }
    if (error.retryAfter) {
      return typeof error.retryAfter === "number" ? error.retryAfter : parseInt(error.retryAfter, 10) * 1e3;
    }
    if (error.errorDetails) {
      for (const detail of error.errorDetails) {
        if (detail.retryDelay) {
          const match = detail.retryDelay.match(/(\d+)s/);
          if (match) {
            return parseInt(match[1], 10) * 1e3;
          }
        }
      }
    }
    return void 0;
  }
};
var FileStorage = class {
  directory;
  encryptionKey;
  constructor(config) {
    if (!config.encryptionKey) {
      throw new Error(
        "FileStorage requires an encryption key. Set OAUTH_ENCRYPTION_KEY in environment or provide config.encryptionKey"
      );
    }
    this.directory = config.directory;
    this.encryptionKey = config.encryptionKey;
    this.ensureDirectory().catch((error) => {
      console.error("Failed to create token directory:", error);
    });
  }
  async ensureDirectory() {
    try {
      await fs8.mkdir(this.directory, { recursive: true });
      await fs8.chmod(this.directory, 448);
    } catch (error) {
    }
  }
  /**
   * Get file path for a token key (hashed for security)
   */
  getFilePath(key) {
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    return path3.join(this.directory, `${hash}.token`);
  }
  async storeToken(key, token) {
    await this.ensureDirectory();
    const filePath = this.getFilePath(key);
    const plaintext = JSON.stringify(token);
    const encrypted = encrypt(plaintext, this.encryptionKey);
    await fs8.writeFile(filePath, encrypted, "utf8");
    await fs8.chmod(filePath, 384);
  }
  async getToken(key) {
    const filePath = this.getFilePath(key);
    try {
      const encrypted = await fs8.readFile(filePath, "utf8");
      const decrypted = decrypt(encrypted, this.encryptionKey);
      return JSON.parse(decrypted);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      console.error("Failed to read/decrypt token file:", error);
      try {
        await fs8.unlink(filePath);
      } catch {
      }
      return null;
    }
  }
  async deleteToken(key) {
    const filePath = this.getFilePath(key);
    try {
      await fs8.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  async hasToken(key) {
    const filePath = this.getFilePath(key);
    try {
      await fs8.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * List all token keys (for debugging)
   */
  async listTokens() {
    try {
      const files = await fs8.readdir(this.directory);
      return files.filter((f) => f.endsWith(".token")).map((f) => f.replace(".token", ""));
    } catch {
      return [];
    }
  }
  /**
   * Clear all tokens
   */
  async clearAll() {
    try {
      const files = await fs8.readdir(this.directory);
      const tokenFiles = files.filter((f) => f.endsWith(".token"));
      await Promise.all(
        tokenFiles.map((f) => fs8.unlink(path3.join(this.directory, f)).catch(() => {
        }))
      );
    } catch {
    }
  }
};

// src/connectors/authenticatedFetch.ts
async function authenticatedFetch(url, options, authProvider, userId) {
  const connector = Connector.get(authProvider);
  const token = await connector.getToken(userId);
  const authOptions = {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`
    }
  };
  return fetch(url, authOptions);
}
function createAuthenticatedFetch(authProvider, userId) {
  Connector.get(authProvider);
  return async (url, options) => {
    return authenticatedFetch(url, options, authProvider, userId);
  };
}

// src/connectors/toolGenerator.ts
function generateWebAPITool() {
  return {
    definition: {
      type: "function",
      function: {
        name: "api_request",
        description: `Make authenticated HTTP request to any registered OAuth API.

This tool automatically handles OAuth authentication for registered providers.

REGISTERED PROVIDERS:
${Connector.getDescriptionsForTools()}

HOW TO USE:
1. Choose the appropriate authProvider based on which API you need to access
2. Provide the URL (full URL or path relative to provider's baseURL)
3. Specify the HTTP method (GET, POST, etc.)
4. For POST/PUT/PATCH, include the request body

EXAMPLES:
Read Microsoft emails:
{
  authProvider: "microsoft",
  url: "/v1.0/me/messages",
  method: "GET"
}

List GitHub repositories:
{
  authProvider: "github",
  url: "/user/repos",
  method: "GET"
}

Create Salesforce account:
{
  authProvider: "salesforce",
  url: "/services/data/v57.0/sobjects/Account",
  method: "POST",
  body: { Name: "Acme Corp", Industry: "Technology" }
}`,
        parameters: {
          type: "object",
          properties: {
            authProvider: {
              type: "string",
              enum: Connector.list(),
              description: "Which connector to use for authentication. Choose based on the API you need to access."
            },
            url: {
              type: "string",
              description: 'URL to request. Can be full URL (https://...) or path relative to provider baseURL (e.g., "/v1.0/me")'
            },
            method: {
              type: "string",
              enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
              description: "HTTP method (default: GET)"
            },
            body: {
              description: "Request body for POST/PUT/PATCH requests. Will be JSON-stringified automatically."
            },
            headers: {
              type: "object",
              description: "Additional headers to include. Authorization header is added automatically."
            }
          },
          required: ["authProvider", "url"]
        }
      },
      blocking: true,
      timeout: 3e4
    },
    execute: async (args) => {
      try {
        const connector = Connector.get(args.authProvider);
        const fullUrl = args.url.startsWith("http") ? args.url : `${connector.baseURL}${args.url}`;
        const requestOptions = {
          method: args.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...args.headers
          }
        };
        if (args.body && (args.method === "POST" || args.method === "PUT" || args.method === "PATCH")) {
          requestOptions.body = JSON.stringify(args.body);
        }
        const response = await authenticatedFetch(fullUrl, requestOptions, args.authProvider);
        const contentType = response.headers.get("content-type") || "";
        let data;
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        return {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          data
        };
      } catch (error) {
        return {
          success: false,
          status: 0,
          statusText: "Error",
          data: null,
          error: error.message
        };
      }
    }
  };
}

// src/domain/interfaces/IConnectorConfigStorage.ts
var CONNECTOR_CONFIG_VERSION = 1;

// src/connectors/storage/ConnectorConfigStore.ts
var ENCRYPTED_PREFIX = "$ENC$:";
var ConnectorConfigStore = class {
  constructor(storage, encryptionKey) {
    this.storage = storage;
    this.encryptionKey = encryptionKey;
    if (!encryptionKey || encryptionKey.length < 16) {
      throw new Error(
        "ConnectorConfigStore requires an encryption key of at least 16 characters"
      );
    }
  }
  /**
   * Save a connector configuration (secrets are encrypted automatically)
   *
   * @param name - Unique identifier for this connector
   * @param config - The connector configuration
   */
  async save(name, config) {
    if (!name || name.trim().length === 0) {
      throw new Error("Connector name is required");
    }
    const existing = await this.storage.get(name);
    const now = Date.now();
    const encryptedConfig = this.encryptSecrets(config);
    const stored = {
      config: { ...encryptedConfig, name },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: CONNECTOR_CONFIG_VERSION
    };
    await this.storage.save(name, stored);
  }
  /**
   * Retrieve a connector configuration (secrets are decrypted automatically)
   *
   * @param name - Unique identifier for the connector
   * @returns The decrypted config or null if not found
   */
  async get(name) {
    const stored = await this.storage.get(name);
    if (!stored) {
      return null;
    }
    return this.decryptSecrets(stored.config);
  }
  /**
   * Delete a connector configuration
   *
   * @param name - Unique identifier for the connector
   * @returns True if deleted, false if not found
   */
  async delete(name) {
    return this.storage.delete(name);
  }
  /**
   * Check if a connector configuration exists
   *
   * @param name - Unique identifier for the connector
   * @returns True if exists
   */
  async has(name) {
    return this.storage.has(name);
  }
  /**
   * List all connector names
   *
   * @returns Array of connector names
   */
  async list() {
    return this.storage.list();
  }
  /**
   * Get all connector configurations (secrets are decrypted automatically)
   *
   * @returns Array of decrypted configs
   */
  async listAll() {
    const stored = await this.storage.listAll();
    return stored.map((s) => this.decryptSecrets(s.config));
  }
  /**
   * Get stored metadata for a connector
   *
   * @param name - Unique identifier for the connector
   * @returns Metadata (createdAt, updatedAt, version) or null
   */
  async getMetadata(name) {
    const stored = await this.storage.get(name);
    if (!stored) {
      return null;
    }
    return {
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      version: stored.version
    };
  }
  // ============ Encryption Helpers ============
  /**
   * Encrypt sensitive fields in a ConnectorConfig
   * Fields encrypted: apiKey, clientSecret, privateKey
   */
  encryptSecrets(config) {
    const result = { ...config };
    if (result.auth) {
      result.auth = this.encryptAuthSecrets(result.auth);
    }
    return result;
  }
  /**
   * Decrypt sensitive fields in a ConnectorConfig
   */
  decryptSecrets(config) {
    const result = { ...config };
    if (result.auth) {
      result.auth = this.decryptAuthSecrets(result.auth);
    }
    return result;
  }
  /**
   * Encrypt secrets in ConnectorAuth based on auth type
   */
  encryptAuthSecrets(auth) {
    switch (auth.type) {
      case "api_key":
        return {
          ...auth,
          apiKey: this.encryptValue(auth.apiKey)
        };
      case "oauth":
        return {
          ...auth,
          clientSecret: auth.clientSecret ? this.encryptValue(auth.clientSecret) : void 0,
          privateKey: auth.privateKey ? this.encryptValue(auth.privateKey) : void 0
        };
      case "jwt":
        return {
          ...auth,
          privateKey: this.encryptValue(auth.privateKey)
        };
      default:
        return auth;
    }
  }
  /**
   * Decrypt secrets in ConnectorAuth based on auth type
   */
  decryptAuthSecrets(auth) {
    switch (auth.type) {
      case "api_key":
        return {
          ...auth,
          apiKey: this.decryptValue(auth.apiKey)
        };
      case "oauth":
        return {
          ...auth,
          clientSecret: auth.clientSecret ? this.decryptValue(auth.clientSecret) : void 0,
          privateKey: auth.privateKey ? this.decryptValue(auth.privateKey) : void 0
        };
      case "jwt":
        return {
          ...auth,
          privateKey: this.decryptValue(auth.privateKey)
        };
      default:
        return auth;
    }
  }
  /**
   * Encrypt a single value if not already encrypted
   */
  encryptValue(value) {
    if (this.isEncrypted(value)) {
      return value;
    }
    const encrypted = encrypt(value, this.encryptionKey);
    return `${ENCRYPTED_PREFIX}${encrypted}`;
  }
  /**
   * Decrypt a single value if encrypted
   */
  decryptValue(value) {
    if (!this.isEncrypted(value)) {
      return value;
    }
    const encryptedData = value.slice(ENCRYPTED_PREFIX.length);
    return decrypt(encryptedData, this.encryptionKey);
  }
  /**
   * Check if a value is encrypted (has the $ENC$: prefix)
   */
  isEncrypted(value) {
    return value.startsWith(ENCRYPTED_PREFIX);
  }
};

// src/connectors/storage/MemoryConnectorStorage.ts
var MemoryConnectorStorage = class {
  configs = /* @__PURE__ */ new Map();
  async save(name, stored) {
    this.configs.set(name, JSON.parse(JSON.stringify(stored)));
  }
  async get(name) {
    const stored = this.configs.get(name);
    if (!stored) {
      return null;
    }
    return JSON.parse(JSON.stringify(stored));
  }
  async delete(name) {
    return this.configs.delete(name);
  }
  async has(name) {
    return this.configs.has(name);
  }
  async list() {
    return Array.from(this.configs.keys());
  }
  async listAll() {
    return Array.from(this.configs.values()).map(
      (stored) => JSON.parse(JSON.stringify(stored))
    );
  }
  /**
   * Clear all stored configs (useful for testing)
   */
  clear() {
    this.configs.clear();
  }
  /**
   * Get the number of stored configs
   */
  size() {
    return this.configs.size;
  }
};
var FileConnectorStorage = class {
  directory;
  indexPath;
  initialized = false;
  constructor(config) {
    if (!config.directory) {
      throw new Error("FileConnectorStorage requires a directory path");
    }
    this.directory = config.directory;
    this.indexPath = path3.join(this.directory, "_index.json");
  }
  async save(name, stored) {
    await this.ensureDirectory();
    const filePath = this.getFilePath(name);
    const json = JSON.stringify(stored, null, 2);
    await fs8.writeFile(filePath, json, "utf8");
    await fs8.chmod(filePath, 384);
    await this.updateIndex(name, "add");
  }
  async get(name) {
    const filePath = this.getFilePath(name);
    try {
      const json = await fs8.readFile(filePath, "utf8");
      return JSON.parse(json);
    } catch (error) {
      const err = error;
      if (err.code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }
  async delete(name) {
    const filePath = this.getFilePath(name);
    try {
      await fs8.unlink(filePath);
      await this.updateIndex(name, "remove");
      return true;
    } catch (error) {
      const err = error;
      if (err.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }
  async has(name) {
    const filePath = this.getFilePath(name);
    try {
      await fs8.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  async list() {
    const index = await this.loadIndex();
    return Object.values(index.connectors);
  }
  async listAll() {
    const names = await this.list();
    const results = [];
    for (const name of names) {
      const stored = await this.get(name);
      if (stored) {
        results.push(stored);
      }
    }
    return results;
  }
  /**
   * Clear all stored configs (useful for testing)
   */
  async clear() {
    try {
      const files = await fs8.readdir(this.directory);
      const connectorFiles = files.filter(
        (f) => f.endsWith(".connector.json") || f === "_index.json"
      );
      await Promise.all(
        connectorFiles.map(
          (f) => fs8.unlink(path3.join(this.directory, f)).catch(() => {
          })
        )
      );
    } catch {
    }
  }
  // ============ Private Helpers ============
  /**
   * Get file path for a connector (hashed for security)
   */
  getFilePath(name) {
    const hash = this.hashName(name);
    return path3.join(this.directory, `${hash}.connector.json`);
  }
  /**
   * Hash connector name to prevent enumeration
   */
  hashName(name) {
    return crypto.createHash("sha256").update(name).digest("hex").slice(0, 16);
  }
  /**
   * Ensure storage directory exists with proper permissions
   */
  async ensureDirectory() {
    if (this.initialized) return;
    try {
      await fs8.mkdir(this.directory, { recursive: true });
      await fs8.chmod(this.directory, 448);
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }
  /**
   * Load the index file
   */
  async loadIndex() {
    try {
      const json = await fs8.readFile(this.indexPath, "utf8");
      return JSON.parse(json);
    } catch {
      return { connectors: {} };
    }
  }
  /**
   * Update the index file
   */
  async updateIndex(name, action) {
    const index = await this.loadIndex();
    const hash = this.hashName(name);
    if (action === "add") {
      index.connectors[hash] = name;
    } else {
      delete index.connectors[hash];
    }
    const json = JSON.stringify(index, null, 2);
    await fs8.writeFile(this.indexPath, json, "utf8");
    await fs8.chmod(this.indexPath, 384);
  }
};

// src/infrastructure/resilience/BackoffStrategy.ts
var DEFAULT_BACKOFF_CONFIG = {
  strategy: "exponential",
  initialDelayMs: 1e3,
  // 1 second
  maxDelayMs: 3e4,
  // 30 seconds
  multiplier: 2,
  jitter: true,
  jitterFactor: 0.1
};
function calculateBackoff(attempt, config = DEFAULT_BACKOFF_CONFIG) {
  let delay;
  switch (config.strategy) {
    case "exponential":
      delay = config.initialDelayMs * Math.pow(config.multiplier || 2, attempt - 1);
      break;
    case "linear":
      delay = config.initialDelayMs + (config.incrementMs || 1e3) * (attempt - 1);
      break;
    case "constant":
      delay = config.initialDelayMs;
      break;
    default:
      delay = config.initialDelayMs;
  }
  delay = Math.min(delay, config.maxDelayMs);
  if (config.jitter) {
    delay = addJitter(delay, config.jitterFactor || 0.1);
  }
  return Math.floor(delay);
}
function addJitter(delay, factor = 0.1) {
  const jitterRange = delay * factor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return delay + jitter;
}
async function backoffWait(attempt, config = DEFAULT_BACKOFF_CONFIG) {
  const delay = calculateBackoff(attempt, config);
  await new Promise((resolve) => setTimeout(resolve, delay));
  return delay;
}
function* backoffSequence(config = DEFAULT_BACKOFF_CONFIG, maxAttempts) {
  let attempt = 1;
  while (true) {
    if (maxAttempts && attempt > maxAttempts) {
      return;
    }
    yield calculateBackoff(attempt, config);
    attempt++;
  }
}
async function retryWithBackoff(fn, config = DEFAULT_BACKOFF_CONFIG, maxAttempts) {
  let attempt = 0;
  let lastError;
  while (true) {
    attempt++;
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (config.isRetryable && !config.isRetryable(lastError)) {
        throw lastError;
      }
      if (maxAttempts && attempt >= maxAttempts) {
        throw lastError;
      }
      await backoffWait(attempt, config);
    }
  }
}

// src/utils/messageBuilder.ts
var MessageBuilder = class {
  messages = [];
  /**
   * Add a user text message
   */
  addUserMessage(text) {
    this.messages.push({
      type: "message",
      role: "user" /* USER */,
      content: [
        {
          type: "input_text" /* INPUT_TEXT */,
          text
        }
      ]
    });
    return this;
  }
  /**
   * Add a user message with text and images
   */
  addUserMessageWithImages(text, imageUrls) {
    const content = [
      {
        type: "input_text" /* INPUT_TEXT */,
        text
      }
    ];
    for (const url of imageUrls) {
      content.push({
        type: "input_image_url" /* INPUT_IMAGE_URL */,
        image_url: {
          url,
          detail: "auto"
          // Can be 'auto', 'low', or 'high'
        }
      });
    }
    this.messages.push({
      type: "message",
      role: "user" /* USER */,
      content
    });
    return this;
  }
  /**
   * Add an assistant message (for conversation history)
   */
  addAssistantMessage(text) {
    this.messages.push({
      type: "message",
      role: "assistant" /* ASSISTANT */,
      content: [
        {
          type: "output_text" /* OUTPUT_TEXT */,
          text,
          annotations: []
        }
      ]
    });
    return this;
  }
  /**
   * Add a system/developer message
   */
  addDeveloperMessage(text) {
    this.messages.push({
      type: "message",
      role: "developer" /* DEVELOPER */,
      content: [
        {
          type: "input_text" /* INPUT_TEXT */,
          text
        }
      ]
    });
    return this;
  }
  /**
   * Build and return the messages array
   */
  build() {
    return this.messages;
  }
  /**
   * Clear all messages
   */
  clear() {
    this.messages = [];
    return this;
  }
  /**
   * Get the current message count
   */
  count() {
    return this.messages.length;
  }
};
function createTextMessage(text, role = "user" /* USER */) {
  return {
    type: "message",
    role,
    content: [
      {
        type: "input_text" /* INPUT_TEXT */,
        text
      }
    ]
  };
}
function createMessageWithImages(text, imageUrls, role = "user" /* USER */) {
  const content = [
    {
      type: "input_text" /* INPUT_TEXT */,
      text
    }
  ];
  for (const url of imageUrls) {
    content.push({
      type: "input_image_url" /* INPUT_IMAGE_URL */,
      image_url: {
        url,
        detail: "auto"
      }
    });
  }
  return {
    type: "message",
    role,
    content
  };
}
var execAsync = promisify(exec);
function cleanupTempFile(filePath) {
  try {
    if (fs9.existsSync(filePath)) {
      fs9.unlinkSync(filePath);
    }
  } catch {
  }
}
async function readClipboardImage() {
  const platform2 = os.platform();
  try {
    switch (platform2) {
      case "darwin":
        return await readClipboardImageMac();
      case "linux":
        return await readClipboardImageLinux();
      case "win32":
        return await readClipboardImageWindows();
      default:
        return {
          success: false,
          error: `Unsupported platform: ${platform2}`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
async function readClipboardImageMac() {
  const tempFile = path3.join(os.tmpdir(), `clipboard-${Date.now()}.png`);
  try {
    try {
      await execAsync(`pngpaste "${tempFile}"`);
      return await convertFileToDataUri(tempFile);
    } catch (pngpasteError) {
      const script = `
        set theFile to (POSIX file "${tempFile}")
        try
          set theImage to the clipboard as \xABclass PNGf\xBB
          set fileRef to open for access theFile with write permission
          write theImage to fileRef
          close access fileRef
          return "success"
        on error errMsg
          try
            close access theFile
          end try
          error errMsg
        end try
      `;
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      if (stdout.includes("success") || fs9.existsSync(tempFile)) {
        return await convertFileToDataUri(tempFile);
      }
      return {
        success: false,
        error: "No image found in clipboard. Try copying an image first (Cmd+C or screenshot with Cmd+Ctrl+Shift+4)"
      };
    }
  } finally {
    cleanupTempFile(tempFile);
  }
}
async function readClipboardImageLinux() {
  const tempFile = path3.join(os.tmpdir(), `clipboard-${Date.now()}.png`);
  try {
    try {
      await execAsync(`xclip -selection clipboard -t image/png -o > "${tempFile}"`);
      if (fs9.existsSync(tempFile) && fs9.statSync(tempFile).size > 0) {
        return await convertFileToDataUri(tempFile);
      }
    } catch {
    }
    try {
      await execAsync(`wl-paste -t image/png > "${tempFile}"`);
      if (fs9.existsSync(tempFile) && fs9.statSync(tempFile).size > 0) {
        return await convertFileToDataUri(tempFile);
      }
    } catch {
    }
    return {
      success: false,
      error: "No image in clipboard. Install xclip (X11) or wl-clipboard (Wayland)"
    };
  } finally {
    cleanupTempFile(tempFile);
  }
}
async function readClipboardImageWindows() {
  const tempFile = path3.join(os.tmpdir(), `clipboard-${Date.now()}.png`);
  try {
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $clip = [System.Windows.Forms.Clipboard]::GetImage();
      if ($clip -ne $null) {
        $clip.Save('${tempFile.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png);
        Write-Output 'success';
      } else {
        Write-Error 'No image in clipboard';
      }
    `;
    await execAsync(`powershell -Command "${psScript}"`);
    if (fs9.existsSync(tempFile) && fs9.statSync(tempFile).size > 0) {
      return await convertFileToDataUri(tempFile);
    }
    return {
      success: false,
      error: "No image found in clipboard"
    };
  } finally {
    cleanupTempFile(tempFile);
  }
}
async function convertFileToDataUri(filePath) {
  try {
    const imageBuffer = fs9.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
    const magic = imageBuffer.slice(0, 4).toString("hex");
    let mimeType = "image/png";
    if (magic.startsWith("89504e47")) {
      mimeType = "image/png";
    } else if (magic.startsWith("ffd8ff")) {
      mimeType = "image/jpeg";
    } else if (magic.startsWith("47494638")) {
      mimeType = "image/gif";
    } else if (magic.startsWith("52494646")) {
      mimeType = "image/webp";
    }
    const dataUri = `data:${mimeType};base64,${base64Image}`;
    return {
      success: true,
      dataUri,
      format: mimeType
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
async function hasClipboardImage() {
  const platform2 = os.platform();
  try {
    switch (platform2) {
      case "darwin":
        const { stdout } = await execAsync('osascript -e "clipboard info"');
        return stdout.includes("\xABclass PNGf\xBB") || stdout.includes("public.png");
      case "linux":
        try {
          await execAsync("xclip -selection clipboard -t TARGETS -o | grep -q image");
          return true;
        } catch {
          return false;
        }
      case "win32":
        const psCheck = `
          Add-Type -AssemblyName System.Windows.Forms;
          if ([System.Windows.Forms.Clipboard]::GetImage() -ne $null) {
            Write-Output 'true'
          } else {
            Write-Output 'false'
          }
        `;
        const { stdout: result } = await execAsync(`powershell -Command "${psCheck}"`);
        return result.trim() === "true";
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// src/tools/index.ts
var tools_exports = {};
__export(tools_exports, {
  createExecuteJavaScriptTool: () => createExecuteJavaScriptTool,
  executeJavaScript: () => executeJavaScript,
  jsonManipulator: () => jsonManipulator,
  webFetch: () => webFetch,
  webFetchJS: () => webFetchJS,
  webSearch: () => webSearch
});

// src/tools/json/pathUtils.ts
function parsePath(path5) {
  if (path5 === "" || path5 === "$") {
    return [];
  }
  const keys = path5.split(".");
  const filtered = keys.filter((p) => p.length > 0);
  if (filtered.length !== keys.length) {
    throw new Error(`Invalid path format: ${path5} (consecutive dots not allowed)`);
  }
  return filtered;
}
function getValueAtPath(obj, path5) {
  const keys = parsePath(path5);
  let current = obj;
  for (const key of keys) {
    if (current === null || current === void 0) {
      return void 0;
    }
    current = current[key];
  }
  return current;
}
function setValueAtPath(obj, path5, value) {
  const keys = parsePath(path5);
  if (keys.length === 0) {
    throw new Error("Cannot set root object - path must not be empty");
  }
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || current[key] === null || current[key] === void 0) {
      const nextKey = keys[i + 1];
      const isArrayIndex = nextKey !== void 0 && /^\d+$/.test(nextKey);
      current[key] = isArrayIndex ? [] : {};
    }
    current = current[key];
    if (current === null || current === void 0) {
      throw new Error(`Cannot navigate through null/undefined at path: ${keys.slice(0, i + 1).join(".")}`);
    }
  }
  const lastKey = keys[keys.length - 1];
  if (Array.isArray(current)) {
    const index = parseInt(lastKey);
    if (isNaN(index)) {
      throw new Error(`Array index must be numeric, got: ${lastKey}`);
    }
    current[index] = value;
  } else {
    current[lastKey] = value;
  }
  return true;
}
function deleteAtPath(obj, path5) {
  const keys = parsePath(path5);
  if (keys.length === 0) {
    throw new Error("Cannot delete root object - path must not be empty");
  }
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      return false;
    }
    current = current[key];
    if (current === null || current === void 0) {
      return false;
    }
  }
  const lastKey = keys[keys.length - 1];
  if (!(lastKey in current)) {
    return false;
  }
  if (Array.isArray(current)) {
    const index = parseInt(lastKey);
    if (isNaN(index) || index < 0 || index >= current.length) {
      return false;
    }
    current.splice(index, 1);
  } else {
    delete current[lastKey];
  }
  return true;
}
function pathExists(obj, path5) {
  try {
    const value = getValueAtPath(obj, path5);
    return value !== void 0;
  } catch {
    return false;
  }
}

// src/tools/json/jsonManipulator.ts
var jsonManipulator = {
  definition: {
    type: "function",
    function: {
      name: "json_manipulate",
      description: `Manipulate JSON objects by deleting, adding, or replacing fields at any depth.

IMPORTANT - PATH FORMAT (DOT NOTATION):
Use dots to separate nested field names. Examples:
\u2022 Top-level field: "name"
\u2022 Nested field: "user.email"
\u2022 Array element: "users.0.name" (where 0 is the array index)
\u2022 Deep nesting: "settings.theme.colors.primary"
\u2022 For root operations: use empty string ""

OPERATIONS:

1. DELETE - Remove a field from the object
   \u2022 Removes the specified field and its value
   \u2022 Returns error if path doesn't exist
   \u2022 Example: operation="delete", path="user.address.city"
   \u2022 Result: The city field is removed from user.address

2. ADD - Add a new field to the object
   \u2022 Creates intermediate objects/arrays if they don't exist
   \u2022 If field already exists, it will be overwritten
   \u2022 Example: operation="add", path="user.phone", value="+1234567890"
   \u2022 Result: Creates user.phone field with the phone number

3. REPLACE - Replace the value of an EXISTING field
   \u2022 Only works if the field already exists (use ADD for new fields)
   \u2022 Returns error if path doesn't exist
   \u2022 Example: operation="replace", path="user.name", value="Jane Doe"
   \u2022 Result: Changes the existing user.name value

ARRAY OPERATIONS:
\u2022 Access array elements by index: "users.0.name" (first user's name)
\u2022 Add to array: "users.2" appends if index >= array length
\u2022 Delete from array: "users.1" removes element and shifts remaining items

COMPLETE EXAMPLES:

Example 1 - Delete a field:
  Input: { operation: "delete", path: "user.email", object: {user: {name: "John", email: "j@ex.com"}} }
  Output: {user: {name: "John"}}

Example 2 - Add nested field (auto-creates intermediate objects):
  Input: { operation: "add", path: "user.address.city", value: "Paris", object: {user: {name: "John"}} }
  Output: {user: {name: "John", address: {city: "Paris"}}}

Example 3 - Replace value:
  Input: { operation: "replace", path: "settings.theme", value: "dark", object: {settings: {theme: "light"}} }
  Output: {settings: {theme: "dark"}}

Example 4 - Array manipulation:
  Input: { operation: "replace", path: "users.0.active", value: false, object: {users: [{name: "Bob", active: true}]} }
  Output: {users: [{name: "Bob", active: false}]}

The tool returns a result object with:
\u2022 success: boolean (true if operation succeeded)
\u2022 result: the modified JSON object (or null if failed)
\u2022 message: success message (if succeeded)
\u2022 error: error description (if failed)`,
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["delete", "add", "replace"],
            description: 'The operation to perform. "delete" removes a field, "add" creates a new field (or overwrites existing), "replace" changes an existing field value.'
          },
          path: {
            type: "string",
            description: 'Dot notation path to the field. Examples: "name", "user.email", "users.0.name", "settings.theme.colors.primary". Use empty string "" only for root-level operations.'
          },
          value: {
            description: "The value to add or replace. Can be any JSON-compatible type: string, number, boolean, object, array, or null. Required for add/replace operations, ignored for delete."
          },
          object: {
            type: "object",
            description: "The JSON object to manipulate. The original object is not modified; a new modified copy is returned in the result."
          }
        },
        required: ["operation", "path", "object"]
      }
    },
    blocking: true,
    // Always wait for result
    timeout: 1e4
    // 10 seconds should be plenty for JSON operations
  },
  execute: async (args) => {
    try {
      if (!["delete", "add", "replace"].includes(args.operation)) {
        return {
          success: false,
          result: null,
          error: `Invalid operation: "${args.operation}". Must be "delete", "add", or "replace".`
        };
      }
      if (!args.object || typeof args.object !== "object") {
        return {
          success: false,
          result: null,
          error: "Invalid object: must provide a valid JSON object"
        };
      }
      let clonedObject;
      try {
        clonedObject = JSON.parse(JSON.stringify(args.object));
      } catch (error) {
        return {
          success: false,
          result: null,
          error: `Cannot clone object: ${error.message}. Object may contain circular references or non-JSON values.`
        };
      }
      switch (args.operation) {
        case "delete": {
          try {
            const deleted = deleteAtPath(clonedObject, args.path);
            if (!deleted) {
              return {
                success: false,
                result: null,
                error: `Path not found: "${args.path}". The field does not exist in the object.`
              };
            }
            return {
              success: true,
              result: clonedObject,
              message: `Successfully deleted field at path: "${args.path}"`
            };
          } catch (error) {
            return {
              success: false,
              result: null,
              error: `Delete operation failed: ${error.message}`
            };
          }
        }
        case "add": {
          if (args.value === void 0) {
            return {
              success: false,
              result: null,
              error: 'Add operation requires a "value" parameter'
            };
          }
          try {
            setValueAtPath(clonedObject, args.path, args.value);
            return {
              success: true,
              result: clonedObject,
              message: `Successfully added field at path: "${args.path}"`
            };
          } catch (error) {
            return {
              success: false,
              result: null,
              error: `Add operation failed: ${error.message}`
            };
          }
        }
        case "replace": {
          if (args.value === void 0) {
            return {
              success: false,
              result: null,
              error: 'Replace operation requires a "value" parameter'
            };
          }
          if (!pathExists(clonedObject, args.path)) {
            return {
              success: false,
              result: null,
              error: `Path not found: "${args.path}". Use "add" operation to create new fields.`
            };
          }
          try {
            setValueAtPath(clonedObject, args.path, args.value);
            return {
              success: true,
              result: clonedObject,
              message: `Successfully replaced value at path: "${args.path}"`
            };
          } catch (error) {
            return {
              success: false,
              result: null,
              error: `Replace operation failed: ${error.message}`
            };
          }
        }
        default:
          return {
            success: false,
            result: null,
            error: `Unknown operation: ${args.operation}`
          };
      }
    } catch (error) {
      return {
        success: false,
        result: null,
        error: `Unexpected error manipulating JSON: ${error.message}`
      };
    }
  }
};

// src/tools/web/contentDetector.ts
function detectContentQuality(html, text, $) {
  const issues = [];
  let score = 100;
  let requiresJS = false;
  if (text.length < 100) {
    issues.push("Very little text content extracted");
    score -= 40;
    requiresJS = true;
  }
  const errorPatterns = [
    { pattern: /access denied/i, penalty: 50 },
    { pattern: /403 forbidden/i, penalty: 50 },
    { pattern: /404 not found/i, penalty: 50 },
    { pattern: /page not found/i, penalty: 40 },
    { pattern: /cloudflare/i, penalty: 30 },
    { pattern: /please enable javascript/i, penalty: 40 },
    { pattern: /requires javascript/i, penalty: 40 },
    { pattern: /robot|bot detection/i, penalty: 30 }
  ];
  for (const { pattern, penalty } of errorPatterns) {
    if (pattern.test(html) || pattern.test(text)) {
      issues.push(`Error pattern detected: ${pattern.source}`);
      score -= penalty;
    }
  }
  const scriptCount = $("script").length;
  const textLength = text.length;
  if (scriptCount > 10 && textLength < 500) {
    issues.push("Page is mostly JavaScript code (code dump)");
    score -= 40;
    requiresJS = true;
  }
  const scriptLength = $("script").text().length;
  if (scriptLength > textLength * 2 && textLength < 1e3) {
    issues.push("High JavaScript-to-content ratio");
    score -= 20;
    requiresJS = true;
  }
  const jsFrameworks = [
    { pattern: /\breact\b/i, name: "React" },
    { pattern: /\bvue\b/i, name: "Vue" },
    { pattern: /\bangular\b/i, name: "Angular" },
    { pattern: /__NEXT_DATA__/i, name: "Next.js" },
    { pattern: /\bwebpack\b/i, name: "Webpack" },
    { pattern: /_app-.*\.js/i, name: "SPA" }
  ];
  for (const framework of jsFrameworks) {
    if (framework.pattern.test(html)) {
      issues.push(`${framework.name} framework detected`);
      requiresJS = true;
    }
  }
  const bodyText = $("body").text().trim();
  const divCount = $("div").length;
  if (bodyText.length < 100 && divCount > 5) {
    issues.push("Empty body with many divs (likely Single Page App)");
    score -= 30;
    requiresJS = true;
  }
  const noscript = $("noscript").text();
  if (noscript.length > 50) {
    issues.push("Noscript tag present (site requires JavaScript)");
    requiresJS = true;
  }
  const paragraphCount = $("p").length;
  const headingCount = $("h1, h2, h3, h4, h5, h6").length;
  if (paragraphCount < 3 && headingCount < 2 && textLength < 500) {
    issues.push("Very few content elements (likely needs JavaScript)");
    score -= 20;
    requiresJS = true;
  }
  let suggestion;
  if (requiresJS && score < 50) {
    suggestion = "Content quality is low. This appears to be a JavaScript-rendered site. Use the web_fetch_js tool for better results.";
  } else if (score < 30) {
    suggestion = "Content extraction failed or page has errors. Check the URL and try again.";
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    requiresJS,
    suggestion,
    issues
  };
}
function extractCleanText($) {
  $("script, style, noscript, iframe, nav, footer, header, aside").remove();
  $('[class*="ad-"], [class*="advertisement"], [id*="ad-"]').remove();
  $('[class*="cookie"], [class*="gdpr"]').remove();
  const mainSelectors = [
    "main",
    "article",
    '[role="main"]',
    ".content",
    "#content",
    ".post",
    ".article"
  ];
  for (const selector of mainSelectors) {
    const mainContent = $(selector).text().trim();
    if (mainContent.length > 200) {
      return mainContent;
    }
  }
  return $("body").text().trim();
}

// src/tools/web/webFetch.ts
var webFetch = {
  definition: {
    type: "function",
    function: {
      name: "web_fetch",
      description: `Fetch and extract text content from a web page URL.

IMPORTANT: This tool performs a simple HTTP fetch and HTML parsing. It works well for:
- Static websites (blogs, documentation, articles)
- Server-rendered HTML pages
- Content that doesn't require JavaScript

LIMITATIONS:
- Cannot execute JavaScript
- May fail on React/Vue/Angular sites (will return low quality score)
- May get blocked by bot protection
- Cannot handle dynamic content loading

QUALITY DETECTION:
The tool analyzes the fetched content and returns a quality score (0-100):
- 80-100: Excellent quality, content extracted successfully
- 50-79: Moderate quality, some content extracted
- 0-49: Low quality, likely needs JavaScript or has errors

If the quality score is low or requiresJS is true, the tool will suggest using 'web_fetch_js' instead.

RETURNS:
{
  success: boolean,
  url: string,
  title: string,
  content: string,          // Extracted text (clean, no scripts/styles)
  html: string,             // Raw HTML
  contentType: string,      // 'html' | 'json' | 'text' | 'error'
  qualityScore: number,     // 0-100 (quality of extraction)
  requiresJS: boolean,      // True if site likely needs JavaScript
  suggestedAction: string,  // Suggestion if quality is low
  issues: string[],         // List of detected issues
  error: string             // Error message if failed
}

EXAMPLE:
To fetch a blog post:
{
  url: "https://example.com/blog/article"
}

With custom user agent:
{
  url: "https://example.com/page",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
  timeout: 15000
}`,
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch. Must start with http:// or https://"
          },
          userAgent: {
            type: "string",
            description: "Optional custom user agent string. Default is a generic bot user agent."
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 10000)"
          }
        },
        required: ["url"]
      }
    },
    blocking: true,
    timeout: 15e3
  },
  execute: async (args) => {
    try {
      try {
        new URL(args.url);
      } catch {
        return {
          success: false,
          url: args.url,
          title: "",
          content: "",
          html: "",
          contentType: "error",
          qualityScore: 0,
          requiresJS: false,
          error: "Invalid URL format"
        };
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), args.timeout || 1e4);
      const response = await fetch(args.url, {
        headers: {
          "User-Agent": args.userAgent || "Mozilla/5.0 (compatible; OneRingAI/1.0; +https://github.com/oneringai/agents)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        return {
          success: false,
          url: args.url,
          title: "",
          content: "",
          html: "",
          contentType: "error",
          qualityScore: 0,
          requiresJS: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await response.json();
        return {
          success: true,
          url: args.url,
          title: "JSON Response",
          content: JSON.stringify(json, null, 2),
          html: "",
          contentType: "json",
          qualityScore: 100,
          requiresJS: false
        };
      }
      if (contentType.includes("text/plain")) {
        const text = await response.text();
        return {
          success: true,
          url: args.url,
          title: "Text Response",
          content: text,
          html: text,
          contentType: "text",
          qualityScore: 100,
          requiresJS: false
        };
      }
      const html = await response.text();
      const $ = load(html);
      const title = $("title").text() || $("h1").first().text() || "Untitled";
      const content = extractCleanText($);
      const quality = detectContentQuality(html, content, $);
      return {
        success: true,
        url: args.url,
        title,
        content,
        html,
        contentType: "html",
        qualityScore: quality.score,
        requiresJS: quality.requiresJS,
        suggestedAction: quality.suggestion,
        issues: quality.issues
      };
    } catch (error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          url: args.url,
          title: "",
          content: "",
          html: "",
          contentType: "error",
          qualityScore: 0,
          requiresJS: false,
          error: `Request timeout after ${args.timeout || 1e4}ms`
        };
      }
      return {
        success: false,
        url: args.url,
        title: "",
        content: "",
        html: "",
        contentType: "error",
        qualityScore: 0,
        requiresJS: false,
        error: error.message
      };
    }
  }
};
var puppeteerModule = null;
var browserInstance = null;
async function loadPuppeteer() {
  if (!puppeteerModule) {
    try {
      puppeteerModule = await import('puppeteer');
    } catch (error) {
      throw new Error("Puppeteer not installed");
    }
  }
  return puppeteerModule;
}
async function getBrowser() {
  if (!browserInstance) {
    const puppeteer = await loadPuppeteer();
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    process.on("exit", async () => {
      if (browserInstance) {
        await browserInstance.close();
      }
    });
  }
  return browserInstance;
}
var webFetchJS = {
  definition: {
    type: "function",
    function: {
      name: "web_fetch_js",
      description: `Fetch and extract content from JavaScript-rendered websites using a headless browser (Puppeteer).

USE THIS TOOL WHEN:
- The web_fetch tool returned a low quality score (<50)
- The web_fetch tool suggested using JavaScript rendering
- You know the website is built with React/Vue/Angular/Next.js
- Content loads dynamically via JavaScript
- The page requires interaction (though this tool doesn't support interaction yet)

HOW IT WORKS:
- Launches a headless Chrome browser
- Navigates to the URL
- Waits for JavaScript to execute and content to load
- Extracts the rendered HTML and text content
- Optionally captures a screenshot

CAPABILITIES:
- Executes all JavaScript on the page
- Waits for network to be idle (all resources loaded)
- Can wait for specific CSS selectors to appear
- Handles React, Vue, Angular, Next.js, and other SPAs
- Returns content after full JavaScript execution

LIMITATIONS:
- Slower than web_fetch (typically 3-10 seconds vs <1 second)
- Uses more system resources (runs a full browser)
- May still fail on sites with aggressive bot detection
- Requires puppeteer to be installed (npm install puppeteer)

PERFORMANCE:
- First call: Slower (launches browser ~1-2s)
- Subsequent calls: Faster (reuses browser instance)

RETURNS:
{
  success: boolean,
  url: string,
  title: string,
  content: string,         // Extracted text after JS execution
  html: string,            // Full HTML after JS execution
  screenshot: string,      // Base64 PNG screenshot (if requested)
  loadTime: number,        // Time taken in milliseconds
  error: string           // Error message if failed
}

EXAMPLES:
Basic usage:
{
  url: "https://react-app.com/page"
}

Wait for specific content:
{
  url: "https://app.com/dashboard",
  waitForSelector: "#main-content",  // Wait for this element
  timeout: 20000
}

With screenshot:
{
  url: "https://site.com",
  takeScreenshot: true
}`,
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to fetch. Must start with http:// or https://"
          },
          waitForSelector: {
            type: "string",
            description: 'Optional CSS selector to wait for before extracting content. Example: "#main-content" or ".article-body"'
          },
          timeout: {
            type: "number",
            description: "Max wait time in milliseconds (default: 15000)"
          },
          takeScreenshot: {
            type: "boolean",
            description: "Whether to capture a screenshot of the page (default: false). Screenshot returned as base64 PNG."
          }
        },
        required: ["url"]
      }
    },
    blocking: true,
    timeout: 3e4
    // Allow extra time for browser operations
  },
  execute: async (args) => {
    let page = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      const startTime = Date.now();
      await page.goto(args.url, {
        waitUntil: "networkidle2",
        // Wait until network is mostly idle
        timeout: args.timeout || 15e3
      });
      if (args.waitForSelector) {
        await page.waitForSelector(args.waitForSelector, {
          timeout: args.timeout || 15e3
        });
      }
      const html = await page.content();
      const $ = load(html);
      $("script, style, noscript, iframe, nav, footer, header, aside").remove();
      const content = $("body").text().trim();
      const title = await page.title();
      const loadTime = Date.now() - startTime;
      let screenshot;
      if (args.takeScreenshot) {
        const buffer = await page.screenshot({
          type: "png",
          fullPage: false
          // Just viewport
        });
        screenshot = buffer.toString("base64");
      }
      await page.close();
      return {
        success: true,
        url: args.url,
        title,
        content,
        html,
        screenshot,
        loadTime
      };
    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch {
        }
      }
      if (error.message === "Puppeteer not installed") {
        return {
          success: false,
          url: args.url,
          title: "",
          content: "",
          html: "",
          loadTime: 0,
          error: "Puppeteer is not installed",
          suggestion: "Install Puppeteer with: npm install puppeteer (note: downloads ~50MB Chrome binary)"
        };
      }
      return {
        success: false,
        url: args.url,
        title: "",
        content: "",
        html: "",
        loadTime: 0,
        error: error.message
      };
    }
  }
};

// src/tools/web/searchProviders/serper.ts
async function searchWithSerper(query, numResults, apiKey) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      q: query,
      num: numResults
    })
  });
  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.organic || !Array.isArray(data.organic)) {
    throw new Error("Invalid response from Serper API");
  }
  return data.organic.slice(0, numResults).map((result, index) => ({
    title: result.title || "Untitled",
    url: result.link || "",
    snippet: result.snippet || "",
    position: index + 1
  }));
}

// src/tools/web/searchProviders/brave.ts
async function searchWithBrave(query, numResults, apiKey) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${numResults}`;
  const response = await fetch(url, {
    headers: {
      "X-Subscription-Token": apiKey,
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.web?.results || !Array.isArray(data.web.results)) {
    throw new Error("Invalid response from Brave API");
  }
  return data.web.results.slice(0, numResults).map((result, index) => ({
    title: result.title || "Untitled",
    url: result.url || "",
    snippet: result.description || "",
    position: index + 1
  }));
}

// src/tools/web/searchProviders/tavily.ts
async function searchWithTavily(query, numResults, apiKey) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: numResults,
      search_depth: "basic",
      // 'basic' or 'advanced'
      include_answer: false,
      include_raw_content: false
    })
  });
  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.results || !Array.isArray(data.results)) {
    throw new Error("Invalid response from Tavily API");
  }
  return data.results.slice(0, numResults).map((result, index) => ({
    title: result.title || "Untitled",
    url: result.url || "",
    snippet: result.content || "",
    position: index + 1
  }));
}

// src/tools/web/webSearch.ts
var webSearch = {
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description: `Search the web and get relevant results with snippets.

This tool searches the web using a configured search provider.

SEARCH PROVIDERS:
- serper (default): Google search results via Serper.dev API. Fast (1-2s), 2,500 free queries.
- brave: Brave's independent search index. Privacy-focused, no Google.
- tavily: AI-optimized search with summaries tailored for LLMs.

RETURNS:
An array of up to 10-20 search results, each containing:
- title: Page title
- url: Direct URL to the page
- snippet: Short description/excerpt from the page
- position: Search ranking position (1, 2, 3...)

USE CASES:
- Find current information on any topic
- Research multiple sources
- Discover relevant websites
- Get different perspectives on a topic
- Find URLs to fetch with web_fetch tool

WORKFLOW PATTERN:
1. Use web_search to find relevant URLs
2. Use web_fetch to get full content from top results
3. Process and summarize the information

EXAMPLE:
Basic search:
{
  query: "latest AI developments 2026",
  numResults: 5
}

With specific provider:
{
  query: "quantum computing news",
  numResults: 10,
  provider: "brave"
}

IMPORTANT:
- Requires API key to be set in environment variables
- Default provider is "serper" (requires SERPER_API_KEY)
- Returns empty results if API key not found`,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query string. Be specific for better results."
          },
          numResults: {
            type: "number",
            description: "Number of results to return (default: 10, max: 20). More results = more API cost."
          },
          provider: {
            type: "string",
            enum: ["serper", "brave", "tavily"],
            description: 'Which search provider to use. Default is "serper". Each provider requires its own API key.'
          }
        },
        required: ["query"]
      }
    },
    blocking: true,
    timeout: 1e4
  },
  execute: async (args) => {
    const provider = args.provider || "serper";
    const numResults = Math.min(args.numResults || 10, 20);
    const apiKey = getSearchAPIKey(provider);
    if (!apiKey) {
      return {
        success: false,
        query: args.query,
        provider,
        results: [],
        count: 0,
        error: `No API key found for ${provider}. Set ${getEnvVarName(provider)} in your .env file. See .env.example for details.`
      };
    }
    try {
      let results;
      switch (provider) {
        case "serper":
          results = await searchWithSerper(args.query, numResults, apiKey);
          break;
        case "brave":
          results = await searchWithBrave(args.query, numResults, apiKey);
          break;
        case "tavily":
          results = await searchWithTavily(args.query, numResults, apiKey);
          break;
        default:
          throw new Error(`Unknown search provider: ${provider}`);
      }
      return {
        success: true,
        query: args.query,
        provider,
        results,
        count: results.length
      };
    } catch (error) {
      return {
        success: false,
        query: args.query,
        provider,
        results: [],
        count: 0,
        error: error.message
      };
    }
  }
};
function getSearchAPIKey(provider) {
  switch (provider) {
    case "serper":
      return process.env.SERPER_API_KEY;
    case "brave":
      return process.env.BRAVE_API_KEY;
    case "tavily":
      return process.env.TAVILY_API_KEY;
    default:
      return void 0;
  }
}
function getEnvVarName(provider) {
  switch (provider) {
    case "serper":
      return "SERPER_API_KEY";
    case "brave":
      return "BRAVE_API_KEY";
    case "tavily":
      return "TAVILY_API_KEY";
    default:
      return "UNKNOWN_API_KEY";
  }
}
function generateDescription() {
  const connectors = Connector.listAll();
  const connectorList = connectors.length > 0 ? connectors.map((c) => `   \u2022 "${c.name}": ${c.displayName}
     ${c.config.description || "No description"}
     Base URL: ${c.baseURL}`).join("\n\n") : "   No connectors registered yet. Register connectors with Connector.create().";
  return `Execute JavaScript code in a secure sandbox with connector integration.

IMPORTANT: This tool runs JavaScript code in a sandboxed environment with authenticated access to external APIs via connectors.

AVAILABLE IN CONTEXT:

1. INPUT/OUTPUT:
   - input: any data passed to your code
   - output: SET THIS variable to return your result

2. AUTHENTICATED FETCH:
   - authenticatedFetch(url, options, connector, userId?)
     \u2022 url: Full URL or path
     \u2022 options: Standard fetch options { method: 'GET'|'POST'|..., body: ..., headers: ... }
     \u2022 connector: Connector name (see below)
     \u2022 userId: (optional) User identifier for multi-user apps
     \u2022 Returns: Promise<Response>

   REGISTERED CONNECTORS:
${connectorList}

3. STANDARD FETCH:
   - fetch(url, options) - No authentication

4. CONNECTOR REGISTRY:
   - connectors.list() - List available connectors
   - connectors.get(name) - Get connector details

5. UTILITIES:
   - console.log/error/warn
   - Buffer, JSON, Math, Date
   - setTimeout, setInterval, Promise

CODE PATTERN:
Always wrap your code in an async IIFE:

(async () => {
  // Your code here

  // Single-user mode (default)
  const response = await authenticatedFetch(url, options, 'github');

  // OR Multi-user mode (if your app has multiple users)
  const response = await authenticatedFetch(url, options, 'github', userId);

  const data = await response.json();
  output = data;
})();

SECURITY:
- 10 second timeout (configurable)
- No file system access
- No process/child_process
- No require/import
- Memory limited

RETURNS:
{
  success: boolean,
  result: any,
  logs: string[],
  error?: string,
  executionTime: number
}`;
}
function createExecuteJavaScriptTool() {
  return {
    definition: {
      type: "function",
      function: {
        name: "execute_javascript",
        description: generateDescription(),
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: 'JavaScript code to execute. MUST set the "output" variable. Wrap in async IIFE for async operations.'
            },
            input: {
              description: 'Optional input data available as "input" variable in your code'
            },
            timeout: {
              type: "number",
              description: "Execution timeout in milliseconds (default: 10000, max: 30000)"
            }
          },
          required: ["code"]
        }
      },
      blocking: true,
      timeout: 35e3
      // Tool timeout (slightly more than max code timeout)
    },
    execute: async (args) => {
      const logs = [];
      const startTime = Date.now();
      try {
        const timeout = Math.min(args.timeout || 1e4, 3e4);
        const result = await executeInVM(args.code, args.input, timeout, logs);
        return {
          success: true,
          result,
          logs,
          executionTime: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          result: null,
          logs,
          error: error.message,
          executionTime: Date.now() - startTime
        };
      }
    }
  };
}
var executeJavaScript = createExecuteJavaScriptTool();
async function executeInVM(code, input, timeout, logs) {
  const sandbox = {
    // Input/output
    input: input || {},
    output: null,
    // Console (captured)
    console: {
      log: (...args) => logs.push(args.map((a) => String(a)).join(" ")),
      error: (...args) => logs.push("ERROR: " + args.map((a) => String(a)).join(" ")),
      warn: (...args) => logs.push("WARN: " + args.map((a) => String(a)).join(" "))
    },
    // Authenticated fetch
    authenticatedFetch,
    // Standard fetch
    fetch: globalThis.fetch,
    // Connector info
    connectors: {
      list: () => Connector.list(),
      get: (name) => {
        try {
          const connector = Connector.get(name);
          return {
            displayName: connector.displayName,
            description: connector.config.description || "",
            baseURL: connector.baseURL
          };
        } catch {
          return null;
        }
      }
    },
    // Standard globals
    Buffer,
    JSON,
    Math,
    Date,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    Promise,
    // Array/Object
    Array,
    Object,
    String,
    Number,
    Boolean
  };
  const context = vm.createContext(sandbox);
  const wrappedCode = code.trim().startsWith("(async") ? code : `
    (async () => {
      ${code}
      return output;
    })()
  `;
  const script = new vm.Script(wrappedCode);
  const resultPromise = script.runInContext(context, {
    timeout,
    displayErrors: true
  });
  const result = await resultPromise;
  return result;
}

// src/agents/ProviderConfigAgent.ts
var ProviderConfigAgent = class {
  agent = null;
  conversationHistory = [];
  connectorName;
  /**
   * Create a provider config agent
   * @param connectorName - Name of the connector to use (must be created first with Connector.create())
   */
  constructor(connectorName = "openai") {
    this.connectorName = connectorName;
  }
  /**
   * Start interactive configuration session
   * AI will ask questions and generate the connector config
   *
   * @param initialInput - Optional initial message (e.g., "I want to connect to GitHub")
   * @returns Promise<string | ConnectorConfigResult> - Either next question or final config
   */
  async run(initialInput) {
    this.agent = Agent.create({
      connector: this.connectorName,
      model: this.getDefaultModel(),
      instructions: this.getSystemInstructions(),
      temperature: 0.1,
      // Very low temperature for consistent, focused behavior
      maxIterations: 10
    });
    const builder = new MessageBuilder();
    const startMessage = initialInput || "I want to configure an OAuth provider";
    builder.addUserMessage(startMessage);
    this.conversationHistory.push(...builder.build());
    const response = await this.agent.run(this.conversationHistory);
    this.conversationHistory.push(...response.output.filter(
      (item) => item.type === "message" || item.type === "compaction"
    ));
    const responseText = response.output_text || "";
    if (responseText.includes("===CONFIG_START===")) {
      return this.extractConfig(responseText);
    }
    return responseText;
  }
  /**
   * Continue conversation (for multi-turn interaction)
   *
   * @param userMessage - User's response
   * @returns Promise<string | ConnectorConfigResult> - Either next question or final config
   */
  async continue(userMessage) {
    if (!this.agent) {
      throw new Error("Agent not initialized. Call run() first.");
    }
    const builder = new MessageBuilder();
    builder.addUserMessage(userMessage);
    this.conversationHistory.push(...builder.build());
    const response = await this.agent.run(this.conversationHistory);
    this.conversationHistory.push(...response.output.filter(
      (item) => item.type === "message" || item.type === "compaction"
    ));
    const responseText = response.output_text || "";
    if (responseText.includes("===CONFIG_START===")) {
      return this.extractConfig(responseText);
    }
    return responseText;
  }
  /**
   * Get system instructions for the agent
   */
  getSystemInstructions() {
    return `You are a friendly OAuth Setup Assistant. Your ONLY job is to help users connect their apps to third-party services like Microsoft, Google, GitHub, etc.

YOU MUST NOT answer general questions. ONLY focus on helping set up API connections.

YOUR PROCESS (use NON-TECHNICAL, FRIENDLY language):

1. Ask which system they want to connect to (e.g., Microsoft, Google, GitHub, Salesforce, Slack)

2. Ask about HOW they want to use it (use SIMPLE language):
   - "Will your users log in with their [Provider] accounts?" \u2192 authorization_code
   - "Does your app need to access [Provider] without users logging in?" \u2192 client_credentials
   - "Is this just an API key from [Provider]?" \u2192 static_token

3. Ask BUSINESS questions about what they want to do (then YOU figure out the technical scopes):

   For Microsoft:
   - "Do you need to read user profiles?" \u2192 User.Read
   - "Do you need to read emails?" \u2192 Mail.Read
   - "Do you need to access calendar?" \u2192 Calendars.Read
   - "Do you need to read/write SharePoint files?" \u2192 Sites.Read.All or Sites.ReadWrite.All
   - "Do you need to access Teams?" \u2192 Team.ReadBasic.All
   - Combine multiple scopes if needed

   For Google:
   - "Do you need to read emails?" \u2192 https://www.googleapis.com/auth/gmail.readonly
   - "Do you need to access Google Drive?" \u2192 https://www.googleapis.com/auth/drive
   - "Do you need calendar access?" \u2192 https://www.googleapis.com/auth/calendar

   For GitHub:
   - "Do you need to read user info?" \u2192 user:email
   - "Do you need to access repositories?" \u2192 repo
   - "Do you need to read organization data?" \u2192 read:org

   For Salesforce:
   - "Do you need full access?" \u2192 full
   - "Do you need to access/manage data?" \u2192 api
   - "Do you need refresh tokens?" \u2192 refresh_token offline_access

4. DO NOT ask about redirect URI - it will be configured in code (use "http://localhost:3000/callback" as default)

5. Generate complete JSON configuration

CRITICAL RULES:
- Ask ONE simple question at a time
- Use BUSINESS language, NOT technical OAuth terms
- Ask "What do you want to do?" NOT "What scopes do you need?"
- YOU translate business needs into technical scopes
- Be friendly and conversational
- Provide specific setup URLs (e.g., https://portal.azure.com for Microsoft, https://github.com/settings/developers for GitHub)
- When you have all info, IMMEDIATELY output the config in this EXACT format:

===CONFIG_START===
{
  "name": "github",
  "config": {
    "displayName": "GitHub API",
    "description": "Access GitHub repositories and user data",
    "baseURL": "https://api.github.com",
    "auth": {
      "type": "oauth",
      "flow": "authorization_code",
      "clientId": "ENV:GITHUB_CLIENT_ID",
      "clientSecret": "ENV:GITHUB_CLIENT_SECRET",
      "authorizationUrl": "https://github.com/login/oauth/authorize",
      "tokenUrl": "https://github.com/login/oauth/access_token",
      "redirectUri": "http://localhost:3000/callback",
      "scope": "user:email repo"
    }
  },
  "setupInstructions": "1. Go to https://github.com/settings/developers\\n2. Create New OAuth App\\n3. Set Authorization callback URL\\n4. Copy Client ID and Client Secret",
  "envVariables": ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  "setupUrl": "https://github.com/settings/developers"
}
===CONFIG_END===

Use "ENV:VARIABLE_NAME" for values that should come from environment variables.

REMEMBER: Keep it conversational, ask one question at a time, and only output the config when you have all necessary information.`;
  }
  /**
   * Extract configuration from AI response
   */
  extractConfig(responseText) {
    const configMatch = responseText.match(/===CONFIG_START===\s*([\s\S]*?)\s*===CONFIG_END===/);
    if (!configMatch) {
      throw new Error("No configuration found in response. The AI may need more information.");
    }
    try {
      const configJson = configMatch[1].trim();
      const config = JSON.parse(configJson);
      return config;
    } catch (error) {
      throw new Error(`Failed to parse configuration JSON: ${error.message}`);
    }
  }
  /**
   * Get default model
   */
  getDefaultModel() {
    return "gpt-4.1";
  }
  /**
   * Reset conversation
   */
  reset() {
    this.conversationHistory = [];
    this.agent = null;
  }
};
init_Memory();
var ModeManager = class extends EventEmitter$1 {
  state;
  transitionHistory = [];
  constructor(initialMode = "interactive") {
    super();
    this.state = {
      mode: initialMode,
      enteredAt: /* @__PURE__ */ new Date(),
      reason: "initial"
    };
  }
  /**
   * Get current mode
   */
  getMode() {
    return this.state.mode;
  }
  /**
   * Get full mode state
   */
  getState() {
    return { ...this.state };
  }
  /**
   * Check if a transition is allowed
   */
  canTransition(to) {
    const from = this.state.mode;
    const validTransitions = {
      "interactive": ["planning", "executing"],
      "planning": ["interactive", "executing"],
      "executing": ["interactive", "planning"]
    };
    return validTransitions[from].includes(to);
  }
  /**
   * Transition to a new mode
   */
  transition(to, reason) {
    const from = this.state.mode;
    if (!this.canTransition(to)) {
      this.emit("mode:transition_blocked", { from, to, reason });
      return false;
    }
    this.transitionHistory.push({ from, to, at: /* @__PURE__ */ new Date(), reason });
    this.state = {
      mode: to,
      enteredAt: /* @__PURE__ */ new Date(),
      reason,
      // Clear mode-specific state on transition
      pendingPlan: to === "planning" ? this.state.pendingPlan : void 0,
      planApproved: to === "executing" ? true : void 0,
      currentTaskIndex: to === "executing" ? 0 : void 0
    };
    this.emit("mode:changed", { from, to, reason });
    return true;
  }
  /**
   * Enter planning mode with a goal
   */
  enterPlanning(reason = "user_request") {
    return this.transition("planning", reason);
  }
  /**
   * Enter executing mode (plan must be approved)
   */
  enterExecuting(_plan, reason = "plan_approved") {
    if (this.state.mode === "planning" && !this.state.planApproved) {
      this.state.planApproved = true;
    }
    const success = this.transition("executing", reason);
    if (success) {
      this.state.currentTaskIndex = 0;
    }
    return success;
  }
  /**
   * Return to interactive mode
   */
  returnToInteractive(reason = "completed") {
    return this.transition("interactive", reason);
  }
  /**
   * Set pending plan (in planning mode)
   */
  setPendingPlan(plan) {
    this.state.pendingPlan = plan;
    this.state.planApproved = false;
  }
  /**
   * Get pending plan
   */
  getPendingPlan() {
    return this.state.pendingPlan;
  }
  /**
   * Approve the pending plan
   */
  approvePlan() {
    if (this.state.mode !== "planning" || !this.state.pendingPlan) {
      return false;
    }
    this.state.planApproved = true;
    return true;
  }
  /**
   * Check if plan is approved
   */
  isPlanApproved() {
    return this.state.planApproved ?? false;
  }
  /**
   * Update current task index (in executing mode)
   */
  setCurrentTaskIndex(index) {
    if (this.state.mode === "executing") {
      this.state.currentTaskIndex = index;
    }
  }
  /**
   * Get current task index
   */
  getCurrentTaskIndex() {
    return this.state.currentTaskIndex ?? 0;
  }
  /**
   * Pause execution
   */
  pauseExecution(reason) {
    if (this.state.mode === "executing") {
      this.state.pausedAt = /* @__PURE__ */ new Date();
      this.state.pauseReason = reason;
    }
  }
  /**
   * Resume execution
   */
  resumeExecution() {
    if (this.state.mode === "executing") {
      this.state.pausedAt = void 0;
      this.state.pauseReason = void 0;
    }
  }
  /**
   * Check if paused
   */
  isPaused() {
    return this.state.pausedAt !== void 0;
  }
  /**
   * Get pause reason
   */
  getPauseReason() {
    return this.state.pauseReason;
  }
  /**
   * Determine recommended mode based on intent analysis
   */
  recommendMode(intent, _currentPlan) {
    const currentMode = this.state.mode;
    switch (intent.type) {
      case "complex":
        if (currentMode === "interactive") {
          return "planning";
        }
        break;
      case "approval":
        if (currentMode === "planning" && this.state.pendingPlan) {
          return "executing";
        }
        break;
      case "rejection":
        if (currentMode === "planning") {
          return "planning";
        }
        break;
      case "plan_modify":
        if (currentMode === "executing" || currentMode === "interactive") {
          return "planning";
        }
        break;
      case "interrupt":
        return "interactive";
      case "simple":
      case "question":
        if (currentMode === "executing") {
          return null;
        }
        return "interactive";
      case "status_query":
        return null;
      case "feedback":
        return null;
    }
    return null;
  }
  /**
   * Get transition history
   */
  getHistory() {
    return [...this.transitionHistory];
  }
  /**
   * Clear transition history
   */
  clearHistory() {
    this.transitionHistory = [];
  }
  /**
   * Get time spent in current mode
   */
  getTimeInCurrentMode() {
    return Date.now() - this.state.enteredAt.getTime();
  }
  /**
   * Serialize state for session persistence
   */
  serialize() {
    return {
      mode: this.state.mode,
      enteredAt: this.state.enteredAt.toISOString(),
      reason: this.state.reason,
      pendingPlan: this.state.pendingPlan,
      planApproved: this.state.planApproved,
      currentTaskIndex: this.state.currentTaskIndex
    };
  }
  /**
   * Restore state from serialized data
   */
  restore(data) {
    this.state = {
      mode: data.mode,
      enteredAt: new Date(data.enteredAt),
      reason: data.reason,
      pendingPlan: data.pendingPlan,
      planApproved: data.planApproved,
      currentTaskIndex: data.currentTaskIndex
    };
  }
};

// src/capabilities/universalAgent/metaTools.ts
var startPlanningTool = {
  definition: {
    type: "function",
    function: {
      name: "_start_planning",
      description: `Call this when the user's request is complex and requires a multi-step plan.
Use for tasks that:
- Require 3 or more distinct steps
- Need multiple tools to be called in sequence
- Have dependencies between actions
- Would benefit from user review before execution

Do NOT use for:
- Simple questions
- Single tool calls
- Quick calculations
- Direct information retrieval`,
      parameters: {
        type: "object",
        properties: {
          goal: {
            type: "string",
            description: "The high-level goal to achieve"
          },
          reasoning: {
            type: "string",
            description: "Brief explanation of why planning is needed"
          }
        },
        required: ["goal", "reasoning"]
      }
    }
  },
  execute: async (args) => {
    return { status: "planning_started", goal: args.goal };
  }
};
var modifyPlanTool = {
  definition: {
    type: "function",
    function: {
      name: "_modify_plan",
      description: `Call this when the user wants to change the current plan.
Actions:
- add_task: Add a new task to the plan
- remove_task: Remove a task from the plan
- skip_task: Mark a task to be skipped
- update_task: Modify task description or dependencies
- reorder: Change task order`,
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add_task", "remove_task", "skip_task", "update_task", "reorder"],
            description: "The type of modification"
          },
          taskName: {
            type: "string",
            description: "Name of the task (for remove/skip/update/reorder)"
          },
          details: {
            type: "string",
            description: "Details of the modification (new task description, updates, etc.)"
          },
          insertAfter: {
            type: "string",
            description: "For add_task/reorder: insert after this task name"
          }
        },
        required: ["action", "details"]
      }
    }
  },
  execute: async (args) => {
    return { status: "plan_modified", action: args.action };
  }
};
var reportProgressTool = {
  definition: {
    type: "function",
    function: {
      name: "_report_progress",
      description: "Call this when the user asks about current progress, status, or what has been done.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  execute: async () => {
    return { status: "progress_reported", progress: null };
  }
};
var requestApprovalTool = {
  definition: {
    type: "function",
    function: {
      name: "_request_approval",
      description: "Call this when you need user approval to proceed. Use after creating a plan or before destructive operations.",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Optional message to show the user"
          }
        },
        required: []
      }
    }
  },
  execute: async (args) => {
    return { status: "approval_requested", message: args?.message };
  }
};
function getMetaTools() {
  return [
    startPlanningTool,
    modifyPlanTool,
    reportProgressTool,
    requestApprovalTool
  ];
}
function isMetaTool(toolName) {
  return toolName.startsWith("_");
}
var META_TOOL_NAMES = {
  START_PLANNING: "_start_planning",
  MODIFY_PLAN: "_modify_plan",
  REPORT_PROGRESS: "_report_progress",
  REQUEST_APPROVAL: "_request_approval"
};

// src/capabilities/universalAgent/UniversalAgent.ts
var UniversalAgent = class _UniversalAgent extends EventEmitter$1 {
  name;
  connector;
  model;
  // Core components
  config;
  agent;
  _toolManager;
  modeManager;
  planningAgent;
  workingMemory;
  // Session management
  _sessionManager = null;
  _session = null;
  // Execution state
  currentPlan = null;
  executionHistory = [];
  isDestroyed = false;
  // ============================================================================
  // Static Factory
  // ============================================================================
  /**
   * Create a new UniversalAgent
   */
  static create(config) {
    return new _UniversalAgent(config);
  }
  /**
   * Resume an agent from a saved session
   */
  static async resume(sessionId, config) {
    const agent = new _UniversalAgent({
      ...config,
      session: {
        ...config.session,
        id: sessionId
      }
    });
    await agent.loadSession(sessionId);
    return agent;
  }
  // ============================================================================
  // Constructor
  // ============================================================================
  constructor(config) {
    super();
    this.connector = typeof config.connector === "string" ? Connector.get(config.connector) : config.connector;
    this.name = config.name ?? `universal-agent-${Date.now()}`;
    this.model = config.model;
    this.config = config;
    this._toolManager = config.toolManager ?? new ToolManager();
    if (config.tools) {
      for (const tool of config.tools) {
        this._toolManager.register(tool, { namespace: "user" });
      }
    }
    const metaTools = getMetaTools();
    for (const tool of metaTools) {
      this._toolManager.register(tool, { namespace: "_meta" });
    }
    const allTools = this._toolManager.getEnabled();
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: allTools,
      instructions: this.buildInstructions(config.instructions),
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 20
    });
    this.modeManager = new ModeManager("interactive");
    this.modeManager.on("mode:changed", (data) => {
      this.emit("mode:changed", data);
    });
    const planningEnabled = config.planning?.enabled !== false;
    if (planningEnabled) {
      this.planningAgent = PlanningAgent.create({
        connector: config.connector,
        model: config.planning?.model ?? config.model,
        availableTools: this._toolManager.getEnabled().filter((t) => !isMetaTool(t.definition.function.name))
      });
    }
    const memoryStorage = new InMemoryStorage();
    this.workingMemory = new WorkingMemory(memoryStorage, config.memoryConfig ?? DEFAULT_MEMORY_CONFIG);
    if (config.session) {
      this._sessionManager = new SessionManager({ storage: config.session.storage });
      if (!config.session.id) {
        this._session = this._sessionManager.create("universal-agent", {
          title: this.name
        });
        if (config.session.autoSave) {
          const interval = config.session.autoSaveIntervalMs ?? 3e4;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      }
    }
  }
  // ============================================================================
  // Main API
  // ============================================================================
  /**
   * Chat with the agent - the main entry point
   */
  async chat(input) {
    if (this.isDestroyed) {
      throw new Error("Agent has been destroyed");
    }
    const intent = await this.analyzeIntent(input);
    let response;
    switch (this.modeManager.getMode()) {
      case "interactive":
        response = await this.handleInteractive(input, intent);
        break;
      case "planning":
        response = await this.handlePlanning(input, intent);
        break;
      case "executing":
        response = await this.handleExecuting(input, intent);
        break;
      default:
        throw new Error(`Unknown mode: ${this.modeManager.getMode()}`);
    }
    this.executionHistory.push({
      input,
      response,
      timestamp: /* @__PURE__ */ new Date()
    });
    if (this.config.session?.autoSave && this._session) {
      await this.saveSession().catch(() => {
      });
    }
    return response;
  }
  /**
   * Stream chat response
   */
  async *stream(input) {
    if (this.isDestroyed) {
      throw new Error("Agent has been destroyed");
    }
    const intent = await this.analyzeIntent(input);
    const recommendedMode = this.modeManager.recommendMode(intent, this.currentPlan ?? void 0);
    if (recommendedMode && recommendedMode !== this.modeManager.getMode()) {
      const from = this.modeManager.getMode();
      this.modeManager.transition(recommendedMode, intent.type);
      yield { type: "mode:changed", from, to: recommendedMode, reason: intent.type };
    }
    const mode = this.modeManager.getMode();
    if (mode === "interactive") {
      yield* this.streamInteractive(input, intent);
    } else if (mode === "planning") {
      yield* this.streamPlanning(input, intent);
    } else if (mode === "executing") {
      yield* this.streamExecuting(intent);
    }
  }
  // ============================================================================
  // Mode Handlers
  // ============================================================================
  async handleInteractive(input, intent) {
    const shouldPlan = this.shouldSwitchToPlanning(intent);
    if (shouldPlan) {
      this.modeManager.enterPlanning("complex_task_detected");
      return this.handlePlanning(input, intent);
    }
    const response = await this.agent.run(input);
    const planningToolCall = response.output.find(
      (item) => item.type === "tool_use" && item.name === META_TOOL_NAMES.START_PLANNING
    );
    if (planningToolCall) {
      this.modeManager.enterPlanning("agent_requested");
      const rawInput = planningToolCall.input;
      const args = typeof rawInput === "string" ? JSON.parse(rawInput || "{}") : rawInput || {};
      return this.createPlan(args.goal, args.reasoning);
    }
    return {
      text: response.output_text ?? "",
      mode: "interactive",
      usage: response.usage ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.total_tokens
      } : void 0
    };
  }
  async handlePlanning(input, intent) {
    if (intent.type === "approval" && this.modeManager.getPendingPlan()) {
      return this.approvePlan(intent.feedback);
    }
    if (intent.type === "rejection") {
      return this.handlePlanRejection(input, intent);
    }
    if (intent.type === "plan_modify" && intent.modification) {
      return this.modifyPlan(intent.modification);
    }
    if (!this.modeManager.getPendingPlan()) {
      return this.createPlan(input);
    } else {
      return this.refinePlan(input);
    }
  }
  async handleExecuting(input, intent) {
    if (intent.type === "interrupt") {
      this.modeManager.pauseExecution("user_interrupt");
      return {
        text: "Execution paused. What would you like to do?",
        mode: "executing",
        taskProgress: this.getTaskProgress(),
        needsUserAction: true,
        userActionType: "provide_input"
      };
    }
    if (intent.type === "status_query") {
      return this.reportProgress();
    }
    if (intent.type === "plan_modify" && intent.modification) {
      this.modeManager.pauseExecution("plan_modification");
      const modifyResult = await this.modifyPlan(intent.modification);
      this.modeManager.resumeExecution();
      return modifyResult;
    }
    if (intent.type === "feedback") {
      await this.workingMemory.store(
        `user_feedback_${Date.now()}`,
        "User feedback during execution",
        input,
        "persistent"
      );
      return {
        text: "Noted. I'll keep that in mind as I continue.",
        mode: "executing",
        taskProgress: this.getTaskProgress()
      };
    }
    if (this.modeManager.isPaused()) {
      this.modeManager.resumeExecution();
      return this.continueExecution();
    }
    const response = await this.agent.run(input);
    return {
      text: response.output_text ?? "",
      mode: "executing",
      taskProgress: this.getTaskProgress()
    };
  }
  // ============================================================================
  // Streaming Handlers
  // ============================================================================
  async *streamInteractive(input, intent) {
    if (this.shouldSwitchToPlanning(intent)) {
      const from = this.modeManager.getMode();
      this.modeManager.enterPlanning("complex_task_detected");
      yield { type: "mode:changed", from, to: "planning", reason: "complex_task_detected" };
      yield* this.streamPlanning(input, intent);
      return;
    }
    let fullText = "";
    for await (const event of this.agent.stream(input)) {
      if (event.type === "response.output_text.delta" /* OUTPUT_TEXT_DELTA */) {
        const delta = event.delta || "";
        fullText += delta;
        yield { type: "text:delta", delta };
      } else if (event.type === "response.tool_call.start" /* TOOL_CALL_START */) {
        yield { type: "tool:start", name: event.tool_name || "unknown", args: null };
      } else if (event.type === "response.tool_execution.done" /* TOOL_EXECUTION_DONE */) {
        yield { type: "tool:complete", name: event.name || "unknown", result: event.result, durationMs: 0 };
      }
    }
    yield { type: "text:done", text: fullText };
  }
  async *streamPlanning(input, intent) {
    if (intent.type === "approval" && this.modeManager.getPendingPlan()) {
      const plan2 = this.modeManager.getPendingPlan();
      this.modeManager.approvePlan();
      yield { type: "plan:approved", plan: plan2 };
      this.modeManager.enterExecuting(plan2, "plan_approved");
      yield { type: "mode:changed", from: "planning", to: "executing", reason: "plan_approved" };
      yield* this.streamExecution();
      return;
    }
    yield { type: "plan:analyzing", goal: input };
    const plan = await this.createPlanInternal(input);
    this.modeManager.setPendingPlan(plan);
    this.currentPlan = plan;
    yield { type: "plan:created", plan };
    if (this.config.planning?.requireApproval !== false) {
      yield { type: "plan:awaiting_approval", plan };
      yield { type: "needs:approval", plan };
      const summary = this.formatPlanSummary(plan);
      yield { type: "text:delta", delta: summary };
      yield { type: "text:done", text: summary };
    }
  }
  async *streamExecuting(intent) {
    if (intent.type === "status_query") {
      const progress = this.getTaskProgress();
      const text = this.formatProgress(progress);
      yield { type: "text:delta", delta: text };
      yield { type: "text:done", text };
      return;
    }
    yield* this.streamExecution();
  }
  async *streamExecution() {
    if (!this.currentPlan) {
      yield { type: "error", error: "No plan to execute", recoverable: false };
      return;
    }
    const tasks = this.currentPlan.tasks;
    let completedTasks = 0;
    let failedTasks = 0;
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task) continue;
      if (this.modeManager.isPaused()) {
        yield { type: "execution:paused", reason: this.modeManager.getPauseReason() || "unknown" };
        return;
      }
      if (task.status === "completed" || task.status === "failed" || task.status === "skipped") {
        if (task.status === "completed") completedTasks++;
        if (task.status === "failed") failedTasks++;
        continue;
      }
      task.status = "in_progress";
      task.startedAt = Date.now();
      task.attempts = (task.attempts || 0) + 1;
      this.modeManager.setCurrentTaskIndex(i);
      yield { type: "task:started", task };
      try {
        const prompt = this.buildTaskPrompt(task);
        let taskResultText = "";
        for await (const event of this.agent.stream(prompt)) {
          if (event.type === "response.output_text.delta" /* OUTPUT_TEXT_DELTA */) {
            const delta = event.delta || "";
            taskResultText += delta;
            yield { type: "task:progress", task, status: delta };
          } else if (event.type === "response.tool_call.start" /* TOOL_CALL_START */) {
            yield { type: "tool:start", name: event.tool_name || "unknown", args: null };
          } else if (event.type === "response.tool_execution.done" /* TOOL_EXECUTION_DONE */) {
            yield { type: "tool:complete", name: event.name || "unknown", result: event.result, durationMs: 0 };
          }
        }
        task.status = "completed";
        task.completedAt = Date.now();
        task.result = { success: true, output: taskResultText };
        completedTasks++;
        yield { type: "task:completed", task, result: taskResultText };
      } catch (error) {
        task.status = "failed";
        const errorMsg = error instanceof Error ? error.message : String(error);
        task.result = { success: false, error: errorMsg };
        failedTasks++;
        yield { type: "task:failed", task, error: errorMsg };
      }
    }
    const result = {
      status: failedTasks === 0 ? "completed" : "failed",
      completedTasks,
      totalTasks: tasks.length,
      failedTasks,
      skippedTasks: tasks.filter((t) => t.status === "skipped").length
    };
    yield { type: "execution:done", result };
    this.modeManager.returnToInteractive("execution_completed");
    yield { type: "mode:changed", from: "executing", to: "interactive", reason: "execution_completed" };
    this.emit("execution:completed", { result });
  }
  // ============================================================================
  // Planning Helpers
  // ============================================================================
  async createPlan(goal, _reasoning) {
    const plan = await this.createPlanInternal(goal);
    this.modeManager.setPendingPlan(plan);
    this.currentPlan = plan;
    this.emit("plan:created", { plan });
    const summary = this.formatPlanSummary(plan);
    const requireApproval = this.config.planning?.requireApproval !== false;
    return {
      text: summary,
      mode: "planning",
      plan,
      planStatus: requireApproval ? "pending_approval" : "approved",
      needsUserAction: requireApproval,
      userActionType: requireApproval ? "approve_plan" : void 0
    };
  }
  async createPlanInternal(goal) {
    if (this.planningAgent) {
      const result = await this.planningAgent.generatePlan({ goal });
      return createPlan({ goal, tasks: result.plan.tasks });
    }
    return createPlan({
      goal,
      tasks: [{ name: "execute", description: goal }]
    });
  }
  async approvePlan(_feedback) {
    const plan = this.modeManager.getPendingPlan();
    if (!plan) {
      return {
        text: "No plan to approve.",
        mode: this.modeManager.getMode()
      };
    }
    this.modeManager.approvePlan();
    this.modeManager.enterExecuting(plan, "user_approved");
    this.currentPlan = plan;
    this.emit("plan:approved", { plan });
    return this.continueExecution();
  }
  async handlePlanRejection(_input, intent) {
    if (intent.feedback) {
      return this.refinePlan(intent.feedback);
    }
    return {
      text: "I understand you'd like to change the plan. What would you like me to modify?",
      mode: "planning",
      plan: this.modeManager.getPendingPlan(),
      needsUserAction: true,
      userActionType: "provide_input"
    };
  }
  async refinePlan(feedback) {
    const currentPlan = this.modeManager.getPendingPlan();
    if (!currentPlan || !this.planningAgent) {
      return this.createPlan(feedback);
    }
    const refined = await this.planningAgent.refinePlan(currentPlan, feedback);
    this.modeManager.setPendingPlan(refined.plan);
    this.currentPlan = refined.plan;
    this.emit("plan:modified", { plan: refined.plan, changes: [] });
    return {
      text: this.formatPlanSummary(refined.plan),
      mode: "planning",
      plan: refined.plan,
      planStatus: "pending_approval",
      needsUserAction: true,
      userActionType: "approve_plan"
    };
  }
  async modifyPlan(modification) {
    if (!modification || !this.currentPlan) {
      return {
        text: "No active plan to modify.",
        mode: this.modeManager.getMode()
      };
    }
    const changes = [];
    switch (modification.action) {
      case "add_task": {
        const newTask = createTask({
          name: `task_${this.currentPlan.tasks.length + 1}`,
          description: modification.details ?? "New task"
        });
        this.currentPlan.tasks.push(newTask);
        changes.push({ type: "task_added", taskId: newTask.id, taskName: newTask.name, details: modification.details });
        break;
      }
      case "remove_task": {
        const idx = this.currentPlan.tasks.findIndex((t) => t.name === modification.taskName);
        if (idx >= 0) {
          this.currentPlan.tasks.splice(idx, 1);
          changes.push({ type: "task_removed", taskName: modification.taskName });
        }
        break;
      }
      case "skip_task": {
        const task = this.currentPlan.tasks.find((t) => t.name === modification.taskName);
        if (task) {
          task.status = "skipped";
          changes.push({ type: "task_updated", taskId: task.id, taskName: task.name, details: "Marked as skipped" });
        }
        break;
      }
      case "update_task": {
        const task = this.currentPlan.tasks.find((t) => t.name === modification.taskName);
        if (task && modification.details) {
          task.description = modification.details;
          changes.push({ type: "task_updated", taskId: task.id, taskName: task.name, details: modification.details });
        }
        break;
      }
    }
    this.currentPlan.lastUpdatedAt = Date.now();
    this.emit("plan:modified", { plan: this.currentPlan, changes });
    return {
      text: `Plan updated: ${changes.map((c) => c.details || c.type).join(", ")}`,
      mode: this.modeManager.getMode(),
      plan: this.currentPlan
    };
  }
  // ============================================================================
  // Execution Helpers
  // ============================================================================
  async continueExecution() {
    if (!this.currentPlan) {
      return {
        text: "No plan to execute.",
        mode: "interactive"
      };
    }
    const tasks = this.currentPlan.tasks;
    const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
    if (pendingTasks.length === 0) {
      this.modeManager.returnToInteractive("all_tasks_completed");
      return {
        text: "All tasks completed!",
        mode: "interactive",
        taskProgress: this.getTaskProgress()
      };
    }
    const nextTask = pendingTasks[0];
    if (!nextTask) {
      throw new Error("No pending task found");
    }
    nextTask.status = "in_progress";
    nextTask.startedAt = Date.now();
    nextTask.attempts = (nextTask.attempts || 0) + 1;
    this.emit("task:started", { task: nextTask });
    try {
      const prompt = this.buildTaskPrompt(nextTask);
      const response = await this.agent.run(prompt);
      nextTask.status = "completed";
      nextTask.completedAt = Date.now();
      nextTask.result = { success: true, output: response.output_text };
      this.emit("task:completed", { task: nextTask, result: response.output_text });
      const remaining = tasks.filter((t) => t.status === "pending");
      if (remaining.length > 0) {
        return {
          text: `Completed: ${nextTask.name}

Continuing to next task...`,
          mode: "executing",
          taskProgress: this.getTaskProgress()
        };
      } else {
        this.modeManager.returnToInteractive("all_tasks_completed");
        return {
          text: `All tasks completed!

Final task result:
${response.output_text}`,
          mode: "interactive",
          taskProgress: this.getTaskProgress()
        };
      }
    } catch (error) {
      nextTask.status = "failed";
      const errorMsg = error instanceof Error ? error.message : String(error);
      nextTask.result = { success: false, error: errorMsg };
      this.emit("task:failed", { task: nextTask, error: errorMsg });
      return {
        text: `Task failed: ${errorMsg}`,
        mode: "executing",
        taskProgress: this.getTaskProgress()
      };
    }
  }
  reportProgress() {
    const progress = this.getTaskProgress();
    return {
      text: this.formatProgress(progress),
      mode: this.modeManager.getMode(),
      taskProgress: progress
    };
  }
  // ============================================================================
  // Intent Analysis
  // ============================================================================
  async analyzeIntent(input) {
    const lowerInput = input.toLowerCase().trim();
    if (this.isApproval(lowerInput)) {
      return { type: "approval", confidence: 0.9 };
    }
    if (this.isRejection(lowerInput)) {
      return { type: "rejection", confidence: 0.9, feedback: input };
    }
    if (this.isStatusQuery(lowerInput)) {
      return { type: "status_query", confidence: 0.9 };
    }
    if (this.isInterrupt(lowerInput)) {
      return { type: "interrupt", confidence: 0.9 };
    }
    if (this.isPlanModification(lowerInput)) {
      return {
        type: "plan_modify",
        confidence: 0.8,
        modification: this.parsePlanModification(input)
      };
    }
    const complexity = this.estimateComplexity(input);
    if (complexity === "high" || complexity === "medium") {
      return {
        type: "complex",
        confidence: 0.7,
        complexity,
        estimatedSteps: this.estimateSteps(input)
      };
    }
    return { type: "simple", confidence: 0.8 };
  }
  isApproval(input) {
    const approvalPatterns = [
      /^(yes|yeah|yep|sure|ok|okay|go ahead|proceed|approve|looks good|lgtm|do it|start|execute|run it)$/i,
      /^(that('s| is) (good|fine|great|perfect))$/i,
      /^(please proceed|please continue|continue)$/i
    ];
    return approvalPatterns.some((p) => p.test(input));
  }
  isRejection(input) {
    const rejectionPatterns = [
      /^(no|nope|nah|stop|cancel|reject|don't|wait)$/i,
      /^(that('s| is) (wrong|not right|incorrect))$/i,
      /change|modify|different|instead/i
    ];
    return rejectionPatterns.some((p) => p.test(input));
  }
  isStatusQuery(input) {
    const statusPatterns = [
      /status|progress|where are (you|we)|what('s| is) (the )?(status|progress)/i,
      /how('s| is) it going|what have you done|current state/i,
      /which task|what task/i
    ];
    return statusPatterns.some((p) => p.test(input));
  }
  isInterrupt(input) {
    const interruptPatterns = [
      /^(stop|pause|wait|hold on|hold up)$/i,
      /stop (what you're doing|execution|everything)/i
    ];
    return interruptPatterns.some((p) => p.test(input));
  }
  isPlanModification(input) {
    const modPatterns = [
      /add (a )?task|new task|also (do|add)|additionally/i,
      /remove (the )?task|skip (the )?task|don't do/i,
      /change (the )?order|reorder|do .* first|prioritize/i,
      /update (the )?task|modify (the )?task/i
    ];
    return modPatterns.some((p) => p.test(input));
  }
  parsePlanModification(input) {
    const lowerInput = input.toLowerCase();
    if (/add|new|also|additionally/.test(lowerInput)) {
      return { action: "add_task", details: input };
    }
    if (/remove|skip|don't/.test(lowerInput)) {
      return { action: "skip_task", details: input };
    }
    if (/reorder|first|prioritize/.test(lowerInput)) {
      return { action: "reorder", details: input };
    }
    return { action: "update_task", details: input };
  }
  estimateComplexity(input) {
    const words = input.split(/\s+/).length;
    const hasMultipleActions = /and|then|after|before|also|additionally/.test(input.toLowerCase());
    const hasComplexKeywords = /build|create|implement|design|develop|setup|configure|migrate|refactor/.test(input.toLowerCase());
    if (words > 50 || hasMultipleActions && hasComplexKeywords) {
      return "high";
    }
    if (words > 20 || hasMultipleActions || hasComplexKeywords) {
      return "medium";
    }
    return "low";
  }
  estimateSteps(input) {
    const andCount = (input.match(/\band\b/gi) || []).length;
    const thenCount = (input.match(/\bthen\b/gi) || []).length;
    return Math.max(2, andCount + thenCount + 1);
  }
  shouldSwitchToPlanning(intent) {
    if (this.config.planning?.enabled !== false && this.config.planning?.autoDetect !== false) {
      return intent.type === "complex" && (intent.complexity === "high" || intent.complexity === "medium");
    }
    return false;
  }
  // ============================================================================
  // Helpers
  // ============================================================================
  buildInstructions(userInstructions) {
    const baseInstructions = `You are a versatile AI assistant that can handle both simple requests and complex multi-step tasks.

For simple requests:
- Answer questions directly
- Use tools when needed for immediate results

For complex requests:
- Use the _start_planning tool to create a structured plan
- Wait for user approval before executing

You have access to meta-tools:
- _start_planning: Call when a task needs multiple steps
- _modify_plan: Call when user wants to change the plan
- _report_progress: Call when user asks about status
- _request_approval: Call when you need user confirmation

Always be helpful, clear, and ask for clarification when needed.`;
    return userInstructions ? `${baseInstructions}

Additional instructions:
${userInstructions}` : baseInstructions;
  }
  buildTaskPrompt(task) {
    let prompt = `Execute the following task:

Task: ${task.name}
Description: ${task.description}`;
    if (task.expectedOutput) {
      prompt += `
Expected Output: ${task.expectedOutput}`;
    }
    return prompt;
  }
  formatPlanSummary(plan) {
    let summary = `I've created a plan to: ${plan.goal}

`;
    summary += `Tasks (${plan.tasks.length}):
`;
    plan.tasks.forEach((task, i) => {
      const deps = task.dependsOn?.length ? ` (depends on: ${task.dependsOn.join(", ")})` : "";
      summary += `${i + 1}. ${task.name}: ${task.description}${deps}
`;
    });
    summary += "\nWould you like me to proceed with this plan?";
    return summary;
  }
  formatProgress(progress) {
    let text = `Progress: ${progress.completed}/${progress.total} tasks completed`;
    if (progress.failed > 0) {
      text += ` (${progress.failed} failed)`;
    }
    if (progress.skipped > 0) {
      text += ` (${progress.skipped} skipped)`;
    }
    if (progress.current) {
      text += `

Currently working on: ${progress.current.name}`;
    }
    return text;
  }
  getTaskProgress() {
    if (!this.currentPlan) {
      return { completed: 0, total: 0, failed: 0, skipped: 0 };
    }
    const tasks = this.currentPlan.tasks;
    const currentIdx = this.modeManager.getCurrentTaskIndex();
    return {
      completed: tasks.filter((t) => t.status === "completed").length,
      total: tasks.length,
      current: tasks[currentIdx],
      failed: tasks.filter((t) => t.status === "failed").length,
      skipped: tasks.filter((t) => t.status === "skipped").length
    };
  }
  // ============================================================================
  // Session Management
  // ============================================================================
  getSessionId() {
    return this._session?.id ?? null;
  }
  hasSession() {
    return this._session !== null;
  }
  async saveSession() {
    if (!this._sessionManager || !this._session) {
      throw new Error("Session not enabled");
    }
    this._session.toolState = this._toolManager.getState();
    this._session.mode = this.modeManager.getMode();
    if (this.currentPlan) {
      this._session.plan = { version: 1, data: this.currentPlan };
    }
    this._session.custom["modeState"] = this.modeManager.serialize();
    this._session.custom["executionHistory"] = this.executionHistory;
    await this._sessionManager.save(this._session);
  }
  async loadSession(sessionId) {
    if (!this._sessionManager) return;
    const session = await this._sessionManager.load(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this._session = session;
    if (session.toolState) {
      this._toolManager.loadState(session.toolState);
    }
    if (session.custom["modeState"]) {
      this.modeManager.restore(session.custom["modeState"]);
    }
    if (session.plan?.data) {
      this.currentPlan = session.plan.data;
    }
    if (session.custom["executionHistory"]) {
      this.executionHistory = session.custom["executionHistory"];
    }
  }
  getSession() {
    return this._session;
  }
  // ============================================================================
  // Public Getters
  // ============================================================================
  getMode() {
    return this.modeManager.getMode();
  }
  getPlan() {
    return this.currentPlan;
  }
  getProgress() {
    if (this.modeManager.getMode() !== "executing" || !this.currentPlan) {
      return null;
    }
    return this.getTaskProgress();
  }
  get toolManager() {
    return this._toolManager;
  }
  // ============================================================================
  // Runtime Configuration
  // ============================================================================
  setAutoApproval(value) {
    if (this.config.planning) {
      this.config.planning.requireApproval = !value;
    }
  }
  setPlanningEnabled(value) {
    if (this.config.planning) {
      this.config.planning.enabled = value;
    }
  }
  // ============================================================================
  // Control
  // ============================================================================
  _isPaused = false;
  pause() {
    this._isPaused = true;
    if (this.modeManager.getMode() === "executing") {
      this.modeManager.pauseExecution("user_request");
    }
  }
  resume() {
    this._isPaused = false;
    if (this.modeManager.isPaused()) {
      this.modeManager.resumeExecution();
    }
  }
  cancel() {
    if (this.currentPlan) {
      this.currentPlan.status = "cancelled";
    }
    this.modeManager.returnToInteractive("cancelled");
  }
  isRunning() {
    return this.modeManager.getMode() === "executing" && !this.isPaused();
  }
  isPaused() {
    return this._isPaused || this.modeManager.isPaused();
  }
  onCleanup(callback) {
    this.agent.onCleanup(callback);
  }
  // ============================================================================
  // Cleanup
  // ============================================================================
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this._sessionManager && this._session) {
      this._sessionManager.stopAutoSave(this._session.id);
      this._sessionManager.destroy();
    }
    this.agent.destroy();
    this._toolManager.removeAllListeners();
    this.modeManager.removeAllListeners();
    this.removeAllListeners();
  }
};

export { AIError, AdaptiveStrategy, Agent, AggressiveCompactionStrategy, ApproximateTokenEstimator, BaseMediaProvider, BaseProvider, BaseTextProvider, CONNECTOR_CONFIG_VERSION, CheckpointManager, CircuitBreaker, CircuitOpenError, Connector, ConnectorConfigStore, ConsoleMetrics, ContentType, ContextManager2 as ContextManager, DEFAULT_BACKOFF_CONFIG, DEFAULT_CHECKPOINT_STRATEGY, DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_CONTEXT_CONFIG2 as DEFAULT_CONTEXT_CONFIG, DEFAULT_HISTORY_CONFIG, DEFAULT_IDEMPOTENCY_CONFIG, DEFAULT_MEMORY_CONFIG, ExecutionContext, ExternalDependencyHandler, FileConnectorStorage, FileSessionStorage, FileStorage, FrameworkLogger, HistoryManager, HookManager, IdempotencyCache, InMemoryAgentStateStorage, InMemoryMetrics, InMemoryPlanStorage, InMemorySessionStorage, InMemoryStorage, InvalidConfigError, InvalidToolArgumentsError, LLM_MODELS, LazyCompactionStrategy, META_TOOL_NAMES, MODEL_REGISTRY, MemoryConnectorStorage, MemoryEvictionCompactor, MemoryStorage, MessageBuilder, MessageRole, ModeManager, ModelNotSupportedError, NoOpMetrics, OAuthManager, PlanExecutor, ProactiveCompactionStrategy, ProviderAuthError, ProviderConfigAgent, ProviderContextLengthError, ProviderError, ProviderErrorMapper, ProviderNotFoundError, ProviderRateLimitError, RollingWindowStrategy, STT_MODELS, STT_MODEL_REGISTRY, SessionManager, SpeechToText, StreamEventType, StreamHelpers, StreamState, SummarizeCompactor, TTS_MODELS, TTS_MODEL_REGISTRY, TaskAgent, TaskAgentContextProvider, TextToSpeech, ToolCallState, ToolExecutionError, ToolManager, ToolNotFoundError, ToolRegistry, ToolTimeoutError, TruncateCompactor, UniversalAgent, VENDORS, Vendor, WorkingMemory, addHistoryEntry, addJitter, assertNotDestroyed, authenticatedFetch, backoffSequence, backoffWait, calculateBackoff, calculateCost, calculateSTTCost, calculateTTSCost, createAgentStorage, createAuthenticatedFetch, createEmptyHistory, createEmptyMemory, createEstimator, createExecuteJavaScriptTool, createMemoryTools, createMessageWithImages, createMetricsCollector, createProvider, createStrategy, createTextMessage, generateEncryptionKey, generateWebAPITool, getActiveModels, getActiveSTTModels, getActiveTTSModels, getMetaTools, getModelInfo, getModelsByVendor, getSTTModelInfo, getSTTModelsByVendor, getSTTModelsWithFeature, getTTSModelInfo, getTTSModelsByVendor, getTTSModelsWithFeature, hasClipboardImage, isErrorEvent, isMetaTool, isOutputTextDelta, isResponseComplete, isStreamEvent, isToolCallArgumentsDelta, isToolCallArgumentsDone, isVendor, logger, metrics, readClipboardImage, retryWithBackoff, setMetricsCollector, tools_exports as tools };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map