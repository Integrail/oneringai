/**
 * CredentialsForm Component
 *
 * Dynamic form for entering credentials based on auth template requirements.
 */

import React from 'react';
import { Form, Button } from 'react-bootstrap';
import { ExternalLink, Eye, EyeOff } from 'lucide-react';

// Field metadata for better UX
const FIELD_CONFIG: Record<string, {
  label: string;
  placeholder: string;
  helpText?: string;
  type: 'text' | 'password' | 'url' | 'textarea';
}> = {
  apiKey: {
    label: 'API Key',
    placeholder: 'Enter your API key',
    helpText: 'Your API key or access token',
    type: 'password',
  },
  clientId: {
    label: 'Client ID',
    placeholder: 'Enter OAuth client ID',
    helpText: 'The OAuth client ID from your app registration',
    type: 'text',
  },
  clientSecret: {
    label: 'Client Secret',
    placeholder: 'Enter OAuth client secret',
    helpText: 'The OAuth client secret from your app registration',
    type: 'password',
  },
  redirectUri: {
    label: 'Redirect URI',
    placeholder: 'hosea://oauth-callback',
    helpText: 'Must match the redirect URI in your app settings',
    type: 'url',
  },
  scope: {
    label: 'Scopes',
    placeholder: 'read:user repo',
    helpText: 'Space-separated list of OAuth scopes',
    type: 'text',
  },
  privateKey: {
    label: 'Private Key',
    placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...',
    helpText: 'PEM-encoded private key for JWT signing',
    type: 'textarea',
  },
  privateKeyPath: {
    label: 'Private Key Path',
    placeholder: '/path/to/private-key.pem',
    helpText: 'File path to the PEM private key',
    type: 'text',
  },
  appId: {
    label: 'App ID',
    placeholder: '12345',
    helpText: 'The application ID from your app settings',
    type: 'text',
  },
  installationId: {
    label: 'Installation ID',
    placeholder: '67890',
    helpText: 'The installation ID for the app',
    type: 'text',
  },
  tenantId: {
    label: 'Tenant ID',
    placeholder: 'your-tenant-id',
    helpText: 'Azure/Microsoft tenant ID',
    type: 'text',
  },
  username: {
    label: 'Username',
    placeholder: 'Enter username',
    type: 'text',
  },
  subject: {
    label: 'Subject',
    placeholder: 'Enter subject claim',
    helpText: 'Subject claim for JWT tokens',
    type: 'text',
  },
  audience: {
    label: 'Audience',
    placeholder: 'https://api.example.com',
    helpText: 'Token audience URL',
    type: 'url',
  },
  userScope: {
    label: 'User Scope',
    placeholder: 'user:email user:read',
    type: 'text',
  },
  accountId: {
    label: 'Account ID',
    placeholder: 'Enter account ID',
    type: 'text',
  },
  subdomain: {
    label: 'Subdomain',
    placeholder: 'your-company',
    helpText: 'Your organization subdomain',
    type: 'text',
  },
  region: {
    label: 'Region',
    placeholder: 'us-west-2',
    helpText: 'AWS region or service region',
    type: 'text',
  },
  accessKeyId: {
    label: 'Access Key ID',
    placeholder: 'AKIAXXXXXXXXXXXXXXXX',
    type: 'text',
  },
  secretAccessKey: {
    label: 'Secret Access Key',
    placeholder: 'Enter secret access key',
    type: 'password',
  },
  applicationKey: {
    label: 'Application Key',
    placeholder: 'Enter application key',
    type: 'password',
  },
};

interface CredentialsFormProps {
  /** Required fields from auth template */
  requiredFields: string[];
  /** Optional fields from auth template */
  optionalFields?: string[];
  /** Current credential values */
  values: Record<string, string>;
  /** Handler for value changes */
  onChange: (field: string, value: string) => void;
  /** URL for getting credentials */
  credentialsSetupURL?: string;
  /** Documentation URL */
  docsURL?: string;
}

export function CredentialsForm({
  requiredFields,
  optionalFields = [],
  values,
  onChange,
  credentialsSetupURL,
  docsURL,
}: CredentialsFormProps): React.ReactElement {
  const [showSecrets, setShowSecrets] = React.useState<Set<string>>(new Set());

  const toggleSecretVisibility = (field: string) => {
    const newSet = new Set(showSecrets);
    if (newSet.has(field)) {
      newSet.delete(field);
    } else {
      newSet.add(field);
    }
    setShowSecrets(newSet);
  };

  const renderField = (field: string, required: boolean) => {
    const config = FIELD_CONFIG[field] || {
      label: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1'),
      placeholder: `Enter ${field}`,
      type: 'text',
    };

    const isSecret = config.type === 'password';
    const showSecret = showSecrets.has(field);

    return (
      <Form.Group key={field} className="mb-3">
        <Form.Label>
          {config.label}
          {required && <span className="text-danger ms-1">*</span>}
        </Form.Label>
        {config.type === 'textarea' ? (
          <Form.Control
            as="textarea"
            rows={4}
            value={values[field] || ''}
            onChange={(e) => onChange(field, e.target.value)}
            placeholder={config.placeholder}
            required={required}
            className="credentials-form__textarea"
          />
        ) : (
          <div className="credentials-form__input-group">
            <Form.Control
              type={isSecret && !showSecret ? 'password' : 'text'}
              value={values[field] || ''}
              onChange={(e) => onChange(field, e.target.value)}
              placeholder={config.placeholder}
              required={required}
            />
            {isSecret && (
              <Button
                variant="outline-secondary"
                size="sm"
                className="credentials-form__toggle-visibility"
                onClick={() => toggleSecretVisibility(field)}
                type="button"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
            )}
          </div>
        )}
        {config.helpText && (
          <Form.Text className="text-muted">{config.helpText}</Form.Text>
        )}
      </Form.Group>
    );
  };

  return (
    <div className="credentials-form">
      {/* Helper links */}
      {(credentialsSetupURL || docsURL) && (
        <div className="credentials-form__links mb-3">
          {credentialsSetupURL && (
            <a
              href={credentialsSetupURL}
              target="_blank"
              rel="noopener noreferrer"
              className="credentials-form__link"
            >
              <ExternalLink size={14} />
              <span>Get Credentials</span>
            </a>
          )}
          {docsURL && (
            <a
              href={docsURL}
              target="_blank"
              rel="noopener noreferrer"
              className="credentials-form__link"
            >
              <ExternalLink size={14} />
              <span>Documentation</span>
            </a>
          )}
        </div>
      )}

      {/* Required fields */}
      {requiredFields.map((field) => renderField(field, true))}

      {/* Optional fields */}
      {optionalFields.length > 0 && (
        <div className="credentials-form__optional">
          <div className="credentials-form__optional-header">
            <span className="text-muted">Optional Settings</span>
          </div>
          {optionalFields.map((field) => renderField(field, false))}
        </div>
      )}
    </div>
  );
}

export default CredentialsForm;
