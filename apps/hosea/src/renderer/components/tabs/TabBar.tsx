/**
 * TabBar - Horizontal tab bar for managing multiple chat sessions
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { Tab } from './Tab';
import { useTabContext } from '../../hooks/useTabContext';

interface TabBarProps {
  onNewTabClick: () => void;
}

export function TabBar({ onNewTabClick }: TabBarProps): React.ReactElement {
  const { tabs, activeTabId, tabOrder, switchTab, closeTab, isMaxTabsReached } = useTabContext();

  return (
    <div className="chat-tabs">
      <div className="chat-tabs__list">
        {tabOrder.map(tabId => {
          const tab = tabs.get(tabId);
          if (!tab) return null;

          return (
            <Tab
              key={tabId}
              id={tabId}
              title={tab.title}
              agentName={tab.agentName}
              isActive={tabId === activeTabId}
              isLoading={tab.isLoading}
              onClick={() => switchTab(tabId)}
              onClose={() => closeTab(tabId)}
            />
          );
        })}
      </div>

      <button
        className="chat-tabs__add"
        onClick={onNewTabClick}
        disabled={isMaxTabsReached}
        title={isMaxTabsReached ? 'Maximum tabs reached' : 'New tab'}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
