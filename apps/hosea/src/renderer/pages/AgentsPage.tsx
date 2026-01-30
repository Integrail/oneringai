/**
 * Agents Page - Manage AI agents
 */

import React from 'react';
import { Button, Badge, Dropdown } from 'react-bootstrap';
import { Plus, Bot, Settings, Trash2, MessageSquare, MoreVertical } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { useNavigation } from '../hooks/useNavigation';

interface Agent {
  id: string;
  name: string;
  model: string;
  connector: string;
  toolsCount: number;
  lastUsed: number;
  isActive: boolean;
}

// Placeholder data
const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Default Assistant',
    model: 'gpt-4o',
    connector: 'openai',
    toolsCount: 5,
    lastUsed: Date.now() - 1000 * 60 * 30,
    isActive: true,
  },
];

export function AgentsPage(): React.ReactElement {
  const { navigate } = useNavigation();

  const handleCreateAgent = () => {
    navigate('agent-editor', { mode: 'create' });
  };

  const handleEditAgent = (agentId: string) => {
    navigate('agent-editor', { mode: 'edit', id: agentId });
  };

  const handleChatWithAgent = (agentId: string) => {
    // TODO: Set active agent and navigate to chat
    navigate('chat');
  };

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
        {mockAgents.length === 0 ? (
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
            {mockAgents.map((agent) => (
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
                        handleEditAgent(agent.id);
                      }}
                    >
                      <MoreVertical size={18} />
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
                      {agent.toolsCount} tools
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
