# Agents Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Agents page with the approved v2 design — featuring a stats bar, search/filter toolbar, initials avatars, description snippets from system prompt, capability chips, and redesigned card actions.

**Architecture:** All changes are self-contained to the renderer layer. Utility functions are extracted to `agentUtils.ts` so they can be unit-tested. CSS changes go into existing stylesheet files (no new files). `AgentsPage.tsx` is rewritten to use the new layout structure without changing any IPC or data contracts.

**Tech Stack:** React 18, TypeScript strict, plain CSS variables (no Tailwind/Bootstrap grid for cards), lucide-react icons, existing IPC via `window.hosea`

> **Commit rule:** All git commits MUST NOT include a `Co-authored-by` trailer. No `--no-verify`.

---

## Chunk 1: Utility functions

### Task 1: Extract and test agent display utilities

**Files:**
- Create: `apps/hosea/src/renderer/pages/agentUtils.ts`

The `AgentConfig` shape available from `window.hosea.agentConfig.list()` (see `src/preload/index.ts:586`):

```typescript
interface AgentConfig {
  id: string;
  name: string;
  model: string;
  connector: string;
  instructions: string;
  tools: string[];
  workingMemoryEnabled: boolean;
  inContextMemoryEnabled: boolean;
  persistentInstructionsEnabled: boolean;
  toolCatalogEnabled: boolean;
  pinnedCategories: string[];
  toolCategoryScope: string[];
  mcpServers?: Array<{ serverName: string; selectedTools?: string[] }>;
  lastUsedAt?: number;
  isActive: boolean;
  // ...other fields
}
```

- [ ] **Step 1: Create `agentUtils.ts` with four functions**

```typescript
// apps/hosea/src/renderer/pages/agentUtils.ts

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function getDescription(instructions: string): string {
  const firstLine = instructions.trim().split('\n')[0] ?? '';
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine;
}

export interface CapabilityChip {
  label: string;
}

export function getCapabilityChips(agent: {
  tools: string[];
  workingMemoryEnabled: boolean;
  inContextMemoryEnabled: boolean;
  persistentInstructionsEnabled: boolean;
}): CapabilityChip[] {
  const chips: CapabilityChip[] = [];
  if (agent.tools.length > 0) chips.push({ label: `${agent.tools.length} tools` });
  if (agent.tools.includes('web_search') || agent.tools.includes('web_fetch'))
    chips.push({ label: 'Web search' });
  if (agent.tools.includes('bash')) chips.push({ label: 'Bash' });
  if (agent.tools.includes('write_file') || agent.tools.includes('edit_file'))
    chips.push({ label: 'Filesystem' });
  if (agent.tools.includes('execute_javascript')) chips.push({ label: 'JS Executor' });
  if (agent.workingMemoryEnabled) chips.push({ label: 'Working memory' });
  if (agent.inContextMemoryEnabled) chips.push({ label: 'In-context memory' });
  if (agent.persistentInstructionsEnabled) chips.push({ label: 'Persistent memory' });
  return chips;
}

export function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/hosea && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd apps/hosea
git add src/renderer/pages/agentUtils.ts
git commit -m "feat(agents): add agent display utility functions"
```

---

## Chunk 2: CSS — stats bar, toolbar, card redesign

### Task 2: Add stats bar and toolbar styles to pages.css

**Files:**
- Modify: `apps/hosea/src/renderer/styles/pages.css`

- [ ] **Step 1: Add stats bar styles** — append to `pages.css`:

```css
/* ── AGENTS STATS BAR ── */
.agents-stats-bar {
  display: flex;
  border-top: 1px solid var(--color-gray-100);
  background: var(--color-gray-50);
  border-bottom: 1px solid var(--color-gray-200);
  flex-shrink: 0;
}

.agents-stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 24px;
  border-right: 1px solid var(--color-gray-100);
  flex: 1;
}

.agents-stat-item:last-child {
  border-right: none;
}

.agents-stat-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--color-gray-100);
  color: var(--color-gray-500);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agents-stat-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-gray-900);
  line-height: 1.2;
}

.agents-stat-label {
  font-size: 11px;
  color: var(--color-gray-400);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* ── AGENTS TOOLBAR ── */
.agents-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--color-white);
  border-bottom: 1px solid var(--color-gray-100);
  flex-shrink: 0;
}

.agents-search-box {
  position: relative;
  flex: 1;
  max-width: 300px;
}

.agents-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--color-gray-400);
  pointer-events: none;
}

.agents-search-input {
  width: 100%;
  padding: 6px 12px 6px 30px;
  border: 1px solid var(--color-gray-200);
  border-radius: 8px;
  font-size: 13px;
  background: var(--color-gray-50);
  color: var(--color-gray-900);
  outline: none;
  transition: all var(--transition-fast);
  font-family: var(--font-family);
}

.agents-search-input:focus {
  border-color: var(--color-gray-300);
  background: white;
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}

.agents-search-input::placeholder {
  color: var(--color-gray-400);
}

.agents-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border: 1px solid var(--color-gray-200);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-gray-600);
  background: var(--color-white);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  font-family: var(--font-family);
}

.agents-filter-btn:hover {
  border-color: var(--color-gray-300);
  background: var(--color-gray-50);
  color: var(--color-gray-800);
}

.agents-filter-btn--active {
  border-color: var(--color-gray-300);
  background: var(--color-gray-100);
  color: var(--color-gray-800);
}

.agents-filter-count {
  font-size: 11px;
  font-weight: 600;
  background: var(--color-gray-200);
  color: var(--color-gray-600);
  padding: 0 5px;
  border-radius: 99px;
  line-height: 17px;
}

.agents-toolbar-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-gray-400);
}
```

- [ ] **Step 2: Commit pages.css**

```bash
cd apps/hosea
git add src/renderer/styles/pages.css
git commit -m "feat(agents): add stats bar and toolbar styles"
```

### Task 3: Rewrite agent card styles in components.css

**Files:**
- Modify: `apps/hosea/src/renderer/styles/components.css`

Find the existing `.agent-card` block and replace it entirely with:

```css
/* ── AGENT CARD (v2) ── */
.agent-card {
  background: var(--color-white);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.agent-card:hover {
  border-color: var(--color-gray-300);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.agent-card--active {
  border-color: var(--color-gray-400);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}

.agent-card--broken {
  opacity: 0.55;
  cursor: default;
}

.agent-card__body {
  padding: 14px 14px 12px;
  flex: 1;
}

.agent-card__top {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-bottom: 10px;
}

/* Avatar — initials */
.agent-card__avatar {
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-200);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--color-gray-600);
  flex-shrink: 0;
  position: relative;
  user-select: none;
}

/* Active dot on avatar */
.agent-card--active .agent-card__avatar::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-success);
  border: 2px solid var(--color-white);
}

.agent-card__info {
  flex: 1;
  min-width: 0;
}

.agent-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-900);
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-card__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-gray-400);
}

.agent-card__meta-dot {
  color: var(--color-gray-300);
}

.agent-card__model-pill {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-gray-500);
  background: var(--color-gray-100);
  padding: 1px 6px;
  border-radius: 99px;
  border: 1px solid var(--color-gray-200);
}

/* EW badge */
.agent-card__ew-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-gray-400);
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-200);
  padding: 0 4px;
  border-radius: 4px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

/* Warning icon */
.agent-card__warn {
  color: var(--color-warning);
  display: flex;
  align-items: center;
}

/* Menu button (⋮) — shown on hover */
.agent-card__menu-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--color-gray-300);
  flex-shrink: 0;
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
  background: none;
  border: none;
  padding: 0;
}

.agent-card:hover .agent-card__menu-btn {
  opacity: 1;
}

.agent-card__menu-btn:hover {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

/* Description */
.agent-card__desc {
  font-size: 12px;
  color: var(--color-gray-500);
  line-height: 1.45;
  margin: 7px 0 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Capability chips */
.agent-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.agent-card__chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-gray-500);
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: 99px;
}

.agent-card__chip--error {
  color: var(--color-warning);
  background: #fffbeb;
  border-color: #fde68a;
}

/* Footer */
.agent-card__footer {
  padding: 9px 14px;
  border-top: 1px solid var(--color-gray-100);
  background: var(--color-gray-50);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agent-card__last-used {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-gray-400);
}

.agent-card__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-gray-300);
  flex-shrink: 0;
}

.agent-card__status-dot--online {
  background: var(--color-success);
}

.agent-card__actions {
  display: flex;
  gap: 5px;
}

/* Card action buttons */
.btn-card-edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 7px;
  border: 1px solid var(--color-gray-200);
  background: transparent;
  color: var(--color-gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-family);
}

.btn-card-edit:hover {
  background: var(--color-gray-50);
  color: var(--color-gray-700);
  border-color: var(--color-gray-300);
}

.btn-card-chat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 7px;
  border: 1px solid #f0a0b0;
  background: var(--color-primary-light);
  color: #b91030;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-family);
}

.btn-card-chat:hover {
  background: #fce8ec;
  border-color: #e88898;
}

.btn-card-chat:disabled {
  background: transparent;
  color: var(--color-gray-300);
  border-color: var(--color-gray-100);
  cursor: not-allowed;
}

.btn-card-fix {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 7px;
  border: 1px solid #fde68a;
  background: transparent;
  color: var(--color-warning);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-family);
}

.btn-card-fix:hover {
  background: #fffbeb;
}

/* New agent dashed card */
.agent-card--new {
  border: 2px dashed var(--color-gray-200);
  background: transparent;
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.agent-card--new:hover {
  border-color: #b91030;
  background: var(--color-primary-light);
}

.agent-card--new:hover .agent-card__new-icon {
  color: #b91030;
  background: rgba(185, 16, 48, 0.08);
}

.agent-card__new-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
}

.agent-card__new-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--color-gray-100);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gray-400);
  transition: all var(--transition-fast);
}

.agent-card__new-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-gray-500);
}

.agent-card__new-sub {
  font-size: 11px;
  color: var(--color-gray-400);
}
```

- [ ] **Step 2: Remove the old `.agent-card`, `.agent-card__header`, `.agent-card__avatar`, `.agent-card__info`, `.agent-card__name`, `.agent-card__model`, `.agent-card__meta`, `.agent-card__meta-item` rules** that are being replaced. They are in `components.css` in the `.agent-card` section (approximately lines 1–70 of that block).

- [ ] **Step 3: Verify typecheck**

```bash
cd apps/hosea && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
cd apps/hosea
git add src/renderer/styles/components.css
git commit -m "feat(agents): redesign agent card and new-card styles"
```

---

## Chunk 3: AgentsPage component rewrite

### Task 4: Rewrite AgentsPage.tsx

**Files:**
- Modify: `apps/hosea/src/renderer/pages/AgentsPage.tsx`

The new component uses `agentUtils.ts` for display helpers. The data contract with the backend stays identical (same IPC calls, same `AgentConfig` shape).

**Key computed values:**
- `activeToday`: agents with `lastUsedAt` in last 24 hours
- `totalTools`: sum of `agent.tools.length` across all agents
- `searchQuery` + `activeFilter`: local filter state
- `filteredAgents`: agents filtered by search query and active filter

Replace the full file with:

```typescript
/**
 * Agents Page v2 — redesigned card-based layout
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Bot, AlertTriangle, Search, Filter, CheckCircle } from 'lucide-react';
import { useNavigation } from '../hooks/useNavigation';
import { useTabContext } from '../hooks/useTabContext';
import { useConnectorVersion } from '../App';
import { getInitials, getDescription, getCapabilityChips, formatTimeAgo } from './agentUtils.js';

interface AgentConfig {
  id: string;
  name: string;
  model: string;
  connector: string;
  instructions: string;
  tools: string[];
  workingMemoryEnabled: boolean;
  inContextMemoryEnabled: boolean;
  persistentInstructionsEnabled: boolean;
  lastUsedAt?: number;
  isActive: boolean;
}

export function AgentsPage(): React.ReactElement {
  const { navigate } = useNavigation();
  const { createTab } = useTabContext();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<Set<string>>(new Set());
  const [ewConnectors, setEwConnectors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const connectorVersion = useConnectorVersion();

  const loadAgents = useCallback(async () => {
    try {
      const [agentsList, connectorsList] = await Promise.all([
        window.hosea.agentConfig.list(),
        window.hosea.connector.list(),
      ]);
      setAgents(agentsList as AgentConfig[]);
      setAvailableConnectors(new Set(connectorsList.map((c) => c.name)));
      setEwConnectors(new Set(connectorsList.filter((c) => c.source === 'everworker').map((c) => c.name)));
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents, connectorVersion]);

  const handleCreateAgent = () => navigate('agent-editor', { mode: 'create' });
  const handleEditAgent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('agent-editor', { mode: 'edit', id });
  };
  const handleFixConnector = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('llm-connectors');
  };

  const handleChatWithAgent = async (agentId: string) => {
    try {
      const agent = agents.find((a) => a.id === agentId);
      if (agent && !availableConnectors.has(agent.connector)) return;
      const agentName = agent?.name ?? 'Assistant';
      const tabId = await createTab(agentId, agentName);
      if (tabId) navigate('chat');
      else alert('Failed to create chat tab');
    } catch (error) {
      console.error('Failed to create chat tab:', error);
    }
  };

  // Stats
  const DAY_MS = 24 * 60 * 60 * 1000;
  const activeToday = agents.filter((a) => a.lastUsedAt && Date.now() - a.lastUsedAt < DAY_MS).length;
  const totalTools = agents.reduce((sum, a) => sum + a.tools.length, 0);

  // Filtering
  const activeCount = agents.filter((a) => a.isActive).length;
  const filteredAgents = agents.filter((a) => {
    if (activeOnly && !a.isActive) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.model.toLowerCase().includes(q) || a.connector.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="page">
        <div className="page__header">
          <div className="page__header-left">
            <div>
              <h1 className="page__title">Agents</h1>
              <p className="page__subtitle">Create and manage your AI agents</p>
            </div>
          </div>
        </div>
        <div className="page__content page__content--centered">
          <div className="spinner-border text-primary" role="status" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page__header">
        <div className="page__header-left">
          <div>
            <h1 className="page__title">Agents</h1>
            <p className="page__subtitle">Create and manage your AI agents</p>
          </div>
        </div>
        <div className="page__header-right">
          <button className="btn btn-primary" onClick={handleCreateAgent}>
            <Plus size={14} />
            New Agent
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="agents-stats-bar">
        <div className="agents-stat-item">
          <div className="agents-stat-icon"><Bot size={15} /></div>
          <div>
            <div className="agents-stat-value">{agents.length}</div>
            <div className="agents-stat-label">Total</div>
          </div>
        </div>
        <div className="agents-stat-item">
          <div className="agents-stat-icon"><CheckCircle size={15} /></div>
          <div>
            <div className="agents-stat-value">{activeToday}</div>
            <div className="agents-stat-label">Active today</div>
          </div>
        </div>
        <div className="agents-stat-item">
          <div className="agents-stat-icon"><Filter size={15} /></div>
          <div>
            <div className="agents-stat-value">{totalTools}</div>
            <div className="agents-stat-label">Tools available</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="agents-toolbar">
        <div className="agents-search-box">
          <Search size={14} className="agents-search-icon" />
          <input
            className="agents-search-input"
            type="text"
            placeholder="Search agents…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button
          className={`agents-filter-btn ${activeOnly ? 'agents-filter-btn--active' : ''}`}
          onClick={() => setActiveOnly((v) => !v)}
        >
          <CheckCircle size={13} />
          Active
          {activeCount > 0 && <span className="agents-filter-count">{activeCount}</span>}
        </button>

        <span className="agents-toolbar-count">{filteredAgents.length} agents</span>
      </div>

      {/* Content */}
      <div className="page__content">
        {agents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Bot size={32} /></div>
            <h3 className="empty-state__title">No agents yet</h3>
            <p className="empty-state__description">
              Create your first AI agent. Agents can be customized with specific models, tools, and instructions.
            </p>
            <button className="btn btn-primary" onClick={handleCreateAgent}>
              <Plus size={14} /> Create Agent
            </button>
          </div>
        ) : (
          <div className="grid grid--auto">
            {filteredAgents.map((agent) => {
              const connectorOk = availableConnectors.has(agent.connector);
              const isEw = ewConnectors.has(agent.connector);
              const initials = getInitials(agent.name);
              const description = getDescription(agent.instructions);
              const chips = getCapabilityChips(agent);
              const recentlyActive = !!(agent.lastUsedAt && Date.now() - agent.lastUsedAt < DAY_MS);

              return (
                <div
                  key={agent.id}
                  className={`agent-card ${agent.isActive ? 'agent-card--active' : ''} ${!connectorOk ? 'agent-card--broken' : ''}`}
                  onClick={() => connectorOk && handleChatWithAgent(agent.id)}
                >
                  <div className="agent-card__body">
                    <div className="agent-card__top">
                      <div className="agent-card__avatar">{initials}</div>
                      <div className="agent-card__info">
                        <div className="agent-card__name">
                          {agent.name}
                          {isEw && <span className="agent-card__ew-badge">EW</span>}
                          {!connectorOk && (
                            <span className="agent-card__warn" title={`Connector "${agent.connector}" unavailable`}>
                              <AlertTriangle size={13} />
                            </span>
                          )}
                        </div>
                        <div className="agent-card__meta">
                          <span className="agent-card__model-pill">{agent.model}</span>
                          <span className="agent-card__meta-dot">·</span>
                          <span>via {agent.connector}</span>
                        </div>
                      </div>
                    </div>

                    {description && <div className="agent-card__desc">{description}</div>}

                    <div className="agent-card__chips">
                      {connectorOk ? (
                        chips.map((chip) => (
                          <span key={chip.label} className="agent-card__chip">{chip.label}</span>
                        ))
                      ) : (
                        <span className="agent-card__chip agent-card__chip--error">
                          <AlertTriangle size={10} />
                          Connector unavailable
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="agent-card__footer">
                    <div className="agent-card__last-used">
                      {connectorOk ? (
                        <>
                          <span className={`agent-card__status-dot ${recentlyActive ? 'agent-card__status-dot--online' : ''}`} />
                          {formatTimeAgo(agent.lastUsedAt)}
                        </>
                      ) : (
                        <span style={{ color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} />
                          No connector
                        </span>
                      )}
                    </div>
                    <div className="agent-card__actions">
                      {connectorOk ? (
                        <>
                          <button className="btn-card-edit" onClick={(e) => handleEditAgent(agent.id, e)}>Edit</button>
                          <button className="btn-card-chat" onClick={(e) => { e.stopPropagation(); handleChatWithAgent(agent.id); }}>Chat</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-card-fix" onClick={handleFixConnector}>Fix connector</button>
                          <button className="btn-card-chat" disabled>Chat</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New agent card */}
            <div className="agent-card agent-card--new" onClick={handleCreateAgent}>
              <div className="agent-card__new-inner">
                <div className="agent-card__new-icon"><Plus size={18} /></div>
                <div className="agent-card__new-label">Create new agent</div>
                <div className="agent-card__new-sub">Configure model, tools & memory</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/hosea && npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd apps/hosea
git add src/renderer/pages/AgentsPage.tsx
git commit -m "feat(agents): rewrite agents page with v2 design"
```

---

## Chunk 4: Manual verification

### Task 5: Smoke test in dev mode

- [ ] **Step 1: Start the app**

```bash
cd apps/hosea && npm run dev
```

- [ ] **Step 2: Verify visually**

Check the following:
- [ ] Header: "Agents" title, "New Agent" red button top-right
- [ ] Stats bar: Total / Active today / Tools available counts are correct
- [ ] Toolbar: search box filters agents in real time; "Active" toggle works
- [ ] Cards: initials avatar, name, model pill, connector, description (2 lines max), capability chips, last-used time
- [ ] Chat button: light-pink style; clicking opens chat
- [ ] Edit button: navigates to agent editor
- [ ] Broken connector card: warning icon, "Fix connector" button, Chat disabled
- [ ] New agent dashed card: hover turns red-tinted, clicking opens agent editor
- [ ] Empty state shows when no agents exist

- [ ] **Step 3: Commit design doc**

```bash
cd /Users/laboratory/projects/github/oneringai
git add docs/superpowers/
git commit -m "docs: agents page redesign spec and plan"
```
