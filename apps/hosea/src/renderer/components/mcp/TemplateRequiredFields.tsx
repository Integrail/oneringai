/**
 * TemplateRequiredFields Component
 *
 * Displays and handles required fields from an MCP template (env vars and args).
 */

import React from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import { Key, FolderOpen, AlertCircle } from 'lucide-react';
import type { MCPServerTemplate, EnvFieldConfig, ArgFieldConfig } from '../../../shared/mcpTemplates';
import type { TransportConfig } from './TransportConfigForm';

interface TemplateRequiredFieldsProps {
  /** The selected template */
  template: MCPServerTemplate;
  /** Current transport config */
  config: TransportConfig;
  /** Handler for config changes */
  onConfigChange: (config: TransportConfig) => void;
  /** Whether form is disabled */
  disabled?: boolean;
}

export function TemplateRequiredFields({
  template,
  config,
  onConfigChange,
  disabled = false,
}: TemplateRequiredFieldsProps): React.ReactElement | null {
  const hasRequiredEnv = template.requiredEnv && template.requiredEnv.length > 0;
  const hasRequiredArgs = template.requiredArgs && template.requiredArgs.length > 0;

  if (!hasRequiredEnv && !hasRequiredArgs) {
    return null;
  }

  // Handle environment variable change
  const handleEnvChange = (key: string, value: string) => {
    const newEnv = { ...config.env, [key]: value };
    onConfigChange({ ...config, env: newEnv });
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
        Required Configuration
      </div>
      <p className="template-required-fields__description">
        This template requires the following configuration to work properly.
      </p>

      {/* Required Environment Variables */}
      {hasRequiredEnv && (
        <div className="template-required-fields__section">
          {template.requiredEnv!.map((envField: EnvFieldConfig) => (
            <Form.Group key={envField.key} className="mb-3">
              <Form.Label>
                <Key size={14} className="me-1" />
                {envField.label}
                {envField.required && <span className="text-danger ms-1">*</span>}
              </Form.Label>
              <Form.Control
                type={envField.secret ? 'password' : 'text'}
                placeholder={envField.placeholder || `Enter ${envField.label.toLowerCase()}`}
                value={config.env?.[envField.key] || ''}
                onChange={(e) => handleEnvChange(envField.key, e.target.value)}
                disabled={disabled}
              />
              <Form.Text className="text-muted">{envField.description}</Form.Text>
            </Form.Group>
          ))}
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
