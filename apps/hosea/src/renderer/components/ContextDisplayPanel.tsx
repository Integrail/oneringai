/**
 * ContextDisplayPanel - Renders in-context memory entries with showInUI=true
 * or user-pinned keys in the Dynamic UI sidebar.
 *
 * Each entry is rendered as a card with markdown-rendered values using the
 * same MarkdownRenderer as the chat window.
 *
 * Features:
 * - Collapse/expand individual cards
 * - Maximize a single card to fill the panel (hides all others)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pin, PinOff, Database, ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { MarkdownRenderer } from '@everworker/react-ui';
import type { ContextEntryForUI } from '../../preload/index';

interface ContextDisplayPanelProps {
  entries: ContextEntryForUI[];
  pinnedKeys: string[];
  onPinToggle: (key: string, pinned: boolean) => void;
  /** Called when a card is maximized or un-maximized (so parent can hide sibling content) */
  onMaximizedChange?: (isMaximized: boolean) => void;
}

/**
 * Format a value for markdown display.
 * - Strings are rendered as markdown directly.
 * - Objects/arrays are shown as JSON code blocks.
 * - Primitives are shown as inline text.
 */
function formatValueForDisplay(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Objects and arrays → formatted JSON
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```';
}

export function ContextDisplayPanel({
  entries,
  pinnedKeys,
  onPinToggle,
  onMaximizedChange,
}: ContextDisplayPanelProps): React.ReactElement | null {
  const pinnedSet = useMemo(() => new Set(pinnedKeys), [pinnedKeys]);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [maximizedKey, setMaximizedKey] = useState<string | null>(null);

  // Filter: show entries where showInUI=true OR key is pinned
  const visibleEntries = useMemo(() => {
    return entries.filter(e => e.showInUI || pinnedSet.has(e.key));
  }, [entries, pinnedSet]);

  const handlePinToggle = useCallback((key: string) => {
    const isPinned = pinnedSet.has(key);
    onPinToggle(key, !isPinned);
  }, [pinnedSet, onPinToggle]);

  const handleCollapseToggle = useCallback((key: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleMaximizeToggle = useCallback((key: string) => {
    setMaximizedKey(prev => {
      const next = prev === key ? null : key;
      onMaximizedChange?.(next !== null);
      return next;
    });
  }, [onMaximizedChange]);

  // Don't render anything if no visible entries
  if (visibleEntries.length === 0) return null;

  // When maximized, show only that card
  const isMaximized = maximizedKey !== null;
  const displayEntries = isMaximized
    ? visibleEntries.filter(e => e.key === maximizedKey)
    : visibleEntries;

  return (
    <div className={`context-display-panel ${isMaximized ? 'context-display-panel--maximized' : ''}`}>
      <div className="context-display-panel__header">
        <Database size={14} />
        <span>Current Context</span>
        <span className="context-display-panel__count">{visibleEntries.length}</span>
        {isMaximized && (
          <button
            className="context-display-panel__exit-maximize"
            onClick={() => {
              setMaximizedKey(null);
              onMaximizedChange?.(false);
            }}
            title="Exit full view"
          >
            <Minimize2 size={12} />
            <span>Exit full view</span>
          </button>
        )}
      </div>
      <div className="context-display-panel__entries">
        {displayEntries.map(entry => (
          <ContextEntryCard
            key={entry.key}
            entry={entry}
            isPinned={pinnedSet.has(entry.key)}
            isCollapsed={collapsedKeys.has(entry.key)}
            isMaximized={maximizedKey === entry.key}
            showMaximize={true}
            onPinToggle={handlePinToggle}
            onCollapseToggle={handleCollapseToggle}
            onMaximizeToggle={handleMaximizeToggle}
          />
        ))}
      </div>
    </div>
  );
}

interface ContextEntryCardProps {
  entry: ContextEntryForUI;
  isPinned: boolean;
  isCollapsed: boolean;
  isMaximized: boolean;
  showMaximize: boolean;
  onPinToggle: (key: string) => void;
  onCollapseToggle: (key: string) => void;
  onMaximizeToggle: (key: string) => void;
}

function ContextEntryCard({
  entry,
  isPinned,
  isCollapsed,
  isMaximized,
  showMaximize,
  onPinToggle,
  onCollapseToggle,
  onMaximizeToggle,
}: ContextEntryCardProps): React.ReactElement {
  const displayValue = useMemo(() => formatValueForDisplay(entry.value), [entry.value]);

  const cardClasses = [
    'context-entry-card',
    isPinned ? 'context-entry-card--pinned' : '',
    isCollapsed ? 'context-entry-card--collapsed' : '',
    isMaximized ? 'context-entry-card--maximized' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses}>
      <div className="context-entry-card__header" onClick={() => onCollapseToggle(entry.key)}>
        <div className="context-entry-card__title">
          <span className="context-entry-card__collapse-icon">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </span>
          <span className="context-entry-card__key">{entry.key}</span>
          <span className={`context-entry-card__priority context-entry-card__priority--${entry.priority}`}>
            {entry.priority}
          </span>
        </div>
        <div className="context-entry-card__actions" onClick={e => e.stopPropagation()}>
          {showMaximize && (
            <button
              className={`context-entry-card__action-btn ${isMaximized ? 'context-entry-card__action-btn--active' : ''}`}
              onClick={() => onMaximizeToggle(entry.key)}
              title={isMaximized ? 'Exit full view' : 'Full view'}
            >
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          <button
            className={`context-entry-card__pin ${isPinned ? 'context-entry-card__pin--active' : ''}`}
            onClick={() => onPinToggle(entry.key)}
            title={isPinned ? 'Unpin (stop always showing)' : 'Pin (always show this entry)'}
          >
            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <>
          {entry.description && (
            <div className="context-entry-card__description">{entry.description}</div>
          )}
          <div className="context-entry-card__value">
            <MarkdownRenderer content={displayValue} />
          </div>
        </>
      )}
    </div>
  );
}
