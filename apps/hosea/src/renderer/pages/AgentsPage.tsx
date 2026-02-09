/**
 * Agents Page - Manage AI agents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spinner, Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Plus, Bot, Settings, Trash2, MessageSquare, AlertTriangle, Cloud } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { useNavigation } from '../hooks/useNavigation';
import { useTabContext } from '../hooks/useTabContext';
import { useConnectorVersion } from '../App';

interface AgentConfig {
  id: string;
  name: string;
  model: string;
  connector: string;
  agentType: string;
  tools: string[];
  updatedAt: number;
  lastUsedAt?: number;
  isActive: boolean;
}

export function AgentsPage(): React.ReactElement {
  const { navigate } = useNavigation();
  const { createTab } = useTabContext();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<Set<string>>(new Set());
  const [ewConnectors, setEwConnectors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const connectorVersion = useConnectorVersion();

  const loadAgents = useCallback(async () => {
    try {
      const [agentsList, connectorsList] = await Promise.all([
        window.hosea.agentConfig.list(),
        window.hosea.connector.list(),
      ]);
      setAgents(agentsList);
      setAvailableConnectors(new Set(connectorsList.map(c => c.name)));
      setEwConnectors(new Set(connectorsList.filter(c => c.source === 'everworker').map(c => c.name)));
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents, connectorVersion]);

  const handleCreateAgent = () => {
    navigate('agent-editor', { mode: 'create' });
  };

  const handleEditAgent = (agentId: string) => {
    navigate('agent-editor', { mode: 'edit', id: agentId });
  };

  const handleChatWithAgent = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (agent && !availableConnectors.has(agent.connector)) {
        return; // Connector unavailable, don't attempt
      }
      const agentName = agent?.name || 'Assistant';
      const tabId = await createTab(agentId, agentName);
      if (tabId) {
        navigate('chat');
      } else {
        alert('Failed to create chat tab');
      }
    } catch (error) {
      console.error('Failed to create chat tab:', error);
    }
  };

  const handleDeleteAgent = async (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        const result = await window.hosea.agentConfig.delete(agentId);
        if (result.success) {
          loadAgents();
        } else {
          alert(`Failed to delete agent: ${result.error}`);
        }
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const formatTimeAgo = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Agents" subtitle="Create and manage your AI agents" />
        <div className="page__content d-flex justify-content-center align-items-center">
          <Spinner animation="border" variant="primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Agents"
        subtitle="Create and manage your AI agents"
      >
        <Button variant="primary" onClick={handleCreateAgent}>
          <Plus size={16} className="me-2" />
          New Agent
        </Button>
      </PageHeader>

      <div className="page__content">
        {agents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Bot size={32} />
            </div>
            <h3 className="empty-state__title">No agents yet</h3>
            <p className="empty-state__description">
              Create your first AI agent to get started. Agents can be customized with
              specific models, tools, and instructions.
            </p>
            <Button variant="primary" onClick={handleCreateAgent}>
              <Plus size={16} className="me-2" />
              Create Agent
            </Button>
          </div>
        ) : (
          <div className="grid grid--auto">
            {agents.map((agent) => {
              const connectorAvailable = availableConnectors.has(agent.connector);
              const isEwAgent = ewConnectors.has(agent.connector);
              return (
                <div
                  key={agent.id}
                  className={`card card--hoverable agent-card ${
                    agent.isActive ? 'card--selected' : ''
                  } ${!connectorAvailable ? 'opacity-50' : ''}`}
                  onClick={() => connectorAvailable && handleChatWithAgent(agent.id)}
                  style={!connectorAvailable ? { cursor: 'default' } : undefined}
                >
                  <div className="card__body">
                    <div className="agent-card__header">
                      <div className="agent-card__avatar">
                        <Bot size={20} />
                      </div>
                      <div className="agent-card__info">
                        <h3 className="agent-card__name">
                          {agent.name}
                          {isEwAgent && (
                            <Badge bg="info" className="ms-2" style={{ fontSize: '0.6em', verticalAlign: 'middle' }}>
                              <Cloud size={10} className="me-1" />
                              EW
                            </Badge>
                          )}
                          {!connectorAvailable && (
                            <OverlayTrigger
                              placement="top"
                              overlay={
                                <Tooltip>
                                  Connector &quot;{agent.connector}&quot; is unavailable.
                                  Switch to the EW profile that provides it, or edit this agent
                                  to use a different connector.
                                </Tooltip>
                              }
                            >
                              <span className="ms-2">
                                <AlertTriangle size={14} className="text-warning" />
                              </span>
                            </OverlayTrigger>
                          )}
                        </h3>
                        <p className="agent-card__model">
                          {agent.model}
                          <span className="text-muted ms-1" style={{ fontSize: '0.85em' }}>
                            via {agent.connector}
                          </span>
                        </p>
                      </div>
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAgent(agent.id, e);
                        }}
                        title="Delete agent"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="agent-card__meta">
                      <div className="agent-card__meta-item">
                        <span className="status-indicator">
                          <span
                            className={`status-indicator__dot ${
                              !connectorAvailable
                                ? 'status-indicator__dot--offline'
                                : agent.isActive
                                  ? 'status-indicator__dot--online'
                                  : 'status-indicator__dot--offline'
                            }`}
                          />
                        </span>
                        {!connectorAvailable ? (
                          <span className="text-warning">No connector</span>
                        ) : agent.isActive ? 'Active' : 'Inactive'}
                      </div>
                      <div className="agent-card__meta-item">
                        {agent.tools.length} tools
                      </div>
                      <div className="agent-card__meta-item text-muted">
                        {formatTimeAgo(agent.lastUsedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="card__footer">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAgent(agent.id);
                      }}
                    >
                      <Settings size={14} className="me-1" />
                      Edit
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!connectorAvailable}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChatWithAgent(agent.id);
                      }}
                    >
                      <MessageSquare size={14} className="me-1" />
                      Chat
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Add new agent card */}
            <div
              className="card card--hoverable"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
                cursor: 'pointer',
                borderStyle: 'dashed',
              }}
              onClick={handleCreateAgent}
            >
              <div className="empty-state" style={{ padding: 'var(--spacing-4)' }}>
                <div className="empty-state__icon">
                  <Plus size={24} />
                </div>
                <p className="text-muted">Create new agent</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
