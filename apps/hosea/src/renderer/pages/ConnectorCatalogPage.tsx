/**
 * ConnectorCatalogPage - Browse all vendor templates by category
 *
 * Displays 43+ vendors organized into 12 categories with search and filter.
 * Users can select a vendor to create a new universal connector.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import { Search, ArrowLeft, Filter } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { CategorySection, prefetchVendorLogos } from '../components/connectors';
import { useNavigation } from '../hooks/useNavigation';

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

// Category display labels and order
const CATEGORY_ORDER: { id: string; label: string }[] = [
  { id: 'major-vendors', label: 'Major Vendors' },
  { id: 'communication', label: 'Communication' },
  { id: 'development', label: 'Development' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'crm', label: 'CRM' },
  { id: 'payments', label: 'Payments' },
  { id: 'email', label: 'Email' },
  { id: 'storage', label: 'Storage' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'search', label: 'Search' },
  { id: 'scrape', label: 'Web Scraping' },
  { id: 'other', label: 'Other' },
];

export function ConnectorCatalogPage(): React.ReactElement {
  const { navigate, setData } = useNavigation();
  const [vendors, setVendors] = useState<VendorInfo[]>([]);
  const [configuredConnectors, setConfiguredConnectors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Load vendors and configured connectors
  useEffect(() => {
    const loadData = async () => {
      try {
        const [vendorList, connectorList] = await Promise.all([
          window.hosea.universalConnector.listVendors(),
          window.hosea.universalConnector.list(),
        ]);

        setVendors(vendorList);
        setConfiguredConnectors(new Set(connectorList.map(c => c.vendorId)));

        // Prefetch logos for visible vendors
        prefetchVendorLogos(vendorList.map(v => v.id));
      } catch (error) {
        console.error('Failed to load vendors:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter vendors based on search and category
  const filteredVendors = useMemo(() => {
    let result = vendors;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(query) ||
        v.id.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter(v => v.category === selectedCategory);
    }

    return result;
  }, [vendors, searchQuery, selectedCategory]);

  // Group vendors by category
  const vendorsByCategory = useMemo(() => {
    const grouped = new Map<string, VendorInfo[]>();

    for (const vendor of filteredVendors) {
      const existing = grouped.get(vendor.category) || [];
      existing.push(vendor);
      grouped.set(vendor.category, existing);
    }

    // Sort vendors within each category by name
    for (const [category, list] of grouped) {
      grouped.set(category, list.sort((a, b) => a.name.localeCompare(b.name)));
    }

    return grouped;
  }, [filteredVendors]);

  // Get unique categories from current vendors
  const availableCategories = useMemo(() => {
    const categories = new Set(vendors.map(v => v.category));
    return CATEGORY_ORDER.filter(c => categories.has(c.id));
  }, [vendors]);

  const handleSelectVendor = useCallback((vendor: VendorInfo) => {
    // Navigate to create page with vendor data
    setData({ selectedVendor: vendor });
    navigate('connector-create');
  }, [navigate, setData]);

  const handleBack = () => {
    navigate('universal-connectors');
  };

  if (loading) {
    return (
      <div className="page">
        <PageHeader title="Add Connector" subtitle="Loading vendors..." />
        <div className="page__content">
          <div className="text-center py-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page connector-catalog-page">
      <PageHeader
        title="Add Universal Connector"
        subtitle={`${vendors.length} services available across ${availableCategories.length} categories`}
      >
        <Button variant="outline-secondary" onClick={handleBack}>
          <ArrowLeft size={16} className="me-2" />
          Back
        </Button>
      </PageHeader>

      <div className="page__content">
        {/* Search and Filter Bar */}
        <div className="connector-catalog-page__toolbar">
          <InputGroup className="connector-catalog-page__search">
            <InputGroup.Text>
              <Search size={16} />
            </InputGroup.Text>
            <Form.Control
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>

          <div className="connector-catalog-page__filters">
            <Form.Select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="connector-catalog-page__category-filter"
            >
              <option value="">All Categories</option>
              {availableCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </Form.Select>
          </div>
        </div>

        {/* Results */}
        {filteredVendors.length === 0 ? (
          <div className="empty-state mt-5">
            <div className="empty-state__icon">
              <Filter size={32} />
            </div>
            <h3 className="empty-state__title">No services found</h3>
            <p className="empty-state__description">
              {searchQuery
                ? `No services match "${searchQuery}"`
                : 'No services in this category'}
            </p>
            <Button variant="outline-primary" onClick={() => {
              setSearchQuery('');
              setSelectedCategory(null);
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="connector-catalog-page__categories">
            {CATEGORY_ORDER.filter(cat => vendorsByCategory.has(cat.id)).map(cat => (
              <CategorySection
                key={cat.id}
                category={cat.id}
                label={cat.label}
                vendors={vendorsByCategory.get(cat.id) || []}
                configuredVendorIds={configuredConnectors}
                onSelectVendor={handleSelectVendor}
                defaultExpanded={!selectedCategory || selectedCategory === cat.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConnectorCatalogPage;
