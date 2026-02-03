/**
 * TransportConfigForm Component
 *
 * Dynamic form for configuring MCP server transport (stdio or http).
 */

import React from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import { Plus, Trash2, Terminal, Globe } from 'lucide-react';

export type TransportType = 'stdio' | 'http' | 'https';

export interface TransportConfig {
  // Stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // HTTP transport
  url?: string;
  token?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

interface TransportConfigFormProps {
  /** Current transport type */
  transport: TransportType;
  /** Current transport configuration */
  config: TransportConfig;
  /** Handler for transport type change */
  onTransportChange: (transport: TransportType) => void;
  /** Handler for config change */
  onConfigChange: (config: TransportConfig) => void;
  /** Whether form is disabled */
  disabled?: boolean;
}

export function TransportConfigForm({
  transport,
  config,
  onTransportChange,
  onConfigChange,
  disabled = false,
}: TransportConfigFormProps): React.ReactElement {
  // Env vars as array for editing
  const envEntries = Object.entries(config.env || {});

  const updateConfig = (updates: Partial<TransportConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const addEnvVar = () => {
    const newEnv = { ...config.env, [`VAR_${Date.now()}`]: '' };
    updateConfig({ env: newEnv });
  };

  const removeEnvVar = (key: string) => {
    const newEnv = { ...config.env };
    delete newEnv[key];
    updateConfig({ env: newEnv });
  };

  const updateEnvVar = (oldKey: string, newKey: string, value: string) => {
    const newEnv = { ...config.env };
    if (oldKey !== newKey) {
      delete newEnv[oldKey];
    }
    newEnv[newKey] = value;
    updateConfig({ env: newEnv });
  };

  const addHeader = () => {
    const newHeaders = { ...config.headers, [`X-Header-${Date.now()}`]: '' };
    updateConfig({ headers: newHeaders });
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...config.headers };
    delete newHeaders[key];
    updateConfig({ headers: newHeaders });
  };

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...config.headers };
    if (oldKey !== newKey) {
      delete newHeaders[oldKey];
    }
    newHeaders[newKey] = value;
    updateConfig({ headers: newHeaders });
  };

  const headerEntries = Object.entries(config.headers || {});

  return (
    <div className="transport-config-form">
      {/* Transport Type Selection */}
      <Form.Group className="mb-3">
        <Form.Label>Transport Type</Form.Label>
        <div className="transport-type-selector">
          <button
            type="button"
            className={`transport-type-option ${transport === 'stdio' ? 'active' : ''}`}
            onClick={() => onTransportChange('stdio')}
            disabled={disabled}
          >
            <Terminal size={20} />
            <div>
              <div className="transport-type-option__name">Stdio</div>
              <div className="transport-type-option__desc">Local process</div>
            </div>
          </button>
          <button
            type="button"
            className={`transport-type-option ${transport === 'http' || transport === 'https' ? 'active' : ''}`}
            onClick={() => onTransportChange('https')}
            disabled={disabled}
          >
            <Globe size={20} />
            <div>
              <div className="transport-type-option__name">HTTP(S)</div>
              <div className="transport-type-option__desc">Remote server</div>
            </div>
          </button>
        </div>
      </Form.Group>

      {/* Stdio Configuration */}
      {transport === 'stdio' && (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Command *</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., npx, node, python"
              value={config.command || ''}
              onChange={(e) => updateConfig({ command: e.target.value })}
              disabled={disabled}
            />
            <Form.Text className="text-muted">
              The executable command to run the MCP server
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Arguments</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., -y @modelcontextprotocol/server-filesystem /path/to/dir"
              value={config.args?.join(' ') || ''}
              onChange={(e) => updateConfig({
                args: e.target.value ? e.target.value.split(' ').filter(Boolean) : undefined,
              })}
              disabled={disabled}
            />
            <Form.Text className="text-muted">
              Space-separated command line arguments
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Working Directory</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g., /path/to/project"
              value={config.cwd || ''}
              onChange={(e) => updateConfig({ cwd: e.target.value || undefined })}
              disabled={disabled}
            />
            <Form.Text className="text-muted">
              Optional working directory for the process
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Environment Variables</Form.Label>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={addEnvVar}
                disabled={disabled}
              >
                <Plus size={14} className="me-1" />
                Add
              </Button>
            </div>
            {envEntries.length === 0 ? (
              <div className="text-muted small">No environment variables configured</div>
            ) : (
              envEntries.map(([key, value], idx) => (
                <Row key={idx} className="mb-2">
                  <Col xs={5}>
                    <Form.Control
                      type="text"
                      placeholder="KEY"
                      value={key}
                      onChange={(e) => updateEnvVar(key, e.target.value, value)}
                      disabled={disabled}
                      size="sm"
                    />
                  </Col>
                  <Col xs={5}>
                    <Form.Control
                      type="text"
                      placeholder="value"
                      value={value}
                      onChange={(e) => updateEnvVar(key, key, e.target.value)}
                      disabled={disabled}
                      size="sm"
                    />
                  </Col>
                  <Col xs={2}>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeEnvVar(key)}
                      disabled={disabled}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Col>
                </Row>
              ))
            )}
          </Form.Group>
        </>
      )}

      {/* HTTP Configuration */}
      {(transport === 'http' || transport === 'https') && (
        <>
          <Form.Group className="mb-3">
            <Form.Label>URL *</Form.Label>
            <Form.Control
              type="url"
              placeholder="https://mcp-server.example.com/mcp"
              value={config.url || ''}
              onChange={(e) => updateConfig({ url: e.target.value })}
              disabled={disabled}
            />
            <Form.Text className="text-muted">
              The HTTP(S) endpoint URL for the MCP server
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Bearer Token</Form.Label>
            <Form.Control
              type="password"
              placeholder="Optional authentication token"
              value={config.token || ''}
              onChange={(e) => updateConfig({ token: e.target.value || undefined })}
              disabled={disabled}
            />
            <Form.Text className="text-muted">
              Optional Bearer token for authentication
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Timeout (ms)</Form.Label>
            <Form.Control
              type="number"
              placeholder="30000"
              value={config.timeoutMs || ''}
              onChange={(e) => updateConfig({
                timeoutMs: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })}
              disabled={disabled}
            />
            <Form.Text className="text-muted">
              Request timeout in milliseconds (default: 30000)
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="mb-0">Custom Headers</Form.Label>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={addHeader}
                disabled={disabled}
              >
                <Plus size={14} className="me-1" />
                Add
              </Button>
            </div>
            {headerEntries.length === 0 ? (
              <div className="text-muted small">No custom headers configured</div>
            ) : (
              headerEntries.map(([key, value], idx) => (
                <Row key={idx} className="mb-2">
                  <Col xs={5}>
                    <Form.Control
                      type="text"
                      placeholder="Header-Name"
                      value={key}
                      onChange={(e) => updateHeader(key, e.target.value, value)}
                      disabled={disabled}
                      size="sm"
                    />
                  </Col>
                  <Col xs={5}>
                    <Form.Control
                      type="text"
                      placeholder="value"
                      value={value}
                      onChange={(e) => updateHeader(key, key, e.target.value)}
                      disabled={disabled}
                      size="sm"
                    />
                  </Col>
                  <Col xs={2}>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeHeader(key)}
                      disabled={disabled}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </Col>
                </Row>
              ))
            )}
          </Form.Group>
        </>
      )}
    </div>
  );
}

export default TransportConfigForm;
