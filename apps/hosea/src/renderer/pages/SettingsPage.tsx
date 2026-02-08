/**
 * Settings Page - App configuration
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Nav, ButtonGroup, Button, Row, Col, Badge, Spinner, Alert } from 'react-bootstrap';
import { Monitor, Palette, Bell, Shield, Info, Code, Cloud, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '../components/layout';

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface AppConfig {
  logLevel: LogLevel;
  ui: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    streamResponses: boolean;
  };
}

const defaultConfig: AppConfig = {
  logLevel: 'info',
  ui: {
    theme: 'system',
    fontSize: 14,
    streamResponses: true,
  },
};

export function SettingsPage(): React.ReactElement {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [activeSection, setActiveSection] = useState('appearance');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const cfg = (await window.hosea.config.get()) as AppConfig;
    if (cfg) {
      setConfig(cfg);
    }
  };

  const handleConfigChange = async (key: string, value: unknown) => {
    await window.hosea.config.set(key, value);
    loadConfig();
  };

  // Everworker Backend state
  const [ewUrl, setEwUrl] = useState('');
  const [ewToken, setEwToken] = useState('');
  const [ewEnabled, setEwEnabled] = useState(false);
  const [ewTesting, setEwTesting] = useState(false);
  const [ewSyncing, setEwSyncing] = useState(false);
  const [ewTestResult, setEwTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [ewSyncResult, setEwSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [ewSaving, setEwSaving] = useState(false);

  useEffect(() => {
    if (activeSection === 'everworker') {
      loadEWConfig();
    }
  }, [activeSection]);

  const loadEWConfig = async () => {
    const cfg = await window.hosea.everworker.getConfig();
    if (cfg) {
      setEwUrl(cfg.url);
      setEwToken(cfg.token);
      setEwEnabled(cfg.enabled);
    }
  };

  const handleSaveEWConfig = async () => {
    setEwSaving(true);
    setEwTestResult(null);
    try {
      const result = await window.hosea.everworker.setConfig({
        url: ewUrl.replace(/\/+$/, ''), // Remove trailing slashes
        token: ewToken,
        enabled: ewEnabled,
      });
      if (result.success) {
        setEwTestResult({ success: true, message: 'Configuration saved successfully.' });
      } else {
        setEwTestResult({ success: false, message: result.error || 'Failed to save configuration.' });
      }
    } catch (error) {
      setEwTestResult({ success: false, message: String(error) });
    }
    setEwSaving(false);
  };

  const handleTestEWConnection = async () => {
    setEwTesting(true);
    setEwTestResult(null);
    try {
      // Save first, then test
      await window.hosea.everworker.setConfig({
        url: ewUrl.replace(/\/+$/, ''),
        token: ewToken,
        enabled: true,
      });
      setEwEnabled(true);
      const result = await window.hosea.everworker.testConnection();
      if (result.success) {
        setEwTestResult({
          success: true,
          message: `Connection successful! ${result.connectorCount} connector(s) available.`,
        });
      } else {
        setEwTestResult({ success: false, message: result.error || 'Connection failed.' });
      }
    } catch (error) {
      setEwTestResult({ success: false, message: String(error) });
    }
    setEwTesting(false);
  };

  const handleSyncEWConnectors = async () => {
    setEwSyncing(true);
    setEwSyncResult(null);
    try {
      const result = await window.hosea.everworker.syncConnectors();
      if (result.success) {
        setEwSyncResult({
          success: true,
          message: `Sync complete: ${result.added} added, ${result.updated ?? 0} updated, ${result.removed} removed.`,
        });
      } else {
        setEwSyncResult({ success: false, message: result.error || 'Sync failed.' });
      }
    } catch (error) {
      setEwSyncResult({ success: false, message: String(error) });
    }
    setEwSyncing(false);
  };

  const sections = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'behavior', label: 'Behavior', icon: <Monitor size={18} /> },
    { id: 'everworker', label: 'Everworker Backend', icon: <Cloud size={18} /> },
    { id: 'developer', label: 'Developer', icon: <Code size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'privacy', label: 'Privacy', icon: <Shield size={18} /> },
    { id: 'about', label: 'About', icon: <Info size={18} /> },
  ];

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Configure your HOSEA experience" />

      <div className="page__content">
        <Row>
          {/* Sidebar */}
          <Col md={3} lg={2}>
            <Nav variant="pills" className="flex-column">
              {sections.map((section) => (
                <Nav.Item key={section.id}>
                  <Nav.Link
                    active={activeSection === section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="d-flex align-items-center gap-2"
                  >
                    {section.icon}
                    {section.label}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          </Col>

          {/* Content */}
          <Col md={9} lg={10}>
            {activeSection === 'appearance' && (
              <div>
                <h3 className="h5 mb-1">Appearance</h3>
                <p className="text-muted mb-4">Customize how HOSEA looks</p>

                <Card>
                  <Card.Body>
                    <Form.Group className="mb-4">
                      <Form.Label>Theme</Form.Label>
                      <div>
                        <ButtonGroup>
                          {['light', 'dark', 'system'].map((theme) => (
                            <Button
                              key={theme}
                              variant={config.ui.theme === theme ? 'primary' : 'outline-secondary'}
                              onClick={() => handleConfigChange('ui.theme', theme)}
                            >
                              {theme.charAt(0).toUpperCase() + theme.slice(1)}
                            </Button>
                          ))}
                        </ButtonGroup>
                      </div>
                    </Form.Group>

                    <Form.Group>
                      <Form.Label>Font Size: {config.ui.fontSize}px</Form.Label>
                      <Form.Range
                        min={12}
                        max={20}
                        value={config.ui.fontSize}
                        onChange={(e) =>
                          handleConfigChange('ui.fontSize', parseInt(e.target.value))
                        }
                        style={{ maxWidth: 300 }}
                      />
                    </Form.Group>
                  </Card.Body>
                </Card>
              </div>
            )}

            {activeSection === 'behavior' && (
              <div>
                <h3 className="h5 mb-1">Behavior</h3>
                <p className="text-muted mb-4">Configure how the app behaves</p>

                <Card>
                  <Card.Body>
                    <Form.Check
                      type="switch"
                      id="stream-responses"
                      label="Stream responses"
                      checked={config.ui.streamResponses}
                      onChange={(e) =>
                        handleConfigChange('ui.streamResponses', e.target.checked)
                      }
                    />
                    <Form.Text className="text-muted">
                      Show AI responses as they are generated
                    </Form.Text>
                  </Card.Body>
                </Card>
              </div>
            )}

            {activeSection === 'everworker' && (
              <div>
                <h3 className="h5 mb-1">Everworker Backend</h3>
                <p className="text-muted mb-4">
                  Connect to an Everworker backend to use centrally managed AI connectors. API keys are stored on
                  the server - your desktop app authenticates with a JWT token.
                </p>

                <Card className="mb-3">
                  <Card.Body>
                    <Form.Check
                      type="switch"
                      id="ew-enabled"
                      label="Enable Everworker Backend"
                      checked={ewEnabled}
                      onChange={(e) => setEwEnabled(e.target.checked)}
                      className="mb-3"
                    />

                    <Form.Group className="mb-3">
                      <Form.Label>Backend URL</Form.Label>
                      <Form.Control
                        type="url"
                        placeholder="https://ew.company.com"
                        value={ewUrl}
                        onChange={(e) => setEwUrl(e.target.value)}
                        disabled={!ewEnabled}
                      />
                      <Form.Text className="text-muted">
                        The URL of your Everworker backend instance
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>JWT Token</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="eyJhbGciOiJ..."
                        value={ewToken}
                        onChange={(e) => setEwToken(e.target.value)}
                        disabled={!ewEnabled}
                      />
                      <Form.Text className="text-muted">
                        A JWT token with <code>llm:proxy</code> scope, generated from the Everworker admin panel
                      </Form.Text>
                    </Form.Group>

                    <div className="d-flex gap-2">
                      <Button
                        variant="primary"
                        onClick={handleSaveEWConfig}
                        disabled={ewSaving || !ewUrl}
                      >
                        {ewSaving ? <Spinner animation="border" size="sm" className="me-2" /> : null}
                        Save
                      </Button>
                      <Button
                        variant="outline-primary"
                        onClick={handleTestEWConnection}
                        disabled={ewTesting || !ewUrl || !ewToken}
                      >
                        {ewTesting ? (
                          <Spinner animation="border" size="sm" className="me-2" />
                        ) : (
                          <CheckCircle size={16} className="me-2" />
                        )}
                        Test Connection
                      </Button>
                      <Button
                        variant="outline-secondary"
                        onClick={handleSyncEWConnectors}
                        disabled={ewSyncing || !ewEnabled || !ewUrl || !ewToken}
                      >
                        {ewSyncing ? (
                          <Spinner animation="border" size="sm" className="me-2" />
                        ) : (
                          <RefreshCw size={16} className="me-2" />
                        )}
                        Sync Connectors
                      </Button>
                    </div>

                    {ewTestResult && (
                      <Alert
                        variant={ewTestResult.success ? 'success' : 'danger'}
                        className="mt-3 mb-0"
                        dismissible
                        onClose={() => setEwTestResult(null)}
                      >
                        {ewTestResult.success ? (
                          <CheckCircle size={16} className="me-2" />
                        ) : (
                          <XCircle size={16} className="me-2" />
                        )}
                        {ewTestResult.message}
                      </Alert>
                    )}

                    {ewSyncResult && (
                      <Alert
                        variant={ewSyncResult.success ? 'success' : 'danger'}
                        className="mt-3 mb-0"
                        dismissible
                        onClose={() => setEwSyncResult(null)}
                      >
                        {ewSyncResult.success ? (
                          <CheckCircle size={16} className="me-2" />
                        ) : (
                          <XCircle size={16} className="me-2" />
                        )}
                        {ewSyncResult.message}
                      </Alert>
                    )}
                  </Card.Body>
                </Card>

                <Card>
                  <Card.Body>
                    <h6 className="mb-2">How it works</h6>
                    <ul className="text-muted small mb-0">
                      <li>API keys for AI providers (OpenAI, Anthropic, etc.) are managed centrally on the Everworker server</li>
                      <li>Your desktop app connects through the EW proxy - no API keys stored locally</li>
                      <li>Both local and Everworker connectors can coexist (mixed mode)</li>
                      <li>Everworker connectors appear with a <Badge bg="info" className="ms-1">EW</Badge> badge in the connectors list</li>
                      <li>Usage is tracked per user on the backend</li>
                    </ul>
                  </Card.Body>
                </Card>
              </div>
            )}

            {activeSection === 'developer' && (
              <div>
                <h3 className="h5 mb-1">Developer Settings</h3>
                <p className="text-muted mb-4">Options for debugging and development</p>

                <Card>
                  <Card.Body>
                    <Form.Group className="mb-4">
                      <Form.Label>Log Level</Form.Label>
                      <Form.Select
                        value={config.logLevel}
                        onChange={(e) =>
                          handleConfigChange('logLevel', e.target.value as LogLevel)
                        }
                        style={{ maxWidth: 200 }}
                      >
                        <option value="trace">Trace</option>
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                        <option value="silent">Silent</option>
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Set the verbosity of logs in the terminal. Debug level is recommended during development.
                      </Form.Text>
                    </Form.Group>
                  </Card.Body>
                </Card>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div>
                <h3 className="h5 mb-1">Notifications</h3>
                <p className="text-muted mb-4">Manage notification preferences</p>

                <Card>
                  <Card.Body>
                    <p className="text-muted text-center mb-0">Notification settings coming soon...</p>
                  </Card.Body>
                </Card>
              </div>
            )}

            {activeSection === 'privacy' && (
              <div>
                <h3 className="h5 mb-1">Privacy</h3>
                <p className="text-muted mb-4">Control your data and privacy</p>

                <Card>
                  <Card.Body>
                    <p className="text-muted text-center mb-0">Privacy settings coming soon...</p>
                  </Card.Body>
                </Card>
              </div>
            )}

            {activeSection === 'about' && (
              <div>
                <h3 className="h5 mb-1">About HOSEA</h3>
                <p className="text-muted mb-4">Human-Oriented System for Engaging Agents</p>

                <Card>
                  <Card.Body className="text-center">
                    <div
                      className="sidebar__logo mx-auto mb-3"
                      style={{ width: 60, height: 60, fontSize: 24 }}
                    >
                      H
                    </div>
                    <h4>HOSEA</h4>
                    <p className="text-muted mb-4">Version 0.1.0</p>

                    <table className="table table-sm mb-0">
                      <tbody>
                        <tr>
                          <td className="text-muted">Built with</td>
                          <td>@everworker/oneringai</td>
                        </tr>
                        <tr>
                          <td className="text-muted">Electron</td>
                          <td>29.0.0</td>
                        </tr>
                        <tr>
                          <td className="text-muted">React</td>
                          <td>18.2.0</td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </div>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
}
