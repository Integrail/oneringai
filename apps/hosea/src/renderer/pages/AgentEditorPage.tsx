/**
 * Agent Editor Page - Create or edit an agent
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Form,
  Card,
  Nav,
  Row,
  Col,
  Badge,
  OverlayTrigger,
  Tooltip,
  Alert,
} from 'react-bootstrap';
import { ArrowLeft, Save, Trash2, HelpCircle, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { useNavigation } from '../hooks/useNavigation';

// Agent types available in oneringai
type AgentType = 'basic' | 'task' | 'research' | 'universal';

const AGENT_TYPES: { value: AgentType; label: string; description: string }[] = [
  {
    value: 'basic',
    label: 'Basic',
    description: 'Simple agent for single-turn interactions with tool support',
  },
  {
    value: 'task',
    label: 'Task',
    description: 'Task-based agent with planning, memory, and checkpoints',
  },
  {
    value: 'research',
    label: 'Research',
    description: 'Research agent with pluggable sources (web, file, vector, etc.)',
  },
  {
    value: 'universal',
    label: 'Universal',
    description: 'Interactive agent with multiple modes (chat, planning, executing)',
  },
];

// Context strategies with descriptions
const CONTEXT_STRATEGIES: {
  value: string;
  label: string;
  threshold: string;
  description: string;
}[] = [
  {
    value: 'proactive',
    label: 'Proactive',
    threshold: '75%',
    description:
      'Balanced strategy. Compacts context when 75% full. Good default for most use cases.',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    threshold: '60%',
    description:
      'Memory-constrained strategy. Compacts early at 60% to ensure space for long conversations.',
  },
  {
    value: 'lazy',
    label: 'Lazy',
    threshold: '90%',
    description:
      'Preserves maximum context. Only compacts at 90% - best when you need full conversation history.',
  },
  {
    value: 'rolling-window',
    label: 'Rolling Window',
    threshold: 'N messages',
    description:
      'Fixed window approach. Keeps only the last N messages regardless of token count.',
  },
  {
    value: 'adaptive',
    label: 'Adaptive',
    threshold: 'Learns',
    description:
      'Machine learning-based. Auto-adjusts threshold based on conversation patterns.',
  },
];

interface ToolInfo {
  name: string;
  displayName: string;
  category: string;
  description: string;
  safeByDefault: boolean;
  requiresConnector: boolean;
  connectorServiceTypes?: string[];
}

interface APIConnector {
  name: string;
  serviceType: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextWindow: number;
}

interface AgentFormData {
  name: string;
  connector: string;
  model: string;
  agentType: AgentType;
  instructions: string;
  temperature: number;
  // Context settings
  contextStrategy: string;
  maxContextTokens: number;
  responseReserve: number;
  // Memory settings
  memoryEnabled: boolean;
  maxMemorySizeBytes: number;
  memorySoftLimitPercent: number;
  contextAllocationPercent: number;
  // In-context memory
  inContextMemoryEnabled: boolean;
  maxInContextEntries: number;
  maxInContextTokens: number;
  // Persistent instructions
  persistentInstructionsEnabled: boolean;
  // History settings
  historyEnabled: boolean;
  maxHistoryMessages: number;
  preserveRecent: number;
  // Cache settings
  cacheEnabled: boolean;
  cacheTtlMs: number;
  cacheMaxEntries: number;
  // Tool permissions
  permissionsEnabled: boolean;
  // Selected tools
  tools: string[];
}

const defaultFormData: AgentFormData = {
  name: '',
  connector: '',
  model: '',
  agentType: 'universal',
  instructions: '',
  temperature: 0.7,
  // Context settings
  contextStrategy: 'proactive',
  maxContextTokens: 128000,
  responseReserve: 4096,
  // Memory settings
  memoryEnabled: true,
  maxMemorySizeBytes: 25 * 1024 * 1024, // 25MB
  memorySoftLimitPercent: 80,
  contextAllocationPercent: 10,
  // In-context memory
  inContextMemoryEnabled: false,
  maxInContextEntries: 20,
  maxInContextTokens: 4000,
  // Persistent instructions
  persistentInstructionsEnabled: false,
  // History settings
  historyEnabled: true,
  maxHistoryMessages: 100,
  preserveRecent: 10,
  // Cache settings
  cacheEnabled: true,
  cacheTtlMs: 300000, // 5 minutes
  cacheMaxEntries: 1000,
  // Tool permissions
  permissionsEnabled: true,
  // Tools
  tools: [],
};

export function AgentEditorPage(): React.ReactElement {
  const { state, goBack, navigate } = useNavigation();
  const isEditMode = state.params.mode === 'edit';
  const agentId = state.params.id as string | undefined;
  const [formData, setFormData] = useState<AgentFormData>(defaultFormData);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [saving, setSaving] = useState(false);

  // Data from API
  const [connectors, setConnectors] = useState<{ name: string; vendor: string }[]>([]);
  const [modelsByVendor, setModelsByVendor] = useState<
    { vendor: string; models: ModelInfo[] }[]
  >([]);
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
  const [apiConnectors, setAPIConnectors] = useState<APIConnector[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [connectorsList, models, tools, apiConns] = await Promise.all([
          window.hosea.connector.list(),
          window.hosea.model.list(),
          window.hosea.tool.registry(),
          window.hosea.apiConnector.list(),
        ]);
        setConnectors(connectorsList);
        setModelsByVendor(models);
        setAvailableTools(tools);
        setAPIConnectors(apiConns);

        // Load existing agent data if in edit mode
        if (isEditMode && agentId) {
          const existingAgent = await window.hosea.agentConfig.get(agentId);
          if (existingAgent) {
            setFormData({
              name: existingAgent.name,
              connector: existingAgent.connector,
              model: existingAgent.model,
              agentType: existingAgent.agentType,
              instructions: existingAgent.instructions,
              temperature: existingAgent.temperature,
              contextStrategy: existingAgent.contextStrategy,
              maxContextTokens: existingAgent.maxContextTokens,
              responseReserve: existingAgent.responseReserve,
              memoryEnabled: existingAgent.memoryEnabled,
              maxMemorySizeBytes: existingAgent.maxMemorySizeBytes,
              memorySoftLimitPercent: existingAgent.memorySoftLimitPercent,
              contextAllocationPercent: existingAgent.contextAllocationPercent,
              inContextMemoryEnabled: existingAgent.inContextMemoryEnabled,
              maxInContextEntries: existingAgent.maxInContextEntries,
              maxInContextTokens: existingAgent.maxInContextTokens,
              persistentInstructionsEnabled: existingAgent.persistentInstructionsEnabled ?? false,
              historyEnabled: existingAgent.historyEnabled,
              maxHistoryMessages: existingAgent.maxHistoryMessages,
              preserveRecent: existingAgent.preserveRecent,
              cacheEnabled: existingAgent.cacheEnabled,
              cacheTtlMs: existingAgent.cacheTtlMs,
              cacheMaxEntries: existingAgent.cacheMaxEntries,
              permissionsEnabled: existingAgent.permissionsEnabled,
              tools: existingAgent.tools,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [isEditMode, agentId]);

  // Get models for selected connector's vendor
  const getModelsForConnector = useCallback((): ModelInfo[] => {
    const connector = connectors.find((c) => c.name === formData.connector);
    if (!connector) return [];

    const vendorModels = modelsByVendor.find(
      (v) => v.vendor.toLowerCase() === connector.vendor.toLowerCase()
    );
    return vendorModels?.models || [];
  }, [connectors, formData.connector, modelsByVendor]);

  // Update maxContextTokens when model changes
  useEffect(() => {
    const models = getModelsForConnector();
    const selectedModel = models.find((m) => m.id === formData.model);
    if (selectedModel && selectedModel.contextWindow !== formData.maxContextTokens) {
      setFormData((prev) => ({
        ...prev,
        maxContextTokens: selectedModel.contextWindow,
      }));
    }
  }, [formData.model, getModelsForConnector, formData.maxContextTokens]);

  // Check if a tool is operational (has required connectors configured)
  const isToolOperational = useCallback(
    (tool: ToolInfo): boolean => {
      if (!tool.requiresConnector) return true;
      if (!tool.connectorServiceTypes || tool.connectorServiceTypes.length === 0) return true;

      // Check if any required service type has a configured connector
      return tool.connectorServiceTypes.some((serviceType) =>
        apiConnectors.some((ac) => ac.serviceType === serviceType)
      );
    },
    [apiConnectors]
  );

  // Separate tools into operational and non-operational
  const { operationalTools, nonOperationalTools } = React.useMemo(() => {
    const operational: ToolInfo[] = [];
    const nonOperational: ToolInfo[] = [];

    availableTools.forEach((tool) => {
      if (isToolOperational(tool)) {
        operational.push(tool);
      } else {
        nonOperational.push(tool);
      }
    });

    // Sort by category, then by name
    const sortFn = (a: ToolInfo, b: ToolInfo) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.displayName.localeCompare(b.displayName);
    };

    return {
      operationalTools: operational.sort(sortFn),
      nonOperationalTools: nonOperational.sort(sortFn),
    };
  }, [availableTools, isToolOperational]);

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      alert('Please enter an agent name');
      return;
    }
    if (!formData.connector) {
      alert('Please select a connector');
      return;
    }
    if (!formData.model) {
      alert('Please select a model');
      return;
    }

    setSaving(true);
    try {
      let result;
      if (isEditMode && agentId) {
        // Update existing agent
        result = await window.hosea.agentConfig.update(agentId, formData);
      } else {
        // Create new agent
        result = await window.hosea.agentConfig.create(formData);
      }

      if (result.success) {
        navigate('agents');
      } else {
        alert(`Failed to save agent: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
      alert(`Failed to save agent: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agentId) return;

    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        const result = await window.hosea.agentConfig.delete(agentId);
        if (result.success) {
          navigate('agents');
        } else {
          alert(`Failed to delete agent: ${result.error}`);
        }
      } catch (error) {
        console.error('Failed to delete agent:', error);
        alert(`Failed to delete agent: ${error}`);
      }
    }
  };

  const toggleTool = (toolName: string) => {
    setFormData((prev) => ({
      ...prev,
      tools: prev.tools.includes(toolName)
        ? prev.tools.filter((t) => t !== toolName)
        : [...prev.tools, toolName],
    }));
  };

  const InfoTooltip = ({
    id,
    content,
  }: {
    id: string;
    content: string;
  }): React.ReactElement => (
    <OverlayTrigger
      placement="right"
      overlay={<Tooltip id={id}>{content}</Tooltip>}
    >
      <HelpCircle size={14} className="ms-1 text-muted" style={{ cursor: 'help' }} />
    </OverlayTrigger>
  );

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Loading..." subtitle="Loading agent configuration" />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={isEditMode ? 'Edit Agent' : 'Create Agent'}
        subtitle={
          isEditMode ? 'Modify your agent configuration' : 'Set up a new AI agent'
        }
        backButton={
          <Button variant="link" className="p-0 me-2" onClick={goBack}>
            <ArrowLeft size={20} />
          </Button>
        }
      >
        {isEditMode && (
          <Button
            variant="outline-danger"
            size="sm"
            className="me-2"
            onClick={handleDelete}
          >
            <Trash2 size={14} className="me-1" />
            Delete
          </Button>
        )}
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          <Save size={16} className="me-2" />
          {saving ? 'Saving...' : 'Save Agent'}
        </Button>
      </PageHeader>

      <div className="page__content">
        {/* Tabs */}
        <Nav
          variant="tabs"
          className="mb-4"
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k || 'general')}
        >
          <Nav.Item>
            <Nav.Link eventKey="general">General</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="tools">Tools</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="context">Context</Nav.Link>
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
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>
                      Agent Type
                      <InfoTooltip
                        id="agent-type-info"
                        content="Determines agent capabilities and behavior patterns"
                      />
                    </Form.Label>
                    <Form.Select
                      value={formData.agentType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          agentType: e.target.value as AgentType,
                        })
                      }
                    >
                      {AGENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {AGENT_TYPES.find((t) => t.value === formData.agentType)?.description}
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Connector (LLM Provider)</Form.Label>
                    <Form.Select
                      value={formData.connector}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          connector: e.target.value,
                          model: '', // Reset model when connector changes
                        })
                      }
                    >
                      <option value="">Select connector...</option>
                      {connectors.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.vendor})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Model</Form.Label>
                    <Form.Select
                      value={formData.model}
                      onChange={(e) =>
                        setFormData({ ...formData, model: e.target.value })
                      }
                      disabled={!formData.connector}
                    >
                      <option value="">
                        {formData.connector
                          ? 'Select model...'
                          : 'Select a connector first'}
                      </option>
                      {getModelsForConnector().map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({(m.contextWindow / 1000).toFixed(0)}K context)
                        </option>
                      ))}
                    </Form.Select>
                    {formData.model && (
                      <Form.Text className="text-muted">
                        {
                          getModelsForConnector().find((m) => m.id === formData.model)
                            ?.description
                        }
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label>
                      Temperature: {formData.temperature.toFixed(1)}
                    </Form.Label>
                    <Form.Range
                      min={0}
                      max={2}
                      step={0.1}
                      value={formData.temperature}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          temperature: parseFloat(e.target.value),
                        })
                      }
                    />
                    <Form.Text className="text-muted">
                      Lower = more focused, Higher = more creative
                    </Form.Text>
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
                      onChange={(e) =>
                        setFormData({ ...formData, instructions: e.target.value })
                      }
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
              <p className="text-muted mb-4">
                Select which tools this agent can use. Tools enable the agent to perform
                actions like reading files, searching the web, or executing code.
              </p>

              {operationalTools.length > 0 && (
                <>
                  <h6 className="mb-3">Available Tools</h6>
                  <Row className="g-2 mb-4">
                    {operationalTools.map((tool) => (
                      <Col key={tool.name} md={6} lg={4}>
                        <Card
                          className={`h-100 ${
                            formData.tools.includes(tool.name)
                              ? 'border-primary'
                              : ''
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleTool(tool.name)}
                        >
                          <Card.Body className="py-2 px-3">
                            <div className="d-flex align-items-start">
                              <Form.Check
                                type="checkbox"
                                checked={formData.tools.includes(tool.name)}
                                onChange={() => toggleTool(tool.name)}
                                onClick={(e) => e.stopPropagation()}
                                className="me-2"
                              />
                              <div className="flex-grow-1 overflow-hidden">
                                <div className="d-flex align-items-center">
                                  <strong className="text-truncate">
                                    {tool.displayName}
                                  </strong>
                                  {tool.safeByDefault && (
                                    <Badge
                                      bg="success"
                                      className="ms-2"
                                      style={{ fontSize: '0.65rem' }}
                                    >
                                      Safe
                                    </Badge>
                                  )}
                                </div>
                                <small className="text-muted d-block text-truncate">
                                  {tool.description}
                                </small>
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </>
              )}

              {nonOperationalTools.length > 0 && (
                <>
                  <h6 className="mb-2 text-muted">
                    Unavailable Tools{' '}
                    <Badge bg="secondary" className="ms-1">
                      {nonOperationalTools.length}
                    </Badge>
                  </h6>
                  <Alert variant="warning" className="py-2 mb-3">
                    <small>
                      <AlertCircle size={14} className="me-1" />
                      These tools require API connectors to be configured in{' '}
                      <strong>Connectors &gt; API Services</strong>
                    </small>
                  </Alert>
                  <Row className="g-2">
                    {nonOperationalTools.map((tool) => (
                      <Col key={tool.name} md={6} lg={4}>
                        <Card className="h-100 bg-light" style={{ opacity: 0.6 }}>
                          <Card.Body className="py-2 px-3">
                            <div className="d-flex align-items-start">
                              <Form.Check
                                type="checkbox"
                                disabled
                                className="me-2"
                              />
                              <div className="flex-grow-1 overflow-hidden">
                                <div className="d-flex align-items-center">
                                  <strong className="text-truncate text-muted">
                                    {tool.displayName}
                                  </strong>
                                </div>
                                <small className="text-muted d-block text-truncate">
                                  Requires:{' '}
                                  {tool.connectorServiceTypes?.join(', ') || 'API connector'}
                                </small>
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Context Tab */}
        {activeTab === 'context' && (
          <>
            {/* Context Strategy */}
            <Card className="mb-4">
              <Card.Header>
                <strong>Context Strategy</strong>
                <InfoTooltip
                  id="context-strategy-info"
                  content="Determines when and how the context is compacted to stay within token limits"
                />
              </Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Strategy</Form.Label>
                      <Form.Select
                        value={formData.contextStrategy}
                        onChange={(e) =>
                          setFormData({ ...formData, contextStrategy: e.target.value })
                        }
                      >
                        {CONTEXT_STRATEGIES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label} ({s.threshold})
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        {
                          CONTEXT_STRATEGIES.find(
                            (s) => s.value === formData.contextStrategy
                          )?.description
                        }
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        Max Context Tokens
                        <InfoTooltip
                          id="max-context-info"
                          content="Automatically set from the selected model's context window"
                        />
                      </Form.Label>
                      <Form.Control
                        type="number"
                        value={formData.maxContextTokens}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxContextTokens: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled
                      />
                      <Form.Text className="text-muted">From model</Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>
                        Response Reserve
                        <InfoTooltip
                          id="response-reserve-info"
                          content="Tokens reserved for the model's response"
                        />
                      </Form.Label>
                      <Form.Control
                        type="number"
                        min={1000}
                        max={32000}
                        value={formData.responseReserve}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            responseReserve: parseInt(e.target.value) || 4096,
                          })
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Features Toggles */}
            <Card className="mb-4">
              <Card.Header>
                <strong>Context Features</strong>
              </Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col md={4} lg={2}>
                    <Form.Check
                      type="switch"
                      id="memory-enabled"
                      label="Working Memory"
                      checked={formData.memoryEnabled}
                      onChange={(e) =>
                        setFormData({ ...formData, memoryEnabled: e.target.checked })
                      }
                    />
                    <Form.Text className="text-muted d-block">
                      External storage for large data
                    </Form.Text>
                  </Col>

                  <Col md={4} lg={2}>
                    <Form.Check
                      type="switch"
                      id="in-context-memory-enabled"
                      label="In-Context Memory"
                      checked={formData.inContextMemoryEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          inContextMemoryEnabled: e.target.checked,
                        })
                      }
                    />
                    <Form.Text className="text-muted d-block">
                      Key-value state in context
                    </Form.Text>
                  </Col>

                  <Col md={4} lg={3}>
                    <Form.Check
                      type="switch"
                      id="persistent-instructions-enabled"
                      label="Persistent Instructions"
                      checked={formData.persistentInstructionsEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          persistentInstructionsEnabled: e.target.checked,
                        })
                      }
                    />
                    <Form.Text className="text-muted d-block">
                      Disk-persisted custom rules
                    </Form.Text>
                  </Col>

                  <Col md={4} lg={3}>
                    <Form.Check
                      type="switch"
                      id="history-enabled"
                      label="History Management"
                      checked={formData.historyEnabled}
                      onChange={(e) =>
                        setFormData({ ...formData, historyEnabled: e.target.checked })
                      }
                    />
                    <Form.Text className="text-muted d-block">
                      Conversation history tracking
                    </Form.Text>
                  </Col>

                  <Col md={4} lg={2}>
                    <Form.Check
                      type="switch"
                      id="permissions-enabled"
                      label="Tool Permissions"
                      checked={formData.permissionsEnabled}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          permissionsEnabled: e.target.checked,
                        })
                      }
                    />
                    <Form.Text className="text-muted d-block">
                      Require approval for tools
                    </Form.Text>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Working Memory Settings */}
            {formData.memoryEnabled && (
              <Card className="mb-4">
                <Card.Header>
                  <strong>Working Memory Settings</strong>
                  <InfoTooltip
                    id="working-memory-info"
                    content="External memory storage for large data that can be retrieved via tools"
                  />
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>
                          Max Size (MB)
                          <InfoTooltip
                            id="max-size-info"
                            content="Maximum total memory size in megabytes"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          max={100}
                          value={Math.round(formData.maxMemorySizeBytes / (1024 * 1024))}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxMemorySizeBytes:
                                (parseInt(e.target.value) || 25) * 1024 * 1024,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>
                          Soft Limit (%)
                          <InfoTooltip
                            id="soft-limit-info"
                            content="Percentage of max size that triggers automatic cleanup"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={50}
                          max={95}
                          value={formData.memorySoftLimitPercent}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              memorySoftLimitPercent: parseInt(e.target.value) || 80,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>
                          Context Allocation (%)
                          <InfoTooltip
                            id="context-allocation-info"
                            content="Percentage of context reserved for memory index"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={5}
                          max={30}
                          value={formData.contextAllocationPercent}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              contextAllocationPercent: parseInt(e.target.value) || 10,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            {/* In-Context Memory Settings */}
            {formData.inContextMemoryEnabled && (
              <Card className="mb-4">
                <Card.Header>
                  <strong>In-Context Memory Settings</strong>
                  <InfoTooltip
                    id="in-context-memory-settings-info"
                    content="Key-value storage that appears directly in the context (LLM sees full values)"
                  />
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>
                          Max Entries
                          <InfoTooltip
                            id="max-entries-info"
                            content="Maximum number of key-value pairs to store"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={5}
                          max={50}
                          value={formData.maxInContextEntries}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxInContextEntries: parseInt(e.target.value) || 20,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>
                          Max Tokens
                          <InfoTooltip
                            id="max-tokens-info"
                            content="Maximum tokens used by in-context memory"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={1000}
                          max={16000}
                          step={500}
                          value={formData.maxInContextTokens}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxInContextTokens: parseInt(e.target.value) || 4000,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            {/* History Settings */}
            {formData.historyEnabled && (
              <Card className="mb-4">
                <Card.Header>
                  <strong>History Settings</strong>
                </Card.Header>
                <Card.Body>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>
                          Max Messages
                          <InfoTooltip
                            id="max-messages-info"
                            content="Maximum number of messages to keep in history"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={10}
                          max={1000}
                          value={formData.maxHistoryMessages}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              maxHistoryMessages: parseInt(e.target.value) || 100,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>
                          Preserve Recent
                          <InfoTooltip
                            id="preserve-recent-info"
                            content="Number of recent messages to always keep during compaction"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={2}
                          max={50}
                          value={formData.preserveRecent}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              preserveRecent: parseInt(e.target.value) || 10,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            )}

            {/* Cache Settings */}
            <Card className="mb-4">
              <Card.Header>
                <div className="d-flex align-items-center">
                  <Form.Check
                    type="switch"
                    id="cache-enabled"
                    className="me-2"
                    checked={formData.cacheEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, cacheEnabled: e.target.checked })
                    }
                  />
                  <strong>Idempotency Cache</strong>
                  <InfoTooltip
                    id="cache-info"
                    content="Caches tool results to avoid redundant executions"
                  />
                </div>
              </Card.Header>
              {formData.cacheEnabled && (
                <Card.Body>
                  <Row className="g-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>
                          TTL (seconds)
                          <InfoTooltip
                            id="ttl-info"
                            content="How long cached results remain valid"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={30}
                          max={3600}
                          value={Math.round(formData.cacheTtlMs / 1000)}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cacheTtlMs: (parseInt(e.target.value) || 300) * 1000,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>
                          Max Entries
                          <InfoTooltip
                            id="cache-max-entries-info"
                            content="Maximum number of cached results"
                          />
                        </Form.Label>
                        <Form.Control
                          type="number"
                          min={100}
                          max={10000}
                          value={formData.cacheMaxEntries}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              cacheMaxEntries: parseInt(e.target.value) || 1000,
                            })
                          }
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </Card.Body>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
