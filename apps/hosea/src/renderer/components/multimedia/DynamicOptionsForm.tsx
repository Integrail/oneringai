/**
 * DynamicOptionsForm - Renders form controls dynamically based on model's vendorOptions schema
 */

import React from 'react';

export interface VendorOptionSchema {
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array';
  description: string;
  required?: boolean;
  label?: string;
  enum?: string[];
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  controlType?: 'select' | 'radio' | 'slider' | 'checkbox' | 'text' | 'textarea';
}

export interface ModelCapabilities {
  sizes: readonly string[];
  aspectRatios?: readonly string[];
  maxImagesPerRequest: number;
  features: {
    qualityControl: boolean;
    styleControl: boolean;
  };
  limits: {
    maxPromptLength: number;
  };
  vendorOptions?: Record<string, VendorOptionSchema>;
}

interface DynamicOptionsFormProps {
  capabilities: ModelCapabilities | null;
  options: Record<string, unknown>;
  onOptionChange: (key: string, value: unknown) => void;
}

export function DynamicOptionsForm({
  capabilities,
  options,
  onOptionChange,
}: DynamicOptionsFormProps): React.ReactElement | null {
  if (!capabilities) {
    return null;
  }

  const { vendorOptions = {}, sizes, maxImagesPerRequest } = capabilities;

  // Filter out aspect ratio from vendor options since we handle it with sizes
  const filteredVendorOptions = Object.entries(vendorOptions).filter(
    ([key]) => key !== 'aspectRatio' || !capabilities.aspectRatios
  );

  const renderControl = (key: string, schema: VendorOptionSchema) => {
    const value = options[key] ?? schema.default;
    const controlType = schema.controlType || inferControlType(schema);

    switch (controlType) {
      case 'select':
        return (
          <select
            className="options-form__select"
            value={String(value ?? '')}
            onChange={(e) => onOptionChange(key, e.target.value)}
          >
            {schema.enum?.map((opt) => (
              <option key={opt} value={opt}>
                {formatEnumLabel(opt)}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="options-form__radio-group">
            {schema.enum?.map((opt) => (
              <label key={opt} className="options-form__radio">
                <input
                  type="radio"
                  name={key}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => onOptionChange(key, e.target.value)}
                />
                {formatEnumLabel(opt)}
              </label>
            ))}
          </div>
        );

      case 'slider':
        return (
          <div className="options-form__slider">
            <input
              type="range"
              min={schema.min ?? 0}
              max={schema.max ?? 100}
              step={schema.step ?? 1}
              value={Number(value ?? schema.min ?? 0)}
              onChange={(e) => onOptionChange(key, Number(e.target.value))}
            />
            <span className="options-form__slider-value">{String(value ?? '')}</span>
          </div>
        );

      case 'checkbox':
        return (
          <label className="options-form__checkbox">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onOptionChange(key, e.target.checked)}
            />
            {schema.label || key}
          </label>
        );

      case 'textarea':
        return (
          <textarea
            className="options-form__textarea"
            value={String(value ?? '')}
            onChange={(e) => onOptionChange(key, e.target.value)}
            placeholder={schema.description}
          />
        );

      case 'text':
      default:
        return (
          <input
            type={schema.type === 'number' ? 'number' : 'text'}
            className="options-form__input"
            value={String(value ?? '')}
            min={schema.min}
            max={schema.max}
            step={schema.step}
            onChange={(e) =>
              onOptionChange(
                key,
                schema.type === 'number' ? Number(e.target.value) : e.target.value
              )
            }
            placeholder={schema.description}
          />
        );
    }
  };

  return (
    <div className="options-form">
      <h4 className="options-form__title">Generation Options</h4>
      <div className="options-form__grid">
        {/* Size selector - always shown */}
        <div className="options-form__field">
          <label className="options-form__label">Size</label>
          <select
            className="options-form__select"
            value={String(options.size ?? sizes[0])}
            onChange={(e) => onOptionChange('size', e.target.value)}
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Number of images - always shown */}
        <div className="options-form__field">
          <label className="options-form__label">Count</label>
          <select
            className="options-form__select"
            value={Number(options.n ?? 1)}
            onChange={(e) => onOptionChange('n', Number(e.target.value))}
          >
            {Array.from({ length: maxImagesPerRequest }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} image{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Aspect ratio for Google models */}
        {capabilities.aspectRatios && (
          <div className="options-form__field">
            <label className="options-form__label">Aspect Ratio</label>
            <select
              className="options-form__select"
              value={String(options.aspectRatio ?? capabilities.aspectRatios[0])}
              onChange={(e) => onOptionChange('aspectRatio', e.target.value)}
            >
              {capabilities.aspectRatios.map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic vendor options */}
        {filteredVendorOptions.map(([key, schema]) => {
          // Skip checkbox fields - render them separately
          if (schema.controlType === 'checkbox' || schema.type === 'boolean') {
            return null;
          }

          return (
            <div
              key={key}
              className={`options-form__field ${
                schema.controlType === 'textarea' ? 'options-form__field--full' : ''
              }`}
            >
              <label className="options-form__label">
                {schema.label || formatLabel(key)}
              </label>
              {renderControl(key, schema)}
            </div>
          );
        })}

        {/* Checkbox fields at the bottom */}
        {filteredVendorOptions
          .filter(([_, schema]) => schema.controlType === 'checkbox' || schema.type === 'boolean')
          .map(([key, schema]) => (
            <div key={key} className="options-form__field">
              {renderControl(key, schema)}
            </div>
          ))}
      </div>
    </div>
  );
}

function inferControlType(schema: VendorOptionSchema): string {
  if (schema.type === 'boolean') return 'checkbox';
  if (schema.type === 'enum' && schema.enum) {
    return schema.enum.length <= 3 ? 'radio' : 'select';
  }
  if (schema.type === 'number' && schema.min !== undefined && schema.max !== undefined) {
    return schema.max - schema.min <= 100 ? 'slider' : 'text';
  }
  return 'text';
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function formatEnumLabel(value: string): string {
  // Handle special cases
  if (value === 'b64_json') return 'Base64';
  if (value === 'url') return 'URL';
  if (value === 'hd') return 'HD';
  if (value.includes('/')) return value; // aspect ratios
  if (value.includes('x')) return value; // sizes
  if (value.startsWith('image/')) return value.split('/')[1].toUpperCase();

  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}
