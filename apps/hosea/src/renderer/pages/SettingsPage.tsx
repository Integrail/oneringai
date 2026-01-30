/**
 * Settings Page - App configuration
 */

import React, { useState, useEffect } from 'react';
import { Card, Form, Nav, ButtonGroup, Button, Row, Col } from 'react-bootstrap';
import { Monitor, Palette, Bell, Shield, Info, Code } from 'lucide-react';
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

  const sections = [
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} /> },
    { id: 'behavior', label: 'Behavior', icon: <Monitor size={18} /> },
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
                          <td>@oneringai/agents</td>
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
