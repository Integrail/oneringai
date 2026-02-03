/**
 * ConnectorCreatePage - Create a new universal connector
 *
 * Configure and save a connector from a selected vendor template.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Alert, Card } from 'react-bootstrap';
import { ArrowLeft, ExternalLink, Save, Loader2 } from 'lucide-react';
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

  // Load full vendor template
  useEffect(() => {
    if (!selectedVendor) {
      // No vendor selected, go back to catalog
      navigate('connector-catalog');
      return;
    }

    const loadTemplate = async () => {
      try {
        const fullTemplate = await window.hosea.universalConnector.getVendorTemplate(selectedVendor.id);
        if (fullTemplate) {
          setTemplate(fullTemplate);
          setBaseURL(fullTemplate.baseURL);
          // Generate default connector name
          setConnectorName(selectedVendor.id);
          // Auto-select first auth method if only one
          if (fullTemplate.authTemplates.length === 1) {
            setSelectedAuthMethodId(fullTemplate.authTemplates[0].id);
          }
        } else {
          setError(`Vendor template not found: ${selectedVendor.id}`);
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

    // Validate required fields
    const missingFields = selectedAuthTemplate.requiredFields.filter(
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
        // Clear navigation data and go to connectors page
        setData({});
        navigate('universal-connectors');
      } else {
        setError(result.error || 'Failed to create connector');
      }
    } catch (err) {
      setError(`Failed to create connector: ${err}`);
    } finally {
      setSaving(false);
    }
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
      </div>
    </div>
  );
}

export default ConnectorCreatePage;
