/**
 * InternalsPanel - Resizable side panel for monitoring agent internals ("Look Inside")
 * Slides in from the right side of the chat page
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Spinner, Modal, Button } from 'react-bootstrap';
import {
  X,
  RefreshCw,
  Database,
  Layers,
  Wrench,
  MemoryStick,
  ChevronDown,
  ChevronRight,
  Zap,
  FileText,
  BookOpen,
  Eye,
} from 'lucide-react';

// Types for internals data
interface ContextStats {
  totalTokens: number;
  maxTokens: number;
  utilizationPercent: number;
  messagesCount: number;
  toolCallsCount: number;
  strategy: string;
}

interface CacheStats {
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
  ttlMs: number;
}

interface MemoryEntry {
  key: string;
  description: string;
  scope: string;
  priority: string;
  sizeBytes: number;
  updatedAt: number;
}

interface MemoryStats {
  totalEntries: number;
  totalSizeBytes: number;
  utilizationPercent: number;
  entries: MemoryEntry[];
}

interface InContextEntry {
  key: string;
  description: string;
  priority: string;
  updatedAt: number;
  value: unknown;
}

interface InContextMemory {
  enabled: boolean;
  entries: InContextEntry[];
  maxEntries: number;
  maxTokens: number;
}

interface ToolInfo {
  name: string;
  description: string;
  enabled: boolean;
  callCount: number;
  namespace?: string;
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

interface PersistentInstructions {
  content: string;
  path: string;
  length: number;
  enabled: boolean;
}

interface PreparedContext {
  available: boolean;
  components: Array<{
    name: string;
    content: string;
    tokenEstimate: number;
  }>;
  totalTokens: number;
  rawContext: string;
}

interface InternalsData {
  available: boolean;
  agentName: string | null;
  context: ContextStats | null;
  cache: CacheStats | null;
  memory: MemoryStats | null;
  inContextMemory: InContextMemory | null;
  tools: ToolInfo[];
  toolCalls: ToolCall[];
  // New fields
  systemPrompt: string | null;
  persistentInstructions: PersistentInstructions | null;
}

interface InternalsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;

export function InternalsPanel({ isOpen, onClose, width, onWidthChange }: InternalsPanelProps): React.ReactElement | null {
  const [data, setData] = useState<InternalsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['context', 'tools'])
  );
  const [selectedMemoryKey, setSelectedMemoryKey] = useState<string | null>(null);
  const [memoryValues, setMemoryValues] = useState<Map<string, unknown>>(new Map());
  const [loadingMemoryKey, setLoadingMemoryKey] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showContextModal, setShowContextModal] = useState(false);
  const [preparedContext, setPreparedContext] = useState<PreparedContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Fetch internals data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const internals = await window.hosea.internals.getAll();
      setData(internals);
    } catch (error) {
      console.error('Failed to fetch internals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch prepared context for modal
  const fetchPreparedContext = useCallback(async () => {
    try {
      setIsLoadingContext(true);
      const context = await window.hosea.internals.getPreparedContext();
      setPreparedContext(context);
    } catch (error) {
      console.error('Failed to fetch prepared context:', error);
    } finally {
      setIsLoadingContext(false);
    }
  }, []);

  // Fetch memory value for a specific key
  const fetchMemoryValue = useCallback(async (key: string) => {
    // Don't fetch if already have it
    if (memoryValues.has(key)) return;

    try {
      setLoadingMemoryKey(key);
      const value = await window.hosea.internals.getMemoryValue(key);
      setMemoryValues((prev) => {
        const next = new Map(prev);
        next.set(key, value);
        return next;
      });
    } catch (error) {
      console.error('Failed to fetch memory value:', error);
    } finally {
      setLoadingMemoryKey(null);
    }
  }, [memoryValues]);

  // Handle memory entry click - toggle expansion and fetch value
  const handleMemoryEntryClick = useCallback((key: string) => {
    if (selectedMemoryKey === key) {
      setSelectedMemoryKey(null);
    } else {
      setSelectedMemoryKey(key);
      fetchMemoryValue(key);
    }
  }, [selectedMemoryKey, fetchMemoryValue]);

  // Open context modal
  const handleViewFullContext = useCallback(() => {
    setShowContextModal(true);
    fetchPreparedContext();
  }, [fetchPreparedContext]);

  // Fetch on mount and set up auto-refresh
  useEffect(() => {
    if (isOpen) {
      fetchData();

      if (autoRefresh) {
        const interval = setInterval(fetchData, 2000); // Refresh every 2 seconds
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, autoRefresh, fetchData]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onWidthChange]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getContextLevel = (percent: number): 'low' | 'medium' | 'high' => {
    if (percent < 50) return 'low';
    if (percent < 75) return 'medium';
    return 'high';
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="internals-panel"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="internals-panel__resize-handle"
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="internals-panel__header">
        <div className="internals-panel__title">
          <Zap size={16} />
          <span>Look Inside</span>
          {data?.agentName && (
            <Badge bg="secondary" className="ms-2">{data.agentName}</Badge>
          )}
        </div>
        <div className="internals-panel__actions">
          <button
            className={`internals-panel__action-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw size={14} className={autoRefresh ? 'spinning' : ''} />
          </button>
          <button
            className="internals-panel__action-btn"
            onClick={fetchData}
            disabled={isLoading}
            title="Refresh now"
          >
            {isLoading ? <Spinner animation="border" size="sm" /> : <RefreshCw size={14} />}
          </button>
          <button
            className="internals-panel__action-btn"
            onClick={onClose}
            title="Close panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="internals-panel__content">
        {!data?.available ? (
          <div className="internals-panel__empty">
            <p>No agent initialized</p>
            <p className="text-muted small">Start a chat to see agent internals</p>
          </div>
        ) : (
          <>
            {/* Context Section */}
            <div className="internals-section">
              <div
                className="internals-section__header"
                onClick={() => toggleSection('context')}
              >
                {expandedSections.has('context') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Layers size={14} />
                <span>Context Window</span>
                {data.context && (
                  <span className="internals-section__badge">
                    {Math.round(data.context.utilizationPercent)}%
                  </span>
                )}
              </div>
              {expandedSections.has('context') && data.context && (
                <div className="internals-section__body">
                  <div className="context-meter">
                    <div className="context-meter__bar">
                      <div
                        className={`context-meter__fill context-meter__fill--${getContextLevel(data.context.utilizationPercent)}`}
                        style={{ width: `${data.context.utilizationPercent}%` }}
                      />
                    </div>
                    <div className="context-meter__label">
                      {data.context.totalTokens.toLocaleString()} / {data.context.maxTokens.toLocaleString()} tokens
                    </div>
                  </div>
                  <div className="internals-stats">
                    <div className="internals-stat">
                      <span className="internals-stat__label">Messages</span>
                      <span className="internals-stat__value">{data.context.messagesCount}</span>
                    </div>
                    <div className="internals-stat">
                      <span className="internals-stat__label">Tool Calls</span>
                      <span className="internals-stat__value">{data.context.toolCallsCount}</span>
                    </div>
                    <div className="internals-stat">
                      <span className="internals-stat__label">Strategy</span>
                      <Badge bg="primary" className="internals-stat__value">{data.context.strategy}</Badge>
                    </div>
                  </div>
                  {/* View Full Context Button */}
                  <button
                    className="btn btn-sm btn-outline-primary w-100 mt-3"
                    onClick={handleViewFullContext}
                  >
                    <Eye size={14} className="me-1" />
                    View Full Context
                  </button>
                </div>
              )}
            </div>

            {/* System Prompt Section */}
            {data.systemPrompt && (
              <div className="internals-section">
                <div
                  className="internals-section__header"
                  onClick={() => toggleSection('systemPrompt')}
                >
                  {expandedSections.has('systemPrompt') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <FileText size={14} />
                  <span>System Prompt</span>
                  <span className="internals-section__badge">
                    {Math.ceil(data.systemPrompt.length / 4)} tok
                  </span>
                </div>
                {expandedSections.has('systemPrompt') && (
                  <div className="internals-section__body">
                    <pre className="internals-code-block">
                      {data.systemPrompt}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Persistent Instructions Section */}
            {data.persistentInstructions && (
              <div className="internals-section">
                <div
                  className="internals-section__header"
                  onClick={() => toggleSection('persistentInstructions')}
                >
                  {expandedSections.has('persistentInstructions') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <BookOpen size={14} />
                  <span>Persistent Instructions</span>
                  <span className="internals-section__badge">
                    {data.persistentInstructions.enabled
                      ? (data.persistentInstructions.length > 0 ? `${data.persistentInstructions.length} chars` : 'empty')
                      : 'off'}
                  </span>
                </div>
                {expandedSections.has('persistentInstructions') && (
                  <div className="internals-section__body">
                    {!data.persistentInstructions.enabled ? (
                      <div className="text-muted small p-2">
                        Feature disabled. Enable in agent settings to use persistent instructions.
                      </div>
                    ) : data.persistentInstructions.content ? (
                      <>
                        <div className="text-muted small mb-2">
                          <code>{data.persistentInstructions.path}</code>
                        </div>
                        <pre className="internals-code-block">
                          {data.persistentInstructions.content}
                        </pre>
                      </>
                    ) : (
                      <div className="text-muted small p-2">
                        No instructions set yet. Use <code>instructions_set</code> or <code>instructions_append</code> tools to add instructions.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cache Section */}
            {data.cache && (
              <div className="internals-section">
                <div
                  className="internals-section__header"
                  onClick={() => toggleSection('cache')}
                >
                  {expandedSections.has('cache') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Database size={14} />
                  <span>Idempotency Cache</span>
                  <span className="internals-section__badge">{data.cache.entries}</span>
                </div>
                {expandedSections.has('cache') && (
                  <div className="internals-section__body">
                    <div className="internals-stats">
                      <div className="internals-stat">
                        <span className="internals-stat__label">Hit Rate</span>
                        <span className="internals-stat__value">{(data.cache.hitRate * 100).toFixed(0)}%</span>
                      </div>
                      <div className="internals-stat">
                        <span className="internals-stat__label">Hits</span>
                        <span className="internals-stat__value">{data.cache.hits}</span>
                      </div>
                      <div className="internals-stat">
                        <span className="internals-stat__label">Misses</span>
                        <span className="internals-stat__value">{data.cache.misses}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Memory Section */}
            {data.memory && (
              <div className="internals-section">
                <div
                  className="internals-section__header"
                  onClick={() => toggleSection('memory')}
                >
                  {expandedSections.has('memory') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <MemoryStick size={14} />
                  <span>Working Memory</span>
                  <span className="internals-section__badge">{data.memory.totalEntries}</span>
                </div>
                {expandedSections.has('memory') && (
                  <div className="internals-section__body">
                    <div className="internals-stats mb-2">
                      <div className="internals-stat">
                        <span className="internals-stat__label">Size</span>
                        <span className="internals-stat__value">{formatBytes(data.memory.totalSizeBytes)}</span>
                      </div>
                      <div className="internals-stat">
                        <span className="internals-stat__label">Usage</span>
                        <span className="internals-stat__value">{data.memory.utilizationPercent.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="memory-entries">
                      {data.memory.entries.map((entry) => (
                        <div
                          key={entry.key}
                          className={`memory-entry ${selectedMemoryKey === entry.key ? 'memory-entry--expanded' : ''}`}
                          onClick={() => handleMemoryEntryClick(entry.key)}
                        >
                          <div className="memory-entry__header">
                            <span className="memory-entry__key">{entry.key}</span>
                            <div className="memory-entry__meta">
                              <Badge bg="outline-secondary" className="memory-entry__scope">{entry.scope}</Badge>
                              {entry.priority !== 'normal' && (
                                <Badge bg={entry.priority === 'high' || entry.priority === 'critical' ? 'warning' : 'secondary'}>
                                  {entry.priority}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="memory-entry__desc">{entry.description}</div>
                          {selectedMemoryKey === entry.key && (
                            <div className="memory-entry__details">
                              <div className="memory-entry__size">{formatBytes(entry.sizeBytes)}</div>
                              {loadingMemoryKey === entry.key ? (
                                <div className="memory-entry__loading">
                                  <Spinner animation="border" size="sm" /> Loading value...
                                </div>
                              ) : memoryValues.has(entry.key) ? (
                                <pre className="memory-entry__value">
                                  {JSON.stringify(memoryValues.get(entry.key), null, 2)}
                                </pre>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ))}
                      {data.memory.entries.length === 0 && (
                        <div className="text-muted small p-2">No memory entries</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* In-Context Memory Section */}
            {data.inContextMemory && (
              <div className="internals-section">
                <div
                  className="internals-section__header"
                  onClick={() => toggleSection('inContextMemory')}
                >
                  {expandedSections.has('inContextMemory') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Zap size={14} />
                  <span>In-Context Memory</span>
                  <span className="internals-section__badge">
                    {data.inContextMemory.enabled === false
                      ? 'off'
                      : `${data.inContextMemory.entries.length}/${data.inContextMemory.maxEntries}`}
                  </span>
                </div>
                {expandedSections.has('inContextMemory') && (
                  <div className="internals-section__body">
                    {data.inContextMemory.enabled === false ? (
                      <div className="text-muted small p-2">
                        In-context memory is disabled. Enable in agent settings to use.
                      </div>
                    ) : data.inContextMemory.entries.length === 0 ? (
                      <div className="text-muted small p-2">
                        No entries. Use <code>context_set</code> tool to store values.
                      </div>
                    ) : (
                      <div className="memory-entries">
                        {data.inContextMemory.entries.map((entry) => (
                          <div key={entry.key} className="memory-entry">
                            <div className="memory-entry__header">
                              <span className="memory-entry__key">{entry.key}</span>
                              <Badge bg={entry.priority === 'critical' ? 'danger' : entry.priority === 'high' ? 'warning' : 'secondary'}>
                                {entry.priority}
                              </Badge>
                            </div>
                            <div className="memory-entry__desc">{entry.description}</div>
                            <pre className="memory-entry__value">
                              {JSON.stringify(entry.value, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tools Section */}
            <div className="internals-section">
              <div
                className="internals-section__header"
                onClick={() => toggleSection('tools')}
              >
                {expandedSections.has('tools') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Wrench size={14} />
                <span>Tools</span>
                <span className="internals-section__badge">
                  {data.tools.filter(t => t.enabled).length}/{data.tools.length}
                </span>
              </div>
              {expandedSections.has('tools') && (
                <div className="internals-section__body">
                  <div className="tools-list">
                    {data.tools.map((tool) => (
                      <div key={tool.name} className={`tool-item ${!tool.enabled ? 'tool-item--disabled' : ''}`}>
                        <div className="tool-item__name">{tool.name}</div>
                        <div className="tool-item__stats">
                          {tool.callCount > 0 && (
                            <span className="tool-item__count">{tool.callCount} calls</span>
                          )}
                          <Badge bg={tool.enabled ? 'success' : 'secondary'} className="tool-item__status">
                            {tool.enabled ? 'on' : 'off'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {data.tools.length === 0 && (
                      <div className="text-muted small p-2">No tools registered</div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </>
        )}
      </div>

      {/* Full Context Modal */}
      <Modal
        show={showContextModal}
        onHide={() => setShowContextModal(false)}
        size="xl"
        dialogClassName="context-modal"
        contentClassName="context-modal__content"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <Eye size={18} className="me-2" />
            Full Prepared Context
            {preparedContext?.available && (
              <Badge bg="secondary" className="ms-2">
                ~{preparedContext.totalTokens.toLocaleString()} tokens
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="context-modal__body">
          {isLoadingContext ? (
            <div className="text-center p-4">
              <Spinner animation="border" />
              <p className="mt-2 text-muted">Loading context...</p>
            </div>
          ) : preparedContext?.available ? (
            <div className="context-components">
              {preparedContext.components.map((component, index) => (
                <div key={index} className="context-component">
                  <div className="context-component__header">
                    <span className="context-component__name">{component.name}</span>
                    <Badge bg="outline-secondary">
                      ~{component.tokenEstimate.toLocaleString()} tokens
                    </Badge>
                  </div>
                  <pre className="context-component__content">
                    {component.content}
                  </pre>
                </div>
              ))}
              {preparedContext.components.length === 0 && (
                <div className="text-muted text-center p-4">
                  No context components available
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted text-center p-4">
              Context not available. Make sure an agent is active.
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowContextModal(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (preparedContext?.rawContext) {
                navigator.clipboard.writeText(preparedContext.rawContext);
              }
            }}
            disabled={!preparedContext?.rawContext}
          >
            Copy All
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export { DEFAULT_WIDTH as INTERNALS_PANEL_DEFAULT_WIDTH };
