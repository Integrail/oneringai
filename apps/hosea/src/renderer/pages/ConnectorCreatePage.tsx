/**
 * ConnectorCreatePage - Create a new universal connector
 *
 * Configure and save a connector from a selected vendor template.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Alert, Card } from 'react-bootstrap';
import { ArrowLeft, ExternalLink, Save, Loader2, CheckCircle, XCircle, Shield } from 'lucide-react';
import { PageHeader } from '../components/layout';
import {
  VendorLogo,
  AuthMethodSelector,
  CredentialsForm,
} from '../components/connectors';
import { useNavigation } from '../hooks/useNavigation';

interface VendorInfo {
  id: string;
  name: string;
  category: string;
  docsURL?: string;
  credentialsSetupURL?: string;
  authMethods: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    requiredFields: string[];
  }>;
}

interface VendorTemplate {
  id: string;
  name: string;
  serviceType: string;
  baseURL: string;
  docsURL?: string;
  credentialsSetupURL?: string;
  authTemplates: Array<{
    id: string;
    name: string;
    type: 'api_key' | 'oauth';
    flow?: 'authorization_code' | 'client_credentials' | 'jwt_bearer';
    description: string;
    requiredFields: string[];
    optionalFields?: string[];
    scopes?: string[];
    scopeDescriptions?: Record<string, string>;
  }>;
  category: string;
  notes?: string;
}

// Category badge colors
const CATEGORY_CONFIG: Record<string, { label: string; variant: string }> = {
  cloud: { label: 'Cloud', variant: 'info' },
  communication: { label: 'Communication', variant: 'primary' },
  crm: { label: 'CRM', variant: 'success' },
  development: { label: 'Development', variant: 'dark' },
  email: { label: 'Email', variant: 'warning' },
  monitoring: { label: 'Monitoring', variant: 'danger' },
  other: { label: 'Other', variant: 'secondary' },
  payments: { label: 'Payments', variant: 'success' },
  productivity: { label: 'Productivity', variant: 'primary' },
  scrape: { label: 'Web Scraping', variant: 'info' },
  search: { label: 'Search', variant: 'warning' },
  storage: { label: 'Storage', variant: 'dark' },
};

export function ConnectorCreatePage(): React.ReactElement {
  const { navigate, state, setData } = useNavigation();

  // Get selected vendor from navigation data
  const selectedVendor = state.data?.selectedVendor as VendorInfo | undefined;

  const [template, setTemplate] = useState<VendorTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [connectorName, setConnectorName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedAuthMethodId, setSelectedAuthMethodId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [baseURL, setBaseURL] = useState('');

  // OAuth authorization state (post-creation)
  const [oauthRedirectUri, setOauthRedirectUri] = useState<string | null>(null);
  const [showAuthStep, setShowAuthStep] = useState(false);
  const [createdConnectorName, setCreatedConnectorName] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [authResult, setAuthResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Load full vendor template and redirect URI
  useEffect(() => {
    if (!selectedVendor) {
      // No vendor selected, go back to catalog
      navigate('connector-catalog');
      return;
    }

    const loadTemplate = async () => {
      try {
        const [fullTemplate, redirectUri, existingConnectors] = await Promise.all([
          window.hosea.universalConnector.getVendorTemplate(selectedVendor.id),
          window.hosea.oauth.getRedirectUri(),
          window.hosea.universalConnector.list(),
        ]);

        if (fullTemplate) {
          setTemplate(fullTemplate);
          setBaseURL(fullTemplate.baseURL);
          // Generate unique default connector name
          const existingNames = new Set(existingConnectors.map(c => c.name));
          let name = selectedVendor.id;
          if (existingNames.has(name)) {
            let suffix = 2;
            while (existingNames.has(`${selectedVendor.id}-${suffix}`)) {
              suffix++;
            }
            name = `${selectedVendor.id}-${suffix}`;
          }
          setConnectorName(name);
          // Auto-select first auth method if only one
          if (fullTemplate.authTemplates.length === 1) {
            setSelectedAuthMethodId(fullTemplate.authTemplates[0].id);
          }
        } else {
          setError(`Vendor template not found: ${selectedVendor.id}`);
        }

        if (redirectUri) {
          setOauthRedirectUri(redirectUri);
        }
      } catch (err) {
        setError(`Failed to load vendor template: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [selectedVendor, navigate]);

  // Get selected auth template
  const selectedAuthTemplate = template?.authTemplates.find(a => a.id === selectedAuthMethodId);

  const handleCredentialChange = useCallback((field: string, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !selectedAuthMethodId || !selectedAuthTemplate) {
      setError('Please select an authentication method');
      return;
    }

    // Validate required fields (skip redirectUri for auth_code — Hosea auto-sets it)
    const isAuthCode = selectedAuthTemplate.type === 'oauth' && selectedAuthTemplate.flow === 'authorization_code';
    const fieldsToValidate = isAuthCode
      ? selectedAuthTemplate.requiredFields.filter(f => f !== 'redirectUri')
      : selectedAuthTemplate.requiredFields;
    const missingFields = fieldsToValidate.filter(
      field => !credentials[field]?.trim()
    );
    if (missingFields.length > 0) {
      setError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await window.hosea.universalConnector.create({
        name: connectorName.trim(),
        vendorId: template.id,
        authMethodId: selectedAuthMethodId,
        credentials,
        displayName: displayName.trim() || undefined,
        baseURL: baseURL.trim() !== template.baseURL ? baseURL.trim() : undefined,
      });

      if (result.success) {
        if (result.needsAuth && result.flow) {
          // OAuth connector created — show authorization step
          setCreatedConnectorName(connectorName.trim());
          setAuthFlow(result.flow);
          setShowAuthStep(true);
        } else {
          // API key connector — done
          setData({});
          navigate('universal-connectors');
        }
      } else {
        setError(result.error || 'Failed to create connector');
      }
    } catch (err) {
      setError(`Failed to create connector: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorize = async () => {
    if (!createdConnectorName) return;
    setAuthorizing(true);
    setAuthResult(null);
    try {
      const result = await window.hosea.oauth.startFlow(createdConnectorName);
      setAuthResult(result);
    } catch (err) {
      setAuthResult({ success: false, error: String(err) });
    } finally {
      setAuthorizing(false);
    }
  };

  const handleSkipAuth = () => {
    setData({});
    navigate('universal-connectors');
  };

  const handleBack = () => {
    navigate('connector-catalog');
  };

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Create Connector" subtitle="Loading..." />
        <div className="page__content">
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!template || !selectedVendor) {
    return (
      <div className="page">
        <PageHeader title="Create Connector" subtitle="Error" />
        <div className="page__content">
          <Alert variant="danger">
            {error || 'Vendor template not found. Please select a vendor from the catalog.'}
          </Alert>
          <Button variant="primary" onClick={() => navigate('connector-catalog')}>
            Go to Catalog
          </Button>
        </div>
      </div>
    );
  }

  const categoryConfig = CATEGORY_CONFIG[template.category] || { label: template.category, variant: 'secondary' };

  return (
    <div className="page connector-create-page">
      <PageHeader
        title={`Connect to ${template.name}`}
        subtitle="Configure your connection credentials"
      >
        <Button variant="outline-secondary" onClick={handleBack}>
          <ArrowLeft size={16} className="me-2" />
          Back
        </Button>
      </PageHeader>

      <div className="page__content">
        {showAuthStep ? (
          /* ── OAuth Authorization Step ── */
          <div className="connector-create-page__auth-step">
            <Card className="connector-create-page__vendor-card mb-4">
              <Card.Body>
                <div className="d-flex align-items-center gap-3">
                  <VendorLogo vendorId={template.id} size={48} />
                  <div className="flex-1">
                    <h4 className="mb-1">{template.name} — Connector Created</h4>
                    <span className="text-muted">One more step: authorize access</span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {authFlow === 'authorization_code' && oauthRedirectUri && (
              <Alert variant="info" className="d-flex align-items-start gap-2">
                <Shield size={16} className="mt-1 flex-shrink-0" />
                <div>
                  Make sure you have registered this redirect URI in your provider's app settings:
                  <code className="d-block mt-1 user-select-all">{oauthRedirectUri}</code>
                </div>
              </Alert>
            )}

            {authResult && (
              <Alert variant={authResult.success ? 'success' : 'danger'} className="d-flex align-items-center gap-2">
                {authResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {authResult.success
                  ? 'Authorization successful! Your connector is ready to use.'
                  : `Authorization failed: ${authResult.error}`}
              </Alert>
            )}

            <div className="d-flex gap-3 mt-4">
              {authResult?.success ? (
                <Button variant="primary" onClick={handleSkipAuth}>
                  <CheckCircle size={16} className="me-2" />
                  Done
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    onClick={handleAuthorize}
                    disabled={authorizing}
                  >
                    {authorizing ? (
                      <>
                        <Loader2 size={16} className="me-2 spin" />
                        Authorizing...
                      </>
                    ) : (
                      <>
                        <Shield size={16} className="me-2" />
                        {authResult ? 'Retry Authorization' : 'Authorize'}
                      </>
                    )}
                  </Button>
                  <Button variant="outline-secondary" onClick={handleSkipAuth} disabled={authorizing}>
                    Skip (do later)
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
        <Form onSubmit={handleSubmit}>
          {/* Vendor Info Card */}
          <Card className="connector-create-page__vendor-card mb-4">
            <Card.Body>
              <div className="d-flex align-items-center gap-3">
                <VendorLogo vendorId={template.id} size={48} />
                <div className="flex-1">
                  <h4 className="mb-1">{template.name}</h4>
                  <div className="d-flex align-items-center gap-2 text-muted">
                    <span className={`badge bg-${categoryConfig.variant}`}>
                      {categoryConfig.label}
                    </span>
                    <span>•</span>
                    <span>REST API</span>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  {template.docsURL && (
                    <a
                      href={template.docsURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-secondary btn-sm"
                    >
                      <ExternalLink size={14} className="me-1" />
                      Docs
                    </a>
                  )}
                  {template.credentialsSetupURL && (
                    <a
                      href={template.credentialsSetupURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary btn-sm"
                    >
                      <ExternalLink size={14} className="me-1" />
                      Get Credentials
                    </a>
                  )}
                </div>
              </div>
              {template.notes && (
                <div className="mt-3">
                  <small className="text-muted">{template.notes}</small>
                </div>
              )}
            </Card.Body>
          </Card>

          {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

          {/* Auth Method Selection */}
          <div className="connector-create-page__section mb-4">
            <AuthMethodSelector
              authMethods={template.authTemplates.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                description: a.description,
                requiredFields: a.requiredFields,
              }))}
              selectedMethodId={selectedAuthMethodId}
              onSelect={setSelectedAuthMethodId}
            />
          </div>

          {/* Connector Name */}
          <div className="connector-create-page__section mb-4">
            <Form.Group className="mb-3">
              <Form.Label>Connector Name *</Form.Label>
              <Form.Control
                type="text"
                value={connectorName}
                onChange={(e) => setConnectorName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="my-github"
                required
              />
              <Form.Text className="text-muted">
                Unique identifier for this connector (lowercase, hyphens allowed)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Display Name (optional)</Form.Label>
              <Form.Control
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={template.name}
              />
              <Form.Text className="text-muted">
                Friendly name shown in the UI
              </Form.Text>
            </Form.Group>
          </div>

          {/* Credentials Form */}
          {selectedAuthTemplate && (
            <div className="connector-create-page__section mb-4">
              <h5 className="mb-3">Credentials</h5>
              <CredentialsForm
                requiredFields={selectedAuthTemplate.requiredFields}
                optionalFields={selectedAuthTemplate.optionalFields}
                values={credentials}
                onChange={handleCredentialChange}
                credentialsSetupURL={template.credentialsSetupURL}
                docsURL={template.docsURL}
                authType={selectedAuthTemplate.type}
                oauthFlow={selectedAuthTemplate.flow}
                oauthRedirectUri={oauthRedirectUri || undefined}
                availableScopes={selectedAuthTemplate.scopes}
                scopeDescriptions={selectedAuthTemplate.scopeDescriptions}
              />
            </div>
          )}

          {/* Advanced Settings */}
          <div className="connector-create-page__section mb-4">
            <details>
              <summary className="connector-create-page__advanced-toggle">
                Advanced Settings
              </summary>
              <div className="mt-3">
                <Form.Group className="mb-3">
                  <Form.Label>Base URL</Form.Label>
                  <Form.Control
                    type="url"
                    value={baseURL}
                    onChange={(e) => setBaseURL(e.target.value)}
                    placeholder={template.baseURL}
                  />
                  <Form.Text className="text-muted">
                    Override the default API endpoint if needed
                  </Form.Text>
                </Form.Group>
              </div>
            </details>
          </div>

          {/* Actions */}
          <div className="connector-create-page__actions">
            <Button variant="secondary" onClick={handleBack} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving || !selectedAuthMethodId}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="me-2 spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={16} className="me-2" />
                  Create Connector
                </>
              )}
            </Button>
          </div>
        </Form>
        )}
      </div>
    </div>
  );
}

export default ConnectorCreatePage;
