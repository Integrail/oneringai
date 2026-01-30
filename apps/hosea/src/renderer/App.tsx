/**
 * HOSEA Main App Component
 */

import React, { useState, useCallback } from 'react';
import { Sidebar } from './components/layout';
import {
  ChatPage,
  AgentsPage,
  AgentEditorPage,
  LLMConnectorsPage,
  ToolConnectorsPage,
  InternalsPage,
  SettingsPage,
} from './pages';
import { SetupModal } from './components/modals/SetupModal';
import {
  NavigationContext,
  useNavigationState,
  type PageId,
} from './hooks/useNavigation';

function AppContent(): React.ReactElement {
  const navigation = useNavigationState();
  const [showSetup, setShowSetup] = useState(false);

  const handleSetupComplete = useCallback(
    async (connector: string, model: string) => {
      const result = await window.hosea.agent.initialize(connector, model);
      if (result.success) {
        setShowSetup(false);
      } else {
        alert(`Failed to initialize: ${result.error}`);
      }
    },
    []
  );

  const renderPage = () => {
    switch (navigation.state.currentPage) {
      case 'chat':
        return <ChatPage onOpenSetup={() => setShowSetup(true)} />;
      case 'agents':
        return <AgentsPage />;
      case 'agent-editor':
        return <AgentEditorPage />;
      case 'llm-connectors':
        return <LLMConnectorsPage />;
      case 'tool-connectors':
        return <ToolConnectorsPage />;
      case 'internals':
        return <InternalsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <ChatPage onOpenSetup={() => setShowSetup(true)} />;
    }
  };

  return (
    <NavigationContext.Provider value={navigation}>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          {/* macOS drag region for window dragging */}
          <div className="app-main__drag-region" />
          {renderPage()}
        </main>
      </div>

      <SetupModal
        show={showSetup}
        onHide={() => setShowSetup(false)}
        onComplete={handleSetupComplete}
      />
    </NavigationContext.Provider>
  );
}

export function App(): React.ReactElement {
  return <AppContent />;
}
