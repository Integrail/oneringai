/**
 * LLM Connectors Page - Manage LLM provider connections
 */

import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import { Plus, Brain, Key, Trash2, Check } from 'lucide-react';
import { PageHeader } from '../components/layout';

interface ConnectorConfig {
  name: string;
  vendor: string;
  createdAt: number;
}

// Vendor icons and colors
const vendorInfo: Record<string, { color: string; label: string }> = {
  openai: { color: '#10a37f', label: 'OpenAI' },
  anthropic: { color: '#d4a27f', label: 'Anthropic' },
  google: { color: '#4285f4', label: 'Google' },
  groq: { color: '#f55036', label: 'Groq' },
  together: { color: '#6366f1', label: 'Together' },
  mistral: { color: '#ff7000', label: 'Mistral' },
  deepseek: { color: '#0066ff', label: 'DeepSeek' },
};

export function LLMConnectorsPage(): React.ReactElement {
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newConnector, setNewConnector] = useState({
    name: '',
    vendor: 'openai',
    apiKey: '',
  });

  useEffect(() => {
    loadConnectors();
  }, []);

  const loadConnectors = async () => {
    const list = await window.hosea.connector.list();
    setConnectors(list);
  };

  const handleAddConnector = async () => {
    if (!newConnector.name || !newConnector.apiKey) return;

    const result = await window.hosea.connector.add({
      name: newConnector.name,
      vendor: newConnector.vendor,
      auth: {
        type: 'api_key',
        apiKey: newConnector.apiKey,
      },
    });

    if (result.success) {
      setShowAddModal(false);
      setNewConnector({ name: '', vendor: 'openai', apiKey: '' });
      loadConnectors();
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="LLM Providers"
        subtitle="Manage your AI model provider connections"
      >
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} className="me-2" />
          Add Provider
        </Button>
      </PageHeader>

      <div className="page__content">
        {connectors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Brain size={32} />
            </div>
            <h3 className="empty-state__title">No providers connected</h3>
            <p className="empty-state__description">
              Connect to an LLM provider like OpenAI, Anthropic, or Google to start
              using AI models in your agents.
            </p>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} className="me-2" />
              Add Provider
            </Button>
          </div>
        ) : (
          <div className="grid grid--auto">
            {connectors.map((connector) => {
              const info = vendorInfo[connector.vendor] || {
                color: '#64748b',
                label: connector.vendor,
              };
              return (
                <div key={connector.name} className="card connector-card">
                  <div className="card__body">
                    <div
                      className="connector-card__icon"
                      style={{ backgroundColor: `${info.color}15`, color: info.color }}
                    >
                      <Brain size={24} />
                    </div>
                    <h3 className="connector-card__name">{connector.name}</h3>
                    <p className="connector-card__vendor">{info.label}</p>
                    <div className="connector-card__status">
                      <span className="badge badge--success">
                        <Check size={12} />
                        Connected
                      </span>
                    </div>
                  </div>
                  <div className="card__footer">
                    <Button variant="outline-secondary" size="sm">
                      <Key size={14} className="me-1" />
                      Update Key
                    </Button>
                    <Button variant="outline-danger" size="sm">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add LLM Provider</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="my-openai"
              value={newConnector.name}
              onChange={(e) => setNewConnector({ ...newConnector, name: e.target.value })}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Provider</Form.Label>
            <Form.Select
              value={newConnector.vendor}
              onChange={(e) => setNewConnector({ ...newConnector, vendor: e.target.value })}
            >
              {Object.entries(vendorInfo).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>API Key</Form.Label>
            <Form.Control
              type="password"
              placeholder="sk-..."
              value={newConnector.apiKey}
              onChange={(e) => setNewConnector({ ...newConnector, apiKey: e.target.value })}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddConnector}>
            Add Provider
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
