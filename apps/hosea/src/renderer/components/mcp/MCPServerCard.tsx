/**
 * MCPServerCard Component
 *
 * Displays a configured MCP server with status, tool count, and actions.
 */

import React from 'react';
import { Badge, Button, Dropdown } from 'react-bootstrap';
import {
  CheckCircle,
  AlertCircle,
  Loader,
  XCircle,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  Power,
  PowerOff,
  Terminal,
  Globe,
  Wrench,
} from 'lucide-react';

export interface StoredMCPServerConfig {
  name: string;
  displayName?: string;
  description?: string;
  transport: 'stdio' | 'http' | 'https';
  transportConfig: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
    url?: string;
    token?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  };
  toolNamespace?: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastError?: string;
  toolCount?: number;
  availableTools?: string[];
  createdAt: number;
  updatedAt: number;
  lastConnectedAt?: number;
}

interface MCPServerCardProps {
  /** MCP server data */
  server: StoredMCPServerConfig;
  /** Handler for edit action */
  onEdit: () => void;
  /** Handler for delete action */
  onDelete: () => void;
  /** Handler for connect action */
  onConnect: () => void;
  /** Handler for disconnect action */
  onDisconnect: () => void;
  /** Handler for refresh tools action */
  onRefreshTools: () => void;
  /** Handler for viewing tools */
  onViewTools?: () => void;
  /** Whether an action is in progress */
  loading?: boolean;
}

function getStatusConfig(status: StoredMCPServerConfig['status']): {
  icon: React.ReactNode;
  label: string;
  variant: string;
} {
  switch (status) {
    case 'connected':
      return {
        icon: <CheckCircle size={12} />,
        label: 'Connected',
        variant: 'success',
      };
    case 'connecting':
      return {
        icon: <Loader size={12} className="spin" />,
        label: 'Connecting',
        variant: 'warning',
      };
    case 'error':
      return {
        icon: <AlertCircle size={12} />,
        label: 'Error',
        variant: 'danger',
      };
    case 'disconnected':
    default:
      return {
        icon: <XCircle size={12} />,
        label: 'Disconnected',
        variant: 'secondary',
      };
  }
}

function getTransportIcon(transport: StoredMCPServerConfig['transport']): React.ReactNode {
  switch (transport) {
    case 'stdio':
      return <Terminal size={16} />;
    case 'http':
    case 'https':
      return <Globe size={16} />;
    default:
      return null;
  }
}

export function MCPServerCard({
  server,
  onEdit,
  onDelete,
  onConnect,
  onDisconnect,
  onRefreshTools,
  onViewTools,
  loading = false,
}: MCPServerCardProps): React.ReactElement {
  const statusConfig = getStatusConfig(server.status);
  const displayName = server.displayName || server.name;
  const isConnected = server.status === 'connected';

  return (
    <div className="mcp-server-card">
      <div className="mcp-server-card__header">
        <div className="mcp-server-card__icon">
          {getTransportIcon(server.transport)}
        </div>
        <div className="mcp-server-card__title">
          <div className="mcp-server-card__name">
            {displayName}
            <Badge bg={statusConfig.variant} className="mcp-server-card__status ms-2">
              {statusConfig.icon}
              <span className="ms-1">{statusConfig.label}</span>
            </Badge>
          </div>
          <div className="mcp-server-card__subtitle">
            <code>{server.name}</code>
            <span className="mx-2">•</span>
            <span className="text-capitalize">{server.transport}</span>
            {server.toolCount !== undefined && (
              <>
                <span className="mx-2">•</span>
                <span>{server.toolCount} tools</span>
              </>
            )}
          </div>
        </div>

        <Dropdown align="end">
          <Dropdown.Toggle
            variant="link"
            className="mcp-server-card__menu-toggle"
            id={`mcp-server-menu-${server.name}`}
          >
            <MoreVertical size={16} />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {isConnected ? (
              <Dropdown.Item onClick={onDisconnect} disabled={loading}>
                <PowerOff size={14} className="me-2" />
                Disconnect
              </Dropdown.Item>
            ) : (
              <Dropdown.Item onClick={onConnect} disabled={loading}>
                <Power size={14} className="me-2" />
                Connect
              </Dropdown.Item>
            )}
            {isConnected && (
              <Dropdown.Item onClick={onRefreshTools} disabled={loading}>
                <RefreshCw size={14} className={`me-2 ${loading ? 'spin' : ''}`} />
                Refresh Tools
              </Dropdown.Item>
            )}
            {isConnected && onViewTools && (
              <Dropdown.Item onClick={onViewTools}>
                <Wrench size={14} className="me-2" />
                View Tools
              </Dropdown.Item>
            )}
            <Dropdown.Divider />
            <Dropdown.Item onClick={onEdit}>
              <Edit2 size={14} className="me-2" />
              Edit
            </Dropdown.Item>
            <Dropdown.Item onClick={onDelete} className="text-danger">
              <Trash2 size={14} className="me-2" />
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <div className="mcp-server-card__body">
        {server.description && (
          <div className="mcp-server-card__description">
            {server.description}
          </div>
        )}

        {server.transport === 'stdio' && server.transportConfig.command && (
          <div className="mcp-server-card__detail">
            <span className="mcp-server-card__detail-label">Command:</span>
            <code className="mcp-server-card__detail-value">
              {server.transportConfig.command}
              {server.transportConfig.args?.length ? ` ${server.transportConfig.args.join(' ')}` : ''}
            </code>
          </div>
        )}

        {(server.transport === 'http' || server.transport === 'https') && server.transportConfig.url && (
          <div className="mcp-server-card__detail">
            <span className="mcp-server-card__detail-label">URL:</span>
            <code className="mcp-server-card__detail-value">{server.transportConfig.url}</code>
          </div>
        )}

        {server.lastError && server.status === 'error' && (
          <div className="mcp-server-card__error">
            <AlertCircle size={14} className="me-1" />
            {server.lastError}
          </div>
        )}

        {server.lastConnectedAt && (
          <div className="mcp-server-card__detail">
            <span className="mcp-server-card__detail-label">Last connected:</span>
            <span className="mcp-server-card__detail-value">
              {new Date(server.lastConnectedAt).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="mcp-server-card__footer">
        <Button variant="outline-secondary" size="sm" onClick={onEdit}>
          <Edit2 size={14} className="me-1" />
          Edit
        </Button>
        {isConnected ? (
          <Button
            variant="outline-warning"
            size="sm"
            onClick={onDisconnect}
            disabled={loading}
          >
            <PowerOff size={14} className="me-1" />
            Disconnect
          </Button>
        ) : (
          <Button
            variant="outline-success"
            size="sm"
            onClick={onConnect}
            disabled={loading || server.status === 'connecting'}
          >
            <Power size={14} className={`me-1 ${server.status === 'connecting' ? 'spin' : ''}`} />
            {server.status === 'connecting' ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default MCPServerCard;
