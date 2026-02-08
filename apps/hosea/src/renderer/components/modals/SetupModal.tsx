import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';

interface SetupModalProps {
  show: boolean;
  onHide: () => void;
  onComplete: () => void;
}

interface ConnectorConfig {
  name: string;
  vendor: string;
  source?: 'local' | 'everworker';
  createdAt: number;
}

interface ModelGroup {
  vendor: string;
  models: Array<{ id: string; name: string; contextWindow: number }>;
}

// Default models for each vendor
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-pro',
  groq: 'llama-3.3-70b-versatile',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  mistral: 'mistral-large-latest',
  deepseek: 'deepseek-chat',
};

export function SetupModal({
  show,
  onHide,
  onComplete,
}: SetupModalProps): React.ReactElement {
  const [step, setStep] = useState<'connector' | 'model' | 'new-connector'>('connector');
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [models, setModels] = useState<ModelGroup[]>([]);
  const [selectedConnector, setSelectedConnector] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New connector form
  const [newConnectorName, setNewConnectorName] = useState('');
  const [newConnectorVendor, setNewConnectorVendor] = useState('openai');
  const [newConnectorApiKey, setNewConnectorApiKey] = useState('');

  // Load data on show
  useEffect(() => {
    if (show) {
      loadData();
    }
  }, [show]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [connectorList, modelList] = await Promise.all([
        window.hosea.connector.list(),
        window.hosea.model.list(),
      ]);
      setConnectors(connectorList);
      setModels(modelList);

      if (connectorList.length === 0) {
        setStep('new-connector');
      } else {
        setStep('connector');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectorSelect = () => {
    if (selectedConnector) {
      // Auto-select a default model for convenience
      const connector = connectors.find((c) => c.name === selectedConnector);
      if (connector) {
        const defaultModel = DEFAULT_MODELS[connector.vendor];
        if (defaultModel) {
          setSelectedModel(defaultModel);
        }
      }
      setStep('model');
    }
  };

  const handleAddConnector = async () => {
    if (!newConnectorName || !newConnectorApiKey) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.hosea.connector.add({
        name: newConnectorName,
        vendor: newConnectorVendor,
        auth: {
          type: 'api_key',
          apiKey: newConnectorApiKey,
        },
      });

      if (result.success) {
        setSelectedConnector(newConnectorName);
        // Auto-select default model
        const defaultModel = DEFAULT_MODELS[newConnectorVendor];
        if (defaultModel) {
          setSelectedModel(defaultModel);
        }
        await loadData();
        setStep('model');
      } else {
        setError(result.error || 'Failed to add connector');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Complete setup: create default agent with selected connector + model
  const handleComplete = async () => {
    if (!selectedConnector || !selectedModel) {
      setError('Please select a connector and model');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a default agent with the selected connector and model
      const result = await window.hosea.agentConfig.createDefault(
        selectedConnector,
        selectedModel
      );

      if (result.success) {
        onComplete();
      } else {
        setError(result.error || 'Failed to create agent');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const getModelsForVendor = () => {
    const connector = connectors.find((c) => c.name === selectedConnector);
    if (!connector) return [];
    const vendorModels = models.find(
      (m) => m.vendor.toLowerCase() === connector.vendor.toLowerCase()
    );
    return vendorModels?.models || [];
  };

  const renderConnectorStep = () => (
    <>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Select a connector</Form.Label>
          <Form.Select
            value={selectedConnector}
            onChange={(e) => setSelectedConnector(e.target.value)}
          >
            <option value="">Choose...</option>
            {connectors.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.vendor}){c.source === 'everworker' ? ' [EW]' : c.source === 'local' ? ' [Local]' : ''}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <div className="text-center text-muted my-3">or</div>

        <Button
          variant="outline-secondary"
          className="w-100"
          onClick={() => setStep('new-connector')}
        >
          Add New Connector
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleConnectorSelect}
          disabled={!selectedConnector}
        >
          Next
        </Button>
      </Modal.Footer>
    </>
  );

  const renderNewConnectorStep = () => (
    <>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Label>Connector Name</Form.Label>
          <Form.Control
            type="text"
            value={newConnectorName}
            onChange={(e) => setNewConnectorName(e.target.value)}
            placeholder="e.g., my-openai"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Vendor</Form.Label>
          <Form.Select
            value={newConnectorVendor}
            onChange={(e) => setNewConnectorVendor(e.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="groq">Groq</option>
            <option value="together">Together</option>
            <option value="mistral">Mistral</option>
            <option value="deepseek">DeepSeek</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>API Key</Form.Label>
          <Form.Control
            type="password"
            value={newConnectorApiKey}
            onChange={(e) => setNewConnectorApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </Form.Group>

        {error && <Alert variant="danger">{error}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        {connectors.length > 0 && (
          <Button variant="outline-secondary" onClick={() => setStep('connector')}>
            Back
          </Button>
        )}
        <Button variant="primary" onClick={handleAddConnector} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'Add Connector'}
        </Button>
      </Modal.Footer>
    </>
  );

  const renderModelStep = () => {
    const availableModels = getModelsForVendor();

    return (
      <>
        <Modal.Body>
          <Alert variant="info">
            Using connector: <strong>{selectedConnector}</strong>
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>Select a model</Form.Label>
            <Form.Select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              <option value="">Choose...</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({(m.contextWindow / 1000).toFixed(0)}K context)
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <p className="text-muted small">
            This will create a default agent with your selected connector and model.
            You can customize it later from the Agents page.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setStep('connector')}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={handleComplete}
            disabled={!selectedModel || loading}
          >
            {loading ? <Spinner size="sm" /> : 'Get Started'}
          </Button>
        </Modal.Footer>
      </>
    );
  };

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static">
      <Modal.Header closeButton={connectors.length > 0}>
        <Modal.Title>
          {step === 'connector' && 'Select Connector'}
          {step === 'new-connector' && 'Add Connector'}
          {step === 'model' && 'Select Model'}
        </Modal.Title>
      </Modal.Header>

      {loading && step === 'connector' ? (
        <Modal.Body className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading...</p>
        </Modal.Body>
      ) : (
        <>
          {step === 'connector' && renderConnectorStep()}
          {step === 'new-connector' && renderNewConnectorStep()}
          {step === 'model' && renderModelStep()}
        </>
      )}
    </Modal>
  );
}
