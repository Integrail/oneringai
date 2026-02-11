/**
 * Vendor OAuth Service
 *
 * Orchestrates generic OAuth flows for vendor connectors in the Hosea Electron app.
 * Generalises the EWAuthService pattern (BrowserWindow + navigation monitoring)
 * to work with any OAuth vendor via the core library's Connector API.
 *
 * Supports:
 *   - authorization_code flow (BrowserWindow + localhost callback server)
 *   - client_credentials flow (direct token fetch, no UI)
 *
 * All PKCE, state, token exchange, and refresh logic lives in the core library.
 * This service is pure orchestration / glue code.
 */

import { BrowserWindow } from 'electron';
import { Connector } from '@everworker/oneringai';
import { OAuthCallbackServer } from './OAuthCallbackServer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OAuthFlowResult {
  success: boolean;
  error?: string;
}

export interface OAuthFlowOptions {
  /** Connector name (must already be registered via Connector.create()) */
  connectorName: string;
  /** Parent window for modal behaviour */
  parentWindow?: BrowserWindow | null;
  /** Timeout in ms (default: 300 000 = 5 min) */
  timeoutMs?: number;
}

export interface OAuthTokenStatus {
  hasToken: boolean;
  isValid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class VendorOAuthService {
  private authWindow: BrowserWindow | null = null;
  private callbackServer: OAuthCallbackServer | null = null;
  private activeConnector: string | null = null;

  // ── authorization_code ──────────────────────────────────────────────

  /**
   * Run the full authorization_code flow:
   *
   * 1. Start localhost callback server
   * 2. Call connector.startAuth() → authorization URL (PKCE + state auto-generated)
   * 3. Open BrowserWindow with the auth URL
   * 4. Wait for the provider to redirect to the callback server
   * 5. Call connector.handleCallback(url) → exchanges code for tokens
   * 6. Clean up and return
   */
  async authorizeAuthCode(options: OAuthFlowOptions): Promise<OAuthFlowResult> {
    const { connectorName, parentWindow, timeoutMs = 300_000 } = options;

    // Prevent concurrent flows
    if (this.activeConnector) {
      return {
        success: false,
        error: `OAuth flow already in progress for "${this.activeConnector}"`,
      };
    }

    this.activeConnector = connectorName;

    try {
      const connector = Connector.get(connectorName);
      if (!connector) {
        return { success: false, error: `Connector "${connectorName}" not found in registry` };
      }

      // 1. Start callback server
      this.callbackServer = new OAuthCallbackServer();
      const callbackPromise = this.callbackServer.waitForCallback(timeoutMs);

      // 2. Get authorization URL from the core library (generates PKCE + state)
      const authUrl = await connector.startAuth();

      // 3. Open BrowserWindow
      this.authWindow = new BrowserWindow({
        width: 900,
        height: 750,
        parent: parentWindow ?? undefined,
        modal: !!parentWindow,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          // No preload — this is a pure web page (vendor's login form)
        },
        title: 'Authorize Application',
        autoHideMenuBar: true,
      });

      // User closed the window → cancel the flow
      this.authWindow.on('closed', () => {
        this.authWindow = null;
        this.callbackServer?.close();
      });

      // Show once the page loads
      this.authWindow.once('ready-to-show', () => {
        this.authWindow?.show();
      });

      // Network error → reject
      this.authWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription) => {
        if (errorCode === -3) return; // Ignore aborted loads (rapid redirects)
        this.callbackServer?.close();
      });

      // Navigate to vendor's auth page
      await this.authWindow.loadURL(authUrl);

      // 4. Wait for the callback
      const callbackResult = await callbackPromise;

      // 5. Exchange code for tokens (core library handles PKCE verification, token storage, etc.)
      await connector.handleCallback(callbackResult.fullUrl);

      // 6. Done
      this.destroyWindow();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.cleanup();
    }
  }

  // ── client_credentials ──────────────────────────────────────────────

  /**
   * Run the client_credentials flow.
   * No user interaction needed — just triggers a token fetch via the core library.
   */
  async authorizeClientCredentials(connectorName: string): Promise<OAuthFlowResult> {
    try {
      const connector = Connector.get(connectorName);
      if (!connector) {
        return { success: false, error: `Connector "${connectorName}" not found in registry` };
      }

      // getToken() automatically triggers ClientCredentialsFlow.requestToken()
      await connector.getToken();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ── Token status ────────────────────────────────────────────────────

  /**
   * Check whether a connector has a valid token.
   */
  async checkTokenStatus(connectorName: string): Promise<OAuthTokenStatus> {
    try {
      const connector = Connector.get(connectorName);
      if (!connector) {
        return { hasToken: false, isValid: false, error: 'Connector not found' };
      }

      const isValid = await connector.hasValidToken();
      return { hasToken: isValid, isValid };
    } catch (error) {
      return {
        hasToken: false,
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ── Control ─────────────────────────────────────────────────────────

  /**
   * Cancel any in-progress OAuth flow.
   */
  cancel(): void {
    this.destroyWindow();
    this.callbackServer?.close();
    this.callbackServer = null;
    this.activeConnector = null;
  }

  get isAuthorizing(): boolean {
    return this.activeConnector !== null;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private destroyWindow(): void {
    if (this.authWindow && !this.authWindow.isDestroyed()) {
      this.authWindow.destroy();
    }
    this.authWindow = null;
  }

  private cleanup(): void {
    this.destroyWindow();
    this.callbackServer?.close();
    this.callbackServer = null;
    this.activeConnector = null;
  }
}
