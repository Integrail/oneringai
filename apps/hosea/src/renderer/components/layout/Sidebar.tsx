/**
 * Sidebar Navigation Component
 */

import React, { useState } from 'react';
import {
  MessageSquare,
  Bot,
  Plug,
  Brain,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Key,
  Wrench,
} from 'lucide-react';
import { useNavigation, type PageId } from '../../hooks/useNavigation';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Main',
    items: [
      { id: 'chat', label: 'Chat', icon: <MessageSquare size={20} /> },
      { id: 'agents', label: 'Agents', icon: <Bot size={20} /> },
    ],
  },
  {
    label: 'Connectors',
    items: [
      { id: 'llm-connectors', label: 'LLM Providers', icon: <Brain size={20} /> },
      { id: 'api-connectors', label: 'API Services', icon: <Key size={20} /> },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'tool-connectors', label: 'Tool Catalog', icon: <Wrench size={20} /> },
    ],
  },
  {
    label: 'Debug',
    items: [
      { id: 'internals', label: 'Look Inside', icon: <Search size={20} /> },
    ],
  },
];

export function Sidebar(): React.ReactElement {
  const [expanded, setExpanded] = useState(true);
  const { state, navigate } = useNavigation();

  return (
    <aside className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}>
      {/* macOS drag region for window dragging */}
      <div className="sidebar__drag-region" />

      {/* Brand */}
      <div className="sidebar__brand" onClick={() => setExpanded(!expanded)}>
        <div className="sidebar__logo">
          <span className="sidebar__logo-letter">H</span>
        </div>
        {expanded && (
          <div className="sidebar__brand-content">
            <span className="sidebar__brand-text">HOSEA</span>
            <span className="sidebar__brand-tagline">AI Agents</span>
          </div>
        )}
        <button
          className="sidebar__toggle"
          type="button"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {navSections.map((section) => (
          <div key={section.label} className="sidebar__section">
            {expanded && <div className="sidebar__section-label">{section.label}</div>}
            {section.items.map((item) => (
              <button
                key={item.id}
                className={`sidebar__item ${
                  state.currentPage === item.id ? 'sidebar__item--active' : ''
                }`}
                onClick={() => navigate(item.id)}
                type="button"
                title={!expanded ? item.label : undefined}
              >
                <span className="sidebar__item-icon">{item.icon}</span>
                {expanded && (
                  <>
                    <span className="sidebar__item-text">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="sidebar__item-badge">{item.badge}</span>
                    )}
                  </>
                )}
                {!expanded && <span className="sidebar__tooltip">{item.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <button
          className={`sidebar__item ${
            state.currentPage === 'settings' ? 'sidebar__item--active' : ''
          }`}
          onClick={() => navigate('settings')}
          type="button"
          title={!expanded ? 'Settings' : undefined}
        >
          <span className="sidebar__item-icon">
            <Settings size={20} />
          </span>
          {expanded && <span className="sidebar__item-text">Settings</span>}
          {!expanded && <span className="sidebar__tooltip">Settings</span>}
        </button>
      </div>
    </aside>
  );
}
