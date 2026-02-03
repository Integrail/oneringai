/**
 * TemplateRequiredFields Component
 *
 * Displays and handles required fields from an MCP template (env vars and args).
 * Supports unified auth via connector references.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, InputGroup, Button, Alert } from 'react-bootstrap';
import { Key, FolderOpen, AlertCircle, ExternalLink, Box, Link2, Edit3 } from 'lucide-react';
import type { MCPServerTemplate, EnvFieldConfig, ArgFieldConfig, MCPPrerequisite } from '../../../shared/mcpTemplates';
import { PREREQUISITE_INFO } from '../../../shared/mcpTemplates';
import type { TransportConfig } from './TransportConfigForm';

/** Universal connector info from the API */
interface UniversalConnector {
  name: string;
  vendorId: string;
  vendorName: string;
  displayName?: string;
  status: 'active' | 'error' | 'untested';
  legacyServiceType?: string;
}

interface TemplateRequiredFieldsProps {
  /** The selected template */
  template: MCPServerTemplate;
  /** Current transport config */
  config: TransportConfig;
  /** Handler for config changes */
  onConfigChange: (config: TransportConfig) => void;
  /** Handler for connector binding changes */
  onConnectorBindingsChange?: (bindings: Record<string, string>) => void;
  /** Current connector bindings */
  connectorBindings?: Record<string, string>;
  /** Whether form is disabled */
  disabled?: boolean;
}

export function TemplateRequiredFields({
  template,
  config,
  onConfigChange,
  onConnectorBindingsChange,
  connectorBindings = {},
  disabled = false,
}: TemplateRequiredFieldsProps): React.ReactElement | null {
  const hasRequiredEnv = template.requiredEnv && template.requiredEnv.length > 0;
  const hasRequiredArgs = template.requiredArgs && template.requiredArgs.length > 0;
  const hasPrerequisites = template.prerequisites && template.prerequisites.length > 0;
  const hasSetupInstructions = template.setupInstructions || template.setupUrl;

  // State for available connectors
  const [connectors, setConnectors] = useState<UniversalConnector[]>([]);
  // Track which fields use connector vs manual input
  const [useConnectorFor, setUseConnectorFor] = useState<Record<string, boolean>>({});

  // Load available connectors on mount
  useEffect(() => {
    const loadConnectors = async () => {
      try {
        const list = await window.hosea.universalConnector.list();
        setConnectors(list);

        // Initialize useConnectorFor based on existing bindings
        const initial: Record<string, boolean> = {};
        if (template.requiredEnv) {
          for (const envField of template.requiredEnv) {
            // If there's an existing binding, use connector mode
            initial[envField.key] = !!connectorBindings[envField.key];
          }
        }
        setUseConnectorFor(initial);
      } catch (err) {
        console.error('Failed to load connectors:', err);
      }
    };
    loadConnectors();
  }, [template.requiredEnv, connectorBindings]);

  // Get connectors that match a given service type
  const getMatchingConnectors = useCallback((serviceType: string): UniversalConnector[] => {
    return connectors.filter(c =>
      c.vendorId === serviceType ||
      c.legacyServiceType === serviceType
    );
  }, [connectors]);

  // Always show if there are prerequisites or setup instructions, even without env/args
  if (!hasRequiredEnv && !hasRequiredArgs && !hasPrerequisites && !hasSetupInstructions) {
    return null;
  }

  // Handle environment variable change (manual input)
  const handleEnvChange = (key: string, value: string) => {
    const newEnv = { ...config.env, [key]: value };
    onConfigChange({ ...config, env: newEnv });
    // Clear any connector binding for this key when entering manually
    if (connectorBindings[key] && onConnectorBindingsChange) {
      const newBindings = { ...connectorBindings };
      delete newBindings[key];
      onConnectorBindingsChange(newBindings);
    }
  };

  // Handle connector selection for an env field
  const handleConnectorSelect = (envKey: string, connectorName: string) => {
    if (onConnectorBindingsChange) {
      if (connectorName) {
        onConnectorBindingsChange({ ...connectorBindings, [envKey]: connectorName });
        // Clear manual env value when using connector
        const newEnv = { ...config.env };
        delete newEnv[envKey];
        onConfigChange({ ...config, env: newEnv });
      } else {
        const newBindings = { ...connectorBindings };
        delete newBindings[envKey];
        onConnectorBindingsChange(newBindings);
      }
    }
  };

  // Toggle between connector and manual input mode
  const toggleInputMode = (envKey: string, useConnector: boolean) => {
    setUseConnectorFor(prev => ({ ...prev, [envKey]: useConnector }));
    if (!useConnector && connectorBindings[envKey] && onConnectorBindingsChange) {
      // Switching to manual - clear connector binding
      const newBindings = { ...connectorBindings };
      delete newBindings[envKey];
      onConnectorBindingsChange(newBindings);
    }
  };

  // Handle argument placeholder replacement
  const handleArgChange = (argConfig: ArgFieldConfig, value: string) => {
    if (!config.args) return;

    // Find and replace the placeholder in args
    const newArgs = config.args.map((arg) => {
      if (arg === argConfig.key) {
        return value || argConfig.key; // Keep placeholder if empty
      }
      return arg;
    });

    onConfigChange({ ...config, args: newArgs });
  };

  // Get current value for an arg placeholder
  const getArgValue = (argConfig: ArgFieldConfig): string => {
    if (!config.args) return '';
    const arg = config.args.find((a) => a === argConfig.key || !a.startsWith('{'));
    if (arg && arg !== argConfig.key) {
      // Find the arg at the position where placeholder should be
      const idx = template.transportConfig.args?.indexOf(argConfig.key);
      if (idx !== undefined && idx >= 0 && config.args[idx] !== argConfig.key) {
        return config.args[idx];
      }
    }
    return '';
  };

  // Handle folder selection for path types
  const handleSelectFolder = async (argConfig: ArgFieldConfig) => {
    try {
      // Use Electron's dialog to select a folder
      const result = await window.hosea.dialog?.showOpenDialog({
        properties: argConfig.type === 'path' ? ['openDirectory'] : ['openFile'],
        title: `Select ${argConfig.label}`,
      });

      if (result && !result.canceled && result.filePaths.length > 0) {
        handleArgChange(argConfig, result.filePaths[0]);
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  };

  return (
    <div className="template-required-fields">
      <div className="template-required-fields__header">
        <AlertCircle size={16} />
        Setup & Configuration
      </div>

      {/* Prerequisites */}
      {hasPrerequisites && (
        <div className="template-required-fields__prerequisites">
          <div className="template-required-fields__prereq-label">Prerequisites:</div>
          <div className="template-required-fields__prereq-list">
            {template.prerequisites!.map((prereq: MCPPrerequisite) => (
              <a
                key={prereq}
                href={PREREQUISITE_INFO[prereq].installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="template-required-fields__prereq-badge"
                title={`Install ${PREREQUISITE_INFO[prereq].label}`}
              >
                <Box size={12} />
                {PREREQUISITE_INFO[prereq].label}
                <ExternalLink size={10} />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      {hasSetupInstructions && (
        <Alert variant="info" className="template-required-fields__instructions">
          <div className="template-required-fields__instructions-header">
            {template.setupUrl && (
              <a
                href={template.setupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-primary"
              >
                <ExternalLink size={12} className="me-1" />
                Get Credentials
              </a>
            )}
          </div>
          {template.setupInstructions && (
            <pre className="template-required-fields__instructions-text">
              {template.setupInstructions}
            </pre>
          )}
        </Alert>
      )}

      {/* Required Environment Variables */}
      {hasRequiredEnv && (
        <div className="template-required-fields__section">
          {template.requiredEnv!.map((envField: EnvFieldConfig) => {
            const hasConnectorRef = !!envField.connectorRef;
            const matchingConnectors = hasConnectorRef
              ? getMatchingConnectors(envField.connectorRef!.serviceType)
              : [];
            const hasMatchingConnectors = matchingConnectors.length > 0;
            const useConnector = useConnectorFor[envField.key] ?? false;
            const selectedConnector = connectorBindings[envField.key] || '';

            return (
              <Form.Group key={envField.key} className="mb-3">
                <Form.Label>
                  <Key size={14} className="me-1" />
                  {envField.label}
                  {envField.required && <span className="text-danger ms-1">*</span>}
                </Form.Label>

                {/* Show connector/manual toggle if connectorRef exists */}
                {hasConnectorRef && (
                  <div className="connector-auth-toggle mb-2">
                    <Form.Check
                      type="radio"
                      id={`${envField.key}-use-connector`}
                      name={`${envField.key}-auth-mode`}
                      label={
                        <span className="connector-auth-toggle__label">
                          <Link2 size={14} />
                          Use existing connector
                          {hasMatchingConnectors && <span className="badge bg-success ms-1">Recommended</span>}
                        </span>
                      }
                      checked={useConnector}
                      onChange={() => toggleInputMode(envField.key, true)}
                      disabled={disabled || !hasMatchingConnectors}
                    />
                    <Form.Check
                      type="radio"
                      id={`${envField.key}-use-manual`}
                      name={`${envField.key}-auth-mode`}
                      label={
                        <span className="connector-auth-toggle__label">
                          <Edit3 size={14} />
                          Enter manually
                        </span>
                      }
                      checked={!useConnector}
                      onChange={() => toggleInputMode(envField.key, false)}
                      disabled={disabled}
                    />
                  </div>
                )}

                {/* Connector dropdown or manual input based on mode */}
                {hasConnectorRef && useConnector ? (
                  <div className="connector-select-wrapper">
                    <Form.Select
                      value={selectedConnector}
                      onChange={(e) => handleConnectorSelect(envField.key, e.target.value)}
                      disabled={disabled || !hasMatchingConnectors}
                      className="connector-select"
                    >
                      <option value="">Select a connector...</option>
                      {matchingConnectors.map(c => (
                        <option key={c.name} value={c.name}>
                          {c.displayName || c.name} ({c.vendorName})
                          {c.status !== 'active' && ` - ${c.status}`}
                        </option>
                      ))}
                    </Form.Select>
                    {!hasMatchingConnectors && (
                      <Form.Text className="text-warning">
                        No {envField.connectorRef!.serviceType} connectors found.{' '}
                        <a href="#" onClick={(e) => { e.preventDefault(); /* TODO: Navigate to connector creation */ }}>
                          Create one
                        </a>
                      </Form.Text>
                    )}
                  </div>
                ) : (
                  <Form.Control
                    type={envField.secret ? 'password' : 'text'}
                    placeholder={envField.placeholder || `Enter ${envField.label.toLowerCase()}`}
                    value={config.env?.[envField.key] || ''}
                    onChange={(e) => handleEnvChange(envField.key, e.target.value)}
                    disabled={disabled}
                  />
                )}

                <Form.Text className="text-muted">{envField.description}</Form.Text>
              </Form.Group>
            );
          })}
        </div>
      )}

      {/* Required Arguments */}
      {hasRequiredArgs && (
        <div className="template-required-fields__section">
          {template.requiredArgs!.map((argConfig: ArgFieldConfig) => {
            const idx = template.transportConfig.args?.indexOf(argConfig.key);
            const currentValue = idx !== undefined && idx >= 0 && config.args?.[idx] !== argConfig.key
              ? config.args?.[idx] || ''
              : '';

            return (
              <Form.Group key={argConfig.key} className="mb-3">
                <Form.Label>
                  <FolderOpen size={14} className="me-1" />
                  {argConfig.label}
                  {argConfig.required && <span className="text-danger ms-1">*</span>}
                </Form.Label>
                {argConfig.type === 'path' ? (
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder={argConfig.placeholder || `Enter ${argConfig.label.toLowerCase()}`}
                      value={currentValue}
                      onChange={(e) => {
                        if (idx !== undefined && idx >= 0 && config.args) {
                          const newArgs = [...config.args];
                          newArgs[idx] = e.target.value || argConfig.key;
                          onConfigChange({ ...config, args: newArgs });
                        }
                      }}
                      disabled={disabled}
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => handleSelectFolder(argConfig)}
                      disabled={disabled}
                    >
                      Browse
                    </Button>
                  </InputGroup>
                ) : (
                  <Form.Control
                    type={argConfig.type === 'number' ? 'number' : 'text'}
                    placeholder={argConfig.placeholder || `Enter ${argConfig.label.toLowerCase()}`}
                    value={currentValue}
                    onChange={(e) => {
                      if (idx !== undefined && idx >= 0 && config.args) {
                        const newArgs = [...config.args];
                        newArgs[idx] = e.target.value || argConfig.key;
                        onConfigChange({ ...config, args: newArgs });
                      }
                    }}
                    disabled={disabled}
                  />
                )}
                <Form.Text className="text-muted">{argConfig.description}</Form.Text>
              </Form.Group>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TemplateRequiredFields;
