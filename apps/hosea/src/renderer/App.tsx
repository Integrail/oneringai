/**
 * HOSEA Main App Component
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Spinner } from 'react-bootstrap';
import { Sidebar } from './components/layout';
import {
  ChatPage,
  AgentsPage,
  AgentEditorPage,
  LLMConnectorsPage,
  APIConnectorsPage,
  UniversalConnectorsPage,
  ConnectorCatalogPage,
  ConnectorCreatePage,
  ToolConnectorsPage,
  MultimediaStudioPage,
  InternalsPage,
  SettingsPage,
} from './pages';
import { SetupModal } from './components/modals/SetupModal';
import {
  NavigationContext,
  useNavigationState,
} from './hooks/useNavigation';

// Default models for each vendor
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-pro',
  groq: 'llama-3.3-70b-versatile',
  together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  mistral: 'mistral-large-latest',
  deepseek: 'deepseek-chat',
};

function AppContent(): React.ReactElement {
  const navigation = useNavigationState();
  const [showSetup, setShowSetup] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const initStarted = React.useRef(false);

  // App initialization flow:
  // 1. Check for active agent -> activate it
  // 2. Check for any agents -> activate the most recent one
  // 3. Check for connectors -> auto-create a default agent
  // 4. No connectors -> show setup modal
  useEffect(() => {
    const initializeApp = async () => {
      // Prevent double execution (React StrictMode in dev)
      if (initStarted.current) return;
      initStarted.current = true;

      try {
        // Step 1: Check if there's already an active agent
        const activeAgent = await window.hosea.agentConfig.getActive();
        if (activeAgent) {
          // Ensure it's initialized in the runtime
          const status = await window.hosea.agent.status();
          if (!status.initialized) {
            await window.hosea.agentConfig.setActive(activeAgent.id);
          }
          setIsInitializing(false);
          return;
        }

        // Step 2: Check for any existing agents
        const agents = await window.hosea.agentConfig.list();
        if (agents.length > 0) {
          // Activate the most recently used/updated agent
          const mostRecent = agents[0]; // Already sorted by updatedAt desc
          await window.hosea.agentConfig.setActive(mostRecent.id);
          setIsInitializing(false);
          return;
        }

        // Step 3: Check for connectors to auto-create default agent
        const connectors = await window.hosea.connector.list();
        if (connectors.length > 0) {
          // Auto-create a default agent with the first connector
          const firstConnector = connectors[0];
          const defaultModel = DEFAULT_MODELS[firstConnector.vendor] || 'gpt-4.1';

          const result = await window.hosea.agentConfig.createDefault(
            firstConnector.name,
            defaultModel
          );

          if (!result.success) {
            console.error('Failed to create default agent:', result.error);
          }

          setIsInitializing(false);
          return;
        }

        // Step 4: No connectors - show setup modal
        setShowSetup(true);
        setIsInitializing(false);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, []);

  // Called when setup modal completes (creates connector + default agent)
  const handleSetupComplete = useCallback(async () => {
    setShowSetup(false);
    // The setup modal now creates the agent, so we just need to refresh
    const activeAgent = await window.hosea.agentConfig.getActive();
    if (!activeAgent) {
      // Fallback: try to activate any available agent
      const agents = await window.hosea.agentConfig.list();
      if (agents.length > 0) {
        await window.hosea.agentConfig.setActive(agents[0].id);
      }
    }
  }, []);

  const renderPage = () => {
    switch (navigation.state.currentPage) {
      case 'chat':
        return <ChatPage />;
      case 'agents':
        return <AgentsPage />;
      case 'agent-editor':
        return <AgentEditorPage />;
      case 'llm-connectors':
        return <LLMConnectorsPage />;
      case 'api-connectors':
        return <APIConnectorsPage />;
      case 'universal-connectors':
        return <UniversalConnectorsPage />;
      case 'connector-catalog':
        return <ConnectorCatalogPage />;
      case 'connector-create':
        return <ConnectorCreatePage />;
      case 'tool-connectors':
        return <ToolConnectorsPage />;
      case 'multimedia-studio':
        return <MultimediaStudioPage />;
      case 'internals':
        return <InternalsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <ChatPage />;
    }
  };

  // Show loading spinner while initializing
  if (isInitializing) {
    return (
      <div className="app-loading">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3 text-muted">Starting HOSEA...</p>
      </div>
    );
  }

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
