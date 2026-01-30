/**
 * Agents Page - Manage AI agents
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Plus, Bot, Settings, Trash2, MessageSquare, MoreVertical } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { useNavigation } from '../hooks/useNavigation';

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
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    try {
      const agentsList = await window.hosea.agentConfig.list();
      setAgents(agentsList);
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleCreateAgent = () => {
    navigate('agent-editor', { mode: 'create' });
  };

  const handleEditAgent = (agentId: string) => {
    navigate('agent-editor', { mode: 'edit', id: agentId });
  };

  const handleChatWithAgent = async (agentId: string) => {
    try {
      const result = await window.hosea.agentConfig.setActive(agentId);
      if (result.success) {
        navigate('chat');
      } else {
        alert(`Failed to activate agent: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to set active agent:', error);
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
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`card card--hoverable agent-card ${
                  agent.isActive ? 'card--selected' : ''
                }`}
                onClick={() => handleChatWithAgent(agent.id)}
              >
                <div className="card__body">
                  <div className="agent-card__header">
                    <div className="agent-card__avatar">
                      <Bot size={20} />
                    </div>
                    <div className="agent-card__info">
                      <h3 className="agent-card__name">{agent.name}</h3>
                      <p className="agent-card__model">{agent.model}</p>
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
                            agent.isActive
                              ? 'status-indicator__dot--online'
                              : 'status-indicator__dot--offline'
                          }`}
                        />
                      </span>
                      {agent.isActive ? 'Active' : 'Inactive'}
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
            ))}

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
