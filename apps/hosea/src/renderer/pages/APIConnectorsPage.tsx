/**
 * API Connectors Page - Manage API service connections
 *
 * Configure connectors for external services like:
 * - Web Search (Serper, Brave, Tavily)
 * - Web Scraping (ZenRows)
 * - Other API services
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Form, Badge, Alert } from 'react-bootstrap';
import {
  Plus,
  Key,
  Globe,
  Search,
  Trash2,
  Edit2,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '../components/layout';

interface APIConnector {
  name: string;
  serviceType: string;
  displayName?: string;
  auth: {
    type: 'api_key';
    apiKey: string;
    headerName?: string;
    headerPrefix?: string;
  };
  baseURL?: string;
  createdAt: number;
  updatedAt: number;
}

// Service type metadata
const SERVICE_TYPES: Record<
  string,
  {
    name: string;
    category: string;
    description: string;
    defaultBaseURL?: string;
    docsUrl?: string;
    icon: React.ReactNode;
  }
> = {
  serper: {
    name: 'Serper (Google Search)',
    category: 'Web Search',
    description: 'Google search results via Serper.dev API',
    defaultBaseURL: 'https://google.serper.dev',
    docsUrl: 'https://serper.dev',
    icon: <Search size={20} />,
  },
  'brave-search': {
    name: 'Brave Search',
    category: 'Web Search',
    description: "Brave's independent search index",
    defaultBaseURL: 'https://api.search.brave.com/res/v1',
    docsUrl: 'https://brave.com/search/api/',
    icon: <Search size={20} />,
  },
  tavily: {
    name: 'Tavily',
    category: 'Web Search',
    description: 'AI-optimized search with summaries',
    defaultBaseURL: 'https://api.tavily.com',
    docsUrl: 'https://tavily.com',
    icon: <Search size={20} />,
  },
  'rapidapi-websearch': {
    name: 'RapidAPI Web Search',
    category: 'Web Search',
    description: 'Real-time web search via RapidAPI',
    defaultBaseURL: 'https://real-time-web-search.p.rapidapi.com',
    docsUrl: 'https://rapidapi.com',
    icon: <Search size={20} />,
  },
  zenrows: {
    name: 'ZenRows',
    category: 'Web Scraping',
    description: 'Web scraping API with JS rendering',
    defaultBaseURL: 'https://api.zenrows.com/v1',
    docsUrl: 'https://zenrows.com',
    icon: <Globe size={20} />,
  },
};

// Group services by category
const SERVICE_CATEGORIES = Object.entries(SERVICE_TYPES).reduce(
  (acc, [key, value]) => {
    if (!acc[value.category]) {
      acc[value.category] = [];
    }
    acc[value.category].push({ key, ...value });
    return acc;
  },
  {} as Record<string, Array<{ key: string; name: string; description: string; defaultBaseURL?: string; docsUrl?: string; icon: React.ReactNode }>>
);

export function APIConnectorsPage(): React.ReactElement {
  const [connectors, setConnectors] = useState<APIConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<string | null>(null);
  const [editingConnector, setEditingConnector] = useState<APIConnector | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBaseURL, setFormBaseURL] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadConnectors = useCallback(async () => {
    try {
      const list = await window.hosea.apiConnector.list();
      setConnectors(list);
    } catch (error) {
      console.error('Failed to load API connectors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnectors();
  }, [loadConnectors]);

  const handleSelectServiceType = (serviceType: string) => {
    setSelectedServiceType(serviceType);
    const service = SERVICE_TYPES[serviceType];
    setFormName(serviceType);
    setFormBaseURL(service?.defaultBaseURL || '');
    setFormApiKey('');
    setFormError(null);
  };

  const handleAddConnector = async () => {
    if (!selectedServiceType || !formName.trim() || !formApiKey.trim()) {
      setFormError('Please fill in all required fields');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const result = await window.hosea.apiConnector.add({
        name: formName.trim(),
        serviceType: selectedServiceType,
        displayName: SERVICE_TYPES[selectedServiceType]?.name,
        auth: {
          type: 'api_key',
          apiKey: formApiKey.trim(),
        },
        baseURL: formBaseURL.trim() || undefined,
      });

      if (result.success) {
        setShowAddModal(false);
        setSelectedServiceType(null);
        setFormName('');
        setFormApiKey('');
        setFormBaseURL('');
        await loadConnectors();
      } else {
        setFormError(result.error || 'Failed to add connector');
      }
    } catch (error) {
      setFormError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleEditConnector = (connector: APIConnector) => {
    setEditingConnector(connector);
    setFormName(connector.name);
    setFormApiKey(connector.auth.apiKey);
    setFormBaseURL(connector.baseURL || '');
    setFormError(null);
    setShowEditModal(true);
  };

  const handleUpdateConnector = async () => {
    if (!editingConnector || !formApiKey.trim()) {
      setFormError('API key is required');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const result = await window.hosea.apiConnector.update(editingConnector.name, {
        auth: {
          type: 'api_key',
          apiKey: formApiKey.trim(),
        },
        baseURL: formBaseURL.trim() || undefined,
      });

      if (result.success) {
        setShowEditModal(false);
        setEditingConnector(null);
        await loadConnectors();
      } else {
        setFormError(result.error || 'Failed to update connector');
      }
    } catch (error) {
      setFormError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConnector = async (name: string) => {
    if (!confirm(`Delete connector "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const result = await window.hosea.apiConnector.delete(name);
      if (result.success) {
        await loadConnectors();
      } else {
        alert(result.error || 'Failed to delete connector');
      }
    } catch (error) {
      alert(String(error));
    }
  };

  const resetForm = () => {
    setSelectedServiceType(null);
    setFormName('');
    setFormApiKey('');
    setFormBaseURL('');
    setFormError(null);
  };

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="API Services" subtitle="Loading..." />
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

  return (
    <div className="page">
      <PageHeader
        title="API Services"
        subtitle="Configure API keys for external services used by tools"
      >
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} className="me-2" />
          Add Service
        </Button>
      </PageHeader>

      <div className="page__content">
        {/* Configured Connectors */}
        <div className="page-section">
          <div className="page-section__header">
            <div>
              <h3 className="page-section__title">Configured Services</h3>
              <p className="page-section__description">
                {connectors.length} service{connectors.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>

          {connectors.length === 0 ? (
            <div className="empty-state mt-4">
              <div className="empty-state__icon">
                <Key size={32} />
              </div>
              <h3 className="empty-state__title">No services configured</h3>
              <p className="empty-state__description">
                Add API keys for external services to enable tools like web search and web scraping.
              </p>
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} className="me-2" />
                Add Service
              </Button>
            </div>
          ) : (
            <div className="list mt-4">
              {connectors.map((connector) => {
                const service = SERVICE_TYPES[connector.serviceType];
                return (
                  <div key={connector.name} className="list__item">
                    <div
                      className="connector-card__icon"
                      style={{
                        backgroundColor: 'var(--color-success-bg)',
                        color: 'var(--color-success)',
                        width: 40,
                        height: 40,
                      }}
                    >
                      {service?.icon || <Key size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold">
                          {connector.displayName || service?.name || connector.serviceType}
                        </h4>
                        <Badge bg="success">
                          <CheckCircle size={12} className="me-1" />
                          Configured
                        </Badge>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Connector: <code>{connector.name}</code>
                        {connector.baseURL && (
                          <span className="ms-2">
                            | Base URL: <code>{connector.baseURL}</code>
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => handleEditConnector(connector)}
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteConnector(connector.name)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Available Services */}
        <div className="page-section">
          <h3 className="page-section__title">Available Services</h3>
          <p className="page-section__description">
            Services that can be configured for use with tools
          </p>

          {Object.entries(SERVICE_CATEGORIES).map(([category, services]) => (
            <div key={category} className="mt-4">
              <h5 className="text-sm text-muted mb-3">{category}</h5>
              <div className="grid grid--2-cols gap-3">
                {services.map((service) => {
                  const isConfigured = connectors.some(
                    (c) => c.serviceType === service.key
                  );
                  return (
                    <div
                      key={service.key}
                      className={`card ${isConfigured ? '' : 'card--hoverable'}`}
                      style={{ cursor: isConfigured ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (!isConfigured) {
                          handleSelectServiceType(service.key);
                          setShowAddModal(true);
                        }
                      }}
                    >
                      <div className="card__body">
                        <div className="d-flex align-items-start gap-3">
                          <div style={{ color: isConfigured ? 'var(--color-success)' : 'var(--color-muted)' }}>
                            {service.icon}
                          </div>
                          <div className="flex-1">
                            <div className="d-flex align-items-center gap-2">
                              <h6 className="mb-0">{service.name}</h6>
                              {isConfigured && (
                                <Badge bg="success" className="ms-auto">
                                  Configured
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-1 mb-0">
                              {service.description}
                            </p>
                            {service.docsUrl && (
                              <a
                                href={service.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={12} className="me-1" />
                                Documentation
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        show={showAddModal}
        onHide={() => {
          setShowAddModal(false);
          resetForm();
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedServiceType
              ? `Configure ${SERVICE_TYPES[selectedServiceType]?.name || selectedServiceType}`
              : 'Add API Service'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!selectedServiceType ? (
            <div>
              <p className="text-muted mb-3">Select a service to configure:</p>
              {Object.entries(SERVICE_CATEGORIES).map(([category, services]) => (
                <div key={category} className="mb-4">
                  <h6 className="text-muted mb-2">{category}</h6>
                  <div className="list">
                    {services.map((service) => {
                      const isConfigured = connectors.some(
                        (c) => c.serviceType === service.key
                      );
                      return (
                        <div
                          key={service.key}
                          className={`list__item ${isConfigured ? '' : 'list__item--clickable'}`}
                          onClick={() => !isConfigured && handleSelectServiceType(service.key)}
                          style={{ opacity: isConfigured ? 0.5 : 1 }}
                        >
                          <div style={{ color: 'var(--color-primary)' }}>
                            {service.icon}
                          </div>
                          <div className="flex-1">
                            <h6 className="mb-0 text-sm">{service.name}</h6>
                            <small className="text-muted">{service.description}</small>
                          </div>
                          {isConfigured && <Badge bg="secondary">Configured</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Form>
              {formError && <Alert variant="danger">{formError}</Alert>}

              <Form.Group className="mb-3">
                <Form.Label>Connector Name</Form.Label>
                <Form.Control
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., serper-main"
                />
                <Form.Text className="text-muted">
                  Unique identifier for this connector
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>API Key *</Form.Label>
                <Form.Control
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="Enter your API key"
                />
                {SERVICE_TYPES[selectedServiceType]?.docsUrl && (
                  <Form.Text>
                    Get your API key from{' '}
                    <a
                      href={SERVICE_TYPES[selectedServiceType].docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {SERVICE_TYPES[selectedServiceType].name}
                    </a>
                  </Form.Text>
                )}
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Base URL (optional)</Form.Label>
                <Form.Control
                  type="text"
                  value={formBaseURL}
                  onChange={(e) => setFormBaseURL(e.target.value)}
                  placeholder={SERVICE_TYPES[selectedServiceType]?.defaultBaseURL || 'https://api.example.com'}
                />
                <Form.Text className="text-muted">
                  Override the default API endpoint if needed
                </Form.Text>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          {selectedServiceType && (
            <Button variant="link" onClick={resetForm}>
              Back
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setShowAddModal(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          {selectedServiceType && (
            <Button variant="primary" onClick={handleAddConnector} disabled={saving}>
              {saving ? 'Saving...' : 'Add Service'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Edit {editingConnector?.displayName || editingConnector?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {formError && <Alert variant="danger">{formError}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Connector Name</Form.Label>
              <Form.Control type="text" value={formName} disabled />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>API Key *</Form.Label>
              <Form.Control
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="Enter new API key"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Base URL (optional)</Form.Label>
              <Form.Control
                type="text"
                value={formBaseURL}
                onChange={(e) => setFormBaseURL(e.target.value)}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdateConnector} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
