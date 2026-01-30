/**
 * Internals Page - "Look Inside" view for debugging and understanding agent state
 */

import React, { useState } from 'react';
import { Button, Badge } from 'react-bootstrap';
import {
  RefreshCw,
  Database,
  Layers,
  Wrench,
  Clock,
  MemoryStick,
  Activity,
} from 'lucide-react';

// Mock data types
interface MemoryEntry {
  key: string;
  value: unknown;
  scope: string;
  priority?: string;
  updatedAt: number;
}

interface ToolInfo {
  name: string;
  description: string;
  enabled: boolean;
  callCount: number;
}

interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  error?: string;
  durationMs: number;
  timestamp: number;
}

interface ContextStats {
  totalTokens: number;
  maxTokens: number;
  messagesCount: number;
  toolCallsCount: number;
}

// Mock data
const mockMemory: MemoryEntry[] = [
  { key: 'user.name', value: 'John', scope: 'session', updatedAt: Date.now() - 1000 * 60 },
  { key: 'task.current', value: 'Writing code', scope: 'session', priority: 'high', updatedAt: Date.now() - 1000 * 30 },
  { key: 'findings.api', value: { endpoints: 3, methods: ['GET', 'POST'] }, scope: 'persistent', updatedAt: Date.now() - 1000 * 120 },
];

const mockTools: ToolInfo[] = [
  { name: 'read_file', description: 'Read contents of a file', enabled: true, callCount: 15 },
  { name: 'write_file', description: 'Write contents to a file', enabled: true, callCount: 8 },
  { name: 'bash', description: 'Execute shell commands', enabled: true, callCount: 23 },
  { name: 'web_search', description: 'Search the web', enabled: false, callCount: 0 },
];

const mockToolCalls: ToolCall[] = [
  { id: '1', name: 'read_file', args: { path: '/src/index.ts' }, result: '// File contents...', durationMs: 45, timestamp: Date.now() - 1000 * 60 },
  { id: '2', name: 'bash', args: { command: 'npm test' }, result: 'All tests passed', durationMs: 2340, timestamp: Date.now() - 1000 * 30 },
];

const mockContextStats: ContextStats = {
  totalTokens: 45000,
  maxTokens: 128000,
  messagesCount: 24,
  toolCallsCount: 47,
};

export function InternalsPage(): React.ReactElement {
  const [memory, setMemory] = useState<MemoryEntry[]>(mockMemory);
  const [tools, setTools] = useState<ToolInfo[]>(mockTools);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>(mockToolCalls);
  const [contextStats, setContextStats] = useState<ContextStats>(mockContextStats);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set(['memory', 'tools', 'context']));
  const [selectedMemoryEntry, setSelectedMemoryEntry] = useState<string | null>(null);

  const togglePanel = (panel: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panel)) {
        next.delete(panel);
      } else {
        next.add(panel);
      }
      return next;
    });
  };

  const contextUsagePercent = (contextStats.totalTokens / contextStats.maxTokens) * 100;
  const contextLevel = contextUsagePercent < 50 ? 'low' : contextUsagePercent < 75 ? 'medium' : 'high';

  const handleRefresh = () => {
    // TODO: Refresh data from agent
    console.log('Refreshing internals...');
  };

  return (
    <div className="internals">
      <div className="internals__header">
        <div className="internals__header-left">
          <h1 className="internals__title">Look Inside</h1>
          <div className="internals__agent-badge">
            <span className="internals__agent-badge-dot" />
            <span className="internals__agent-badge-name">Default Assistant</span>
          </div>
        </div>
        <Button variant="outline-secondary" onClick={handleRefresh}>
          <RefreshCw size={16} className="me-2" />
          Refresh
        </Button>
      </div>

      <div className="internals__content">
        {/* Stats Overview */}
        <div className="internals__stats">
          <div className="stat-card">
            <div className="stat-card__header">
              <div className="stat-card__icon stat-card__icon--memory">
                <MemoryStick size={20} />
              </div>
            </div>
            <div className="stat-card__value">{memory.length}</div>
            <div className="stat-card__label">Memory Entries</div>
          </div>

          <div className="stat-card">
            <div className="stat-card__header">
              <div className="stat-card__icon stat-card__icon--tools">
                <Wrench size={20} />
              </div>
            </div>
            <div className="stat-card__value">{tools.filter(t => t.enabled).length}</div>
            <div className="stat-card__label">Active Tools</div>
          </div>

          <div className="stat-card">
            <div className="stat-card__header">
              <div className="stat-card__icon stat-card__icon--context">
                <Layers size={20} />
              </div>
            </div>
            <div className="stat-card__value">{Math.round(contextUsagePercent)}%</div>
            <div className="stat-card__label">Context Used</div>
          </div>

          <div className="stat-card">
            <div className="stat-card__header">
              <div className="stat-card__icon stat-card__icon--cache">
                <Activity size={20} />
              </div>
            </div>
            <div className="stat-card__value">{contextStats.toolCallsCount}</div>
            <div className="stat-card__label">Tool Calls</div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="internals__grid">
          {/* Context Panel */}
          <div className="internals__card internals__card--span-8">
            <div className="module-panel">
              <div className="module-panel__header">
                <h3 className="module-panel__title">
                  <Layers size={16} className="module-panel__title-icon" />
                  Context Window
                </h3>
              </div>
              <div className="module-panel__body">
                <div className="context-meter">
                  <div className="context-meter__header">
                    <span className="context-meter__label">Token Usage</span>
                    <span className="context-meter__value">
                      {contextStats.totalTokens.toLocaleString()} / {contextStats.maxTokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="context-meter__bar">
                    <div
                      className={`context-meter__fill context-meter__fill--${contextLevel}`}
                      style={{ width: `${contextUsagePercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid--3-cols gap-4 mt-4">
                  <div className="data-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="data-row__label">Messages</span>
                    <span className="data-row__value text-xl font-semibold">{contextStats.messagesCount}</span>
                  </div>
                  <div className="data-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="data-row__label">Tool Calls</span>
                    <span className="data-row__value text-xl font-semibold">{contextStats.toolCallsCount}</span>
                  </div>
                  <div className="data-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span className="data-row__label">Strategy</span>
                    <span className="data-row__value">
                      <Badge bg="primary">Proactive</Badge>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cache Panel */}
          <div className="internals__card internals__card--span-4">
            <div className="module-panel">
              <div className="module-panel__header">
                <h3 className="module-panel__title">
                  <Database size={16} className="module-panel__title-icon" />
                  Idempotency Cache
                </h3>
                <span className="module-panel__badge">3 entries</span>
              </div>
              <div className="module-panel__body">
                <p className="text-sm text-muted">
                  Cache stores tool call results to avoid redundant executions.
                </p>
                <div className="mt-4">
                  <div className="data-row">
                    <span className="data-row__label">Hit Rate</span>
                    <span className="data-row__value">78%</span>
                  </div>
                  <div className="data-row">
                    <span className="data-row__label">TTL</span>
                    <span className="data-row__value">5 minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Panel */}
          <div className="internals__card internals__card--span-6">
            <div className="module-panel">
              <div className="module-panel__header">
                <h3 className="module-panel__title">
                  <MemoryStick size={16} className="module-panel__title-icon" />
                  Working Memory
                </h3>
                <span className="module-panel__badge">{memory.length} entries</span>
              </div>
              <div className="module-panel__body" style={{ maxHeight: 300 }}>
                {memory.map((entry) => (
                  <div
                    key={entry.key}
                    className="memory-entry"
                    onClick={() => setSelectedMemoryEntry(
                      selectedMemoryEntry === entry.key ? null : entry.key
                    )}
                  >
                    <div className="memory-entry__header">
                      <span className="memory-entry__key">{entry.key}</span>
                      <div className="memory-entry__meta">
                        <span className="memory-entry__scope">{entry.scope}</span>
                        {entry.priority && (
                          <Badge bg={entry.priority === 'high' ? 'warning' : 'secondary'}>
                            {entry.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className={`memory-entry__value ${
                      selectedMemoryEntry !== entry.key ? 'memory-entry__value--truncated' : ''
                    }`}>
                      <pre className="font-mono text-xs">
                        {JSON.stringify(entry.value, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tools Panel */}
          <div className="internals__card internals__card--span-6">
            <div className="module-panel">
              <div className="module-panel__header">
                <h3 className="module-panel__title">
                  <Wrench size={16} className="module-panel__title-icon" />
                  Available Tools
                </h3>
                <span className="module-panel__badge">
                  {tools.filter(t => t.enabled).length} / {tools.length} enabled
                </span>
              </div>
              <div className="module-panel__body" style={{ maxHeight: 300, padding: 0 }}>
                {tools.map((tool) => (
                  <div key={tool.name} className="tool-entry">
                    <div className="tool-entry__icon" style={{
                      opacity: tool.enabled ? 1 : 0.5
                    }}>
                      <Wrench size={16} />
                    </div>
                    <div className="tool-entry__info">
                      <h4 className="tool-entry__name">{tool.name}</h4>
                      <p className="tool-entry__description">{tool.description}</p>
                    </div>
                    <div className="tool-entry__status">
                      <span className="text-xs text-muted">{tool.callCount} calls</span>
                      <Badge bg={tool.enabled ? 'success' : 'secondary'}>
                        {tool.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tool Calls Timeline */}
          <div className="internals__card internals__card--span-12">
            <div className="module-panel">
              <div className="module-panel__header">
                <h3 className="module-panel__title">
                  <Clock size={16} className="module-panel__title-icon" />
                  Recent Tool Calls
                </h3>
              </div>
              <div className="module-panel__body">
                <div className="tool-calls-timeline">
                  {toolCalls.map((call) => (
                    <div
                      key={call.id}
                      className={`tool-call-item ${call.error ? 'tool-call-item--error' : ''}`}
                    >
                      <div className="tool-call-item__header">
                        <span className="tool-call-item__name">{call.name}</span>
                        <span className="tool-call-item__duration">{call.durationMs}ms</span>
                      </div>
                      <div className="tool-call-item__args">
                        {JSON.stringify(call.args)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
