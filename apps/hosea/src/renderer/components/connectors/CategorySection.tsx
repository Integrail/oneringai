/**
 * CategorySection Component
 *
 * Collapsible section for grouping vendors by category.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { VendorCard } from './VendorCard';

interface VendorInfo {
  id: string;
  name: string;
  category: string;
  docsURL?: string;
  credentialsSetupURL?: string;
  authMethods: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    requiredFields: string[];
  }>;
}

interface CategorySectionProps {
  /** Category name */
  category: string;
  /** Display label for the category */
  label: string;
  /** Vendors in this category */
  vendors: VendorInfo[];
  /** Set of vendor IDs that are already configured */
  configuredVendorIds: Set<string>;
  /** Handler when a vendor is selected */
  onSelectVendor: (vendor: VendorInfo) => void;
  /** Whether the section starts expanded */
  defaultExpanded?: boolean;
  /** Compact card mode */
  compactCards?: boolean;
}

export function CategorySection({
  category,
  label,
  vendors,
  configuredVendorIds,
  onSelectVendor,
  defaultExpanded = true,
  compactCards = false,
}: CategorySectionProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const configuredCount = vendors.filter(v => configuredVendorIds.has(v.id)).length;

  return (
    <div className="category-section">
      <button
        className="category-section__header"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <span className="category-section__toggle">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="category-section__label">{label}</span>
        <span className="category-section__count">
          {configuredCount > 0 && (
            <span className="category-section__configured">{configuredCount} configured • </span>
          )}
          {vendors.length} {vendors.length === 1 ? 'service' : 'services'}
        </span>
      </button>

      {expanded && (
        <div className={`category-section__content ${compactCards ? 'category-section__content--compact' : ''}`}>
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              isConfigured={configuredVendorIds.has(vendor.id)}
              onClick={() => onSelectVendor(vendor)}
              compact={compactCards}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CategorySection;
