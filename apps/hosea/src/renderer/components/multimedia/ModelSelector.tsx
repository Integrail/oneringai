/**
 * ModelSelector - Dropdown for selecting image generation model
 * Groups models by vendor and only shows models for configured connectors
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ImageModelInfo {
  name: string;
  displayName: string;
  vendor: string;
  description?: string;
  deprecationDate?: string;
  maxPromptLength: number;
  maxImagesPerRequest: number;
  pricing?: {
    perImage?: number;
    perImageStandard?: number;
    perImageHD?: number;
  };
}

interface ModelSelectorProps {
  models: ImageModelInfo[];
  selectedModel: string | null;
  onSelectModel: (modelName: string) => void;
  disabled?: boolean;
}

// Vendor display info
const vendorLabels: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
  anthropic: 'Anthropic',
  grok: 'Grok (xAI)',
};

export function ModelSelector({
  models,
  selectedModel,
  onSelectModel,
  disabled = false,
}: ModelSelectorProps): React.ReactElement {
  // Group models by vendor
  const modelsByVendor = models.reduce<Record<string, ImageModelInfo[]>>((acc, model) => {
    const vendor = model.vendor;
    if (!acc[vendor]) {
      acc[vendor] = [];
    }
    acc[vendor].push(model);
    return acc;
  }, {});

  const selectedModelInfo = models.find((m) => m.name === selectedModel);
  const isDeprecated = selectedModelInfo?.deprecationDate;

  return (
    <div className="model-selector">
      <label className="model-selector__label" htmlFor="model-select">
        Model
      </label>
      <select
        id="model-select"
        className="model-selector__select"
        value={selectedModel || ''}
        onChange={(e) => onSelectModel(e.target.value)}
        disabled={disabled || models.length === 0}
      >
        {models.length === 0 ? (
          <option value="">No models available</option>
        ) : (
          <>
            <option value="">Select a model...</option>
            {Object.entries(modelsByVendor).map(([vendor, vendorModels]) => (
              <optgroup key={vendor} label={vendorLabels[vendor] || vendor}>
                {vendorModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.displayName}
                    {model.deprecationDate && ' (Deprecated)'}
                  </option>
                ))}
              </optgroup>
            ))}
          </>
        )}
      </select>

      {selectedModelInfo && (
        <div className="model-selector__info">
          {isDeprecated && (
            <span className="model-selector__warning">
              <AlertCircle size={12} />
              Deprecated: {new Date(isDeprecated).toLocaleDateString()}
            </span>
          )}
          {selectedModelInfo.description && (
            <span>{selectedModelInfo.description}</span>
          )}
        </div>
      )}
    </div>
  );
}
