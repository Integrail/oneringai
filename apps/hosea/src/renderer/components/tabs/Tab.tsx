/**
 * Tab - Individual tab button component
 */

import React from 'react';
import { X, Loader2 } from 'lucide-react';

interface TabProps {
  id: string;
  title: string;
  agentName: string;
  isActive: boolean;
  isLoading?: boolean;
  onClick: () => void;
  onClose: () => void;
}

export function Tab({ id, title, agentName, isActive, isLoading, onClick, onClose }: TabProps): React.ReactElement {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className={`chat-tab ${isActive ? 'chat-tab--active' : ''} ${isLoading ? 'chat-tab--loading' : ''}`}
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
    >
      {isLoading && (
        <span className="chat-tab__spinner">
          <Loader2 size={12} className="spin" />
        </span>
      )}

      <span className="chat-tab__title" title={`${title} (${agentName})`}>
        {title}
      </span>

      <button
        className="chat-tab__close"
        onClick={handleClose}
        title="Close tab"
        aria-label={`Close ${title}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}
