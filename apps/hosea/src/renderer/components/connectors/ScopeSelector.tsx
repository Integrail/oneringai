/**
 * ScopeSelector Component
 *
 * Checkbox-based OAuth scope selector with template-defined scopes,
 * descriptions, and support for custom scopes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';
import { Plus, X } from 'lucide-react';

interface ScopeSelectorProps {
  /** Available scopes from the auth template */
  availableScopes: string[];
  /** Scope descriptions (id → human text) */
  scopeDescriptions?: Record<string, string>;
  /** Currently selected scopes (space-separated string) */
  value: string;
  /** Callback when scopes change */
  onChange: (value: string) => void;
}

export function ScopeSelector({
  availableScopes,
  scopeDescriptions = {},
  value,
  onChange,
}: ScopeSelectorProps): React.ReactElement {
  // Parse value into checked template scopes and custom scopes
  const parseValue = useCallback(
    (val: string) => {
      const templateSet = new Set(availableScopes);
      if (!val.trim()) {
        // Empty value → all template scopes selected by default
        return { checked: new Set(availableScopes), custom: [] as string[] };
      }
      const parts = val.split(/\s+/).filter(Boolean);
      const checked = new Set<string>();
      const custom: string[] = [];
      for (const part of parts) {
        if (templateSet.has(part)) {
          checked.add(part);
        } else {
          custom.push(part);
        }
      }
      return { checked, custom };
    },
    [availableScopes],
  );

  const [checkedScopes, setCheckedScopes] = useState<Set<string>>(new Set());
  const [customScopes, setCustomScopes] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize from value
  useEffect(() => {
    const { checked, custom } = parseValue(value);
    setCheckedScopes(checked);
    setCustomScopes(custom);
    setInitialized(true);
  }, []); // Only on mount

  // Emit changes
  const emitChange = useCallback(
    (checked: Set<string>, custom: string[]) => {
      // Build ordered list: template scopes in template order, then custom
      const selected = availableScopes.filter((s) => checked.has(s));
      const all = [...selected, ...custom];
      onChange(all.join(' '));
    },
    [availableScopes, onChange],
  );

  // Don't emit on initial render — wait for first user interaction
  const handleToggle = (scope: string) => {
    const next = new Set(checkedScopes);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    setCheckedScopes(next);
    emitChange(next, customScopes);
  };

  const handleSelectAll = () => {
    const next = new Set(availableScopes);
    setCheckedScopes(next);
    emitChange(next, customScopes);
  };

  const handleSelectNone = () => {
    const next = new Set<string>();
    setCheckedScopes(next);
    emitChange(next, customScopes);
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    // Split by spaces in case user pastes multiple
    const newScopes = trimmed.split(/\s+/).filter(Boolean);
    const templateSet = new Set(availableScopes);
    const existingCustom = new Set(customScopes);
    const toAdd: string[] = [];
    const nextChecked = new Set(checkedScopes);

    for (const s of newScopes) {
      if (templateSet.has(s)) {
        // It's a template scope — just check it
        nextChecked.add(s);
      } else if (!existingCustom.has(s)) {
        toAdd.push(s);
      }
    }

    const nextCustom = [...customScopes, ...toAdd];
    setCheckedScopes(nextChecked);
    setCustomScopes(nextCustom);
    setCustomInput('');
    emitChange(nextChecked, nextCustom);
  };

  const handleRemoveCustom = (scope: string) => {
    const nextCustom = customScopes.filter((s) => s !== scope);
    setCustomScopes(nextCustom);
    emitChange(checkedScopes, nextCustom);
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  if (!initialized) return <></>;

  return (
    <div className="scope-selector">
      <Form.Label>
        Scopes
        <span className="text-muted ms-2" style={{ fontSize: '0.85em', fontWeight: 'normal' }}>
          ({checkedScopes.size + customScopes.length} selected)
        </span>
      </Form.Label>

      {/* Quick actions */}
      <div className="scope-selector__actions mb-2">
        <Button
          variant="link"
          size="sm"
          className="p-0 me-3 text-decoration-none"
          onClick={handleSelectAll}
        >
          Select all
        </Button>
        <Button
          variant="link"
          size="sm"
          className="p-0 text-decoration-none"
          onClick={handleSelectNone}
        >
          Select none
        </Button>
      </div>

      {/* Template scopes as checkboxes */}
      <div className="scope-selector__list">
        {availableScopes.map((scope) => {
          const description = scopeDescriptions[scope];
          return (
            <Form.Check
              key={scope}
              type="checkbox"
              id={`scope-${scope}`}
              className="scope-selector__item"
              checked={checkedScopes.has(scope)}
              onChange={() => handleToggle(scope)}
              label={
                <span className="scope-selector__label">
                  {description ? (
                    <>
                      <span className="scope-selector__description">{description}</span>
                      <code className="scope-selector__id">{scope}</code>
                    </>
                  ) : (
                    <code className="scope-selector__id">{scope}</code>
                  )}
                </span>
              }
            />
          );
        })}
      </div>

      {/* Custom scopes */}
      <div className="scope-selector__custom mt-3">
        <Form.Label className="text-muted" style={{ fontSize: '0.85em' }}>
          Custom scopes
        </Form.Label>
        {customScopes.length > 0 && (
          <div className="scope-selector__custom-tags mb-2">
            {customScopes.map((scope) => (
              <Badge
                key={scope}
                bg="secondary"
                className="scope-selector__custom-tag me-1 mb-1"
              >
                <code>{scope}</code>
                <X
                  size={12}
                  className="ms-1 cursor-pointer"
                  onClick={() => handleRemoveCustom(scope)}
                  role="button"
                />
              </Badge>
            ))}
          </div>
        )}
        <div className="scope-selector__custom-input d-flex gap-2">
          <Form.Control
            type="text"
            size="sm"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={handleCustomKeyDown}
            placeholder="Enter custom scope..."
          />
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleAddCustom}
            disabled={!customInput.trim()}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ScopeSelector;
