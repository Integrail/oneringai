/**
 * TabContext - Multi-tab chat session management
 *
 * Manages multiple independent chat sessions (tabs), each with its own
 * agent instance, messages, and streaming state.
 */

import React, { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import type { ToolCallInfo } from '../components/ToolCallDisplay';
import type { Plan, StreamChunk } from '../../preload/index';

// ============ Types ============

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCallInfo[];
}

export interface TabState {
  instanceId: string;
  agentConfigId: string;
  agentName: string;
  title: string;
  messages: Message[];
  streamingContent: string;
  activeToolCalls: Map<string, ToolCallInfo>;
  activePlan: Plan | null;
  isLoading: boolean;
  status: {
    initialized: boolean;
    connector: string | null;
    model: string | null;
    mode: string | null;
  };
  createdAt: number;
}

export interface TabContextValue {
  tabs: Map<string, TabState>;
  activeTabId: string | null;
  tabOrder: string[];

  // Tab management
  createTab: (agentConfigId: string, agentName?: string, title?: string) => Promise<string | null>;
  closeTab: (tabId: string) => Promise<void>;
  switchTab: (tabId: string) => void;
  getActiveTab: () => TabState | null;
  updateTabTitle: (tabId: string, title: string) => void;

  // Messaging (operates on active tab)
  sendMessage: (content: string) => Promise<void>;
  cancelStream: () => Promise<void>;

  // State helpers
  isMaxTabsReached: boolean;
  tabCount: number;
}

// ============ Context ============

const TabContext = createContext<TabContextValue | null>(null);

const MAX_TABS = 10;
const MAX_TITLE_LENGTH = 30;

// ============ Provider ============

interface TabProviderProps {
  children: React.ReactNode;
  defaultAgentConfigId?: string;
  defaultAgentName?: string;
}

export function TabProvider({ children, defaultAgentConfigId, defaultAgentName }: TabProviderProps): React.ReactElement {
  const [tabs, setTabs] = useState<Map<string, TabState>>(new Map());
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [tabOrder, setTabOrder] = useState<string[]>([]);

  // Track whether we've set up listeners
  const listenersSetup = useRef(false);

  // Set up instance-aware streaming listeners
  useEffect(() => {
    if (listenersSetup.current) return;
    listenersSetup.current = true;

    // Set up stream chunk handler
    window.hosea.agent.onStreamChunkInstance((instanceId: string, chunk: StreamChunk) => {
      setTabs(prevTabs => {
        // Find the tab with this instanceId
        const tab = Array.from(prevTabs.values()).find(t => t.instanceId === instanceId);
        if (!tab) return prevTabs;

        const newTabs = new Map(prevTabs);
        const updatedTab = { ...tab };

        if (chunk.type === 'text' && chunk.content) {
          updatedTab.streamingContent = tab.streamingContent + chunk.content;

          // Update the streaming message content
          const lastMsg = updatedTab.messages[updatedTab.messages.length - 1];
          if (lastMsg?.isStreaming) {
            updatedTab.messages = [
              ...updatedTab.messages.slice(0, -1),
              { ...lastMsg, content: updatedTab.streamingContent },
            ];
          }
        } else if (chunk.type === 'tool_start') {
          const toolCall: ToolCallInfo = {
            id: `${chunk.tool}-${Date.now()}`,
            name: chunk.tool,
            args: chunk.args,
            description: chunk.description,
            status: 'running',
          };

          updatedTab.activeToolCalls = new Map(tab.activeToolCalls);
          updatedTab.activeToolCalls.set(toolCall.id, toolCall);

          // Add tool call to the streaming message
          const lastMsg = updatedTab.messages[updatedTab.messages.length - 1];
          if (lastMsg?.isStreaming) {
            const existingToolCalls = lastMsg.toolCalls || [];
            updatedTab.messages = [
              ...updatedTab.messages.slice(0, -1),
              { ...lastMsg, toolCalls: [...existingToolCalls, toolCall] },
            ];
          }
        } else if (chunk.type === 'tool_end') {
          // Update tool call status to complete
          const lastMsg = updatedTab.messages[updatedTab.messages.length - 1];
          if (lastMsg?.isStreaming && lastMsg.toolCalls) {
            const updatedToolCalls = lastMsg.toolCalls.map(tc =>
              tc.name === chunk.tool && tc.status === 'running'
                ? { ...tc, status: 'complete' as const, durationMs: chunk.durationMs }
                : tc
            );
            updatedTab.messages = [
              ...updatedTab.messages.slice(0, -1),
              { ...lastMsg, toolCalls: updatedToolCalls },
            ];
          }
        } else if (chunk.type === 'tool_error') {
          const lastMsg = updatedTab.messages[updatedTab.messages.length - 1];
          if (lastMsg?.isStreaming && lastMsg.toolCalls) {
            const updatedToolCalls = lastMsg.toolCalls.map(tc =>
              tc.name === chunk.tool && tc.status === 'running'
                ? { ...tc, status: 'error' as const, error: chunk.error }
                : tc
            );
            updatedTab.messages = [
              ...updatedTab.messages.slice(0, -1),
              { ...lastMsg, toolCalls: updatedToolCalls },
            ];
          }
        }
        // Plan events
        else if (chunk.type === 'plan:created' || chunk.type === 'plan:awaiting_approval' || chunk.type === 'needs:approval') {
          const plan = (chunk as { plan: Plan }).plan;
          if (plan) {
            updatedTab.activePlan = plan;
          }
        } else if (chunk.type === 'plan:approved') {
          if (updatedTab.activePlan) {
            updatedTab.activePlan = { ...updatedTab.activePlan, status: 'running' };
          }
        }
        // Task events
        else if (chunk.type === 'task:started') {
          if (updatedTab.activePlan) {
            updatedTab.activePlan = {
              ...updatedTab.activePlan,
              tasks: updatedTab.activePlan.tasks.map(t =>
                t.id === chunk.task.id ? { ...t, status: 'in_progress', startedAt: chunk.task.startedAt } : t
              ),
            };
          }
        } else if (chunk.type === 'task:completed') {
          if (updatedTab.activePlan) {
            updatedTab.activePlan = {
              ...updatedTab.activePlan,
              tasks: updatedTab.activePlan.tasks.map(t =>
                t.id === chunk.task.id
                  ? { ...t, status: 'completed', completedAt: chunk.task.completedAt, result: chunk.task.result }
                  : t
              ),
            };
          }
        } else if (chunk.type === 'task:failed') {
          if (updatedTab.activePlan) {
            updatedTab.activePlan = {
              ...updatedTab.activePlan,
              tasks: updatedTab.activePlan.tasks.map(t =>
                t.id === chunk.task.id
                  ? { ...t, status: 'failed', result: { success: false, error: chunk.error } }
                  : t
              ),
            };
          }
        }
        // Execution events
        else if (chunk.type === 'execution:done') {
          if (updatedTab.activePlan) {
            const result = chunk.result as { status: string };
            updatedTab.activePlan = {
              ...updatedTab.activePlan,
              status: result.status === 'completed' ? 'completed' : 'failed',
              completedAt: Date.now(),
            };
          }
        }

        newTabs.set(tab.instanceId, updatedTab);
        return newTabs;
      });
    });

    // Set up stream end handler
    window.hosea.agent.onStreamEndInstance((instanceId: string) => {
      setTabs(prevTabs => {
        const tab = Array.from(prevTabs.values()).find(t => t.instanceId === instanceId);
        if (!tab) return prevTabs;

        const newTabs = new Map(prevTabs);
        const updatedTab = { ...tab };

        // Finalize the streaming message
        if (updatedTab.streamingContent) {
          const lastMsg = updatedTab.messages[updatedTab.messages.length - 1];
          if (lastMsg?.isStreaming) {
            updatedTab.messages = [
              ...updatedTab.messages.slice(0, -1),
              { ...lastMsg, content: updatedTab.streamingContent, isStreaming: false },
            ];
          }
        }

        updatedTab.streamingContent = '';
        updatedTab.activeToolCalls = new Map();
        updatedTab.isLoading = false;

        newTabs.set(tab.instanceId, updatedTab);
        return newTabs;
      });
    });

    return () => {
      window.hosea.agent.removeStreamInstanceListeners();
      listenersSetup.current = false;
    };
  }, []);

  // Create a new tab
  const createTab = useCallback(async (agentConfigId: string, agentName?: string, title?: string): Promise<string | null> => {
    if (tabs.size >= MAX_TABS) {
      console.warn(`Maximum number of tabs (${MAX_TABS}) reached`);
      return null;
    }

    try {
      // Create the agent instance
      const result = await window.hosea.agent.createInstance(agentConfigId);
      if (!result.success || !result.instanceId) {
        console.error('Failed to create instance:', result.error);
        return null;
      }

      const instanceId = result.instanceId;
      const tabTitle = title
        ? title.slice(0, MAX_TITLE_LENGTH)
        : (agentName || 'New Chat').slice(0, MAX_TITLE_LENGTH);

      // Create tab state
      const newTab: TabState = {
        instanceId,
        agentConfigId,
        agentName: agentName || 'Assistant',
        title: tabTitle,
        messages: [],
        streamingContent: '',
        activeToolCalls: new Map(),
        activePlan: null,
        isLoading: false,
        status: {
          initialized: true,
          connector: null,
          model: null,
          mode: null,
        },
        createdAt: Date.now(),
      };

      // Update status from instance
      const statusResult = await window.hosea.agent.statusInstance(instanceId);
      if (statusResult.found) {
        newTab.status = {
          initialized: statusResult.initialized,
          connector: statusResult.connector,
          model: statusResult.model,
          mode: statusResult.mode,
        };
      }

      setTabs(prev => {
        const newTabs = new Map(prev);
        newTabs.set(instanceId, newTab);
        return newTabs;
      });

      setTabOrder(prev => [...prev, instanceId]);
      setActiveTabId(instanceId);

      return instanceId;
    } catch (error) {
      console.error('Error creating tab:', error);
      return null;
    }
  }, [tabs.size]);

  // Close a tab
  const closeTab = useCallback(async (tabId: string): Promise<void> => {
    const tab = tabs.get(tabId);
    if (!tab) return;

    try {
      // Cancel any ongoing stream
      if (tab.isLoading) {
        await window.hosea.agent.cancelInstance(tab.instanceId);
      }

      // Destroy the instance
      await window.hosea.agent.destroyInstance(tab.instanceId);
    } catch (error) {
      console.error('Error destroying instance:', error);
    }

    // Remove from state
    setTabs(prev => {
      const newTabs = new Map(prev);
      newTabs.delete(tabId);
      return newTabs;
    });

    setTabOrder(prev => prev.filter(id => id !== tabId));

    // If closing active tab, switch to another
    if (activeTabId === tabId) {
      const remainingTabs = tabOrder.filter(id => id !== tabId);
      const newActiveId = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : null;
      setActiveTabId(newActiveId);
    }
  }, [tabs, tabOrder, activeTabId]);

  // Switch to a tab
  const switchTab = useCallback((tabId: string): void => {
    if (tabs.has(tabId)) {
      setActiveTabId(tabId);
    }
  }, [tabs]);

  // Get active tab
  const getActiveTab = useCallback((): TabState | null => {
    if (!activeTabId) return null;
    return tabs.get(activeTabId) || null;
  }, [activeTabId, tabs]);

  // Update tab title
  const updateTabTitle = useCallback((tabId: string, title: string): void => {
    setTabs(prev => {
      const tab = prev.get(tabId);
      if (!tab) return prev;

      const newTabs = new Map(prev);
      newTabs.set(tabId, {
        ...tab,
        title: title.slice(0, MAX_TITLE_LENGTH),
      });
      return newTabs;
    });
  }, []);

  // Send a message to the active tab
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    const tab = activeTabId ? tabs.get(activeTabId) : null;
    if (!tab || tab.isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Add placeholder for assistant response
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setTabs(prev => {
      const newTabs = new Map(prev);
      const updatedTab = {
        ...tab,
        messages: [...tab.messages, userMessage, assistantMessage],
        isLoading: true,
        streamingContent: '',
      };
      newTabs.set(tab.instanceId, updatedTab);
      return newTabs;
    });

    // Start streaming
    await window.hosea.agent.streamInstance(tab.instanceId, content);
  }, [activeTabId, tabs]);

  // Cancel the stream for active tab
  const cancelStream = useCallback(async (): Promise<void> => {
    const tab = activeTabId ? tabs.get(activeTabId) : null;
    if (!tab) return;

    await window.hosea.agent.cancelInstance(tab.instanceId);

    setTabs(prev => {
      const newTabs = new Map(prev);
      const updatedTab = {
        ...tab,
        isLoading: false,
      };
      newTabs.set(tab.instanceId, updatedTab);
      return newTabs;
    });
  }, [activeTabId, tabs]);

  // Create default tab on mount if no tabs exist
  useEffect(() => {
    if (tabs.size === 0 && defaultAgentConfigId) {
      createTab(defaultAgentConfigId, defaultAgentName, 'Chat');
    }
  }, [defaultAgentConfigId, defaultAgentName, createTab, tabs.size]);

  const value: TabContextValue = {
    tabs,
    activeTabId,
    tabOrder,
    createTab,
    closeTab,
    switchTab,
    getActiveTab,
    updateTabTitle,
    sendMessage,
    cancelStream,
    isMaxTabsReached: tabs.size >= MAX_TABS,
    tabCount: tabs.size,
  };

  return (
    <TabContext.Provider value={value}>
      {children}
    </TabContext.Provider>
  );
}

// ============ Hook ============

export function useTabContext(): TabContextValue {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within TabProvider');
  }
  return context;
}

export { TabContext };
