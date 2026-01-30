/**
 * Tool Connectors Page - Manage external tool connections (MCP, APIs)
 */

import React, { useState } from 'react';
import { Button, Modal, Card, Badge } from 'react-bootstrap';
import { Plus, Plug, Server, Globe, Database, Code } from 'lucide-react';
import { PageHeader } from '../components/layout';

interface ToolConnector {
  id: string;
  name: string;
  type: 'mcp' | 'api' | 'database' | 'custom';
  status: 'connected' | 'disconnected' | 'error';
  toolsCount: number;
  description: string;
}

// Placeholder data
const mockConnectors: ToolConnector[] = [
  {
    id: '1',
    name: 'Filesystem',
    type: 'mcp',
    status: 'connected',
    toolsCount: 6,
    description: 'Local filesystem access (read, write, search)',
  },
  {
    id: '2',
    name: 'GitHub',
    type: 'api',
    status: 'connected',
    toolsCount: 12,
    description: 'GitHub API integration',
  },
];

const typeInfo: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  mcp: { icon: <Server size={20} />, label: 'MCP Server', color: 'var(--color-primary)' },
  api: { icon: <Globe size={20} />, label: 'API', color: 'var(--color-success)' },
  database: { icon: <Database size={20} />, label: 'Database', color: 'var(--color-warning)' },
  custom: { icon: <Code size={20} />, label: 'Custom', color: 'var(--color-info)' },
};

export function ToolConnectorsPage(): React.ReactElement {
  const [connectors] = useState<ToolConnector[]>(mockConnectors);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  return (
    <div className="page">
      <PageHeader
        title="External Tools"
        subtitle="Connect external tools and services to your agents"
      >
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} className="me-2" />
          Add Connection
        </Button>
      </PageHeader>

      <div className="page__content">
        {/* Connection Types Overview */}
        <div className="page-section">
          <h3 className="page-section__title">Connection Types</h3>
          <div className="grid grid--4-cols mt-4">
            {Object.entries(typeInfo).map(([type, info]) => (
              <div
                key={type}
                className={`card card--hoverable ${selectedType === type ? 'card--selected' : ''}`}
                onClick={() => setSelectedType(selectedType === type ? null : type)}
                style={{ cursor: 'pointer' }}
              >
                <div className="card__body text-center">
                  <div
                    className="empty-state__icon"
                    style={{
                      backgroundColor: `${info.color}15`,
                      color: info.color,
                      margin: '0 auto var(--spacing-3)',
                    }}
                  >
                    {info.icon}
                  </div>
                  <h4 className="text-sm font-semibold">{info.label}</h4>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Connections */}
        <div className="page-section">
          <div className="page-section__header">
            <div>
              <h3 className="page-section__title">Active Connections</h3>
              <p className="page-section__description">
                {connectors.length} tool {connectors.length === 1 ? 'connection' : 'connections'} configured
              </p>
            </div>
          </div>

          {connectors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <Plug size={32} />
              </div>
              <h3 className="empty-state__title">No tool connections</h3>
              <p className="empty-state__description">
                Connect external tools like MCP servers, APIs, or databases to extend
                your agents&apos; capabilities.
              </p>
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} className="me-2" />
                Add Connection
              </Button>
            </div>
          ) : (
            <div className="list">
              {connectors
                .filter((c) => !selectedType || c.type === selectedType)
                .map((connector) => {
                  const info = typeInfo[connector.type];
                  return (
                    <div key={connector.id} className="list__item list__item--clickable">
                      <div
                        className="connector-card__icon"
                        style={{
                          backgroundColor: `${info.color}15`,
                          color: info.color,
                          width: 40,
                          height: 40,
                        }}
                      >
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold">{connector.name}</h4>
                          <Badge bg="secondary">{info.label}</Badge>
                        </div>
                        <p className="text-xs text-muted mt-1">{connector.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted">{connector.toolsCount} tools</span>
                        <span className={`status-indicator`}>
                          <span
                            className={`status-indicator__dot ${
                              connector.status === 'connected'
                                ? 'status-indicator__dot--online'
                                : connector.status === 'error'
                                ? 'status-indicator__dot--error'
                                : 'status-indicator__dot--offline'
                            }`}
                          />
                          {connector.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add Tool Connection</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-4">Select a connection type to get started:</p>
          <div className="grid grid--2-cols gap-3">
            {Object.entries(typeInfo).map(([type, info]) => (
              <Card
                key={type}
                className="card--hoverable"
                style={{ cursor: 'pointer' }}
              >
                <Card.Body>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ color: info.color }}>{info.icon}</div>
                    <div>
                      <h6 className="mb-0">{info.label}</h6>
                      <small className="text-muted">Configure {info.label.toLowerCase()}</small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
