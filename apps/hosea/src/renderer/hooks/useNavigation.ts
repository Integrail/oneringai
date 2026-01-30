/**
 * Navigation hook for managing app routing
 */

import { useState, useCallback, createContext, useContext } from 'react';

export type PageId =
  | 'chat'
  | 'agents'
  | 'agent-editor'
  | 'llm-connectors'
  | 'api-connectors'
  | 'tool-connectors'
  | 'internals'
  | 'settings';

export interface NavigationState {
  currentPage: PageId;
  params: Record<string, string>;
  history: PageId[];
}

export interface NavigationContextValue {
  state: NavigationState;
  navigate: (page: PageId, params?: Record<string, string>) => void;
  goBack: () => void;
  canGoBack: boolean;
}

const initialState: NavigationState = {
  currentPage: 'chat',
  params: {},
  history: [],
};

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigationState(): NavigationContextValue {
  const [state, setState] = useState<NavigationState>(initialState);

  const navigate = useCallback((page: PageId, params: Record<string, string> = {}) => {
    setState((prev) => ({
      currentPage: page,
      params,
      history: [...prev.history, prev.currentPage],
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) return prev;
      const newHistory = [...prev.history];
      const previousPage = newHistory.pop()!;
      return {
        currentPage: previousPage,
        params: {},
        history: newHistory,
      };
    });
  }, []);

  const canGoBack = state.history.length > 0;

  return {
    state,
    navigate,
    goBack,
    canGoBack,
  };
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
