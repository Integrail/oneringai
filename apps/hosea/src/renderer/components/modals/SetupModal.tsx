import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';

interface SetupModalProps {
  show: boolean;
  onHide: () => void;
  onComplete: (connector: string, model: string) => void;
}

interface ConnectorConfig {
  name: string;
  vendor: string;
  createdAt: number;
}

interface ModelGroup {
  vendor: string;
  models: Array<{ id: string; name: string }>;
}

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

  const handleComplete = () => {
    if (selectedConnector && selectedModel) {
      onComplete(selectedConnector, selectedModel);
    }
  };

  const getModelsForVendor = () => {
    const connector = connectors.find((c) => c.name === selectedConnector);
    if (!connector) return [];
    const vendorModels = models.find((m) => m.vendor === connector.vendor);
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
                {c.name} ({c.vendor})
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
                  {m.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setStep('connector')}>
            Back
          </Button>
          <Button
            variant="primary"
            onClick={handleComplete}
            disabled={!selectedModel}
          >
            Connect
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
