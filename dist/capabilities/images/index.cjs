'use strict';

var crypto = require('crypto');
var jose = require('jose');
var fs2 = require('fs');
var eventemitter3 = require('eventemitter3');
var path = require('path');
var OpenAI = require('openai');
var genai = require('@google/genai');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var crypto__namespace = /*#__PURE__*/_interopNamespace(crypto);
var fs2__namespace = /*#__PURE__*/_interopNamespace(fs2);
var path__namespace = /*#__PURE__*/_interopNamespace(path);
var OpenAI__default = /*#__PURE__*/_interopDefault(OpenAI);

// src/connectors/oauth/utils/encryption.ts
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 16;
var SALT_LENGTH = 64;
var TAG_LENGTH = 16;
var KEY_LENGTH = 32;
function encrypt(text, password) {
  const salt = crypto__namespace.randomBytes(SALT_LENGTH);
  const key = crypto__namespace.pbkdf2Sync(password, salt, 1e5, KEY_LENGTH, "sha512");
  const iv = crypto__namespace.randomBytes(IV_LENGTH);
  const cipher = crypto__namespace.createCipheriv(ALGORITHM, key, iv);
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
  const key = crypto__namespace.pbkdf2Sync(password, salt, 1e5, KEY_LENGTH, "sha512");
  const decipher = crypto__namespace.createDecipheriv(ALGORITHM, key, iv);
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
    global.__oauthEncryptionKey = crypto__namespace.randomBytes(32).toString("hex");
    console.warn(
      "WARNING: Using auto-generated encryption key. Tokens will not persist across restarts. Set OAUTH_ENCRYPTION_KEY environment variable for production!"
    );
  }
  return global.__oauthEncryptionKey;
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
  const codeVerifier = base64URLEncode(crypto__namespace.randomBytes(32));
  const hash = crypto__namespace.createHash("sha256").update(codeVerifier).digest();
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
  return crypto__namespace.randomBytes(16).toString("hex");
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
        this.privateKey = fs2__namespace.readFileSync(config.privateKeyPath, "utf8");
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
    const key = await jose.importPKCS8(this.privateKey, alg);
    const jwt = await new jose.SignJWT({
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
var CircuitBreaker = class extends eventemitter3.EventEmitter {
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
var LOG_LEVEL_VALUES = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100
};
function safeStringify(obj, indent) {
  const seen = /* @__PURE__ */ new WeakSet();
  const replacer = (_key, value) => {
    if (value === null || value === void 0) {
      return value;
    }
    if (typeof value !== "object") {
      if (typeof value === "function") {
        return "[Function]";
      }
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    }
    const objValue = value;
    const constructor = objValue.constructor?.name || "";
    if (constructor === "Timeout" || constructor === "TimersList" || constructor === "Socket" || constructor === "Server" || constructor === "IncomingMessage" || constructor === "ServerResponse" || constructor === "WriteStream" || constructor === "ReadStream" || constructor === "EventEmitter") {
      return `[${constructor}]`;
    }
    if (seen.has(objValue)) {
      return "[Circular]";
    }
    if (objValue instanceof Error) {
      return {
        name: objValue.name,
        message: objValue.message,
        stack: objValue.stack
      };
    }
    if (objValue instanceof Date) {
      return objValue.toISOString();
    }
    if (objValue instanceof Map) {
      return Object.fromEntries(objValue);
    }
    if (objValue instanceof Set) {
      return Array.from(objValue);
    }
    if (Buffer.isBuffer(objValue)) {
      return `[Buffer(${objValue.length})]`;
    }
    seen.add(objValue);
    return value;
  };
  try {
    return JSON.stringify(obj, replacer, indent);
  } catch {
    return "[Unserializable]";
  }
}
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
      const dir = path__namespace.dirname(filePath);
      if (!fs2__namespace.existsSync(dir)) {
        fs2__namespace.mkdirSync(dir, { recursive: true });
      }
      this.fileStream = fs2__namespace.createWriteStream(filePath, {
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
        contextParts.push(`${key}=${safeStringify(value)}`);
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
    const json = safeStringify(entry);
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
  const collectorType = process.env.METRICS_COLLECTOR || "noop";
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

// src/core/ScopedConnectorRegistry.ts
var ScopedConnectorRegistry = class {
  constructor(policy, context) {
    this.policy = policy;
    this.context = context;
  }
  get(name) {
    if (!Connector.has(name)) {
      const available = this.list().join(", ") || "none";
      throw new Error(`Connector '${name}' not found. Available: ${available}`);
    }
    const connector = Connector.get(name);
    if (!this.policy.canAccess(connector, this.context)) {
      const available = this.list().join(", ") || "none";
      throw new Error(`Connector '${name}' not found. Available: ${available}`);
    }
    return connector;
  }
  has(name) {
    if (!Connector.has(name)) return false;
    const connector = Connector.get(name);
    return this.policy.canAccess(connector, this.context);
  }
  list() {
    return this.listAll().map((c) => c.name);
  }
  listAll() {
    return Connector.listAll().filter((c) => this.policy.canAccess(c, this.context));
  }
  size() {
    return this.listAll().length;
  }
  getDescriptionsForTools() {
    const connectors = this.listAll();
    if (connectors.length === 0) {
      return "No connectors registered yet.";
    }
    return connectors.map((c) => `  - "${c.name}": ${c.displayName} - ${c.config.description || "No description"}`).join("\n");
  }
  getInfo() {
    const info = {};
    for (const connector of this.listAll()) {
      info[connector.name] = {
        displayName: connector.displayName,
        description: connector.config.description || "",
        baseURL: connector.baseURL
      };
    }
    return info;
  }
};

// src/core/Connector.ts
var DEFAULT_CONNECTOR_TIMEOUT = 3e4;
var DEFAULT_MAX_RETRIES = 3;
var DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
var DEFAULT_BASE_DELAY_MS = 1e3;
var DEFAULT_MAX_DELAY_MS = 3e4;
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
  // ============ Access Control ============
  static _accessPolicy = null;
  /**
   * Set a global access policy for connector scoping.
   * Pass null to clear the policy.
   */
  static setAccessPolicy(policy) {
    _Connector._accessPolicy = policy;
  }
  /**
   * Get the current global access policy (or null if none set).
   */
  static getAccessPolicy() {
    return _Connector._accessPolicy;
  }
  /**
   * Create a scoped (filtered) view of the connector registry.
   * Requires a global access policy to be set via setAccessPolicy().
   *
   * @param context - Opaque context passed to the policy (e.g., { userId, tenantId })
   * @returns IConnectorRegistry that only exposes accessible connectors
   * @throws Error if no access policy is set
   */
  static scoped(context) {
    if (!_Connector._accessPolicy) {
      throw new Error("No access policy set. Call Connector.setAccessPolicy() first.");
    }
    return new ScopedConnectorRegistry(_Connector._accessPolicy, context);
  }
  /**
   * Return the static Connector methods as an IConnectorRegistry object (unfiltered).
   * Useful when code accepts the interface but you want the full admin view.
   */
  static asRegistry() {
    return {
      get: (name) => _Connector.get(name),
      has: (name) => _Connector.has(name),
      list: () => _Connector.list(),
      listAll: () => _Connector.listAll(),
      size: () => _Connector.size(),
      getDescriptionsForTools: () => _Connector.getDescriptionsForTools(),
      getInfo: () => _Connector.getInfo()
    };
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
  circuitBreaker;
  disposed = false;
  // Metrics
  requestCount = 0;
  successCount = 0;
  failureCount = 0;
  totalLatencyMs = 0;
  constructor(config) {
    this.name = config.name;
    this.vendor = config.vendor;
    this.config = config;
    if (config.auth.type === "oauth") {
      this.initOAuthManager(config.auth);
    } else if (config.auth.type === "jwt") {
      this.initJWTManager(config.auth);
    }
    this.initCircuitBreaker();
  }
  /**
   * Initialize circuit breaker with config or defaults
   */
  initCircuitBreaker() {
    const cbConfig = this.config.circuitBreaker;
    const enabled = cbConfig?.enabled ?? true;
    if (enabled) {
      this.circuitBreaker = new CircuitBreaker(`connector:${this.name}`, {
        failureThreshold: cbConfig?.failureThreshold ?? 5,
        successThreshold: cbConfig?.successThreshold ?? 2,
        resetTimeoutMs: cbConfig?.resetTimeoutMs ?? 3e4,
        windowMs: 6e4,
        // 1 minute window
        isRetryable: (error) => {
          if (error.message.includes("HTTP 4") && !error.message.includes("HTTP 429")) {
            return false;
          }
          return true;
        }
      });
      this.circuitBreaker.on("opened", ({ name, failureCount, lastError }) => {
        logger.warn(`Circuit breaker opened for ${name}: ${failureCount} failures, last error: ${lastError}`);
        metrics.increment("connector.circuit_breaker.opened", 1, { connector: this.name });
      });
      this.circuitBreaker.on("closed", ({ name }) => {
        logger.info(`Circuit breaker closed for ${name}`);
        metrics.increment("connector.circuit_breaker.closed", 1, { connector: this.name });
      });
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
   * Get the service type (explicit or undefined)
   */
  get serviceType() {
    return this.config.serviceType;
  }
  /**
   * Get connector metrics
   */
  getMetrics() {
    return {
      requestCount: this.requestCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      avgLatencyMs: this.requestCount > 0 ? this.totalLatencyMs / this.requestCount : 0,
      circuitBreakerState: this.circuitBreaker?.getState()
    };
  }
  /**
   * Reset circuit breaker (force close)
   */
  resetCircuitBreaker() {
    this.circuitBreaker?.reset();
  }
  /**
   * Make an authenticated fetch request using this connector
   * This is the foundation for all vendor-dependent tools
   *
   * Features:
   * - Timeout with AbortController
   * - Circuit breaker protection
   * - Retry with exponential backoff
   * - Request/response logging
   *
   * @param endpoint - API endpoint (relative to baseURL) or full URL
   * @param options - Fetch options with connector-specific settings
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Fetch Response
   */
  async fetch(endpoint, options, userId) {
    if (this.disposed) {
      throw new Error(`Connector '${this.name}' has been disposed`);
    }
    const startTime = Date.now();
    this.requestCount++;
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseURL}${endpoint}`;
    const timeout = options?.timeout ?? this.config.timeout ?? DEFAULT_CONNECTOR_TIMEOUT;
    if (this.config.logging?.enabled) {
      this.logRequest(url, options);
    }
    const doFetch = async () => {
      const token = await this.getToken(userId);
      const auth = this.config.auth;
      let headerName = "Authorization";
      let headerValue = `Bearer ${token}`;
      if (auth.type === "api_key") {
        headerName = auth.headerName || "Authorization";
        const prefix = auth.headerPrefix ?? "Bearer";
        headerValue = prefix ? `${prefix} ${token}` : token;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            ...options?.headers,
            [headerName]: headerValue
          }
        });
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    };
    const doFetchWithRetry = async () => {
      const retryConfig = this.config.retry;
      const maxRetries = retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES;
      const retryableStatuses = retryConfig?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
      const baseDelayMs = retryConfig?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
      const maxDelayMs = retryConfig?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
      const backoffConfig = {
        strategy: "exponential",
        initialDelayMs: baseDelayMs,
        maxDelayMs,
        multiplier: 2,
        jitter: true,
        jitterFactor: 0.1
      };
      let lastError;
      let lastResponse;
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          const response = await doFetch();
          if (!response.ok && retryableStatuses.includes(response.status) && attempt <= maxRetries) {
            lastResponse = response;
            const delay = calculateBackoff(attempt, backoffConfig);
            if (this.config.logging?.enabled) {
              logger.debug(`Connector ${this.name}: Retry ${attempt}/${maxRetries} after ${delay}ms (status ${response.status})`);
            }
            await this.sleep(delay);
            continue;
          }
          return response;
        } catch (error) {
          lastError = error;
          if (lastError.name === "AbortError") {
            throw new Error(`Request timeout after ${timeout}ms: ${url}`);
          }
          if (attempt <= maxRetries && !options?.skipRetry) {
            const delay = calculateBackoff(attempt, backoffConfig);
            if (this.config.logging?.enabled) {
              logger.debug(`Connector ${this.name}: Retry ${attempt}/${maxRetries} after ${delay}ms (error: ${lastError.message})`);
            }
            await this.sleep(delay);
            continue;
          }
          throw lastError;
        }
      }
      if (lastResponse) {
        return lastResponse;
      }
      throw lastError ?? new Error("Unknown error during fetch");
    };
    try {
      let response;
      if (this.circuitBreaker && !options?.skipCircuitBreaker) {
        response = await this.circuitBreaker.execute(doFetchWithRetry);
      } else {
        response = await doFetchWithRetry();
      }
      const latency = Date.now() - startTime;
      this.successCount++;
      this.totalLatencyMs += latency;
      metrics.timing("connector.latency", latency, { connector: this.name });
      metrics.increment("connector.success", 1, { connector: this.name });
      if (this.config.logging?.enabled) {
        this.logResponse(url, response, latency);
      }
      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.failureCount++;
      this.totalLatencyMs += latency;
      metrics.increment("connector.failure", 1, { connector: this.name, error: error.name });
      if (this.config.logging?.enabled) {
        logger.error(
          { connector: this.name, url, latency, error: error.message },
          `Connector ${this.name} fetch failed: ${error.message}`
        );
      }
      throw error;
    }
  }
  /**
   * Make an authenticated fetch request and parse JSON response
   * Throws on non-OK responses
   *
   * @param endpoint - API endpoint (relative to baseURL) or full URL
   * @param options - Fetch options with connector-specific settings
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Parsed JSON response
   */
  async fetchJSON(endpoint, options, userId) {
    const response = await this.fetch(endpoint, options, userId);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }
    if (!response.ok) {
      const errorMsg = typeof data === "object" && data !== null ? JSON.stringify(data) : text;
      throw new Error(`HTTP ${response.status}: ${errorMsg}`);
    }
    return data;
  }
  // ============ Private Helpers ============
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  logRequest(url, options) {
    const logData = {
      connector: this.name,
      method: options?.method ?? "GET",
      url
    };
    if (this.config.logging?.logHeaders && options?.headers) {
      const headers = { ...options.headers };
      if (headers["Authorization"]) {
        headers["Authorization"] = "[REDACTED]";
      }
      if (headers["authorization"]) {
        headers["authorization"] = "[REDACTED]";
      }
      logData.headers = headers;
    }
    if (this.config.logging?.logBody && options?.body) {
      logData.body = typeof options.body === "string" ? options.body.slice(0, 1e3) : "[non-string body]";
    }
    logger.debug(logData, `Connector ${this.name} request`);
  }
  logResponse(url, response, latency) {
    logger.debug(
      { connector: this.name, url, status: response.status, latency },
      `Connector ${this.name} response`
    );
  }
  /**
   * Dispose of resources
   */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.oauthManager = void 0;
    this.circuitBreaker = void 0;
  }
  /**
   * Check if connector is disposed
   */
  isDisposed() {
    return this.disposed;
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
  Google: "google",
  Grok: "grok"};

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
var InvalidConfigError = class _InvalidConfigError extends AIError {
  constructor(message) {
    super(message, "INVALID_CONFIG", 400);
    this.name = "InvalidConfigError";
    Object.setPrototypeOf(this, _InvalidConfigError.prototype);
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

// src/infrastructure/providers/openai/OpenAIImageProvider.ts
var OpenAIImageProvider = class extends BaseMediaProvider {
  name = "openai-image";
  vendor = "openai";
  capabilities = {
    text: false,
    images: true,
    videos: false,
    audio: false,
    features: {
      imageGeneration: true,
      imageEditing: true
    }
  };
  client;
  constructor(config) {
    super({ apiKey: config.auth.apiKey, ...config });
    this.client = new OpenAI__default.default({
      apiKey: config.auth.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      timeout: config.timeout,
      maxRetries: config.maxRetries
    });
  }
  /**
   * Generate images from a text prompt
   */
  async generateImage(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("image.generate", {
            model: options.model,
            size: options.size,
            quality: options.quality,
            n: options.n
          });
          const isGptImage = options.model === "gpt-image-1";
          const params = {
            model: options.model,
            prompt: options.prompt,
            size: options.size,
            quality: options.quality,
            style: options.style,
            n: options.n || 1
          };
          if (!isGptImage) {
            params.response_format = options.response_format || "b64_json";
          }
          const response = await this.client.images.generate(params);
          const data = response.data || [];
          this.logOperationComplete("image.generate", {
            model: options.model,
            imagesGenerated: data.length
          });
          return {
            created: response.created,
            data: data.map((img) => ({
              url: img.url,
              b64_json: img.b64_json,
              revised_prompt: img.revised_prompt
            }))
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "image.generate",
      { model: options.model }
    );
  }
  /**
   * Edit an existing image with a prompt
   * Supported by: gpt-image-1, dall-e-2
   */
  async editImage(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("image.edit", {
            model: options.model,
            size: options.size,
            n: options.n
          });
          const image = this.prepareImageInput(options.image);
          const mask = options.mask ? this.prepareImageInput(options.mask) : void 0;
          const isGptImage = options.model === "gpt-image-1";
          const params = {
            model: options.model,
            image,
            prompt: options.prompt,
            mask,
            size: options.size,
            n: options.n || 1
          };
          if (!isGptImage) {
            params.response_format = options.response_format || "b64_json";
          }
          const response = await this.client.images.edit(params);
          const data = response.data || [];
          this.logOperationComplete("image.edit", {
            model: options.model,
            imagesGenerated: data.length
          });
          return {
            created: response.created,
            data: data.map((img) => ({
              url: img.url,
              b64_json: img.b64_json,
              revised_prompt: img.revised_prompt
            }))
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "image.edit",
      { model: options.model }
    );
  }
  /**
   * Create variations of an existing image
   * Supported by: dall-e-2 only
   */
  async createVariation(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("image.variation", {
            model: options.model,
            size: options.size,
            n: options.n
          });
          const image = this.prepareImageInput(options.image);
          const response = await this.client.images.createVariation({
            model: options.model,
            image,
            size: options.size,
            n: options.n || 1,
            response_format: options.response_format || "b64_json"
          });
          const data = response.data || [];
          this.logOperationComplete("image.variation", {
            model: options.model,
            imagesGenerated: data.length
          });
          return {
            created: response.created,
            data: data.map((img) => ({
              url: img.url,
              b64_json: img.b64_json,
              revised_prompt: img.revised_prompt
            }))
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "image.variation",
      { model: options.model }
    );
  }
  /**
   * List available image models
   */
  async listModels() {
    return ["gpt-image-1", "dall-e-3", "dall-e-2"];
  }
  /**
   * Prepare image input (Buffer or file path) for OpenAI API
   */
  prepareImageInput(image) {
    if (Buffer.isBuffer(image)) {
      return new File([new Uint8Array(image)], "image.png", { type: "image/png" });
    }
    return fs2__namespace.createReadStream(image);
  }
  /**
   * Handle OpenAI API errors
   */
  handleError(error) {
    const message = error.message || "Unknown OpenAI API error";
    const status = error.status;
    if (status === 401) {
      throw new ProviderAuthError("openai", "Invalid API key");
    }
    if (status === 429) {
      throw new ProviderRateLimitError("openai", message);
    }
    if (status === 400) {
      if (message.includes("safety system")) {
        throw new ProviderError("openai", `Content policy violation: ${message}`);
      }
      throw new ProviderError("openai", `Bad request: ${message}`);
    }
    throw new ProviderError("openai", message);
  }
};
var GoogleImageProvider = class extends BaseMediaProvider {
  name = "google-image";
  vendor = "google";
  capabilities = {
    text: false,
    images: true,
    videos: false,
    audio: false,
    features: {
      imageGeneration: true,
      imageEditing: true
    }
  };
  client;
  constructor(config) {
    super(config);
    this.client = new genai.GoogleGenAI({
      apiKey: config.apiKey
    });
  }
  /**
   * Generate images from a text prompt using Google Imagen
   */
  async generateImage(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("image.generate", {
            model: options.model,
            n: options.n
          });
          const googleOptions = options;
          const response = await this.client.models.generateImages({
            model: options.model,
            prompt: options.prompt,
            config: {
              numberOfImages: options.n || 1,
              negativePrompt: googleOptions.negativePrompt,
              aspectRatio: googleOptions.aspectRatio,
              seed: googleOptions.seed,
              outputMimeType: googleOptions.outputMimeType,
              includeRaiReason: googleOptions.includeRaiReason
            }
          });
          const images = response.generatedImages || [];
          this.logOperationComplete("image.generate", {
            model: options.model,
            imagesGenerated: images.length
          });
          return {
            created: Math.floor(Date.now() / 1e3),
            data: images.map((img) => ({
              b64_json: img.image?.imageBytes
              // Google doesn't provide URLs, only base64
            }))
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "image.generate",
      { model: options.model }
    );
  }
  /**
   * Edit an existing image using Imagen capability model
   * Uses imagen-3.0-capability-001
   */
  async editImage(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("image.edit", {
            model: options.model,
            n: options.n
          });
          const referenceImage = await this.prepareReferenceImage(options.image);
          const response = await this.client.models.editImage({
            model: options.model || "imagen-3.0-capability-001",
            prompt: options.prompt,
            referenceImages: [referenceImage],
            config: {
              numberOfImages: options.n || 1
            }
          });
          const images = response.generatedImages || [];
          this.logOperationComplete("image.edit", {
            model: options.model,
            imagesGenerated: images.length
          });
          return {
            created: Math.floor(Date.now() / 1e3),
            data: images.map((img) => ({
              b64_json: img.image?.imageBytes
            }))
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "image.edit",
      { model: options.model }
    );
  }
  /**
   * List available image models
   */
  async listModels() {
    return [
      "imagen-4.0-generate-001",
      "imagen-4.0-ultra-generate-001",
      "imagen-4.0-fast-generate-001"
    ];
  }
  /**
   * Prepare a reference image for Google's editImage API
   */
  async prepareReferenceImage(image) {
    let imageBytes;
    if (Buffer.isBuffer(image)) {
      imageBytes = image.toString("base64");
    } else {
      const fs5 = await import('fs');
      const buffer = fs5.readFileSync(image);
      imageBytes = buffer.toString("base64");
    }
    return {
      referenceImage: {
        image: {
          imageBytes
        }
      },
      referenceType: "REFERENCE_TYPE_SUBJECT"
    };
  }
  /**
   * Handle Google API errors
   */
  handleError(error) {
    const message = error.message || "Unknown Google API error";
    const status = error.status || error.code;
    if (status === 401 || message.includes("API key not valid")) {
      throw new ProviderAuthError("google", "Invalid API key");
    }
    if (status === 429 || message.includes("Resource exhausted")) {
      throw new ProviderRateLimitError("google", message);
    }
    if (status === 400) {
      if (message.includes("SAFETY") || message.includes("blocked") || message.includes("Responsible AI")) {
        throw new ProviderError("google", `Content policy violation: ${message}`);
      }
      throw new ProviderError("google", `Bad request: ${message}`);
    }
    throw new ProviderError("google", message);
  }
};
var GROK_API_BASE_URL = "https://api.x.ai/v1";
var GrokImageProvider = class extends BaseMediaProvider {
  name = "grok-image";
  vendor = "grok";
  capabilities = {
    text: false,
    images: true,
    videos: false,
    audio: false,
    features: {
      imageGeneration: true,
      imageEditing: true
    }
  };
  client;
  constructor(config) {
    super({ apiKey: config.auth.apiKey, ...config });
    this.client = new OpenAI__default.default({
      apiKey: config.auth.apiKey,
      baseURL: config.baseURL || GROK_API_BASE_URL,
      timeout: config.timeout,
      maxRetries: config.maxRetries
    });
  }
  /**
   * Generate images from a text prompt
   */
  async generateImage(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("image.generate", {
            model: options.model,
            size: options.size,
            quality: options.quality,
            n: options.n
          });
          const params = {
            model: options.model || "grok-imagine-image",
            prompt: options.prompt,
            n: options.n || 1,
            response_format: options.response_format || "b64_json"
          };
          if (options.aspectRatio) {
            params.aspect_ratio = options.aspectRatio;
          }
          const response = await this.client.images.generate(params);
          const data = response.data || [];
          this.logOperationComplete("image.generate", {
            model: options.model,
            imagesGenerated: data.length
          });
          return {
            created: response.created,
            data: data.map((img) => ({
              url: img.url,
              b64_json: img.b64_json,
              revised_prompt: img.revised_prompt
            }))
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "image.generate",
      { model: options.model }
    );
  }
  /**
   * Edit an existing image with a prompt
   */
  async editImage(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("image.edit", {
            model: options.model,
            size: options.size,
            n: options.n
          });
          const image = this.prepareImageInput(options.image);
          const mask = options.mask ? this.prepareImageInput(options.mask) : void 0;
          const params = {
            model: options.model || "grok-imagine-image",
            image,
            prompt: options.prompt,
            mask,
            size: options.size,
            n: options.n || 1,
            response_format: options.response_format || "b64_json"
          };
          const response = await this.client.images.edit(params);
          const data = response.data || [];
          this.logOperationComplete("image.edit", {
            model: options.model,
            imagesGenerated: data.length
          });
          return {
            created: response.created,
            data: data.map((img) => ({
              url: img.url,
              b64_json: img.b64_json,
              revised_prompt: img.revised_prompt
            }))
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "image.edit",
      { model: options.model }
    );
  }
  /**
   * List available image models
   */
  async listModels() {
    return ["grok-imagine-image"];
  }
  /**
   * Prepare image input (Buffer or file path) for API
   */
  prepareImageInput(image) {
    if (Buffer.isBuffer(image)) {
      return new File([new Uint8Array(image)], "image.png", { type: "image/png" });
    }
    return fs2__namespace.createReadStream(image);
  }
  /**
   * Handle API errors
   */
  handleError(error) {
    const message = error.message || "Unknown Grok API error";
    const status = error.status;
    if (status === 401) {
      throw new ProviderAuthError("grok", "Invalid API key");
    }
    if (status === 429) {
      throw new ProviderRateLimitError("grok", message);
    }
    if (status === 400) {
      if (message.includes("safety") || message.includes("policy")) {
        throw new ProviderError("grok", `Content policy violation: ${message}`);
      }
      throw new ProviderError("grok", `Bad request: ${message}`);
    }
    throw new ProviderError("grok", message);
  }
};

// src/core/createImageProvider.ts
function createImageProvider(connector) {
  const vendor = connector.vendor;
  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAIImageProvider(extractOpenAIConfig(connector));
    case Vendor.Google:
      return new GoogleImageProvider(extractGoogleConfig(connector));
    case Vendor.Grok:
      return new GrokImageProvider(extractGrokConfig(connector));
    default:
      throw new Error(
        `No Image provider available for vendor: ${vendor}. Supported vendors: ${Vendor.OpenAI}, ${Vendor.Google}, ${Vendor.Grok}`
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
function extractGoogleConfig(connector) {
  const auth = connector.config.auth;
  if (auth.type !== "api_key") {
    throw new Error("Google requires API key authentication");
  }
  return {
    apiKey: auth.apiKey
  };
}
function extractGrokConfig(connector) {
  const auth = connector.config.auth;
  if (auth.type !== "api_key") {
    throw new Error("Grok requires API key authentication");
  }
  const options = connector.getOptions();
  return {
    auth: {
      type: "api_key",
      apiKey: auth.apiKey
    },
    baseURL: connector.baseURL,
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

// src/domain/entities/ImageModel.ts
var IMAGE_MODELS = {
  [Vendor.OpenAI]: {
    /** GPT-Image-1: Latest OpenAI image model with best quality */
    GPT_IMAGE_1: "gpt-image-1",
    /** DALL-E 3: High quality image generation */
    DALL_E_3: "dall-e-3",
    /** DALL-E 2: Fast, supports editing and variations */
    DALL_E_2: "dall-e-2"
  },
  [Vendor.Google]: {
    /** Imagen 4.0: Latest Google image generation model */
    IMAGEN_4_GENERATE: "imagen-4.0-generate-001",
    /** Imagen 4.0 Ultra: Highest quality */
    IMAGEN_4_ULTRA: "imagen-4.0-ultra-generate-001",
    /** Imagen 4.0 Fast: Optimized for speed */
    IMAGEN_4_FAST: "imagen-4.0-fast-generate-001"
  },
  [Vendor.Grok]: {
    /** Grok Imagine Image: xAI image generation with editing support */
    GROK_IMAGINE_IMAGE: "grok-imagine-image",
    /** Grok 2 Image: xAI image generation (text-only input) */
    GROK_2_IMAGE_1212: "grok-2-image-1212"
  }
};
var IMAGE_MODEL_REGISTRY = {
  // ======================== OpenAI ========================
  "gpt-image-1": {
    name: "gpt-image-1",
    displayName: "GPT-Image-1",
    provider: Vendor.OpenAI,
    description: "OpenAI latest image generation model with best quality and features",
    isActive: true,
    releaseDate: "2025-04-01",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/images",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      sizes: ["1024x1024", "1024x1536", "1536x1024", "auto"],
      maxImagesPerRequest: 10,
      outputFormats: ["png", "webp", "jpeg"],
      features: {
        generation: true,
        editing: true,
        variations: false,
        styleControl: false,
        qualityControl: true,
        transparency: true,
        promptRevision: false
      },
      limits: { maxPromptLength: 32e3 },
      vendorOptions: {
        quality: {
          type: "enum",
          label: "Quality",
          description: "Image quality level",
          enum: ["auto", "low", "medium", "high"],
          default: "auto",
          controlType: "select"
        },
        background: {
          type: "enum",
          label: "Background",
          description: "Background transparency",
          enum: ["auto", "transparent", "opaque"],
          default: "auto",
          controlType: "select"
        },
        output_format: {
          type: "enum",
          label: "Output Format",
          description: "Image file format",
          enum: ["png", "jpeg", "webp"],
          default: "png",
          controlType: "select"
        },
        output_compression: {
          type: "number",
          label: "Compression",
          description: "Compression level for JPEG/WebP (0-100)",
          min: 0,
          max: 100,
          default: 75,
          controlType: "slider"
        },
        moderation: {
          type: "enum",
          label: "Moderation",
          description: "Content moderation strictness",
          enum: ["auto", "low"],
          default: "auto",
          controlType: "radio"
        }
      }
    },
    pricing: {
      perImageStandard: 0.011,
      perImageHD: 0.042,
      currency: "USD"
    }
  },
  "dall-e-3": {
    name: "dall-e-3",
    displayName: "DALL-E 3",
    provider: Vendor.OpenAI,
    description: "High quality image generation with prompt revision",
    isActive: true,
    releaseDate: "2023-11-06",
    deprecationDate: "2026-05-12",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/images",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      sizes: ["1024x1024", "1024x1792", "1792x1024"],
      maxImagesPerRequest: 1,
      outputFormats: ["png", "url"],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: true,
        qualityControl: true,
        transparency: false,
        promptRevision: true
      },
      limits: { maxPromptLength: 4e3 },
      vendorOptions: {
        quality: {
          type: "enum",
          label: "Quality",
          description: "Image quality: standard or HD",
          enum: ["standard", "hd"],
          default: "standard",
          controlType: "radio"
        },
        style: {
          type: "enum",
          label: "Style",
          description: "Image style: vivid (hyper-real) or natural",
          enum: ["vivid", "natural"],
          default: "vivid",
          controlType: "radio"
        }
      }
    },
    pricing: {
      perImageStandard: 0.04,
      perImageHD: 0.08,
      currency: "USD"
    }
  },
  "dall-e-2": {
    name: "dall-e-2",
    displayName: "DALL-E 2",
    provider: Vendor.OpenAI,
    description: "Fast image generation with editing and variation support",
    isActive: true,
    releaseDate: "2022-11-03",
    deprecationDate: "2026-05-12",
    sources: {
      documentation: "https://platform.openai.com/docs/guides/images",
      pricing: "https://openai.com/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      sizes: ["256x256", "512x512", "1024x1024"],
      maxImagesPerRequest: 10,
      outputFormats: ["png", "url"],
      features: {
        generation: true,
        editing: true,
        variations: true,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false
      },
      limits: { maxPromptLength: 1e3 },
      vendorOptions: {}
    },
    pricing: {
      perImage: 0.02,
      currency: "USD"
    }
  },
  // ======================== Google ========================
  "imagen-4.0-generate-001": {
    name: "imagen-4.0-generate-001",
    displayName: "Imagen 4.0 Generate",
    provider: Vendor.Google,
    description: "Google Imagen 4.0 - standard quality image generation",
    isActive: true,
    releaseDate: "2025-06-01",
    sources: {
      documentation: "https://ai.google.dev/gemini-api/docs/imagen",
      pricing: "https://ai.google.dev/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      sizes: ["1024x1024"],
      aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
      maxImagesPerRequest: 4,
      outputFormats: ["png", "jpeg"],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false
      },
      limits: { maxPromptLength: 480 },
      vendorOptions: {
        aspectRatio: {
          type: "enum",
          label: "Aspect Ratio",
          description: "Output image proportions",
          enum: ["1:1", "3:4", "4:3", "16:9", "9:16"],
          default: "1:1",
          controlType: "select"
        },
        sampleImageSize: {
          type: "enum",
          label: "Resolution",
          description: "Output image resolution",
          enum: ["1K", "2K"],
          default: "1K",
          controlType: "radio"
        },
        outputMimeType: {
          type: "enum",
          label: "Output Format",
          description: "Image file format",
          enum: ["image/png", "image/jpeg"],
          default: "image/png",
          controlType: "select"
        },
        negativePrompt: {
          type: "string",
          label: "Negative Prompt",
          description: "Elements to avoid in the generated image",
          controlType: "textarea"
        },
        personGeneration: {
          type: "enum",
          label: "Person Generation",
          description: "Controls whether people can appear in images",
          enum: ["dont_allow", "allow_adult", "allow_all"],
          default: "allow_adult",
          controlType: "select"
        },
        safetyFilterLevel: {
          type: "enum",
          label: "Safety Filter",
          description: "Content safety filtering threshold",
          enum: ["block_none", "block_only_high", "block_medium_and_above", "block_low_and_above"],
          default: "block_medium_and_above",
          controlType: "select"
        },
        enhancePrompt: {
          type: "boolean",
          label: "Enhance Prompt",
          description: "Use LLM-based prompt rewriting for better quality",
          default: true,
          controlType: "checkbox"
        },
        seed: {
          type: "number",
          label: "Seed",
          description: "Random seed for reproducible generation (1-2147483647)",
          min: 1,
          max: 2147483647,
          controlType: "text"
        },
        addWatermark: {
          type: "boolean",
          label: "Add Watermark",
          description: "Add invisible SynthID watermark",
          default: true,
          controlType: "checkbox"
        },
        language: {
          type: "enum",
          label: "Prompt Language",
          description: "Language of the input prompt",
          enum: ["auto", "en", "zh", "zh-CN", "zh-TW", "hi", "ja", "ko", "pt", "es"],
          default: "en",
          controlType: "select"
        }
      }
    },
    pricing: {
      perImage: 0.04,
      currency: "USD"
    }
  },
  "imagen-4.0-ultra-generate-001": {
    name: "imagen-4.0-ultra-generate-001",
    displayName: "Imagen 4.0 Ultra",
    provider: Vendor.Google,
    description: "Google Imagen 4.0 Ultra - highest quality image generation",
    isActive: true,
    releaseDate: "2025-06-01",
    sources: {
      documentation: "https://ai.google.dev/gemini-api/docs/imagen",
      pricing: "https://ai.google.dev/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      sizes: ["1024x1024"],
      aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
      maxImagesPerRequest: 4,
      outputFormats: ["png", "jpeg"],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: true,
        transparency: false,
        promptRevision: false
      },
      limits: { maxPromptLength: 480 },
      vendorOptions: {
        aspectRatio: {
          type: "enum",
          label: "Aspect Ratio",
          description: "Output image proportions",
          enum: ["1:1", "3:4", "4:3", "16:9", "9:16"],
          default: "1:1",
          controlType: "select"
        },
        sampleImageSize: {
          type: "enum",
          label: "Resolution",
          description: "Output image resolution",
          enum: ["1K", "2K"],
          default: "1K",
          controlType: "radio"
        },
        outputMimeType: {
          type: "enum",
          label: "Output Format",
          description: "Image file format",
          enum: ["image/png", "image/jpeg"],
          default: "image/png",
          controlType: "select"
        },
        negativePrompt: {
          type: "string",
          label: "Negative Prompt",
          description: "Elements to avoid in the generated image",
          controlType: "textarea"
        },
        personGeneration: {
          type: "enum",
          label: "Person Generation",
          description: "Controls whether people can appear in images",
          enum: ["dont_allow", "allow_adult", "allow_all"],
          default: "allow_adult",
          controlType: "select"
        },
        safetyFilterLevel: {
          type: "enum",
          label: "Safety Filter",
          description: "Content safety filtering threshold",
          enum: ["block_none", "block_only_high", "block_medium_and_above", "block_low_and_above"],
          default: "block_medium_and_above",
          controlType: "select"
        },
        enhancePrompt: {
          type: "boolean",
          label: "Enhance Prompt",
          description: "Use LLM-based prompt rewriting for better quality",
          default: true,
          controlType: "checkbox"
        },
        seed: {
          type: "number",
          label: "Seed",
          description: "Random seed for reproducible generation (1-2147483647)",
          min: 1,
          max: 2147483647,
          controlType: "text"
        },
        addWatermark: {
          type: "boolean",
          label: "Add Watermark",
          description: "Add invisible SynthID watermark",
          default: true,
          controlType: "checkbox"
        },
        language: {
          type: "enum",
          label: "Prompt Language",
          description: "Language of the input prompt",
          enum: ["auto", "en", "zh", "zh-CN", "zh-TW", "hi", "ja", "ko", "pt", "es"],
          default: "en",
          controlType: "select"
        }
      }
    },
    pricing: {
      perImage: 0.08,
      currency: "USD"
    }
  },
  "imagen-4.0-fast-generate-001": {
    name: "imagen-4.0-fast-generate-001",
    displayName: "Imagen 4.0 Fast",
    provider: Vendor.Google,
    description: "Google Imagen 4.0 Fast - optimized for speed",
    isActive: true,
    releaseDate: "2025-06-01",
    sources: {
      documentation: "https://ai.google.dev/gemini-api/docs/imagen",
      pricing: "https://ai.google.dev/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      sizes: ["1024x1024"],
      aspectRatios: ["1:1", "3:4", "4:3", "9:16", "16:9"],
      maxImagesPerRequest: 4,
      outputFormats: ["png", "jpeg"],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false,
        transparency: false,
        promptRevision: false
      },
      limits: { maxPromptLength: 480 },
      vendorOptions: {
        aspectRatio: {
          type: "enum",
          label: "Aspect Ratio",
          description: "Output image proportions",
          enum: ["1:1", "3:4", "4:3", "16:9", "9:16"],
          default: "1:1",
          controlType: "select"
        },
        sampleImageSize: {
          type: "enum",
          label: "Resolution",
          description: "Output image resolution",
          enum: ["1K", "2K"],
          default: "1K",
          controlType: "radio"
        },
        outputMimeType: {
          type: "enum",
          label: "Output Format",
          description: "Image file format",
          enum: ["image/png", "image/jpeg"],
          default: "image/png",
          controlType: "select"
        },
        negativePrompt: {
          type: "string",
          label: "Negative Prompt",
          description: "Elements to avoid in the generated image",
          controlType: "textarea"
        },
        personGeneration: {
          type: "enum",
          label: "Person Generation",
          description: "Controls whether people can appear in images",
          enum: ["dont_allow", "allow_adult", "allow_all"],
          default: "allow_adult",
          controlType: "select"
        },
        safetyFilterLevel: {
          type: "enum",
          label: "Safety Filter",
          description: "Content safety filtering threshold",
          enum: ["block_none", "block_only_high", "block_medium_and_above", "block_low_and_above"],
          default: "block_medium_and_above",
          controlType: "select"
        },
        enhancePrompt: {
          type: "boolean",
          label: "Enhance Prompt",
          description: "Use LLM-based prompt rewriting for better quality",
          default: true,
          controlType: "checkbox"
        },
        seed: {
          type: "number",
          label: "Seed",
          description: "Random seed for reproducible generation (1-2147483647)",
          min: 1,
          max: 2147483647,
          controlType: "text"
        },
        addWatermark: {
          type: "boolean",
          label: "Add Watermark",
          description: "Add invisible SynthID watermark",
          default: true,
          controlType: "checkbox"
        },
        language: {
          type: "enum",
          label: "Prompt Language",
          description: "Language of the input prompt",
          enum: ["auto", "en", "zh", "zh-CN", "zh-TW", "hi", "ja", "ko", "pt", "es"],
          default: "en",
          controlType: "select"
        }
      }
    },
    pricing: {
      perImage: 0.02,
      currency: "USD"
    }
  },
  // ======================== xAI Grok ========================
  "grok-imagine-image": {
    name: "grok-imagine-image",
    displayName: "Grok Imagine Image",
    provider: Vendor.Grok,
    description: "xAI Grok Imagine image generation with aspect ratio control and editing support",
    isActive: true,
    releaseDate: "2025-01-01",
    sources: {
      documentation: "https://docs.x.ai/docs/guides/image-generation",
      pricing: "https://docs.x.ai/docs/models",
      lastVerified: "2026-02-01"
    },
    capabilities: {
      sizes: ["1024x1024"],
      aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
      maxImagesPerRequest: 10,
      outputFormats: ["png", "jpeg"],
      features: {
        generation: true,
        editing: true,
        variations: false,
        styleControl: false,
        qualityControl: false,
        // quality not supported by xAI API
        transparency: false,
        promptRevision: true
      },
      limits: { maxPromptLength: 4096 },
      vendorOptions: {
        n: {
          type: "number",
          label: "Number of Images",
          description: "Number of images to generate (1-10)",
          min: 1,
          max: 10,
          default: 1,
          controlType: "slider"
        },
        response_format: {
          type: "enum",
          label: "Response Format",
          description: "Format of the returned image",
          enum: ["url", "b64_json"],
          default: "url",
          controlType: "radio"
        }
      }
    },
    pricing: {
      perImage: 0.02,
      currency: "USD"
    }
  },
  "grok-2-image-1212": {
    name: "grok-2-image-1212",
    displayName: "Grok 2 Image",
    provider: Vendor.Grok,
    description: "xAI Grok 2 image generation (text-only input, no editing)",
    isActive: true,
    releaseDate: "2024-12-12",
    sources: {
      documentation: "https://docs.x.ai/docs/guides/image-generation",
      pricing: "https://docs.x.ai/docs/models",
      lastVerified: "2026-02-01"
    },
    capabilities: {
      sizes: ["1024x1024"],
      aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
      maxImagesPerRequest: 10,
      outputFormats: ["png", "jpeg"],
      features: {
        generation: true,
        editing: false,
        variations: false,
        styleControl: false,
        qualityControl: false,
        // quality not supported by xAI API
        transparency: false,
        promptRevision: false
      },
      limits: { maxPromptLength: 4096 },
      vendorOptions: {
        n: {
          type: "number",
          label: "Number of Images",
          description: "Number of images to generate (1-10)",
          min: 1,
          max: 10,
          default: 1,
          controlType: "slider"
        },
        response_format: {
          type: "enum",
          label: "Response Format",
          description: "Format of the returned image",
          enum: ["url", "b64_json"],
          default: "url",
          controlType: "radio"
        }
      }
    },
    pricing: {
      perImage: 0.07,
      currency: "USD"
    }
  }
};
var helpers = createRegistryHelpers(IMAGE_MODEL_REGISTRY);
var getImageModelInfo = helpers.getInfo;

// src/capabilities/images/ImageGeneration.ts
var ImageGeneration = class _ImageGeneration {
  provider;
  connector;
  defaultModel;
  constructor(connector) {
    this.connector = connector;
    this.provider = createImageProvider(connector);
    this.defaultModel = this.getDefaultModel();
  }
  /**
   * Create an ImageGeneration instance
   */
  static create(options) {
    const connector = typeof options.connector === "string" ? Connector.get(options.connector) : options.connector;
    if (!connector) {
      throw new Error(`Connector not found: ${options.connector}`);
    }
    return new _ImageGeneration(connector);
  }
  /**
   * Generate images from a text prompt
   */
  async generate(options) {
    const fullOptions = {
      model: options.model || this.defaultModel,
      prompt: options.prompt,
      size: options.size,
      quality: options.quality,
      style: options.style,
      n: options.n,
      response_format: options.response_format || "b64_json"
    };
    return this.provider.generateImage(fullOptions);
  }
  /**
   * Edit an existing image
   * Note: Not all models/vendors support this
   */
  async edit(options) {
    if (!this.provider.editImage) {
      throw new Error(`Image editing not supported by ${this.provider.name}`);
    }
    const fullOptions = {
      ...options,
      model: options.model || this.getEditModel()
    };
    return this.provider.editImage(fullOptions);
  }
  /**
   * Create variations of an existing image
   * Note: Only DALL-E 2 supports this
   */
  async createVariation(options) {
    if (!this.provider.createVariation) {
      throw new Error(`Image variations not supported by ${this.provider.name}`);
    }
    const fullOptions = {
      ...options,
      model: options.model || "dall-e-2"
      // Only DALL-E 2 supports variations
    };
    return this.provider.createVariation(fullOptions);
  }
  /**
   * List available models for this provider
   */
  async listModels() {
    if (this.provider.listModels) {
      return this.provider.listModels();
    }
    const vendor = this.connector.vendor;
    if (vendor && IMAGE_MODELS[vendor]) {
      return Object.values(IMAGE_MODELS[vendor]);
    }
    return [];
  }
  /**
   * Get information about a specific model
   */
  getModelInfo(modelName) {
    return getImageModelInfo(modelName);
  }
  /**
   * Get the underlying provider
   */
  getProvider() {
    return this.provider;
  }
  /**
   * Get the current connector
   */
  getConnector() {
    return this.connector;
  }
  /**
   * Get the default model for this vendor
   */
  getDefaultModel() {
    const vendor = this.connector.vendor;
    switch (vendor) {
      case Vendor.OpenAI:
        return IMAGE_MODELS[Vendor.OpenAI].DALL_E_3;
      case Vendor.Google:
        return IMAGE_MODELS[Vendor.Google].IMAGEN_4_GENERATE;
      case Vendor.Grok:
        return IMAGE_MODELS[Vendor.Grok].GROK_IMAGINE_IMAGE;
      default:
        throw new Error(`No default image model for vendor: ${vendor}`);
    }
  }
  /**
   * Get the default edit model for this vendor
   */
  getEditModel() {
    const vendor = this.connector.vendor;
    switch (vendor) {
      case Vendor.OpenAI:
        return IMAGE_MODELS[Vendor.OpenAI].GPT_IMAGE_1;
      case Vendor.Google:
        return IMAGE_MODELS[Vendor.Google].IMAGEN_4_GENERATE;
      case Vendor.Grok:
        return IMAGE_MODELS[Vendor.Grok].GROK_IMAGINE_IMAGE;
      default:
        throw new Error(`No edit model for vendor: ${vendor}`);
    }
  }
};

exports.ImageGeneration = ImageGeneration;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map