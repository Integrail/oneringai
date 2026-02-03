/**
 * MCPTemplateSelector Component
 *
 * Modal for browsing and selecting MCP server templates.
 * Features category tabs, search/filter, and a grid of template cards.
 */

import React, { useState, useMemo } from 'react';
import { Modal, Form, Button, Nav } from 'react-bootstrap';
import { Search, Server, X } from 'lucide-react';
import { MCPTemplateCard } from './MCPTemplateCard';
import {
  MCP_TEMPLATES,
  CATEGORY_INFO,
  CATEGORY_ORDER,
  searchTemplates,
  getTemplatesByCategory,
  type MCPServerTemplate,
  type MCPTemplateCategory,
} from '../../../shared/mcpTemplates';

interface MCPTemplateSelectorProps {
  /** Whether the modal is shown */
  show: boolean;
  /** Handler to close the modal */
  onHide: () => void;
  /** Handler when a template is selected */
  onSelect: (template: MCPServerTemplate) => void;
}

export function MCPTemplateSelector({
  show,
  onHide,
  onSelect,
}: MCPTemplateSelectorProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MCPTemplateCategory | 'all'>('all');

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let templates: MCPServerTemplate[];

    // First filter by search
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery);
    } else {
      templates = MCP_TEMPLATES;
    }

    // Then filter by category
    if (selectedCategory !== 'all') {
      templates = templates.filter((t) => t.category === selectedCategory);
    }

    // Sort by popularity within results
    return templates.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }, [searchQuery, selectedCategory]);

  // Get counts per category for display
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: MCP_TEMPLATES.length };
    for (const cat of CATEGORY_ORDER) {
      counts[cat] = getTemplatesByCategory(cat).length;
    }
    return counts;
  }, []);

  const handleSelect = (template: MCPServerTemplate) => {
    onSelect(template);
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      size="xl"
      className="mcp-template-selector-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <Server size={20} />
          Browse MCP Server Templates
        </Modal.Title>
      </Modal.Header>

      <div className="mcp-template-selector__toolbar">
        {/* Search input */}
        <div className="mcp-template-selector__search">
          <Search size={16} className="mcp-template-selector__search-icon" />
          <Form.Control
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mcp-template-selector__search-input"
          />
          {searchQuery && (
            <button
              className="mcp-template-selector__search-clear"
              onClick={() => setSearchQuery('')}
              type="button"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category tabs */}
        <Nav
          variant="pills"
          className="mcp-template-selector__categories"
          activeKey={selectedCategory}
          onSelect={(k) => setSelectedCategory(k as MCPTemplateCategory | 'all')}
        >
          <Nav.Item>
            <Nav.Link eventKey="all" className="mcp-template-selector__category-tab">
              All
              <span className="mcp-template-selector__category-count">{categoryCounts.all}</span>
            </Nav.Link>
          </Nav.Item>
          {CATEGORY_ORDER.map((cat: MCPTemplateCategory) => (
            <Nav.Item key={cat}>
              <Nav.Link eventKey={cat} className="mcp-template-selector__category-tab">
                {CATEGORY_INFO[cat].label}
                <span className="mcp-template-selector__category-count">{categoryCounts[cat]}</span>
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
      </div>

      <Modal.Body className="mcp-template-selector__body">
        {filteredTemplates.length === 0 ? (
          <div className="mcp-template-selector__empty">
            <Search size={48} />
            <h4>No templates found</h4>
            <p>Try adjusting your search or selecting a different category.</p>
          </div>
        ) : (
          <div className="mcp-template-selector__grid">
            {filteredTemplates.map((template) => (
              <MCPTemplateCard
                key={template.id}
                template={template}
                onClick={handleSelect}
              />
            ))}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="mcp-template-selector__footer-info">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''} available
        </div>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default MCPTemplateSelector;
