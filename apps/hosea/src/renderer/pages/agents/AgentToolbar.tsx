/**
 * AgentToolbar — search and filter UI for agents.
 * Includes search box, active filter button, and visible count label.
 */
import React from 'react';
import { Search, CheckCircle, Archive } from 'lucide-react';
import type { AgentFilters } from './agentTypes.js';

interface AgentToolbarProps {
  filters: AgentFilters;
  activeCount: number;
  archivedCount: number;
  totalVisible: number;
  onFiltersChange: (filters: AgentFilters) => void;
}

export function AgentToolbar({
  filters,
  activeCount,
  archivedCount,
  totalVisible,
  onFiltersChange,
}: AgentToolbarProps): React.ReactElement {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, query: e.target.value });
  };

  const handleActiveFilterClick = () => {
    onFiltersChange({ ...filters, activeOnly: !filters.activeOnly });
  };

  const handleArchivedFilterClick = () => {
    onFiltersChange({ ...filters, showArchived: !filters.showArchived });
  };

  const filterBtnClass = [
    'agents-filter-btn',
    filters.activeOnly ? 'agents-filter-btn--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const archivedBtnClass = [
    'agents-filter-btn',
    filters.showArchived ? 'agents-filter-btn--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="agents-toolbar">
      <div className="agents-search-box">
        <Search size={14} className="agents-search-icon" />
        <input
          type="text"
          className="agents-search-input"
          placeholder="Search agents…"
          value={filters.query}
          onChange={handleSearchChange}
        />
      </div>

      <button type="button" className={filterBtnClass} onClick={handleActiveFilterClick}>
        <CheckCircle size={13} />
        Active
        {activeCount > 0 && <span className="agents-filter-count">{activeCount}</span>}
      </button>

      {archivedCount > 0 && (
        <button type="button" className={archivedBtnClass} onClick={handleArchivedFilterClick}>
          <Archive size={13} />
          Archived
          <span className="agents-filter-count">{archivedCount}</span>
        </button>
      )}

      <span className="agents-toolbar-count">{totalVisible} agents</span>
    </div>
  );
}
