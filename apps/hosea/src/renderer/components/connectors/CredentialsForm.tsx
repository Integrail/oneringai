/**
 * CredentialsForm Component
 *
 * Dynamic form for entering credentials based on auth template requirements.
 */

import React from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { ExternalLink, Eye, EyeOff, Info } from 'lucide-react';
import { ScopeSelector } from './ScopeSelector';

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
  /** Auth type (api_key or oauth) */
  authType?: 'api_key' | 'oauth';
  /** OAuth flow type */
  oauthFlow?: string;
  /** Hosea's OAuth redirect URI (shown as info, auto-filled for auth_code) */
  oauthRedirectUri?: string;
  /** Available scopes from auth template (enables ScopeSelector) */
  availableScopes?: string[];
  /** Scope descriptions (scope id → human-readable text) */
  scopeDescriptions?: Record<string, string>;
}

export function CredentialsForm({
  requiredFields,
  optionalFields = [],
  values,
  onChange,
  credentialsSetupURL,
  docsURL,
  authType,
  oauthFlow,
  oauthRedirectUri,
  availableScopes,
  scopeDescriptions,
}: CredentialsFormProps): React.ReactElement {
  // For authorization_code OAuth, hide redirectUri (auto-set by Hosea) and scope (use defaults)
  const isAuthCodeOAuth = authType === 'oauth' && oauthFlow === 'authorization_code';
  const hiddenFields = isAuthCodeOAuth ? new Set(['redirectUri']) : new Set<string>();
  const filteredRequired = requiredFields.filter(f => !hiddenFields.has(f));
  const filteredOptional = optionalFields.filter(f => !hiddenFields.has(f));
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
    // Use ScopeSelector for 'scope' field when template scopes are available
    if (field === 'scope' && availableScopes && availableScopes.length > 0) {
      return (
        <Form.Group key={field} className="mb-3">
          <ScopeSelector
            availableScopes={availableScopes}
            scopeDescriptions={scopeDescriptions}
            value={values[field] || ''}
            onChange={(val) => onChange(field, val)}
          />
        </Form.Group>
      );
    }

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

      {/* OAuth redirect URI info (shown for authorization_code flows) */}
      {isAuthCodeOAuth && oauthRedirectUri && (
        <Alert variant="info" className="credentials-form__redirect-info d-flex align-items-start gap-2">
          <Info size={16} className="mt-1 flex-shrink-0" />
          <div>
            <strong>Redirect URI</strong>
            <div className="mt-1">
              Register this redirect URI in your OAuth provider's app settings:
            </div>
            <code className="d-block mt-1 user-select-all">{oauthRedirectUri}</code>
          </div>
        </Alert>
      )}

      {/* Required fields */}
      {filteredRequired.map((field) => renderField(field, true))}

      {/* Optional fields */}
      {filteredOptional.length > 0 && (
        <div className="credentials-form__optional">
          <div className="credentials-form__optional-header">
            <span className="text-muted">Optional Settings</span>
          </div>
          {filteredOptional.map((field) => renderField(field, false))}
        </div>
      )}
    </div>
  );
}

export default CredentialsForm;
