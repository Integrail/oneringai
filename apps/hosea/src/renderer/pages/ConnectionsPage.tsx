/**
 * ConnectionsPage - Simplified connections hub
 *
 * Zero-config experience: connect to EverWorker for LLMs, one-click OAuth for vendor services.
 * Advanced users can still access full configuration via the sidebar's Advanced section.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Spinner, Alert, Form } from 'react-bootstrap';
import {
  CheckCircle,
  Circle,
  LogOut,
  ExternalLink,
  Zap,
  Globe,
  Edit3,
} from 'lucide-react';
import { PageHeader } from '../components/layout';
import { VendorLogo, prefetchVendorLogos } from '../components/connectors';
import { useConnectorVersion } from '../App';

interface BuiltInOAuthApp {
  vendorId: string;
  displayName: string;
  clientId: string;
  authTemplateId: string;
  scopes: string[];
}

interface EWConnectionState {
  connected: boolean;
  profileName?: string;
  profileUrl?: string;
  checking: boolean;
}

interface ServiceCardState {
  connected: boolean;
  connectorName?: string;
  authorizing: boolean;
}

export function ConnectionsPage(): React.ReactElement {
  const connectorVersion = useConnectorVersion();
  const [ewState, setEWState] = useState<EWConnectionState>({ connected: false, checking: true });
  const [builtInApps, setBuiltInApps] = useState<BuiltInOAuthApp[]>([]);
  const [serviceStates, setServiceStates] = useState<Map<string, ServiceCardState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ewConnecting, setEWConnecting] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [defaultEWUrl, setDefaultEWUrl] = useState('');
  const [showUrlOverride, setShowUrlOverride] = useState(false);
  const [urlOverride, setUrlOverride] = useState('');

  // Load built-in apps and their statuses
  const loadData = useCallback(async () => {
    try {
      const [apps, profiles, devMode, ewUrl] = await Promise.all([
        window.hosea.builtInOAuth.list(),
        window.hosea.everworker.getProfiles(),
        window.hosea.app.getIsDev(),
        window.hosea.builtInOAuth.getDefaultEWUrl(),
      ]);

      setBuiltInApps(apps);
      setIsDev(devMode);
      setDefaultEWUrl(ewUrl);
      setUrlOverride(ewUrl);

      // Pre-fetch vendor logos
      const vendorIds = apps.map(a => a.vendorId);
      if (vendorIds.length > 0) {
        prefetchVendorLogos(vendorIds);
      }

      // Check EW connection status
      const activeProfile = profiles.profiles.find(p => p.id === profiles.activeProfileId);
      setEWState({
        connected: !!activeProfile,
        profileName: activeProfile?.userName || activeProfile?.name,
        profileUrl: activeProfile?.url,
        checking: false,
      });

      // Check each service status
      const states = new Map<string, ServiceCardState>();
      for (const app of apps) {
        const status = await window.hosea.builtInOAuth.getStatus(app.vendorId);
        states.set(app.vendorId, {
          connected: status.connected,
          connectorName: status.connectorName,
          authorizing: false,
        });
      }
      setServiceStates(states);
    } catch (err) {
      console.error('[ConnectionsPage] Error loading data:', err);
      setError('Failed to load connection data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, connectorVersion]);

  // Resolve which URL to connect to
  const getConnectUrl = (): string => {
    if (showUrlOverride && urlOverride.trim()) {
      return urlOverride.trim();
    }
    return defaultEWUrl;
  };

  // Connect to EverWorker
  const handleEWConnect = useCallback(async () => {
    setEWConnecting(true);
    setError(null);

    try {
      const connectUrl = getConnectUrl();

      // Check auth support
      const support = await window.hosea.everworker.checkAuthSupport(connectUrl);
      if (!support.supported) {
        setError(`EverWorker server at ${connectUrl} does not support browser authentication`);
        setEWConnecting(false);
        return;
      }

      // Start browser auth
      const result = await window.hosea.everworker.startAuth(connectUrl);
      if (!result.success) {
        setError(result.error || 'Authentication failed');
        setEWConnecting(false);
        return;
      }

      // Create/update profile
      const addResult = await window.hosea.everworker.addProfile({
        name: 'EverWorker',
        url: connectUrl,
        token: result.token!,
        tokenExpiresAt: result.expiresAt,
        userName: result.userName,
        userId: result.userId,
        authMethod: 'browser-auth',
      });

      if (addResult.success && addResult.id) {
        // Activate the profile (triggers connector sync)
        await window.hosea.everworker.switchProfile(addResult.id);
      }

      // Refresh state
      await loadData();
    } catch (err) {
      setError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEWConnecting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, showUrlOverride, urlOverride, defaultEWUrl]);

  // Disconnect from EverWorker
  const handleEWDisconnect = useCallback(async () => {
    try {
      await window.hosea.everworker.switchProfile(null);
      await loadData();
    } catch (err) {
      setError(`Disconnect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [loadData]);

  // Authorize a built-in service
  const handleServiceAuthorize = useCallback(async (vendorId: string) => {
    setServiceStates(prev => {
      const next = new Map(prev);
      const state = next.get(vendorId) || { connected: false, authorizing: false };
      next.set(vendorId, { ...state, authorizing: true });
      return next;
    });
    setError(null);

    try {
      const result = await window.hosea.builtInOAuth.authorize(vendorId);
      if (!result.success) {
        setError(result.error || `Failed to connect ${vendorId}`);
      }
      // Refresh status
      const status = await window.hosea.builtInOAuth.getStatus(vendorId);
      setServiceStates(prev => {
        const next = new Map(prev);
        next.set(vendorId, {
          connected: status.connected,
          connectorName: status.connectorName,
          authorizing: false,
        });
        return next;
      });
    } catch (err) {
      setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      setServiceStates(prev => {
        const next = new Map(prev);
        const state = next.get(vendorId) || { connected: false, authorizing: false };
        next.set(vendorId, { ...state, authorizing: false });
        return next;
      });
    }
  }, []);

  // Disconnect a built-in service
  const handleServiceDisconnect = useCallback(async (vendorId: string) => {
    try {
      await window.hosea.builtInOAuth.disconnect(vendorId);
      setServiceStates(prev => {
        const next = new Map(prev);
        next.set(vendorId, { connected: false, authorizing: false });
        return next;
      });
    } catch (err) {
      setError(`Disconnect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  if (loading) {
    return (
      <div className="page">
        <PageHeader
          title="Connections"
          subtitle="Connect AI providers and services"
        />
        <div className="page__content d-flex justify-content-center align-items-center" style={{ minHeight: 200 }}>
          <Spinner animation="border" variant="primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Connections"
        subtitle="Connect AI providers and services with one click"
      />

      <div className="page__content">
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
            {error}
          </Alert>
        )}

        {/* Section A: AI Provider (EverWorker) */}
        <div className="connections-section mb-4">
          <h5 className="connections-section__title">AI Provider</h5>
          <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
            Connect to EverWorker for access to all AI models (GPT, Claude, Gemini, and more)
          </p>

          <div className="connections-ew-card">
            <div className="connections-ew-card__left">
              <div className="connections-ew-card__icon">
                <Zap size={28} />
              </div>
              <div className="connections-ew-card__info">
                <div className="connections-ew-card__name">EverWorker</div>
                {ewState.connected ? (
                  <>
                    <div className="connections-ew-card__status connections-ew-card__status--connected">
                      <CheckCircle size={14} />
                      <span>Connected{ewState.profileName ? ` as ${ewState.profileName}` : ''}</span>
                    </div>
                    {ewState.profileUrl && (
                      <div className="connections-ew-card__url">
                        <Globe size={12} />
                        <span>{ewState.profileUrl}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="connections-ew-card__status connections-ew-card__status--disconnected">
                    <Circle size={14} />
                    <span>Not connected</span>
                  </div>
                )}
              </div>
            </div>
            <div className="connections-ew-card__actions">
              {ewState.connected ? (
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleEWDisconnect}
                  type="button"
                >
                  <LogOut size={14} className="me-1" />
                  Disconnect
                </button>
              ) : (
                <div className="d-flex flex-column gap-2 align-items-end">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={handleEWConnect}
                    disabled={ewConnecting}
                    type="button"
                  >
                    {ewConnecting ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink size={14} className="me-1" />
                        Connect to EverWorker
                      </>
                    )}
                  </button>
                  {/* Dev/custom URL toggle */}
                  {!showUrlOverride && (
                    <button
                      className="btn btn-link btn-sm p-0 text-muted"
                      onClick={() => setShowUrlOverride(true)}
                      type="button"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <Edit3 size={11} className="me-1" />
                      {isDev ? 'Custom URL (dev)' : 'Custom URL'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Custom URL input (shown when toggled, only when disconnected) */}
          {showUrlOverride && !ewState.connected && (
            <div className="connections-url-override mt-2">
              <Form.Group className="d-flex align-items-center gap-2">
                <Form.Label className="mb-0 text-muted flex-shrink-0" style={{ fontSize: '0.8125rem' }}>
                  Server URL:
                </Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  value={urlOverride}
                  onChange={(e) => setUrlOverride(e.target.value)}
                  placeholder="http://localhost:3000"
                  style={{ maxWidth: 350, fontSize: '0.8125rem' }}
                />
                <button
                  className="btn btn-link btn-sm text-muted p-0"
                  onClick={() => {
                    setShowUrlOverride(false);
                    setUrlOverride(defaultEWUrl);
                  }}
                  type="button"
                  style={{ fontSize: '0.75rem' }}
                >
                  Cancel
                </button>
              </Form.Group>
              {isDev && (
                <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                  Dev mode: default is <code>{defaultEWUrl}</code>. Override with <code>HOSEA_EW_URL</code> env var.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section B: Service Connections */}
        {builtInApps.length > 0 && (
          <div className="connections-section">
            <h5 className="connections-section__title">Service Connections</h5>
            <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
              Connect external services for your AI agents to use
            </p>

            <div className="connections-grid">
              {builtInApps.map((app) => {
                const state = serviceStates.get(app.vendorId) || { connected: false, authorizing: false };

                return (
                  <div
                    key={app.vendorId}
                    className={`connections-service-card ${state.connected ? 'connections-service-card--connected' : ''}`}
                  >
                    <div className="connections-service-card__logo">
                      <VendorLogo vendorId={app.vendorId} size={40} />
                    </div>
                    <div className="connections-service-card__name">{app.displayName}</div>
                    <div className="connections-service-card__status">
                      {state.connected ? (
                        <span className="connections-status--connected">
                          <CheckCircle size={14} /> Connected
                        </span>
                      ) : (
                        <span className="connections-status--disconnected">
                          <Circle size={14} /> Not connected
                        </span>
                      )}
                    </div>
                    <div className="connections-service-card__action">
                      {state.connected ? (
                        <button
                          className="btn btn-sm btn-outline-secondary w-100"
                          onClick={() => handleServiceDisconnect(app.vendorId)}
                          type="button"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-primary w-100"
                          onClick={() => handleServiceAuthorize(app.vendorId)}
                          disabled={state.authorizing}
                          type="button"
                        >
                          {state.authorizing ? (
                            <Spinner animation="border" size="sm" />
                          ) : (
                            'Connect'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Help text */}
        <div className="mt-4 text-muted" style={{ fontSize: '0.8125rem' }}>
          Need more options? Use the <strong>Advanced</strong> section in the sidebar for LLM Providers,
          Universal Connectors, Tool Catalog, and MCP Servers.
        </div>
      </div>
    </div>
  );
}
