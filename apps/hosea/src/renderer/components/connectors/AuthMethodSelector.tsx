/**
 * AuthMethodSelector Component
 *
 * Radio button selector for choosing an authentication method from a vendor template.
 */

import React from 'react';
import { Form } from 'react-bootstrap';
import { Key, Lock, Smartphone } from 'lucide-react';

interface AuthMethod {
  id: string;
  name: string;
  type: string;
  description: string;
  requiredFields: string[];
}

interface AuthMethodSelectorProps {
  /** Available authentication methods */
  authMethods: AuthMethod[];
  /** Currently selected method ID */
  selectedMethodId: string | null;
  /** Handler for method selection */
  onSelect: (methodId: string) => void;
}

function getAuthIcon(type: string, id: string): React.ReactNode {
  if (type === 'oauth') {
    if (id.includes('app') || id.includes('github-app')) {
      return <Smartphone size={18} />;
    }
    return <Lock size={18} />;
  }
  return <Key size={18} />;
}

export function AuthMethodSelector({
  authMethods,
  selectedMethodId,
  onSelect,
}: AuthMethodSelectorProps): React.ReactElement {
  if (authMethods.length === 0) {
    return (
      <div className="auth-method-selector auth-method-selector--empty">
        <p className="text-muted">No authentication methods available for this vendor.</p>
      </div>
    );
  }

  // If only one method, auto-select it
  React.useEffect(() => {
    if (authMethods.length === 1 && !selectedMethodId) {
      onSelect(authMethods[0].id);
    }
  }, [authMethods, selectedMethodId, onSelect]);

  return (
    <div className="auth-method-selector">
      <Form.Label className="mb-3">Authentication Method</Form.Label>
      <div className="auth-method-selector__options">
        {authMethods.map((method, index) => (
          <div
            key={method.id}
            className={`auth-method-option ${selectedMethodId === method.id ? 'auth-method-option--selected' : ''}`}
            onClick={() => onSelect(method.id)}
            role="radio"
            aria-checked={selectedMethodId === method.id}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(method.id)}
          >
            <div className="auth-method-option__radio">
              <Form.Check
                type="radio"
                name="authMethod"
                id={`auth-method-${method.id}`}
                checked={selectedMethodId === method.id}
                onChange={() => onSelect(method.id)}
                label=""
              />
            </div>
            <div className="auth-method-option__icon">
              {getAuthIcon(method.type, method.id)}
            </div>
            <div className="auth-method-option__content">
              <div className="auth-method-option__name">{method.name}</div>
              <div className="auth-method-option__description">{method.description}</div>
              {method.requiredFields.length > 0 && (
                <div className="auth-method-option__fields">
                  Requires: {method.requiredFields.join(', ')}
                </div>
              )}
            </div>
            {index === 0 && authMethods.length > 1 && (
              <span className="auth-method-option__recommended">Recommended</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AuthMethodSelector;
