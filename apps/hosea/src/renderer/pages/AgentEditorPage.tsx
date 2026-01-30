/**
 * Agent Editor Page - Create or edit an agent
 */

import React, { useState } from 'react';
import { Button, Form, Card, Nav, Row, Col } from 'react-bootstrap';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { useNavigation } from '../hooks/useNavigation';

interface AgentFormData {
  name: string;
  connector: string;
  model: string;
  instructions: string;
  temperature: number;
  maxIterations: number;
  tools: string[];
}

const defaultFormData: AgentFormData = {
  name: '',
  connector: '',
  model: '',
  instructions: '',
  temperature: 0.7,
  maxIterations: 10,
  tools: [],
};

export function AgentEditorPage(): React.ReactElement {
  const { state, goBack, navigate } = useNavigation();
  const isEditMode = state.params.mode === 'edit';
  const [formData, setFormData] = useState<AgentFormData>(defaultFormData);
  const [activeTab, setActiveTab] = useState<string>('general');

  const handleSave = () => {
    // TODO: Save agent
    console.log('Saving agent:', formData);
    navigate('agents');
  };

  const handleDelete = () => {
    // TODO: Delete agent
    if (confirm('Are you sure you want to delete this agent?')) {
      navigate('agents');
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={isEditMode ? 'Edit Agent' : 'Create Agent'}
        subtitle={isEditMode ? 'Modify your agent configuration' : 'Set up a new AI agent'}
        backButton={
          <Button variant="link" className="p-0 me-2" onClick={goBack}>
            <ArrowLeft size={20} />
          </Button>
        }
      >
        {isEditMode && (
          <Button variant="outline-danger" size="sm" className="me-2" onClick={handleDelete}>
            <Trash2 size={14} className="me-1" />
            Delete
          </Button>
        )}
        <Button variant="primary" onClick={handleSave}>
          <Save size={16} className="me-2" />
          Save Agent
        </Button>
      </PageHeader>

      <div className="page__content">
        {/* Tabs */}
        <Nav variant="tabs" className="mb-4" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'general')}>
          <Nav.Item>
            <Nav.Link eventKey="general">General</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="tools">Tools</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="advanced">Advanced</Nav.Link>
          </Nav.Item>
        </Nav>

        {/* General Tab */}
        {activeTab === 'general' && (
          <Card>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Agent Name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="My Assistant"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Connector</Form.Label>
                    <Form.Select
                      value={formData.connector}
                      onChange={(e) => setFormData({ ...formData, connector: e.target.value })}
                    >
                      <option value="">Select connector...</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Model</Form.Label>
                    <Form.Select
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    >
                      <option value="">Select model...</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Temperature: {formData.temperature}</Form.Label>
                    <Form.Range
                      min={0}
                      max={2}
                      step={0.1}
                      value={formData.temperature}
                      onChange={(e) =>
                        setFormData({ ...formData, temperature: parseFloat(e.target.value) })
                      }
                    />
                  </Form.Group>
                </Col>

                <Col xs={12}>
                  <Form.Group>
                    <Form.Label>System Instructions</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={6}
                      placeholder="You are a helpful assistant..."
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <Card>
            <Card.Body>
              <p className="text-muted">
                Select which tools this agent can use. Tools enable the agent to perform
                actions like reading files, searching the web, or executing code.
              </p>
              <div className="mt-4 text-center">
                <p className="text-muted">Tool selection coming soon...</p>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <Card>
            <Card.Body>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Max Iterations</Form.Label>
                    <Form.Control
                      type="number"
                      min={1}
                      max={50}
                      value={formData.maxIterations}
                      onChange={(e) =>
                        setFormData({ ...formData, maxIterations: parseInt(e.target.value) })
                      }
                    />
                    <Form.Text className="text-muted">
                      Maximum number of tool-use iterations per request
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}
      </div>
    </div>
  );
}
