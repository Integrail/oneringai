'use strict';

var crypto2 = require('crypto');
var jose = require('jose');
var fs11 = require('fs');
var eventemitter3 = require('eventemitter3');
var path3 = require('path');
var OpenAI2 = require('openai');
var Anthropic = require('@anthropic-ai/sdk');
var genai = require('@google/genai');
var os = require('os');
require('@modelcontextprotocol/sdk/client/index.js');
require('@modelcontextprotocol/sdk/client/stdio.js');
require('@modelcontextprotocol/sdk/client/streamableHttp.js');
require('@modelcontextprotocol/sdk/types.js');
var fs10 = require('fs/promises');
var child_process = require('child_process');
var util = require('util');
var cheerio = require('cheerio');
var vm = require('vm');

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

var crypto2__namespace = /*#__PURE__*/_interopNamespace(crypto2);
var fs11__namespace = /*#__PURE__*/_interopNamespace(fs11);
var path3__namespace = /*#__PURE__*/_interopNamespace(path3);
var OpenAI2__default = /*#__PURE__*/_interopDefault(OpenAI2);
var Anthropic__default = /*#__PURE__*/_interopDefault(Anthropic);
var os__namespace = /*#__PURE__*/_interopNamespace(os);
var fs10__namespace = /*#__PURE__*/_interopNamespace(fs10);
var vm__namespace = /*#__PURE__*/_interopNamespace(vm);

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
function encrypt(text, password) {
  const salt = crypto2__namespace.randomBytes(SALT_LENGTH);
  const key = crypto2__namespace.pbkdf2Sync(password, salt, 1e5, KEY_LENGTH, "sha512");
  const iv = crypto2__namespace.randomBytes(IV_LENGTH);
  const cipher = crypto2__namespace.createCipheriv(ALGORITHM, key, iv);
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
  const key = crypto2__namespace.pbkdf2Sync(password, salt, 1e5, KEY_LENGTH, "sha512");
  const decipher = crypto2__namespace.createDecipheriv(ALGORITHM, key, iv);
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
    global.__oauthEncryptionKey = crypto2__namespace.randomBytes(32).toString("hex");
    console.warn(
      "WARNING: Using auto-generated encryption key. Tokens will not persist across restarts. Set OAUTH_ENCRYPTION_KEY environment variable for production!"
    );
  }
  return global.__oauthEncryptionKey;
}
function generateEncryptionKey() {
  return crypto2__namespace.randomBytes(32).toString("hex");
}
var ALGORITHM, IV_LENGTH, SALT_LENGTH, TAG_LENGTH, KEY_LENGTH;
var init_encryption = __esm({
  "src/connectors/oauth/utils/encryption.ts"() {
    ALGORITHM = "aes-256-gcm";
    IV_LENGTH = 16;
    SALT_LENGTH = 64;
    TAG_LENGTH = 16;
    KEY_LENGTH = 32;
  }
});

// src/connectors/oauth/infrastructure/storage/MemoryStorage.ts
exports.MemoryStorage = void 0;
var init_MemoryStorage = __esm({
  "src/connectors/oauth/infrastructure/storage/MemoryStorage.ts"() {
    init_encryption();
    exports.MemoryStorage = class {
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
  }
});

// src/connectors/oauth/domain/TokenStore.ts
var TokenStore;
var init_TokenStore = __esm({
  "src/connectors/oauth/domain/TokenStore.ts"() {
    init_MemoryStorage();
    TokenStore = class {
      storage;
      baseStorageKey;
      constructor(storageKey = "default", storage) {
        this.baseStorageKey = storageKey;
        this.storage = storage || new exports.MemoryStorage();
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
  }
});
function generatePKCE() {
  const codeVerifier = base64URLEncode(crypto2__namespace.randomBytes(32));
  const hash = crypto2__namespace.createHash("sha256").update(codeVerifier).digest();
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
  return crypto2__namespace.randomBytes(16).toString("hex");
}
var init_pkce = __esm({
  "src/connectors/oauth/utils/pkce.ts"() {
  }
});

// src/connectors/oauth/flows/AuthCodePKCE.ts
var AuthCodePKCEFlow;
var init_AuthCodePKCE = __esm({
  "src/connectors/oauth/flows/AuthCodePKCE.ts"() {
    init_TokenStore();
    init_pkce();
    AuthCodePKCEFlow = class {
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
  }
});

// src/connectors/oauth/flows/ClientCredentials.ts
var ClientCredentialsFlow;
var init_ClientCredentials = __esm({
  "src/connectors/oauth/flows/ClientCredentials.ts"() {
    init_TokenStore();
    ClientCredentialsFlow = class {
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
  }
});
var JWTBearerFlow;
var init_JWTBearer = __esm({
  "src/connectors/oauth/flows/JWTBearer.ts"() {
    init_TokenStore();
    JWTBearerFlow = class {
      constructor(config) {
        this.config = config;
        const storageKey = config.storageKey || `jwt_bearer:${config.clientId}`;
        this.tokenStore = new TokenStore(storageKey, config.storage);
        if (config.privateKey) {
          this.privateKey = config.privateKey;
        } else if (config.privateKeyPath) {
          try {
            this.privateKey = fs11__namespace.readFileSync(config.privateKeyPath, "utf8");
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
  }
});

// src/connectors/oauth/flows/StaticToken.ts
var StaticTokenFlow;
var init_StaticToken = __esm({
  "src/connectors/oauth/flows/StaticToken.ts"() {
    StaticTokenFlow = class {
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
  }
});

// src/connectors/oauth/OAuthManager.ts
exports.OAuthManager = void 0;
var init_OAuthManager = __esm({
  "src/connectors/oauth/OAuthManager.ts"() {
    init_AuthCodePKCE();
    init_ClientCredentials();
    init_JWTBearer();
    init_StaticToken();
    exports.OAuthManager = class {
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
  }
});
exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = void 0; exports.CircuitOpenError = void 0; exports.CircuitBreaker = void 0;
var init_CircuitBreaker = __esm({
  "src/infrastructure/resilience/CircuitBreaker.ts"() {
    exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = {
      failureThreshold: 5,
      successThreshold: 2,
      resetTimeoutMs: 3e4,
      // 30 seconds
      windowMs: 6e4,
      // 1 minute
      isRetryable: () => true
      // All errors count by default
    };
    exports.CircuitOpenError = class extends Error {
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
    exports.CircuitBreaker = class extends eventemitter3.EventEmitter {
      constructor(name, config = {}) {
        super();
        this.name = name;
        this.config = { ...exports.DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
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
              throw new exports.CircuitOpenError(this.name, nextRetry, this.failures.length, this.lastError);
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
  }
});

// src/infrastructure/resilience/BackoffStrategy.ts
function calculateBackoff(attempt, config = exports.DEFAULT_BACKOFF_CONFIG) {
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
async function backoffWait(attempt, config = exports.DEFAULT_BACKOFF_CONFIG) {
  const delay = calculateBackoff(attempt, config);
  await new Promise((resolve3) => setTimeout(resolve3, delay));
  return delay;
}
function* backoffSequence(config = exports.DEFAULT_BACKOFF_CONFIG, maxAttempts) {
  let attempt = 1;
  while (true) {
    if (maxAttempts && attempt > maxAttempts) {
      return;
    }
    yield calculateBackoff(attempt, config);
    attempt++;
  }
}
async function retryWithBackoff(fn, config = exports.DEFAULT_BACKOFF_CONFIG, maxAttempts) {
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
exports.DEFAULT_BACKOFF_CONFIG = void 0;
var init_BackoffStrategy = __esm({
  "src/infrastructure/resilience/BackoffStrategy.ts"() {
    exports.DEFAULT_BACKOFF_CONFIG = {
      strategy: "exponential",
      initialDelayMs: 1e3,
      // 1 second
      maxDelayMs: 3e4,
      // 30 seconds
      multiplier: 2,
      jitter: true,
      jitterFactor: 0.1
    };
  }
});
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
var LOG_LEVEL_VALUES; exports.FrameworkLogger = void 0; exports.logger = void 0;
var init_Logger = __esm({
  "src/infrastructure/observability/Logger.ts"() {
    LOG_LEVEL_VALUES = {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      silent: 100
    };
    exports.FrameworkLogger = class _FrameworkLogger {
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
          const dir = path3__namespace.dirname(filePath);
          if (!fs11__namespace.existsSync(dir)) {
            fs11__namespace.mkdirSync(dir, { recursive: true });
          }
          this.fileStream = fs11__namespace.createWriteStream(filePath, {
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
    exports.logger = new exports.FrameworkLogger({
      level: process.env.LOG_LEVEL || "info",
      pretty: process.env.LOG_PRETTY === "true" || process.env.NODE_ENV === "development",
      filePath: process.env.LOG_FILE
    });
    process.on("exit", () => {
      exports.logger.close();
    });
    process.on("SIGINT", () => {
      exports.logger.close();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      exports.logger.close();
      process.exit(0);
    });
  }
});

// src/infrastructure/observability/Metrics.ts
function createMetricsCollector(type, prefix) {
  const collectorType = type || process.env.METRICS_COLLECTOR || "noop";
  switch (collectorType) {
    case "console":
      return new exports.ConsoleMetrics(prefix);
    case "inmemory":
      return new exports.InMemoryMetrics();
    default:
      return new exports.NoOpMetrics();
  }
}
function setMetricsCollector(collector) {
  Object.assign(exports.metrics, collector);
}
exports.NoOpMetrics = void 0; exports.ConsoleMetrics = void 0; exports.InMemoryMetrics = void 0; exports.metrics = void 0;
var init_Metrics = __esm({
  "src/infrastructure/observability/Metrics.ts"() {
    exports.NoOpMetrics = class {
      increment() {
      }
      gauge() {
      }
      timing() {
      }
      histogram() {
      }
    };
    exports.ConsoleMetrics = class {
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
    exports.InMemoryMetrics = class {
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
    exports.metrics = createMetricsCollector(
      void 0,
      process.env.METRICS_PREFIX || "oneringai"
    );
  }
});

// src/core/Connector.ts
var Connector_exports = {};
__export(Connector_exports, {
  Connector: () => exports.Connector,
  DEFAULT_BASE_DELAY_MS: () => exports.DEFAULT_BASE_DELAY_MS,
  DEFAULT_CONNECTOR_TIMEOUT: () => exports.DEFAULT_CONNECTOR_TIMEOUT,
  DEFAULT_MAX_DELAY_MS: () => exports.DEFAULT_MAX_DELAY_MS,
  DEFAULT_MAX_RETRIES: () => exports.DEFAULT_MAX_RETRIES,
  DEFAULT_RETRYABLE_STATUSES: () => exports.DEFAULT_RETRYABLE_STATUSES
});
exports.DEFAULT_CONNECTOR_TIMEOUT = void 0; exports.DEFAULT_MAX_RETRIES = void 0; exports.DEFAULT_RETRYABLE_STATUSES = void 0; exports.DEFAULT_BASE_DELAY_MS = void 0; exports.DEFAULT_MAX_DELAY_MS = void 0; exports.Connector = void 0;
var init_Connector = __esm({
  "src/core/Connector.ts"() {
    init_OAuthManager();
    init_MemoryStorage();
    init_CircuitBreaker();
    init_BackoffStrategy();
    init_Logger();
    init_Metrics();
    exports.DEFAULT_CONNECTOR_TIMEOUT = 3e4;
    exports.DEFAULT_MAX_RETRIES = 3;
    exports.DEFAULT_RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
    exports.DEFAULT_BASE_DELAY_MS = 1e3;
    exports.DEFAULT_MAX_DELAY_MS = 3e4;
    exports.Connector = class _Connector {
      // ============ Static Registry ============
      static registry = /* @__PURE__ */ new Map();
      static defaultStorage = new exports.MemoryStorage();
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
          this.circuitBreaker = new exports.CircuitBreaker(`connector:${this.name}`, {
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
            exports.logger.warn(`Circuit breaker opened for ${name}: ${failureCount} failures, last error: ${lastError}`);
            exports.metrics.increment("connector.circuit_breaker.opened", 1, { connector: this.name });
          });
          this.circuitBreaker.on("closed", ({ name }) => {
            exports.logger.info(`Circuit breaker closed for ${name}`);
            exports.metrics.increment("connector.circuit_breaker.closed", 1, { connector: this.name });
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
        const timeout = options?.timeout ?? this.config.timeout ?? exports.DEFAULT_CONNECTOR_TIMEOUT;
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
          const maxRetries = retryConfig?.maxRetries ?? exports.DEFAULT_MAX_RETRIES;
          const retryableStatuses = retryConfig?.retryableStatuses ?? exports.DEFAULT_RETRYABLE_STATUSES;
          const baseDelayMs = retryConfig?.baseDelayMs ?? exports.DEFAULT_BASE_DELAY_MS;
          const maxDelayMs = retryConfig?.maxDelayMs ?? exports.DEFAULT_MAX_DELAY_MS;
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
                  exports.logger.debug(`Connector ${this.name}: Retry ${attempt}/${maxRetries} after ${delay}ms (status ${response.status})`);
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
                  exports.logger.debug(`Connector ${this.name}: Retry ${attempt}/${maxRetries} after ${delay}ms (error: ${lastError.message})`);
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
          exports.metrics.timing("connector.latency", latency, { connector: this.name });
          exports.metrics.increment("connector.success", 1, { connector: this.name });
          if (this.config.logging?.enabled) {
            this.logResponse(url, response, latency);
          }
          return response;
        } catch (error) {
          const latency = Date.now() - startTime;
          this.failureCount++;
          this.totalLatencyMs += latency;
          exports.metrics.increment("connector.failure", 1, { connector: this.name, error: error.name });
          if (this.config.logging?.enabled) {
            exports.logger.error(
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
        return new Promise((resolve3) => setTimeout(resolve3, ms));
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
        exports.logger.debug(logData, `Connector ${this.name} request`);
      }
      logResponse(url, response, latency) {
        exports.logger.debug(
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
        this.oauthManager = new exports.OAuthManager(oauthConfig);
      }
      initJWTManager(auth) {
        this.oauthManager = new exports.OAuthManager({
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
  }
});

// src/core/index.ts
init_Connector();

// src/core/BaseAgent.ts
init_Connector();

// src/core/ToolManager.ts
init_CircuitBreaker();

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
var DependencyCycleError = class _DependencyCycleError extends AIError {
  constructor(cycle, planId) {
    super(
      `Dependency cycle detected: ${cycle.join(" -> ")}`,
      "DEPENDENCY_CYCLE",
      400
    );
    this.cycle = cycle;
    this.planId = planId;
    this.name = "DependencyCycleError";
    Object.setPrototypeOf(this, _DependencyCycleError.prototype);
  }
};
var TaskTimeoutError = class _TaskTimeoutError extends AIError {
  constructor(taskId, taskName, timeoutMs) {
    super(
      `Task '${taskName}' (${taskId}) timed out after ${timeoutMs}ms`,
      "TASK_TIMEOUT",
      408
    );
    this.taskId = taskId;
    this.taskName = taskName;
    this.timeoutMs = timeoutMs;
    this.name = "TaskTimeoutError";
    Object.setPrototypeOf(this, _TaskTimeoutError.prototype);
  }
};
var TaskValidationError = class _TaskValidationError extends AIError {
  constructor(taskId, taskName, reason) {
    super(
      `Task '${taskName}' (${taskId}) validation failed: ${reason}`,
      "TASK_VALIDATION_ERROR",
      422
    );
    this.taskId = taskId;
    this.taskName = taskName;
    this.reason = reason;
    this.name = "TaskValidationError";
    Object.setPrototypeOf(this, _TaskValidationError.prototype);
  }
};
var ParallelTasksError = class _ParallelTasksError extends AIError {
  constructor(failures) {
    const names = failures.map((f) => f.taskName).join(", ");
    super(
      `Multiple tasks failed in parallel execution: ${names}`,
      "PARALLEL_TASKS_ERROR",
      500
    );
    this.failures = failures;
    this.name = "ParallelTasksError";
    Object.setPrototypeOf(this, _ParallelTasksError.prototype);
  }
  /**
   * Get all failure errors
   */
  getErrors() {
    return this.failures.map((f) => f.error);
  }
  /**
   * Get failed task IDs
   */
  getFailedTaskIds() {
    return this.failures.map((f) => f.taskId);
  }
};

// src/core/ToolManager.ts
init_Logger();
init_Metrics();
var ToolManager = class extends eventemitter3.EventEmitter {
  registry = /* @__PURE__ */ new Map();
  namespaceIndex = /* @__PURE__ */ new Map();
  circuitBreakers = /* @__PURE__ */ new Map();
  toolLogger;
  _isDestroyed = false;
  /** Optional tool context for execution (set by agent before runs) */
  _toolContext;
  constructor() {
    super();
    this.namespaceIndex.set("default", /* @__PURE__ */ new Set());
    this.toolLogger = exports.logger.child({ component: "ToolManager" });
  }
  /**
   * Returns true if destroy() has been called.
   */
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Releases all resources held by this ToolManager.
   * Cleans up circuit breaker listeners and removes all event listeners.
   * Safe to call multiple times (idempotent).
   */
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    for (const breaker of this.circuitBreakers.values()) {
      breaker.removeAllListeners();
    }
    this.circuitBreakers.clear();
    this.registry.clear();
    this.namespaceIndex.clear();
    this.removeAllListeners();
  }
  /**
   * Set tool context for execution (called by agent before runs)
   */
  setToolContext(context) {
    this._toolContext = context;
  }
  /**
   * Get current tool context
   */
  getToolContext() {
    return this._toolContext;
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
      if (options.permission !== void 0) existing.permission = options.permission;
      return;
    }
    const namespace = options.namespace ?? "default";
    const effectivePermission = options.permission ?? tool.permission;
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
      },
      permission: effectivePermission
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
    const breaker = this.circuitBreakers.get(name);
    if (breaker) {
      breaker.removeAllListeners();
      this.circuitBreakers.delete(name);
    }
    this.emit("tool:unregistered", { name });
    return true;
  }
  /**
   * Clear all tools and their circuit breakers.
   * Does NOT remove event listeners from this ToolManager (use destroy() for full cleanup).
   */
  clear() {
    this.registry.clear();
    this.namespaceIndex.clear();
    this.namespaceIndex.set("default", /* @__PURE__ */ new Set());
    for (const breaker of this.circuitBreakers.values()) {
      breaker.removeAllListeners();
    }
    this.circuitBreakers.clear();
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
  /**
   * Get permission config for a tool
   */
  getPermission(name) {
    return this.registry.get(name)?.permission;
  }
  /**
   * Set permission config for a tool
   */
  setPermission(name, permission) {
    const registration = this.registry.get(name);
    if (!registration) return false;
    registration.permission = permission;
    return true;
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
  /**
   * Summarize tool result for logging (handles various result types)
   */
  summarizeResult(result) {
    if (result === null || result === void 0) {
      return { type: "null" };
    }
    if (typeof result !== "object") {
      return { type: typeof result, value: String(result).slice(0, 100) };
    }
    const obj = result;
    if ("success" in obj) {
      const summary = {
        success: obj.success
      };
      if ("error" in obj) summary.error = obj.error;
      if ("count" in obj) summary.count = obj.count;
      if ("results" in obj && Array.isArray(obj.results)) {
        summary.resultCount = obj.results.length;
      }
      if ("provider" in obj) summary.provider = obj.provider;
      return summary;
    }
    if (Array.isArray(result)) {
      return { type: "array", length: result.length };
    }
    const keys = Object.keys(obj);
    return {
      type: "object",
      keys: keys.slice(0, 10),
      keyCount: keys.length
    };
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
  // Execution (IToolExecutor implementation)
  // ==========================================================================
  /**
   * Execute a tool function with circuit breaker protection
   * Implements IToolExecutor interface
   */
  async execute(toolName, args) {
    const registration = this.registry.get(toolName);
    if (!registration) {
      throw new ToolNotFoundError(toolName);
    }
    if (!registration.enabled) {
      throw new ToolExecutionError(toolName, "Tool is disabled");
    }
    const breaker = this.getOrCreateCircuitBreaker(toolName, registration);
    this.toolLogger.debug({ toolName, args }, "Tool execution started");
    const startTime = Date.now();
    exports.metrics.increment("tool.executed", 1, { tool: toolName });
    try {
      const result = await breaker.execute(async () => {
        return await registration.tool.execute(args, this._toolContext);
      });
      const duration = Date.now() - startTime;
      this.recordExecution(toolName, duration, true);
      const resultSummary = this.summarizeResult(result);
      this.toolLogger.debug({
        toolName,
        duration,
        resultSummary
      }, "Tool execution completed");
      exports.metrics.timing("tool.duration", duration, { tool: toolName });
      exports.metrics.increment("tool.success", 1, { tool: toolName });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordExecution(toolName, duration, false);
      this.toolLogger.error({
        toolName,
        error: error.message,
        duration
      }, "Tool execution failed");
      exports.metrics.increment("tool.failed", 1, {
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
   * Check if tool is available (IToolExecutor interface)
   */
  hasToolFunction(toolName) {
    return this.registry.has(toolName);
  }
  /**
   * Get tool definition (IToolExecutor interface)
   */
  getToolDefinition(toolName) {
    const registration = this.registry.get(toolName);
    return registration?.tool.definition;
  }
  /**
   * Register a tool (IToolExecutor interface - delegates to register())
   */
  registerTool(tool) {
    this.register(tool);
  }
  /**
   * Unregister a tool (IToolExecutor interface - delegates to unregister())
   */
  unregisterTool(toolName) {
    this.unregister(toolName);
  }
  /**
   * List all registered tool names (IToolExecutor interface - delegates to list())
   */
  listTools() {
    return this.list();
  }
  // ==========================================================================
  // Circuit Breaker Management
  // ==========================================================================
  /**
   * Get or create circuit breaker for a tool
   */
  getOrCreateCircuitBreaker(toolName, registration) {
    let breaker = this.circuitBreakers.get(toolName);
    if (!breaker) {
      const config = registration.circuitBreakerConfig || {
        failureThreshold: 3,
        successThreshold: 2,
        resetTimeoutMs: 6e4,
        // 1 minute
        windowMs: 3e5
        // 5 minutes
      };
      breaker = new exports.CircuitBreaker(`tool:${toolName}`, config);
      breaker.on("opened", (data) => {
        this.toolLogger.warn(data, `Circuit breaker opened for tool: ${toolName}`);
        exports.metrics.increment("circuit_breaker.opened", 1, {
          breaker: data.name,
          tool: toolName
        });
      });
      breaker.on("closed", (data) => {
        this.toolLogger.info(data, `Circuit breaker closed for tool: ${toolName}`);
        exports.metrics.increment("circuit_breaker.closed", 1, {
          breaker: data.name,
          tool: toolName
        });
      });
      this.circuitBreakers.set(toolName, breaker);
    }
    return breaker;
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
      this.toolLogger.info({ toolName }, "Tool circuit breaker manually reset");
    }
  }
  /**
   * Configure circuit breaker for a tool
   */
  setCircuitBreakerConfig(toolName, config) {
    const registration = this.registry.get(toolName);
    if (!registration) return false;
    registration.circuitBreakerConfig = config;
    const existingBreaker = this.circuitBreakers.get(toolName);
    if (existingBreaker) {
      existingBreaker.removeAllListeners();
      this.circuitBreakers.delete(toolName);
    }
    return true;
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
    const permissions = {};
    for (const [name, reg] of this.registry) {
      enabled[name] = reg.enabled;
      namespaces[name] = reg.namespace;
      priorities[name] = reg.priority;
      if (reg.permission) {
        permissions[name] = reg.permission;
      }
    }
    return { enabled, namespaces, priorities, permissions };
  }
  /**
   * Load state (restores enabled/disabled, namespaces, priorities, permissions)
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
    if (state.permissions) {
      for (const [name, permission] of Object.entries(state.permissions)) {
        this.setPermission(name, permission);
      }
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
var HISTORY_FORMAT_VERSION = 1;
var MEMORY_FORMAT_VERSION = 1;
var PLAN_FORMAT_VERSION = 1;
var SessionValidationError = class extends Error {
  constructor(sessionId, errors) {
    super(`Session validation failed for ${sessionId}: ${errors.join(", ")}`);
    this.sessionId = sessionId;
    this.errors = errors;
    this.name = "SessionValidationError";
  }
};
function validateSession(session) {
  const errors = [];
  const warnings = [];
  const migrations = [];
  if (!session || typeof session !== "object") {
    return {
      valid: false,
      errors: ["Session is not an object"],
      warnings: [],
      canMigrate: false,
      migrations: []
    };
  }
  const s = session;
  if (!s.id || typeof s.id !== "string") {
    errors.push("Missing or invalid session id");
  }
  if (!s.agentType || typeof s.agentType !== "string") {
    errors.push("Missing or invalid agentType");
  }
  if (!s.createdAt) {
    warnings.push("Missing createdAt, will use current time");
    migrations.push({
      field: "createdAt",
      type: "add_default",
      description: "Add default createdAt timestamp",
      apply: (sess) => {
        sess.createdAt = /* @__PURE__ */ new Date();
      }
    });
  }
  if (!s.lastActiveAt) {
    warnings.push("Missing lastActiveAt, will use current time");
    migrations.push({
      field: "lastActiveAt",
      type: "add_default",
      description: "Add default lastActiveAt timestamp",
      apply: (sess) => {
        sess.lastActiveAt = /* @__PURE__ */ new Date();
      }
    });
  }
  if (!s.history) {
    warnings.push("Missing history, will create empty history");
    migrations.push({
      field: "history",
      type: "add_default",
      description: "Add empty history",
      apply: (sess) => {
        sess.history = { version: HISTORY_FORMAT_VERSION, entries: [] };
      }
    });
  } else if (typeof s.history === "object") {
    const historyVersion = s.history.version;
    if (historyVersion === void 0) {
      warnings.push("History missing version, assuming version 1");
      migrations.push({
        field: "history.version",
        type: "add_default",
        description: "Add history version",
        apply: (sess) => {
          if (sess.history) {
            sess.history.version = 1;
          }
        }
      });
    } else if (historyVersion > HISTORY_FORMAT_VERSION) {
      errors.push(
        `History version ${historyVersion} is newer than supported version ${HISTORY_FORMAT_VERSION}`
      );
    }
  }
  if (!s.toolState) {
    warnings.push("Missing toolState, will create empty toolState");
    migrations.push({
      field: "toolState",
      type: "add_default",
      description: "Add empty toolState",
      apply: (sess) => {
        sess.toolState = { enabled: {}, namespaces: {}, priorities: {}, permissions: {} };
      }
    });
  }
  if (!s.custom || typeof s.custom !== "object") {
    warnings.push("Missing custom object, will create empty object");
    migrations.push({
      field: "custom",
      type: "add_default",
      description: "Add empty custom object",
      apply: (sess) => {
        sess.custom = {};
      }
    });
  }
  if (!s.metadata || typeof s.metadata !== "object") {
    warnings.push("Missing metadata, will create empty metadata");
    migrations.push({
      field: "metadata",
      type: "add_default",
      description: "Add empty metadata",
      apply: (sess) => {
        sess.metadata = {};
      }
    });
  }
  if (s.memory && typeof s.memory === "object") {
    const memoryVersion = s.memory.version;
    if (memoryVersion === void 0) {
      warnings.push("Memory missing version, assuming version 1");
      migrations.push({
        field: "memory.version",
        type: "add_default",
        description: "Add memory version",
        apply: (sess) => {
          if (sess.memory) {
            sess.memory.version = 1;
          }
        }
      });
    } else if (memoryVersion > MEMORY_FORMAT_VERSION) {
      errors.push(
        `Memory version ${memoryVersion} is newer than supported version ${MEMORY_FORMAT_VERSION}`
      );
    }
  }
  if (s.plan && typeof s.plan === "object") {
    const planVersion = s.plan.version;
    if (planVersion === void 0) {
      warnings.push("Plan missing version, assuming version 1");
      migrations.push({
        field: "plan.version",
        type: "add_default",
        description: "Add plan version",
        apply: (sess) => {
          if (sess.plan) {
            sess.plan.version = 1;
          }
        }
      });
    } else if (planVersion > PLAN_FORMAT_VERSION) {
      errors.push(
        `Plan version ${planVersion} is newer than supported version ${PLAN_FORMAT_VERSION}`
      );
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    canMigrate: errors.length === 0 && migrations.length > 0,
    migrations
  };
}
function migrateSession(session, migrations) {
  for (const migration of migrations) {
    migration.apply(session);
  }
  return session;
}
var SessionManager = class extends eventemitter3.EventEmitter {
  storage;
  defaultMetadata;
  autoSaveTimers = /* @__PURE__ */ new Map();
  validateOnLoad;
  autoMigrate;
  _isDestroyed = false;
  // Track in-flight saves to prevent race conditions
  savesInFlight = /* @__PURE__ */ new Set();
  pendingSaves = /* @__PURE__ */ new Set();
  constructor(config) {
    super();
    this.storage = config.storage;
    this.defaultMetadata = config.defaultMetadata ?? {};
    this.validateOnLoad = config.validateOnLoad ?? true;
    this.autoMigrate = config.autoMigrate ?? true;
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
      let session = await this.storage.load(sessionId);
      if (!session) {
        return null;
      }
      if (this.validateOnLoad) {
        const validation = validateSession(session);
        if (validation.warnings.length > 0) {
          this.emit("session:warning", {
            sessionId,
            warnings: validation.warnings
          });
        }
        if (!validation.valid) {
          throw new SessionValidationError(sessionId, validation.errors);
        }
        if (validation.canMigrate && this.autoMigrate) {
          session = migrateSession(session, validation.migrations);
          this.emit("session:migrated", {
            sessionId,
            migrations: validation.migrations.map((m) => m.description)
          });
        }
      }
      session.createdAt = new Date(session.createdAt);
      session.lastActiveAt = new Date(session.lastActiveAt);
      this.emit("session:loaded", { sessionId });
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
      const sessionId = session.id;
      if (this.savesInFlight.has(sessionId)) {
        this.pendingSaves.add(sessionId);
        return;
      }
      this.savesInFlight.add(sessionId);
      try {
        await this.save(session);
        onSave?.(session);
      } catch (error) {
        this.emit("session:error", {
          sessionId,
          error,
          operation: "auto-save"
        });
      } finally {
        this.savesInFlight.delete(sessionId);
        if (this.pendingSaves.has(sessionId)) {
          this.pendingSaves.delete(sessionId);
          this.save(session).catch((error) => {
            this.emit("session:error", {
              sessionId,
              error,
              operation: "auto-save-retry"
            });
          });
        }
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
   * Check if the SessionManager instance has been destroyed
   */
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Cleanup resources
   */
  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
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

// src/core/permissions/types.ts
var APPROVAL_STATE_VERSION = 1;
var DEFAULT_PERMISSION_CONFIG = {
  scope: "once",
  riskLevel: "low"
};
var DEFAULT_ALLOWLIST = [
  // Filesystem read-only tools
  "read_file",
  "glob",
  "grep",
  "list_directory",
  // Memory management (internal state - safe)
  "memory_store",
  "memory_retrieve",
  "memory_delete",
  "memory_list",
  // Context introspection (read-only)
  "context_inspect",
  "context_breakdown",
  "cache_stats",
  "memory_stats",
  // Meta-tools (internal coordination)
  "_start_planning",
  "_modify_plan",
  "_report_progress",
  "_request_approval"
  // CRITICAL: Must be allowlisted to avoid circular dependency!
];

// src/core/permissions/ToolPermissionManager.ts
var ToolPermissionManager = class extends eventemitter3.EventEmitter {
  // Approval cache (session-level)
  approvalCache = /* @__PURE__ */ new Map();
  // Allow/block lists
  allowlist = /* @__PURE__ */ new Set();
  blocklist = /* @__PURE__ */ new Set();
  // Per-tool configurations
  toolConfigs = /* @__PURE__ */ new Map();
  // Defaults
  defaultScope;
  defaultRiskLevel;
  // Optional approval callback
  onApprovalRequired;
  constructor(config) {
    super();
    this.defaultScope = config?.defaultScope ?? DEFAULT_PERMISSION_CONFIG.scope;
    this.defaultRiskLevel = config?.defaultRiskLevel ?? DEFAULT_PERMISSION_CONFIG.riskLevel;
    for (const toolName of DEFAULT_ALLOWLIST) {
      this.allowlist.add(toolName);
    }
    if (config?.allowlist) {
      for (const toolName of config.allowlist) {
        this.allowlist.add(toolName);
      }
    }
    if (config?.blocklist) {
      for (const toolName of config.blocklist) {
        this.blocklist.add(toolName);
      }
    }
    if (config?.tools) {
      for (const [toolName, toolConfig] of Object.entries(config.tools)) {
        this.toolConfigs.set(toolName, toolConfig);
      }
    }
    this.onApprovalRequired = config?.onApprovalRequired;
  }
  // ==========================================================================
  // Core Permission Checking
  // ==========================================================================
  /**
   * Check if a tool needs approval before execution
   *
   * @param toolName - Name of the tool
   * @param _args - Optional arguments (for args-specific approval, reserved for future use)
   * @returns PermissionCheckResult with allowed/needsApproval/blocked status
   */
  checkPermission(toolName, _args) {
    const config = this.getEffectiveConfig(toolName);
    if (this.blocklist.has(toolName)) {
      return {
        allowed: false,
        needsApproval: false,
        blocked: true,
        reason: "Tool is blocklisted",
        config
      };
    }
    if (this.allowlist.has(toolName)) {
      return {
        allowed: true,
        needsApproval: false,
        blocked: false,
        reason: "Tool is allowlisted",
        config
      };
    }
    const scope = config.scope ?? this.defaultScope;
    switch (scope) {
      case "always":
        return {
          allowed: true,
          needsApproval: false,
          blocked: false,
          reason: 'Tool scope is "always"',
          config
        };
      case "never":
        return {
          allowed: false,
          needsApproval: false,
          blocked: true,
          reason: 'Tool scope is "never"',
          config
        };
      case "session":
        if (this.isApprovedForSession(toolName)) {
          return {
            allowed: true,
            needsApproval: false,
            blocked: false,
            reason: "Tool approved for session",
            config
          };
        }
        return {
          allowed: false,
          needsApproval: true,
          blocked: false,
          reason: "Session approval required",
          config
        };
      case "once":
      default:
        return {
          allowed: false,
          needsApproval: true,
          blocked: false,
          reason: "Per-call approval required",
          config
        };
    }
  }
  /**
   * Check if a tool call needs approval (uses ToolCall object)
   */
  needsApproval(toolCall) {
    const result = this.checkPermission(toolCall.function.name);
    return result.needsApproval;
  }
  /**
   * Check if a tool is blocked
   */
  isBlocked(toolName) {
    return this.checkPermission(toolName).blocked;
  }
  /**
   * Check if a tool is approved (either allowlisted or session-approved)
   */
  isApproved(toolName) {
    return this.checkPermission(toolName).allowed;
  }
  // ==========================================================================
  // Approval Management
  // ==========================================================================
  /**
   * Approve a tool (record approval)
   *
   * @param toolName - Name of the tool
   * @param decision - Approval decision with scope
   */
  approve(toolName, decision) {
    const scope = decision?.scope ?? "session";
    const config = this.getEffectiveConfig(toolName);
    let expiresAt;
    if (scope === "session" && config.sessionTTLMs) {
      expiresAt = new Date(Date.now() + config.sessionTTLMs);
    }
    const entry = {
      toolName,
      scope,
      approvedAt: /* @__PURE__ */ new Date(),
      approvedBy: decision?.approvedBy,
      expiresAt
    };
    this.approvalCache.set(toolName, entry);
    this.emit("tool:approved", {
      toolName,
      scope,
      approvedBy: decision?.approvedBy
    });
  }
  /**
   * Approve a tool for the entire session
   */
  approveForSession(toolName, approvedBy) {
    this.approve(toolName, { scope: "session", approvedBy });
  }
  /**
   * Revoke a tool's approval
   */
  revoke(toolName) {
    if (this.approvalCache.has(toolName)) {
      this.approvalCache.delete(toolName);
      this.emit("tool:revoked", { toolName });
    }
  }
  /**
   * Deny a tool execution (for audit trail)
   */
  deny(toolName, reason) {
    this.emit("tool:denied", { toolName, reason });
  }
  /**
   * Check if a tool has been approved for the current session
   */
  isApprovedForSession(toolName) {
    const entry = this.approvalCache.get(toolName);
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt < /* @__PURE__ */ new Date()) {
      this.approvalCache.delete(toolName);
      return false;
    }
    return entry.scope === "session" || entry.scope === "always";
  }
  // ==========================================================================
  // Allowlist / Blocklist Management
  // ==========================================================================
  /**
   * Add a tool to the allowlist (always allowed)
   */
  allowlistAdd(toolName) {
    this.blocklist.delete(toolName);
    this.allowlist.add(toolName);
    this.emit("allowlist:added", { toolName });
  }
  /**
   * Remove a tool from the allowlist
   */
  allowlistRemove(toolName) {
    if (this.allowlist.delete(toolName)) {
      this.emit("allowlist:removed", { toolName });
    }
  }
  /**
   * Check if a tool is in the allowlist
   */
  isAllowlisted(toolName) {
    return this.allowlist.has(toolName);
  }
  /**
   * Get all allowlisted tools
   */
  getAllowlist() {
    return Array.from(this.allowlist);
  }
  /**
   * Add a tool to the blocklist (always blocked)
   */
  blocklistAdd(toolName) {
    this.allowlist.delete(toolName);
    this.blocklist.add(toolName);
    this.emit("blocklist:added", { toolName });
  }
  /**
   * Remove a tool from the blocklist
   */
  blocklistRemove(toolName) {
    if (this.blocklist.delete(toolName)) {
      this.emit("blocklist:removed", { toolName });
    }
  }
  /**
   * Check if a tool is in the blocklist
   */
  isBlocklisted(toolName) {
    return this.blocklist.has(toolName);
  }
  /**
   * Get all blocklisted tools
   */
  getBlocklist() {
    return Array.from(this.blocklist);
  }
  // ==========================================================================
  // Tool Configuration
  // ==========================================================================
  /**
   * Set permission config for a specific tool
   */
  setToolConfig(toolName, config) {
    this.toolConfigs.set(toolName, config);
  }
  /**
   * Get permission config for a specific tool
   */
  getToolConfig(toolName) {
    return this.toolConfigs.get(toolName);
  }
  /**
   * Get effective config (tool-specific or defaults)
   */
  getEffectiveConfig(toolName) {
    const toolConfig = this.toolConfigs.get(toolName);
    return {
      scope: toolConfig?.scope ?? this.defaultScope,
      riskLevel: toolConfig?.riskLevel ?? this.defaultRiskLevel,
      approvalMessage: toolConfig?.approvalMessage,
      sensitiveArgs: toolConfig?.sensitiveArgs,
      sessionTTLMs: toolConfig?.sessionTTLMs
    };
  }
  // ==========================================================================
  // Approval Request Handler
  // ==========================================================================
  /**
   * Request approval for a tool call
   *
   * If an onApprovalRequired callback is set, it will be called.
   * Otherwise, this auto-approves for backward compatibility.
   *
   * NOTE: If you want to require explicit approval, you MUST either:
   * 1. Set onApprovalRequired callback in AgentPermissionsConfig
   * 2. Register an 'approve:tool' hook in the AgenticLoop
   * 3. Add tools to the blocklist if they should never run
   *
   * This auto-approval behavior preserves backward compatibility with
   * existing code that doesn't use the permission system.
   */
  async requestApproval(context) {
    if (this.onApprovalRequired) {
      const decision = await this.onApprovalRequired(context);
      if (decision.approved) {
        this.approve(context.toolCall.function.name, decision);
      } else {
        this.deny(context.toolCall.function.name, decision.reason ?? "User denied");
      }
      return decision;
    }
    return {
      approved: true,
      reason: "Auto-approved (no approval handler configured)"
    };
  }
  // ==========================================================================
  // Query Methods
  // ==========================================================================
  /**
   * Get all tools that have session approvals
   */
  getApprovedTools() {
    const approved = [];
    for (const [toolName, entry] of this.approvalCache) {
      if (entry.expiresAt && entry.expiresAt < /* @__PURE__ */ new Date()) {
        continue;
      }
      approved.push(toolName);
    }
    return approved;
  }
  /**
   * Get the approval entry for a tool
   */
  getApprovalEntry(toolName) {
    const entry = this.approvalCache.get(toolName);
    if (!entry) return void 0;
    if (entry.expiresAt && entry.expiresAt < /* @__PURE__ */ new Date()) {
      this.approvalCache.delete(toolName);
      return void 0;
    }
    return entry;
  }
  // ==========================================================================
  // Session Management
  // ==========================================================================
  /**
   * Clear all session approvals
   */
  clearSession() {
    this.approvalCache.clear();
    this.emit("session:cleared", {});
  }
  // ==========================================================================
  // Persistence (for Session integration)
  // ==========================================================================
  /**
   * Serialize approval state for persistence
   */
  getState() {
    const approvals = {};
    for (const [toolName, entry] of this.approvalCache) {
      if (entry.expiresAt && entry.expiresAt < /* @__PURE__ */ new Date()) {
        continue;
      }
      approvals[toolName] = {
        toolName: entry.toolName,
        scope: entry.scope,
        approvedAt: entry.approvedAt.toISOString(),
        approvedBy: entry.approvedBy,
        expiresAt: entry.expiresAt?.toISOString(),
        argsHash: entry.argsHash
      };
    }
    return {
      version: APPROVAL_STATE_VERSION,
      approvals,
      blocklist: Array.from(this.blocklist),
      allowlist: Array.from(this.allowlist)
    };
  }
  /**
   * Load approval state from persistence
   */
  loadState(state) {
    this.approvalCache.clear();
    if (state.version !== APPROVAL_STATE_VERSION) {
      console.warn(`ToolPermissionManager: Unknown state version ${state.version}, ignoring`);
      return;
    }
    for (const [toolName, entry] of Object.entries(state.approvals)) {
      const approvedAt = new Date(entry.approvedAt);
      const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : void 0;
      if (expiresAt && expiresAt < /* @__PURE__ */ new Date()) {
        continue;
      }
      this.approvalCache.set(toolName, {
        toolName: entry.toolName,
        scope: entry.scope,
        approvedAt,
        approvedBy: entry.approvedBy,
        expiresAt,
        argsHash: entry.argsHash
      });
    }
    for (const toolName of state.blocklist) {
      this.blocklist.add(toolName);
    }
    for (const toolName of state.allowlist) {
      this.blocklist.delete(toolName);
      this.allowlist.add(toolName);
    }
  }
  // ==========================================================================
  // Utility Methods
  // ==========================================================================
  /**
   * Get defaults
   */
  getDefaults() {
    return {
      scope: this.defaultScope,
      riskLevel: this.defaultRiskLevel
    };
  }
  /**
   * Set defaults
   */
  setDefaults(defaults) {
    if (defaults.scope) this.defaultScope = defaults.scope;
    if (defaults.riskLevel) this.defaultRiskLevel = defaults.riskLevel;
  }
  /**
   * Get summary statistics
   */
  getStats() {
    return {
      approvedCount: this.getApprovedTools().length,
      allowlistedCount: this.allowlist.size,
      blocklistedCount: this.blocklist.size,
      configuredCount: this.toolConfigs.size
    };
  }
  /**
   * Reset to initial state
   */
  reset() {
    this.approvalCache.clear();
    this.allowlist.clear();
    this.blocklist.clear();
    this.toolConfigs.clear();
    this.defaultScope = DEFAULT_PERMISSION_CONFIG.scope;
    this.defaultRiskLevel = DEFAULT_PERMISSION_CONFIG.riskLevel;
  }
};

// src/core/BaseAgent.ts
init_Logger();

// src/core/IdempotencyCache.ts
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
  _isDestroyed = false;
  constructor(config = DEFAULT_IDEMPOTENCY_CONFIG) {
    this.config = config;
    this.cleanupInterval = setInterval(() => {
      this.pruneExpired();
    }, 3e5);
  }
  /**
   * Returns true if destroy() has been called.
   * Operations on a destroyed cache are no-ops.
   */
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Releases all resources held by this cache.
   * Clears the background cleanup interval and all cached entries.
   * Safe to call multiple times (idempotent).
   */
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = void 0;
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  /**
   * Check if a tool's results should be cached.
   * Prefers 'cacheable' field, falls back to inverted 'safe' for backward compatibility.
   *
   * Logic:
   * - If 'cacheable' is defined, use it directly
   * - If only 'safe' is defined, cache when safe=false (backward compat)
   * - If neither defined, don't cache
   */
  shouldCache(tool) {
    const idempotency = tool.idempotency;
    if (!idempotency) return false;
    if (idempotency.cacheable !== void 0) {
      return idempotency.cacheable;
    }
    if (idempotency.safe !== void 0) {
      return !idempotency.safe;
    }
    return false;
  }
  /**
   * Get cached result for tool call
   */
  async get(tool, args) {
    if (this._isDestroyed) {
      return void 0;
    }
    if (!this.shouldCache(tool)) {
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
    if (this._isDestroyed) {
      return;
    }
    if (!this.shouldCache(tool)) {
      return;
    }
    const key = this.generateKey(tool, args);
    const ttl = tool.idempotency?.ttlMs ?? this.config.defaultTtlMs;
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
    if (this._isDestroyed) {
      return false;
    }
    if (!this.shouldCache(tool)) {
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
    if (this._isDestroyed) {
      return 0;
    }
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
   * Clear all cached results and stop background cleanup.
   * @deprecated Use destroy() instead for explicit lifecycle management.
   *             This method is kept for backward compatibility.
   */
  async clear() {
    this.destroy();
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

// src/domain/entities/Memory.ts
function isTaskAwareScope(scope) {
  return typeof scope === "object" && scope !== null && "type" in scope;
}
function isSimpleScope(scope) {
  return scope === "session" || scope === "persistent";
}
function scopeEquals(a, b) {
  if (isSimpleScope(a) && isSimpleScope(b)) {
    return a === b;
  }
  if (isTaskAwareScope(a) && isTaskAwareScope(b)) {
    if (a.type !== b.type) return false;
    if (a.type === "task" && b.type === "task") {
      if (a.taskIds.length !== b.taskIds.length) return false;
      const sortedA = [...a.taskIds].sort();
      const sortedB = [...b.taskIds].sort();
      return sortedA.every((id, i) => id === sortedB[i]);
    }
    return true;
  }
  return false;
}
function scopeMatches(entryScope, filterScope) {
  if (scopeEquals(entryScope, filterScope)) return true;
  if (isSimpleScope(filterScope)) return false;
  if (isTaskAwareScope(entryScope) && isTaskAwareScope(filterScope)) {
    return entryScope.type === filterScope.type;
  }
  return false;
}
var MEMORY_PRIORITY_VALUES = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1
};
var TIER_PRIORITIES = {
  raw: "low",
  summary: "normal",
  findings: "high"
};
var TIER_KEY_PREFIXES = {
  raw: "raw.",
  summary: "summary.",
  findings: "findings."
};
function getTierFromKey(key) {
  if (key.startsWith(TIER_KEY_PREFIXES.raw)) return "raw";
  if (key.startsWith(TIER_KEY_PREFIXES.summary)) return "summary";
  if (key.startsWith(TIER_KEY_PREFIXES.findings)) return "findings";
  return void 0;
}
function stripTierPrefix(key) {
  const tier = getTierFromKey(key);
  if (!tier) return key;
  return key.substring(TIER_KEY_PREFIXES[tier].length);
}
function addTierPrefix(key, tier) {
  const existingTier = getTierFromKey(key);
  if (existingTier) {
    const baseKey = stripTierPrefix(key);
    return TIER_KEY_PREFIXES[tier] + baseKey;
  }
  return TIER_KEY_PREFIXES[tier] + key;
}
var TERMINAL_MEMORY_STATUSES = ["completed", "failed", "skipped", "cancelled"];
function isTerminalMemoryStatus(status) {
  return TERMINAL_MEMORY_STATUSES.includes(status);
}
var staticPriorityCalculator = (entry) => {
  if (entry.pinned) return "critical";
  return entry.basePriority;
};
function detectStaleEntries(entries, completedTaskId, taskStates) {
  const stale = [];
  for (const entry of entries) {
    if (entry.pinned) continue;
    const scope = entry.scope;
    if (!isTaskAwareScope(scope) || scope.type !== "task") continue;
    if (!scope.taskIds.includes(completedTaskId)) continue;
    const allTerminal = scope.taskIds.every((taskId) => {
      const status = taskStates.get(taskId);
      return status ? isTerminalMemoryStatus(status) : false;
    });
    if (allTerminal) {
      stale.push({
        key: entry.key,
        description: entry.description,
        reason: "task_completed",
        previousPriority: entry.basePriority,
        newPriority: "low",
        taskIds: scope.taskIds
      });
    }
  }
  return stale;
}
function forTasks(key, description, value, taskIds, options) {
  return {
    key,
    description,
    value,
    scope: { type: "task", taskIds },
    priority: options?.priority,
    pinned: options?.pinned
  };
}
function forPlan(key, description, value, options) {
  return {
    key,
    description,
    value,
    scope: { type: "plan" },
    priority: options?.priority,
    pinned: options?.pinned
  };
}
var DEFAULT_MEMORY_CONFIG = {
  descriptionMaxLength: 150,
  softLimitPercent: 80,
  contextAllocationPercent: 20
};
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
  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(serialized, "utf8");
  }
  return new Blob([serialized]).size;
}
function createMemoryEntry(input, config = DEFAULT_MEMORY_CONFIG) {
  validateMemoryKey(input.key);
  if (input.description.length > config.descriptionMaxLength) {
    throw new Error(`Description exceeds maximum length of ${config.descriptionMaxLength} characters`);
  }
  if (input.scope && isTaskAwareScope(input.scope) && input.scope.type === "task") {
    if (input.scope.taskIds.length === 0) {
      console.warn(`Memory entry "${input.key}" has empty taskIds array - will have low priority`);
    }
  }
  const now = Date.now();
  const sizeBytes = calculateEntrySize(input.value);
  const pinned = input.pinned ?? false;
  const priority = pinned ? "critical" : input.priority ?? "normal";
  return {
    key: input.key,
    description: input.description,
    value: input.value,
    sizeBytes,
    scope: input.scope ?? "session",
    basePriority: priority,
    pinned,
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
function formatScope(scope) {
  if (isSimpleScope(scope)) {
    return scope;
  }
  if (scope.type === "task") {
    return `task:${scope.taskIds.join(",")}`;
  }
  return scope.type;
}
function formatEntryFlags(entry) {
  const flags = [];
  if (entry.pinned) {
    flags.push("pinned");
  } else if (entry.effectivePriority !== "normal") {
    flags.push(entry.effectivePriority);
  }
  flags.push(formatScope(entry.scope));
  return flags.join(", ");
}
function formatMemoryIndex(index) {
  const lines = [];
  const utilPercent = Number.isInteger(index.utilizationPercent) ? index.utilizationPercent.toString() : index.utilizationPercent.toFixed(1).replace(/\.0$/, "");
  lines.push(`## Working Memory (${index.totalSizeHuman} / ${index.limitHuman} - ${utilPercent}%)`);
  lines.push("");
  if (index.entries.length === 0) {
    lines.push("Memory is empty.");
  } else {
    const pinned = index.entries.filter((e) => e.pinned);
    const critical = index.entries.filter((e) => !e.pinned && e.effectivePriority === "critical");
    const high = index.entries.filter((e) => !e.pinned && e.effectivePriority === "high");
    const normal = index.entries.filter((e) => !e.pinned && e.effectivePriority === "normal");
    const low = index.entries.filter((e) => !e.pinned && e.effectivePriority === "low");
    if (pinned.length > 0) {
      lines.push("**Pinned (never evicted):**");
      for (const entry of pinned) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [${formatEntryFlags(entry)}]`);
      }
      lines.push("");
    }
    if (critical.length > 0) {
      lines.push("**Critical priority:**");
      for (const entry of critical) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [${formatEntryFlags(entry)}]`);
      }
      lines.push("");
    }
    if (high.length > 0) {
      lines.push("**High priority:**");
      for (const entry of high) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [${formatEntryFlags(entry)}]`);
      }
      lines.push("");
    }
    if (normal.length > 0) {
      lines.push("**Normal priority:**");
      for (const entry of normal) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [${formatEntryFlags(entry)}]`);
      }
      lines.push("");
    }
    if (low.length > 0) {
      lines.push("**Low priority (evicted first):**");
      for (const entry of low) {
        lines.push(`- \`${entry.key}\` (${entry.size}): ${entry.description} [${formatEntryFlags(entry)}]`);
      }
      lines.push("");
    }
    if (index.utilizationPercent > 80) {
      lines.push("Warning: Memory utilization is high. Consider deleting unused entries.");
      lines.push("");
    }
  }
  lines.push('Use `memory_retrieve("key")` to load full content.');
  lines.push('Use `memory_persist("key")` to keep data after task completion.');
  return lines.join("\n");
}

// src/capabilities/taskAgent/WorkingMemory.ts
var WorkingMemory = class extends eventemitter3.EventEmitter {
  storage;
  config;
  priorityCalculator;
  priorityContext;
  _isDestroyed = false;
  /**
   * Create a WorkingMemory instance
   *
   * @param storage - Storage backend for memory entries
   * @param config - Memory configuration (limits, etc.)
   * @param priorityCalculator - Strategy for computing effective priority (default: static)
   */
  constructor(storage, config = DEFAULT_MEMORY_CONFIG, priorityCalculator = staticPriorityCalculator) {
    super();
    this.storage = storage;
    this.config = config;
    this.priorityCalculator = priorityCalculator;
    this.priorityContext = {};
  }
  /**
   * Set the priority calculator (for switching strategies at runtime)
   */
  setPriorityCalculator(calculator) {
    this.priorityCalculator = calculator;
  }
  /**
   * Update priority context (e.g., task states for TaskAgent)
   */
  setPriorityContext(context) {
    this.priorityContext = context;
  }
  /**
   * Get the current priority context
   */
  getPriorityContext() {
    return this.priorityContext;
  }
  /**
   * Compute effective priority for an entry using the current calculator
   */
  computeEffectivePriority(entry) {
    return this.priorityCalculator(entry, this.priorityContext);
  }
  /**
   * Get all entries with their computed effective priorities
   * This is a performance optimization to avoid repeated getAll() + map() calls
   */
  async getEntriesWithPriority() {
    const entries = await this.storage.getAll();
    return entries.map((entry) => ({
      entry,
      effectivePriority: this.computeEffectivePriority(entry)
    }));
  }
  /**
   * Get evictable entries sorted by eviction priority
   * Filters out pinned and critical entries, sorts by priority then by strategy
   */
  getEvictableEntries(entriesWithPriority, strategy) {
    return entriesWithPriority.filter(({ entry, effectivePriority }) => {
      if (entry.pinned) return false;
      if (effectivePriority === "critical") return false;
      return true;
    }).sort((a, b) => {
      const priorityDiff = MEMORY_PRIORITY_VALUES[a.effectivePriority] - MEMORY_PRIORITY_VALUES[b.effectivePriority];
      if (priorityDiff !== 0) return priorityDiff;
      if (strategy === "lru") {
        return a.entry.lastAccessedAt - b.entry.lastAccessedAt;
      } else {
        return b.entry.sizeBytes - a.entry.sizeBytes;
      }
    });
  }
  /**
   * Store a value in working memory
   *
   * @param key - Unique key for the entry
   * @param description - Short description for the index (max 150 chars)
   * @param value - The data to store
   * @param options - Optional scope, priority, and pinned settings
   */
  async store(key, description, value, options) {
    const input = {
      key,
      description,
      value,
      scope: options?.scope ?? "session",
      priority: options?.priority,
      pinned: options?.pinned
    };
    const entry = createMemoryEntry(input, this.config);
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
    this.emit("stored", { key, description, scope: entry.scope });
  }
  /**
   * Store a value scoped to specific tasks
   * Convenience method for task-aware memory
   */
  async storeForTasks(key, description, value, taskIds, options) {
    await this.store(key, description, value, {
      scope: { type: "task", taskIds },
      priority: options?.priority,
      pinned: options?.pinned
    });
  }
  /**
   * Store a value scoped to the entire plan
   * Convenience method for plan-scoped memory
   */
  async storeForPlan(key, description, value, options) {
    await this.store(key, description, value, {
      scope: { type: "plan" },
      priority: options?.priority,
      pinned: options?.pinned
    });
  }
  /**
   * Retrieve a value from working memory
   *
   * Note: Access stats update is not strictly atomic. Under very high concurrency,
   * accessCount may be slightly inaccurate. This is acceptable for memory management
   * purposes where exact counts are not critical.
   */
  async retrieve(key) {
    const entry = await this.storage.get(key);
    if (!entry) {
      return void 0;
    }
    const value = entry.value;
    const freshEntry = await this.storage.get(key);
    if (freshEntry) {
      freshEntry.lastAccessedAt = Date.now();
      freshEntry.accessCount += 1;
      await this.storage.set(key, freshEntry);
    }
    this.emit("retrieved", { key });
    return value;
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
   * Promote an entry to persistent scope
   * Works with both simple and task-aware scopes
   */
  async persist(key) {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    const isPersistent = isSimpleScope(entry.scope) ? entry.scope === "persistent" : isTaskAwareScope(entry.scope) && entry.scope.type === "persistent";
    if (!isPersistent) {
      entry.scope = { type: "persistent" };
      await this.storage.set(key, entry);
    }
  }
  /**
   * Pin an entry (never evicted)
   */
  async pin(key) {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    if (!entry.pinned) {
      entry.pinned = true;
      entry.basePriority = "critical";
      await this.storage.set(key, entry);
    }
  }
  /**
   * Unpin an entry
   */
  async unpin(key, newPriority = "normal") {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    if (entry.pinned) {
      entry.pinned = false;
      entry.basePriority = newPriority;
      await this.storage.set(key, entry);
    }
  }
  /**
   * Set the base priority of an entry
   */
  async setPriority(key, priority) {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    entry.basePriority = priority;
    await this.storage.set(key, entry);
  }
  /**
   * Update the scope of an entry without re-storing the value
   */
  async updateScope(key, scope) {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    entry.scope = scope;
    await this.storage.set(key, entry);
  }
  /**
   * Add task IDs to an existing task-scoped entry
   * If entry is not task-scoped, converts it to task-scoped
   */
  async addTasksToScope(key, taskIds) {
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    if (isTaskAwareScope(entry.scope) && entry.scope.type === "task") {
      const existingIds = new Set(entry.scope.taskIds);
      for (const id of taskIds) {
        existingIds.add(id);
      }
      entry.scope = { type: "task", taskIds: Array.from(existingIds) };
    } else {
      entry.scope = { type: "task", taskIds };
    }
    await this.storage.set(key, entry);
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
   * Get memory index with computed effective priorities
   */
  async getIndex() {
    const entriesWithPriority = await this.getEntriesWithPriority();
    const totalSizeBytes = await this.storage.getTotalSize();
    const limitBytes = this.getLimit();
    const sortedEntries = [...entriesWithPriority].sort((a, b) => {
      if (a.entry.pinned && !b.entry.pinned) return -1;
      if (!a.entry.pinned && b.entry.pinned) return 1;
      const priorityDiff = MEMORY_PRIORITY_VALUES[b.effectivePriority] - MEMORY_PRIORITY_VALUES[a.effectivePriority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.entry.lastAccessedAt - a.entry.lastAccessedAt;
    });
    const indexEntries = sortedEntries.map(({ entry, effectivePriority }) => ({
      key: entry.key,
      description: entry.description,
      size: formatSizeHuman(entry.sizeBytes),
      scope: entry.scope,
      effectivePriority,
      pinned: entry.pinned
    }));
    return {
      entries: indexEntries,
      totalSizeBytes,
      totalSizeHuman: formatSizeHuman(totalSizeBytes),
      limitBytes,
      limitHuman: formatSizeHuman(limitBytes),
      utilizationPercent: totalSizeBytes / limitBytes * 100
    };
  }
  /**
   * Format index for context injection
   */
  async formatIndex() {
    const index = await this.getIndex();
    return formatMemoryIndex(index);
  }
  /**
   * Evict entries using specified strategy
   *
   * Eviction order:
   * 1. Never evict pinned entries
   * 2. Evict low priority first, then normal, then high (never critical)
   * 3. Within same priority, use strategy (LRU or largest size)
   *
   * @param count - Number of entries to evict
   * @param strategy - Eviction strategy ('lru' or 'size')
   * @returns Keys of evicted entries
   */
  async evict(count, strategy = "lru") {
    const entriesWithPriority = await this.getEntriesWithPriority();
    const evictable = this.getEvictableEntries(entriesWithPriority, strategy);
    const toEvict = evictable.slice(0, count);
    const evictedKeys = [];
    for (const { entry } of toEvict) {
      await this.storage.delete(entry.key);
      evictedKeys.push(entry.key);
    }
    if (evictedKeys.length > 0) {
      this.emit("evicted", { keys: evictedKeys, reason: strategy });
    }
    return evictedKeys;
  }
  /**
   * Evict entries using priority-aware LRU algorithm
   * @deprecated Use evict(count, 'lru') instead
   */
  async evictLRU(count) {
    return this.evict(count, "lru");
  }
  /**
   * Evict largest entries first (priority-aware)
   * @deprecated Use evict(count, 'size') instead
   */
  async evictBySize(count) {
    return this.evict(count, "size");
  }
  /**
   * Handle task completion - detect and notify about stale entries
   *
   * Call this when a task completes to:
   * 1. Update priority context with new task state
   * 2. Detect entries that became stale
   * 3. Emit event to notify LLM about stale entries
   *
   * @param taskId - The completed task ID
   * @param taskStates - Current task states map
   * @returns Information about stale entries
   */
  async onTaskComplete(taskId, taskStates) {
    this.priorityContext.taskStates = taskStates;
    const entries = await this.storage.getAll();
    const staleEntries = detectStaleEntries(entries, taskId, taskStates);
    if (staleEntries.length > 0) {
      this.emit("stale_entries", { entries: staleEntries });
    }
    return staleEntries;
  }
  /**
   * Evict entries for completed tasks
   *
   * Removes entries that were scoped only to completed tasks.
   * Use after onTaskComplete() if you want automatic cleanup.
   *
   * @param taskStates - Current task states map
   * @returns Keys of evicted entries
   */
  async evictCompletedTaskEntries(taskStates) {
    const entries = await this.storage.getAll();
    const evictedKeys = [];
    for (const entry of entries) {
      if (entry.pinned) continue;
      if (!isTaskAwareScope(entry.scope) || entry.scope.type !== "task") continue;
      const allTerminal = entry.scope.taskIds.every((taskId) => {
        const status = taskStates.get(taskId);
        return status ? isTerminalMemoryStatus(status) : false;
      });
      if (allTerminal) {
        await this.storage.delete(entry.key);
        evictedKeys.push(entry.key);
      }
    }
    if (evictedKeys.length > 0) {
      this.emit("evicted", { keys: evictedKeys, reason: "task_completed" });
    }
    return evictedKeys;
  }
  /**
   * Get limited memory access for tools
   *
   * This provides a simplified interface for tools to interact with memory
   * without exposing the full WorkingMemory API.
   */
  getAccess() {
    return {
      get: async (key) => this.retrieve(key),
      set: async (key, description, value, options) => this.store(key, description, value, options),
      delete: async (key) => this.delete(key),
      has: async (key) => this.has(key),
      list: async () => {
        const index = await this.getIndex();
        return index.entries.map((e) => ({
          key: e.key,
          description: e.description,
          effectivePriority: e.effectivePriority,
          pinned: e.pinned
        }));
      }
    };
  }
  // ============================================================================
  // HIERARCHICAL MEMORY HELPERS
  // ============================================================================
  /**
   * Store raw data (low priority, first to be evicted)
   *
   * Use this for original/unprocessed data that should be summarized.
   * Raw data is automatically evicted first when memory pressure is high.
   *
   * @param key - Key without tier prefix (prefix is added automatically)
   * @param description - Brief description for the index
   * @param value - The raw data to store
   * @param options - Optional scope and task IDs
   */
  async storeRaw(key, description, value, options) {
    const fullKey = addTierPrefix(key, "raw");
    const scope = options?.taskIds ? { type: "task", taskIds: options.taskIds } : options?.scope ?? "session";
    await this.store(fullKey, description, value, {
      scope,
      priority: TIER_PRIORITIES.raw
    });
  }
  /**
   * Store a summary derived from raw data (normal priority)
   *
   * Use this for processed/summarized data that extracts key information.
   * Links back to source data for cleanup tracking.
   *
   * @param key - Key without tier prefix (prefix is added automatically)
   * @param description - Brief description for the index
   * @param value - The summary data
   * @param derivedFrom - Key(s) this summary was derived from
   * @param options - Optional scope and task IDs
   */
  async storeSummary(key, description, value, derivedFrom, options) {
    const fullKey = addTierPrefix(key, "summary");
    const sourceKeys = Array.isArray(derivedFrom) ? derivedFrom : [derivedFrom];
    const scope = options?.taskIds ? { type: "task", taskIds: options.taskIds } : options?.scope ?? { type: "plan" };
    await this.store(fullKey, description, value, {
      scope,
      priority: TIER_PRIORITIES.summary
    });
    for (const sourceKey of sourceKeys) {
      try {
        const sourceEntry = await this.storage.get(sourceKey);
        if (sourceEntry) {
          const metadata = sourceEntry.value?.metadata;
          const existingDerivedTo = metadata?.derivedTo ?? [];
          if (!existingDerivedTo.includes(fullKey)) {
          }
        }
      } catch {
      }
    }
  }
  /**
   * Store final findings (high priority, kept longest)
   *
   * Use this for conclusions, insights, or final results that should be preserved.
   * These are the last to be evicted and typically span the entire plan.
   *
   * @param key - Key without tier prefix (prefix is added automatically)
   * @param description - Brief description for the index
   * @param value - The findings data
   * @param derivedFrom - Optional key(s) these findings were derived from
   * @param options - Optional scope, task IDs, and pinned flag
   */
  async storeFindings(key, description, value, _derivedFrom, options) {
    const fullKey = addTierPrefix(key, "findings");
    const scope = options?.scope ?? { type: "plan" };
    await this.store(fullKey, description, value, {
      scope,
      priority: TIER_PRIORITIES.findings,
      pinned: options?.pinned
    });
  }
  /**
   * Clean up raw data after summary/findings are created
   *
   * Call this after creating summaries to free up memory used by raw data.
   * Only deletes entries in the 'raw' tier.
   *
   * @param derivedFromKeys - Keys to delete (typically from derivedFrom metadata)
   * @returns Number of entries deleted
   */
  async cleanupRawData(derivedFromKeys) {
    let deletedCount = 0;
    for (const key of derivedFromKeys) {
      const tier = getTierFromKey(key);
      if (tier === "raw") {
        const exists = await this.has(key);
        if (exists) {
          await this.delete(key);
          deletedCount++;
        }
      }
    }
    return deletedCount;
  }
  /**
   * Get all entries by tier
   *
   * @param tier - The tier to filter by
   * @returns Array of entries in that tier
   */
  async getByTier(tier) {
    const entries = await this.storage.getAll();
    const prefix = TIER_KEY_PREFIXES[tier];
    return entries.filter((e) => e.key.startsWith(prefix));
  }
  /**
   * Promote an entry to a higher tier
   *
   * Changes the key prefix and updates priority.
   * Use this when raw data becomes more valuable (e.g., frequently accessed).
   *
   * @param key - Current key (with tier prefix)
   * @param toTier - Target tier to promote to
   * @returns New key with updated prefix
   */
  async promote(key, toTier) {
    const currentTier = getTierFromKey(key);
    if (currentTier === toTier) {
      return key;
    }
    const entry = await this.storage.get(key);
    if (!entry) {
      throw new Error(`Key "${key}" not found in memory`);
    }
    const newKey = addTierPrefix(key, toTier);
    const newPriority = TIER_PRIORITIES[toTier];
    await this.store(newKey, entry.description, entry.value, {
      scope: entry.scope,
      priority: newPriority,
      pinned: entry.pinned
    });
    await this.delete(key);
    return newKey;
  }
  /**
   * Get tier statistics
   *
   * @returns Count and size by tier
   */
  async getTierStats() {
    const entries = await this.storage.getAll();
    const stats = {
      raw: { count: 0, sizeBytes: 0 },
      summary: { count: 0, sizeBytes: 0 },
      findings: { count: 0, sizeBytes: 0 }
    };
    for (const entry of entries) {
      const tier = getTierFromKey(entry.key);
      if (tier) {
        stats[tier].count++;
        stats[tier].sizeBytes += entry.sizeBytes;
      }
    }
    return stats;
  }
  /**
   * Get statistics about memory usage
   */
  async getStats() {
    const entriesWithPriority = await this.getEntriesWithPriority();
    const totalSizeBytes = await this.storage.getTotalSize();
    const limit = this.getLimit();
    const byPriority = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };
    let pinnedCount = 0;
    for (const { entry, effectivePriority } of entriesWithPriority) {
      byPriority[effectivePriority]++;
      if (entry.pinned) pinnedCount++;
    }
    return {
      totalEntries: entriesWithPriority.length,
      totalSizeBytes,
      utilizationPercent: totalSizeBytes / limit * 100,
      byPriority,
      pinnedCount
    };
  }
  /**
   * Get the configured memory limit
   */
  getLimit() {
    return this.config.maxSizeBytes ?? 512 * 1024;
  }
  /**
   * Check if the WorkingMemory instance has been destroyed
   */
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Destroy the WorkingMemory instance
   * Removes all event listeners and clears internal state
   */
  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this.removeAllListeners();
    this.priorityContext = {};
  }
};

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
    return Array.from(this.store.values()).filter((entry) => scopeMatches(entry.scope, scope));
  }
  async clearScope(scope) {
    const toDelete = [];
    for (const [key, entry] of this.store.entries()) {
      if (scopeMatches(entry.scope, scope)) {
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

// src/core/context/types.ts
var DEFAULT_CONTEXT_CONFIG = {
  maxContextTokens: 128e3,
  compactionThreshold: 0.75,
  hardLimit: 0.9,
  responseReserve: 0.15,
  estimator: "approximate",
  autoCompact: true,
  strategy: "proactive",
  strategyOptions: {}
};

// src/core/context/utils/ContextUtils.ts
function estimateComponentTokens(component, estimator) {
  if (typeof component.content === "string") {
    return estimator.estimateTokens(component.content);
  }
  return estimator.estimateDataTokens(component.content);
}
function sortCompactableByPriority(components) {
  return components.filter((c) => c.compactable).sort((a, b) => b.priority - a.priority);
}
function findCompactorForComponent(component, compactors) {
  return compactors.find((c) => c.canCompact(component));
}
async function executeCompactionLoop(options) {
  const {
    components,
    tokensToFree,
    compactors,
    estimator,
    calculateTargetSize,
    maxRounds = 1,
    logPrefix = ""
  } = options;
  const log = [];
  let current = [...components];
  let freedTokens = 0;
  let round = 0;
  const sortedComponents = sortCompactableByPriority(current);
  while (freedTokens < tokensToFree && round < maxRounds) {
    round++;
    let roundFreed = 0;
    for (const component of sortedComponents) {
      if (freedTokens >= tokensToFree) break;
      const compactor = findCompactorForComponent(component, compactors);
      if (!compactor) continue;
      const beforeSize = estimateComponentTokens(component, estimator);
      const targetSize = calculateTargetSize(beforeSize, round);
      if (targetSize >= beforeSize) continue;
      const compacted = await compactor.compact(component, targetSize);
      const index = current.findIndex((c) => c.name === component.name);
      if (index !== -1) {
        current[index] = compacted;
      }
      const afterSize = estimateComponentTokens(compacted, estimator);
      const saved = beforeSize - afterSize;
      freedTokens += saved;
      roundFreed += saved;
      const prefix = logPrefix ? `${logPrefix}: ` : "";
      const roundInfo = maxRounds > 1 ? `Round ${round}: ` : "";
      log.push(
        `${prefix}${roundInfo}${compactor.name} compacted "${component.name}" by ${saved} tokens`
      );
    }
    if (roundFreed === 0) break;
  }
  return { components: current, log, tokensFreed: freedTokens };
}

// src/core/context/strategies/BaseCompactionStrategy.ts
var BaseCompactionStrategy = class {
  metrics = {
    compactionCount: 0,
    totalTokensFreed: 0,
    avgTokensFreedPerCompaction: 0
  };
  /**
   * Get the maximum number of compaction rounds.
   * Override in subclasses for multi-round strategies.
   */
  getMaxRounds() {
    return 1;
  }
  /**
   * Get the log prefix for compaction messages.
   * Override to customize logging.
   */
  getLogPrefix() {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
  }
  /**
   * Compact components to fit within budget.
   * Uses the shared compaction loop with strategy-specific target calculation.
   */
  async compact(components, budget, compactors, estimator) {
    const targetUsage = Math.floor(budget.total * this.getTargetUtilization());
    const tokensToFree = budget.used - targetUsage;
    const result = await executeCompactionLoop({
      components,
      tokensToFree,
      compactors,
      estimator,
      calculateTargetSize: this.calculateTargetSize.bind(this),
      maxRounds: this.getMaxRounds(),
      logPrefix: this.getLogPrefix()
    });
    this.updateMetrics(result.tokensFreed);
    return result;
  }
  /**
   * Update internal metrics after compaction
   */
  updateMetrics(tokensFreed) {
    this.metrics.compactionCount++;
    this.metrics.totalTokensFreed += tokensFreed;
    this.metrics.avgTokensFreedPerCompaction = this.metrics.totalTokensFreed / this.metrics.compactionCount;
  }
  /**
   * Get strategy metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics = {
      compactionCount: 0,
      totalTokensFreed: 0,
      avgTokensFreedPerCompaction: 0
    };
  }
};

// src/core/constants.ts
var TASK_DEFAULTS = {
  /** Default timeout for task execution in milliseconds (5 minutes) */
  TIMEOUT_MS: 3e5};
var CONTEXT_DEFAULTS = {
  /** Default maximum context tokens (128K) */
  MAX_TOKENS: 128e3};
var PROACTIVE_STRATEGY_DEFAULTS = {
  /** Target utilization after compaction */
  TARGET_UTILIZATION: 0.65,
  /** Base reduction factor for round 1 */
  BASE_REDUCTION_FACTOR: 0.5,
  /** Reduction step per round (more aggressive each round) */
  REDUCTION_STEP: 0.15,
  /** Maximum compaction rounds */
  MAX_ROUNDS: 3
};
var AGGRESSIVE_STRATEGY_DEFAULTS = {
  /** Threshold to trigger compaction */
  THRESHOLD: 0.6,
  /** Target utilization after compaction */
  TARGET_UTILIZATION: 0.5,
  /** Reduction factor (keep 30% of original) */
  REDUCTION_FACTOR: 0.3
};
var LAZY_STRATEGY_DEFAULTS = {
  /** Target utilization after compaction */
  TARGET_UTILIZATION: 0.85,
  /** Reduction factor (keep 70% of original) */
  REDUCTION_FACTOR: 0.7
};
var ADAPTIVE_STRATEGY_DEFAULTS = {
  /** Number of compactions to learn from */
  LEARNING_WINDOW: 10,
  /** Compactions per minute threshold to switch to aggressive */
  SWITCH_THRESHOLD: 5,
  /** Low utilization threshold to switch to lazy */
  LOW_UTILIZATION_THRESHOLD: 70,
  /** Low frequency threshold to switch to lazy */
  LOW_FREQUENCY_THRESHOLD: 0.5
};
var ROLLING_WINDOW_DEFAULTS = {
  /** Default maximum messages to keep */
  MAX_MESSAGES: 20
};

// src/core/context/strategies/ProactiveStrategy.ts
var DEFAULT_OPTIONS = {
  targetUtilization: PROACTIVE_STRATEGY_DEFAULTS.TARGET_UTILIZATION,
  baseReductionFactor: PROACTIVE_STRATEGY_DEFAULTS.BASE_REDUCTION_FACTOR,
  reductionStep: PROACTIVE_STRATEGY_DEFAULTS.REDUCTION_STEP,
  maxRounds: PROACTIVE_STRATEGY_DEFAULTS.MAX_ROUNDS
};
var ProactiveCompactionStrategy = class extends BaseCompactionStrategy {
  name = "proactive";
  options;
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }
  shouldCompact(budget, _config) {
    return budget.status === "warning" || budget.status === "critical";
  }
  calculateTargetSize(beforeSize, round) {
    const reductionFactor = this.options.baseReductionFactor - (round - 1) * this.options.reductionStep;
    return Math.floor(beforeSize * Math.max(reductionFactor, 0.1));
  }
  getTargetUtilization() {
    return this.options.targetUtilization;
  }
  getMaxRounds() {
    return this.options.maxRounds;
  }
  getLogPrefix() {
    return "Proactive";
  }
};

// src/core/context/strategies/AggressiveStrategy.ts
var DEFAULT_OPTIONS2 = {
  threshold: AGGRESSIVE_STRATEGY_DEFAULTS.THRESHOLD,
  targetUtilization: AGGRESSIVE_STRATEGY_DEFAULTS.TARGET_UTILIZATION,
  reductionFactor: AGGRESSIVE_STRATEGY_DEFAULTS.REDUCTION_FACTOR
};
var AggressiveCompactionStrategy = class extends BaseCompactionStrategy {
  name = "aggressive";
  options;
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS2, ...options };
  }
  shouldCompact(budget, _config) {
    const utilizationRatio = (budget.used + budget.reserved) / budget.total;
    return utilizationRatio >= this.options.threshold;
  }
  calculateTargetSize(beforeSize, _round) {
    return Math.floor(beforeSize * this.options.reductionFactor);
  }
  getTargetUtilization() {
    return this.options.targetUtilization;
  }
  getLogPrefix() {
    return "Aggressive";
  }
};

// src/core/context/strategies/LazyStrategy.ts
var DEFAULT_OPTIONS3 = {
  targetUtilization: LAZY_STRATEGY_DEFAULTS.TARGET_UTILIZATION,
  reductionFactor: LAZY_STRATEGY_DEFAULTS.REDUCTION_FACTOR
};
var LazyCompactionStrategy = class extends BaseCompactionStrategy {
  name = "lazy";
  options;
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS3, ...options };
  }
  shouldCompact(budget, _config) {
    return budget.status === "critical";
  }
  calculateTargetSize(beforeSize, _round) {
    return Math.floor(beforeSize * this.options.reductionFactor);
  }
  getTargetUtilization() {
    return this.options.targetUtilization;
  }
  getLogPrefix() {
    return "Lazy";
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
        const maxMessages = this.options.maxMessages ?? ROLLING_WINDOW_DEFAULTS.MAX_MESSAGES;
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
    const window = this.options.learningWindow ?? ADAPTIVE_STRATEGY_DEFAULTS.LEARNING_WINDOW;
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
    const threshold = this.options.switchThreshold ?? ADAPTIVE_STRATEGY_DEFAULTS.SWITCH_THRESHOLD;
    if (this.metrics.compactionFrequency > threshold) {
      if (this.currentStrategy.name !== "aggressive") {
        this.currentStrategy = new AggressiveCompactionStrategy();
      }
    } else if (this.metrics.compactionFrequency < ADAPTIVE_STRATEGY_DEFAULTS.LOW_FREQUENCY_THRESHOLD && this.metrics.avgUtilization < ADAPTIVE_STRATEGY_DEFAULTS.LOW_UTILIZATION_THRESHOLD) {
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
      return new ProactiveCompactionStrategy(options);
    case "aggressive":
      return new AggressiveCompactionStrategy(options);
    case "lazy":
      return new LazyCompactionStrategy(options);
    case "rolling-window":
      return new RollingWindowStrategy(options);
    case "adaptive":
      return new AdaptiveStrategy(options);
    default:
      throw new Error(`Unknown context strategy: ${name}`);
  }
}

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

// src/domain/entities/Model.ts
var LLM_MODELS = {
  [Vendor.OpenAI]: {
    // GPT-5.2 Series (Current Flagship)
    GPT_5_2: "gpt-5.2",
    GPT_5_2_PRO: "gpt-5.2-pro",
    // GPT-5 Series
    GPT_5: "gpt-5",
    GPT_5_MINI: "gpt-5-mini",
    GPT_5_NANO: "gpt-5-nano",
    // GPT-4.1 Series
    GPT_4_1: "gpt-4.1",
    GPT_4_1_MINI: "gpt-4.1-mini",
    GPT_4_1_NANO: "gpt-4.1-nano",
    // GPT-4o Series (Legacy, Audio Capable)
    GPT_4O: "gpt-4o",
    GPT_4O_MINI: "gpt-4o-mini",
    // Reasoning Models (o-series)
    O3_MINI: "o3-mini",
    O1: "o1"
  },
  [Vendor.Anthropic]: {
    // Claude 4.5 Series (Current)
    CLAUDE_OPUS_4_5: "claude-opus-4-5-20251101",
    CLAUDE_SONNET_4_5: "claude-sonnet-4-5-20250929",
    CLAUDE_HAIKU_4_5: "claude-haiku-4-5-20251001",
    // Claude 4.x Legacy
    CLAUDE_OPUS_4_1: "claude-opus-4-1-20250805",
    CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
    CLAUDE_SONNET_3_7: "claude-3-7-sonnet-20250219",
    // Claude 3.x Legacy
    CLAUDE_HAIKU_3: "claude-3-haiku-20240307"
  },
  [Vendor.Google]: {
    // Gemini 3 Series (Preview)
    GEMINI_3_FLASH_PREVIEW: "gemini-3-flash-preview",
    GEMINI_3_PRO_PREVIEW: "gemini-3-pro-preview",
    GEMINI_3_PRO_IMAGE_PREVIEW: "gemini-3-pro-image-preview",
    // Gemini 2.5 Series (Production)
    GEMINI_2_5_PRO: "gemini-2.5-pro",
    GEMINI_2_5_FLASH: "gemini-2.5-flash",
    GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
    GEMINI_2_5_FLASH_IMAGE: "gemini-2.5-flash-image"
  }
};
var MODEL_REGISTRY = {
  // ============================================================================
  // OpenAI Models (Verified from platform.openai.com)
  // ============================================================================
  // GPT-5.2 Series (Current Flagship)
  "gpt-5.2": {
    name: "gpt-5.2",
    provider: Vendor.OpenAI,
    description: "Flagship model for coding and agentic tasks. Reasoning.effort: none, low, medium, high, xhigh",
    isActive: true,
    releaseDate: "2025-12-01",
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
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.75
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
    description: "GPT-5.2 pro produces smarter and more precise responses. Reasoning.effort: medium, high, xhigh",
    isActive: true,
    releaseDate: "2025-12-01",
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
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 21
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 168
      }
    }
  },
  // GPT-5 Series
  "gpt-5": {
    name: "gpt-5",
    provider: Vendor.OpenAI,
    description: "Previous intelligent reasoning model for coding and agentic tasks. Reasoning.effort: minimal, low, medium, high",
    isActive: true,
    releaseDate: "2025-08-01",
    knowledgeCutoff: "2024-09-30",
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
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 1.25
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 10
      }
    }
  },
  "gpt-5-mini": {
    name: "gpt-5-mini",
    provider: Vendor.OpenAI,
    description: "Faster, cost-efficient version of GPT-5 for well-defined tasks and precise prompts",
    isActive: true,
    releaseDate: "2025-08-01",
    knowledgeCutoff: "2024-05-31",
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
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 0.25
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 2
      }
    }
  },
  "gpt-5-nano": {
    name: "gpt-5-nano",
    provider: Vendor.OpenAI,
    description: "Fastest, most cost-efficient GPT-5. Great for summarization and classification tasks",
    isActive: true,
    releaseDate: "2025-08-01",
    knowledgeCutoff: "2024-05-31",
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
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false
      },
      input: {
        tokens: 4e5,
        text: true,
        image: true,
        cpm: 0.05
      },
      output: {
        tokens: 128e3,
        text: true,
        cpm: 0.4
      }
    }
  },
  // GPT-4.1 Series
  "gpt-4.1": {
    name: "gpt-4.1",
    provider: Vendor.OpenAI,
    description: "GPT-4.1 specialized for coding with 1M token context window",
    isActive: true,
    releaseDate: "2025-04-14",
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
        cpm: 2
      },
      output: {
        tokens: 32768,
        text: true,
        cpm: 8
      }
    }
  },
  "gpt-4.1-mini": {
    name: "gpt-4.1-mini",
    provider: Vendor.OpenAI,
    description: "Efficient GPT-4.1 model, beats GPT-4o in many benchmarks at 83% lower cost",
    isActive: true,
    releaseDate: "2025-04-14",
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
        cpm: 0.4
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 1.6
      }
    }
  },
  "gpt-4.1-nano": {
    name: "gpt-4.1-nano",
    provider: Vendor.OpenAI,
    description: "Fastest and cheapest model with 1M context. 80.1% MMLU, ideal for classification/autocompletion",
    isActive: true,
    releaseDate: "2025-04-14",
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
        cpm: 0.1
      },
      output: {
        tokens: 16384,
        text: true,
        cpm: 0.4
      }
    }
  },
  // GPT-4o Series (Legacy, Audio Capable)
  "gpt-4o": {
    name: "gpt-4o",
    provider: Vendor.OpenAI,
    description: "Versatile omni model with audio support. Legacy but still available",
    isActive: true,
    releaseDate: "2024-05-13",
    knowledgeCutoff: "2024-04-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: false,
      predictedOutputs: true,
      realtime: true,
      vision: true,
      audio: true,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128e3,
        text: true,
        image: true,
        audio: true,
        cpm: 2.5
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 10
      }
    }
  },
  "gpt-4o-mini": {
    name: "gpt-4o-mini",
    provider: Vendor.OpenAI,
    description: "Fast, affordable omni model with audio support",
    isActive: true,
    releaseDate: "2024-07-18",
    knowledgeCutoff: "2024-04-01",
    features: {
      reasoning: false,
      streaming: true,
      structuredOutput: true,
      functionCalling: true,
      fineTuning: true,
      predictedOutputs: false,
      realtime: true,
      vision: true,
      audio: true,
      video: false,
      batchAPI: true,
      promptCaching: true,
      input: {
        tokens: 128e3,
        text: true,
        image: true,
        audio: true,
        cpm: 0.15
      },
      output: {
        tokens: 16384,
        text: true,
        audio: true,
        cpm: 0.6
      }
    }
  },
  // Reasoning Models (o-series)
  "o3-mini": {
    name: "o3-mini",
    provider: Vendor.OpenAI,
    description: "Fast reasoning model tailored for coding, math, and science",
    isActive: true,
    releaseDate: "2025-01-31",
    knowledgeCutoff: "2024-10-01",
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
      promptCaching: false,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false
      },
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 1.1
      },
      output: {
        tokens: 1e5,
        text: true,
        cpm: 4.4
      }
    }
  },
  "o1": {
    name: "o1",
    provider: Vendor.OpenAI,
    description: "Advanced reasoning model for complex problems",
    isActive: true,
    releaseDate: "2024-12-17",
    knowledgeCutoff: "2024-10-01",
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
      promptCaching: false,
      parameters: {
        temperature: false,
        topP: false,
        frequencyPenalty: false,
        presencePenalty: false
      },
      input: {
        tokens: 2e5,
        text: true,
        image: true,
        cpm: 15
      },
      output: {
        tokens: 1e5,
        text: true,
        cpm: 60
      }
    }
  },
  // ============================================================================
  // Anthropic Models (Verified from platform.claude.com)
  // ============================================================================
  // Claude 4.5 Series (Current)
  "claude-opus-4-5-20251101": {
    name: "claude-opus-4-5-20251101",
    provider: Vendor.Anthropic,
    description: "Premium model combining maximum intelligence with practical performance",
    isActive: true,
    releaseDate: "2025-11-01",
    knowledgeCutoff: "2025-05-01",
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
    description: "Smart model for complex agents and coding. Best balance of intelligence, speed, cost",
    isActive: true,
    releaseDate: "2025-09-29",
    knowledgeCutoff: "2025-01-01",
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
    description: "Fastest model with near-frontier intelligence. Matches Sonnet 4 on coding",
    isActive: true,
    releaseDate: "2025-10-01",
    knowledgeCutoff: "2025-02-01",
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
  // Claude 4.x Legacy
  "claude-opus-4-1-20250805": {
    name: "claude-opus-4-1-20250805",
    provider: Vendor.Anthropic,
    description: "Legacy Opus 4.1 focused on agentic tasks, real-world coding, and reasoning",
    isActive: true,
    releaseDate: "2025-08-05",
    knowledgeCutoff: "2025-01-01",
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
        cpm: 15,
        cpmCached: 1.5
      },
      output: {
        tokens: 32e3,
        text: true,
        cpm: 75
      }
    }
  },
  "claude-sonnet-4-20250514": {
    name: "claude-sonnet-4-20250514",
    provider: Vendor.Anthropic,
    description: "Legacy Sonnet 4. Default for most users, supports 1M context beta",
    isActive: true,
    releaseDate: "2025-05-14",
    knowledgeCutoff: "2025-01-01",
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
        // 1M with beta header
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
  "claude-3-7-sonnet-20250219": {
    name: "claude-3-7-sonnet-20250219",
    provider: Vendor.Anthropic,
    description: "Claude 3.7 Sonnet with extended thinking, supports 128K output beta",
    isActive: true,
    releaseDate: "2025-02-19",
    knowledgeCutoff: "2024-10-01",
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
        // 128K with beta header
        text: true,
        cpm: 15
      }
    }
  },
  // Claude 3.x Legacy
  "claude-3-haiku-20240307": {
    name: "claude-3-haiku-20240307",
    provider: Vendor.Anthropic,
    description: "Fast legacy model. Recommend migrating to Haiku 4.5",
    isActive: true,
    releaseDate: "2024-03-07",
    knowledgeCutoff: "2023-08-01",
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
        cpm: 0.25,
        cpmCached: 0.03
      },
      output: {
        tokens: 4096,
        text: true,
        cpm: 1.25
      }
    }
  },
  // ============================================================================
  // Google Models (Verified from ai.google.dev)
  // ============================================================================
  // Gemini 3 Series (Preview)
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
        cpm: 0.15
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6
      }
    }
  },
  "gemini-3-pro-preview": {
    name: "gemini-3-pro-preview",
    provider: Vendor.Google,
    description: "Most advanced reasoning Gemini model for complex tasks",
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
        cpm: 1.25
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 10
      }
    }
  },
  "gemini-3-pro-image-preview": {
    name: "gemini-3-pro-image-preview",
    provider: Vendor.Google,
    description: "Highest quality image generation model",
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
        cpm: 1.25
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 10
      }
    }
  },
  // Gemini 2.5 Series (Production)
  "gemini-2.5-pro": {
    name: "gemini-2.5-pro",
    provider: Vendor.Google,
    description: "Advanced multimodal model built for deep reasoning and agents",
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
        tokens: 65536,
        text: true,
        cpm: 10
      }
    }
  },
  "gemini-2.5-flash": {
    name: "gemini-2.5-flash",
    provider: Vendor.Google,
    description: "Fast, cost-effective model with excellent reasoning",
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
        cpm: 0.15
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.6
      }
    }
  },
  "gemini-2.5-flash-lite": {
    name: "gemini-2.5-flash-lite",
    provider: Vendor.Google,
    description: "Lowest latency for high-volume tasks, summarization, classification",
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
        cpm: 0.075
      },
      output: {
        tokens: 65536,
        text: true,
        cpm: 0.3
      }
    }
  },
  "gemini-2.5-flash-image": {
    name: "gemini-2.5-flash-image",
    provider: Vendor.Google,
    description: "Image generation and editing model",
    isActive: true,
    releaseDate: "2025-09-01",
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
        cpm: 0.15
      },
      output: {
        tokens: 65536,
        text: true,
        image: true,
        cpm: 0.6
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

// src/core/AgentContext.ts
var PRIORITY_PROFILES = {
  research: {
    memory_index: 3,
    // Keep longest (summaries!)
    tool_outputs: 5,
    // Keep long (research data!)
    conversation_history: 10
    // Compact first (old chat less critical)
  },
  coding: {
    memory_index: 5,
    conversation_history: 8,
    // Keep more context
    tool_outputs: 10
    // Compact first (output less critical once seen)
  },
  analysis: {
    memory_index: 4,
    tool_outputs: 6,
    // Analysis results important
    conversation_history: 7
  },
  general: {
    memory_index: 8,
    conversation_history: 6,
    // Balanced
    tool_outputs: 10
  }
};
var TASK_TYPE_PROMPTS = {
  research: `## Research Protocol

You are conducting research. Follow this workflow to preserve findings:

### 1. SEARCH PHASE
- Execute searches to find relevant sources
- After EACH search, immediately store key findings in memory

### 2. READ PHASE
For each promising result:
- Read/scrape the content
- Extract key points (2-3 sentences per source)
- Store IMMEDIATELY in memory - do NOT keep full articles in conversation

### 3. SYNTHESIZE PHASE
Before writing final report:
- Use memory_list() to see all stored findings
- Retrieve relevant findings with memory_retrieve(key)
- Cross-reference and consolidate

### 4. CONTEXT MANAGEMENT
- Your context may be compacted automatically
- Always store important findings in memory IMMEDIATELY
- Stored data survives compaction; conversation history may not`,
  coding: `## Coding Protocol

You are implementing code changes. Guidelines:
- Read relevant files before making changes
- Implement incrementally
- Store key design decisions in memory if they'll be needed later
- Code file contents are large - summarize structure after reading`,
  analysis: `## Analysis Protocol

You are performing analysis. Guidelines:
- Store intermediate results in memory
- Summarize data immediately after loading (raw data is large)
- Keep only essential context for current analysis step`,
  general: `## Task Execution

Guidelines:
- Store important information in memory for later reference
- Monitor your context usage with context_inspect()`
};
var DEFAULT_AGENT_CONTEXT_CONFIG = {
  model: "gpt-4",
  maxContextTokens: 128e3,
  systemPrompt: "",
  instructions: "",
  history: {
    maxMessages: 100,
    preserveRecent: 20
  },
  strategy: "proactive",
  responseReserve: 0.15,
  autoCompact: true
};
var AgentContext = class _AgentContext extends eventemitter3.EventEmitter {
  // ===== Composed Managers (reused, not duplicated) =====
  _tools;
  _memory;
  _cache;
  _permissions;
  // ===== Built-in State =====
  _systemPrompt;
  _instructions;
  _history = [];
  _toolCalls = [];
  _currentInput = "";
  // ===== Plugins =====
  _plugins = /* @__PURE__ */ new Map();
  // ===== Configuration =====
  _config;
  _maxContextTokens;
  _strategy;
  _estimator;
  _cacheEnabled;
  // ===== Metrics =====
  _compactionCount = 0;
  _totalTokensFreed = 0;
  _lastBudget = null;
  // ===== Task Type =====
  _explicitTaskType;
  _autoDetectedTaskType;
  _autoDetectTaskType = true;
  // ============================================================================
  // Constructor & Factory
  // ============================================================================
  constructor(config = {}) {
    super();
    this._config = {
      ...DEFAULT_AGENT_CONTEXT_CONFIG,
      ...config,
      history: { ...DEFAULT_AGENT_CONTEXT_CONFIG.history, ...config.history }
    };
    this._systemPrompt = config.systemPrompt ?? "";
    this._instructions = config.instructions ?? "";
    this._maxContextTokens = config.maxContextTokens ?? getModelInfo(config.model ?? "gpt-4")?.features.input.tokens ?? 128e3;
    this._strategy = createStrategy(this._config.strategy, {});
    this._estimator = this.createEstimator();
    this._tools = new ToolManager();
    if (config.tools) {
      for (const tool of config.tools) {
        this._tools.register(tool);
      }
    }
    this._permissions = new ToolPermissionManager(config.permissions);
    const memoryStorage = config.memory?.storage ?? new InMemoryStorage();
    const memoryConfig = {
      ...DEFAULT_MEMORY_CONFIG,
      ...config.memory
    };
    this._memory = new WorkingMemory(memoryStorage, memoryConfig);
    this._cacheEnabled = config.cache?.enabled !== false;
    const cacheConfig = {
      ...DEFAULT_IDEMPOTENCY_CONFIG,
      ...config.cache
    };
    this._cache = new IdempotencyCache(cacheConfig);
    this._explicitTaskType = config.taskType;
    this._autoDetectTaskType = config.autoDetectTaskType !== false;
  }
  /**
   * Create a new AgentContext
   */
  static create(config = {}) {
    return new _AgentContext(config);
  }
  // ============================================================================
  // Public Accessors (expose composed managers for direct access)
  // ============================================================================
  /** Tool manager - register, enable/disable, execute tools */
  get tools() {
    return this._tools;
  }
  /** Working memory - store/retrieve agent state */
  get memory() {
    return this._memory;
  }
  /** Tool result cache - automatic deduplication */
  get cache() {
    return this._cache;
  }
  /** Tool permissions - approval workflow */
  get permissions() {
    return this._permissions;
  }
  // ============================================================================
  // Core Context (Built-in)
  // ============================================================================
  /** Get/set system prompt */
  get systemPrompt() {
    return this._systemPrompt;
  }
  set systemPrompt(value) {
    this._systemPrompt = value;
  }
  /** Get/set instructions */
  get instructions() {
    return this._instructions;
  }
  set instructions(value) {
    this._instructions = value;
  }
  /** Set current input for this turn */
  setCurrentInput(input) {
    this._currentInput = input;
  }
  /** Get current input */
  getCurrentInput() {
    return this._currentInput;
  }
  // ============================================================================
  // Task Type Management
  // ============================================================================
  /**
   * Set explicit task type (overrides auto-detection)
   */
  setTaskType(type) {
    this._explicitTaskType = type;
  }
  /**
   * Clear explicit task type (re-enables auto-detection)
   */
  clearTaskType() {
    this._explicitTaskType = void 0;
    this._autoDetectedTaskType = void 0;
  }
  /**
   * Get current task type
   * Priority: explicit > auto-detected > 'general'
   */
  getTaskType() {
    if (this._explicitTaskType) {
      return this._explicitTaskType;
    }
    if (this._autoDetectTaskType) {
      this._autoDetectedTaskType = this.detectTaskTypeFromPlan();
      return this._autoDetectedTaskType ?? "general";
    }
    return "general";
  }
  /**
   * Get task-type-specific system prompt addition
   */
  getTaskTypePrompt() {
    return TASK_TYPE_PROMPTS[this.getTaskType()];
  }
  /**
   * Auto-detect task type from plan (if PlanPlugin is registered)
   * Uses keyword matching - NO LLM calls
   */
  detectTaskTypeFromPlan() {
    const planPlugin = this.getPlugin("plan");
    const plan = planPlugin?.getPlan();
    if (!plan) return void 0;
    const text = `${plan.goal} ${plan.tasks.map((t) => `${t.name} ${t.description}`).join(" ")}`.toLowerCase();
    if (/\b(research|search|find|investigate|discover|explore|gather|look\s*up|scrape|web\s*search|crawl|collect\s*data|survey|study)\b/.test(text)) {
      return "research";
    }
    if (/\b(code|implement|develop|program|function|class|refactor|debug|fix\s*bug|write\s*code|api|endpoint|module|component|typescript|javascript|python)\b/.test(text)) {
      return "coding";
    }
    if (/\b(analyze|analysis|calculate|compute|evaluate|assess|compare|statistics|metrics|measure|data|report|chart|graph)\b/.test(text)) {
      return "analysis";
    }
    return "general";
  }
  // ============================================================================
  // History Management (Built-in)
  // ============================================================================
  /**
   * Add a message to history
   */
  addMessage(role, content, metadata) {
    const message = {
      id: this.generateId(),
      role,
      content,
      timestamp: Date.now(),
      metadata
    };
    this._history.push(message);
    this.emit("message:added", { message });
    return message;
  }
  /**
   * Get all history messages
   */
  getHistory() {
    return [...this._history];
  }
  /**
   * Get recent N messages
   */
  getRecentHistory(count) {
    return this._history.slice(-count);
  }
  /**
   * Get message count
   */
  getMessageCount() {
    return this._history.length;
  }
  /**
   * Clear history
   */
  clearHistory(reason) {
    this._history = [];
    this.emit("history:cleared", { reason });
  }
  /**
   * Get all tool call records
   */
  getToolCalls() {
    return [...this._toolCalls];
  }
  // ============================================================================
  // Tool Execution (with caching integration)
  // ============================================================================
  /**
   * Execute a tool with automatic caching
   *
   * This is the recommended way to execute tools - it integrates:
   * - Permission checking
   * - Result caching (if tool is cacheable)
   * - History recording
   * - Metrics tracking
   */
  async executeTool(toolName, args, context) {
    const tool = this._tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    const startTime = Date.now();
    let result;
    let error;
    let cached = false;
    try {
      if (this._cacheEnabled) {
        const cachedResult = await this._cache.get(tool, args);
        if (cachedResult !== void 0) {
          cached = true;
          result = cachedResult;
          this.emit("tool:cached", { name: toolName, args });
        }
      }
      if (!cached) {
        const fullContext = {
          agentId: context?.agentId ?? "agent-context",
          taskId: context?.taskId,
          memory: this._memory.getAccess(),
          idempotencyCache: this._cache,
          signal: context?.signal
        };
        this._tools.setToolContext(fullContext);
        result = await this._tools.execute(toolName, args);
        if (this._cacheEnabled) {
          await this._cache.set(tool, args, result);
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const record = {
        id: this.generateId(),
        name: toolName,
        args,
        result: error ? void 0 : result,
        error,
        durationMs: Date.now() - startTime,
        cached,
        timestamp: Date.now()
      };
      this._toolCalls.push(record);
      this.emit("tool:executed", { record });
    }
    return result;
  }
  // ============================================================================
  // Plugin System
  // ============================================================================
  /**
   * Register a context plugin
   */
  registerPlugin(plugin) {
    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this._plugins.set(plugin.name, plugin);
    this.emit("plugin:registered", { name: plugin.name });
  }
  /**
   * Unregister a plugin
   */
  unregisterPlugin(name) {
    const plugin = this._plugins.get(name);
    if (plugin) {
      plugin.destroy?.();
      this._plugins.delete(name);
      this.emit("plugin:unregistered", { name });
      return true;
    }
    return false;
  }
  /**
   * Get a plugin by name
   */
  getPlugin(name) {
    return this._plugins.get(name);
  }
  /**
   * List all registered plugins
   */
  listPlugins() {
    return Array.from(this._plugins.keys());
  }
  // ============================================================================
  // Context Preparation (Unified)
  // ============================================================================
  /**
   * Prepare context for LLM call
   *
   * Assembles all components:
   * - System prompt, instructions
   * - Conversation history
   * - Memory index
   * - Plugin components
   * - Current input
   *
   * Handles compaction automatically if budget is exceeded.
   */
  async prepare() {
    const components = await this.buildComponents();
    this.emit("context:preparing", { componentCount: components.length });
    let budget = this.calculateBudget(components);
    this._lastBudget = budget;
    if (budget.status === "warning") {
      this.emit("budget:warning", { budget });
    } else if (budget.status === "critical") {
      this.emit("budget:critical", { budget });
    }
    const needsCompaction = this._config.autoCompact && this._strategy.shouldCompact(budget, {
      ...DEFAULT_CONTEXT_CONFIG,
      maxContextTokens: this._maxContextTokens,
      responseReserve: this._config.responseReserve
    });
    if (needsCompaction) {
      const result = await this.doCompaction(components, budget);
      this.emit("context:prepared", { budget: result.budget, compacted: true });
      return result;
    }
    this.emit("context:prepared", { budget, compacted: false });
    return { components, budget, compacted: false };
  }
  /**
   * Get current budget without full preparation
   */
  async getBudget() {
    const components = await this.buildComponents();
    return this.calculateBudget(components);
  }
  /**
   * Force compaction
   */
  async compact() {
    const components = await this.buildComponents();
    const budget = this.calculateBudget(components);
    return this.doCompaction(components, budget);
  }
  // ============================================================================
  // Configuration
  // ============================================================================
  /**
   * Set compaction strategy
   */
  setStrategy(strategy) {
    this._strategy = createStrategy(strategy, {});
  }
  /**
   * Get max context tokens
   */
  getMaxContextTokens() {
    return this._maxContextTokens;
  }
  /**
   * Set max context tokens
   */
  setMaxContextTokens(tokens) {
    this._maxContextTokens = tokens;
  }
  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled) {
    this._cacheEnabled = enabled;
  }
  /**
   * Check if caching is enabled
   */
  isCacheEnabled() {
    return this._cacheEnabled;
  }
  // ============================================================================
  // Introspection
  // ============================================================================
  /**
   * Estimate tokens for content
   */
  estimateTokens(content, type) {
    return this._estimator.estimateTokens(content, type);
  }
  /**
   * Get utilization percentage
   */
  getUtilization() {
    return this._lastBudget?.utilizationPercent ?? 0;
  }
  /**
   * Get last calculated budget
   */
  getLastBudget() {
    return this._lastBudget;
  }
  /**
   * Get comprehensive metrics
   */
  async getMetrics() {
    const memoryStats = await this._memory.getStats();
    return {
      historyMessageCount: this._history.length,
      toolCallCount: this._toolCalls.length,
      cacheStats: this._cache.getStats(),
      memoryStats: {
        totalEntries: memoryStats.totalEntries,
        totalSizeBytes: memoryStats.totalSizeBytes,
        utilizationPercent: memoryStats.utilizationPercent
      },
      pluginCount: this._plugins.size,
      utilizationPercent: this._lastBudget?.utilizationPercent ?? 0
    };
  }
  // ============================================================================
  // Session Persistence (Unified)
  // ============================================================================
  /**
   * Get state for session persistence
   *
   * Serializes ALL state:
   * - History and tool calls
   * - Tool enable/disable state
   * - Memory state
   * - Permission state
   * - Plugin state
   */
  async getState() {
    const pluginStates = {};
    for (const [name, plugin] of this._plugins) {
      const state = plugin.getState?.();
      if (state !== void 0) {
        pluginStates[name] = state;
      }
    }
    const memoryStats = await this._memory.getStats();
    return {
      version: 1,
      core: {
        systemPrompt: this._systemPrompt,
        instructions: this._instructions,
        history: this._history,
        toolCalls: this._toolCalls
      },
      tools: this._tools.getState(),
      memoryStats: {
        entryCount: memoryStats.totalEntries,
        sizeBytes: memoryStats.totalSizeBytes
      },
      permissions: this._permissions.getState(),
      plugins: pluginStates,
      config: {
        model: this._config.model,
        maxContextTokens: this._maxContextTokens,
        strategy: this._strategy.name
      }
    };
  }
  /**
   * Restore from saved state
   *
   * Restores ALL state from a previous session.
   */
  async restoreState(state) {
    this._systemPrompt = state.core.systemPrompt || "";
    this._instructions = state.core.instructions || "";
    this._history = state.core.history || [];
    this._toolCalls = state.core.toolCalls || [];
    if (state.config.maxContextTokens) {
      this._maxContextTokens = state.config.maxContextTokens;
    }
    if (state.config.strategy) {
      this._strategy = createStrategy(state.config.strategy, {});
    }
    if (state.tools) {
      this._tools.loadState(state.tools);
    }
    if (state.permissions) {
      this._permissions.loadState(state.permissions);
    }
    for (const [name, pluginState] of Object.entries(state.plugins)) {
      const plugin = this._plugins.get(name);
      if (plugin?.restoreState) {
        plugin.restoreState(pluginState);
      }
    }
  }
  // ============================================================================
  // Cleanup
  // ============================================================================
  /**
   * Destroy the context and release resources
   */
  destroy() {
    for (const plugin of this._plugins.values()) {
      plugin.destroy?.();
    }
    this._plugins.clear();
    this._cache.destroy();
    this._tools.destroy();
    this._history = [];
    this._toolCalls = [];
    this.removeAllListeners();
  }
  // ============================================================================
  // Private Methods
  // ============================================================================
  /**
   * Build all context components
   * Uses task-type-aware priority profiles for compaction ordering
   */
  async buildComponents() {
    const components = [];
    const taskType = this.getTaskType();
    const priorityProfile = PRIORITY_PROFILES[taskType];
    const fullSystemPrompt = this._systemPrompt ? `${this._systemPrompt}

${this.getTaskTypePrompt()}` : this.getTaskTypePrompt();
    if (fullSystemPrompt) {
      components.push({
        name: "system_prompt",
        content: fullSystemPrompt,
        priority: 0,
        compactable: false
      });
    }
    if (this._instructions) {
      components.push({
        name: "instructions",
        content: this._instructions,
        priority: 0,
        compactable: false
      });
    }
    if (this._history.length > 0) {
      components.push({
        name: "conversation_history",
        content: this.formatHistoryForContext(),
        priority: priorityProfile.conversation_history ?? 6,
        compactable: true,
        metadata: {
          messageCount: this._history.length,
          strategy: taskType === "research" ? "summarize" : "truncate"
        }
      });
    }
    const memoryIndex = await this._memory.formatIndex();
    const isEmpty = !memoryIndex || memoryIndex.trim().length === 0 || memoryIndex.includes("Memory is empty.");
    if (!isEmpty) {
      components.push({
        name: "memory_index",
        content: memoryIndex,
        priority: priorityProfile.memory_index ?? 8,
        compactable: true,
        metadata: {
          strategy: "evict"
        }
      });
    }
    for (const plugin of this._plugins.values()) {
      try {
        const component = await plugin.getComponent();
        if (component) {
          const overridePriority = priorityProfile[component.name];
          if (overridePriority !== void 0) {
            component.priority = overridePriority;
          }
          components.push(component);
        }
      } catch (error) {
        console.warn(`Plugin '${plugin.name}' failed to get component:`, error);
      }
    }
    if (this._currentInput) {
      components.push({
        name: "current_input",
        content: this._currentInput,
        priority: 0,
        compactable: false
      });
    }
    return components;
  }
  /**
   * Format history for context
   */
  formatHistoryForContext() {
    return this._history.map((m) => {
      const roleLabel = m.role.charAt(0).toUpperCase() + m.role.slice(1);
      return `${roleLabel}: ${m.content}`;
    }).join("\n\n");
  }
  /**
   * Calculate budget
   */
  calculateBudget(components) {
    const breakdown = {};
    let used = 0;
    for (const component of components) {
      const tokens = estimateComponentTokens(component, this._estimator);
      breakdown[component.name] = tokens;
      used += tokens;
    }
    const total = this._maxContextTokens;
    const reserved = Math.floor(total * this._config.responseReserve);
    const available = total - reserved - used;
    const utilizationRatio = (used + reserved) / total;
    const utilizationPercent = used / (total - reserved) * 100;
    let status;
    if (utilizationRatio >= 0.9) {
      status = "critical";
    } else if (utilizationRatio >= 0.75) {
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
   * Perform compaction
   */
  async doCompaction(components, budget) {
    const log = [];
    let tokensFreed = 0;
    let currentBudget = budget;
    const compactable = components.filter((c) => c.compactable).sort((a, b) => b.priority - a.priority);
    for (const component of compactable) {
      if (currentBudget.status === "ok") break;
      let freed = 0;
      if (component.name === "conversation_history") {
        freed = this.compactHistory();
        if (freed > 0) log.push(`Compacted history: freed ~${freed} tokens`);
      } else if (component.name === "memory_index") {
        freed = await this.compactMemory();
        if (freed > 0) log.push(`Compacted memory: freed ~${freed} tokens`);
      } else {
        const plugin = this._plugins.get(component.name);
        if (plugin?.compact) {
          freed = await plugin.compact(currentBudget.available, this._estimator);
          if (freed > 0) log.push(`Compacted ${component.name}: freed ~${freed} tokens`);
        }
      }
      tokensFreed += freed;
      const newComponents = await this.buildComponents();
      currentBudget = this.calculateBudget(newComponents);
    }
    this._compactionCount++;
    this._totalTokensFreed += tokensFreed;
    const finalComponents = await this.buildComponents();
    const finalBudget = this.calculateBudget(finalComponents);
    this.emit("compacted", { log, tokensFreed });
    return {
      components: finalComponents,
      budget: finalBudget,
      compacted: true,
      compactionLog: log
    };
  }
  /**
   * Compact history
   */
  compactHistory() {
    const preserve = this._config.history.preserveRecent;
    const before = this._history.length;
    if (before <= preserve) return 0;
    const removed = this._history.slice(0, -preserve);
    this._history = this._history.slice(-preserve);
    const tokensFreed = removed.reduce(
      (sum, m) => sum + this._estimator.estimateTokens(m.content),
      0
    );
    this.emit("history:compacted", { removedCount: removed.length });
    return tokensFreed;
  }
  /**
   * Compact memory
   */
  async compactMemory() {
    const beforeIndex = await this._memory.formatIndex();
    const beforeTokens = this._estimator.estimateTokens(beforeIndex);
    await this._memory.evict(3, "lru");
    const afterIndex = await this._memory.formatIndex();
    const afterTokens = this._estimator.estimateTokens(afterIndex);
    return Math.max(0, beforeTokens - afterTokens);
  }
  /**
   * Create token estimator
   */
  createEstimator() {
    return {
      estimateTokens: (text, contentType) => {
        if (!text || text.length === 0) return 0;
        const ratio = contentType === "code" ? 3 : contentType === "prose" ? 4 : 3.5;
        return Math.ceil(text.length / ratio);
      },
      estimateDataTokens: (data, contentType) => {
        const serialized = JSON.stringify(data);
        const ratio = contentType === "code" ? 3 : contentType === "prose" ? 4 : 3.5;
        return Math.ceil(serialized.length / ratio);
      }
    };
  }
  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
};

// src/core/BaseAgent.ts
var BaseAgent = class extends eventemitter3.EventEmitter {
  // ===== Core Properties =====
  name;
  connector;
  model;
  // ===== Protected State =====
  _config;
  _agentContext;
  // SINGLE SOURCE OF TRUTH for tools
  _permissionManager;
  _sessionManager = null;
  _session = null;
  _pendingSessionLoad = null;
  _isDestroyed = false;
  _cleanupCallbacks = [];
  _logger;
  _lifecycleHooks;
  // ===== Constructor =====
  constructor(config, loggerComponent) {
    super();
    this._config = config;
    this.connector = this.resolveConnector(config.connector);
    this.name = config.name ?? `${this.getAgentType()}-${Date.now()}`;
    this.model = config.model;
    this._logger = exports.logger.child({
      component: loggerComponent,
      agentName: this.name,
      model: this.model,
      connector: this.connector.name
    });
    this._agentContext = this.initializeAgentContext(config);
    if (config.tools) {
      for (const tool of config.tools) {
        this._agentContext.tools.register(tool);
      }
    }
    this._permissionManager = this.initializePermissionManager(config.permissions, config.tools);
    this._lifecycleHooks = config.lifecycleHooks ?? {};
  }
  /**
   * Prepare session state before saving.
   * Subclasses override to add their specific state (plan, memory, etc.)
   *
   * Default implementation does nothing - override in subclasses.
   */
  prepareSessionState() {
  }
  /**
   * Restore session state after loading.
   * Subclasses override to restore their specific state (plan, memory, etc.)
   * Called after tool state and approval state are restored.
   *
   * Default implementation does nothing - override in subclasses.
   */
  async restoreSessionState(_session) {
  }
  /**
   * Get plan state for session serialization.
   * Subclasses with plans override this.
   */
  getSerializedPlan() {
    return void 0;
  }
  /**
   * Get memory state for session serialization.
   * Subclasses with working memory override this.
   */
  getSerializedMemory() {
    return void 0;
  }
  // ===== Protected Initialization Helpers =====
  /**
   * Resolve connector from string name or instance
   */
  resolveConnector(ref) {
    if (typeof ref === "string") {
      return exports.Connector.get(ref);
    }
    return ref;
  }
  /**
   * Initialize AgentContext (single source of truth for tools).
   * If AgentContext is provided, use it directly.
   * Otherwise, create a new one with the provided configuration.
   */
  initializeAgentContext(config) {
    if (config.context instanceof AgentContext) {
      return config.context;
    }
    const contextConfig = {
      model: config.model,
      // Subclasses can add systemPrompt via their config
      ...typeof config.context === "object" && config.context !== null ? config.context : {}
    };
    return AgentContext.create(contextConfig);
  }
  /**
   * Initialize tool manager with provided tools
   * @deprecated Use _agentContext.tools instead. This method is kept for backward compatibility.
   */
  initializeToolManager(existingManager, tools, options) {
    const manager = existingManager ?? new ToolManager();
    if (tools) {
      this.registerTools(manager, tools, options);
    }
    return manager;
  }
  /**
   * Register multiple tools with the tool manager
   * Utility method to avoid code duplication across agent types
   */
  registerTools(manager, tools, options) {
    for (const tool of tools) {
      manager.register(tool, options);
    }
  }
  /**
   * Initialize permission manager
   */
  initializePermissionManager(config, tools) {
    const manager = new ToolPermissionManager(config);
    if (tools) {
      for (const tool of tools) {
        if (tool.permission) {
          manager.setToolConfig(tool.definition.function.name, tool.permission);
        }
      }
    }
    return manager;
  }
  /**
   * Initialize session management (call from subclass constructor after other setup)
   */
  initializeSession(sessionConfig) {
    if (!sessionConfig) {
      return;
    }
    this._sessionManager = new SessionManager({ storage: sessionConfig.storage });
    if (sessionConfig.id) {
      this._pendingSessionLoad = this.loadSessionInternal(sessionConfig.id);
    } else {
      this._session = this._sessionManager.create(this.getAgentType(), {
        title: this.name
      });
      if (sessionConfig.autoSave) {
        const interval = sessionConfig.autoSaveIntervalMs ?? 3e4;
        this._sessionManager.enableAutoSave(this._session, interval);
      }
    }
  }
  /**
   * Ensure any pending session load is complete
   */
  async ensureSessionLoaded() {
    if (this._pendingSessionLoad) {
      await this._pendingSessionLoad;
      this._pendingSessionLoad = null;
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
          this._agentContext.tools.loadState(session.toolState);
        }
        const inheritFromSession = this._config.permissions?.inheritFromSession !== false;
        if (inheritFromSession && session.custom["approvalState"]) {
          this._permissionManager.loadState(
            session.custom["approvalState"]
          );
        }
        await this.restoreSessionState(session);
        this._logger.info({ sessionId }, "Session loaded");
        if (this._config.session?.autoSave) {
          const interval = this._config.session.autoSaveIntervalMs ?? 3e4;
          this._sessionManager.enableAutoSave(this._session, interval);
        }
      } else {
        this._logger.warn({ sessionId }, "Session not found, creating new session");
        this._session = this._sessionManager.create(this.getAgentType(), {
          title: this.name
        });
      }
    } catch (error) {
      this._logger.error(
        { error: error.message, sessionId },
        "Failed to load session"
      );
      throw error;
    }
  }
  // ===== Public Session API =====
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
   * Get the current session (for advanced use)
   */
  getSession() {
    return this._session;
  }
  /**
   * Save the current session to storage
   * @throws Error if session is not enabled
   */
  async saveSession() {
    await this.ensureSessionLoaded();
    if (!this._sessionManager || !this._session) {
      throw new Error(
        "Session not enabled. Configure session in agent config to use this feature."
      );
    }
    this._session.toolState = this._agentContext.tools.getState();
    this._session.custom["approvalState"] = this._permissionManager.getState();
    const plan = this.getSerializedPlan();
    if (plan) {
      this._session.plan = plan;
    }
    const memory = this.getSerializedMemory();
    if (memory) {
      this._session.memory = memory;
    }
    this.prepareSessionState();
    await this._sessionManager.save(this._session);
    this._logger.debug({ sessionId: this._session.id }, "Session saved");
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
  // ===== Public Permission API =====
  /**
   * Advanced tool management. Returns ToolManager for fine-grained control.
   * This is delegated to AgentContext.tools (single source of truth).
   */
  get tools() {
    return this._agentContext.tools;
  }
  /**
   * Get the AgentContext (unified context management).
   * This is the primary way to access tools, memory, cache, permissions, and history.
   */
  get context() {
    return this._agentContext;
  }
  /**
   * Permission management. Returns ToolPermissionManager for approval control.
   */
  get permissions() {
    return this._permissionManager;
  }
  // ===== Tool Management =====
  /**
   * Add a tool to the agent.
   * Tools are registered with AgentContext (single source of truth).
   */
  addTool(tool) {
    this._agentContext.tools.register(tool);
    if (tool.permission) {
      this._permissionManager.setToolConfig(tool.definition.function.name, tool.permission);
    }
  }
  /**
   * Remove a tool from the agent.
   * Tools are unregistered from AgentContext (single source of truth).
   */
  removeTool(toolName) {
    this._agentContext.tools.unregister(toolName);
  }
  /**
   * List registered tools (returns enabled tool names)
   */
  listTools() {
    return this._agentContext.tools.listEnabled();
  }
  /**
   * Replace all tools with a new array
   */
  setTools(tools) {
    this._agentContext.tools.clear();
    for (const tool of tools) {
      this._agentContext.tools.register(tool);
      if (tool.permission) {
        this._permissionManager.setToolConfig(tool.definition.function.name, tool.permission);
      }
    }
  }
  /**
   * Get enabled tool definitions (for passing to LLM).
   * This is a helper that extracts definitions from enabled tools.
   */
  getEnabledToolDefinitions() {
    return this._agentContext.tools.getEnabled().map((t) => t.definition);
  }
  // ===== Lifecycle Hooks =====
  /**
   * Get the current lifecycle hooks configuration
   */
  get lifecycleHooks() {
    return this._lifecycleHooks;
  }
  /**
   * Set or update lifecycle hooks at runtime
   */
  setLifecycleHooks(hooks) {
    this._lifecycleHooks = { ...this._lifecycleHooks, ...hooks };
  }
  /**
   * Invoke beforeToolExecution hook if defined.
   * Call this before executing a tool.
   *
   * @throws Error if hook throws (prevents tool execution)
   */
  async invokeBeforeToolExecution(context) {
    if (this._lifecycleHooks.beforeToolExecution) {
      try {
        await this._lifecycleHooks.beforeToolExecution(context);
      } catch (error) {
        this._logger.error(
          { error: error.message, toolName: context.toolName },
          "beforeToolExecution hook failed"
        );
        throw error;
      }
    }
  }
  /**
   * Invoke afterToolExecution hook if defined.
   * Call this after tool execution completes (success or failure).
   */
  async invokeAfterToolExecution(result) {
    if (this._lifecycleHooks.afterToolExecution) {
      try {
        await this._lifecycleHooks.afterToolExecution(result);
      } catch (error) {
        this._logger.error(
          { error: error.message, toolName: result.toolName },
          "afterToolExecution hook failed"
        );
      }
    }
  }
  /**
   * Invoke beforeContextPrepare hook if defined.
   * Call this before preparing context for LLM.
   */
  async invokeBeforeContextPrepare() {
    if (this._lifecycleHooks.beforeContextPrepare) {
      try {
        await this._lifecycleHooks.beforeContextPrepare(this.name);
      } catch (error) {
        this._logger.error(
          { error: error.message },
          "beforeContextPrepare hook failed"
        );
      }
    }
  }
  /**
   * Invoke beforeCompaction hook if defined.
   * Call this before context compaction occurs.
   * Gives the agent a chance to save important data to memory.
   */
  async invokeBeforeCompaction(context) {
    if (this._lifecycleHooks.beforeCompaction) {
      try {
        await this._lifecycleHooks.beforeCompaction(context);
      } catch (error) {
        this._logger.error(
          {
            error: error.message,
            strategy: context.strategy,
            estimatedTokensToFree: context.estimatedTokensToFree
          },
          "beforeCompaction hook failed"
        );
      }
    }
  }
  /**
   * Invoke afterCompaction hook if defined.
   * Call this after context compaction occurs.
   */
  async invokeAfterCompaction(log, tokensFreed) {
    if (this._lifecycleHooks.afterCompaction) {
      try {
        await this._lifecycleHooks.afterCompaction(log, tokensFreed);
      } catch (error) {
        this._logger.error(
          { error: error.message, tokensFreed },
          "afterCompaction hook failed"
        );
      }
    }
  }
  /**
   * Invoke onError hook if defined.
   * Call this when the agent encounters an error.
   */
  async invokeOnError(error, phase) {
    if (this._lifecycleHooks.onError) {
      try {
        await this._lifecycleHooks.onError(error, { phase, agentId: this.name });
      } catch (hookError) {
        this._logger.error(
          { error: hookError.message, originalError: error.message, phase },
          "onError hook failed"
        );
      }
    }
  }
  // ===== Lifecycle =====
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Register a cleanup callback
   */
  onCleanup(callback) {
    this._cleanupCallbacks.push(callback);
  }
  /**
   * Base cleanup for session and listeners.
   * Subclasses should call super.baseDestroy() in their destroy() method.
   */
  baseDestroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    this._logger.debug("Agent destroy started");
    if (this._sessionManager) {
      if (this._session) {
        this._sessionManager.stopAutoSave(this._session.id);
      }
      this._sessionManager.destroy();
    }
    this._agentContext.destroy();
    this._permissionManager.removeAllListeners();
    this.removeAllListeners();
  }
  /**
   * Run cleanup callbacks
   */
  async runCleanupCallbacks() {
    for (const callback of this._cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        this._logger.error({ error: error.message }, "Cleanup callback error");
      }
    }
    this._cleanupCallbacks = [];
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

// src/infrastructure/providers/base/BaseTextProvider.ts
init_CircuitBreaker();
init_Logger();
init_Metrics();
var BaseTextProvider = class extends BaseProvider {
  circuitBreaker;
  logger;
  _isObservabilityInitialized = false;
  constructor(config) {
    super(config);
    this.logger = exports.logger.child({
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
    const cbConfig = this.config.circuitBreaker || exports.DEFAULT_CIRCUIT_BREAKER_CONFIG;
    this.circuitBreaker = new exports.CircuitBreaker(
      `provider:${providerName}`,
      cbConfig
    );
    this.logger = exports.logger.child({
      component: "Provider",
      provider: providerName
    });
    this.circuitBreaker.on("opened", (data) => {
      this.logger.warn(data, "Circuit breaker opened");
      exports.metrics.increment("circuit_breaker.opened", 1, {
        breaker: data.name,
        provider: providerName
      });
    });
    this.circuitBreaker.on("closed", (data) => {
      this.logger.info(data, "Circuit breaker closed");
      exports.metrics.increment("circuit_breaker.closed", 1, {
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
    exports.metrics.increment("provider.llm.request", 1, {
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
      exports.metrics.timing("provider.llm.latency", duration, {
        provider: this.name,
        model: model || "unknown"
      });
      exports.metrics.increment("provider.llm.response", 1, {
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
      exports.metrics.increment("provider.llm.error", 1, {
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
  /**
   * Clean up provider resources (circuit breaker listeners, etc.)
   * Should be called when the provider is no longer needed.
   */
  destroy() {
    if (this.circuitBreaker) {
      this.circuitBreaker.removeAllListeners();
      this.circuitBreaker = void 0;
    }
    this._isObservabilityInitialized = false;
  }
};

// src/domain/entities/Message.ts
var MessageRole = /* @__PURE__ */ ((MessageRole2) => {
  MessageRole2["USER"] = "user";
  MessageRole2["ASSISTANT"] = "assistant";
  MessageRole2["DEVELOPER"] = "developer";
  return MessageRole2;
})(MessageRole || {});

// src/infrastructure/providers/openai/OpenAIResponsesConverter.ts
var OpenAIResponsesConverter = class {
  /**
   * Convert our input format to Responses API format
   */
  convertInput(input, instructions) {
    if (typeof input === "string") {
      return {
        input,
        instructions
      };
    }
    const items = [];
    for (const item of input) {
      if (item.type === "message") {
        const messageContent = [];
        for (const content of item.content) {
          switch (content.type) {
            case "input_text":
              messageContent.push({
                type: "input_text",
                text: content.text
              });
              break;
            case "input_image_url":
              messageContent.push({
                type: "input_image",
                image_url: content.image_url.url,
                ...content.image_url.detail && { detail: content.image_url.detail }
              });
              break;
            case "output_text":
              messageContent.push({
                type: "output_text",
                text: content.text
              });
              break;
            case "tool_use":
              items.push({
                type: "function_call",
                call_id: content.id,
                name: content.name,
                arguments: content.arguments
              });
              break;
            case "tool_result":
              const output = typeof content.content === "string" ? content.content : JSON.stringify(content.content);
              items.push({
                type: "function_call_output",
                call_id: content.tool_use_id,
                output
              });
              break;
          }
        }
        if (messageContent.length > 0) {
          items.push({
            type: "message",
            role: item.role,
            content: messageContent,
            id: item.id,
            status: "completed"
          });
        }
      } else if (item.type === "compaction") {
        items.push({
          type: "compaction",
          id: item.id,
          encrypted_content: item.encrypted_content
        });
      }
    }
    return {
      input: items,
      instructions
    };
  }
  /**
   * Convert Responses API response to our LLMResponse format
   */
  convertResponse(response) {
    const content = [];
    let outputText = "";
    let messageId;
    for (const item of response.output || []) {
      if (item.type === "message") {
        const messageItem = item;
        if (!messageId && messageItem.id) {
          messageId = messageItem.id;
        }
        for (const contentItem of messageItem.content || []) {
          if (contentItem.type === "output_text") {
            const textContent = contentItem;
            content.push({
              type: "output_text",
              text: textContent.text,
              annotations: textContent.annotations || []
            });
            outputText += textContent.text;
          }
        }
      } else if (item.type === "function_call") {
        const functionCall = item;
        content.push({
          type: "tool_use",
          id: functionCall.call_id,
          name: functionCall.name,
          arguments: functionCall.arguments
        });
      } else if (item.type === "reasoning") {
        const reasoning = item;
        if (reasoning.summary) {
          content.push({
            type: "reasoning",
            summary: reasoning.summary,
            // effort field may not exist in all versions
            ..."effort" in reasoning && { effort: reasoning.effort }
          });
        }
      }
    }
    if (!outputText) {
      outputText = response.output_text || "";
    }
    const finalMessageId = messageId || response.id;
    return {
      id: response.id,
      object: "response",
      created_at: response.created_at,
      status: response.status || "completed",
      model: response.model,
      output: [
        {
          type: "message",
          id: finalMessageId,
          role: "assistant" /* ASSISTANT */,
          content
        }
      ],
      output_text: outputText,
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      }
    };
  }
  /**
   * Convert our tool definitions to Responses API format
   *
   * Key difference: Responses API uses internally-tagged format
   * (no nested `function` object) and strict mode requires proper schemas
   */
  convertTools(tools) {
    return tools.map((tool) => {
      if (tool.type === "function") {
        const funcDef = tool.function;
        const useStrict = funcDef.strict === true;
        return {
          type: "function",
          name: funcDef.name,
          description: funcDef.description || "",
          parameters: funcDef.parameters || null,
          strict: useStrict
        };
      }
      return tool;
    });
  }
  /**
   * Convert tool_choice option to Responses API format
   */
  convertToolChoice(toolChoice) {
    if (!toolChoice || toolChoice === "auto") {
      return "auto";
    }
    if (toolChoice === "required") {
      return "required";
    }
    return {
      type: "function",
      name: toolChoice.function.name
    };
  }
  /**
   * Convert response_format option to Responses API format (modalities)
   */
  convertResponseFormat(responseFormat) {
    if (!responseFormat) {
      return void 0;
    }
    if (responseFormat.type === "json_schema" && responseFormat.json_schema) {
      return {
        type: "text",
        text: {
          type: "json_schema",
          name: responseFormat.json_schema.name || "response",
          schema: responseFormat.json_schema.schema || responseFormat.json_schema,
          description: responseFormat.json_schema.description,
          strict: responseFormat.json_schema.strict !== false
        }
      };
    }
    if (responseFormat.type === "json_object") {
      return {
        type: "text",
        text: {
          type: "json_object"
        }
      };
    }
    return {
      type: "text",
      text: {
        type: "text"
      }
    };
  }
};

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
function isToolCallStart(event) {
  return event.type === "response.tool_call.start" /* TOOL_CALL_START */;
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

// src/infrastructure/providers/openai/OpenAIResponsesStreamConverter.ts
var OpenAIResponsesStreamConverter = class {
  /**
   * Convert Responses API stream to our StreamEvent format
   */
  async *convertStream(stream) {
    let responseId = "";
    let sequenceNumber = 0;
    const activeItems = /* @__PURE__ */ new Map();
    const toolCallBuffers = /* @__PURE__ */ new Map();
    for await (const event of stream) {
      if (process.env.DEBUG_OPENAI) {
        console.error("[DEBUG] Responses API event:", event.type);
      }
      switch (event.type) {
        case "response.created": {
          responseId = event.response.id;
          yield {
            type: "response.created" /* RESPONSE_CREATED */,
            response_id: responseId,
            model: event.response.model,
            created_at: event.response.created_at
          };
          break;
        }
        case "response.output_item.added": {
          const addedEvent = event;
          const item = addedEvent.item;
          activeItems.set(addedEvent.output_index.toString(), {
            type: item.type
          });
          if (item.type === "function_call") {
            const functionCall = item;
            const toolCallId = functionCall.call_id;
            const toolName = functionCall.name;
            activeItems.set(addedEvent.output_index.toString(), {
              type: "function_call",
              toolCallId,
              toolName
            });
            toolCallBuffers.set(toolCallId, {
              id: toolCallId,
              name: toolName,
              args: ""
            });
            yield {
              type: "response.tool_call.start" /* TOOL_CALL_START */,
              response_id: responseId,
              item_id: `item_${addedEvent.output_index}`,
              tool_call_id: toolCallId,
              tool_name: toolName
            };
          }
          break;
        }
        case "response.output_text.delta": {
          const textEvent = event;
          yield {
            type: "response.output_text.delta" /* OUTPUT_TEXT_DELTA */,
            response_id: responseId,
            item_id: textEvent.item_id,
            output_index: textEvent.output_index,
            content_index: textEvent.content_index,
            delta: textEvent.delta || "",
            sequence_number: sequenceNumber++
          };
          break;
        }
        case "response.function_call_arguments.delta": {
          const argsEvent = event;
          const itemInfo = activeItems.get(argsEvent.output_index.toString());
          if (itemInfo?.toolCallId) {
            const buffer = toolCallBuffers.get(itemInfo.toolCallId);
            if (buffer) {
              buffer.args += argsEvent.delta || "";
              yield {
                type: "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */,
                response_id: responseId,
                item_id: argsEvent.item_id,
                tool_call_id: buffer.id,
                tool_name: buffer.name,
                delta: argsEvent.delta || "",
                sequence_number: sequenceNumber++
              };
            }
          }
          break;
        }
        case "response.output_item.done": {
          const doneEvent = event;
          const item = doneEvent.item;
          if (item.type === "function_call") {
            const functionCall = item;
            const buffer = toolCallBuffers.get(functionCall.call_id);
            if (buffer) {
              yield {
                type: "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */,
                response_id: responseId,
                tool_call_id: buffer.id,
                tool_name: buffer.name,
                arguments: buffer.args || functionCall.arguments
              };
            }
          }
          break;
        }
        case "response.completed": {
          const completedEvent = event;
          const response = completedEvent.response;
          let status = "completed";
          if (response.status === "failed") {
            status = "failed";
          } else if (response.status === "incomplete") {
            status = "incomplete";
          }
          yield {
            type: "response.complete" /* RESPONSE_COMPLETE */,
            response_id: responseId,
            status,
            usage: {
              input_tokens: response.usage?.input_tokens || 0,
              output_tokens: response.usage?.output_tokens || 0,
              total_tokens: response.usage?.total_tokens || 0
            },
            iterations: 1
          };
          break;
        }
        // Handle other event types if needed
        default:
          if (process.env.DEBUG_OPENAI) {
            console.error("[DEBUG] Unhandled Responses API event type:", event.type);
          }
      }
    }
  }
};

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
  converter;
  streamConverter;
  constructor(config) {
    super(config);
    this.client = new OpenAI2__default.default({
      apiKey: this.getApiKey(),
      baseURL: this.getBaseURL(),
      organization: config.organization,
      timeout: this.getTimeout(),
      maxRetries: this.getMaxRetries()
    });
    this.converter = new OpenAIResponsesConverter();
    this.streamConverter = new OpenAIResponsesStreamConverter();
  }
  /**
   * Check if a parameter is supported by the model
   */
  supportsParameter(model, parameter) {
    const modelInfo = getModelInfo(model);
    if (!modelInfo?.features.parameters) {
      return true;
    }
    return modelInfo.features.parameters[parameter] !== false;
  }
  /**
   * Generate response using OpenAI Responses API
   */
  async generate(options) {
    return this.executeWithCircuitBreaker(async () => {
      try {
        const { input, instructions } = this.converter.convertInput(
          options.input,
          options.instructions
        );
        const params = {
          model: options.model,
          input,
          ...instructions && { instructions },
          ...options.tools && options.tools.length > 0 && {
            tools: this.converter.convertTools(options.tools)
          },
          ...options.tool_choice && {
            tool_choice: this.converter.convertToolChoice(options.tool_choice)
          },
          ...options.temperature !== void 0 && this.supportsParameter(options.model, "temperature") && { temperature: options.temperature },
          ...options.max_output_tokens && { max_output_tokens: options.max_output_tokens },
          ...options.response_format && {
            text: this.converter.convertResponseFormat(options.response_format)
          },
          ...options.parallel_tool_calls !== void 0 && {
            parallel_tool_calls: options.parallel_tool_calls
          },
          ...options.previous_response_id && {
            previous_response_id: options.previous_response_id
          },
          ...options.metadata && { metadata: options.metadata }
        };
        const response = await this.client.responses.create(params);
        return this.converter.convertResponse(response);
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    }, options.model);
  }
  /**
   * Stream response using OpenAI Responses API
   */
  async *streamGenerate(options) {
    try {
      const { input, instructions } = this.converter.convertInput(
        options.input,
        options.instructions
      );
      const params = {
        model: options.model,
        input,
        ...instructions && { instructions },
        ...options.tools && options.tools.length > 0 && {
          tools: this.converter.convertTools(options.tools)
        },
        ...options.tool_choice && {
          tool_choice: this.converter.convertToolChoice(options.tool_choice)
        },
        ...options.temperature !== void 0 && this.supportsParameter(options.model, "temperature") && { temperature: options.temperature },
        ...options.max_output_tokens && { max_output_tokens: options.max_output_tokens },
        ...options.response_format && {
          text: this.converter.convertResponseFormat(options.response_format)
        },
        ...options.parallel_tool_calls !== void 0 && {
          parallel_tool_calls: options.parallel_tool_calls
        },
        ...options.previous_response_id && {
          previous_response_id: options.previous_response_id
        },
        ...options.metadata && { metadata: options.metadata },
        stream: true
      };
      const stream = await this.client.responses.create(params);
      yield* this.streamConverter.convertStream(stream);
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
function buildLLMResponse(options) {
  const {
    provider,
    rawId,
    model,
    status,
    content,
    usage,
    messageId,
    createdAt = Math.floor(Date.now() / 1e3)
  } = options;
  const responseId = rawId ? `resp_${provider}_${rawId}` : `resp_${provider}_${crypto2.randomUUID()}`;
  const msgId = messageId || `msg_${provider}_${crypto2.randomUUID()}`;
  const output = [
    {
      type: "message",
      id: msgId,
      role: "assistant" /* ASSISTANT */,
      content
    }
  ];
  const outputText = extractTextFromContent(content);
  return {
    id: responseId,
    object: "response",
    created_at: createdAt,
    status,
    model,
    output,
    output_text: outputText,
    usage: {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens ?? usage.inputTokens + usage.outputTokens
    }
  };
}
function extractTextFromContent(content) {
  return content.filter(
    (c) => c.type === "output_text" /* OUTPUT_TEXT */
  ).map((c) => c.text).join("\n");
}
function createTextContent(text) {
  return {
    type: "output_text" /* OUTPUT_TEXT */,
    text,
    annotations: []
  };
}
function createToolUseContent(id, name, args) {
  return {
    type: "tool_use" /* TOOL_USE */,
    id,
    name,
    arguments: typeof args === "string" ? args : JSON.stringify(args)
  };
}
function mapAnthropicStatus(stopReason) {
  switch (stopReason) {
    case "end_turn":
    case "tool_use":
    case "stop_sequence":
      return "completed";
    case "max_tokens":
      return "incomplete";
    default:
      return "incomplete";
  }
}
function mapGoogleStatus(finishReason) {
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
function generateToolCallId(provider) {
  const uuid = crypto2.randomUUID();
  return `${provider}_${uuid}` ;
}

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

// src/infrastructure/providers/base/BaseConverter.ts
var BaseConverter = class {
  // ==========================================================================
  // Protected Helper Methods (shared by all providers)
  // ==========================================================================
  /**
   * Convert InputItem array to provider messages
   * @param input - String or InputItem array
   * @returns Normalized input ready for provider conversion
   */
  normalizeInput(input) {
    if (typeof input === "string") {
      return [
        {
          type: "message",
          role: "user" /* USER */,
          content: [{ type: "input_text" /* INPUT_TEXT */, text: input }]
        }
      ];
    }
    return input;
  }
  /**
   * Map our role to provider-specific role
   * Override in subclass if provider uses different role names
   */
  mapRole(role) {
    if (role === "developer" /* DEVELOPER */) {
      return "user";
    }
    return role;
  }
  /**
   * Convert our Tool[] to provider-specific tool format
   */
  convertTools(tools) {
    if (!tools || tools.length === 0) {
      return void 0;
    }
    const standardTools = convertToolsToStandardFormat(tools);
    return standardTools.map((tool) => this.transformTool(tool));
  }
  /**
   * Parse tool arguments from JSON string
   * Throws InvalidToolArgumentsError on parse failure
   */
  parseToolArguments(name, argsString) {
    try {
      return JSON.parse(argsString);
    } catch (parseError) {
      throw new InvalidToolArgumentsError(
        name,
        argsString,
        parseError instanceof Error ? parseError : new Error(String(parseError))
      );
    }
  }
  /**
   * Parse a data URI into components
   * @returns Parsed image data or null if not a data URI
   */
  parseDataUri(url) {
    const matches = url.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches || matches.length < 3) {
      return null;
    }
    const format = matches[1];
    const data = matches[2];
    return {
      format,
      mediaType: `image/${format}`,
      data
    };
  }
  /**
   * Check if URL is a data URI
   */
  isDataUri(url) {
    return url.startsWith("data:");
  }
  /**
   * Build standardized LLMResponse using shared utility
   */
  buildResponse(options) {
    return buildLLMResponse({
      provider: this.providerName,
      ...options
    });
  }
  /**
   * Create a text content block
   */
  createText(text) {
    return createTextContent(text);
  }
  /**
   * Create a tool_use content block
   */
  createToolUse(id, name, args) {
    return createToolUseContent(id, name, args);
  }
  /**
   * Extract text from Content array
   */
  extractText(content) {
    return content.filter((c) => c.type === "output_text" /* OUTPUT_TEXT */).map((c) => c.text).join("\n");
  }
  /**
   * Handle content conversion for common content types
   * Can be used as a starting point in subclass convertContent methods
   */
  handleCommonContent(content, _handlers) {
    const handlers = _handlers;
    switch (content.type) {
      case "input_text" /* INPUT_TEXT */:
      case "output_text" /* OUTPUT_TEXT */:
        handlers.onText?.(content.text);
        return true;
      case "input_image_url" /* INPUT_IMAGE_URL */: {
        const imgContent = content;
        const parsed = this.parseDataUri(imgContent.image_url.url);
        handlers.onImage?.(imgContent.image_url.url, parsed);
        return true;
      }
      case "tool_use" /* TOOL_USE */: {
        const toolContent = content;
        const parsedArgs = this.parseToolArguments(toolContent.name, toolContent.arguments);
        handlers.onToolUse?.(toolContent.id, toolContent.name, parsedArgs);
        return true;
      }
      case "tool_result" /* TOOL_RESULT */: {
        const resultContent = content;
        const isError = !!resultContent.error;
        handlers.onToolResult?.(
          resultContent.tool_use_id,
          resultContent.content,
          isError,
          resultContent.error
        );
        return true;
      }
      default:
        return false;
    }
  }
  // ==========================================================================
  // Resource Cleanup (required lifecycle method)
  // ==========================================================================
  /**
   * Clean up any internal state/caches
   * Should be called after each request/response cycle to prevent memory leaks
   *
   * Default implementation does nothing - override if subclass maintains state
   */
  clear() {
  }
  /**
   * Alias for clear() - reset converter state
   */
  reset() {
    this.clear();
  }
};

// src/infrastructure/providers/anthropic/AnthropicConverter.ts
var AnthropicConverter = class extends BaseConverter {
  providerName = "anthropic";
  /**
   * Convert our format -> Anthropic Messages API format
   */
  convertRequest(options) {
    const messages = this.convertMessages(options.input);
    const tools = this.convertAnthropicTools(options.tools);
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
   * Convert Anthropic response -> our LLMResponse format
   */
  convertResponse(response) {
    return this.buildResponse({
      rawId: response.id,
      model: response.model,
      status: this.mapProviderStatus(response.stop_reason),
      content: this.convertProviderContent(response.content),
      messageId: response.id,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    });
  }
  // ==========================================================================
  // BaseConverter Abstract Method Implementations
  // ==========================================================================
  /**
   * Transform standardized tool to Anthropic format
   */
  transformTool(tool) {
    return {
      ...transformForAnthropic(tool),
      input_schema: {
        type: "object",
        ...tool.parameters
      }
    };
  }
  /**
   * Convert Anthropic content blocks to our Content[]
   */
  convertProviderContent(blocks) {
    const content = [];
    for (const block of blocks) {
      if (block.type === "text") {
        content.push(this.createText(block.text));
      } else if (block.type === "tool_use") {
        content.push(this.createToolUse(block.id, block.name, block.input));
      }
    }
    return content;
  }
  /**
   * Map Anthropic stop_reason to ResponseStatus
   */
  mapProviderStatus(status) {
    return mapAnthropicStatus(status);
  }
  // ==========================================================================
  // Anthropic-Specific Conversion Methods
  // ==========================================================================
  /**
   * Convert our InputItem[] -> Anthropic messages
   */
  convertMessages(input) {
    if (typeof input === "string") {
      return [{ role: "user", content: input }];
    }
    const messages = [];
    for (const item of input) {
      if (item.type === "message") {
        const role = this.mapRole(item.role);
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
   * Convert our Content[] -> Anthropic content blocks
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
        case "input_image_url" /* INPUT_IMAGE_URL */: {
          const imgContent = c;
          const block = this.convertImageToAnthropicBlock(imgContent.image_url.url);
          if (block) {
            blocks.push(block);
          }
          break;
        }
        case "tool_result" /* TOOL_RESULT */: {
          const resultContent = c;
          blocks.push(this.convertToolResultToAnthropicBlock(resultContent));
          break;
        }
        case "tool_use" /* TOOL_USE */: {
          const toolContent = c;
          const parsedInput = this.parseToolArguments(toolContent.name, toolContent.arguments);
          blocks.push({
            type: "tool_use",
            id: toolContent.id,
            name: toolContent.name,
            input: parsedInput
          });
          break;
        }
      }
    }
    if (blocks.length === 1 && blocks[0]?.type === "text") {
      return blocks[0].text;
    }
    return blocks;
  }
  /**
   * Convert image URL to Anthropic image block
   */
  convertImageToAnthropicBlock(url) {
    const parsed = this.parseDataUri(url);
    if (parsed) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: parsed.mediaType,
          data: parsed.data
        }
      };
    } else {
      return {
        type: "image",
        source: {
          type: "url",
          url
        }
      };
    }
  }
  /**
   * Convert tool result to Anthropic block
   * Anthropic requires non-empty content when is_error is true
   */
  convertToolResultToAnthropicBlock(resultContent) {
    const isError = !!resultContent.error;
    let toolResultContent;
    if (typeof resultContent.content === "string") {
      toolResultContent = resultContent.content || (isError ? resultContent.error : "");
    } else {
      toolResultContent = JSON.stringify(resultContent.content);
    }
    if (isError && !toolResultContent) {
      toolResultContent = resultContent.error || "Tool execution failed";
    }
    return {
      type: "tool_result",
      tool_use_id: resultContent.tool_use_id,
      content: toolResultContent,
      is_error: isError
    };
  }
  /**
   * Convert our Tool[] -> Anthropic tools
   * Uses shared conversion utilities (DRY)
   */
  convertAnthropicTools(tools) {
    if (!tools || tools.length === 0) {
      return void 0;
    }
    const standardTools = convertToolsToStandardFormat(tools);
    return standardTools.map((tool) => this.transformTool(tool));
  }
};

// src/infrastructure/providers/base/BaseStreamConverter.ts
var BaseStreamConverter = class {
  // ==========================================================================
  // Protected State (shared across all stream converters)
  // ==========================================================================
  /** Current response ID */
  responseId = "";
  /** Model name */
  model = "";
  /** Event sequence number for ordering */
  sequenceNumber = 0;
  /** Usage statistics */
  usage = { inputTokens: 0, outputTokens: 0 };
  /** Buffers for accumulating tool call arguments */
  toolCallBuffers = /* @__PURE__ */ new Map();
  // ==========================================================================
  // Public API
  // ==========================================================================
  /**
   * Convert provider stream to our StreamEvent format
   *
   * @param stream - Provider-specific async stream
   * @param model - Model name (may not be available in all events)
   */
  async *convertStream(stream, model) {
    this.reset();
    if (model) {
      this.model = model;
    }
    try {
      for await (const event of stream) {
        const converted = this.convertEvent(event);
        for (const evt of converted) {
          yield evt;
        }
      }
    } finally {
    }
  }
  /**
   * Clear all internal state
   * Should be called after stream is fully processed
   */
  clear() {
    this.responseId = "";
    this.model = "";
    this.sequenceNumber = 0;
    this.usage = { inputTokens: 0, outputTokens: 0 };
    this.toolCallBuffers.clear();
  }
  /**
   * Reset converter state for a new stream
   * Alias for clear()
   */
  reset() {
    this.clear();
  }
  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================
  /**
   * Generate a response ID with provider prefix
   */
  generateResponseId() {
    const uuid = crypto.randomUUID();
    return `resp_${this.providerName}_${uuid}`;
  }
  /**
   * Get next sequence number (auto-increments)
   */
  nextSequence() {
    return this.sequenceNumber++;
  }
  /**
   * Create RESPONSE_CREATED event
   */
  emitResponseCreated(responseId) {
    if (responseId) {
      this.responseId = responseId;
    } else if (!this.responseId) {
      this.responseId = this.generateResponseId();
    }
    return {
      type: "response.created" /* RESPONSE_CREATED */,
      response_id: this.responseId,
      model: this.model,
      created_at: Date.now()
    };
  }
  /**
   * Create OUTPUT_TEXT_DELTA event
   */
  emitTextDelta(delta, options) {
    return {
      type: "response.output_text.delta" /* OUTPUT_TEXT_DELTA */,
      response_id: this.responseId,
      item_id: options?.itemId || `msg_${this.responseId}`,
      output_index: options?.outputIndex ?? 0,
      content_index: options?.contentIndex ?? 0,
      delta,
      sequence_number: this.nextSequence()
    };
  }
  /**
   * Create TOOL_CALL_START event
   */
  emitToolCallStart(toolCallId, toolName, itemId) {
    this.toolCallBuffers.set(toolCallId, {
      id: toolCallId,
      name: toolName,
      args: ""
    });
    return {
      type: "response.tool_call.start" /* TOOL_CALL_START */,
      response_id: this.responseId,
      item_id: itemId || `msg_${this.responseId}`,
      tool_call_id: toolCallId,
      tool_name: toolName
    };
  }
  /**
   * Create TOOL_CALL_ARGUMENTS_DELTA event and accumulate args
   */
  emitToolCallArgsDelta(toolCallId, delta, toolName) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    if (buffer) {
      buffer.args += delta;
    }
    return {
      type: "response.tool_call_arguments.delta" /* TOOL_CALL_ARGUMENTS_DELTA */,
      response_id: this.responseId,
      item_id: `msg_${this.responseId}`,
      tool_call_id: toolCallId,
      tool_name: toolName || buffer?.name || "",
      delta,
      sequence_number: this.nextSequence()
    };
  }
  /**
   * Create TOOL_CALL_ARGUMENTS_DONE event with accumulated args
   */
  emitToolCallArgsDone(toolCallId, toolName) {
    const buffer = this.toolCallBuffers.get(toolCallId);
    const args = buffer?.args || "{}";
    const name = toolName || buffer?.name || "";
    return {
      type: "response.tool_call_arguments.done" /* TOOL_CALL_ARGUMENTS_DONE */,
      response_id: this.responseId,
      tool_call_id: toolCallId,
      tool_name: name,
      arguments: args
    };
  }
  /**
   * Create RESPONSE_COMPLETE event
   */
  emitResponseComplete(status = "completed") {
    return {
      type: "response.complete" /* RESPONSE_COMPLETE */,
      response_id: this.responseId,
      status,
      usage: {
        input_tokens: this.usage.inputTokens,
        output_tokens: this.usage.outputTokens,
        total_tokens: this.usage.inputTokens + this.usage.outputTokens
      },
      iterations: 1
    };
  }
  /**
   * Update usage statistics
   */
  updateUsage(inputTokens, outputTokens) {
    if (inputTokens !== void 0) {
      this.usage.inputTokens = inputTokens;
    }
    if (outputTokens !== void 0) {
      this.usage.outputTokens = outputTokens;
    }
  }
  /**
   * Get accumulated arguments for a tool call
   */
  getAccumulatedArgs(toolCallId) {
    return this.toolCallBuffers.get(toolCallId)?.args || "{}";
  }
  /**
   * Check if we have buffered data for a tool call
   */
  hasToolCallBuffer(toolCallId) {
    return this.toolCallBuffers.has(toolCallId);
  }
};

// src/infrastructure/providers/anthropic/AnthropicStreamConverter.ts
var AnthropicStreamConverter = class extends BaseStreamConverter {
  providerName = "anthropic";
  /** Map of content block index to block info */
  contentBlockIndex = /* @__PURE__ */ new Map();
  /**
   * Convert a single Anthropic event to our StreamEvent(s)
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
   * Clear all internal state
   */
  clear() {
    super.clear();
    this.contentBlockIndex.clear();
  }
  // ==========================================================================
  // Anthropic-Specific Event Handlers
  // ==========================================================================
  /**
   * Handle message_start event
   */
  handleMessageStart(event) {
    this.responseId = event.message.id;
    if (event.message.usage) {
      this.updateUsage(event.message.usage.input_tokens, void 0);
    }
    return [this.emitResponseCreated(this.responseId)];
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
        name: block.name
      });
      return [this.emitToolCallStart(block.id, block.name, `msg_${this.responseId}`)];
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
        this.emitTextDelta(delta.text, {
          itemId: `msg_${this.responseId}`,
          contentIndex: index
        })
      ];
    } else if (delta.type === "input_json_delta") {
      const toolCallId = blockInfo.id || "";
      return [this.emitToolCallArgsDelta(toolCallId, delta.partial_json, blockInfo.name)];
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
      return [this.emitToolCallArgsDone(blockInfo.id || "", blockInfo.name)];
    }
    return [];
  }
  /**
   * Handle message_delta event (usage info, stop_reason)
   */
  handleMessageDelta(event) {
    if (event.usage) {
      this.updateUsage(void 0, event.usage.output_tokens);
    }
    return [];
  }
  /**
   * Handle message_stop event (final event)
   */
  handleMessageStop() {
    return [this.emitResponseComplete("completed")];
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
    this.client = new Anthropic__default.default({
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
    if (options.vendorOptions?.thinkingLevel) {
      request.generationConfig.thinkingConfig = {
        thinkingLevel: options.vendorOptions.thinkingLevel
      };
    }
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
    if (process.env.DEBUG_GOOGLE) {
      console.error("[DEBUG] Content array:", JSON.stringify(content, null, 2));
      console.error("[DEBUG] Raw parts:", JSON.stringify(geminiContent?.parts, null, 2));
    }
    return buildLLMResponse({
      provider: "google",
      model: response.modelVersion || "gemini",
      status: mapGoogleStatus(candidate?.finishReason),
      content,
      messageId: response.id,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0
      }
    });
  }
  /**
   * Convert Google parts → our Content[]
   */
  convertGeminiPartsToContent(parts) {
    const content = [];
    for (const part of parts) {
      if ("text" in part && part.text) {
        content.push(createTextContent(part.text));
      } else if ("functionCall" in part && part.functionCall) {
        const toolId = generateToolCallId("google");
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
        content.push(createToolUseContent(toolId, functionName, part.functionCall.args || {}));
      }
    }
    return content;
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
    return `resp_google_${crypto2.randomUUID()}`;
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
    this.client = new genai.GoogleGenAI({
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
            generationConfig: googleRequest.generationConfig,
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
    this.client = new genai.GoogleGenAI({
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
  const injectedProvider = connector.getOptions().provider;
  if (injectedProvider && typeof injectedProvider.generate === "function") {
    return injectedProvider;
  }
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
  } else if (auth.type === "none") {
    apiKey = "mock-key";
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

// src/domain/entities/Tool.ts
var ToolCallState = /* @__PURE__ */ ((ToolCallState2) => {
  ToolCallState2["PENDING"] = "pending";
  ToolCallState2["EXECUTING"] = "executing";
  ToolCallState2["COMPLETED"] = "completed";
  ToolCallState2["FAILED"] = "failed";
  ToolCallState2["TIMEOUT"] = "timeout";
  return ToolCallState2;
})(ToolCallState || {});
function defaultDescribeCall(args, maxLength = 60) {
  if (!args || typeof args !== "object") {
    return "";
  }
  const priorityKeys = [
    "file_path",
    "path",
    "command",
    "query",
    "pattern",
    "url",
    "key",
    "name",
    "message",
    "content",
    "expression",
    "prompt"
  ];
  for (const key of priorityKeys) {
    if (key in args && args[key] != null) {
      const value = args[key];
      const str = typeof value === "string" ? value : JSON.stringify(value);
      return str.length > maxLength ? str.slice(0, maxLength - 3) + "..." : str;
    }
  }
  for (const [, value] of Object.entries(args)) {
    if (typeof value === "string" && value.length > 0) {
      return value.length > maxLength ? value.slice(0, maxLength - 3) + "..." : value;
    }
  }
  const firstEntry = Object.entries(args)[0];
  if (firstEntry) {
    const [key, value] = firstEntry;
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length > maxLength) {
      return `${key}=${str.slice(0, maxLength - key.length - 4)}...`;
    }
    return `${key}=${str}`;
  }
  return "";
}
function getToolCallDescription(tool, args) {
  if (tool.describeCall) {
    try {
      return tool.describeCall(args);
    } catch {
    }
  }
  return defaultDescribeCall(args);
}

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
var AgenticLoop = class extends eventemitter3.EventEmitter {
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
    const executionId = `exec_${crypto2.randomUUID()}`;
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
    const executionId = `exec_${crypto2.randomUUID()}`;
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
      temperature: config.temperature,
      vendorOptions: config.vendorOptions
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
   * Check tool permission before execution
   * Returns true if approved, throws if blocked/rejected
   * @private
   */
  async checkToolPermission(toolCall, iteration, executionId, config) {
    const permissionManager = config.permissionManager;
    if (!permissionManager) {
      return true;
    }
    const toolName = toolCall.function.name;
    if (permissionManager.isBlocked(toolName)) {
      this.context?.audit("tool_blocked", { reason: "Tool is blocklisted" }, void 0, toolName);
      throw new Error(`Tool "${toolName}" is blocked and cannot be executed`);
    }
    if (permissionManager.isApproved(toolName)) {
      return true;
    }
    const checkResult = permissionManager.checkPermission(toolName);
    if (!checkResult.needsApproval) {
      return true;
    }
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
    }
    const context = {
      toolCall,
      parsedArgs,
      config: checkResult.config || {},
      executionId,
      iteration,
      agentType: config.agentType || "agent",
      taskName: config.taskName
    };
    const decision = await permissionManager.requestApproval(context);
    if (decision.approved) {
      this.context?.audit("tool_permission_approved", {
        scope: decision.scope,
        approvedBy: decision.approvedBy
      }, void 0, toolName);
      return true;
    }
    return false;
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
    const permissionApproved = await this.checkToolPermission(toolCall, iteration, executionId, config);
    if (!permissionApproved || this.hookManager.hasHooks("approve:tool")) {
      const approval = await this.hookManager.executeHooks("approve:tool", {
        executionId,
        iteration,
        toolCall,
        context: this.context,
        timestamp: /* @__PURE__ */ new Date()
      }, { approved: permissionApproved });
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
      temperature: config.temperature,
      vendorOptions: config.vendorOptions
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
      let permissionApproved = true;
      try {
        permissionApproved = await this.checkToolPermission(toolCall, iteration, executionId, config);
      } catch (error) {
        this.context?.audit("tool_blocked", { reason: error.message }, void 0, toolCall.function.name);
        const blockedResult = {
          tool_use_id: toolCall.id,
          content: "",
          error: error.message,
          state: "failed" /* FAILED */
        };
        results.push(blockedResult);
        this.context?.addToolResult(blockedResult);
        continue;
      }
      if (!permissionApproved || this.hookManager.hasHooks("approve:tool")) {
        const approval = await this.hookManager.executeHooks("approve:tool", {
          executionId,
          iteration,
          toolCall,
          context: this.context,
          timestamp: /* @__PURE__ */ new Date()
        }, { approved: permissionApproved });
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
    return new Promise((resolve3, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError("tool", timeoutMs));
      }, timeoutMs);
      fn().then((result) => {
        clearTimeout(timer);
        resolve3(result);
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
    this.pausePromise = new Promise((resolve3) => {
      this.resumeCallback = resolve3;
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
init_Metrics();
var Agent = class _Agent extends BaseAgent {
  // ===== Agent-specific State =====
  provider;
  agenticLoop;
  boundListeners = /* @__PURE__ */ new Map();
  // ===== Static Factory =====
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
    await agent.ensureSessionLoaded();
    return agent;
  }
  // ===== Constructor =====
  constructor(config) {
    super(config, "Agent");
    this._logger.debug({ config }, "Agent created");
    exports.metrics.increment("agent.created", 1, {
      model: this.model,
      connector: this.connector.name
    });
    this.provider = createProvider(this.connector);
    if (config.instructions) {
      this._agentContext.systemPrompt = config.instructions;
    }
    this._logger.debug("Using inherited AgentContext from BaseAgent");
    this._agentContext.tools.on("tool:registered", ({ name }) => {
      const permission = this._agentContext.tools.getPermission(name);
      if (permission) {
        this._permissionManager.setToolConfig(name, permission);
      }
    });
    this.agenticLoop = new AgenticLoop(
      this.provider,
      this._agentContext.tools,
      config.hooks,
      config.errorHandling
    );
    this.setupEventForwarding();
    this.initializeSession(config.session);
  }
  // ===== Abstract Method Implementations =====
  getAgentType() {
    return "agent";
  }
  prepareSessionState() {
    if (this._session) {
      this._agentContext.getState().then((contextState) => {
        if (this._session) {
          this._session.metadata = {
            ...this._session.metadata,
            agentContext: contextState
          };
        }
      });
    }
  }
  // ===== Context Access =====
  // Note: `context` getter is inherited from BaseAgent (returns _agentContext)
  /**
   * Check if context management is enabled.
   * Always returns true since AgentContext is always created by BaseAgent.
   */
  hasContext() {
    return true;
  }
  /**
   * Get context state for session persistence.
   */
  async getContextState() {
    return this._agentContext.getState();
  }
  /**
   * Restore context from saved state.
   */
  async restoreContextState(state) {
    await this._agentContext.restoreState(state);
  }
  // ===== Main API =====
  /**
   * Run the agent with input
   */
  async run(input) {
    assertNotDestroyed(this, "run agent");
    await this.ensureSessionLoaded();
    const inputPreview = typeof input === "string" ? input.substring(0, 100) : `${input.length} messages`;
    this._logger.info({
      inputPreview,
      toolCount: this._config.tools?.length || 0
    }, "Agent run started");
    exports.metrics.increment("agent.run.started", 1, {
      model: this.model,
      connector: this.connector.name
    });
    const startTime = Date.now();
    const userContent = typeof input === "string" ? input : input.map((i) => JSON.stringify(i)).join("\n");
    this._agentContext.addMessage("user", userContent);
    this._agentContext.setCurrentInput(userContent);
    try {
      const tools = this.getEnabledToolDefinitions();
      const loopConfig = {
        model: this.model,
        input,
        instructions: this._config.instructions,
        tools,
        temperature: this._config.temperature,
        maxIterations: this._config.maxIterations || 10,
        vendorOptions: this._config.vendorOptions,
        hooks: this._config.hooks,
        historyMode: this._config.historyMode,
        limits: this._config.limits,
        errorHandling: this._config.errorHandling,
        permissionManager: this._permissionManager,
        agentType: "agent"
      };
      const response = await this.agenticLoop.execute(loopConfig);
      const duration = Date.now() - startTime;
      if (response.output_text) {
        this._agentContext.addMessage("assistant", response.output_text);
      }
      this._logger.info({ duration }, "Agent run completed");
      exports.metrics.timing("agent.run.duration", duration, {
        model: this.model,
        connector: this.connector.name
      });
      exports.metrics.increment("agent.run.completed", 1, {
        model: this.model,
        connector: this.connector.name,
        status: "success"
      });
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logger.error({
        error: error.message,
        duration
      }, "Agent run failed");
      exports.metrics.increment("agent.run.completed", 1, {
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
    await this.ensureSessionLoaded();
    const inputPreview = typeof input === "string" ? input.substring(0, 100) : `${input.length} messages`;
    this._logger.info({
      inputPreview,
      toolCount: this._config.tools?.length || 0
    }, "Agent stream started");
    exports.metrics.increment("agent.stream.started", 1, {
      model: this.model,
      connector: this.connector.name
    });
    const startTime = Date.now();
    const userContent = typeof input === "string" ? input : input.map((i) => JSON.stringify(i)).join("\n");
    this._agentContext.addMessage("user", userContent);
    this._agentContext.setCurrentInput(userContent);
    let accumulatedResponse = "";
    try {
      const tools = this.getEnabledToolDefinitions();
      const loopConfig = {
        model: this.model,
        input,
        instructions: this._config.instructions,
        tools,
        temperature: this._config.temperature,
        maxIterations: this._config.maxIterations || 10,
        vendorOptions: this._config.vendorOptions,
        hooks: this._config.hooks,
        historyMode: this._config.historyMode,
        limits: this._config.limits,
        errorHandling: this._config.errorHandling,
        permissionManager: this._permissionManager,
        agentType: "agent"
      };
      for await (const event of this.agenticLoop.executeStreaming(loopConfig)) {
        if (isOutputTextDelta(event)) {
          accumulatedResponse += event.delta;
        }
        yield event;
      }
      if (accumulatedResponse) {
        this._agentContext.addMessage("assistant", accumulatedResponse);
      }
      const duration = Date.now() - startTime;
      this._logger.info({ duration }, "Agent stream completed");
      exports.metrics.timing("agent.stream.duration", duration, {
        model: this.model,
        connector: this.connector.name
      });
      exports.metrics.increment("agent.stream.completed", 1, {
        model: this.model,
        connector: this.connector.name,
        status: "success"
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logger.error({
        error: error.message,
        duration
      }, "Agent stream failed");
      exports.metrics.increment("agent.stream.completed", 1, {
        model: this.model,
        connector: this.connector.name,
        status: "error"
      });
      throw error;
    }
  }
  // ===== Tool Management =====
  // Note: addTool, removeTool, listTools, setTools are inherited from BaseAgent
  // ===== Permission Convenience Methods =====
  /**
   * Approve a tool for the current session.
   */
  approveToolForSession(toolName) {
    this._permissionManager.approveForSession(toolName);
  }
  /**
   * Revoke a tool's session approval.
   */
  revokeToolApproval(toolName) {
    this._permissionManager.revoke(toolName);
  }
  /**
   * Get list of tools that have been approved for this session.
   */
  getApprovedTools() {
    return this._permissionManager.getApprovedTools();
  }
  /**
   * Check if a tool needs approval before execution.
   */
  toolNeedsApproval(toolName) {
    return this._permissionManager.checkPermission(toolName).needsApproval;
  }
  /**
   * Check if a tool is blocked (cannot execute at all).
   */
  toolIsBlocked(toolName) {
    return this._permissionManager.isBlocked(toolName);
  }
  /**
   * Add a tool to the allowlist (always allowed, no approval needed).
   */
  allowlistTool(toolName) {
    this._permissionManager.allowlistAdd(toolName);
  }
  /**
   * Add a tool to the blocklist (always blocked, cannot execute).
   */
  blocklistTool(toolName) {
    this._permissionManager.blocklistAdd(toolName);
  }
  // ===== Configuration Methods =====
  /**
   * Change the model
   */
  setModel(model) {
    this.model = model;
    this._config.model = model;
  }
  /**
   * Get current temperature
   */
  getTemperature() {
    return this._config.temperature;
  }
  /**
   * Change the temperature
   */
  setTemperature(temperature) {
    this._config.temperature = temperature;
  }
  // ===== Control Methods =====
  pause(reason) {
    this.agenticLoop.pause(reason);
  }
  resume() {
    this.agenticLoop.resume();
  }
  cancel(reason) {
    this.agenticLoop.cancel(reason);
  }
  // ===== Introspection =====
  getContext() {
    return this.agenticLoop.getContext();
  }
  getMetrics() {
    return this.agenticLoop.getContext()?.metrics || null;
  }
  getSummary() {
    return this.agenticLoop.getContext()?.getSummary() || null;
  }
  getAuditTrail() {
    return this.agenticLoop.getContext()?.getAuditTrail() || [];
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
    return this._agentContext.tools.getCircuitBreakerStates();
  }
  /**
   * Get circuit breaker metrics for a specific tool
   */
  getToolCircuitBreakerMetrics(toolName) {
    return this._agentContext.tools.getToolCircuitBreakerMetrics(toolName);
  }
  /**
   * Manually reset a tool's circuit breaker
   */
  resetToolCircuitBreaker(toolName) {
    this._agentContext.tools.resetToolCircuitBreaker(toolName);
    this._logger.info({ toolName }, "Tool circuit breaker reset by user");
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
  // ===== Cleanup =====
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._logger.debug("Agent destroy started");
    try {
      this.agenticLoop.cancel("Agent destroyed");
    } catch {
    }
    for (const [eventName, handler] of this.boundListeners) {
      this.agenticLoop.off(eventName, handler);
    }
    this.boundListeners.clear();
    for (const callback of this._cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        this._logger.error({ error: error.message }, "Cleanup callback error");
      }
    }
    this._cleanupCallbacks = [];
    this.baseDestroy();
    exports.metrics.increment("agent.destroyed", 1, {
      model: this.model,
      connector: this.connector.name
    });
    this._logger.debug("Agent destroyed");
  }
  // ===== Private =====
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
    const registered = [];
    try {
      for (const eventName of eventNames) {
        const handler = (data) => {
          if (!this._isDestroyed) {
            this.emit(eventName, data);
          }
        };
        this.agenticLoop.on(eventName, handler);
        registered.push([eventName, handler]);
        this.boundListeners.set(eventName, handler);
      }
    } catch (error) {
      for (const [eventName, handler] of registered) {
        this.agenticLoop.off(eventName, handler);
      }
      throw error;
    }
  }
};
(class {
  static DEFAULT_PATHS = [
    "./oneringai.config.json",
    path3.join(os.homedir(), ".oneringai", "config.json")
  ];
  /**
   * Load configuration from file
   */
  static async load(path5) {
    const configPath = path5 ? path3.resolve(path5) : await this.findConfig();
    if (!configPath) {
      throw new Error("Configuration file not found. Searched: " + this.DEFAULT_PATHS.join(", "));
    }
    try {
      const content = await fs11.promises.readFile(configPath, "utf-8");
      let config = JSON.parse(content);
      config = this.interpolateEnvVars(config);
      this.validate(config);
      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file '${configPath}': ${error.message}`);
      }
      throw error;
    }
  }
  /**
   * Load configuration synchronously
   */
  static loadSync(path5) {
    const configPath = path5 ? path3.resolve(path5) : this.findConfigSync();
    if (!configPath) {
      throw new Error("Configuration file not found. Searched: " + this.DEFAULT_PATHS.join(", "));
    }
    try {
      const fs12 = __require("fs");
      const content = fs12.readFileSync(configPath, "utf-8");
      let config = JSON.parse(content);
      config = this.interpolateEnvVars(config);
      this.validate(config);
      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file '${configPath}': ${error.message}`);
      }
      throw error;
    }
  }
  /**
   * Find configuration file in default paths
   */
  static async findConfig() {
    for (const path5 of this.DEFAULT_PATHS) {
      try {
        await fs11.promises.access(path3.resolve(path5));
        return path3.resolve(path5);
      } catch {
      }
    }
    return null;
  }
  /**
   * Find configuration file synchronously
   */
  static findConfigSync() {
    const fs12 = __require("fs");
    for (const path5 of this.DEFAULT_PATHS) {
      try {
        fs12.accessSync(path3.resolve(path5));
        return path3.resolve(path5);
      } catch {
      }
    }
    return null;
  }
  /**
   * Interpolate environment variables in configuration
   * Replaces ${ENV_VAR} with process.env.ENV_VAR
   */
  static interpolateEnvVars(config) {
    const jsonString = JSON.stringify(config);
    const interpolated = jsonString.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const value = process.env[envVar];
      if (value === void 0) {
        console.warn(`Warning: Environment variable '${envVar}' is not set`);
        return match;
      }
      return value;
    });
    return JSON.parse(interpolated);
  }
  /**
   * Basic validation of configuration structure
   */
  static validate(config) {
    if (typeof config !== "object" || config === null) {
      throw new Error("Configuration must be an object");
    }
    if (config.mcp) {
      if (!Array.isArray(config.mcp.servers)) {
        throw new Error('MCP configuration must have a "servers" array');
      }
      for (const server of config.mcp.servers) {
        if (!server.name) {
          throw new Error('Each MCP server must have a "name" field');
        }
        if (!server.transport) {
          throw new Error(`MCP server '${server.name}' must have a "transport" field`);
        }
        if (!server.transportConfig) {
          throw new Error(`MCP server '${server.name}' must have a "transportConfig" field`);
        }
      }
    }
  }
});

// src/core/TextToSpeech.ts
init_Connector();

// src/infrastructure/providers/base/BaseMediaProvider.ts
init_CircuitBreaker();
init_Logger();
init_Metrics();
var BaseMediaProvider = class extends BaseProvider {
  circuitBreaker;
  logger;
  _isObservabilityInitialized = false;
  constructor(config) {
    super(config);
    this.logger = exports.logger.child({
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
    const cbConfig = this.config.circuitBreaker || exports.DEFAULT_CIRCUIT_BREAKER_CONFIG;
    this.circuitBreaker = new exports.CircuitBreaker(
      `media-provider:${providerName}`,
      cbConfig
    );
    this.logger = exports.logger.child({
      component: "MediaProvider",
      provider: providerName
    });
    this.circuitBreaker.on("opened", (data) => {
      this.logger.warn(data, "Circuit breaker opened");
      exports.metrics.increment("circuit_breaker.opened", 1, {
        breaker: data.name,
        provider: providerName
      });
    });
    this.circuitBreaker.on("closed", (data) => {
      this.logger.info(data, "Circuit breaker closed");
      exports.metrics.increment("circuit_breaker.closed", 1, {
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
      exports.metrics.histogram(`${operationName}.duration`, duration, metricLabels);
      exports.metrics.increment(`${operationName}.success`, 1, metricLabels);
      this.logger.debug(
        { operation: operationName, duration, ...metadata },
        "Operation completed successfully"
      );
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      exports.metrics.increment(`${operationName}.error`, 1, {
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
  // Default voice
  { id: "Kore", name: "Kore", language: "multi", gender: "female", isDefault: true },
  // Primary voices
  { id: "Puck", name: "Puck", language: "multi", gender: "neutral" },
  { id: "Charon", name: "Charon", language: "multi", gender: "male" },
  { id: "Fenrir", name: "Fenrir", language: "multi", gender: "male" },
  { id: "Zephyr", name: "Zephyr", language: "multi", gender: "neutral" },
  { id: "Leda", name: "Leda", language: "multi", gender: "female" },
  { id: "Orus", name: "Orus", language: "multi", gender: "male" },
  { id: "Aoede", name: "Aoede", language: "multi", gender: "female" },
  // Extended voices (celestial/astronomical naming)
  { id: "Callirrhoe", name: "Callirrhoe", language: "multi", gender: "female" },
  { id: "Autonoe", name: "Autonoe", language: "multi", gender: "female" },
  { id: "Enceladus", name: "Enceladus", language: "multi", gender: "male" },
  { id: "Iapetus", name: "Iapetus", language: "multi", gender: "male" },
  { id: "Umbriel", name: "Umbriel", language: "multi", gender: "neutral" },
  { id: "Algieba", name: "Algieba", language: "multi", gender: "male" },
  { id: "Despina", name: "Despina", language: "multi", gender: "female" },
  { id: "Erinome", name: "Erinome", language: "multi", gender: "female" },
  { id: "Algenib", name: "Algenib", language: "multi", gender: "male" },
  { id: "Rasalgethi", name: "Rasalgethi", language: "multi", gender: "male" },
  { id: "Laomedeia", name: "Laomedeia", language: "multi", gender: "female" },
  { id: "Achernar", name: "Achernar", language: "multi", gender: "male" },
  { id: "Alnilam", name: "Alnilam", language: "multi", gender: "male" },
  { id: "Schedar", name: "Schedar", language: "multi", gender: "female" },
  { id: "Gacrux", name: "Gacrux", language: "multi", gender: "male" },
  { id: "Pulcherrima", name: "Pulcherrima", language: "multi", gender: "female" },
  { id: "Achird", name: "Achird", language: "multi", gender: "male" },
  { id: "Zubenelgenubi", name: "Zubenelgenubi", language: "multi", gender: "male" },
  { id: "Vindemiatrix", name: "Vindemiatrix", language: "multi", gender: "female" },
  { id: "Sadachbia", name: "Sadachbia", language: "multi", gender: "male" },
  { id: "Sadaltager", name: "Sadaltager", language: "multi", gender: "male" },
  { id: "Sulafat", name: "Sulafat", language: "multi", gender: "female" }
];
var GEMINI_TTS_LANGUAGES = [
  "ar-EG",
  // Arabic (Egyptian)
  "bn",
  // Bengali
  "de-DE",
  // German (Germany)
  "en-US",
  // English (US)
  "en-IN",
  // English (India)
  "es",
  // Spanish
  "fr-FR",
  // French (France)
  "hi",
  // Hindi
  "id",
  // Indonesian
  "it",
  // Italian
  "ja",
  // Japanese
  "ko",
  // Korean
  "mr",
  // Marathi
  "nl",
  // Dutch
  "pl",
  // Polish
  "pt-BR",
  // Portuguese (Brazil)
  "ro",
  // Romanian
  "ru",
  // Russian
  "ta",
  // Tamil
  "te",
  // Telugu
  "th",
  // Thai
  "tr",
  // Turkish
  "uk",
  // Ukrainian
  "vi"
  // Vietnamese
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
  ]};
var AUDIO_FORMATS = {
  /**
   * OpenAI TTS output formats
   * Source: https://platform.openai.com/docs/guides/text-to-speech
   */
  OPENAI_TTS: ["mp3", "opus", "aac", "flac", "wav", "pcm"],
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
    super({ apiKey: config.auth.apiKey, ...config });
    this.client = new OpenAI2__default.default({
      apiKey: config.auth.apiKey,
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
    if (error instanceof OpenAI2__default.default.APIError) {
      const status = error.status;
      const message = error.message || "Unknown OpenAI API error";
      if (status === 401) {
        throw new ProviderAuthError("openai", "Invalid API key");
      }
      if (status === 429) {
        throw new ProviderRateLimitError("openai");
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
    super({ apiKey: config.auth.apiKey, ...config });
    this.client = new OpenAI2__default.default({
      apiKey: config.auth.apiKey,
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
      return fs11__namespace.createReadStream(audio);
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
    const extResponse = response;
    const result = {
      text: response.text,
      language: extResponse.language,
      durationSeconds: extResponse.duration
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
    if (error instanceof OpenAI2__default.default.APIError) {
      const status = error.status;
      const message = error.message || "Unknown OpenAI API error";
      if (status === 401) {
        throw new ProviderAuthError("openai", "Invalid API key");
      }
      if (status === 429) {
        throw new ProviderRateLimitError("openai");
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
var GoogleTTSProvider = class extends BaseMediaProvider {
  name = "google-tts";
  vendor = "google";
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
    this.client = new genai.GoogleGenAI({
      apiKey: config.apiKey
    });
  }
  /**
   * Synthesize speech from text using Gemini TTS
   */
  async synthesize(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("tts.synthesize", {
            model: options.model,
            voice: options.voice,
            inputLength: options.input.length
          });
          const result = await this.client.models.generateContent({
            model: options.model,
            contents: [
              {
                parts: [{ text: options.input }]
              }
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: options.voice || "Kore"
                  }
                }
              }
            }
          });
          const audioData = this.extractAudioData(result);
          if (!audioData) {
            throw new ProviderError("google", "No audio data in response");
          }
          this.logOperationComplete("tts.synthesize", {
            model: options.model,
            audioSize: audioData.length
          });
          return {
            audio: audioData,
            format: "wav",
            // Gemini outputs PCM 24kHz 16-bit, we convert to WAV
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
   * List available voices (returns static list for Google)
   */
  async listVoices() {
    return GEMINI_VOICES;
  }
  /**
   * Extract audio data from Gemini response
   * Gemini returns raw PCM data (24kHz, 16-bit, mono), we wrap it in WAV format
   */
  extractAudioData(result) {
    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      return null;
    }
    const content = candidates[0]?.content;
    if (!content?.parts || content.parts.length === 0) {
      return null;
    }
    for (const part of content.parts) {
      if (part.inlineData?.data) {
        const rawPcm = Buffer.from(part.inlineData.data, "base64");
        return this.pcmToWav(rawPcm, 24e3, 1, 16);
      }
    }
    return null;
  }
  /**
   * Convert raw PCM data to WAV format
   * @param pcmData - Raw PCM data buffer
   * @param sampleRate - Sample rate in Hz (default 24000 for Gemini)
   * @param channels - Number of channels (default 1 for mono)
   * @param bitsPerSample - Bits per sample (default 16)
   */
  pcmToWav(pcmData, sampleRate = 24e3, channels = 1, bitsPerSample = 16) {
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;
    const dataSize = pcmData.length;
    const headerSize = 44;
    const fileSize = headerSize + dataSize;
    const header = Buffer.alloc(headerSize);
    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize - 8, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);
    return Buffer.concat([header, pcmData]);
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
      throw new ProviderError("google", `Bad request: ${message}`);
    }
    throw new ProviderError("google", message);
  }
};

// src/core/createAudioProvider.ts
function createTTSProvider(connector) {
  const vendor = connector.vendor;
  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAITTSProvider(extractOpenAIConfig(connector));
    case Vendor.Google:
      return new GoogleTTSProvider(extractGoogleConfig(connector));
    default:
      throw new Error(
        `No TTS provider available for vendor: ${vendor}. Supported vendors: ${Vendor.OpenAI}, ${Vendor.Google}`
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
function extractGoogleConfig(connector) {
  const auth = connector.config.auth;
  if (auth.type !== "api_key") {
    throw new Error("Google requires API key authentication");
  }
  return {
    apiKey: auth.apiKey
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
    /** Gemini 2.5 Flash TTS (optimized for low latency) */
    GEMINI_2_5_FLASH_TTS: "gemini-2.5-flash-preview-tts",
    /** Gemini 2.5 Pro TTS (optimized for quality) */
    GEMINI_2_5_PRO_TTS: "gemini-2.5-pro-preview-tts"
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
  "gemini-2.5-flash-preview-tts": {
    name: "gemini-2.5-flash-preview-tts",
    displayName: "Gemini 2.5 Flash TTS",
    provider: Vendor.Google,
    description: "Google Gemini 2.5 Flash TTS - optimized for low latency",
    isActive: true,
    releaseDate: "2025-01-01",
    sources: {
      documentation: "https://ai.google.dev/gemini-api/docs/speech-generation",
      pricing: "https://ai.google.dev/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      voices: GEMINI_VOICES,
      formats: ["wav"],
      // PCM output, 24kHz 16-bit mono
      languages: [...GEMINI_TTS_LANGUAGES],
      speed: { supported: false },
      // Speed not directly configurable
      features: {
        streaming: false,
        // Not implementing streaming in v1
        ssml: false,
        emotions: true,
        // Supports affective dialogue
        voiceCloning: false,
        wordTimestamps: false
      },
      limits: { maxInputLength: 32e3 }
      // 32k tokens
    }
  },
  "gemini-2.5-pro-preview-tts": {
    name: "gemini-2.5-pro-preview-tts",
    displayName: "Gemini 2.5 Pro TTS",
    provider: Vendor.Google,
    description: "Google Gemini 2.5 Pro TTS - optimized for quality",
    isActive: true,
    releaseDate: "2025-01-01",
    sources: {
      documentation: "https://ai.google.dev/gemini-api/docs/speech-generation",
      pricing: "https://ai.google.dev/pricing",
      lastVerified: "2026-01-25"
    },
    capabilities: {
      voices: GEMINI_VOICES,
      formats: ["wav"],
      // PCM output, 24kHz 16-bit mono
      languages: [...GEMINI_TTS_LANGUAGES],
      speed: { supported: false },
      // Speed not directly configurable
      features: {
        streaming: false,
        // Not implementing streaming in v1
        ssml: false,
        emotions: true,
        // Supports affective dialogue
        voiceCloning: false,
        wordTimestamps: false
      },
      limits: { maxInputLength: 32e3 }
      // 32k tokens
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
    const connector = typeof config.connector === "string" ? exports.Connector.get(config.connector) : config.connector;
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
    await fs10__namespace.writeFile(filePath, response.audio);
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

// src/core/SpeechToText.ts
init_Connector();

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
    const connector = typeof config.connector === "string" ? exports.Connector.get(config.connector) : config.connector;
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
    const audio = await fs10__namespace.readFile(filePath);
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
    this.client = new OpenAI2__default.default({
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
      return new File([image], "image.png", { type: "image/png" });
    }
    return fs11__namespace.createReadStream(image);
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
      const fs12 = await import('fs');
      const buffer = fs12.readFileSync(image);
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

// src/core/createImageProvider.ts
function createImageProvider(connector) {
  const vendor = connector.vendor;
  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAIImageProvider(extractOpenAIConfig2(connector));
    case Vendor.Google:
      return new GoogleImageProvider(extractGoogleConfig2(connector));
    default:
      throw new Error(
        `No Image provider available for vendor: ${vendor}. Supported vendors: ${Vendor.OpenAI}, ${Vendor.Google}`
      );
  }
}
function extractOpenAIConfig2(connector) {
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
function extractGoogleConfig2(connector) {
  const auth = connector.config.auth;
  if (auth.type !== "api_key") {
    throw new Error("Google requires API key authentication");
  }
  return {
    apiKey: auth.apiKey
  };
}

// src/core/ErrorHandler.ts
init_Logger();
init_Metrics();
var DEFAULT_RETRYABLE_PATTERNS = [
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "rate limit",
  "Rate limit",
  "429",
  "500",
  "502",
  "503",
  "504",
  "timeout",
  "Timeout"
];
var ErrorHandler = class extends eventemitter3.EventEmitter {
  config;
  logger;
  constructor(config = {}) {
    super();
    const isProduction = process.env.NODE_ENV === "production";
    this.config = {
      logErrors: config.logErrors ?? true,
      includeStackTrace: config.includeStackTrace ?? !isProduction,
      transformError: config.transformError ?? ((e) => e),
      retryablePatterns: config.retryablePatterns ?? DEFAULT_RETRYABLE_PATTERNS,
      maxRetries: config.maxRetries ?? 3,
      baseRetryDelayMs: config.baseRetryDelayMs ?? 100,
      maxRetryDelayMs: config.maxRetryDelayMs ?? 5e3
    };
    this.logger = exports.logger.child({ component: "ErrorHandler" });
  }
  /**
   * Handle an error with context.
   * Logs the error, emits events, and records metrics.
   *
   * @param error - The error to handle
   * @param context - Context information about where/how the error occurred
   */
  handle(error, context) {
    const transformed = this.config.transformError(error, context);
    const recoverable = this.isRecoverable(transformed);
    if (this.config.logErrors) {
      this.logError(transformed, context, recoverable);
    }
    this.recordMetrics(transformed, context, recoverable);
    this.emit("error", { error: transformed, context, recoverable });
    if (!recoverable) {
      this.emit("error:fatal", { error: transformed, context });
    }
  }
  /**
   * Execute a function with automatic retry on retryable errors.
   *
   * @param fn - The function to execute
   * @param context - Context for error handling
   * @returns The result of the function
   * @throws The last error if all retries are exhausted
   */
  async executeWithRetry(fn, context) {
    let lastError;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.config.maxRetries;
        const shouldRetry = !isLastAttempt && this.isRetryable(lastError);
        if (!shouldRetry) {
          this.handle(lastError, context);
          throw lastError;
        }
        const delay = this.calculateRetryDelay(attempt);
        this.emit("error:retrying", {
          error: lastError,
          context,
          attempt,
          delayMs: delay
        });
        if (this.config.logErrors) {
          this.logger.warn(
            {
              error: lastError.message,
              attempt,
              maxAttempts: this.config.maxRetries,
              delayMs: delay,
              ...this.contextToLogFields(context)
            },
            `Retrying after error (attempt ${attempt}/${this.config.maxRetries})`
          );
        }
        await this.delay(delay);
      }
    }
    throw lastError;
  }
  /**
   * Wrap a function with error handling (no retry).
   * Useful for wrapping methods that already have their own retry logic.
   *
   * @param fn - The function to wrap
   * @param contextFactory - Factory to create context from function arguments
   * @returns A wrapped function with error handling
   */
  wrap(fn, contextFactory) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, contextFactory(...args));
        throw error;
      }
    };
  }
  /**
   * Check if an error is recoverable (can be retried or handled gracefully).
   */
  isRecoverable(error) {
    if (this.isRetryable(error)) {
      return true;
    }
    const recoverableTypes = [
      "RateLimitError",
      "TimeoutError",
      "NetworkError",
      "ConnectionError"
    ];
    return recoverableTypes.some(
      (type) => error.name === type || error.constructor.name === type
    );
  }
  /**
   * Check if an error should be retried.
   */
  isRetryable(error) {
    const errorString = `${error.name} ${error.message}`;
    return this.config.retryablePatterns.some(
      (pattern) => errorString.includes(pattern)
    );
  }
  /**
   * Add a retryable pattern.
   */
  addRetryablePattern(pattern) {
    if (!this.config.retryablePatterns.includes(pattern)) {
      this.config.retryablePatterns.push(pattern);
    }
  }
  /**
   * Remove a retryable pattern.
   */
  removeRetryablePattern(pattern) {
    const index = this.config.retryablePatterns.indexOf(pattern);
    if (index !== -1) {
      this.config.retryablePatterns.splice(index, 1);
    }
  }
  /**
   * Get current configuration (read-only).
   */
  getConfig() {
    return { ...this.config };
  }
  // ===== Private Helpers =====
  logError(error, context, recoverable) {
    const level = recoverable ? "warn" : "error";
    const logData = {
      error: error.message,
      errorName: error.name,
      recoverable,
      ...this.contextToLogFields(context)
    };
    if (this.config.includeStackTrace && error.stack) {
      logData.stack = error.stack;
    }
    this.logger[level](logData, `Error in ${context.operation}`);
  }
  contextToLogFields(context) {
    return {
      agentType: context.agentType,
      agentId: context.agentId,
      operation: context.operation,
      ...context.metadata || {}
    };
  }
  recordMetrics(error, context, recoverable) {
    exports.metrics.increment("error.handled", 1, {
      agentType: context.agentType,
      operation: context.operation,
      errorType: error.name,
      recoverable: String(recoverable)
    });
  }
  calculateRetryDelay(attempt) {
    const exponentialDelay = this.config.baseRetryDelayMs * Math.pow(2, attempt - 1);
    const jitter = exponentialDelay * (0.8 + Math.random() * 0.4);
    return Math.min(jitter, this.config.maxRetryDelayMs);
  }
  delay(ms) {
    return new Promise((resolve3) => setTimeout(resolve3, ms));
  }
};
var globalErrorHandler = new ErrorHandler();

// src/capabilities/images/ImageGeneration.ts
init_Connector();

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
      maxImagesPerRequest: 1,
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
        background: {
          type: "string",
          description: "Background setting: transparent, opaque, or auto"
        },
        output_format: {
          type: "string",
          description: "Output format: png, webp, or jpeg"
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
        style: {
          type: "string",
          description: "Style: vivid (hyper-real) or natural (more natural)"
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
      limits: { maxPromptLength: 1e3 }
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
        negativePrompt: {
          type: "string",
          description: "Description of what to avoid in the image"
        },
        seed: {
          type: "number",
          description: "Random seed for reproducible generation"
        },
        aspectRatio: {
          type: "string",
          description: "Aspect ratio: 1:1, 3:4, 4:3, 9:16, or 16:9"
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
      limits: { maxPromptLength: 480 }
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
      limits: { maxPromptLength: 480 }
    },
    pricing: {
      perImage: 0.02,
      currency: "USD"
    }
  }
};
var helpers3 = createRegistryHelpers(IMAGE_MODEL_REGISTRY);
var getImageModelInfo = helpers3.getInfo;
var getImageModelsByVendor = helpers3.getByVendor;
var getActiveImageModels = helpers3.getActive;
function getImageModelsWithFeature(feature) {
  return Object.values(IMAGE_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}
function calculateImageCost(modelName, imageCount, quality = "standard") {
  const model = getImageModelInfo(modelName);
  if (!model?.pricing) return null;
  if (model.pricing.perImage) {
    return imageCount * model.pricing.perImage;
  }
  const pricePerImage = quality === "hd" ? model.pricing.perImageHD : model.pricing.perImageStandard;
  if (!pricePerImage) return null;
  return imageCount * pricePerImage;
}

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
    const connector = typeof options.connector === "string" ? exports.Connector.get(options.connector) : options.connector;
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
      default:
        throw new Error(`No edit model for vendor: ${vendor}`);
    }
  }
};

// src/capabilities/video/VideoGeneration.ts
init_Connector();
var OpenAISoraProvider = class extends BaseMediaProvider {
  name = "openai-video";
  vendor = "openai";
  capabilities = {
    text: false,
    images: false,
    videos: true,
    audio: false,
    features: {
      videoGeneration: true,
      imageToVideo: true,
      videoExtension: true
    }
  };
  client;
  constructor(config) {
    super({ apiKey: config.auth.apiKey, ...config });
    this.client = new OpenAI2__default.default({
      apiKey: config.auth.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      timeout: config.timeout,
      maxRetries: config.maxRetries
    });
  }
  /**
   * Generate a video from a text prompt
   */
  async generateVideo(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.generate", {
            model: options.model,
            duration: options.duration,
            resolution: options.resolution
          });
          const model = options.model || "sora-2";
          const seconds = this.durationToSeconds(options.duration || 4);
          const params = {
            prompt: options.prompt,
            model,
            seconds
          };
          if (options.resolution) {
            params.size = this.resolutionToSize(options.resolution);
          } else if (options.aspectRatio) {
            params.size = this.aspectRatioToSize(options.aspectRatio);
          }
          if (options.image) {
            params.input_reference = await this.prepareImageInput(options.image);
          }
          const response = await this.client.videos.create(params);
          this.logOperationComplete("video.generate", {
            model,
            jobId: response.id,
            status: response.status
          });
          return this.mapResponse(response);
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "video.generate",
      { model: options.model }
    );
  }
  /**
   * Get the status of a video generation job
   */
  async getVideoStatus(jobId) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.status", { jobId });
          const response = await this.client.videos.retrieve(jobId);
          this.logOperationComplete("video.status", {
            jobId,
            status: response.status,
            progress: response.progress
          });
          return this.mapResponse(response);
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "video.status",
      { jobId }
    );
  }
  /**
   * Download a completed video
   */
  async downloadVideo(jobId) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.download", { jobId });
          const statusResponse = await this.getVideoStatus(jobId);
          if (statusResponse.status !== "completed") {
            throw new ProviderError("openai", `Video not ready. Status: ${statusResponse.status}`);
          }
          const response = await this.client.videos.downloadContent(jobId, { variant: "video" });
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          this.logOperationComplete("video.download", {
            jobId,
            size: buffer.length
          });
          return buffer;
        } catch (error) {
          if (error instanceof ProviderError) throw error;
          this.handleError(error);
          throw error;
        }
      },
      "video.download",
      { jobId }
    );
  }
  /**
   * Extend/remix an existing video
   * Note: OpenAI SDK uses 'remix' instead of 'extend'
   */
  async extendVideo(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.extend", {
            model: options.model,
            extendDuration: options.extendDuration,
            direction: options.direction
          });
          let videoId;
          if (typeof options.video === "string" && !options.video.startsWith("http")) {
            videoId = options.video;
          } else {
            throw new ProviderError(
              "openai",
              "Video extension requires a video ID. Upload the video first or provide the job ID."
            );
          }
          const prompt = options.prompt || "Extend this video seamlessly";
          const response = await this.client.videos.remix(videoId, { prompt });
          this.logOperationComplete("video.extend", {
            jobId: response.id,
            status: response.status
          });
          return this.mapResponse(response);
        } catch (error) {
          if (error instanceof ProviderError) throw error;
          this.handleError(error);
          throw error;
        }
      },
      "video.extend",
      { model: options.model }
    );
  }
  /**
   * List available video models
   */
  async listModels() {
    return ["sora-2", "sora-2-pro"];
  }
  /**
   * Cancel/delete a pending job
   */
  async cancelJob(jobId) {
    try {
      const response = await this.client.videos.delete(jobId);
      return response.deleted;
    } catch {
      return false;
    }
  }
  /**
   * Map OpenAI SDK Video response to our VideoResponse format
   */
  mapResponse(response) {
    const result = {
      jobId: response.id,
      status: this.mapStatus(response.status),
      created: response.created_at,
      progress: response.progress
    };
    if (response.status === "completed") {
      result.video = {
        duration: this.secondsStringToNumber(response.seconds),
        resolution: response.size,
        format: "mp4"
      };
    }
    if (response.status === "failed" && response.error) {
      result.error = response.error.message || "Video generation failed";
    }
    return result;
  }
  /**
   * Map OpenAI status to our status type
   */
  mapStatus(status) {
    switch (status) {
      case "queued":
      case "pending":
        return "pending";
      case "in_progress":
      case "processing":
        return "processing";
      case "completed":
      case "succeeded":
        return "completed";
      case "failed":
      case "cancelled":
        return "failed";
      default:
        return "pending";
    }
  }
  /**
   * Convert duration number to SDK's seconds string format
   */
  durationToSeconds(duration) {
    if (duration <= 4) return "4";
    if (duration <= 8) return "8";
    return "12";
  }
  /**
   * Convert seconds string back to number
   */
  secondsStringToNumber(seconds) {
    return parseInt(seconds, 10) || 4;
  }
  /**
   * Map resolution string to SDK's size format
   */
  resolutionToSize(resolution) {
    const validSizes = ["720x1280", "1280x720", "1024x1792", "1792x1024"];
    if (validSizes.includes(resolution)) {
      return resolution;
    }
    return "720x1280";
  }
  /**
   * Map aspect ratio to SDK's size format
   */
  aspectRatioToSize(aspectRatio) {
    const map = {
      "16:9": "1280x720",
      "9:16": "720x1280",
      "9:16-tall": "1024x1792",
      "16:9-tall": "1792x1024"
    };
    return map[aspectRatio] || "720x1280";
  }
  /**
   * Prepare image input for API (input_reference)
   */
  async prepareImageInput(image) {
    if (Buffer.isBuffer(image)) {
      return new File([image], "input.png", { type: "image/png" });
    }
    if (!image.startsWith("http")) {
      const fs12 = await import('fs');
      const data = fs12.readFileSync(image);
      return new File([data], "input.png", { type: "image/png" });
    }
    const response = await fetch(image);
    const arrayBuffer = await response.arrayBuffer();
    return new File([new Uint8Array(arrayBuffer)], "input.png", { type: "image/png" });
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
      if (message.includes("safety") || message.includes("policy")) {
        throw new ProviderError("openai", `Content policy violation: ${message}`);
      }
      throw new ProviderError("openai", `Bad request: ${message}`);
    }
    throw new ProviderError("openai", message);
  }
};
var GoogleVeoProvider = class extends BaseMediaProvider {
  name = "google-video";
  vendor = "google";
  capabilities = {
    text: false,
    images: false,
    videos: true,
    audio: false,
    features: {
      videoGeneration: true,
      imageToVideo: true,
      videoExtension: true
    }
  };
  client;
  pendingOperations = /* @__PURE__ */ new Map();
  constructor(config) {
    super({ apiKey: config.auth.apiKey, ...config });
    this.client = new genai.GoogleGenAI({
      apiKey: config.auth.apiKey
    });
  }
  /**
   * Generate a video from a text prompt
   */
  async generateVideo(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.generate", {
            model: options.model,
            duration: options.duration,
            resolution: options.resolution
          });
          const model = options.model || "veo-3.1-generate-preview";
          const googleOptions = options.vendorOptions || {};
          const config = {};
          if (options.aspectRatio) {
            config.aspectRatio = options.aspectRatio;
          }
          if (options.resolution) {
            config.resolution = options.resolution;
          }
          if (options.duration) {
            config.durationSeconds = options.duration;
          }
          if (options.seed !== void 0) {
            config.seed = options.seed;
          }
          if (googleOptions.negativePrompt) {
            config.negativePrompt = googleOptions.negativePrompt;
          }
          if (googleOptions.personGeneration) {
            config.personGeneration = googleOptions.personGeneration;
          }
          if (googleOptions.safetyFilterLevel) {
            config.safetyFilterLevel = googleOptions.safetyFilterLevel;
          }
          const request = {
            model,
            prompt: options.prompt,
            config
          };
          if (options.image) {
            request.image = await this.prepareImageInput(options.image);
          }
          if (googleOptions.lastFrame) {
            request.lastFrame = await this.prepareImageInput(googleOptions.lastFrame);
          }
          const operation = await this.client.models.generateVideos(request);
          const jobId = this.extractJobId(operation);
          this.pendingOperations.set(jobId, operation);
          this.logOperationComplete("video.generate", {
            model,
            jobId,
            status: "pending"
          });
          return {
            jobId,
            status: "pending",
            created: Math.floor(Date.now() / 1e3)
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "video.generate",
      { model: options.model }
    );
  }
  /**
   * Get the status of a video generation job
   */
  async getVideoStatus(jobId) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.status", { jobId });
          let operation = this.pendingOperations.get(jobId);
          if (!operation) {
            try {
              operation = await this.client.operations.getVideosOperation({
                operation: { name: jobId }
              });
            } catch {
              throw new ProviderError("google", `Video job not found: ${jobId}`);
            }
          }
          operation = await this.client.operations.getVideosOperation({
            operation
          });
          this.pendingOperations.set(jobId, operation);
          const response = this.mapResponse(jobId, operation);
          this.logOperationComplete("video.status", {
            jobId,
            status: response.status
          });
          if (response.status === "completed" || response.status === "failed") {
            this.pendingOperations.delete(jobId);
          }
          return response;
        } catch (error) {
          if (error instanceof ProviderError) throw error;
          this.handleError(error);
          throw error;
        }
      },
      "video.status",
      { jobId }
    );
  }
  /**
   * Download a completed video
   */
  async downloadVideo(jobId) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.download", { jobId });
          const status = await this.getVideoStatus(jobId);
          if (status.status !== "completed") {
            throw new ProviderError("google", `Video not ready. Status: ${status.status}`);
          }
          const operation = this.pendingOperations.get(jobId);
          if (!operation?.response?.generatedVideos?.[0]?.video) {
            throw new ProviderError("google", "No video available for download");
          }
          const videoFile = operation.response.generatedVideos[0].video;
          const downloadResponse = await this.client.files.download({
            file: videoFile
          });
          let buffer;
          if (downloadResponse instanceof Buffer) {
            buffer = downloadResponse;
          } else if (downloadResponse.data) {
            buffer = Buffer.from(downloadResponse.data);
          } else {
            throw new ProviderError("google", "Unexpected download response format");
          }
          this.logOperationComplete("video.download", {
            jobId,
            size: buffer.length
          });
          return buffer;
        } catch (error) {
          if (error instanceof ProviderError) throw error;
          this.handleError(error);
          throw error;
        }
      },
      "video.download",
      { jobId }
    );
  }
  /**
   * Extend an existing video (Veo 3.1 supports this)
   */
  async extendVideo(options) {
    return this.executeWithCircuitBreaker(
      async () => {
        try {
          this.logOperationStart("video.extend", {
            model: options.model,
            extendDuration: options.extendDuration
          });
          const model = options.model || "veo-3.1-generate-preview";
          const request = {
            model,
            prompt: options.prompt || "Continue the video seamlessly",
            config: {
              durationSeconds: String(options.extendDuration)
            }
          };
          if (Buffer.isBuffer(options.video)) {
            request.image = {
              imageBytes: options.video.toString("base64")
            };
          } else {
            request.video = { uri: options.video };
          }
          const operation = await this.client.models.generateVideos(request);
          const jobId = this.extractJobId(operation);
          this.pendingOperations.set(jobId, operation);
          this.logOperationComplete("video.extend", {
            jobId,
            status: "pending"
          });
          return {
            jobId,
            status: "pending",
            created: Math.floor(Date.now() / 1e3)
          };
        } catch (error) {
          this.handleError(error);
          throw error;
        }
      },
      "video.extend",
      { model: options.model }
    );
  }
  /**
   * List available video models
   */
  async listModels() {
    return [
      "veo-2.0-generate-001",
      "veo-3-generate-preview",
      "veo-3.1-fast-generate-preview",
      "veo-3.1-generate-preview"
    ];
  }
  /**
   * Wait for video completion with polling
   */
  async waitForCompletion(jobId, timeoutMs = 6e5) {
    const startTime = Date.now();
    const pollInterval = 1e4;
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getVideoStatus(jobId);
      if (status.status === "completed" || status.status === "failed") {
        return status;
      }
      await new Promise((resolve3) => setTimeout(resolve3, pollInterval));
    }
    throw new ProviderError("google", `Video generation timed out after ${timeoutMs}ms`);
  }
  /**
   * Extract job ID from operation
   */
  extractJobId(operation) {
    if (operation.name) {
      return operation.name;
    }
    return `veo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Prepare image input for API
   */
  async prepareImageInput(image) {
    if (Buffer.isBuffer(image)) {
      return {
        imageBytes: image.toString("base64")
      };
    }
    if (image.startsWith("http://") || image.startsWith("https://")) {
      return { imageUri: image };
    }
    const fs12 = await import('fs/promises');
    const data = await fs12.readFile(image);
    return {
      imageBytes: data.toString("base64")
    };
  }
  /**
   * Map operation to VideoResponse
   */
  mapResponse(jobId, operation) {
    const result = {
      jobId,
      status: this.mapStatus(operation),
      created: Math.floor(Date.now() / 1e3)
    };
    if (operation.done && operation.response?.generatedVideos?.[0]) {
      const video = operation.response.generatedVideos[0];
      result.video = {
        duration: video.video?.duration,
        format: "mp4"
      };
      if (video.video?.uri) {
        result.video.url = video.video.uri;
      }
    }
    if (operation.error) {
      result.error = operation.error.message || "Video generation failed";
      result.status = "failed";
    }
    return result;
  }
  /**
   * Map operation status to our status type
   */
  mapStatus(operation) {
    if (operation.error) {
      return "failed";
    }
    if (operation.done) {
      return "completed";
    }
    if (operation.metadata?.state === "ACTIVE" || operation.metadata?.state === "PROCESSING") {
      return "processing";
    }
    return "pending";
  }
  /**
   * Handle Google API errors
   */
  handleError(error) {
    const message = error.message || "Unknown Google API error";
    const status = error.status || error.code;
    if (status === 401 || status === 403 || message.includes("API key")) {
      throw new ProviderAuthError("google", "Invalid API key");
    }
    if (status === 429 || message.includes("quota") || message.includes("rate")) {
      throw new ProviderRateLimitError("google", message);
    }
    if (status === 400) {
      if (message.includes("safety") || message.includes("blocked")) {
        throw new ProviderError("google", `Content policy violation: ${message}`);
      }
      throw new ProviderError("google", `Bad request: ${message}`);
    }
    throw new ProviderError("google", message);
  }
};

// src/core/createVideoProvider.ts
function createVideoProvider(connector) {
  const vendor = connector.vendor;
  switch (vendor) {
    case Vendor.OpenAI:
      return new OpenAISoraProvider(extractOpenAIConfig3(connector));
    case Vendor.Google:
      return new GoogleVeoProvider(extractGoogleConfig3(connector));
    default:
      throw new Error(
        `Video generation not supported for vendor: ${vendor}. Supported vendors: ${Vendor.OpenAI}, ${Vendor.Google}`
      );
  }
}
function extractOpenAIConfig3(connector) {
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
function extractGoogleConfig3(connector) {
  const auth = connector.config.auth;
  if (auth.type !== "api_key") {
    throw new Error("Google requires API key authentication");
  }
  const options = connector.getOptions();
  return {
    auth: {
      type: "api_key",
      apiKey: auth.apiKey
    },
    timeout: options.timeout,
    maxRetries: options.maxRetries
  };
}

// src/domain/entities/VideoModel.ts
var VIDEO_MODELS = {
  [Vendor.OpenAI]: {
    SORA_2: "sora-2",
    SORA_2_PRO: "sora-2-pro"
  },
  [Vendor.Google]: {
    // Gemini API (ai.google.dev) model names - use with API key
    VEO_2: "veo-2.0-generate-001",
    VEO_3: "veo-3-generate-preview",
    VEO_3_FAST: "veo-3.1-fast-generate-preview",
    VEO_3_1: "veo-3.1-generate-preview"
  }
};
var OPENAI_SOURCES = {
  documentation: "https://platform.openai.com/docs/guides/video-generation",
  apiReference: "https://platform.openai.com/docs/api-reference/videos",
  lastVerified: "2026-01-25"
};
var GOOGLE_SOURCES = {
  documentation: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/overview",
  apiReference: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation",
  lastVerified: "2026-01-25"
};
var VIDEO_MODEL_REGISTRY = {
  // ============================================================================
  // OpenAI Sora Models
  // ============================================================================
  "sora-2": {
    name: "sora-2",
    displayName: "Sora 2",
    provider: Vendor.OpenAI,
    isActive: true,
    sources: OPENAI_SOURCES,
    capabilities: {
      durations: [4, 8, 12],
      resolutions: ["720x1280", "1280x720", "1024x1792", "1792x1024"],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: false,
      features: {
        upscaling: false,
        styleControl: false,
        negativePrompt: false,
        seed: true
      }
    },
    pricing: {
      perSecond: 0.15,
      currency: "USD"
    }
  },
  "sora-2-pro": {
    name: "sora-2-pro",
    displayName: "Sora 2 Pro",
    provider: Vendor.OpenAI,
    isActive: true,
    sources: OPENAI_SOURCES,
    capabilities: {
      durations: [4, 8, 12],
      resolutions: ["720x1280", "1280x720", "1024x1792", "1792x1024", "1920x1080", "1080x1920"],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: true,
      features: {
        upscaling: true,
        styleControl: true,
        negativePrompt: false,
        seed: true
      }
    },
    pricing: {
      perSecond: 0.4,
      currency: "USD"
    }
  },
  // ============================================================================
  // Google Veo Models
  // ============================================================================
  "veo-2.0-generate-001": {
    name: "veo-2.0-generate-001",
    displayName: "Veo 2.0",
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [5, 6, 7, 8],
      resolutions: ["768x1408", "1408x768", "1024x1024"],
      maxFps: 24,
      audio: false,
      imageToVideo: true,
      videoExtension: false,
      frameControl: true,
      features: {
        upscaling: false,
        styleControl: false,
        negativePrompt: true,
        seed: true
      }
    },
    pricing: {
      perSecond: 0.03,
      currency: "USD"
    }
  },
  "veo-3-generate-preview": {
    name: "veo-3-generate-preview",
    displayName: "Veo 3.0",
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [4, 6, 8],
      resolutions: ["720p", "1080p", "768x1408", "1408x768"],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: true,
      features: {
        upscaling: true,
        styleControl: true,
        negativePrompt: true,
        seed: true
      }
    },
    pricing: {
      perSecond: 0.75,
      currency: "USD"
    }
  },
  "veo-3.1-fast-generate-preview": {
    name: "veo-3.1-fast-generate-preview",
    displayName: "Veo 3.1 Fast",
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [4, 6, 8],
      resolutions: ["720p", "768x1408", "1408x768"],
      maxFps: 24,
      audio: true,
      imageToVideo: true,
      videoExtension: false,
      frameControl: false,
      features: {
        upscaling: false,
        styleControl: false,
        negativePrompt: true,
        seed: true
      }
    },
    pricing: {
      perSecond: 0.75,
      currency: "USD"
    }
  },
  "veo-3.1-generate-preview": {
    name: "veo-3.1-generate-preview",
    displayName: "Veo 3.1",
    provider: Vendor.Google,
    isActive: true,
    sources: GOOGLE_SOURCES,
    capabilities: {
      durations: [4, 6, 8],
      resolutions: ["720p", "1080p", "4k", "768x1408", "1408x768"],
      maxFps: 30,
      audio: true,
      imageToVideo: true,
      videoExtension: true,
      frameControl: true,
      features: {
        upscaling: true,
        styleControl: true,
        negativePrompt: true,
        seed: true
      }
    },
    pricing: {
      perSecond: 0.75,
      currency: "USD"
    }
  }
};
var helpers4 = createRegistryHelpers(VIDEO_MODEL_REGISTRY);
var getVideoModelInfo = helpers4.getInfo;
var getVideoModelsByVendor = helpers4.getByVendor;
var getActiveVideoModels = helpers4.getActive;
function getVideoModelsWithFeature(feature) {
  return Object.values(VIDEO_MODEL_REGISTRY).filter(
    (model) => model.isActive && model.capabilities.features[feature]
  );
}
function getVideoModelsWithAudio() {
  return Object.values(VIDEO_MODEL_REGISTRY).filter((model) => model.isActive && model.capabilities.audio);
}
function calculateVideoCost(modelName, durationSeconds) {
  const model = VIDEO_MODEL_REGISTRY[modelName];
  if (!model || !model.pricing) {
    return null;
  }
  return model.pricing.perSecond * durationSeconds;
}

// src/capabilities/video/VideoGeneration.ts
var VideoGeneration = class _VideoGeneration {
  provider;
  connector;
  defaultModel;
  constructor(connector) {
    this.connector = connector;
    this.provider = createVideoProvider(connector);
    this.defaultModel = this.getDefaultModel();
  }
  /**
   * Create a VideoGeneration instance
   */
  static create(options) {
    const connector = typeof options.connector === "string" ? exports.Connector.get(options.connector) : options.connector;
    if (!connector) {
      throw new Error(`Connector not found: ${options.connector}`);
    }
    return new _VideoGeneration(connector);
  }
  /**
   * Generate a video from a text prompt
   * Returns a job that can be polled for completion
   */
  async generate(options) {
    const fullOptions = {
      model: options.model || this.defaultModel,
      prompt: options.prompt,
      duration: options.duration,
      resolution: options.resolution,
      aspectRatio: options.aspectRatio,
      image: options.image,
      seed: options.seed,
      vendorOptions: options.vendorOptions
    };
    return this.provider.generateVideo(fullOptions);
  }
  /**
   * Get the status of a video generation job
   */
  async getStatus(jobId) {
    return this.provider.getVideoStatus(jobId);
  }
  /**
   * Wait for a video generation job to complete
   */
  async waitForCompletion(jobId, timeoutMs = 6e5) {
    const startTime = Date.now();
    const pollInterval = 1e4;
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.provider.getVideoStatus(jobId);
      if (status.status === "completed") {
        return status;
      }
      if (status.status === "failed") {
        throw new ProviderError(
          this.connector.vendor || "unknown",
          `Video generation failed: ${status.error || "Unknown error"}`
        );
      }
      await new Promise((resolve3) => setTimeout(resolve3, pollInterval));
    }
    throw new ProviderError(
      this.connector.vendor || "unknown",
      `Video generation timed out after ${timeoutMs}ms`
    );
  }
  /**
   * Download a completed video
   */
  async download(jobId) {
    if (!this.provider.downloadVideo) {
      throw new Error(`Video download not supported by ${this.provider.name}`);
    }
    return this.provider.downloadVideo(jobId);
  }
  /**
   * Generate and wait for completion in one call
   */
  async generateAndWait(options, timeoutMs = 6e5) {
    const job = await this.generate(options);
    return this.waitForCompletion(job.jobId, timeoutMs);
  }
  /**
   * Extend an existing video
   * Note: Not all models/vendors support this
   */
  async extend(options) {
    if (!this.provider.extendVideo) {
      throw new Error(`Video extension not supported by ${this.provider.name}`);
    }
    const fullOptions = {
      ...options,
      model: options.model || this.getExtendModel()
    };
    return this.provider.extendVideo(fullOptions);
  }
  /**
   * Cancel a pending video generation job
   */
  async cancel(jobId) {
    if (!this.provider.cancelJob) {
      throw new Error(`Job cancellation not supported by ${this.provider.name}`);
    }
    return this.provider.cancelJob(jobId);
  }
  /**
   * List available models for this provider
   */
  async listModels() {
    if (this.provider.listModels) {
      return this.provider.listModels();
    }
    const vendor = this.connector.vendor;
    if (vendor && VIDEO_MODELS[vendor]) {
      return Object.values(VIDEO_MODELS[vendor]);
    }
    return [];
  }
  /**
   * Get information about a specific model
   */
  getModelInfo(modelName) {
    return getVideoModelInfo(modelName);
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
        return VIDEO_MODELS[Vendor.OpenAI].SORA_2;
      case Vendor.Google:
        return VIDEO_MODELS[Vendor.Google].VEO_3;
      default:
        throw new Error(`No default video model for vendor: ${vendor}`);
    }
  }
  /**
   * Get the model that supports video extension
   */
  getExtendModel() {
    const vendor = this.connector.vendor;
    switch (vendor) {
      case Vendor.OpenAI:
        return VIDEO_MODELS[Vendor.OpenAI].SORA_2;
      case Vendor.Google:
        return VIDEO_MODELS[Vendor.Google].VEO_3_1;
      default:
        throw new Error(`No extend model for vendor: ${vendor}`);
    }
  }
};

// src/capabilities/search/SearchProvider.ts
init_Connector();

// src/capabilities/shared/types.ts
function buildQueryString(params) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
}
function toConnectorOptions(options) {
  const { body, queryParams, ...rest } = options;
  const connectorOptions = {
    ...rest
  };
  if (body) {
    connectorOptions.body = JSON.stringify(body);
    connectorOptions.headers = {
      "Content-Type": "application/json",
      ...rest.headers
    };
  }
  return connectorOptions;
}
function buildEndpointWithQuery(endpoint, queryParams) {
  if (!queryParams || Object.keys(queryParams).length === 0) {
    return endpoint;
  }
  const queryString = buildQueryString(queryParams);
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}${queryString}`;
}
function resolveConnector(connectorOrName) {
  const { Connector: ConnectorClass } = (init_Connector(), __toCommonJS(Connector_exports));
  if (typeof connectorOrName === "string") {
    return ConnectorClass.get(connectorOrName);
  }
  return connectorOrName;
}

// src/capabilities/search/providers/SerperProvider.ts
var SerperProvider = class {
  constructor(connector) {
    this.connector = connector;
  }
  name = "serper";
  async search(query, options = {}) {
    const numResults = Math.min(options.numResults || 10, 100);
    try {
      const fetchOptions = toConnectorOptions({
        method: "POST",
        body: {
          q: query,
          num: numResults,
          ...options.country && { gl: options.country },
          ...options.language && { hl: options.language },
          ...options.vendorOptions
        }
      });
      const response = await this.connector.fetchJSON("/search", fetchOptions);
      if (!response.organic || !Array.isArray(response.organic)) {
        throw new Error("Invalid response from Serper API");
      }
      const results = response.organic.slice(0, numResults).map((result, index) => ({
        title: result.title || "Untitled",
        url: result.link || "",
        snippet: result.snippet || "",
        position: index + 1
      }));
      return {
        success: true,
        query,
        provider: this.name,
        results,
        count: results.length
      };
    } catch (error) {
      return {
        success: false,
        query,
        provider: this.name,
        results: [],
        count: 0,
        error: error.message || "Unknown error"
      };
    }
  }
};

// src/capabilities/search/providers/BraveProvider.ts
var BraveProvider = class {
  constructor(connector) {
    this.connector = connector;
  }
  name = "brave";
  async search(query, options = {}) {
    const numResults = Math.min(options.numResults || 10, 20);
    try {
      const queryParams = {
        q: query,
        count: numResults,
        ...options.country && { country: options.country },
        ...options.language && { search_lang: options.language },
        ...options.vendorOptions
      };
      const queryString = buildQueryString(queryParams);
      const response = await this.connector.fetchJSON(`/web/search?${queryString}`, {
        method: "GET"
      });
      if (!response.web?.results || !Array.isArray(response.web.results)) {
        throw new Error("Invalid response from Brave API");
      }
      const results = response.web.results.slice(0, numResults).map((result, index) => ({
        title: result.title || "Untitled",
        url: result.url || "",
        snippet: result.description || "",
        position: index + 1
      }));
      return {
        success: true,
        query,
        provider: this.name,
        results,
        count: results.length
      };
    } catch (error) {
      return {
        success: false,
        query,
        provider: this.name,
        results: [],
        count: 0,
        error: error.message || "Unknown error"
      };
    }
  }
};

// src/capabilities/search/providers/TavilyProvider.ts
var TavilyProvider = class {
  constructor(connector) {
    this.connector = connector;
  }
  name = "tavily";
  async search(query, options = {}) {
    const numResults = Math.min(options.numResults || 10, 20);
    try {
      const auth = this.connector.config.auth;
      const apiKey = auth.type === "api_key" ? auth.apiKey : "";
      const fetchOptions = toConnectorOptions({
        method: "POST",
        body: {
          api_key: apiKey,
          query,
          max_results: numResults,
          search_depth: options.vendorOptions?.search_depth || "basic",
          include_answer: options.vendorOptions?.include_answer || false,
          include_raw_content: options.vendorOptions?.include_raw_content || false,
          ...options.vendorOptions
        }
      });
      const response = await this.connector.fetchJSON("/search", fetchOptions);
      if (!response.results || !Array.isArray(response.results)) {
        throw new Error("Invalid response from Tavily API");
      }
      const results = response.results.slice(0, numResults).map((result, index) => ({
        title: result.title || "Untitled",
        url: result.url || "",
        snippet: result.content || "",
        position: index + 1
      }));
      return {
        success: true,
        query,
        provider: this.name,
        results,
        count: results.length
      };
    } catch (error) {
      return {
        success: false,
        query,
        provider: this.name,
        results: [],
        count: 0,
        error: error.message || "Unknown error"
      };
    }
  }
};

// src/capabilities/search/providers/RapidAPIProvider.ts
init_Logger();
var rapidapiLogger = exports.logger.child({ component: "RapidAPIProvider" });
var RapidAPIProvider = class {
  constructor(connector) {
    this.connector = connector;
  }
  name = "rapidapi";
  async search(query, options = {}) {
    const numResults = Math.min(options.numResults || 10, 100);
    rapidapiLogger.debug({ query, numResults, options }, "RapidAPI search started");
    try {
      const queryParams = {
        q: query,
        num: numResults,
        start: 0,
        fetch_ai_overviews: false,
        deduplicate: false,
        return_organic_result_video_thumbnail: false,
        nfpr: 0,
        ...options.country && { gl: options.country },
        ...options.language && { hl: options.language },
        ...options.vendorOptions
      };
      const baseURL = this.connector.baseURL;
      const host = baseURL ? new URL(baseURL).host : "real-time-web-search.p.rapidapi.com";
      rapidapiLogger.debug({ baseURL, host }, "Using RapidAPI host");
      let apiKey = "";
      try {
        apiKey = this.connector.getApiKey();
        rapidapiLogger.debug({ hasApiKey: !!apiKey, keyLength: apiKey?.length }, "Got API key");
      } catch (e) {
        rapidapiLogger.error({ error: e.message }, "Failed to get API key");
        throw new Error("RapidAPI provider requires API key authentication");
      }
      const queryString = buildQueryString(queryParams);
      const requestUrl = `/search?${queryString}`;
      rapidapiLogger.debug({ requestUrl, method: "GET" }, "Making RapidAPI request");
      const response = await this.connector.fetchJSON(requestUrl, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": host
        }
      });
      rapidapiLogger.debug({
        hasResponse: !!response,
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : [],
        hasOrganicResults: !!(response?.data?.organic_results || response?.data?.organic),
        organicResultsCount: (response?.data?.organic_results || response?.data?.organic || []).length
      }, "RapidAPI response received");
      const organicResults = response.data?.organic_results || response.data?.organic || response.organic_results || response.organic || [];
      if (!Array.isArray(organicResults)) {
        rapidapiLogger.error({
          responseType: typeof organicResults,
          response: JSON.stringify(response).slice(0, 500)
        }, "Invalid response format - organic is not an array");
        throw new Error("Invalid response from RapidAPI Search");
      }
      const results = organicResults.slice(0, numResults).map((result, index) => ({
        title: result.title || "Untitled",
        url: result.link || result.url || "",
        snippet: result.snippet || result.description || "",
        position: index + 1
      }));
      rapidapiLogger.debug({
        success: true,
        resultCount: results.length,
        firstTitle: results[0]?.title
      }, "RapidAPI search completed successfully");
      return {
        success: true,
        query,
        provider: this.name,
        results,
        count: results.length
      };
    } catch (error) {
      rapidapiLogger.error({
        error: error.message,
        stack: error.stack
      }, "RapidAPI search failed");
      return {
        success: false,
        query,
        provider: this.name,
        results: [],
        count: 0,
        error: error.message || "Unknown error"
      };
    }
  }
};

// src/capabilities/search/SearchProvider.ts
var SearchProvider = class {
  /**
   * Create a search provider from a connector
   * @param config - Provider configuration
   * @returns Search provider instance
   */
  static create(config) {
    const connector = typeof config.connector === "string" ? exports.Connector.get(config.connector) : config.connector;
    if (!connector) {
      throw new Error(
        `Connector not found: ${typeof config.connector === "string" ? config.connector : "unknown"}`
      );
    }
    const serviceType = connector.serviceType;
    switch (serviceType) {
      case "serper":
        return new SerperProvider(connector);
      case "brave-search":
        return new BraveProvider(connector);
      case "tavily":
        return new TavilyProvider(connector);
      case "rapidapi-search":
        return new RapidAPIProvider(connector);
      default:
        throw new Error(
          `Unknown search service type: ${serviceType}. Supported: serper, brave-search, tavily, rapidapi-search`
        );
    }
  }
};

// src/capabilities/scrape/ScrapeProvider.ts
var providerRegistry = /* @__PURE__ */ new Map();
function registerScrapeProvider(serviceType, providerClass) {
  providerRegistry.set(serviceType, providerClass);
}
function getRegisteredScrapeProviders() {
  return Array.from(providerRegistry.keys());
}
var ScrapeProvider = class _ScrapeProvider {
  /**
   * Create a scrape provider from a connector
   *
   * @param config - Provider configuration
   * @returns Scrape provider instance
   * @throws Error if connector not found or service type not supported
   *
   * @example
   * ```typescript
   * const scraper = ScrapeProvider.create({ connector: 'jina-main' });
   * const result = await scraper.scrape('https://example.com');
   * ```
   */
  static create(config) {
    const connector = resolveConnector(config.connector);
    const serviceType = connector.serviceType;
    if (!serviceType) {
      throw new Error(
        `Connector '${connector.name}' has no serviceType. Set serviceType when creating the connector.`
      );
    }
    const ProviderClass = providerRegistry.get(serviceType);
    if (!ProviderClass) {
      const registered = getRegisteredScrapeProviders();
      throw new Error(
        `No scrape provider registered for service type '${serviceType}'. Registered providers: ${registered.length > 0 ? registered.join(", ") : "none"}. Make sure to import the provider module.`
      );
    }
    return new ProviderClass(connector);
  }
  /**
   * Check if a service type has a registered provider
   */
  static hasProvider(serviceType) {
    return providerRegistry.has(serviceType);
  }
  /**
   * List all registered provider service types
   */
  static listProviders() {
    return getRegisteredScrapeProviders();
  }
  /**
   * Create a scrape provider with fallback chain
   *
   * Returns a provider that will try each connector in order until one succeeds.
   *
   * @param config - Fallback configuration
   * @returns Scrape provider with fallback support
   *
   * @example
   * ```typescript
   * const scraper = ScrapeProvider.createWithFallback({
   *   primary: 'jina-main',
   *   fallbacks: ['firecrawl-backup', 'scrapingbee'],
   * });
   * // Will try jina first, then firecrawl, then scrapingbee
   * const result = await scraper.scrape('https://example.com');
   * ```
   */
  static createWithFallback(config) {
    const providers = [];
    providers.push(_ScrapeProvider.create({ connector: config.primary }));
    if (config.fallbacks) {
      for (const fallback of config.fallbacks) {
        try {
          providers.push(_ScrapeProvider.create({ connector: fallback }));
        } catch {
        }
      }
    }
    return new FallbackScrapeProvider(providers);
  }
};
var FallbackScrapeProvider = class {
  constructor(providers) {
    this.providers = providers;
    if (providers.length === 0) {
      throw new Error("At least one provider required for fallback chain");
    }
    this.connector = providers[0].connector;
  }
  name = "fallback";
  connector;
  async scrape(url, options) {
    let lastError;
    const attemptedProviders = [];
    for (const provider of this.providers) {
      attemptedProviders.push(provider.name);
      try {
        const result = await provider.scrape(url, options);
        if (result.success) {
          return {
            ...result,
            provider: `fallback(${provider.name})`
          };
        }
        lastError = result.error;
      } catch (error) {
        lastError = error.message;
      }
    }
    return {
      success: false,
      url,
      provider: "fallback",
      error: `All providers failed. Tried: ${attemptedProviders.join(" -> ")}. Last error: ${lastError}`
    };
  }
  supportsFeature(feature) {
    return this.providers.some((p) => p.supportsFeature?.(feature));
  }
};

// src/capabilities/scrape/providers/ZenRowsProvider.ts
var ZenRowsProvider = class {
  constructor(connector) {
    this.connector = connector;
  }
  name = "zenrows";
  /**
   * Scrape a URL using ZenRows API
   *
   * By default, enables JS rendering and premium proxies for guaranteed results.
   */
  async scrape(url, options = {}) {
    const startTime = Date.now();
    try {
      const apiKey = this.getApiKey();
      const zenrowsOpts = options.vendorOptions;
      const queryParams = {
        url,
        apikey: apiKey,
        // Default to JS rendering and premium proxy for guaranteed results
        js_render: zenrowsOpts?.jsRender ?? true,
        premium_proxy: zenrowsOpts?.premiumProxy ?? true
      };
      if (options.waitForSelector || zenrowsOpts?.waitFor) {
        queryParams.wait_for = options.waitForSelector || zenrowsOpts?.waitFor || "";
      }
      if (zenrowsOpts?.wait) {
        queryParams.wait = zenrowsOpts.wait;
      }
      if (options.includeMarkdown || zenrowsOpts?.outputFormat === "markdown") {
        queryParams.response_type = "markdown";
      }
      if (options.includeScreenshot || zenrowsOpts?.screenshot) {
        queryParams.screenshot = true;
        if (zenrowsOpts?.screenshotFullpage) {
          queryParams.screenshot_fullpage = true;
        }
      }
      if (zenrowsOpts?.autoparse) {
        queryParams.autoparse = true;
      }
      if (zenrowsOpts?.cssExtractor) {
        queryParams.css_extractor = zenrowsOpts.cssExtractor;
      }
      if (zenrowsOpts?.blockResources) {
        queryParams.block_resources = zenrowsOpts.blockResources;
      }
      if (zenrowsOpts?.sessionId) {
        queryParams.session_id = zenrowsOpts.sessionId;
      }
      if (zenrowsOpts?.device) {
        queryParams.device = zenrowsOpts.device;
      }
      if (zenrowsOpts?.originalStatus) {
        queryParams.original_status = true;
      }
      if (zenrowsOpts?.proxyCountry) {
        queryParams.proxy_country = zenrowsOpts.proxyCountry;
      }
      if (zenrowsOpts?.jsInstructions) {
        queryParams.js_instructions = zenrowsOpts.jsInstructions;
      }
      if (options.headers && zenrowsOpts?.customHeaders !== false) {
        queryParams.custom_headers = true;
      }
      const endpoint = `/?${buildQueryString(queryParams)}`;
      const response = await this.connector.fetch(endpoint, {
        method: "GET",
        headers: options.headers,
        timeout: options.timeout || 6e4
        // ZenRows can take longer with JS rendering
      });
      const headers = Object.fromEntries(response.headers.entries());
      const finalUrl = headers["zr-final-url"] || url;
      const statusCode = parseInt(headers["zr-status"] || "200", 10);
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          url,
          provider: this.name,
          error: `ZenRows API error (${response.status}): ${errorText}`,
          statusCode: response.status,
          durationMs: Date.now() - startTime
        };
      }
      const contentType = headers["content-type"] || "";
      const isMarkdown = queryParams.response_type === "markdown";
      const isScreenshot = queryParams.screenshot;
      let result;
      if (isScreenshot && !isMarkdown) {
        const base64 = await response.text();
        result = {
          title: "",
          content: "",
          screenshot: base64
        };
      } else {
        const content = await response.text();
        let title = "";
        if (!isMarkdown && contentType.includes("text/html")) {
          const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
          title = titleMatch?.[1]?.trim() ?? "";
        } else if (isMarkdown) {
          const headingMatch = content.match(/^#\s+(.+)$/m);
          title = headingMatch?.[1]?.trim() ?? "";
        }
        result = {
          title,
          content: isMarkdown ? content : this.extractText(content),
          html: options.includeHtml && !isMarkdown ? content : void 0,
          markdown: isMarkdown ? content : void 0
        };
        if (options.includeLinks && !isMarkdown) {
          result.links = this.extractLinks(content, finalUrl);
        }
        if (!isMarkdown) {
          result.metadata = this.extractMetadata(content);
        }
      }
      return {
        success: true,
        url,
        finalUrl,
        provider: this.name,
        result,
        statusCode,
        durationMs: Date.now() - startTime,
        requiredJS: queryParams.js_render === true
      };
    } catch (error) {
      return {
        success: false,
        url,
        provider: this.name,
        error: error.message || "Unknown error",
        durationMs: Date.now() - startTime
      };
    }
  }
  /**
   * Check if this provider supports a feature
   */
  supportsFeature(feature) {
    const supported = [
      "javascript",
      "markdown",
      "screenshot",
      "links",
      "metadata",
      "proxy",
      "stealth",
      "dynamic"
    ];
    return supported.includes(feature);
  }
  /**
   * Get API key from connector
   */
  getApiKey() {
    return this.connector.getApiKey();
  }
  /**
   * Extract text content from HTML
   */
  extractText(html) {
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }
  /**
   * Extract links from HTML
   */
  extractLinks(html, baseUrl) {
    const links = [];
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const href = match[1];
        const text = match[2]?.trim() ?? "";
        if (!href) continue;
        const absoluteUrl = new URL(href, baseUrl).href;
        if (!absoluteUrl.startsWith("javascript:") && !absoluteUrl.startsWith("mailto:")) {
          links.push({ url: absoluteUrl, text: text || absoluteUrl });
        }
      } catch {
      }
    }
    return links;
  }
  /**
   * Extract metadata from HTML
   */
  extractMetadata(html) {
    const metadata = {};
    const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["']/gi;
    let match;
    while ((match = metaRegex.exec(html)) !== null) {
      const name = match[1]?.toLowerCase();
      const content = match[2];
      if (!name || !content) continue;
      if (name === "description" || name === "og:description") {
        metadata.description = metadata.description || content;
      } else if (name === "author") {
        metadata.author = content;
      } else if (name === "og:site_name") {
        metadata.siteName = content;
      } else if (name === "og:image") {
        metadata.ogImage = content;
      } else if (name === "article:published_time") {
        metadata.publishedDate = content;
      }
    }
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
    if (faviconMatch) {
      metadata.favicon = faviconMatch[1];
    }
    return Object.keys(metadata).length > 0 ? metadata : void 0;
  }
};
registerScrapeProvider("zenrows", ZenRowsProvider);

// src/capabilities/taskAgent/TaskAgent.ts
init_Connector();

// src/domain/entities/Task.ts
var TERMINAL_TASK_STATUSES = ["completed", "failed", "skipped", "cancelled"];
function isTerminalStatus(status) {
  return TERMINAL_TASK_STATUSES.includes(status);
}
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
    validation: input.validation,
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
  if (!input.skipCycleCheck) {
    const cycle = detectDependencyCycle(tasks);
    if (cycle) {
      const cycleNames = cycle.map((taskId) => {
        const task = tasks.find((t) => t.id === taskId);
        return task ? task.name : taskId;
      });
      throw new DependencyCycleError(cycleNames, id);
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
function isTaskBlocked(task, allTasks) {
  if (task.dependsOn.length === 0) {
    return false;
  }
  for (const depId of task.dependsOn) {
    const depTask = allTasks.find((t) => t.id === depId);
    if (!depTask) {
      return true;
    }
    if (depTask.status !== "completed") {
      return true;
    }
  }
  return false;
}
function getTaskDependencies(task, allTasks) {
  if (task.dependsOn.length === 0) {
    return [];
  }
  return task.dependsOn.map((depId) => allTasks.find((t) => t.id === depId)).filter((t) => t !== void 0);
}
function resolveDependencies(taskInputs, tasks) {
  const nameToId = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    nameToId.set(task.name, task.id);
  }
  for (const input of taskInputs) {
    if (input.dependsOn && input.dependsOn.length > 0) {
      input.dependsOn = input.dependsOn.map((dep) => {
        if (dep.startsWith("task-")) {
          return dep;
        }
        const resolvedId = nameToId.get(dep);
        if (!resolvedId) {
          throw new Error(`Task dependency "${dep}" not found`);
        }
        return resolvedId;
      });
    }
  }
}
function detectDependencyCycle(tasks) {
  const visited = /* @__PURE__ */ new Set();
  const recStack = /* @__PURE__ */ new Set();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  function dfs(taskId, path5) {
    if (recStack.has(taskId)) {
      const cycleStart = path5.indexOf(taskId);
      return [...path5.slice(cycleStart), taskId];
    }
    if (visited.has(taskId)) {
      return null;
    }
    visited.add(taskId);
    recStack.add(taskId);
    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependsOn) {
        const cycle = dfs(depId, [...path5, taskId]);
        if (cycle) {
          return cycle;
        }
      }
    }
    recStack.delete(taskId);
    return null;
  }
  for (const task of tasks) {
    if (!visited.has(task.id)) {
      const cycle = dfs(task.id, []);
      if (cycle) {
        return cycle;
      }
    }
  }
  return null;
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

// src/core/context/plugins/IContextPlugin.ts
var BaseContextPlugin = class {
  // Default implementations - override as needed
  async compact(_targetTokens, _estimator) {
    return 0;
  }
  async onPrepared(_budget) {
  }
  destroy() {
  }
  getState() {
    return void 0;
  }
  restoreState(_state) {
  }
};

// src/core/context/plugins/PlanPlugin.ts
var PlanPlugin = class extends BaseContextPlugin {
  name = "plan";
  priority = 1;
  // Very low = keep (critical)
  compactable = false;
  // Never compact the plan
  plan = null;
  /**
   * Set the current plan
   */
  setPlan(plan) {
    this.plan = plan;
  }
  /**
   * Get the current plan
   */
  getPlan() {
    return this.plan;
  }
  /**
   * Clear the plan
   */
  clearPlan() {
    this.plan = null;
  }
  /**
   * Update a task's status within the plan
   */
  updateTaskStatus(taskId, status) {
    if (!this.plan) return;
    const task = this.plan.tasks.find((t) => t.id === taskId || t.name === taskId);
    if (task) {
      task.status = status;
    }
  }
  /**
   * Get a task by ID or name
   */
  getTask(taskId) {
    if (!this.plan) return void 0;
    return this.plan.tasks.find((t) => t.id === taskId || t.name === taskId);
  }
  /**
   * Check if all tasks are completed
   */
  isComplete() {
    if (!this.plan) return true;
    return this.plan.tasks.every((t) => t.status === "completed" || t.status === "skipped");
  }
  /**
   * Get component for context
   */
  async getComponent() {
    if (!this.plan) return null;
    return {
      name: this.name,
      content: this.formatPlan(this.plan),
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        taskCount: this.plan.tasks.length,
        completedCount: this.plan.tasks.filter((t) => t.status === "completed").length,
        goal: this.plan.goal
      }
    };
  }
  /**
   * Format plan for LLM context
   */
  formatPlan(plan) {
    const lines = [
      "## Current Plan",
      "",
      `**Goal**: ${plan.goal}`,
      "",
      "**Tasks**:"
    ];
    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      if (!task) continue;
      const status = task.status || "pending";
      const statusEmoji = this.getStatusEmoji(status);
      const deps = task.dependsOn && task.dependsOn.length > 0 ? ` (depends on: ${task.dependsOn.join(", ")})` : "";
      lines.push(`${i + 1}. ${statusEmoji} [${status}] **${task.name}**: ${task.description}${deps}`);
      if (task.validation?.completionCriteria) {
        lines.push(`   - Completion: ${task.validation.completionCriteria}`);
      }
    }
    return lines.join("\n");
  }
  /**
   * Get emoji for task status
   */
  getStatusEmoji(status) {
    switch (status) {
      case "completed":
        return "[x]";
      case "in_progress":
        return "[~]";
      case "failed":
        return "[!]";
      case "skipped":
        return "[-]";
      case "blocked":
        return "[#]";
      case "pending":
      default:
        return "[ ]";
    }
  }
  // Session persistence
  getState() {
    return { plan: this.plan };
  }
  restoreState(state) {
    const s = state;
    if (s?.plan) {
      this.plan = s.plan;
    }
  }
};

// src/core/context/plugins/MemoryPlugin.ts
var MemoryPlugin = class extends BaseContextPlugin {
  name = "memory_index";
  priority = 8;
  // Higher = more likely to compact
  compactable = true;
  memory;
  evictBatchSize;
  /**
   * Create a memory plugin
   *
   * @param memory - The WorkingMemory instance to wrap
   * @param evictBatchSize - How many entries to evict per compaction round (default: 3)
   */
  constructor(memory, evictBatchSize = 3) {
    super();
    this.memory = memory;
    this.evictBatchSize = evictBatchSize;
  }
  /**
   * Get the underlying WorkingMemory
   */
  getMemory() {
    return this.memory;
  }
  /**
   * Get component for context
   */
  async getComponent() {
    const index = await this.memory.formatIndex();
    if (!index || index.trim().length === 0 || index.includes("Memory is empty.")) {
      return null;
    }
    const stats = await this.memory.getStats();
    return {
      name: this.name,
      content: index,
      priority: this.priority,
      compactable: this.compactable,
      metadata: {
        entryCount: stats.totalEntries,
        totalSizeBytes: stats.totalSizeBytes,
        utilizationPercent: stats.utilizationPercent
      }
    };
  }
  /**
   * Compact by evicting least-important entries
   */
  async compact(_targetTokens, estimator) {
    const beforeIndex = await this.memory.formatIndex();
    const beforeTokens = estimator.estimateTokens(beforeIndex);
    const evictedKeys = await this.memory.evict(this.evictBatchSize, "lru");
    if (evictedKeys.length === 0) {
      return 0;
    }
    const afterIndex = await this.memory.formatIndex();
    const afterTokens = estimator.estimateTokens(afterIndex);
    return Math.max(0, beforeTokens - afterTokens);
  }
  /**
   * Clean up
   */
  destroy() {
  }
  // Memory state is managed by WorkingMemory, not this plugin
  getState() {
    return {};
  }
  restoreState(_state) {
  }
};

// src/capabilities/taskAgent/ExternalDependencyHandler.ts
init_BackoffStrategy();
var ExternalDependencyHandler = class extends eventemitter3.EventEmitter {
  activePolls = /* @__PURE__ */ new Map();
  activeScheduled = /* @__PURE__ */ new Map();
  cancelledPolls = /* @__PURE__ */ new Set();
  // Track cancelled polls
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
    this.cancelledPolls.add(task.id);
    const pollTimer = this.activePolls.get(task.id);
    if (pollTimer) {
      clearTimeout(pollTimer);
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
   * Start polling for a task with exponential backoff
   */
  startPolling(task) {
    const dep = task.externalDependency;
    const pollConfig = dep.pollConfig;
    const backoffConfig = {
      strategy: "exponential",
      initialDelayMs: pollConfig.intervalMs,
      maxDelayMs: pollConfig.intervalMs * 4,
      // Cap at 4x initial interval
      jitter: true,
      jitterFactor: 0.1
      // ±10% jitter to prevent thundering herd
    };
    this.cancelledPolls.delete(task.id);
    (async () => {
      let attempts = 0;
      while (attempts < pollConfig.maxAttempts) {
        if (this.cancelledPolls.has(task.id)) {
          this.cancelledPolls.delete(task.id);
          return;
        }
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
            return;
          }
        } catch (error) {
          console.error(`Poll error for task ${task.id}:`, error);
        }
        if (attempts >= pollConfig.maxAttempts) {
          this.emit("poll:timeout", { taskId: task.id });
          return;
        }
        const delay = calculateBackoff(attempts, backoffConfig);
        await new Promise((resolve3) => {
          const timer = setTimeout(resolve3, delay);
          this.activePolls.set(task.id, timer);
        });
        if (this.cancelledPolls.has(task.id)) {
          this.cancelledPolls.delete(task.id);
          return;
        }
      }
    })();
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
    for (const taskId of this.activePolls.keys()) {
      this.cancelledPolls.add(taskId);
    }
    for (const timer of this.activePolls.values()) {
      clearTimeout(timer);
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

// src/infrastructure/resilience/index.ts
init_CircuitBreaker();
init_CircuitBreaker();
init_BackoffStrategy();
init_BackoffStrategy();

// src/infrastructure/resilience/RateLimiter.ts
var RateLimitError = class _RateLimitError extends AIError {
  constructor(retryAfterMs, message) {
    super(message ?? `Rate limited. Retry after ${retryAfterMs}ms`, "RATE_LIMIT_ERROR", 429);
    this.retryAfterMs = retryAfterMs;
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, _RateLimitError.prototype);
  }
};
var DEFAULT_RATE_LIMITER_CONFIG = {
  maxRequests: 60,
  windowMs: 6e4,
  onLimit: "wait",
  maxWaitMs: 6e4
};
var TokenBucketRateLimiter = class {
  tokens;
  lastRefill;
  config;
  waitQueue = [];
  // Metrics
  totalRequests = 0;
  throttledRequests = 0;
  totalWaitMs = 0;
  constructor(config = {}) {
    this.config = {
      maxRequests: config.maxRequests ?? DEFAULT_RATE_LIMITER_CONFIG.maxRequests,
      windowMs: config.windowMs ?? DEFAULT_RATE_LIMITER_CONFIG.windowMs,
      onLimit: config.onLimit ?? DEFAULT_RATE_LIMITER_CONFIG.onLimit,
      maxWaitMs: config.maxWaitMs ?? DEFAULT_RATE_LIMITER_CONFIG.maxWaitMs
    };
    this.tokens = this.config.maxRequests;
    this.lastRefill = Date.now();
  }
  /**
   * Acquire a token (request permission to make an LLM call)
   * @returns Promise that resolves when token is acquired
   * @throws RateLimitError if onLimit='throw' and no tokens available
   */
  async acquire() {
    this.totalRequests++;
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    this.throttledRequests++;
    const waitTime = this.getWaitTime();
    if (this.config.onLimit === "throw") {
      throw new RateLimitError(waitTime);
    }
    if (waitTime > this.config.maxWaitMs) {
      throw new RateLimitError(
        waitTime,
        `Wait time ${waitTime}ms exceeds max ${this.config.maxWaitMs}ms`
      );
    }
    const startWait = Date.now();
    await this.waitForToken(waitTime);
    this.totalWaitMs += Date.now() - startWait;
  }
  /**
   * Try to acquire without waiting
   * @returns true if acquired, false if rate limited
   */
  tryAcquire() {
    this.totalRequests++;
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    this.throttledRequests++;
    return false;
  }
  /**
   * Get current available tokens
   */
  getAvailableTokens() {
    this.refill();
    return this.tokens;
  }
  /**
   * Get time until next token is available
   */
  getWaitTime() {
    this.refill();
    if (this.tokens > 0) return 0;
    const elapsed = Date.now() - this.lastRefill;
    return Math.max(0, this.config.windowMs - elapsed);
  }
  /**
   * Get rate limiter metrics
   */
  getMetrics() {
    return {
      totalRequests: this.totalRequests,
      throttledRequests: this.throttledRequests,
      totalWaitMs: this.totalWaitMs,
      avgWaitMs: this.throttledRequests > 0 ? this.totalWaitMs / this.throttledRequests : 0
    };
  }
  /**
   * Reset the rate limiter state
   */
  reset() {
    this.tokens = this.config.maxRequests;
    this.lastRefill = Date.now();
    for (const waiter of this.waitQueue) {
      if (waiter.timeout) {
        clearTimeout(waiter.timeout);
      }
    }
    this.waitQueue = [];
  }
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.totalRequests = 0;
    this.throttledRequests = 0;
    this.totalWaitMs = 0;
  }
  /**
   * Get the current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Refill tokens if window has expired
   */
  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.config.windowMs) {
      this.tokens = this.config.maxRequests;
      this.lastRefill = now;
      this.processWaitQueue();
    }
  }
  /**
   * Wait for a token to become available
   */
  async waitForToken(waitTime) {
    return new Promise((resolve3, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex((w) => w.timeout === timeout);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        this.refill();
        if (this.tokens > 0) {
          this.tokens--;
          resolve3();
        } else {
          reject(new RateLimitError(this.getWaitTime(), "Token still unavailable after wait"));
        }
      }, waitTime);
      this.waitQueue.push({ resolve: resolve3, reject, timeout });
    });
  }
  /**
   * Process waiting requests when tokens become available
   */
  processWaitQueue() {
    while (this.waitQueue.length > 0 && this.tokens > 0) {
      const waiter = this.waitQueue.shift();
      if (waiter) {
        if (waiter.timeout) {
          clearTimeout(waiter.timeout);
        }
        this.tokens--;
        waiter.resolve();
      }
    }
  }
};

// src/utils/jsonExtractor.ts
function extractJSON(text) {
  if (!text || typeof text !== "string") {
    return {
      success: false,
      error: "Input is empty or not a string"
    };
  }
  const trimmedText = text.trim();
  const codeBlockResult = extractFromCodeBlock(trimmedText);
  if (codeBlockResult.success) {
    return codeBlockResult;
  }
  const inlineResult = extractInlineJSON(trimmedText);
  if (inlineResult.success) {
    return inlineResult;
  }
  try {
    const data = JSON.parse(trimmedText);
    return {
      success: true,
      data,
      rawJson: trimmedText,
      method: "raw"
    };
  } catch (e) {
    return {
      success: false,
      error: `Could not extract JSON from text: ${e instanceof Error ? e.message : String(e)}`
    };
  }
}
function extractFromCodeBlock(text) {
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const content = match[1];
    if (content) {
      const trimmed = content.trim();
      try {
        const data = JSON.parse(trimmed);
        return {
          success: true,
          data,
          rawJson: trimmed,
          method: "code_block"
        };
      } catch {
        continue;
      }
    }
  }
  return { success: false };
}
function extractInlineJSON(text) {
  const objectMatch = findJSONObject(text);
  if (objectMatch) {
    try {
      const data = JSON.parse(objectMatch);
      return {
        success: true,
        data,
        rawJson: objectMatch,
        method: "inline"
      };
    } catch {
    }
  }
  const arrayMatch = findJSONArray(text);
  if (arrayMatch) {
    try {
      const data = JSON.parse(arrayMatch);
      return {
        success: true,
        data,
        rawJson: arrayMatch,
        method: "inline"
      };
    } catch {
    }
  }
  return { success: false };
}
function findJSONObject(text) {
  const startIndex = text.indexOf("{");
  if (startIndex === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}
function findJSONArray(text) {
  const startIndex = text.indexOf("[");
  if (startIndex === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}
function extractJSONField(text, field, defaultValue) {
  const result = extractJSON(text);
  if (result.success && result.data && field in result.data) {
    return result.data[field];
  }
  return defaultValue;
}
function extractNumber(text, patterns = [
  /(\d{1,3})%?\s*(?:complete|score|percent)/i,
  /(?:score|completion|rating)[:\s]+(\d{1,3})/i,
  /(\d{1,3})\s*(?:out of|\/)\s*100/i
], defaultValue = 0) {
  const jsonResult = extractJSON(text);
  if (jsonResult.success && jsonResult.data) {
    const scoreFields = ["score", "completionScore", "completion_score", "rating", "percent", "value"];
    for (const field of scoreFields) {
      if (field in jsonResult.data && typeof jsonResult.data[field] === "number") {
        return jsonResult.data[field];
      }
    }
  }
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) {
        return num;
      }
    }
  }
  return defaultValue;
}

// src/capabilities/taskAgent/PlanExecutor.ts
var DEFAULT_TASK_TIMEOUT_MS = TASK_DEFAULTS.TIMEOUT_MS;
var PlanExecutor = class extends eventemitter3.EventEmitter {
  agent;
  agentContext;
  planPlugin;
  // NOTE: IdempotencyCache is accessed via agentContext.cache (single source of truth)
  externalHandler;
  checkpointManager;
  hooks;
  config;
  abortController;
  rateLimiter;
  _isDestroyed = false;
  // Current execution metrics
  currentMetrics = {
    totalLLMCalls: 0,
    totalToolCalls: 0,
    totalTokensUsed: 0,
    totalCost: 0
  };
  // Reference to current agent state (for checkpointing)
  currentState = null;
  constructor(agent, agentContext, planPlugin, externalHandler, checkpointManager, hooks, config) {
    super();
    this.agent = agent;
    this.agentContext = agentContext;
    this.planPlugin = planPlugin;
    this.externalHandler = externalHandler;
    this.checkpointManager = checkpointManager;
    this.hooks = hooks;
    this.config = config;
    this.abortController = new AbortController();
    if (config.rateLimiter) {
      this.rateLimiter = new TokenBucketRateLimiter({
        maxRequests: config.rateLimiter.maxRequestsPerMinute ?? 60,
        windowMs: 6e4,
        // 1 minute window
        onLimit: config.rateLimiter.onLimit ?? "wait",
        maxWaitMs: config.rateLimiter.maxWaitMs ?? 6e4
      });
    }
  }
  /**
   * Get memory from AgentContext (single source of truth)
   */
  get memory() {
    return this.agentContext.memory;
  }
  /**
   * Get idempotency cache from AgentContext (single source of truth)
   */
  get idempotencyCache() {
    return this.agentContext.cache;
  }
  /**
   * Build a map of task states for memory priority calculation
   */
  buildTaskStatesMap(plan) {
    const taskStates = /* @__PURE__ */ new Map();
    for (const task of plan.tasks) {
      const status = task.status;
      if (["pending", "in_progress", "completed", "failed", "skipped", "cancelled"].includes(status)) {
        taskStates.set(task.id, status);
      } else {
        taskStates.set(task.id, "pending");
      }
    }
    return taskStates;
  }
  /**
   * Notify memory about task completion and detect stale entries
   */
  async notifyMemoryOfTaskCompletion(plan, taskId) {
    const taskStates = this.buildTaskStatesMap(plan);
    const staleEntries = await this.memory.onTaskComplete(taskId, taskStates);
    if (staleEntries.length > 0) {
      this.emit("memory:stale_entries", { entries: staleEntries, taskId });
    }
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
      await this.executeParallelTasks(plan, nextTasks);
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
   * Execute tasks in parallel with configurable failure handling
   *
   * Note on failure modes:
   * - 'fail-fast' (default): Uses Promise.all - stops batch on first rejection (current behavior)
   *   Individual task failures don't reject, they just set task.status = 'failed'
   * - 'continue': Uses Promise.allSettled - all tasks run regardless of failures
   * - 'fail-all': Uses Promise.allSettled, then throws ParallelTasksError if any failed
   *
   * @param plan - The plan being executed
   * @param tasks - Tasks to execute in parallel
   * @returns Result containing succeeded and failed tasks
   */
  async executeParallelTasks(plan, tasks) {
    const failureMode = plan.concurrency?.failureMode ?? "fail-fast";
    const succeeded = [];
    const failed = [];
    if (failureMode === "fail-fast") {
      await Promise.all(tasks.map((task) => this.executeTask(plan, task)));
      for (const task of tasks) {
        if (task.status === "completed") {
          succeeded.push(task);
        } else if (task.status === "failed") {
          const errorMsg = typeof task.result?.error === "string" ? task.result.error : "Task failed";
          failed.push({
            taskId: task.id,
            taskName: task.name,
            error: new Error(errorMsg)
          });
        }
      }
      return { succeeded, failed };
    }
    await Promise.allSettled(
      tasks.map(async (task) => {
        await this.executeTask(plan, task);
      })
    );
    for (const task of tasks) {
      if (task.status === "completed") {
        succeeded.push(task);
      } else if (task.status === "failed") {
        const errorMsg = typeof task.result?.error === "string" ? task.result.error : "Task failed";
        failed.push({
          taskId: task.id,
          taskName: task.name,
          error: new Error(errorMsg)
        });
      }
    }
    if (failureMode === "fail-all" && failed.length > 0) {
      throw new ParallelTasksError(failed);
    }
    return { succeeded, failed };
  }
  /**
   * Check if task condition is met
   * @returns true if condition is met or no condition exists
   */
  async checkCondition(task) {
    if (!task.condition) {
      return true;
    }
    return evaluateCondition(task.condition, {
      get: (key) => this.memory.retrieve(key)
    });
  }
  /**
   * Get the timeout for a task (per-task override or config default)
   */
  getTaskTimeout(task) {
    const perTaskTimeout = task.metadata?.timeoutMs;
    if (typeof perTaskTimeout === "number" && perTaskTimeout > 0) {
      return perTaskTimeout;
    }
    return this.config.taskTimeout ?? DEFAULT_TASK_TIMEOUT_MS;
  }
  /**
   * Execute a single task with timeout support
   */
  async executeTask(plan, task) {
    if (task.condition) {
      const conditionMet = await this.checkCondition(task);
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
    const timeoutMs = this.getTaskTimeout(task);
    try {
      await this.executeTaskWithTimeout(plan, task, timeoutMs);
    } catch (error) {
      if (error instanceof TaskTimeoutError) {
        this.emit("task:timeout", { task, timeoutMs });
      }
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
   * Execute task core logic with timeout
   */
  async executeTaskWithTimeout(plan, task, timeoutMs) {
    return new Promise((resolve3, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TaskTimeoutError(task.id, task.name, timeoutMs));
      }, timeoutMs);
      this.executeTaskCore(plan, task).then(() => {
        clearTimeout(timeoutId);
        resolve3();
      }).catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
  /**
   * Core task execution logic (called by executeTaskWithTimeout)
   */
  async executeTaskCore(plan, task) {
    const taskPrompt = this.buildTaskPrompt(plan, task);
    this.planPlugin.setPlan(plan);
    this.agentContext.setCurrentInput(taskPrompt);
    await this.agentContext.prepare();
    this.agentContext.addMessage("user", taskPrompt);
    this.emit("llm:call", { iteration: task.attempts });
    let messages = [{ role: "user", content: taskPrompt }];
    if (this.hooks?.beforeLLMCall) {
      messages = await this.hooks.beforeLLMCall(messages, {
        model: this.agent.model,
        temperature: 0.7
        // Default temperature
      });
    }
    const raceProtection = task.execution?.raceProtection !== false;
    if (task.condition && raceProtection) {
      const stillMet = await this.checkCondition(task);
      if (!stillMet) {
        task.status = "skipped";
        this.emit("task:skipped", { task, reason: "condition_changed" });
        return;
      }
    }
    if (this.rateLimiter) {
      await this.rateLimiter.acquire();
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
    const agentMetrics = this.agent.getMetrics();
    if (agentMetrics) {
      this.currentMetrics.totalToolCalls += agentMetrics.toolCallCount;
    }
    if (this.hooks?.afterLLMCall) {
      await this.hooks.afterLLMCall(response);
    }
    if (this.currentState) {
      await this.checkpointManager.onLLMCall(this.currentState);
    }
    this.agentContext.addMessage("assistant", response.output_text || "");
    const validationResult = await this.validateTaskCompletion(task, response.output_text || "");
    task.metadata = task.metadata || {};
    task.metadata.validationResult = validationResult;
    if (validationResult.requiresUserApproval) {
      this.emit("task:validation_uncertain", { task, validation: validationResult });
      if (task.validation?.mode === "strict") {
        return;
      }
    }
    if (!validationResult.isComplete) {
      if (task.validation?.mode === "strict") {
        this.emit("task:validation_failed", { task, validation: validationResult });
        throw new TaskValidationError(
          task.id,
          task.name,
          `Completion score ${validationResult.completionScore}% below threshold. ${validationResult.explanation}`
        );
      } else {
        this.emit("task:validation_failed", { task, validation: validationResult });
      }
    }
    const completedTask = updateTaskStatus(task, "completed");
    completedTask.result = {
      success: true,
      output: response.output_text,
      validationScore: validationResult.completionScore,
      validationExplanation: validationResult.explanation
    };
    Object.assign(task, completedTask);
    this.emit("task:complete", { task, result: response });
    await this.notifyMemoryOfTaskCompletion(plan, task.id);
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
   * Validate task completion using LLM self-reflection or custom hook
   *
   * @param task - The task to validate
   * @param output - The LLM response output
   * @returns TaskValidationResult with completion score and details
   */
  async validateTaskCompletion(task, output) {
    if (!task.validation || task.validation.skipReflection) {
      return {
        isComplete: true,
        completionScore: 100,
        explanation: "No validation configured, task marked complete",
        requiresUserApproval: false
      };
    }
    if (this.hooks?.validateTask) {
      const taskResult = { success: true, output };
      const hookResult = await this.hooks.validateTask(task, taskResult, this.memory);
      if (typeof hookResult === "boolean") {
        return {
          isComplete: hookResult,
          completionScore: hookResult ? 100 : 0,
          explanation: hookResult ? "Validated by custom hook" : "Rejected by custom hook",
          requiresUserApproval: false
        };
      } else if (typeof hookResult === "string") {
        return {
          isComplete: false,
          completionScore: 0,
          explanation: hookResult,
          requiresUserApproval: false
        };
      } else {
        return hookResult;
      }
    }
    if (task.validation.requiredMemoryKeys && task.validation.requiredMemoryKeys.length > 0) {
      const missingKeys = [];
      for (const key of task.validation.requiredMemoryKeys) {
        const value = await this.memory.retrieve(key);
        if (value === void 0) {
          missingKeys.push(key);
        }
      }
      if (missingKeys.length > 0) {
        return {
          isComplete: false,
          completionScore: 0,
          explanation: `Required memory keys not found: ${missingKeys.join(", ")}`,
          requiresUserApproval: false
        };
      }
    }
    if (!task.validation.completionCriteria || task.validation.completionCriteria.length === 0) {
      return {
        isComplete: true,
        completionScore: 100,
        explanation: "No completion criteria specified, task marked complete",
        requiresUserApproval: false
      };
    }
    const validationPrompt = this.buildValidationPrompt(task, output);
    this.emit("llm:call", { iteration: task.attempts });
    const validationResponse = await this.agent.run(validationPrompt);
    if (validationResponse.usage) {
      this.currentMetrics.totalLLMCalls++;
      this.currentMetrics.totalTokensUsed += validationResponse.usage.total_tokens || 0;
      if (this.agent.model && validationResponse.usage.input_tokens && validationResponse.usage.output_tokens) {
        const cost = calculateCost(
          this.agent.model,
          validationResponse.usage.input_tokens,
          validationResponse.usage.output_tokens
        );
        if (cost !== null) {
          this.currentMetrics.totalCost += cost;
        }
      }
    }
    const validationAgentMetrics = this.agent.getMetrics();
    if (validationAgentMetrics) {
      this.currentMetrics.totalToolCalls += validationAgentMetrics.toolCallCount;
    }
    return this.parseValidationResponse(
      task,
      validationResponse.output_text || ""
    );
  }
  /**
   * Build prompt for LLM self-reflection validation
   */
  buildValidationPrompt(task, output) {
    const criteria = task.validation?.completionCriteria || [];
    const minScore = task.validation?.minCompletionScore ?? 80;
    return `You are a task completion validator. Your job is to evaluate whether a task was completed successfully.

## Task Information
**Task Name:** ${task.name}
**Task Description:** ${task.description}
${task.expectedOutput ? `**Expected Output:** ${task.expectedOutput}` : ""}

## Completion Criteria
The task is considered complete if it meets these criteria:
${criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## Task Output
The following was the output from executing the task:
---
${output}
---

## Your Evaluation
Please evaluate the task completion and respond in the following JSON format:
\`\`\`json
{
  "completionScore": <number 0-100>,
  "isComplete": <true if score >= ${minScore}>,
  "explanation": "<brief explanation of your evaluation>",
  "criteriaResults": [
    {
      "criterion": "<criterion text>",
      "met": <true/false>,
      "evidence": "<brief evidence from output>"
    }
  ]
}
\`\`\`

Be honest and thorough in your evaluation. A score of 100 means all criteria are fully met. A score below ${minScore} means the task needs more work.`;
  }
  /**
   * Parse LLM validation response into TaskValidationResult
   */
  parseValidationResponse(task, responseText) {
    const minScore = task.validation?.minCompletionScore ?? 80;
    const requireApproval = task.validation?.requireUserApproval ?? "never";
    const extractionResult = extractJSON(responseText);
    if (extractionResult.success && extractionResult.data) {
      const parsed = extractionResult.data;
      const completionScore = typeof parsed.completionScore === "number" ? Math.max(0, Math.min(100, parsed.completionScore)) : 0;
      const isComplete = completionScore >= minScore;
      let requiresUserApproval = false;
      let approvalReason;
      if (requireApproval === "always") {
        requiresUserApproval = true;
        approvalReason = "User approval required for all task completions";
      } else if (requireApproval === "uncertain") {
        const uncertainThreshold = Math.max(minScore - 20, 50);
        if (completionScore >= uncertainThreshold && completionScore < minScore) {
          requiresUserApproval = true;
          approvalReason = `Completion score (${completionScore}%) is uncertain - below threshold but potentially acceptable`;
        }
      }
      return {
        isComplete,
        completionScore,
        explanation: parsed.explanation || "No explanation provided",
        criteriaResults: parsed.criteriaResults,
        requiresUserApproval,
        approvalReason
      };
    }
    const score = extractNumber(responseText, [
      /(\d{1,3})%?\s*(?:complete|score)/i,
      /(?:score|completion|rating)[:\s]+(\d{1,3})/i
    ], 50);
    return {
      isComplete: score >= minScore,
      completionScore: score,
      explanation: `Could not parse structured response. Estimated score: ${score}%`,
      requiresUserApproval: requireApproval === "always" || requireApproval === "uncertain",
      approvalReason: "Could not parse validation response accurately"
    };
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
   * Check if the PlanExecutor instance has been destroyed
   */
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Cleanup resources (alias for destroy, kept for backward compatibility)
   */
  cleanup() {
    this.destroy();
  }
  /**
   * Destroy the PlanExecutor instance
   * Removes all event listeners and clears internal state
   */
  destroy() {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this.abortController.abort();
    this.removeAllListeners();
  }
  /**
   * Get idempotency cache
   */
  getIdempotencyCache() {
    return this.idempotencyCache;
  }
  /**
   * Get rate limiter metrics (if rate limiting is enabled)
   */
  getRateLimiterMetrics() {
    if (!this.rateLimiter) {
      return null;
    }
    return this.rateLimiter.getMetrics();
  }
  /**
   * Reset rate limiter state (for testing or manual control)
   */
  resetRateLimiter() {
    this.rateLimiter?.reset();
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
    description: `Store data in working memory for later use. Use this to save important information from tool outputs.

TIER SYSTEM (for research/analysis tasks):
- "raw": Low priority, evicted first. Use for unprocessed data you'll summarize later.
- "summary": Normal priority. Use for processed summaries of raw data.
- "findings": High priority, kept longest. Use for final conclusions and insights.

The tier automatically sets priority and adds a key prefix (e.g., "findings.topic" for tier="findings").`,
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: 'Namespaced key (e.g., "user.profile", "search.ai_news"). If using tier, prefix is added automatically.'
        },
        description: {
          type: "string",
          description: "Brief description of what this data contains (max 150 chars)"
        },
        value: {
          description: "The data to store (can be any JSON value)"
        },
        tier: {
          type: "string",
          enum: ["raw", "summary", "findings"],
          description: 'Optional: Memory tier. "raw" (low priority, evict first), "summary" (normal), "findings" (high priority, keep longest). Automatically sets key prefix and priority.'
        },
        derivedFrom: {
          type: "array",
          items: { type: "string" },
          description: "Optional: Keys this data was derived from (for tracking data lineage, useful with tiers)"
        },
        neededForTasks: {
          type: "array",
          items: { type: "string" },
          description: "Optional: Task IDs that need this data. Data will be auto-cleaned when all tasks complete."
        },
        scope: {
          type: "string",
          enum: ["session", "plan", "persistent"],
          description: 'Optional: Lifecycle scope. "session" (default), "plan" (kept for entire plan), or "persistent" (never auto-cleaned)'
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "critical"],
          description: "Optional: Override eviction priority. Ignored if tier is set (tier determines priority)."
        },
        pinned: {
          type: "boolean",
          description: "Optional: If true, this data will never be evicted."
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
          description: 'The key to retrieve (include tier prefix if applicable, e.g., "findings.topic")'
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
      properties: {
        tier: {
          type: "string",
          enum: ["raw", "summary", "findings"],
          description: "Optional: Filter to only show entries from a specific tier"
        }
      },
      required: []
    }
  }
};
var memoryCleanupRawDefinition = {
  type: "function",
  function: {
    name: "memory_cleanup_raw",
    description: 'Clean up raw tier data after creating summaries/findings. Only deletes entries with "raw." prefix.',
    parameters: {
      type: "object",
      properties: {
        keys: {
          type: "array",
          items: { type: "string" },
          description: "Keys to delete (only raw tier entries will be deleted)"
        }
      },
      required: ["keys"]
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
          throw new ToolExecutionError("memory_store", "Memory tools require TaskAgent context");
        }
        try {
          let key = args.key;
          const tier = args.tier;
          const derivedFrom = args.derivedFrom;
          if (tier) {
            key = addTierPrefix(key, tier);
          }
          let scope;
          if (args.neededForTasks && Array.isArray(args.neededForTasks) && args.neededForTasks.length > 0) {
            scope = { type: "task", taskIds: args.neededForTasks };
          } else if (args.scope === "plan") {
            scope = { type: "plan" };
          } else if (args.scope === "persistent") {
            scope = { type: "persistent" };
          } else if (tier === "findings") {
            scope = { type: "plan" };
          } else {
            scope = "session";
          }
          let priority = args.priority;
          if (tier) {
            priority = TIER_PRIORITIES[tier];
          }
          await context.memory.set(
            key,
            args.description,
            args.value,
            {
              scope,
              priority,
              pinned: args.pinned
            }
          );
          return {
            success: true,
            key,
            tier: tier ?? getTierFromKey(key) ?? "none",
            scope: typeof scope === "string" ? scope : scope.type,
            priority: priority ?? "normal",
            derivedFrom: derivedFrom ?? []
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      },
      idempotency: { safe: true },
      output: { expectedSize: "small" },
      describeCall: (args) => {
        const tier = args.tier;
        const key = args.key;
        return tier ? `${tier}:${key}` : key;
      }
    },
    // memory_retrieve
    {
      definition: memoryRetrieveDefinition,
      execute: async (args, context) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError("memory_retrieve", "Memory tools require TaskAgent context");
        }
        const value = await context.memory.get(args.key);
        if (value === void 0) {
          return { error: `Key "${args.key}" not found in memory` };
        }
        return value;
      },
      idempotency: { safe: true },
      output: { expectedSize: "variable" },
      describeCall: (args) => args.key
    },
    // memory_delete
    {
      definition: memoryDeleteDefinition,
      execute: async (args, context) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError("memory_delete", "Memory tools require TaskAgent context");
        }
        await context.memory.delete(args.key);
        return { success: true, deleted: args.key };
      },
      idempotency: { safe: true },
      output: { expectedSize: "small" },
      describeCall: (args) => args.key
    },
    // memory_list
    {
      definition: memoryListDefinition,
      execute: async (args, context) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError("memory_list", "Memory tools require TaskAgent context");
        }
        let entries = await context.memory.list();
        const tierFilter = args.tier;
        if (tierFilter) {
          const prefix = `${tierFilter}.`;
          entries = entries.filter((e) => e.key.startsWith(prefix));
        }
        return {
          entries: entries.map((e) => ({
            key: e.key,
            description: e.description,
            priority: e.effectivePriority,
            tier: getTierFromKey(e.key) ?? "none",
            pinned: e.pinned
          })),
          count: entries.length,
          tierFilter: tierFilter ?? "all"
        };
      },
      idempotency: { safe: true },
      output: { expectedSize: "small" },
      describeCall: (args) => {
        const tier = args.tier;
        return tier ? `tier:${tier}` : "all";
      }
    },
    // memory_cleanup_raw
    {
      definition: memoryCleanupRawDefinition,
      execute: async (args, context) => {
        if (!context || !context.memory) {
          throw new ToolExecutionError("memory_cleanup_raw", "Memory tools require TaskAgent context");
        }
        const keys = args.keys;
        let deletedCount = 0;
        const skipped = [];
        for (const key of keys) {
          const tier = getTierFromKey(key);
          if (tier === "raw") {
            const exists = await context.memory.has(key);
            if (exists) {
              await context.memory.delete(key);
              deletedCount++;
            }
          } else {
            skipped.push(key);
          }
        }
        return {
          success: true,
          deleted: deletedCount,
          skipped: skipped.length > 0 ? skipped : void 0,
          skippedReason: skipped.length > 0 ? "Not raw tier entries" : void 0
        };
      },
      idempotency: { safe: true },
      output: { expectedSize: "small" },
      describeCall: (args) => `${args.keys.length} keys`
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
      const components = Object.entries(budget.breakdown).map(([name, tokens]) => ({
        name,
        tokens,
        percent: budget.used > 0 ? Math.round(tokens / budget.used * 1e3) / 10 : 0
      }));
      return {
        total_used: budget.used,
        breakdown: budget.breakdown,
        components
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
var TaskAgent = class _TaskAgent extends BaseAgent {
  id;
  state;
  agentStorage;
  // NOTE: Memory is accessed via this._agentContext.memory (single source of truth)
  // The 'memory' getter below provides convenient access
  hooks;
  executionPromise;
  // Internal components
  agent;
  // Note: _agentContext is inherited from BaseAgent (single source of truth)
  // Cache is accessed via this._agentContext.cache (single source of truth)
  _planPlugin;
  _memoryPlugin;
  externalHandler;
  planExecutor;
  checkpointManager;
  _allTools = [];
  // Event listener cleanup tracking
  eventCleanupFunctions = [];
  // ===== Static Factory =====
  /**
   * Create a new TaskAgent
   */
  static create(config) {
    const connector = typeof config.connector === "string" ? exports.Connector.get(config.connector) : config.connector;
    if (!connector) {
      throw new Error(`Connector "${config.connector}" not found`);
    }
    const agentStorage = config.storage ?? createAgentStorage({});
    const memoryConfig = config.memoryConfig ?? DEFAULT_MEMORY_CONFIG;
    const id = `task-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const emptyPlan = createPlan({ goal: "", tasks: [] });
    const agentStateConfig = {
      connectorName: typeof config.connector === "string" ? config.connector : connector.name,
      model: config.model,
      temperature: config.temperature,
      maxIterations: config.maxIterations,
      toolNames: (config.tools ?? []).map((t) => t.definition.function.name)
    };
    const state = createAgentState(id, agentStateConfig, emptyPlan);
    const taskAgentConfig = {
      ...config,
      // Pass memory config to AgentContext
      context: {
        ...typeof config.context === "object" && config.context !== null && !(config.context instanceof Object.getPrototypeOf(config.context)?.constructor) ? config.context : {},
        memory: {
          storage: agentStorage.memory,
          ...memoryConfig
        }
      }
    };
    const taskAgent = new _TaskAgent(id, state, agentStorage, taskAgentConfig, config.hooks);
    taskAgent.initializeComponents(taskAgentConfig);
    return taskAgent;
  }
  /**
   * Resume an existing agent from storage
   */
  static async resume(agentId, options) {
    const state = await options.storage.agent.load(agentId);
    if (!state) {
      throw new Error(`Agent ${agentId} not found in storage`);
    }
    const stateToolNames = new Set(state.config.toolNames ?? []);
    const currentToolNames = new Set(
      (options.tools ?? []).map((t) => t.definition.function.name)
    );
    const missing = [...stateToolNames].filter((n) => !currentToolNames.has(n));
    const added = [...currentToolNames].filter((n) => !stateToolNames.has(n));
    if (missing.length > 0) {
      console.warn(
        `[TaskAgent.resume] Warning: Missing tools from saved state: ${missing.join(", ")}. Tasks requiring these tools may fail.`
      );
    }
    if (added.length > 0) {
      console.info(
        `[TaskAgent.resume] Info: New tools not in saved state: ${added.join(", ")}`
      );
    }
    const config = {
      connector: state.config.connectorName,
      model: state.config.model,
      tools: options.tools ?? [],
      temperature: state.config.temperature,
      maxIterations: state.config.maxIterations,
      storage: options.storage,
      hooks: options.hooks,
      session: options.session,
      // Pass memory config to AgentContext (single source of truth)
      context: {
        memory: {
          storage: options.storage.memory,
          ...DEFAULT_MEMORY_CONFIG
        }
      }
    };
    const taskAgent = new _TaskAgent(agentId, state, options.storage, config, options.hooks);
    taskAgent.initializeComponents(config);
    return taskAgent;
  }
  // ===== Constructor =====
  constructor(id, state, agentStorage, config, hooks) {
    super(config, "TaskAgent");
    this.id = id;
    this.state = state;
    this.agentStorage = agentStorage;
    this.hooks = hooks;
    const memory = this._agentContext.memory;
    const storedHandler = (data) => this.emit("memory:stored", data);
    const limitWarningHandler = (data) => this.emit("memory:limit_warning", { utilization: data.utilizationPercent });
    memory.on("stored", storedHandler);
    memory.on("limit_warning", limitWarningHandler);
    this.eventCleanupFunctions.push(() => memory.off("stored", storedHandler));
    this.eventCleanupFunctions.push(() => memory.off("limit_warning", limitWarningHandler));
    this.initializeSession(config.session);
  }
  // ===== Abstract Method Implementations =====
  getAgentType() {
    return "task-agent";
  }
  prepareSessionState() {
  }
  async restoreSessionState(session) {
    if (session.plan?.data) {
      this.state.plan = session.plan.data;
    }
    this._logger.debug({ sessionId: session.id }, "TaskAgent session state restored");
  }
  getSerializedPlan() {
    if (!this.state.plan) {
      return void 0;
    }
    return {
      version: 1,
      data: this.state.plan
    };
  }
  getSerializedMemory() {
    return void 0;
  }
  // Override saveSession to handle async memory serialization
  async saveSession() {
    await this.ensureSessionLoaded();
    if (!this._sessionManager || !this._session) {
      throw new Error(
        "Session not enabled. Configure session in agent config to use this feature."
      );
    }
    this._session.toolState = this._agentContext.tools.getState();
    this._session.custom["approvalState"] = this._permissionManager.getState();
    const plan = this.getSerializedPlan();
    if (plan) {
      this._session.plan = plan;
    }
    const memoryIndex = await this._agentContext.memory.getIndex();
    this._session.memory = {
      version: 1,
      entries: memoryIndex.entries.map((e) => ({
        key: e.key,
        description: e.description,
        value: null,
        // Don't serialize full values, they're in agent storage
        scope: e.scope,
        sizeBytes: 0,
        basePriority: e.effectivePriority,
        pinned: e.pinned
      }))
    };
    this.prepareSessionState();
    await this._sessionManager.save(this._session);
    this._logger.debug({ sessionId: this._session.id }, "TaskAgent session saved");
  }
  // ===== Component Initialization =====
  /**
   * Wrap a tool with idempotency cache and enhanced context.
   * Uses inherited _agentContext from BaseAgent.
   */
  wrapToolWithCache(tool) {
    return {
      ...tool,
      execute: async (args, context) => {
        const enhancedContext = {
          ...context,
          memory: this._agentContext.memory.getAccess(),
          // Add memory access for memory tools
          agentContext: this._agentContext,
          // Inherited from BaseAgent
          idempotencyCache: this._agentContext.cache,
          agentId: this.id
        };
        if (!this._agentContext.cache) {
          return tool.execute(args, enhancedContext);
        }
        const cached = await this._agentContext.cache.get(tool, args);
        if (cached !== void 0) {
          return cached;
        }
        const result = await tool.execute(args, enhancedContext);
        await this._agentContext.cache.set(tool, args, result);
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
    this._allTools = [...config.tools ?? [], ...memoryTools, ...contextTools];
    for (const tool of [...memoryTools, ...contextTools]) {
      this._agentContext.tools.register(tool);
    }
    const enabledTools = this._agentContext.tools.getEnabled();
    const cachedTools = enabledTools.map((tool) => this.wrapToolWithCache(tool));
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: cachedTools,
      instructions: config.instructions,
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 10,
      permissions: config.permissions,
      context: this._agentContext
      // Share inherited AgentContext
    });
    const modelInfo = getModelInfo(config.model);
    const contextTokens = modelInfo?.features.input.tokens ?? CONTEXT_DEFAULTS.MAX_TOKENS;
    this._agentContext.setMaxContextTokens(contextTokens);
    if (config.instructions) {
      this._agentContext.systemPrompt = config.instructions;
    }
    this._planPlugin = new PlanPlugin();
    this._memoryPlugin = new MemoryPlugin(this._agentContext.memory);
    this._agentContext.registerPlugin(this._planPlugin);
    this._agentContext.registerPlugin(this._memoryPlugin);
    this._planPlugin.setPlan(this.state.plan);
    this.externalHandler = new ExternalDependencyHandler(this._allTools);
    this.checkpointManager = new CheckpointManager(this.agentStorage, DEFAULT_CHECKPOINT_STRATEGY);
    this.planExecutor = new PlanExecutor(
      this.agent,
      this._agentContext,
      this._planPlugin,
      this.externalHandler,
      this.checkpointManager,
      this.hooks,
      {
        maxIterations: config.maxIterations ?? 100
      }
    );
    this.setupPlanExecutorEvents();
  }
  /**
   * Setup event forwarding from PlanExecutor
   */
  setupPlanExecutorEvents() {
    if (!this.planExecutor) return;
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
    const taskValidationFailedHandler = (data) => this.emit("task:validation_failed", data);
    this.planExecutor.on("task:start", taskStartHandler);
    this.planExecutor.on("task:complete", taskCompleteHandler);
    this.planExecutor.on("task:failed", taskFailedHandler);
    this.planExecutor.on("task:skipped", taskSkippedHandler);
    this.planExecutor.on("task:waiting_external", taskWaitingExternalHandler);
    this.planExecutor.on("task:validation_failed", taskValidationFailedHandler);
    this.planExecutor.on("task:validation_uncertain", taskValidationFailedHandler);
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:start", taskStartHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:complete", taskCompleteHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:failed", taskFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:skipped", taskSkippedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:waiting_external", taskWaitingExternalHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:validation_failed", taskValidationFailedHandler));
    this.eventCleanupFunctions.push(() => this.planExecutor?.off("task:validation_uncertain", taskValidationFailedHandler));
  }
  // ===== Public API =====
  // ===== Unified Context Access =====
  // Note: `context` getter is inherited from BaseAgent (returns _agentContext)
  // The inherited getter returns the AgentContext which is always available after BaseAgent constructor
  /**
   * Check if context is available (components initialized).
   * Always true since AgentContext is created by BaseAgent constructor.
   */
  hasContext() {
    return true;
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
   * Note: Named resumeExecution to avoid conflict with BaseAgent if any
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
   * Update the plan with validation
   *
   * @param updates - The updates to apply to the plan
   * @param options - Validation options
   * @throws Error if validation fails
   */
  async updatePlan(updates, options) {
    const plan = this.state.plan;
    if (!plan) {
      throw new Error("No plan running");
    }
    if (!plan.allowDynamicTasks && (updates.addTasks || updates.removeTasks)) {
      throw new Error("Dynamic tasks are disabled for this plan");
    }
    const opts = {
      allowRemoveActiveTasks: options?.allowRemoveActiveTasks ?? false,
      validateCycles: options?.validateCycles ?? true
    };
    if (!opts.allowRemoveActiveTasks && updates.removeTasks && updates.removeTasks.length > 0) {
      const activeTasks = plan.tasks.filter(
        (t) => t.status === "in_progress" && updates.removeTasks.includes(t.id)
      );
      if (activeTasks.length > 0) {
        const names = activeTasks.map((t) => t.name).join(", ");
        throw new Error(`Cannot remove active tasks: ${names}. Set allowRemoveActiveTasks: true to override.`);
      }
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
    if (opts.validateCycles) {
      const cycle = detectDependencyCycle(plan.tasks);
      if (cycle) {
        const cycleNames = cycle.map((taskId) => {
          const task = plan.tasks.find((t) => t.id === taskId);
          return task ? task.name : taskId;
        });
        throw new DependencyCycleError(cycleNames, plan.id);
      }
    }
    plan.lastUpdatedAt = Date.now();
    this.emit("plan:updated", { plan });
  }
  // ===== State Introspection =====
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
   * Get working memory (from AgentContext - single source of truth)
   */
  getMemory() {
    return this._agentContext.memory;
  }
  /**
   * Convenient getter for working memory (alias for _agentContext.memory)
   */
  get memory() {
    return this._agentContext.memory;
  }
  // ===== Plan Execution =====
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
  // ===== Cleanup =====
  /**
   * Cleanup resources
   */
  async destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._logger.debug("TaskAgent destroy started");
    this.eventCleanupFunctions.forEach((cleanup) => cleanup());
    this.eventCleanupFunctions = [];
    this.externalHandler?.cleanup();
    await this.checkpointManager?.cleanup();
    this.planExecutor?.destroy();
    this.agent?.destroy();
    await this.runCleanupCallbacks();
    this.baseDestroy();
    this._logger.debug("TaskAgent destroyed");
  }
};

// src/capabilities/taskAgent/PlanningAgent.ts
var PLANNING_SYSTEM_PROMPT = `You are an AI planning agent. Your job is to analyze goals and break them down into structured, executable task plans.

**Your Role:**
1. Analyze the user's goal and context
2. Break down the goal into logical, atomic tasks
3. Identify dependencies between tasks
4. Define completion criteria for each task (how we know the task is done)
5. Structure tasks for optimal execution (parallel where possible)
6. Use the planning tools to create the plan

**Planning Principles:**
- Each task should have a single, clear responsibility
- Tasks should be atomic (can't be broken down further meaningfully)
- Dependencies should be explicit (use dependsOn)
- Parallel tasks should be marked as such (execution.parallel)
- Task names should be descriptive snake_case (e.g., "fetch_user_data")
- Descriptions should be clear and actionable

**Completion Criteria Guidelines:**
Each task should have clear, natural language completion criteria that describe how to verify the task is complete. These criteria should be:
- Specific and measurable (e.g., "response contains at least 5 items")
- Flexible, not rigid (avoid exact JSON schemas or exact string matches)
- Focused on outcomes, not implementation (e.g., "user data is stored in memory" not "memory_store was called")

Examples of good completion criteria:
- "The response contains weather data for the requested location"
- "At least 3 relevant search results were found"
- "The user's email address has been validated and stored"
- "The file was created with content matching the user's request"

Examples of bad completion criteria (too rigid):
- "Response matches exact JSON format {temp: number, city: string}"
- "Output contains exactly the string 'SUCCESS'"
- "Function returned status code 200"

**Available Planning Tools:**
- create_task: Add a task to the plan with completion criteria
- finalize_plan: Complete the planning phase

Always start by analyzing the goal, then create tasks one by one, building dependencies as you go.`;
var PlanningAgent = class _PlanningAgent {
  agent;
  config;
  currentTasks = [];
  planningComplete = false;
  constructor(config) {
    this.config = config;
    const planningTools = this.createBoundPlanningTools();
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: planningTools,
      instructions: PLANNING_SYSTEM_PROMPT,
      temperature: config.planningTemperature ?? 0.3,
      // Lower temp for more structured output
      maxIterations: config.maxPlanningIterations ?? 20
    });
  }
  /**
   * Create a new PlanningAgent
   */
  static create(config) {
    return new _PlanningAgent(config);
  }
  /**
   * Create planning tools bound to this PlanningAgent instance
   */
  createBoundPlanningTools() {
    return [
      {
        definition: {
          type: "function",
          function: {
            name: "create_task",
            description: "Create a new task in the plan with name, description, completion criteria, and optional dependencies",
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
                completion_criteria: {
                  type: "array",
                  items: { type: "string" },
                  description: 'Array of natural language criteria to verify task completion (e.g., "response contains weather data", "at least 3 results found")'
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
                },
                required_memory_keys: {
                  type: "array",
                  items: { type: "string" },
                  description: "Memory keys that must exist after task completion (optional)"
                },
                min_completion_score: {
                  type: "number",
                  description: "Minimum completion score (0-100) to consider task complete (default: 80)"
                }
              },
              required: ["name", "description"]
            }
          }
        },
        execute: async (args) => {
          const name = args.name;
          const description = args.description;
          const completionCriteria = args.completion_criteria;
          const dependsOn = args.depends_on;
          const parallel = args.parallel;
          const expectedOutput = args.expected_output;
          const requiredMemoryKeys = args.required_memory_keys;
          const minCompletionScore = args.min_completion_score;
          let validation;
          if (completionCriteria || requiredMemoryKeys || minCompletionScore) {
            validation = {
              completionCriteria,
              requiredMemoryKeys,
              minCompletionScore: minCompletionScore ?? 80,
              requireUserApproval: "uncertain",
              // Default: ask user in uncertain cases
              mode: "warn"
              // Default: warn but complete
            };
          }
          this.addTask({
            name,
            description,
            dependsOn,
            execution: parallel ? { parallel: true } : void 0,
            expectedOutput,
            validation
          });
          return {
            success: true,
            message: `Task '${name}' created${completionCriteria ? ` with ${completionCriteria.length} completion criteria` : ""}`,
            taskCount: this.currentTasks.length
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
          this.finalizePlanning();
          return {
            success: true,
            message: "Plan finalized and ready for execution",
            totalTasks: this.currentTasks.length
          };
        },
        idempotency: {
          safe: false
        }
      }
    ];
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
async function generateSimplePlan(goal, context) {
  return createPlan({
    goal,
    context,
    tasks: [
      {
        name: "execute_goal",
        description: `Execute the goal: ${goal}`
      }
    ],
    allowDynamicTasks: true
    // Allow agent to modify plan
  });
}
var ContextManager = class extends eventemitter3.EventEmitter {
  config;
  provider;
  estimator;
  compactors;
  strategy;
  lastBudget;
  hooks;
  agentId;
  constructor(provider, config = {}, compactors = [], estimator, strategy, hooks, agentId) {
    super();
    this.provider = provider;
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config };
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
    this.hooks = hooks ?? {};
    this.agentId = agentId;
  }
  /**
   * Set hooks at runtime
   */
  setHooks(hooks) {
    this.hooks = { ...this.hooks, ...hooks };
  }
  /**
   * Set agent ID at runtime
   */
  setAgentId(agentId) {
    this.agentId = agentId;
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
    const targetUtilization = this.config.compactionThreshold * 0.9;
    const targetTokens = Math.floor(
      (budget.total - budget.reserved) * targetUtilization
    );
    const estimatedTokensToFree = Math.max(0, budget.used - targetTokens);
    if (this.hooks.beforeCompaction) {
      try {
        await this.hooks.beforeCompaction({
          agentId: this.agentId,
          currentBudget: budget,
          strategy: this.strategy.name,
          components: components.map((c) => ({
            name: c.name,
            priority: c.priority,
            compactable: c.compactable
          })),
          estimatedTokensToFree
        });
      } catch (error) {
        console.warn(
          "beforeCompaction hook failed:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
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
    return estimateComponentTokens(component, this.estimator);
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
var SUMMARIZATION_PROMPTS = {
  conversation: `Summarize this conversation history, preserving:
- Key decisions made by the user or assistant
- Important facts and data discovered
- User preferences expressed
- Unresolved questions or pending items
- Any errors or issues encountered

Focus on information that would be needed to continue the conversation coherently.
Be concise but preserve critical context.`,
  tool_output: `Summarize these tool outputs, preserving:
- Key results and findings from each tool call
- Important data values (numbers, dates, names, IDs)
- Error messages or warnings
- Status information
- Dependencies or relationships between results

Prioritize factual data over explanatory text.`,
  search_results: `Summarize these search results, preserving:
- Key findings relevant to the task
- Source URLs and their main points (keep URLs intact)
- Factual data (numbers, dates, names, statistics)
- Contradictions or disagreements between sources
- Credibility indicators (official sources, recent dates)

Format as a bulleted list organized by topic or source.`,
  scrape_results: `Summarize this scraped web content, preserving:
- Main topic and key points
- Factual data (numbers, dates, names, prices, specifications)
- Important quotes or statements
- Source attribution (keep the URL)
- Any structured data (tables, lists)

Discard navigation elements, ads, and boilerplate text.`,
  generic: `Summarize this content, preserving:
- Main points and key information
- Important data and facts
- Relationships and dependencies
- Actionable items

Be concise while retaining critical information.`
};
var SummarizeCompactor = class {
  name = "summarize";
  priority = 5;
  // Run before truncate (10)
  config;
  estimator;
  constructor(estimator, config) {
    this.estimator = estimator;
    this.config = {
      textProvider: config.textProvider,
      model: config.model ?? "",
      maxSummaryTokens: config.maxSummaryTokens ?? 500,
      preserveStructure: config.preserveStructure ?? true,
      fallbackToTruncate: config.fallbackToTruncate ?? true,
      temperature: config.temperature ?? 0.3
    };
  }
  /**
   * Check if this compactor can handle the component
   */
  canCompact(component) {
    return component.compactable && component.metadata?.strategy === "summarize";
  }
  /**
   * Compact the component by summarizing its content
   */
  async compact(component, targetTokens) {
    const contentStr = this.stringifyContent(component.content);
    const currentTokens = this.estimator.estimateTokens(contentStr);
    if (currentTokens <= targetTokens) {
      return component;
    }
    const contentType = this.detectContentType(component);
    try {
      const summary = await this.summarize(contentStr, contentType, targetTokens);
      const summaryTokens = this.estimator.estimateTokens(summary);
      if (summaryTokens >= currentTokens * 0.9) {
        if (this.config.fallbackToTruncate) {
          return this.truncateFallback(component, contentStr, targetTokens);
        }
      }
      return {
        ...component,
        content: summary,
        metadata: {
          ...component.metadata,
          summarized: true,
          summarizedFrom: currentTokens,
          summarizedTo: summaryTokens,
          reductionPercent: Math.round(
            (currentTokens - summaryTokens) / currentTokens * 100
          ),
          contentType
        }
      };
    } catch (error) {
      if (this.config.fallbackToTruncate) {
        console.warn(
          `SummarizeCompactor: LLM summarization failed for ${component.name}, falling back to truncation:`,
          error instanceof Error ? error.message : String(error)
        );
        return this.truncateFallback(component, contentStr, targetTokens);
      }
      throw error;
    }
  }
  /**
   * Estimate how many tokens could be saved by summarization
   */
  estimateSavings(component) {
    const current = this.estimator.estimateDataTokens(component.content);
    return Math.floor(current * 0.8);
  }
  /**
   * Perform LLM-based summarization
   */
  async summarize(content, contentType, targetTokens) {
    const systemPrompt = SUMMARIZATION_PROMPTS[contentType];
    const maxSummaryTokens = Math.min(targetTokens, this.config.maxSummaryTokens);
    const structureInstructions = this.config.preserveStructure ? "\n\nPreserve formatting structure (headings, bullet points, numbered lists) where appropriate." : "";
    const prompt = `${systemPrompt}${structureInstructions}

Target summary length: approximately ${maxSummaryTokens} tokens (${maxSummaryTokens * 4} characters).

Content to summarize:
---
${content}
---

Provide the summary:`;
    const response = await this.config.textProvider.generate({
      model: this.config.model || "gpt-4o-mini",
      // Use a fast, cheap model for summarization
      input: prompt,
      temperature: this.config.temperature,
      max_output_tokens: maxSummaryTokens + 100
      // Allow some buffer
    });
    return response.output_text || content;
  }
  /**
   * Fallback to simple truncation when LLM fails
   */
  truncateFallback(component, contentStr, targetTokens) {
    const targetChars = targetTokens * 4;
    const truncated = contentStr.substring(0, targetChars) + "\n\n[... content truncated due to context limits ...]";
    return {
      ...component,
      content: truncated,
      metadata: {
        ...component.metadata,
        truncated: true,
        truncatedFrom: contentStr.length,
        truncatedTo: truncated.length,
        summarizationFailed: true
      }
    };
  }
  /**
   * Detect content type from component metadata or name
   */
  detectContentType(component) {
    if (component.metadata?.contentType) {
      return component.metadata.contentType;
    }
    const name = component.name.toLowerCase();
    if (name.includes("conversation") || name.includes("history") || name.includes("messages")) {
      return "conversation";
    }
    if (name.includes("search")) {
      return "search_results";
    }
    if (name.includes("scrape") || name.includes("fetch")) {
      return "scrape_results";
    }
    if (name.includes("tool") || name.includes("output")) {
      return "tool_output";
    }
    return "generic";
  }
  /**
   * Convert content to string for processing
   */
  stringifyContent(content) {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if ("role" in item && "content" in item) {
            return `[${item.role}]: ${item.content}`;
          }
          if ("tool" in item && "output" in item) {
            return `[${item.tool}]: ${JSON.stringify(item.output)}`;
          }
        }
        return JSON.stringify(item);
      }).join("\n\n");
    }
    return JSON.stringify(content, null, 2);
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
   * Estimate tokens for text with content-type awareness
   *
   * @param text - The text to estimate tokens for
   * @param contentType - Type of content:
   *   - 'code': Code is typically denser (~3 chars/token)
   *   - 'prose': Natural language text (~4 chars/token)
   *   - 'mixed': Mix of code and prose (~3.5 chars/token)
   */
  estimateTokens(text, contentType = "mixed") {
    if (!text || text.length === 0) {
      return 0;
    }
    const charsPerToken = contentType === "code" ? 3 : contentType === "prose" ? 4 : 3.5;
    return Math.ceil(text.length / charsPerToken);
  }
  /**
   * Estimate tokens for structured data (always uses 'mixed' estimation)
   */
  estimateDataTokens(data, contentType = "mixed") {
    if (data === null || data === void 0) {
      return 1;
    }
    try {
      const serialized = JSON.stringify(data);
      return this.estimateTokens(serialized, contentType);
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

// src/domain/interfaces/IHistoryManager.ts
var DEFAULT_HISTORY_MANAGER_CONFIG = {
  maxMessages: 50,
  maxTokens: 32e3,
  compactionStrategy: "sliding-window",
  preserveRecentCount: 10
};

// src/infrastructure/storage/InMemoryHistoryStorage.ts
var InMemoryHistoryStorage = class {
  messages = [];
  summaries = [];
  async addMessage(message) {
    this.messages.push(message);
  }
  async getMessages() {
    return [...this.messages];
  }
  async getRecentMessages(count) {
    return this.messages.slice(-count);
  }
  async removeMessage(id) {
    const index = this.messages.findIndex((m) => m.id === id);
    if (index >= 0) {
      this.messages.splice(index, 1);
    }
  }
  async removeOlderThan(timestamp) {
    const originalLength = this.messages.length;
    this.messages = this.messages.filter((m) => m.timestamp >= timestamp);
    return originalLength - this.messages.length;
  }
  async clear() {
    this.messages = [];
    this.summaries = [];
  }
  async getCount() {
    return this.messages.length;
  }
  async getState() {
    return {
      version: 1,
      messages: [...this.messages],
      summaries: [...this.summaries]
    };
  }
  async restoreState(state) {
    this.messages = [...state.messages];
    this.summaries = state.summaries ? [...state.summaries] : [];
  }
};

// src/core/history/ConversationHistoryManager.ts
var ConversationHistoryManager = class extends eventemitter3.EventEmitter {
  storage;
  config;
  constructor(config = {}) {
    super();
    this.storage = config.storage ?? new InMemoryHistoryStorage();
    this.config = {
      ...DEFAULT_HISTORY_MANAGER_CONFIG,
      ...config
    };
  }
  /**
   * Add a message to history
   */
  async addMessage(role, content, metadata) {
    const message = {
      id: crypto2.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
      metadata
    };
    await this.storage.addMessage(message);
    this.emit("message:added", { message });
    const count = await this.storage.getCount();
    if (count > this.config.maxMessages) {
      await this.compact();
    }
    return message;
  }
  /**
   * Get all messages
   */
  async getMessages() {
    return this.storage.getMessages();
  }
  /**
   * Get recent messages
   */
  async getRecentMessages(count) {
    const limit = count ?? this.config.preserveRecentCount;
    return this.storage.getRecentMessages(limit);
  }
  /**
   * Format history for LLM context
   */
  async formatForContext(options) {
    const maxTokens = options?.maxTokens ?? this.config.maxTokens;
    const messages = await this.storage.getMessages();
    if (messages.length === 0) {
      return "";
    }
    const parts = [];
    let estimatedTokens = 0;
    const headerTokens = 50;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const roleLabel = msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
      const line = `**${roleLabel}**: ${msg.content}`;
      const lineTokens = Math.ceil(line.length / 4);
      if (estimatedTokens + lineTokens + headerTokens > maxTokens) {
        break;
      }
      parts.unshift(line);
      estimatedTokens += lineTokens;
    }
    if (parts.length === 0) {
      return "";
    }
    return `## Conversation History

${parts.join("\n\n")}`;
  }
  /**
   * Compact history based on strategy
   */
  async compact() {
    const count = await this.storage.getCount();
    if (count <= this.config.maxMessages) {
      return;
    }
    const toRemove = count - this.config.maxMessages + this.config.preserveRecentCount;
    switch (this.config.compactionStrategy) {
      case "truncate":
      case "sliding-window": {
        const messages = await this.storage.getMessages();
        const cutoffIndex = Math.min(toRemove, messages.length - this.config.preserveRecentCount);
        const cutoffMsg = cutoffIndex > 0 ? messages[cutoffIndex - 1] : void 0;
        if (cutoffMsg) {
          const cutoffTimestamp = cutoffMsg.timestamp + 1;
          const removed = await this.storage.removeOlderThan(cutoffTimestamp);
          this.emit("history:compacted", { removedCount: removed, strategy: this.config.compactionStrategy });
        }
        break;
      }
      case "summarize": {
        const messages = await this.storage.getMessages();
        const cutoffIndex = Math.min(toRemove, messages.length - this.config.preserveRecentCount);
        const cutoffMsg = cutoffIndex > 0 ? messages[cutoffIndex - 1] : void 0;
        if (cutoffMsg) {
          const cutoffTimestamp = cutoffMsg.timestamp + 1;
          const removed = await this.storage.removeOlderThan(cutoffTimestamp);
          this.emit("history:compacted", { removedCount: removed, strategy: "truncate" });
        }
        break;
      }
    }
  }
  /**
   * Clear all history
   */
  async clear() {
    await this.storage.clear();
    this.emit("history:cleared", {});
  }
  /**
   * Get message count
   */
  async getMessageCount() {
    return this.storage.getCount();
  }
  /**
   * Get state for persistence
   */
  async getState() {
    return this.storage.getState();
  }
  /**
   * Restore from saved state
   */
  async restoreState(state) {
    await this.storage.restoreState(state);
    const count = await this.storage.getCount();
    this.emit("history:restored", { messageCount: count });
  }
  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
};

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
    this.indexPath = path3.join(this.directory, "_index.json");
  }
  async save(session) {
    await this.ensureDirectory();
    const filePath = this.getFilePath(session.id);
    const data = this.prettyPrint ? JSON.stringify(session, null, 2) : JSON.stringify(session);
    await fs11.promises.writeFile(filePath, data, "utf-8");
    await this.updateIndex(session);
  }
  async load(sessionId) {
    const filePath = this.getFilePath(sessionId);
    try {
      const data = await fs11.promises.readFile(filePath, "utf-8");
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
      await fs11.promises.unlink(filePath);
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
      await fs11.promises.access(filePath);
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
    const files = await fs11.promises.readdir(this.directory);
    const sessionFiles = files.filter(
      (f) => f.endsWith(this.extension) && !f.startsWith("_")
    );
    const entries = [];
    for (const file of sessionFiles) {
      try {
        const filePath = path3.join(this.directory, file);
        const data = await fs11.promises.readFile(filePath, "utf-8");
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
    return path3.join(this.directory, `${safeId}${this.extension}`);
  }
  async ensureDirectory() {
    try {
      await fs11.promises.mkdir(this.directory, { recursive: true });
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
      const data = await fs11.promises.readFile(this.indexPath, "utf-8");
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
    await fs11.promises.writeFile(this.indexPath, data, "utf-8");
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

// src/domain/entities/Services.ts
var SERVICE_DEFINITIONS = [
  // ============ Communication ============
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    urlPattern: /slack\.com/i,
    baseURL: "https://slack.com/api",
    docsURL: "https://api.slack.com/methods",
    commonScopes: ["chat:write", "channels:read", "users:read"]
  },
  {
    id: "discord",
    name: "Discord",
    category: "communication",
    urlPattern: /discord\.com|discordapp\.com/i,
    baseURL: "https://discord.com/api/v10",
    docsURL: "https://discord.com/developers/docs",
    commonScopes: ["bot", "messages.read"]
  },
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    category: "communication",
    urlPattern: /teams\.microsoft\.com|graph\.microsoft\.com.*teams/i,
    baseURL: "https://graph.microsoft.com/v1.0",
    docsURL: "https://learn.microsoft.com/en-us/graph/teams-concept-overview",
    commonScopes: ["ChannelMessage.Send", "Team.ReadBasic.All"]
  },
  {
    id: "telegram",
    name: "Telegram",
    category: "communication",
    urlPattern: /api\.telegram\.org/i,
    baseURL: "https://api.telegram.org",
    docsURL: "https://core.telegram.org/bots/api"
  },
  // ============ Development & Project Management ============
  {
    id: "github",
    name: "GitHub",
    category: "development",
    urlPattern: /api\.github\.com/i,
    baseURL: "https://api.github.com",
    docsURL: "https://docs.github.com/en/rest",
    commonScopes: ["repo", "read:user", "read:org"]
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "development",
    urlPattern: /gitlab\.com|gitlab\./i,
    baseURL: "https://gitlab.com/api/v4",
    docsURL: "https://docs.gitlab.com/ee/api/",
    commonScopes: ["api", "read_user", "read_repository"]
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    category: "development",
    urlPattern: /api\.bitbucket\.org|bitbucket\.org/i,
    baseURL: "https://api.bitbucket.org/2.0",
    docsURL: "https://developer.atlassian.com/cloud/bitbucket/rest/",
    commonScopes: ["repository", "pullrequest"]
  },
  {
    id: "jira",
    name: "Jira",
    category: "development",
    urlPattern: /atlassian\.net.*jira|jira\./i,
    baseURL: "https://your-domain.atlassian.net/rest/api/3",
    docsURL: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/",
    commonScopes: ["read:jira-work", "write:jira-work"]
  },
  {
    id: "linear",
    name: "Linear",
    category: "development",
    urlPattern: /api\.linear\.app/i,
    baseURL: "https://api.linear.app/graphql",
    docsURL: "https://developers.linear.app/docs",
    commonScopes: ["read", "write"]
  },
  {
    id: "asana",
    name: "Asana",
    category: "development",
    urlPattern: /api\.asana\.com/i,
    baseURL: "https://app.asana.com/api/1.0",
    docsURL: "https://developers.asana.com/docs"
  },
  {
    id: "trello",
    name: "Trello",
    category: "development",
    urlPattern: /api\.trello\.com/i,
    baseURL: "https://api.trello.com/1",
    docsURL: "https://developer.atlassian.com/cloud/trello/rest/",
    commonScopes: ["read", "write"]
  },
  // ============ Productivity & Collaboration ============
  {
    id: "notion",
    name: "Notion",
    category: "productivity",
    urlPattern: /api\.notion\.com/i,
    baseURL: "https://api.notion.com/v1",
    docsURL: "https://developers.notion.com/reference"
  },
  {
    id: "airtable",
    name: "Airtable",
    category: "productivity",
    urlPattern: /api\.airtable\.com/i,
    baseURL: "https://api.airtable.com/v0",
    docsURL: "https://airtable.com/developers/web/api",
    commonScopes: ["data.records:read", "data.records:write"]
  },
  {
    id: "google-workspace",
    name: "Google Workspace",
    category: "productivity",
    urlPattern: /googleapis\.com.*(drive|docs|sheets|calendar)/i,
    baseURL: "https://www.googleapis.com",
    docsURL: "https://developers.google.com/workspace",
    commonScopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/calendar"
    ]
  },
  {
    id: "microsoft-365",
    name: "Microsoft 365",
    category: "productivity",
    urlPattern: /graph\.microsoft\.com/i,
    baseURL: "https://graph.microsoft.com/v1.0",
    docsURL: "https://learn.microsoft.com/en-us/graph/",
    commonScopes: ["User.Read", "Files.ReadWrite", "Mail.Read"]
  },
  {
    id: "confluence",
    name: "Confluence",
    category: "productivity",
    urlPattern: /atlassian\.net.*wiki|confluence\./i,
    baseURL: "https://your-domain.atlassian.net/wiki/rest/api",
    docsURL: "https://developer.atlassian.com/cloud/confluence/rest/",
    commonScopes: ["read:confluence-content.all", "write:confluence-content"]
  },
  // ============ CRM & Sales ============
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    urlPattern: /salesforce\.com|force\.com/i,
    baseURL: "https://your-instance.salesforce.com/services/data/v58.0",
    docsURL: "https://developer.salesforce.com/docs/apis",
    commonScopes: ["api", "refresh_token"]
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    urlPattern: /api\.hubapi\.com|api\.hubspot\.com/i,
    baseURL: "https://api.hubapi.com",
    docsURL: "https://developers.hubspot.com/docs/api",
    commonScopes: ["crm.objects.contacts.read", "crm.objects.contacts.write"]
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    urlPattern: /api\.pipedrive\.com/i,
    baseURL: "https://api.pipedrive.com/v1",
    docsURL: "https://developers.pipedrive.com/docs/api/v1"
  },
  // ============ Payments & Finance ============
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    urlPattern: /api\.stripe\.com/i,
    baseURL: "https://api.stripe.com/v1",
    docsURL: "https://stripe.com/docs/api"
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "payments",
    urlPattern: /api\.paypal\.com|api-m\.paypal\.com/i,
    baseURL: "https://api-m.paypal.com/v2",
    docsURL: "https://developer.paypal.com/docs/api/"
  },
  // ============ Cloud Providers ============
  {
    id: "aws",
    name: "Amazon Web Services",
    category: "cloud",
    urlPattern: /amazonaws\.com/i,
    baseURL: "https://aws.amazon.com",
    docsURL: "https://docs.aws.amazon.com/"
  },
  {
    id: "gcp",
    name: "Google Cloud Platform",
    category: "cloud",
    urlPattern: /googleapis\.com/i,
    baseURL: "https://www.googleapis.com",
    docsURL: "https://cloud.google.com/apis/docs/"
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    category: "cloud",
    urlPattern: /azure\.com|microsoft\.com.*azure/i,
    baseURL: "https://management.azure.com",
    docsURL: "https://learn.microsoft.com/en-us/azure/"
  },
  // ============ Storage ============
  {
    id: "dropbox",
    name: "Dropbox",
    category: "storage",
    urlPattern: /api\.dropboxapi\.com|dropbox\.com/i,
    baseURL: "https://api.dropboxapi.com/2",
    docsURL: "https://www.dropbox.com/developers/documentation",
    commonScopes: ["files.content.read", "files.content.write"]
  },
  {
    id: "box",
    name: "Box",
    category: "storage",
    urlPattern: /api\.box\.com/i,
    baseURL: "https://api.box.com/2.0",
    docsURL: "https://developer.box.com/reference/"
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "storage",
    urlPattern: /googleapis\.com.*drive/i,
    baseURL: "https://www.googleapis.com/drive/v3",
    docsURL: "https://developers.google.com/drive/api",
    commonScopes: ["https://www.googleapis.com/auth/drive"]
  },
  {
    id: "onedrive",
    name: "OneDrive",
    category: "storage",
    urlPattern: /graph\.microsoft\.com.*drive/i,
    baseURL: "https://graph.microsoft.com/v1.0/me/drive",
    docsURL: "https://learn.microsoft.com/en-us/onedrive/developer/",
    commonScopes: ["Files.ReadWrite"]
  },
  // ============ Email ============
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "email",
    urlPattern: /api\.sendgrid\.com/i,
    baseURL: "https://api.sendgrid.com/v3",
    docsURL: "https://docs.sendgrid.com/api-reference"
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "email",
    urlPattern: /api\.mailchimp\.com|mandrillapp\.com/i,
    baseURL: "https://server.api.mailchimp.com/3.0",
    docsURL: "https://mailchimp.com/developer/marketing/api/"
  },
  {
    id: "postmark",
    name: "Postmark",
    category: "email",
    urlPattern: /api\.postmarkapp\.com/i,
    baseURL: "https://api.postmarkapp.com",
    docsURL: "https://postmarkapp.com/developer"
  },
  // ============ Monitoring & Observability ============
  {
    id: "datadog",
    name: "Datadog",
    category: "monitoring",
    urlPattern: /api\.datadoghq\.com/i,
    baseURL: "https://api.datadoghq.com/api/v2",
    docsURL: "https://docs.datadoghq.com/api/"
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    category: "monitoring",
    urlPattern: /api\.pagerduty\.com/i,
    baseURL: "https://api.pagerduty.com",
    docsURL: "https://developer.pagerduty.com/api-reference/"
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "monitoring",
    urlPattern: /sentry\.io/i,
    baseURL: "https://sentry.io/api/0",
    docsURL: "https://docs.sentry.io/api/"
  },
  // ============ Search ============
  {
    id: "serper",
    name: "Serper",
    category: "search",
    urlPattern: /serper\.dev/i,
    baseURL: "https://google.serper.dev",
    docsURL: "https://serper.dev/docs"
  },
  {
    id: "brave-search",
    name: "Brave Search",
    category: "search",
    urlPattern: /api\.search\.brave\.com/i,
    baseURL: "https://api.search.brave.com/res/v1",
    docsURL: "https://brave.com/search/api/"
  },
  {
    id: "tavily",
    name: "Tavily",
    category: "search",
    urlPattern: /api\.tavily\.com/i,
    baseURL: "https://api.tavily.com",
    docsURL: "https://tavily.com/docs"
  },
  {
    id: "rapidapi-search",
    name: "RapidAPI Search",
    category: "search",
    urlPattern: /real-time-web-search\.p\.rapidapi\.com/i,
    baseURL: "https://real-time-web-search.p.rapidapi.com",
    docsURL: "https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-web-search"
  },
  // ============ Scraping ============
  {
    id: "zenrows",
    name: "ZenRows",
    category: "scrape",
    urlPattern: /api\.zenrows\.com/i,
    baseURL: "https://api.zenrows.com/v1",
    docsURL: "https://docs.zenrows.com/universal-scraper-api/api-reference"
  },
  // ============ Other ============
  {
    id: "twilio",
    name: "Twilio",
    category: "other",
    urlPattern: /api\.twilio\.com/i,
    baseURL: "https://api.twilio.com/2010-04-01",
    docsURL: "https://www.twilio.com/docs/usage/api"
  },
  {
    id: "zendesk",
    name: "Zendesk",
    category: "other",
    urlPattern: /zendesk\.com/i,
    baseURL: "https://your-subdomain.zendesk.com/api/v2",
    docsURL: "https://developer.zendesk.com/api-reference/",
    commonScopes: ["read", "write"]
  },
  {
    id: "intercom",
    name: "Intercom",
    category: "other",
    urlPattern: /api\.intercom\.io/i,
    baseURL: "https://api.intercom.io",
    docsURL: "https://developers.intercom.com/docs/"
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "other",
    urlPattern: /shopify\.com.*admin/i,
    baseURL: "https://your-store.myshopify.com/admin/api/2024-01",
    docsURL: "https://shopify.dev/docs/api",
    commonScopes: ["read_products", "write_products", "read_orders"]
  }
];
var Services = Object.fromEntries(
  SERVICE_DEFINITIONS.map((def) => [
    // Convert kebab-case to PascalCase for object key
    def.id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(""),
    def.id
  ])
);
var SERVICE_URL_PATTERNS = SERVICE_DEFINITIONS.map((def) => ({
  service: def.id,
  pattern: def.urlPattern
}));
var SERVICE_INFO = Object.fromEntries(
  SERVICE_DEFINITIONS.map((def) => [
    def.id,
    {
      id: def.id,
      name: def.name,
      category: def.category,
      baseURL: def.baseURL,
      docsURL: def.docsURL,
      commonScopes: def.commonScopes
    }
  ])
);
var compiledPatterns = null;
function getCompiledPatterns() {
  if (!compiledPatterns) {
    compiledPatterns = SERVICE_DEFINITIONS.map((def) => ({
      service: def.id,
      pattern: def.urlPattern
    }));
  }
  return compiledPatterns;
}
function detectServiceFromURL(url) {
  const patterns = getCompiledPatterns();
  for (const { service, pattern } of patterns) {
    if (pattern.test(url)) {
      return service;
    }
  }
  return void 0;
}
function getServiceInfo(serviceType) {
  return SERVICE_INFO[serviceType];
}
function getServiceDefinition(serviceType) {
  return SERVICE_DEFINITIONS.find((def) => def.id === serviceType);
}
function getServicesByCategory(category) {
  return SERVICE_DEFINITIONS.filter((def) => def.category === category);
}
function getAllServiceIds() {
  return SERVICE_DEFINITIONS.map((def) => def.id);
}
function isKnownService(serviceId) {
  return SERVICE_DEFINITIONS.some((def) => def.id === serviceId);
}

// src/index.ts
init_Connector();

// src/tools/connector/ConnectorTools.ts
init_Connector();
var PROTECTED_HEADERS = ["authorization", "x-api-key", "api-key", "bearer"];
function safeStringify2(obj) {
  const seen = /* @__PURE__ */ new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  });
}
function filterProtectedHeaders(headers) {
  if (!headers) return {};
  const filtered = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!PROTECTED_HEADERS.includes(key.toLowerCase())) {
      filtered[key] = value;
    }
  }
  return filtered;
}
var ConnectorTools = class {
  /** Registry of service-specific tool factories */
  static factories = /* @__PURE__ */ new Map();
  /** Cache for detected service types (connector name -> service type) */
  static serviceTypeCache = /* @__PURE__ */ new Map();
  /** Cache for generated tools (cacheKey -> tools) */
  static toolCache = /* @__PURE__ */ new Map();
  /** Maximum cache size to prevent memory issues */
  static MAX_CACHE_SIZE = 100;
  /**
   * Clear all caches (useful for testing or when connectors change)
   */
  static clearCache() {
    this.serviceTypeCache.clear();
    this.toolCache.clear();
  }
  /**
   * Invalidate cache for a specific connector
   */
  static invalidateCache(connectorName) {
    this.serviceTypeCache.delete(connectorName);
    for (const key of this.toolCache.keys()) {
      if (key.startsWith(`${connectorName}:`)) {
        this.toolCache.delete(key);
      }
    }
  }
  /**
   * Register a tool factory for a service type
   *
   * @param serviceType - Service identifier (e.g., 'slack', 'github')
   * @param factory - Function that creates tools from a Connector
   *
   * @example
   * ```typescript
   * ConnectorTools.registerService('slack', (connector) => [
   *   createSlackSendMessageTool(connector),
   *   createSlackListChannelsTool(connector),
   * ]);
   * ```
   */
  static registerService(serviceType, factory) {
    this.factories.set(serviceType, factory);
  }
  /**
   * Unregister a service tool factory
   */
  static unregisterService(serviceType) {
    return this.factories.delete(serviceType);
  }
  /**
   * Get ALL tools for a connector (generic API + service-specific)
   * This is the main entry point
   *
   * @param connectorOrName - Connector instance or name
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Array of tools
   *
   * @example
   * ```typescript
   * const tools = ConnectorTools.for('slack');
   * // Returns: [slack_api, slack_send_message, slack_list_channels, ...]
   * ```
   */
  static for(connectorOrName, userId) {
    const connector = this.resolveConnector(connectorOrName);
    const tools = [];
    if (connector.baseURL) {
      tools.push(this.createGenericAPITool(connector, { userId }));
    }
    const serviceType = this.detectService(connector);
    if (serviceType && this.factories.has(serviceType)) {
      const factory = this.factories.get(serviceType);
      tools.push(...factory(connector, userId));
    }
    return tools;
  }
  /**
   * Get just the generic API tool for a connector
   *
   * @param connectorOrName - Connector instance or name
   * @param options - Optional configuration
   * @returns Generic API tool
   *
   * @example
   * ```typescript
   * const apiTool = ConnectorTools.genericAPI('github');
   * ```
   */
  static genericAPI(connectorOrName, options) {
    const connector = this.resolveConnector(connectorOrName);
    return this.createGenericAPITool(connector, options);
  }
  /**
   * Get only service-specific tools (no generic API tool)
   *
   * @param connectorOrName - Connector instance or name
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Service-specific tools only
   */
  static serviceTools(connectorOrName, userId) {
    const connector = this.resolveConnector(connectorOrName);
    const serviceType = this.detectService(connector);
    if (!serviceType || !this.factories.has(serviceType)) {
      return [];
    }
    return this.factories.get(serviceType)(connector, userId);
  }
  /**
   * Discover tools for ALL registered connectors with external services
   * Skips AI provider connectors (those with vendor but no serviceType)
   *
   * @param userId - Optional user ID for multi-user OAuth
   * @returns Map of connector name to tools
   *
   * @example
   * ```typescript
   * const allTools = ConnectorTools.discoverAll();
   * for (const [name, tools] of allTools) {
   *   agent.tools.registerMany(tools, { namespace: name });
   * }
   * ```
   */
  static discoverAll(userId) {
    const result = /* @__PURE__ */ new Map();
    for (const connector of exports.Connector.listAll()) {
      const hasServiceType = !!connector.config.serviceType;
      const isExternalAPI = connector.baseURL && !connector.vendor;
      if (hasServiceType || isExternalAPI) {
        const tools = this.for(connector, userId);
        if (tools.length > 0) {
          result.set(connector.name, tools);
        }
      }
    }
    return result;
  }
  /**
   * Find a connector by service type
   * Returns the first connector matching the service type
   *
   * @param serviceType - Service identifier
   * @returns Connector or undefined
   */
  static findConnector(serviceType) {
    return exports.Connector.listAll().find((c) => this.detectService(c) === serviceType);
  }
  /**
   * Find all connectors for a service type
   * Useful when you have multiple connectors for the same service
   *
   * @param serviceType - Service identifier
   * @returns Array of matching connectors
   */
  static findConnectors(serviceType) {
    return exports.Connector.listAll().filter((c) => this.detectService(c) === serviceType);
  }
  /**
   * List services that have registered tool factories
   */
  static listSupportedServices() {
    return Array.from(this.factories.keys());
  }
  /**
   * Check if a service has dedicated tool factory
   */
  static hasServiceTools(serviceType) {
    return this.factories.has(serviceType);
  }
  /**
   * Detect the service type for a connector
   * Uses explicit serviceType if set, otherwise infers from baseURL
   * Results are cached for performance
   */
  static detectService(connector) {
    const cacheKey = connector.name;
    if (this.serviceTypeCache.has(cacheKey)) {
      return this.serviceTypeCache.get(cacheKey);
    }
    let result;
    if (connector.config.serviceType) {
      result = connector.config.serviceType;
    } else if (connector.baseURL) {
      result = detectServiceFromURL(connector.baseURL);
    }
    this.maintainCacheSize(this.serviceTypeCache);
    this.serviceTypeCache.set(cacheKey, result);
    return result;
  }
  /**
   * Maintain cache size to prevent memory leaks
   */
  static maintainCacheSize(cache) {
    if (cache.size >= this.MAX_CACHE_SIZE) {
      const toRemove = Math.ceil(this.MAX_CACHE_SIZE * 0.1);
      const keys = Array.from(cache.keys()).slice(0, toRemove);
      for (const key of keys) {
        cache.delete(key);
      }
    }
  }
  // ============ Private Methods ============
  static resolveConnector(connectorOrName) {
    return typeof connectorOrName === "string" ? exports.Connector.get(connectorOrName) : connectorOrName;
  }
  static createGenericAPITool(connector, options) {
    const toolName = options?.toolName ?? `${connector.name}_api`;
    const userId = options?.userId;
    const description = options?.description ?? `Make an authenticated API call to ${connector.displayName}.` + (connector.baseURL ? ` Base URL: ${connector.baseURL}` : " Provide full URL in endpoint.");
    return {
      definition: {
        type: "function",
        function: {
          name: toolName,
          description,
          parameters: {
            type: "object",
            properties: {
              method: {
                type: "string",
                enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                description: "HTTP method"
              },
              endpoint: {
                type: "string",
                description: "API endpoint (relative to base URL) or full URL"
              },
              body: {
                type: "object",
                description: "Request body (for POST/PUT/PATCH)"
              },
              queryParams: {
                type: "object",
                description: "URL query parameters"
              },
              headers: {
                type: "object",
                description: "Additional request headers"
              }
            },
            required: ["method", "endpoint"]
          }
        }
      },
      execute: async (args) => {
        let url = args.endpoint;
        if (args.queryParams && Object.keys(args.queryParams).length > 0) {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(args.queryParams)) {
            params.append(key, String(value));
          }
          url += (url.includes("?") ? "&" : "?") + params.toString();
        }
        const safeHeaders = filterProtectedHeaders(args.headers);
        let bodyStr;
        if (args.body) {
          try {
            bodyStr = safeStringify2(args.body);
          } catch (e) {
            return {
              success: false,
              error: `Failed to serialize request body: ${e instanceof Error ? e.message : String(e)}`
            };
          }
        }
        try {
          const response = await connector.fetch(
            url,
            {
              method: args.method,
              headers: {
                "Content-Type": "application/json",
                ...safeHeaders
              },
              body: bodyStr
            },
            userId
          );
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          return {
            success: response.ok,
            status: response.status,
            data: response.ok ? data : void 0,
            error: response.ok ? void 0 : typeof data === "string" ? data : safeStringify2(data)
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      },
      describeCall: (args) => `${args.method} ${args.endpoint}`,
      permission: options?.permission ?? {
        scope: "session",
        riskLevel: "medium",
        approvalMessage: `This will make an API call to ${connector.displayName}`
      }
    };
  }
};

// src/connectors/oauth/index.ts
init_OAuthManager();

// src/connectors/index.ts
init_MemoryStorage();

// src/connectors/oauth/infrastructure/storage/FileStorage.ts
init_encryption();
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
      await fs10__namespace.mkdir(this.directory, { recursive: true });
      await fs10__namespace.chmod(this.directory, 448);
    } catch (error) {
    }
  }
  /**
   * Get file path for a token key (hashed for security)
   */
  getFilePath(key) {
    const hash = crypto2__namespace.createHash("sha256").update(key).digest("hex");
    return path3__namespace.join(this.directory, `${hash}.token`);
  }
  async storeToken(key, token) {
    await this.ensureDirectory();
    const filePath = this.getFilePath(key);
    const plaintext = JSON.stringify(token);
    const encrypted = encrypt(plaintext, this.encryptionKey);
    await fs10__namespace.writeFile(filePath, encrypted, "utf8");
    await fs10__namespace.chmod(filePath, 384);
  }
  async getToken(key) {
    const filePath = this.getFilePath(key);
    try {
      const encrypted = await fs10__namespace.readFile(filePath, "utf8");
      const decrypted = decrypt(encrypted, this.encryptionKey);
      return JSON.parse(decrypted);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      console.error("Failed to read/decrypt token file:", error);
      try {
        await fs10__namespace.unlink(filePath);
      } catch {
      }
      return null;
    }
  }
  async deleteToken(key) {
    const filePath = this.getFilePath(key);
    try {
      await fs10__namespace.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  async hasToken(key) {
    const filePath = this.getFilePath(key);
    try {
      await fs10__namespace.access(filePath);
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
      const files = await fs10__namespace.readdir(this.directory);
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
      const files = await fs10__namespace.readdir(this.directory);
      const tokenFiles = files.filter((f) => f.endsWith(".token"));
      await Promise.all(
        tokenFiles.map((f) => fs10__namespace.unlink(path3__namespace.join(this.directory, f)).catch(() => {
        }))
      );
    } catch {
    }
  }
};

// src/connectors/authenticatedFetch.ts
init_Connector();
async function authenticatedFetch(url, options, authProvider, userId) {
  const connector = exports.Connector.get(authProvider);
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
  exports.Connector.get(authProvider);
  return async (url, options) => {
    return authenticatedFetch(url, options, authProvider, userId);
  };
}

// src/connectors/toolGenerator.ts
init_Connector();
function generateWebAPITool() {
  return {
    definition: {
      type: "function",
      function: {
        name: "api_request",
        description: `Make authenticated HTTP request to any registered OAuth API.

This tool automatically handles OAuth authentication for registered providers.

REGISTERED PROVIDERS:
${exports.Connector.getDescriptionsForTools()}

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
              enum: exports.Connector.list(),
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
        const connector = exports.Connector.get(args.authProvider);
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

// src/connectors/index.ts
init_pkce();
init_encryption();

// src/domain/interfaces/IConnectorConfigStorage.ts
var CONNECTOR_CONFIG_VERSION = 1;

// src/connectors/storage/ConnectorConfigStore.ts
init_encryption();
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
    this.indexPath = path3__namespace.join(this.directory, "_index.json");
  }
  async save(name, stored) {
    await this.ensureDirectory();
    const filePath = this.getFilePath(name);
    const json = JSON.stringify(stored, null, 2);
    await fs10__namespace.writeFile(filePath, json, "utf8");
    await fs10__namespace.chmod(filePath, 384);
    await this.updateIndex(name, "add");
  }
  async get(name) {
    const filePath = this.getFilePath(name);
    try {
      const json = await fs10__namespace.readFile(filePath, "utf8");
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
      await fs10__namespace.unlink(filePath);
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
      await fs10__namespace.access(filePath);
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
      const files = await fs10__namespace.readdir(this.directory);
      const connectorFiles = files.filter(
        (f) => f.endsWith(".connector.json") || f === "_index.json"
      );
      await Promise.all(
        connectorFiles.map(
          (f) => fs10__namespace.unlink(path3__namespace.join(this.directory, f)).catch(() => {
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
    return path3__namespace.join(this.directory, `${hash}.connector.json`);
  }
  /**
   * Hash connector name to prevent enumeration
   */
  hashName(name) {
    return crypto2__namespace.createHash("sha256").update(name).digest("hex").slice(0, 16);
  }
  /**
   * Ensure storage directory exists with proper permissions
   */
  async ensureDirectory() {
    if (this.initialized) return;
    try {
      await fs10__namespace.mkdir(this.directory, { recursive: true });
      await fs10__namespace.chmod(this.directory, 448);
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
      const json = await fs10__namespace.readFile(this.indexPath, "utf8");
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
    await fs10__namespace.writeFile(this.indexPath, json, "utf8");
    await fs10__namespace.chmod(this.indexPath, 384);
  }
};

// src/infrastructure/observability/index.ts
init_Logger();
init_Metrics();

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
var execAsync = util.promisify(child_process.exec);
function cleanupTempFile(filePath) {
  try {
    if (fs11__namespace.existsSync(filePath)) {
      fs11__namespace.unlinkSync(filePath);
    }
  } catch {
  }
}
async function readClipboardImage() {
  const platform2 = os__namespace.platform();
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
  const tempFile = path3__namespace.join(os__namespace.tmpdir(), `clipboard-${Date.now()}.png`);
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
      if (stdout.includes("success") || fs11__namespace.existsSync(tempFile)) {
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
  const tempFile = path3__namespace.join(os__namespace.tmpdir(), `clipboard-${Date.now()}.png`);
  try {
    try {
      await execAsync(`xclip -selection clipboard -t image/png -o > "${tempFile}"`);
      if (fs11__namespace.existsSync(tempFile) && fs11__namespace.statSync(tempFile).size > 0) {
        return await convertFileToDataUri(tempFile);
      }
    } catch {
    }
    try {
      await execAsync(`wl-paste -t image/png > "${tempFile}"`);
      if (fs11__namespace.existsSync(tempFile) && fs11__namespace.statSync(tempFile).size > 0) {
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
  const tempFile = path3__namespace.join(os__namespace.tmpdir(), `clipboard-${Date.now()}.png`);
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
    if (fs11__namespace.existsSync(tempFile) && fs11__namespace.statSync(tempFile).size > 0) {
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
    const imageBuffer = fs11__namespace.readFileSync(filePath);
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
  const platform2 = os__namespace.platform();
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
  ConnectorTools: () => ConnectorTools,
  DEFAULT_FILESYSTEM_CONFIG: () => DEFAULT_FILESYSTEM_CONFIG,
  DEFAULT_SHELL_CONFIG: () => DEFAULT_SHELL_CONFIG,
  bash: () => bash,
  createBashTool: () => createBashTool,
  createEditFileTool: () => createEditFileTool,
  createExecuteJavaScriptTool: () => createExecuteJavaScriptTool,
  createGlobTool: () => createGlobTool,
  createGrepTool: () => createGrepTool,
  createListDirectoryTool: () => createListDirectoryTool,
  createReadFileTool: () => createReadFileTool,
  createWriteFileTool: () => createWriteFileTool,
  developerTools: () => developerTools,
  editFile: () => editFile,
  executeJavaScript: () => executeJavaScript,
  expandTilde: () => expandTilde,
  getBackgroundOutput: () => getBackgroundOutput,
  glob: () => glob,
  grep: () => grep,
  isBlockedCommand: () => isBlockedCommand,
  isExcludedExtension: () => isExcludedExtension,
  jsonManipulator: () => jsonManipulator,
  killBackgroundProcess: () => killBackgroundProcess,
  listDirectory: () => listDirectory,
  readFile: () => readFile4,
  validatePath: () => validatePath,
  webFetch: () => webFetch,
  webFetchJS: () => webFetchJS,
  webSearch: () => webSearch,
  writeFile: () => writeFile4
});
var DEFAULT_FILESYSTEM_CONFIG = {
  workingDirectory: process.cwd(),
  allowedDirectories: [],
  blockedDirectories: ["node_modules", ".git", ".svn", ".hg", "__pycache__", ".cache"],
  maxFileSize: 10 * 1024 * 1024,
  // 10MB
  maxResults: 1e3,
  followSymlinks: false,
  excludeExtensions: [
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".obj",
    ".o",
    ".a",
    ".zip",
    ".tar",
    ".gz",
    ".bz2",
    ".7z",
    ".rar",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".svg",
    ".webp",
    ".mp3",
    ".mp4",
    ".wav",
    ".avi",
    ".mov",
    ".mkv",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf"
  ]
};
function validatePath(inputPath, config = {}) {
  const workingDir = config.workingDirectory || process.cwd();
  const allowedDirs = config.allowedDirectories || [];
  const blockedDirs = config.blockedDirectories || DEFAULT_FILESYSTEM_CONFIG.blockedDirectories;
  let expandedPath = inputPath;
  if (inputPath.startsWith("~/")) {
    expandedPath = path3.resolve(os.homedir(), inputPath.slice(2));
  } else if (inputPath === "~") {
    expandedPath = os.homedir();
  }
  let resolvedPath;
  if (path3.isAbsolute(expandedPath)) {
    resolvedPath = path3.normalize(expandedPath);
  } else {
    resolvedPath = path3.resolve(workingDir, expandedPath);
  }
  const pathSegments = resolvedPath.split("/").filter(Boolean);
  for (const blocked of blockedDirs) {
    if (!blocked.includes("/")) {
      if (pathSegments.includes(blocked)) {
        return {
          valid: false,
          resolvedPath,
          error: `Path is in blocked directory: ${blocked}`
        };
      }
    } else {
      const blockedPath = path3.isAbsolute(blocked) ? blocked : path3.resolve(workingDir, blocked);
      if (resolvedPath.startsWith(blockedPath + "/") || resolvedPath === blockedPath) {
        return {
          valid: false,
          resolvedPath,
          error: `Path is in blocked directory: ${blocked}`
        };
      }
    }
  }
  if (allowedDirs.length > 0) {
    let isAllowed = false;
    for (const allowed of allowedDirs) {
      const allowedPath = path3.isAbsolute(allowed) ? allowed : path3.resolve(workingDir, allowed);
      if (resolvedPath.startsWith(allowedPath + "/") || resolvedPath === allowedPath) {
        isAllowed = true;
        break;
      }
    }
    if (!isAllowed) {
      return {
        valid: false,
        resolvedPath,
        error: `Path is outside allowed directories`
      };
    }
  }
  return { valid: true, resolvedPath };
}
function expandTilde(inputPath) {
  if (inputPath.startsWith("~/")) {
    return path3.resolve(os.homedir(), inputPath.slice(2));
  } else if (inputPath === "~") {
    return os.homedir();
  }
  return inputPath;
}
function isExcludedExtension(filePath, excludeExtensions = DEFAULT_FILESYSTEM_CONFIG.excludeExtensions) {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
  return excludeExtensions.includes(ext);
}
function createReadFileTool(config = {}) {
  const mergedConfig = { ...DEFAULT_FILESYSTEM_CONFIG, ...config };
  return {
    definition: {
      type: "function",
      function: {
        name: "read_file",
        description: `Read content from a file on the local filesystem.

USAGE:
- The file_path parameter must be an absolute path, not a relative path
- By default, reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files)
- Any lines longer than 2000 characters will be truncated
- Results are returned with line numbers starting at 1

WHEN TO USE:
- To read source code files before making edits
- To understand file contents and structure
- To read configuration files
- To examine log files or data files

IMPORTANT:
- Always read a file before attempting to edit it
- Use offset/limit for very large files to read in chunks
- The tool will return an error if the file doesn't exist

EXAMPLES:
- Read entire file: { "file_path": "/path/to/file.ts" }
- Read lines 100-200: { "file_path": "/path/to/file.ts", "offset": 100, "limit": 100 }`,
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The absolute path to the file to read"
            },
            offset: {
              type: "number",
              description: "Line number to start reading from (1-indexed). Only provide if the file is too large to read at once."
            },
            limit: {
              type: "number",
              description: "Number of lines to read. Only provide if the file is too large to read at once."
            }
          },
          required: ["file_path"]
        }
      }
    },
    describeCall: (args) => {
      if (args.offset && args.limit) {
        return `${args.file_path} [lines ${args.offset}-${args.offset + args.limit}]`;
      }
      return args.file_path;
    },
    execute: async (args) => {
      const { file_path, offset = 1, limit = 2e3 } = args;
      const validation = validatePath(file_path, mergedConfig);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          path: file_path
        };
      }
      const resolvedPath = validation.resolvedPath;
      if (!fs11.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `File not found: ${file_path}`,
          path: file_path
        };
      }
      try {
        const stats = await fs10.stat(resolvedPath);
        if (!stats.isFile()) {
          return {
            success: false,
            error: `Path is not a file: ${file_path}. Use list_directory to explore directories.`,
            path: file_path
          };
        }
        if (stats.size > mergedConfig.maxFileSize) {
          return {
            success: false,
            error: `File is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${(mergedConfig.maxFileSize / 1024 / 1024).toFixed(2)}MB. Use offset and limit to read in chunks.`,
            path: file_path,
            size: stats.size
          };
        }
        const content = await fs10.readFile(resolvedPath, "utf-8");
        const allLines = content.split("\n");
        const totalLines = allLines.length;
        const startIndex = Math.max(0, offset - 1);
        const endIndex = Math.min(totalLines, startIndex + limit);
        const selectedLines = allLines.slice(startIndex, endIndex);
        const lineNumberWidth = String(endIndex).length;
        const formattedLines = selectedLines.map((line, i) => {
          const lineNum = startIndex + i + 1;
          const paddedNum = String(lineNum).padStart(lineNumberWidth, " ");
          const truncatedLine = line.length > 2e3 ? line.substring(0, 2e3) + "..." : line;
          return `${paddedNum}	${truncatedLine}`;
        });
        const truncated = endIndex < totalLines;
        const result = formattedLines.join("\n");
        return {
          success: true,
          content: result,
          lines: totalLines,
          truncated,
          encoding: "utf-8",
          size: stats.size,
          path: file_path
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes("encoding")) {
          return {
            success: false,
            error: `File appears to be binary or uses an unsupported encoding: ${file_path}`,
            path: file_path
          };
        }
        return {
          success: false,
          error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
          path: file_path
        };
      }
    }
  };
}
var readFile4 = createReadFileTool();
function createWriteFileTool(config = {}) {
  const mergedConfig = { ...DEFAULT_FILESYSTEM_CONFIG, ...config };
  return {
    definition: {
      type: "function",
      function: {
        name: "write_file",
        description: `Write content to a file on the local filesystem.

USAGE:
- This tool will overwrite the existing file if there is one at the provided path
- If the file exists, you MUST use the read_file tool first to read its contents before writing
- The file_path must be an absolute path, not a relative path
- Parent directories will be created automatically if they don't exist

WHEN TO USE:
- To create new files
- To completely replace file contents (after reading the original)
- When the edit_file tool cannot handle the changes needed

IMPORTANT:
- ALWAYS prefer editing existing files over creating new ones
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- If modifying an existing file, use edit_file instead for surgical changes
- This tool will FAIL if you try to write to an existing file without reading it first

EXAMPLES:
- Create new file: { "file_path": "/path/to/new-file.ts", "content": "export const x = 1;" }
- Rewrite file: { "file_path": "/path/to/existing.ts", "content": "// new content..." }`,
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The absolute path to the file to write (must be absolute, not relative)"
            },
            content: {
              type: "string",
              description: "The content to write to the file"
            }
          },
          required: ["file_path", "content"]
        }
      }
    },
    describeCall: (args) => {
      const size = args.content?.length || 0;
      if (size > 1e3) {
        return `${args.file_path} (${Math.round(size / 1024)}KB)`;
      }
      return args.file_path;
    },
    execute: async (args) => {
      const { file_path, content } = args;
      const validation = validatePath(file_path, mergedConfig);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          path: file_path
        };
      }
      const resolvedPath = validation.resolvedPath;
      const fileExists = fs11.existsSync(resolvedPath);
      try {
        const parentDir = path3.dirname(resolvedPath);
        if (!fs11.existsSync(parentDir)) {
          await fs10.mkdir(parentDir, { recursive: true });
        }
        await fs10.writeFile(resolvedPath, content, "utf-8");
        return {
          success: true,
          path: file_path,
          bytesWritten: Buffer.byteLength(content, "utf-8"),
          created: !fileExists
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
          path: file_path
        };
      }
    }
  };
}
var writeFile4 = createWriteFileTool();
function createEditFileTool(config = {}) {
  const mergedConfig = { ...DEFAULT_FILESYSTEM_CONFIG, ...config };
  return {
    definition: {
      type: "function",
      function: {
        name: "edit_file",
        description: `Perform exact string replacements in files.

USAGE:
- You MUST use read_file at least once before editing any file
- The old_string must match EXACTLY what's in the file, including all whitespace and indentation
- When editing text from read_file output, preserve the exact indentation as it appears AFTER the line number prefix
- The line number prefix format is: spaces + line number + tab. Everything after that tab is the actual file content
- NEVER include any part of the line number prefix in old_string or new_string

IMPORTANT RULES:
- ALWAYS prefer editing existing files over writing new ones
- The edit will FAIL if old_string is not found in the file
- The edit will FAIL if old_string appears more than once (unless replace_all is true)
- Use replace_all: true when you want to rename variables, update imports, etc.
- old_string and new_string must be different

MATCHING TIPS:
- Include enough surrounding context to make old_string unique
- Copy the exact whitespace from the file (spaces vs tabs matter!)
- For indented code, include the full indentation in old_string

EXAMPLES:
- Simple edit:
  { "file_path": "/path/to/file.ts", "old_string": "const x = 1;", "new_string": "const x = 2;" }

- Edit with context for uniqueness:
  { "file_path": "/path/to/file.ts",
    "old_string": "function foo() {\\n  return 1;\\n}",
    "new_string": "function foo() {\\n  return 2;\\n}" }

- Replace all occurrences:
  { "file_path": "/path/to/file.ts", "old_string": "oldName", "new_string": "newName", "replace_all": true }`,
        parameters: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "The absolute path to the file to modify"
            },
            old_string: {
              type: "string",
              description: "The exact text to find and replace"
            },
            new_string: {
              type: "string",
              description: "The text to replace it with (must be different from old_string)"
            },
            replace_all: {
              type: "boolean",
              description: "Replace all occurrences instead of requiring uniqueness (default: false)"
            }
          },
          required: ["file_path", "old_string", "new_string"]
        }
      }
    },
    describeCall: (args) => {
      const mode = args.replace_all ? " (replace all)" : "";
      return `${args.file_path}${mode}`;
    },
    execute: async (args) => {
      const { file_path, old_string, new_string, replace_all = false } = args;
      if (old_string === new_string) {
        return {
          success: false,
          error: "old_string and new_string must be different",
          path: file_path
        };
      }
      const validation = validatePath(file_path, mergedConfig);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          path: file_path
        };
      }
      const resolvedPath = validation.resolvedPath;
      if (!fs11.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `File not found: ${file_path}`,
          path: file_path
        };
      }
      try {
        const content = await fs10.readFile(resolvedPath, "utf-8");
        let occurrences = 0;
        let searchIndex = 0;
        while (true) {
          const foundIndex = content.indexOf(old_string, searchIndex);
          if (foundIndex === -1) break;
          occurrences++;
          searchIndex = foundIndex + 1;
        }
        if (occurrences === 0) {
          const trimmedOld = old_string.trim();
          const hasTrimmedMatch = content.includes(trimmedOld);
          let errorMsg = `old_string not found in file. `;
          if (hasTrimmedMatch && trimmedOld !== old_string) {
            errorMsg += `A similar string was found but with different whitespace. Check your indentation matches exactly.`;
          } else {
            errorMsg += `Make sure you're copying the exact text from the file, including all whitespace.`;
          }
          return {
            success: false,
            error: errorMsg,
            path: file_path,
            replacements: 0
          };
        }
        if (occurrences > 1 && !replace_all) {
          return {
            success: false,
            error: `old_string appears ${occurrences} times in the file. Either provide more context to make it unique, or set replace_all: true to replace all occurrences.`,
            path: file_path,
            replacements: 0
          };
        }
        let newContent;
        if (replace_all) {
          newContent = content.split(old_string).join(new_string);
        } else {
          newContent = content.replace(old_string, new_string);
        }
        await fs10.writeFile(resolvedPath, newContent, "utf-8");
        const diffPreview = generateDiffPreview(old_string, new_string);
        return {
          success: true,
          path: file_path,
          replacements: replace_all ? occurrences : 1,
          diff: diffPreview
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to edit file: ${error instanceof Error ? error.message : String(error)}`,
          path: file_path
        };
      }
    }
  };
}
function generateDiffPreview(oldStr, newStr) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const diff = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  const previewLines = Math.min(maxLines, 5);
  diff.push("--- old");
  for (let i = 0; i < Math.min(oldLines.length, previewLines); i++) {
    diff.push(`- ${oldLines[i]}`);
  }
  if (oldLines.length > previewLines) {
    diff.push(`  ... (${oldLines.length - previewLines} more lines)`);
  }
  diff.push("+++ new");
  for (let i = 0; i < Math.min(newLines.length, previewLines); i++) {
    diff.push(`+ ${newLines[i]}`);
  }
  if (newLines.length > previewLines) {
    diff.push(`  ... (${newLines.length - previewLines} more lines)`);
  }
  return diff.join("\n");
}
var editFile = createEditFileTool();
function matchGlobPattern(pattern, filePath) {
  let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "{{GLOBSTAR}}").replace(/\*/g, "[^/]*").replace(/\?/g, ".").replace(/\{\{GLOBSTAR\}\}/g, ".*");
  regexPattern = "^" + regexPattern + "$";
  try {
    const regex = new RegExp(regexPattern);
    return regex.test(filePath);
  } catch {
    return false;
  }
}
async function findFiles(dir, pattern, baseDir, config, results = [], depth = 0) {
  if (depth > 50 || results.length >= config.maxResults) {
    return results;
  }
  try {
    const entries = await fs10.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= config.maxResults) break;
      const fullPath = path3.join(dir, entry.name);
      const relativePath = path3.relative(baseDir, fullPath);
      if (entry.isDirectory()) {
        const isBlocked = config.blockedDirectories.some(
          (blocked) => entry.name === blocked || relativePath.includes(`/${blocked}/`) || relativePath.startsWith(`${blocked}/`)
        );
        if (isBlocked) continue;
        await findFiles(fullPath, pattern, baseDir, config, results, depth + 1);
      } else if (entry.isFile()) {
        if (matchGlobPattern(pattern, relativePath)) {
          try {
            const stats = await fs10.stat(fullPath);
            results.push({
              path: relativePath,
              mtime: stats.mtimeMs
            });
          } catch {
          }
        }
      }
    }
  } catch {
  }
  return results;
}
function createGlobTool(config = {}) {
  const mergedConfig = { ...DEFAULT_FILESYSTEM_CONFIG, ...config };
  return {
    definition: {
      type: "function",
      function: {
        name: "glob",
        description: `Fast file pattern matching tool that finds files by name patterns.

USAGE:
- Supports glob patterns like "**/*.js", "src/**/*.ts", "*.{ts,tsx}"
- Returns matching file paths sorted by modification time (newest first)
- Use this tool when you need to find files by name patterns

PATTERN SYNTAX:
- * matches any characters except /
- ** matches any characters including /
- ? matches a single character
- {a,b} matches either a or b

EXAMPLES:
- Find all TypeScript files: { "pattern": "**/*.ts" }
- Find files in src folder: { "pattern": "src/**/*.{ts,tsx}" }
- Find test files: { "pattern": "**/*.test.ts" }
- Find specific file type in path: { "pattern": "src/components/**/*.tsx", "path": "/project" }

WHEN TO USE:
- To find files by extension or name pattern
- To explore project structure
- To find related files (tests, types, etc.)
- Before using grep when you know the file pattern`,
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: 'The glob pattern to match files against (e.g., "**/*.ts", "src/**/*.tsx")'
            },
            path: {
              type: "string",
              description: "The directory to search in. If not specified, uses the current working directory. IMPORTANT: Omit this field to use the default directory."
            }
          },
          required: ["pattern"]
        }
      }
    },
    describeCall: (args) => {
      if (args.path) {
        return `${args.pattern} in ${args.path}`;
      }
      return args.pattern;
    },
    execute: async (args) => {
      const { pattern, path: path5 } = args;
      const searchDir = path5 || mergedConfig.workingDirectory;
      const validation = validatePath(searchDir, {
        ...mergedConfig,
        blockedDirectories: []
        // Allow searching from any valid directory
      });
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }
      const resolvedDir = validation.resolvedPath;
      if (!fs11.existsSync(resolvedDir)) {
        return {
          success: false,
          error: `Directory not found: ${searchDir}`
        };
      }
      try {
        const results = await findFiles(resolvedDir, pattern, resolvedDir, mergedConfig);
        results.sort((a, b) => b.mtime - a.mtime);
        const truncated = results.length >= mergedConfig.maxResults;
        return {
          success: true,
          files: results.map((r) => r.path),
          count: results.length,
          truncated
        };
      } catch (error) {
        return {
          success: false,
          error: `Glob search failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  };
}
var glob = createGlobTool();
var FILE_TYPE_MAP = {
  ts: [".ts", ".tsx"],
  js: [".js", ".jsx", ".mjs", ".cjs"],
  py: [".py", ".pyi"],
  java: [".java"],
  go: [".go"],
  rust: [".rs"],
  c: [".c", ".h"],
  cpp: [".cpp", ".hpp", ".cc", ".hh", ".cxx", ".hxx"],
  cs: [".cs"],
  rb: [".rb"],
  php: [".php"],
  swift: [".swift"],
  kotlin: [".kt", ".kts"],
  scala: [".scala"],
  html: [".html", ".htm"],
  css: [".css", ".scss", ".sass", ".less"],
  json: [".json"],
  yaml: [".yaml", ".yml"],
  xml: [".xml"],
  md: [".md", ".markdown"],
  sql: [".sql"],
  sh: [".sh", ".bash", ".zsh"]
};
async function findFilesToSearch(dir, baseDir, config, globPattern, fileType, files = [], depth = 0) {
  if (depth > 50 || files.length >= config.maxResults * 10) {
    return files;
  }
  try {
    const entries = await fs10.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path3.join(dir, entry.name);
      if (entry.isDirectory()) {
        const isBlocked = config.blockedDirectories.some(
          (blocked) => entry.name === blocked
        );
        if (isBlocked) continue;
        await findFilesToSearch(fullPath, baseDir, config, globPattern, fileType, files, depth + 1);
      } else if (entry.isFile()) {
        if (isExcludedExtension(entry.name, config.excludeExtensions)) continue;
        if (fileType) {
          const extensions = FILE_TYPE_MAP[fileType.toLowerCase()];
          if (extensions) {
            const ext = path3.extname(entry.name).toLowerCase();
            if (!extensions.includes(ext)) continue;
          }
        }
        if (globPattern) {
          const pattern = globPattern.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\{([^}]+)\}/g, (_, p) => `(${p.split(",").join("|")})`);
          const regex = new RegExp(pattern + "$");
          if (!regex.test(entry.name)) continue;
        }
        files.push(fullPath);
      }
    }
  } catch {
  }
  return files;
}
async function searchFile(filePath, regex, contextBefore, contextAfter) {
  const matches = [];
  try {
    const content = await fs10.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      regex.lastIndex = 0;
      if (regex.test(line)) {
        const match = {
          file: filePath,
          line: i + 1,
          content: line.length > 500 ? line.substring(0, 500) + "..." : line
        };
        if (contextBefore > 0 || contextAfter > 0) {
          match.context = {
            before: lines.slice(Math.max(0, i - contextBefore), i).map((l) => l.length > 200 ? l.substring(0, 200) + "..." : l),
            after: lines.slice(i + 1, Math.min(lines.length, i + 1 + contextAfter)).map((l) => l.length > 200 ? l.substring(0, 200) + "..." : l)
          };
        }
        matches.push(match);
      }
    }
  } catch {
  }
  return matches;
}
function createGrepTool(config = {}) {
  const mergedConfig = { ...DEFAULT_FILESYSTEM_CONFIG, ...config };
  return {
    definition: {
      type: "function",
      function: {
        name: "grep",
        description: `A powerful search tool for finding content within files.

USAGE:
- Search for patterns using full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py")
- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths, "count" shows match counts

PATTERN SYNTAX:
- Uses JavaScript regex syntax (not grep)
- Literal braces need escaping (use \\{ and \\} to find { and })
- Common patterns:
  - "TODO" - literal text
  - "function\\s+\\w+" - function declarations
  - "import.*from" - import statements
  - "\\bclass\\b" - word boundary matching

OUTPUT MODES:
- "content" - Shows matching lines with line numbers (default)
- "files_with_matches" - Shows only file paths that contain matches
- "count" - Shows match counts per file

EXAMPLES:
- Find TODO comments: { "pattern": "TODO|FIXME", "type": "ts" }
- Find function calls: { "pattern": "fetchUser\\(", "glob": "*.ts" }
- Find imports: { "pattern": "import.*react", "case_insensitive": true }
- List files with errors: { "pattern": "error", "output_mode": "files_with_matches" }
- Count matches: { "pattern": "console\\.log", "output_mode": "count" }

WHEN TO USE:
- To find where something is defined or used
- To search for patterns across multiple files
- To find all occurrences of a term
- Before making bulk changes`,
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "The regex pattern to search for in file contents"
            },
            path: {
              type: "string",
              description: "File or directory to search in. Defaults to current working directory."
            },
            glob: {
              type: "string",
              description: 'Glob pattern to filter files (e.g., "*.js", "*.{ts,tsx}")'
            },
            type: {
              type: "string",
              description: 'File type to search (e.g., "ts", "js", "py", "java", "go"). More efficient than glob.'
            },
            output_mode: {
              type: "string",
              enum: ["content", "files_with_matches", "count"],
              description: 'Output mode: "content" shows lines, "files_with_matches" shows paths, "count" shows counts. Default: "files_with_matches"'
            },
            case_insensitive: {
              type: "boolean",
              description: "Case insensitive search (default: false)"
            },
            context_before: {
              type: "number",
              description: 'Number of lines to show before each match (requires output_mode: "content")'
            },
            context_after: {
              type: "number",
              description: 'Number of lines to show after each match (requires output_mode: "content")'
            },
            limit: {
              type: "number",
              description: "Limit output to first N results. Default: unlimited."
            }
          },
          required: ["pattern"]
        }
      }
    },
    describeCall: (args) => {
      const parts = [`"${args.pattern}"`];
      if (args.glob) parts.push(`in ${args.glob}`);
      else if (args.type) parts.push(`in *.${args.type}`);
      if (args.path) parts.push(`(${args.path})`);
      return parts.join(" ");
    },
    execute: async (args) => {
      const {
        pattern,
        path: path5,
        glob: globPattern,
        type: fileType,
        output_mode = "files_with_matches",
        case_insensitive = false,
        context_before = 0,
        context_after = 0,
        limit
      } = args;
      const searchPath = path5 || mergedConfig.workingDirectory;
      const validation = validatePath(searchPath, {
        ...mergedConfig,
        blockedDirectories: []
        // Allow grep from any valid directory
      });
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }
      const resolvedPath = validation.resolvedPath;
      if (!fs11.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `Path not found: ${searchPath}`
        };
      }
      let regex;
      try {
        regex = new RegExp(pattern, case_insensitive ? "gi" : "g");
      } catch (error) {
        return {
          success: false,
          error: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`
        };
      }
      try {
        const stats = await fs10.stat(resolvedPath);
        let filesToSearch;
        if (stats.isFile()) {
          filesToSearch = [resolvedPath];
        } else {
          filesToSearch = await findFilesToSearch(
            resolvedPath,
            resolvedPath,
            mergedConfig,
            globPattern,
            fileType
          );
        }
        const allMatches = [];
        const fileMatchCounts = /* @__PURE__ */ new Map();
        let filesMatched = 0;
        for (const file of filesToSearch) {
          if (limit && allMatches.length >= limit) break;
          const matches = await searchFile(
            file,
            regex,
            output_mode === "content" ? context_before : 0,
            output_mode === "content" ? context_after : 0
          );
          if (matches.length > 0) {
            filesMatched++;
            const relativePath = path3.relative(resolvedPath, file) || file;
            for (const match of matches) {
              match.file = relativePath;
            }
            fileMatchCounts.set(relativePath, matches.length);
            if (output_mode === "content") {
              const remaining = limit ? limit - allMatches.length : Infinity;
              allMatches.push(...matches.slice(0, remaining));
            } else {
              const firstMatch = matches[0];
              if (firstMatch) {
                allMatches.push(firstMatch);
              }
            }
          }
        }
        let resultMatches;
        switch (output_mode) {
          case "files_with_matches":
            const uniqueFiles = new Set(allMatches.map((m) => m.file));
            resultMatches = Array.from(uniqueFiles).map((file) => ({
              file,
              line: 0,
              content: ""
            }));
            break;
          case "count":
            resultMatches = Array.from(fileMatchCounts.entries()).map(([file, count]) => ({
              file,
              line: count,
              content: `${count} matches`
            }));
            break;
          case "content":
          default:
            resultMatches = allMatches;
        }
        const totalMatches = Array.from(fileMatchCounts.values()).reduce((a, b) => a + b, 0);
        const truncated = limit ? allMatches.length >= limit : totalMatches >= mergedConfig.maxResults;
        return {
          success: true,
          matches: resultMatches,
          filesSearched: filesToSearch.length,
          filesMatched,
          totalMatches,
          truncated
        };
      } catch (error) {
        return {
          success: false,
          error: `Grep search failed: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  };
}
var grep = createGrepTool();
async function listDir(dir, baseDir, config, recursive, filter, maxDepth = 3, currentDepth = 0, entries = []) {
  if (currentDepth > maxDepth || entries.length >= config.maxResults) {
    return entries;
  }
  try {
    const dirEntries = await fs10.readdir(dir, { withFileTypes: true });
    for (const entry of dirEntries) {
      if (entries.length >= config.maxResults) break;
      const fullPath = path3.join(dir, entry.name);
      const relativePath = path3.relative(baseDir, fullPath);
      if (entry.isDirectory() && config.blockedDirectories.includes(entry.name)) {
        continue;
      }
      const isFile = entry.isFile();
      const isDir = entry.isDirectory();
      if (filter === "files" && !isFile) {
        if (isDir && recursive) {
          await listDir(fullPath, baseDir, config, recursive, filter, maxDepth, currentDepth + 1, entries);
        }
        continue;
      }
      if (filter === "directories" && !isDir) continue;
      try {
        const stats = await fs10.stat(fullPath);
        const dirEntry = {
          name: entry.name,
          path: relativePath,
          type: isFile ? "file" : "directory"
        };
        if (isFile) {
          dirEntry.size = stats.size;
        }
        dirEntry.modified = stats.mtime.toISOString();
        entries.push(dirEntry);
        if (isDir && recursive) {
          await listDir(fullPath, baseDir, config, recursive, filter, maxDepth, currentDepth + 1, entries);
        }
      } catch {
      }
    }
  } catch {
  }
  return entries;
}
function createListDirectoryTool(config = {}) {
  const mergedConfig = { ...DEFAULT_FILESYSTEM_CONFIG, ...config };
  return {
    definition: {
      type: "function",
      function: {
        name: "list_directory",
        description: `List the contents of a directory on the local filesystem.

USAGE:
- Shows files and directories in the specified path
- Includes file sizes and modification times
- Can list recursively with depth limit
- Can filter to show only files or only directories

WHEN TO USE:
- To explore a project's structure
- To see what files exist in a directory
- To find files before using read_file or edit_file
- As an alternative to glob when you want to see directory structure

EXAMPLES:
- List current directory: { "path": "." }
- List specific directory: { "path": "/path/to/project/src" }
- List recursively: { "path": ".", "recursive": true, "max_depth": 2 }
- List only files: { "path": ".", "filter": "files" }
- List only directories: { "path": ".", "filter": "directories" }`,
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the directory to list"
            },
            recursive: {
              type: "boolean",
              description: "Whether to list recursively (default: false)"
            },
            filter: {
              type: "string",
              enum: ["files", "directories"],
              description: "Filter to show only files or only directories"
            },
            max_depth: {
              type: "number",
              description: "Maximum depth for recursive listing (default: 3)"
            }
          },
          required: ["path"]
        }
      }
    },
    describeCall: (args) => {
      const flags = [];
      if (args.recursive) flags.push("recursive");
      if (args.filter) flags.push(args.filter);
      if (flags.length > 0) {
        return `${args.path} (${flags.join(", ")})`;
      }
      return args.path;
    },
    execute: async (args) => {
      const { path: path5, recursive = false, filter, max_depth = 3 } = args;
      const validation = validatePath(path5, {
        ...mergedConfig,
        blockedDirectories: []
        // Allow listing any valid directory
      });
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error
        };
      }
      const resolvedPath = validation.resolvedPath;
      if (!fs11.existsSync(resolvedPath)) {
        return {
          success: false,
          error: `Directory not found: ${path5}`
        };
      }
      try {
        const stats = await fs10.stat(resolvedPath);
        if (!stats.isDirectory()) {
          return {
            success: false,
            error: `Path is not a directory: ${path5}. Use read_file to read file contents.`
          };
        }
        const entries = await listDir(
          resolvedPath,
          resolvedPath,
          mergedConfig,
          recursive,
          filter,
          max_depth
        );
        entries.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === "directory" ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        const truncated = entries.length >= mergedConfig.maxResults;
        return {
          success: true,
          entries,
          count: entries.length,
          truncated
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list directory: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  };
}
var listDirectory = createListDirectoryTool();

// src/tools/shell/types.ts
var DEFAULT_SHELL_CONFIG = {
  workingDirectory: process.cwd(),
  defaultTimeout: 12e4,
  // 2 minutes
  maxTimeout: 6e5,
  // 10 minutes
  shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
  env: {},
  blockedCommands: [
    "rm -rf /",
    "rm -rf /*",
    "rm -rf ~",
    "rm -rf ~/*",
    "mkfs",
    "dd if=/dev/zero",
    ":(){:|:&};:"
    // Fork bomb
  ],
  blockedPatterns: [
    /rm\s+(-rf?|--recursive)\s+\/(?!\S)/i,
    // rm -rf / variations
    />\s*\/dev\/sd[a-z]/i,
    // Writing to disk devices
    /mkfs/i,
    /dd\s+.*of=\/dev\//i
    // dd to devices
  ],
  maxOutputSize: 1e5,
  allowBackground: true
};
function isBlockedCommand(command, config = {}) {
  const blockedCommands = config.blockedCommands || DEFAULT_SHELL_CONFIG.blockedCommands;
  const blockedPatterns = config.blockedPatterns || DEFAULT_SHELL_CONFIG.blockedPatterns;
  for (const blocked of blockedCommands) {
    if (command.includes(blocked)) {
      return { blocked: true, reason: `Command contains blocked sequence: "${blocked}"` };
    }
  }
  for (const pattern of blockedPatterns) {
    if (pattern.test(command)) {
      return { blocked: true, reason: `Command matches blocked pattern` };
    }
  }
  return { blocked: false };
}
var backgroundProcesses = /* @__PURE__ */ new Map();
function generateBackgroundId() {
  return `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function createBashTool(config = {}) {
  const mergedConfig = { ...DEFAULT_SHELL_CONFIG, ...config };
  return {
    definition: {
      type: "function",
      function: {
        name: "bash",
        description: `Execute shell commands with optional timeout.

USAGE:
- Execute any shell command
- Working directory persists between commands
- Commands timeout after 2 minutes by default (configurable up to 10 minutes)
- Large outputs (>100KB) will be truncated

IMPORTANT: This tool is for terminal operations like git, npm, docker, etc.
For file operations, prefer dedicated tools:
- Use read_file instead of cat/head/tail
- Use edit_file instead of sed/awk
- Use write_file instead of echo with redirection
- Use glob instead of find
- Use grep tool instead of grep command

BEST PRACTICES:
- Always quote file paths with spaces: cd "/path with spaces"
- Use absolute paths when possible
- Chain dependent commands with &&: git add . && git commit -m "msg"
- Use ; only when you don't care if earlier commands fail
- Avoid interactive commands (no -i flags)

GIT SAFETY:
- NEVER run destructive commands (push --force, reset --hard, clean -f) without explicit permission
- NEVER update git config
- NEVER skip hooks (--no-verify) without permission
- Always create NEW commits rather than amending
- Stage specific files rather than using "git add -A"

EXAMPLES:
- Run npm install: { "command": "npm install", "description": "Install dependencies" }
- Check git status: { "command": "git status", "description": "Show working tree status" }
- Run tests: { "command": "npm test", "timeout": 300000, "description": "Run test suite" }
- Build project: { "command": "npm run build", "description": "Build the project" }`,
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The shell command to execute"
            },
            timeout: {
              type: "number",
              description: "Optional timeout in milliseconds (max 600000ms / 10 minutes)"
            },
            description: {
              type: "string",
              description: "Clear, concise description of what this command does"
            },
            run_in_background: {
              type: "boolean",
              description: "Run the command in the background. Returns immediately with a background ID."
            }
          },
          required: ["command"]
        }
      }
    },
    describeCall: (args) => {
      const cmd = args.command;
      const maxLen = 60;
      const prefix = args.run_in_background ? "[bg] " : "";
      if (cmd.length > maxLen - prefix.length) {
        return prefix + cmd.slice(0, maxLen - prefix.length - 3) + "...";
      }
      return prefix + cmd;
    },
    execute: async (args) => {
      const {
        command,
        timeout = mergedConfig.defaultTimeout,
        run_in_background = false
      } = args;
      const blockCheck = isBlockedCommand(command, mergedConfig);
      if (blockCheck.blocked) {
        return {
          success: false,
          error: `Command blocked for safety: ${blockCheck.reason}`
        };
      }
      const effectiveTimeout = Math.min(timeout, mergedConfig.maxTimeout);
      const env = {
        ...process.env,
        ...mergedConfig.env
      };
      return new Promise((resolve3) => {
        const startTime = Date.now();
        const childProcess = child_process.spawn(command, [], {
          shell: mergedConfig.shell,
          cwd: mergedConfig.workingDirectory,
          env,
          stdio: ["pipe", "pipe", "pipe"]
        });
        if (run_in_background && mergedConfig.allowBackground) {
          const bgId = generateBackgroundId();
          const output = [];
          backgroundProcesses.set(bgId, { process: childProcess, output });
          childProcess.stdout.on("data", (data) => {
            output.push(data.toString());
          });
          childProcess.stderr.on("data", (data) => {
            output.push(data.toString());
          });
          childProcess.on("close", () => {
            setTimeout(() => {
              backgroundProcesses.delete(bgId);
            }, 3e5);
          });
          resolve3({
            success: true,
            backgroundId: bgId,
            stdout: `Command started in background with ID: ${bgId}`
          });
          return;
        }
        let stdout = "";
        let stderr = "";
        let killed = false;
        const timeoutId = setTimeout(() => {
          killed = true;
          childProcess.kill("SIGTERM");
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill("SIGKILL");
            }
          }, 5e3);
        }, effectiveTimeout);
        childProcess.stdout.on("data", (data) => {
          stdout += data.toString();
          if (stdout.length > mergedConfig.maxOutputSize * 2) {
            stdout = stdout.slice(-mergedConfig.maxOutputSize);
          }
        });
        childProcess.stderr.on("data", (data) => {
          stderr += data.toString();
          if (stderr.length > mergedConfig.maxOutputSize * 2) {
            stderr = stderr.slice(-mergedConfig.maxOutputSize);
          }
        });
        childProcess.on("close", (code, signal) => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          let truncated = false;
          if (stdout.length > mergedConfig.maxOutputSize) {
            stdout = stdout.slice(0, mergedConfig.maxOutputSize) + "\n... (output truncated)";
            truncated = true;
          }
          if (stderr.length > mergedConfig.maxOutputSize) {
            stderr = stderr.slice(0, mergedConfig.maxOutputSize) + "\n... (output truncated)";
            truncated = true;
          }
          if (killed) {
            resolve3({
              success: false,
              stdout,
              stderr,
              exitCode: code ?? void 0,
              signal: signal ?? void 0,
              duration,
              truncated,
              error: `Command timed out after ${effectiveTimeout}ms`
            });
          } else {
            resolve3({
              success: code === 0,
              stdout,
              stderr,
              exitCode: code ?? void 0,
              signal: signal ?? void 0,
              duration,
              truncated,
              error: code !== 0 ? `Command exited with code ${code}` : void 0
            });
          }
        });
        childProcess.on("error", (error) => {
          clearTimeout(timeoutId);
          resolve3({
            success: false,
            error: `Failed to execute command: ${error.message}`,
            duration: Date.now() - startTime
          });
        });
      });
    }
  };
}
function getBackgroundOutput(bgId) {
  const bg = backgroundProcesses.get(bgId);
  if (!bg) {
    return { found: false };
  }
  return {
    found: true,
    output: bg.output.join(""),
    running: !bg.process.killed && bg.process.exitCode === null
  };
}
function killBackgroundProcess(bgId) {
  const bg = backgroundProcesses.get(bgId);
  if (!bg) {
    return false;
  }
  bg.process.kill("SIGTERM");
  return true;
}
var bash = createBashTool();

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
      const $ = cheerio.load(html);
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
      const $ = cheerio.load(html);
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

// src/tools/web/webSearch.ts
init_Connector();
init_Logger();

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
var searchLogger = exports.logger.child({ component: "webSearch" });
var webSearch = {
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description: `Search the web and get relevant results with snippets.

This tool searches the web using a configured search provider via Connector.

CONNECTOR SETUP (Recommended):
Create a connector for your search provider:

// Serper (Google search)
Connector.create({
  name: 'serper-main',
  serviceType: 'serper',
  auth: { type: 'api_key', apiKey: process.env.SERPER_API_KEY! },
  baseURL: 'https://google.serper.dev',
});

// Brave (Independent index)
Connector.create({
  name: 'brave-main',
  serviceType: 'brave-search',
  auth: { type: 'api_key', apiKey: process.env.BRAVE_API_KEY! },
  baseURL: 'https://api.search.brave.com/res/v1',
});

// Tavily (AI-optimized)
Connector.create({
  name: 'tavily-main',
  serviceType: 'tavily',
  auth: { type: 'api_key', apiKey: process.env.TAVILY_API_KEY! },
  baseURL: 'https://api.tavily.com',
});

// RapidAPI (Real-time web search)
Connector.create({
  name: 'rapidapi-search',
  serviceType: 'rapidapi-search',
  auth: { type: 'api_key', apiKey: process.env.RAPIDAPI_KEY! },
  baseURL: 'https://real-time-web-search.p.rapidapi.com',
});

SEARCH PROVIDERS:
- serper: Google search results via Serper.dev. Fast (1-2s), 2,500 free queries.
- brave-search: Brave's independent search index. Privacy-focused, no Google.
- tavily: AI-optimized search with summaries tailored for LLMs.
- rapidapi-search: Real-time web search via RapidAPI. Wide coverage.

RETURNS:
An array of up to 10-100 search results (provider-specific), each containing:
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
Using connector (recommended):
{
  query: "latest AI developments 2026",
  connectorName: "serper-main",
  numResults: 5,
  country: "us",
  language: "en"
}

Backward compatible (uses environment variables):
{
  query: "quantum computing news",
  provider: "brave",
  numResults: 10
}

IMPORTANT:
- Connector approach provides retry, circuit breaker, and timeout features
- Supports multiple keys per vendor (e.g., 'serper-main', 'serper-backup')
- Backward compatible with environment variable approach`,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query string. Be specific for better results."
          },
          numResults: {
            type: "number",
            description: "Number of results to return (default: 10, max: provider-specific). More results = more API cost."
          },
          connectorName: {
            type: "string",
            description: 'Connector name to use for search (e.g., "serper-main", "brave-backup"). Recommended approach.'
          },
          provider: {
            type: "string",
            enum: ["serper", "brave", "tavily", "rapidapi"],
            description: "DEPRECATED: Use connectorName instead. Provider for backward compatibility with environment variables."
          },
          country: {
            type: "string",
            description: 'Country/region code (e.g., "us", "gb")'
          },
          language: {
            type: "string",
            description: 'Language code (e.g., "en", "fr")'
          }
        },
        required: ["query"]
      }
    },
    blocking: true,
    timeout: 1e4
  },
  execute: async (args) => {
    const numResults = args.numResults || 10;
    if (args.connectorName) {
      return await executeWithConnector(args, numResults);
    }
    if (args.provider) {
      return await executeWithProvider(args, numResults);
    }
    const availableConnector = findAvailableSearchConnector();
    if (availableConnector) {
      return await executeWithConnector(
        { ...args, connectorName: availableConnector },
        numResults
      );
    }
    return await executeWithProvider({ ...args, provider: "serper" }, numResults);
  }
};
async function executeWithConnector(args, numResults) {
  searchLogger.debug({ connectorName: args.connectorName }, "Starting search with connector");
  try {
    const connector = exports.Connector.get(args.connectorName);
    searchLogger.debug({
      connectorFound: !!connector,
      serviceType: connector?.serviceType
    }, "Connector lookup result");
    const searchProvider = SearchProvider.create({ connector: args.connectorName });
    searchLogger.debug({ provider: searchProvider.name }, "SearchProvider created");
    searchLogger.debug({ query: args.query, numResults }, "Executing search");
    const response = await searchProvider.search(args.query, {
      numResults,
      country: args.country,
      language: args.language
    });
    if (response.success) {
      searchLogger.debug({
        success: true,
        count: response.count,
        firstResultTitle: response.results[0]?.title,
        firstResultUrl: response.results[0]?.url
      }, "Search completed successfully");
    } else {
      searchLogger.warn({
        success: false,
        error: response.error,
        provider: response.provider
      }, "Search failed");
    }
    return {
      success: response.success,
      query: response.query,
      provider: response.provider,
      results: response.results,
      count: response.count,
      error: response.error
    };
  } catch (error) {
    searchLogger.error({
      error: error.message,
      stack: error.stack,
      connectorName: args.connectorName
    }, "Search threw exception");
    return {
      success: false,
      query: args.query,
      provider: args.connectorName || "unknown",
      results: [],
      count: 0,
      error: error.message || "Unknown error"
    };
  }
}
async function executeWithProvider(args, numResults) {
  const provider = args.provider || "serper";
  const apiKey = getSearchAPIKey(provider);
  if (!apiKey) {
    return {
      success: false,
      query: args.query,
      provider,
      results: [],
      count: 0,
      error: `No API key found for ${provider}. Set ${getEnvVarName(provider)} in your .env file, or use connectorName with a Connector. See .env.example for details.`
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
      case "rapidapi":
        throw new Error(
          "RapidAPI provider requires Connector. Use connectorName with a rapidapi-search connector."
        );
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
function findAvailableSearchConnector() {
  const allConnectors = exports.Connector.list();
  for (const connectorName of allConnectors) {
    const connector = exports.Connector.get(connectorName);
    if (connector?.serviceType && ["serper", "brave-search", "tavily", "rapidapi-search"].includes(connector.serviceType)) {
      return connectorName;
    }
  }
  return void 0;
}
function getSearchAPIKey(provider) {
  switch (provider) {
    case "serper":
      return process.env.SERPER_API_KEY;
    case "brave":
      return process.env.BRAVE_API_KEY;
    case "tavily":
      return process.env.TAVILY_API_KEY;
    case "rapidapi":
      return process.env.RAPIDAPI_KEY;
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
    case "rapidapi":
      return "RAPIDAPI_KEY";
    default:
      return "UNKNOWN_API_KEY";
  }
}

// src/tools/web/webScrape.ts
init_Connector();

// src/tools/code/executeJavaScript.ts
init_Connector();
function generateDescription() {
  const connectors = exports.Connector.listAll();
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
      list: () => exports.Connector.list(),
      get: (name) => {
        try {
          const connector = exports.Connector.get(name);
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
  const context = vm__namespace.createContext(sandbox);
  const wrappedCode = code.trim().startsWith("(async") ? code : `
    (async () => {
      ${code}
      return output;
    })()
  `;
  const script = new vm__namespace.Script(wrappedCode);
  const resultPromise = script.runInContext(context, {
    timeout,
    displayErrors: true
  });
  const result = await resultPromise;
  return result;
}

// src/tools/index.ts
var developerTools = [
  readFile4,
  writeFile4,
  editFile,
  glob,
  grep,
  listDirectory,
  bash
];

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
var ModeManager = class extends eventemitter3.EventEmitter {
  state;
  transitionHistory = [];
  _isDestroyed = false;
  constructor(initialMode = "interactive") {
    super();
    this.state = {
      mode: initialMode,
      enteredAt: /* @__PURE__ */ new Date(),
      reason: "initial"
    };
  }
  /**
   * Returns true if destroy() has been called.
   */
  get isDestroyed() {
    return this._isDestroyed;
  }
  /**
   * Releases all resources held by this ModeManager.
   * Removes all event listeners.
   * Safe to call multiple times (idempotent).
   */
  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    this.transitionHistory = [];
    this.removeAllListeners();
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
var UniversalAgent = class _UniversalAgent extends BaseAgent {
  // Core components
  agent;
  // Interactive agent (with meta-tools)
  executionAgent;
  // Execution agent (without meta-tools) - created on demand
  modeManager;
  planningAgent;
  // Plugins for inherited AgentContext (from BaseAgent)
  // Note: _agentContext is inherited from BaseAgent (single source of truth)
  _planPlugin;
  _memoryPlugin;
  // Execution state
  currentPlan = null;
  executionHistory = [];
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
    await agent.ensureSessionLoaded();
    return agent;
  }
  // ============================================================================
  // Constructor
  // ============================================================================
  constructor(config) {
    super(config, "UniversalAgent");
    const metaTools = getMetaTools();
    for (const tool of metaTools) {
      this._agentContext.tools.register(tool, { namespace: "_meta" });
    }
    this._agentContext.systemPrompt = this.buildInstructions(config.instructions);
    const allTools = this._agentContext.tools.getEnabled();
    this.agent = Agent.create({
      connector: config.connector,
      model: config.model,
      tools: allTools,
      instructions: this.buildInstructions(config.instructions),
      temperature: config.temperature,
      maxIterations: config.maxIterations ?? 20,
      permissions: config.permissions,
      context: this._agentContext
      // Share inherited AgentContext
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
        availableTools: this._agentContext.tools.getEnabled().filter((t) => !isMetaTool(t.definition.function.name))
      });
    }
    this.executionAgent = this.createExecutionAgent();
    this._planPlugin = new PlanPlugin();
    this._memoryPlugin = new MemoryPlugin(this._agentContext.memory);
    this._agentContext.registerPlugin(this._planPlugin);
    this._agentContext.registerPlugin(this._memoryPlugin);
    this.initializeSession(config.session);
  }
  // ============================================================================
  // Abstract Method Implementations
  // ============================================================================
  getAgentType() {
    return "universal-agent";
  }
  prepareSessionState() {
    if (this._session) {
      this._session.mode = this.modeManager.getMode();
      this._session.custom["modeState"] = this.modeManager.serialize();
      this._session.custom["executionHistory"] = this.executionHistory;
    }
  }
  async restoreSessionState(session) {
    if (session.custom["modeState"]) {
      this.modeManager.restore(session.custom["modeState"]);
    }
    if (session.plan?.data) {
      this.currentPlan = session.plan.data;
      this._planPlugin.setPlan(this.currentPlan);
    }
    if (session.custom["executionHistory"]) {
      this.executionHistory = session.custom["executionHistory"];
    }
    if (session.custom["agentContextState"]) {
      await this._agentContext.restoreState(session.custom["agentContextState"]);
    }
    this._logger.debug({ sessionId: session.id }, "UniversalAgent session state restored");
  }
  getSerializedPlan() {
    if (!this.currentPlan) {
      return void 0;
    }
    return {
      version: 1,
      data: this.currentPlan
    };
  }
  // Override saveSession to handle async AgentContext serialization
  async saveSession() {
    await this.ensureSessionLoaded();
    if (!this._sessionManager || !this._session) {
      throw new Error(
        "Session not enabled. Configure session in agent config to use this feature."
      );
    }
    this._session.toolState = this._agentContext.tools.getState();
    this._session.custom["approvalState"] = this._permissionManager.getState();
    const plan = this.getSerializedPlan();
    if (plan) {
      this._session.plan = plan;
    }
    this._session.custom["agentContextState"] = await this._agentContext.getState();
    this.prepareSessionState();
    await this._sessionManager.save(this._session);
    this._logger.debug({ sessionId: this._session.id }, "UniversalAgent session saved");
  }
  // ============================================================================
  // Main API
  // ============================================================================
  /**
   * Chat with the agent - the main entry point
   */
  async chat(input) {
    if (this._isDestroyed) {
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
    if (this._config.session?.autoSave && this._session) {
      await this.saveSession().catch(() => {
      });
    }
    return response;
  }
  /**
   * Stream chat response
   */
  async *stream(input) {
    if (this._isDestroyed) {
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
    await this.addToConversationHistory("user", input);
    const shouldPlan = this.shouldSwitchToPlanning(intent);
    if (shouldPlan) {
      this.modeManager.enterPlanning("complex_task_detected");
      return this.handlePlanning(input, intent);
    }
    const contextualInput = await this.buildFullContext(input);
    const response = await this.agent.run(contextualInput);
    const planningToolCall = response.output.find(
      (item) => item.type === "tool_use" && item.name === META_TOOL_NAMES.START_PLANNING
    );
    if (planningToolCall) {
      this.modeManager.enterPlanning("agent_requested");
      const rawInput = planningToolCall.input;
      const args = typeof rawInput === "string" ? JSON.parse(rawInput || "{}") : rawInput || {};
      return this.createPlan(args.goal, args.reasoning);
    }
    const responseText = response.output_text ?? "";
    await this.addToConversationHistory("assistant", responseText);
    return {
      text: responseText,
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
      await this._agentContext.memory.store(
        `user_feedback_${Date.now()}`,
        "User feedback during execution",
        input,
        { scope: "persistent" }
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
    await this.addToConversationHistory("user", input);
    if (this.shouldSwitchToPlanning(intent)) {
      const from = this.modeManager.getMode();
      this.modeManager.enterPlanning("complex_task_detected");
      yield { type: "mode:changed", from, to: "planning", reason: "complex_task_detected" };
      yield* this.streamPlanning(input, intent);
      return;
    }
    const contextualInput = await this.buildFullContext(input);
    let fullText = "";
    for await (const event of this.agent.stream(contextualInput)) {
      if (event.type === "response.output_text.delta" /* OUTPUT_TEXT_DELTA */) {
        const delta = event.delta || "";
        fullText += delta;
        yield { type: "text:delta", delta };
      } else if (event.type === "response.tool_execution.start" /* TOOL_EXECUTION_START */) {
        yield { type: "tool:start", name: event.tool_name || "unknown", args: event.arguments || null };
      } else if (event.type === "response.tool_execution.done" /* TOOL_EXECUTION_DONE */) {
        yield { type: "tool:complete", name: event.tool_name || "unknown", result: event.result, durationMs: event.execution_time_ms || 0 };
      }
    }
    await this.addToConversationHistory("assistant", fullText);
    yield { type: "text:done", text: fullText };
  }
  async *streamPlanning(input, intent) {
    if (intent.type !== "approval") {
      await this.addToConversationHistory("user", input);
    }
    if (intent.type === "approval" && this.modeManager.getPendingPlan()) {
      const plan2 = this.modeManager.getPendingPlan();
      this.modeManager.approvePlan();
      yield { type: "plan:approved", plan: plan2 };
      await this.addToConversationHistory("assistant", `Plan approved. Starting execution of ${plan2.tasks.length} tasks.`);
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
    if (this._config.planning?.requireApproval !== false) {
      yield { type: "plan:awaiting_approval", plan };
      yield { type: "needs:approval", plan };
      const summary = this.formatPlanSummary(plan);
      await this.addToConversationHistory("assistant", summary);
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
    if (!this.executionAgent) {
      this.executionAgent = this.createExecutionAgent();
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
        const prompt = this.buildTaskPromptWithContext(task, i);
        let taskResultText = "";
        for await (const event of this.executionAgent.stream(prompt)) {
          if (event.type === "response.output_text.delta" /* OUTPUT_TEXT_DELTA */) {
            const delta = event.delta || "";
            taskResultText += delta;
            yield { type: "task:progress", task, status: delta };
          } else if (event.type === "response.tool_execution.start" /* TOOL_EXECUTION_START */) {
            yield { type: "tool:start", name: event.tool_name || "unknown", args: event.arguments || null };
          } else if (event.type === "response.tool_execution.done" /* TOOL_EXECUTION_DONE */) {
            yield { type: "tool:complete", name: event.tool_name || "unknown", result: event.result, durationMs: event.execution_time_ms || 0 };
          }
        }
        task.status = "completed";
        task.completedAt = Date.now();
        task.result = { success: true, output: taskResultText };
        completedTasks++;
        await this.addToConversationHistory("assistant", `Completed task "${task.name}": ${taskResultText.substring(0, 200)}${taskResultText.length > 200 ? "..." : ""}`);
        yield { type: "task:completed", task, result: taskResultText };
      } catch (error) {
        task.status = "failed";
        const errorMsg = error instanceof Error ? error.message : String(error);
        task.result = { success: false, error: errorMsg };
        failedTasks++;
        await this.addToConversationHistory("assistant", `Task "${task.name}" failed: ${errorMsg}`);
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
    const finalResponse = this.generateExecutionSummary(tasks);
    yield { type: "text:delta", delta: "\n" + finalResponse };
    yield { type: "text:done", text: finalResponse };
    await this.addToConversationHistory("assistant", finalResponse);
    yield { type: "execution:done", result };
    this.modeManager.returnToInteractive("execution_completed");
    yield { type: "mode:changed", from: "executing", to: "interactive", reason: "execution_completed" };
    this.emit("execution:completed", { result });
  }
  /**
   * Generate a user-facing summary from task execution results.
   * Returns the output of the last successful task, or a status summary if all failed.
   */
  generateExecutionSummary(tasks) {
    const completedTasks = tasks.filter((t) => t.status === "completed" && t.result?.output);
    if (completedTasks.length > 0) {
      const lastTask = completedTasks[completedTasks.length - 1];
      if (lastTask && lastTask.result?.output) {
        const output = lastTask.result.output;
        return typeof output === "string" ? output : JSON.stringify(output, null, 2);
      }
    }
    const failedTasks = tasks.filter((t) => t.status === "failed");
    if (failedTasks.length > 0) {
      const errors = failedTasks.map((t) => `- ${t.name}: ${t.result?.error || "Unknown error"}`).join("\n");
      return `Plan execution encountered errors:
${errors}`;
    }
    return "Plan execution completed but no output was generated.";
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
    const requireApproval = this._config.planning?.requireApproval !== false;
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
  /**
   * Check if the input is a simple single-tool request that shouldn't trigger planning.
   * These are common patterns like web searches, lookups, etc.
   */
  isSingleToolRequest(input) {
    const lowerInput = input.toLowerCase();
    const singleToolPatterns = [
      // Web search patterns
      /^(search|google|look\s*up|find)\s+(the\s+)?(web|internet|online)?\s*(for|about)?\s+/i,
      /^(search|find|look\s*up)\s+/i,
      /^what\s+(is|are|was|were)\s+/i,
      /^who\s+(is|are|was|were)\s+/i,
      /^where\s+(is|are|was|were)\s+/i,
      /^when\s+(did|was|were|is)\s+/i,
      /^how\s+(do|does|did|to|much|many)\s+/i,
      // Web fetch patterns
      /^(fetch|get|read|open|visit|go\s+to)\s+(the\s+)?(url|page|website|site|link)/i,
      /^(fetch|get|scrape)\s+https?:\/\//i,
      // Simple calculations/lookups
      /^(calculate|compute|what\s+is)\s+\d/i,
      /^(tell\s+me|show\s+me|give\s+me)\s+(about|the)/i,
      // Summary requests (still single action)
      /^(summarize|summary\s+of)\s+/i
    ];
    if (singleToolPatterns.some((p) => p.test(lowerInput))) {
      return true;
    }
    const presentationSuffixes = /\s+and\s+(show|display|give|tell|present|list|summarize|provide)\s+(me\s+)?(the\s+)?(results?|summary|findings?|answer|info|information)/i;
    if (presentationSuffixes.test(lowerInput)) {
      return true;
    }
    return false;
  }
  estimateComplexity(input) {
    if (this.isSingleToolRequest(input)) {
      return "low";
    }
    const words = input.split(/\s+/).length;
    const lowerInput = input.toLowerCase();
    const actionVerbs = [
      "search",
      "find",
      "create",
      "build",
      "write",
      "send",
      "email",
      "delete",
      "update",
      "fetch",
      "scrape",
      "download",
      "upload",
      "install",
      "deploy",
      "configure",
      "setup",
      "migrate",
      "refactor",
      "analyze",
      "compare",
      "merge",
      "split",
      "convert",
      "transform"
    ];
    const foundVerbs = actionVerbs.filter((v) => new RegExp(`\\b${v}\\b`, "i").test(lowerInput));
    const hasMultipleDistinctActions = foundVerbs.length >= 2;
    const hasComplexKeywords = /\b(build|create|implement|design|develop|setup|configure|migrate|refactor|deploy|integrate)\b/i.test(lowerInput);
    const hasSequentialKeywords = /\b(then|after\s+that|next|finally|first\s+.+\s+then|step\s+\d)\b/i.test(lowerInput);
    if (words > 50 || hasMultipleDistinctActions && hasSequentialKeywords) {
      return "high";
    }
    if (hasMultipleDistinctActions || hasComplexKeywords && words > 15) {
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
    if (this._config.planning?.enabled !== false && this._config.planning?.autoDetect !== false) {
      return intent.type === "complex" && (intent.complexity === "high" || intent.complexity === "medium");
    }
    return false;
  }
  // ============================================================================
  // Execution Agent (without meta-tools)
  // ============================================================================
  /**
   * Create a separate agent for task execution that doesn't have meta-tools.
   * This prevents the agent from calling _start_planning during task execution.
   */
  createExecutionAgent() {
    const userTools = this._agentContext.tools.getEnabled().filter((t) => !isMetaTool(t.definition.function.name));
    return Agent.create({
      connector: this._config.connector,
      model: this._config.model,
      tools: userTools,
      instructions: this.buildExecutionInstructions(),
      temperature: this._config.temperature,
      maxIterations: this._config.maxIterations ?? 20,
      permissions: this._config.permissions
      // Note: Execution agent uses its own context, not shared
    });
  }
  /**
   * Build instructions for the execution agent (task-focused)
   */
  buildExecutionInstructions() {
    return `You are an AI assistant executing specific tasks. Focus on completing the assigned task using the available tools.

Guidelines:
- Execute the task described in the prompt
- Use the appropriate tools to accomplish the task
- Report results clearly and concisely
- If you encounter errors, explain what went wrong

${this._config.instructions ?? ""}`;
  }
  // ============================================================================
  // Conversation History & Context (via AgentContext)
  // ============================================================================
  /**
   * Add a message to conversation history (via AgentContext)
   */
  async addToConversationHistory(role, content) {
    this._agentContext.addMessage(role, content);
  }
  /**
   * Build full context for the agent (via AgentContext.prepare())
   * Returns formatted context string ready for LLM
   */
  async buildFullContext(currentInput) {
    if (this.currentPlan) {
      this._planPlugin.setPlan(this.currentPlan);
    }
    this._agentContext.setCurrentInput(currentInput);
    const prepared = await this._agentContext.prepare();
    const parts = [];
    for (const component of prepared.components) {
      if (component.content) {
        const content = typeof component.content === "string" ? component.content : JSON.stringify(component.content, null, 2);
        parts.push(content);
      }
    }
    return parts.join("\n\n");
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
  /**
   * Build task prompt with full context (plan goal, completed tasks, etc.)
   */
  buildTaskPromptWithContext(task, taskIndex) {
    const parts = [];
    if (this.currentPlan) {
      parts.push(`## Overall Goal
${this.currentPlan.goal}
`);
      const completedTasks = this.currentPlan.tasks.slice(0, taskIndex).filter((t) => t.status === "completed");
      if (completedTasks.length > 0) {
        parts.push(`## Previously Completed Tasks`);
        for (const completed of completedTasks) {
          const output = completed.result?.output ? typeof completed.result.output === "string" ? completed.result.output.substring(0, 300) : JSON.stringify(completed.result.output).substring(0, 300) : "No output recorded";
          parts.push(`- **${completed.name}**: ${completed.description}
  Result: ${output}`);
        }
        parts.push("");
      }
    }
    parts.push(`## Current Task (${taskIndex + 1}/${this.currentPlan?.tasks.length || 1})`);
    parts.push(`**Name**: ${task.name}`);
    parts.push(`**Description**: ${task.description}`);
    if (task.expectedOutput) {
      parts.push(`**Expected Output**: ${task.expectedOutput}`);
    }
    parts.push("");
    parts.push("Execute this task now using the available tools. Be thorough and report results clearly.");
    return parts.join("\n");
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
  /**
   * Access to tool manager (alias for `tools` getter from BaseAgent)
   * @deprecated Use `tools` instead for consistency with other agents
   */
  get toolManager() {
    return this._agentContext.tools;
  }
  // ============================================================================
  // Unified Context Access
  // ============================================================================
  // Note: `context` getter is inherited from BaseAgent (returns _agentContext)
  // The inherited getter returns the AgentContext which is always available after BaseAgent constructor
  /**
   * Check if context is available (always true since AgentContext is created by BaseAgent)
   */
  hasContext() {
    return true;
  }
  // ============================================================================
  // Runtime Configuration
  // ============================================================================
  setAutoApproval(value) {
    if (this._config.planning) {
      this._config.planning.requireApproval = !value;
    }
  }
  setPlanningEnabled(value) {
    if (this._config.planning) {
      this._config.planning.enabled = value;
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
  // ============================================================================
  // Cleanup
  // ============================================================================
  destroy() {
    if (this._isDestroyed) return;
    this._logger.debug("UniversalAgent destroy started");
    for (const callback of this._cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        this._logger.error({ error: error.message }, "Cleanup callback error");
      }
    }
    this._cleanupCallbacks = [];
    this.agent.destroy();
    if (this.executionAgent) {
      this.executionAgent.destroy();
    }
    this.modeManager.destroy();
    this.baseDestroy();
    this._logger.debug("UniversalAgent destroyed");
  }
};

exports.AIError = AIError;
exports.APPROVAL_STATE_VERSION = APPROVAL_STATE_VERSION;
exports.AdaptiveStrategy = AdaptiveStrategy;
exports.Agent = Agent;
exports.AgentContext = AgentContext;
exports.AggressiveCompactionStrategy = AggressiveCompactionStrategy;
exports.ApproximateTokenEstimator = ApproximateTokenEstimator;
exports.BaseMediaProvider = BaseMediaProvider;
exports.BaseProvider = BaseProvider;
exports.BaseTextProvider = BaseTextProvider;
exports.BraveProvider = BraveProvider;
exports.CONNECTOR_CONFIG_VERSION = CONNECTOR_CONFIG_VERSION;
exports.CheckpointManager = CheckpointManager;
exports.ConnectorConfigStore = ConnectorConfigStore;
exports.ConnectorTools = ConnectorTools;
exports.ContentType = ContentType;
exports.ContextManager = ContextManager;
exports.ConversationHistoryManager = ConversationHistoryManager;
exports.DEFAULT_ALLOWLIST = DEFAULT_ALLOWLIST;
exports.DEFAULT_CHECKPOINT_STRATEGY = DEFAULT_CHECKPOINT_STRATEGY;
exports.DEFAULT_CONTEXT_CONFIG = DEFAULT_CONTEXT_CONFIG;
exports.DEFAULT_FILESYSTEM_CONFIG = DEFAULT_FILESYSTEM_CONFIG;
exports.DEFAULT_HISTORY_MANAGER_CONFIG = DEFAULT_HISTORY_MANAGER_CONFIG;
exports.DEFAULT_IDEMPOTENCY_CONFIG = DEFAULT_IDEMPOTENCY_CONFIG;
exports.DEFAULT_MEMORY_CONFIG = DEFAULT_MEMORY_CONFIG;
exports.DEFAULT_PERMISSION_CONFIG = DEFAULT_PERMISSION_CONFIG;
exports.DEFAULT_RATE_LIMITER_CONFIG = DEFAULT_RATE_LIMITER_CONFIG;
exports.DEFAULT_SHELL_CONFIG = DEFAULT_SHELL_CONFIG;
exports.DependencyCycleError = DependencyCycleError;
exports.ErrorHandler = ErrorHandler;
exports.ExecutionContext = ExecutionContext;
exports.ExternalDependencyHandler = ExternalDependencyHandler;
exports.FileConnectorStorage = FileConnectorStorage;
exports.FileSessionStorage = FileSessionStorage;
exports.FileStorage = FileStorage;
exports.HookManager = HookManager;
exports.IMAGE_MODELS = IMAGE_MODELS;
exports.IMAGE_MODEL_REGISTRY = IMAGE_MODEL_REGISTRY;
exports.IdempotencyCache = IdempotencyCache;
exports.ImageGeneration = ImageGeneration;
exports.InMemoryAgentStateStorage = InMemoryAgentStateStorage;
exports.InMemoryHistoryStorage = InMemoryHistoryStorage;
exports.InMemoryPlanStorage = InMemoryPlanStorage;
exports.InMemorySessionStorage = InMemorySessionStorage;
exports.InMemoryStorage = InMemoryStorage;
exports.InvalidConfigError = InvalidConfigError;
exports.InvalidToolArgumentsError = InvalidToolArgumentsError;
exports.LLM_MODELS = LLM_MODELS;
exports.LazyCompactionStrategy = LazyCompactionStrategy;
exports.MEMORY_PRIORITY_VALUES = MEMORY_PRIORITY_VALUES;
exports.META_TOOL_NAMES = META_TOOL_NAMES;
exports.MODEL_REGISTRY = MODEL_REGISTRY;
exports.MemoryConnectorStorage = MemoryConnectorStorage;
exports.MemoryEvictionCompactor = MemoryEvictionCompactor;
exports.MessageBuilder = MessageBuilder;
exports.MessageRole = MessageRole;
exports.ModeManager = ModeManager;
exports.ModelNotSupportedError = ModelNotSupportedError;
exports.ParallelTasksError = ParallelTasksError;
exports.PlanExecutor = PlanExecutor;
exports.PlanningAgent = PlanningAgent;
exports.ProactiveCompactionStrategy = ProactiveCompactionStrategy;
exports.ProviderAuthError = ProviderAuthError;
exports.ProviderConfigAgent = ProviderConfigAgent;
exports.ProviderContextLengthError = ProviderContextLengthError;
exports.ProviderError = ProviderError;
exports.ProviderErrorMapper = ProviderErrorMapper;
exports.ProviderNotFoundError = ProviderNotFoundError;
exports.ProviderRateLimitError = ProviderRateLimitError;
exports.RapidAPIProvider = RapidAPIProvider;
exports.RateLimitError = RateLimitError;
exports.RollingWindowStrategy = RollingWindowStrategy;
exports.SERVICE_DEFINITIONS = SERVICE_DEFINITIONS;
exports.SERVICE_INFO = SERVICE_INFO;
exports.SERVICE_URL_PATTERNS = SERVICE_URL_PATTERNS;
exports.STT_MODELS = STT_MODELS;
exports.STT_MODEL_REGISTRY = STT_MODEL_REGISTRY;
exports.ScrapeProvider = ScrapeProvider;
exports.SearchProvider = SearchProvider;
exports.SerperProvider = SerperProvider;
exports.Services = Services;
exports.SessionManager = SessionManager;
exports.SpeechToText = SpeechToText;
exports.StreamEventType = StreamEventType;
exports.StreamHelpers = StreamHelpers;
exports.StreamState = StreamState;
exports.SummarizeCompactor = SummarizeCompactor;
exports.TERMINAL_TASK_STATUSES = TERMINAL_TASK_STATUSES;
exports.TTS_MODELS = TTS_MODELS;
exports.TTS_MODEL_REGISTRY = TTS_MODEL_REGISTRY;
exports.TaskAgent = TaskAgent;
exports.TaskTimeoutError = TaskTimeoutError;
exports.TaskValidationError = TaskValidationError;
exports.TavilyProvider = TavilyProvider;
exports.TextToSpeech = TextToSpeech;
exports.TokenBucketRateLimiter = TokenBucketRateLimiter;
exports.ToolCallState = ToolCallState;
exports.ToolExecutionError = ToolExecutionError;
exports.ToolManager = ToolManager;
exports.ToolNotFoundError = ToolNotFoundError;
exports.ToolPermissionManager = ToolPermissionManager;
exports.ToolTimeoutError = ToolTimeoutError;
exports.TruncateCompactor = TruncateCompactor;
exports.UniversalAgent = UniversalAgent;
exports.VENDORS = VENDORS;
exports.VIDEO_MODELS = VIDEO_MODELS;
exports.VIDEO_MODEL_REGISTRY = VIDEO_MODEL_REGISTRY;
exports.Vendor = Vendor;
exports.VideoGeneration = VideoGeneration;
exports.WorkingMemory = WorkingMemory;
exports.addHistoryEntry = addHistoryEntry;
exports.addJitter = addJitter;
exports.assertNotDestroyed = assertNotDestroyed;
exports.authenticatedFetch = authenticatedFetch;
exports.backoffSequence = backoffSequence;
exports.backoffWait = backoffWait;
exports.bash = bash;
exports.buildEndpointWithQuery = buildEndpointWithQuery;
exports.buildQueryString = buildQueryString;
exports.calculateBackoff = calculateBackoff;
exports.calculateCost = calculateCost;
exports.calculateEntrySize = calculateEntrySize;
exports.calculateImageCost = calculateImageCost;
exports.calculateSTTCost = calculateSTTCost;
exports.calculateTTSCost = calculateTTSCost;
exports.calculateVideoCost = calculateVideoCost;
exports.canTaskExecute = canTaskExecute;
exports.createAgentStorage = createAgentStorage;
exports.createAuthenticatedFetch = createAuthenticatedFetch;
exports.createBashTool = createBashTool;
exports.createContextTools = createContextTools;
exports.createEditFileTool = createEditFileTool;
exports.createEmptyHistory = createEmptyHistory;
exports.createEmptyMemory = createEmptyMemory;
exports.createEstimator = createEstimator;
exports.createExecuteJavaScriptTool = createExecuteJavaScriptTool;
exports.createGlobTool = createGlobTool;
exports.createGrepTool = createGrepTool;
exports.createImageProvider = createImageProvider;
exports.createListDirectoryTool = createListDirectoryTool;
exports.createMemoryTools = createMemoryTools;
exports.createMessageWithImages = createMessageWithImages;
exports.createMetricsCollector = createMetricsCollector;
exports.createPlan = createPlan;
exports.createProvider = createProvider;
exports.createReadFileTool = createReadFileTool;
exports.createStrategy = createStrategy;
exports.createTask = createTask;
exports.createTextMessage = createTextMessage;
exports.createVideoProvider = createVideoProvider;
exports.createWriteFileTool = createWriteFileTool;
exports.defaultDescribeCall = defaultDescribeCall;
exports.detectDependencyCycle = detectDependencyCycle;
exports.detectServiceFromURL = detectServiceFromURL;
exports.developerTools = developerTools;
exports.editFile = editFile;
exports.evaluateCondition = evaluateCondition;
exports.extractJSON = extractJSON;
exports.extractJSONField = extractJSONField;
exports.extractNumber = extractNumber;
exports.forPlan = forPlan;
exports.forTasks = forTasks;
exports.generateEncryptionKey = generateEncryptionKey;
exports.generateSimplePlan = generateSimplePlan;
exports.generateWebAPITool = generateWebAPITool;
exports.getActiveImageModels = getActiveImageModels;
exports.getActiveModels = getActiveModels;
exports.getActiveSTTModels = getActiveSTTModels;
exports.getActiveTTSModels = getActiveTTSModels;
exports.getActiveVideoModels = getActiveVideoModels;
exports.getAllServiceIds = getAllServiceIds;
exports.getBackgroundOutput = getBackgroundOutput;
exports.getImageModelInfo = getImageModelInfo;
exports.getImageModelsByVendor = getImageModelsByVendor;
exports.getImageModelsWithFeature = getImageModelsWithFeature;
exports.getMetaTools = getMetaTools;
exports.getModelInfo = getModelInfo;
exports.getModelsByVendor = getModelsByVendor;
exports.getNextExecutableTasks = getNextExecutableTasks;
exports.getRegisteredScrapeProviders = getRegisteredScrapeProviders;
exports.getSTTModelInfo = getSTTModelInfo;
exports.getSTTModelsByVendor = getSTTModelsByVendor;
exports.getSTTModelsWithFeature = getSTTModelsWithFeature;
exports.getServiceDefinition = getServiceDefinition;
exports.getServiceInfo = getServiceInfo;
exports.getServicesByCategory = getServicesByCategory;
exports.getTTSModelInfo = getTTSModelInfo;
exports.getTTSModelsByVendor = getTTSModelsByVendor;
exports.getTTSModelsWithFeature = getTTSModelsWithFeature;
exports.getTaskDependencies = getTaskDependencies;
exports.getToolCallDescription = getToolCallDescription;
exports.getVideoModelInfo = getVideoModelInfo;
exports.getVideoModelsByVendor = getVideoModelsByVendor;
exports.getVideoModelsWithAudio = getVideoModelsWithAudio;
exports.getVideoModelsWithFeature = getVideoModelsWithFeature;
exports.glob = glob;
exports.globalErrorHandler = globalErrorHandler;
exports.grep = grep;
exports.hasClipboardImage = hasClipboardImage;
exports.isBlockedCommand = isBlockedCommand;
exports.isErrorEvent = isErrorEvent;
exports.isExcludedExtension = isExcludedExtension;
exports.isKnownService = isKnownService;
exports.isMetaTool = isMetaTool;
exports.isOutputTextDelta = isOutputTextDelta;
exports.isResponseComplete = isResponseComplete;
exports.isSimpleScope = isSimpleScope;
exports.isStreamEvent = isStreamEvent;
exports.isTaskAwareScope = isTaskAwareScope;
exports.isTaskBlocked = isTaskBlocked;
exports.isTerminalMemoryStatus = isTerminalMemoryStatus;
exports.isTerminalStatus = isTerminalStatus;
exports.isToolCallArgumentsDelta = isToolCallArgumentsDelta;
exports.isToolCallArgumentsDone = isToolCallArgumentsDone;
exports.isToolCallStart = isToolCallStart;
exports.isVendor = isVendor;
exports.killBackgroundProcess = killBackgroundProcess;
exports.listDirectory = listDirectory;
exports.readClipboardImage = readClipboardImage;
exports.readFile = readFile4;
exports.registerScrapeProvider = registerScrapeProvider;
exports.resolveConnector = resolveConnector;
exports.resolveDependencies = resolveDependencies;
exports.retryWithBackoff = retryWithBackoff;
exports.scopeEquals = scopeEquals;
exports.scopeMatches = scopeMatches;
exports.setMetricsCollector = setMetricsCollector;
exports.toConnectorOptions = toConnectorOptions;
exports.tools = tools_exports;
exports.updateTaskStatus = updateTaskStatus;
exports.validatePath = validatePath;
exports.writeFile = writeFile4;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map