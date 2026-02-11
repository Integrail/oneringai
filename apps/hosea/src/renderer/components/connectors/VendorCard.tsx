/**
 * VendorCard Component
 *
 * Displays a vendor with logo, name, and category badge.
 * Used in the vendor catalog for browsing available services.
 */

import React from 'react';
import { Badge } from 'react-bootstrap';
import { ExternalLink, Check } from 'lucide-react';
import { VendorLogo } from './VendorLogo';

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

interface VendorCardProps {
  /** Vendor information */
  vendor: VendorInfo;
  /** Number of connectors already configured for this vendor (0 = none) */
  configuredCount?: number;
  /** Click handler */
  onClick?: () => void;
  /** Whether the card is in a compact mode */
  compact?: boolean;
  /** Whether the card is selected */
  selected?: boolean;
}

// Category display names and colors
const CATEGORY_CONFIG: Record<string, { label: string; variant: string }> = {
  'major-vendors': { label: 'Major Vendor', variant: 'primary' },
  cloud: { label: 'Cloud', variant: 'info' },
  communication: { label: 'Communication', variant: 'secondary' },
  crm: { label: 'CRM', variant: 'success' },
  development: { label: 'Development', variant: 'dark' },
  email: { label: 'Email', variant: 'warning' },
  monitoring: { label: 'Monitoring', variant: 'danger' },
  other: { label: 'Other', variant: 'secondary' },
  payments: { label: 'Payments', variant: 'success' },
  productivity: { label: 'Productivity', variant: 'info' },
  scrape: { label: 'Web Scraping', variant: 'info' },
  search: { label: 'Search', variant: 'warning' },
  storage: { label: 'Storage', variant: 'dark' },
};

export function VendorCard({
  vendor,
  configuredCount = 0,
  onClick,
  compact = false,
  selected = false,
}: VendorCardProps): React.ReactElement {
  const categoryConfig = CATEGORY_CONFIG[vendor.category] || { label: vendor.category, variant: 'secondary' };
  const authMethodCount = vendor.authMethods.length;
  const isConfigured = configuredCount > 0;

  if (compact) {
    return (
      <div
        className={`vendor-card vendor-card--compact ${onClick ? 'vendor-card--clickable' : ''} ${selected ? 'vendor-card--selected' : ''} ${isConfigured ? 'vendor-card--configured' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      >
        <VendorLogo vendorId={vendor.id} size={32} />
        <div className="vendor-card__info">
          <span className="vendor-card__name">{vendor.name}</span>
        </div>
        {isConfigured && (
          <div className="vendor-card__status">
            <Check size={14} className="text-success" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`vendor-card ${onClick ? 'vendor-card--clickable' : ''} ${selected ? 'vendor-card--selected' : ''} ${isConfigured ? 'vendor-card--configured' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="vendor-card__header">
        <VendorLogo vendorId={vendor.id} size={40} />
        <div className="vendor-card__title">
          <span className="vendor-card__name">{vendor.name}</span>
          <Badge bg={categoryConfig.variant} className="vendor-card__category">
            {categoryConfig.label}
          </Badge>
        </div>
        {isConfigured && (
          <Badge bg="success" className="vendor-card__configured-badge">
            <Check size={12} className="me-1" />
            {configuredCount === 1 ? 'Configured' : `${configuredCount} configured`}
          </Badge>
        )}
      </div>

      <div className="vendor-card__body">
        <div className="vendor-card__auth-methods">
          {authMethodCount === 1 ? (
            <span className="text-muted text-xs">
              Auth: {vendor.authMethods[0].name}
            </span>
          ) : (
            <span className="text-muted text-xs">
              {authMethodCount} auth methods available
            </span>
          )}
        </div>

        {vendor.docsURL && (
          <a
            href={vendor.docsURL}
            target="_blank"
            rel="noopener noreferrer"
            className="vendor-card__link"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            <span>Docs</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default VendorCard;
