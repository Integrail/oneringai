/**
 * NewTabModal - Modal for selecting an agent when creating a new tab
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, ListGroup, Spinner, Badge, Form } from 'react-bootstrap';
import { Bot, Check, Search } from 'lucide-react';

interface AgentConfig {
  id: string;
  name: string;
  connector: string;
  model: string;
  agentType: 'basic' | 'task' | 'research' | 'universal';
  isActive: boolean;
}

interface NewTabModalProps {
  show: boolean;
  onHide: () => void;
  onSelectAgent: (agentConfigId: string, agentName: string) => void;
}

export function NewTabModal({ show, onHide, onSelectAgent }: NewTabModalProps): React.ReactElement {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load agents when modal opens
  useEffect(() => {
    if (show) {
      loadAgents();
    }
  }, [show]);

  const loadAgents = async () => {
    setIsLoading(true);
    try {
      const agentList = await window.hosea.agentConfig.list();
      setAgents(agentList);

      // Pre-select active agent if available
      const activeAgent = agentList.find(a => a.isActive);
      if (activeAgent) {
        setSelectedId(activeAgent.id);
      } else if (agentList.length > 0) {
        setSelectedId(agentList[0].id);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
    setIsLoading(false);
  };

  const handleSelect = () => {
    if (!selectedId) return;

    const agent = agents.find(a => a.id === selectedId);
    if (agent) {
      onSelectAgent(agent.id, agent.name);
      onHide();
    }
  };

  const handleAgentClick = (agentId: string) => {
    setSelectedId(agentId);
  };

  const handleAgentDoubleClick = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      onSelectAgent(agent.id, agent.name);
      onHide();
    }
  };

  // Filter agents by search query
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.model.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAgentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      basic: 'secondary',
      task: 'info',
      research: 'success',
      universal: 'primary',
    };
    return <Badge bg={colors[type] || 'secondary'}>{type}</Badge>;
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <Bot size={20} className="me-2" />
          Select Agent for New Tab
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {isLoading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3 text-muted">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-5">
            <Bot size={48} className="text-muted mb-3" />
            <p className="text-muted">No agents configured</p>
            <p className="small text-muted">Create an agent in the Agents page first.</p>
          </div>
        ) : (
          <>
            <Form.Group className="mb-3">
              <div className="position-relative">
                <Search size={16} className="position-absolute top-50 translate-middle-y ms-3 text-muted" />
                <Form.Control
                  type="text"
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-5"
                />
              </div>
            </Form.Group>

            <ListGroup className="new-tab-modal__agent-list">
              {filteredAgents.map(agent => (
                <ListGroup.Item
                  key={agent.id}
                  action
                  active={agent.id === selectedId}
                  onClick={() => handleAgentClick(agent.id)}
                  onDoubleClick={() => handleAgentDoubleClick(agent.id)}
                  className="d-flex align-items-center justify-content-between"
                >
                  <div className="d-flex align-items-center">
                    {agent.id === selectedId && (
                      <Check size={16} className="me-2 text-primary" />
                    )}
                    <div>
                      <div className="fw-medium">
                        {agent.name}
                        {agent.isActive && (
                          <Badge bg="success" className="ms-2" style={{ fontSize: '0.7em' }}>
                            Active
                          </Badge>
                        )}
                      </div>
                      <small className="text-muted">{agent.model}</small>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {getAgentTypeBadge(agent.agentType)}
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {filteredAgents.length === 0 && searchQuery && (
              <div className="text-center py-4 text-muted">
                No agents match "{searchQuery}"
              </div>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSelect}
          disabled={!selectedId || isLoading}
        >
          Open in New Tab
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
