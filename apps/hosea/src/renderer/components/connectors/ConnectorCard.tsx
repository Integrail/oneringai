/**
 * ConnectorCard Component
 *
 * Displays a configured universal connector with status and actions.
 */

import React from 'react';
import { Badge, Button, Dropdown } from 'react-bootstrap';
import {
  CheckCircle,
  AlertCircle,
  HelpCircle,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { VendorLogo } from './VendorLogo';

interface StoredUniversalConnector {
  name: string;
  vendorId: string;
  vendorName: string;
  authMethodId: string;
  authMethodName: string;
  credentials: Record<string, string>;
  displayName?: string;
  baseURL?: string;
  createdAt: number;
  updatedAt: number;
  lastTestedAt?: number;
  status: 'active' | 'error' | 'untested';
  legacyServiceType?: string;
}

interface ConnectorCardProps {
  /** Connector data */
  connector: StoredUniversalConnector;
  /** Handler for edit action */
  onEdit: () => void;
  /** Handler for delete action */
  onDelete: () => void;
  /** Handler for test connection action */
  onTest: () => void;
  /** Whether test is in progress */
  testing?: boolean;
  /** Docs URL from vendor template */
  docsURL?: string;
}

function getStatusConfig(status: StoredUniversalConnector['status']): {
  icon: React.ReactNode;
  label: string;
  variant: string;
} {
  switch (status) {
    case 'active':
      return {
        icon: <CheckCircle size={12} />,
        label: 'Active',
        variant: 'success',
      };
    case 'error':
      return {
        icon: <AlertCircle size={12} />,
        label: 'Error',
        variant: 'danger',
      };
    case 'untested':
    default:
      return {
        icon: <HelpCircle size={12} />,
        label: 'Untested',
        variant: 'secondary',
      };
  }
}

export function ConnectorCard({
  connector,
  onEdit,
  onDelete,
  onTest,
  testing = false,
  docsURL,
}: ConnectorCardProps): React.ReactElement {
  const statusConfig = getStatusConfig(connector.status);
  const displayName = connector.displayName || connector.vendorName;

  return (
    <div className="connector-card">
      <div className="connector-card__header">
        <VendorLogo vendorId={connector.vendorId} size={40} />
        <div className="connector-card__title">
          <div className="connector-card__name">
            {displayName}
            <Badge bg={statusConfig.variant} className="connector-card__status ms-2">
              {statusConfig.icon}
              <span className="ms-1">{statusConfig.label}</span>
            </Badge>
          </div>
          <div className="connector-card__subtitle">
            <code>{connector.name}</code>
            <span className="mx-2">•</span>
            <span>{connector.authMethodName}</span>
          </div>
        </div>

        <Dropdown align="end">
          <Dropdown.Toggle
            variant="link"
            className="connector-card__menu-toggle"
            id={`connector-menu-${connector.name}`}
          >
            <MoreVertical size={16} />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={onTest} disabled={testing}>
              <RefreshCw size={14} className={`me-2 ${testing ? 'spin' : ''}`} />
              Test Connection
            </Dropdown.Item>
            <Dropdown.Item onClick={onEdit}>
              <Edit2 size={14} className="me-2" />
              Edit
            </Dropdown.Item>
            {docsURL && (
              <Dropdown.Item
                as="a"
                href={docsURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} className="me-2" />
                Documentation
              </Dropdown.Item>
            )}
            <Dropdown.Divider />
            <Dropdown.Item onClick={onDelete} className="text-danger">
              <Trash2 size={14} className="me-2" />
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <div className="connector-card__body">
        {connector.baseURL && (
          <div className="connector-card__detail">
            <span className="connector-card__detail-label">Base URL:</span>
            <code className="connector-card__detail-value">{connector.baseURL}</code>
          </div>
        )}
        {connector.legacyServiceType && (
          <div className="connector-card__detail">
            <span className="connector-card__detail-label">Legacy Service:</span>
            <span className="connector-card__detail-value">{connector.legacyServiceType}</span>
            <Badge bg="info" className="ms-2">Migrated</Badge>
          </div>
        )}
        {connector.lastTestedAt && (
          <div className="connector-card__detail">
            <span className="connector-card__detail-label">Last tested:</span>
            <span className="connector-card__detail-value">
              {new Date(connector.lastTestedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      <div className="connector-card__footer">
        <Button variant="outline-secondary" size="sm" onClick={onEdit}>
          <Edit2 size={14} className="me-1" />
          Edit
        </Button>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={onTest}
          disabled={testing}
        >
          <RefreshCw size={14} className={`me-1 ${testing ? 'spin' : ''}`} />
          {testing ? 'Testing...' : 'Test'}
        </Button>
      </div>
    </div>
  );
}

export default ConnectorCard;
