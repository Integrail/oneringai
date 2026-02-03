/**
 * MCPServerToolList Component
 *
 * Displays a list of tools from an MCP server with optional selection checkboxes.
 */

import React from 'react';
import { Form, Badge } from 'react-bootstrap';
import { Wrench, Check } from 'lucide-react';

interface MCPTool {
  name: string;
  description?: string;
}

interface MCPServerToolListProps {
  /** List of tools */
  tools: MCPTool[];
  /** Currently selected tool names (for selection mode) */
  selectedTools?: string[];
  /** Handler for tool selection change */
  onSelectionChange?: (selectedTools: string[]) => void;
  /** Whether selection is enabled */
  selectable?: boolean;
  /** Server name for context */
  serverName?: string;
  /** Loading state */
  loading?: boolean;
  /** Compact mode - show fewer details */
  compact?: boolean;
}

export function MCPServerToolList({
  tools,
  selectedTools = [],
  onSelectionChange,
  selectable = false,
  serverName,
  loading = false,
  compact = false,
}: MCPServerToolListProps): React.ReactElement {
  const handleToolToggle = (toolName: string) => {
    if (!onSelectionChange) return;

    if (selectedTools.includes(toolName)) {
      onSelectionChange(selectedTools.filter((t) => t !== toolName));
    } else {
      onSelectionChange([...selectedTools, toolName]);
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(tools.map((t) => t.name));
  };

  const handleSelectNone = () => {
    if (!onSelectionChange) return;
    onSelectionChange([]);
  };

  if (loading) {
    return (
      <div className="mcp-tool-list mcp-tool-list--loading">
        <div className="mcp-tool-list__loading">
          Loading tools...
        </div>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="mcp-tool-list mcp-tool-list--empty">
        <Wrench size={24} className="text-muted mb-2" />
        <div className="text-muted">No tools available</div>
        {serverName && (
          <div className="text-muted small">
            Connect to {serverName} to see available tools
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`mcp-tool-list ${compact ? 'mcp-tool-list--compact' : ''}`}>
      {selectable && (
        <div className="mcp-tool-list__header">
          <div className="mcp-tool-list__count">
            {selectedTools.length} of {tools.length} selected
          </div>
          <div className="mcp-tool-list__actions">
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={handleSelectAll}
            >
              Select All
            </button>
            <span className="mx-2">|</span>
            <button
              type="button"
              className="btn btn-link btn-sm p-0"
              onClick={handleSelectNone}
            >
              Select None
            </button>
          </div>
        </div>
      )}

      <div className="mcp-tool-list__items">
        {tools.map((tool) => {
          const isSelected = selectedTools.includes(tool.name);

          return (
            <div
              key={tool.name}
              className={`mcp-tool-list__item ${isSelected ? 'mcp-tool-list__item--selected' : ''}`}
              onClick={selectable ? () => handleToolToggle(tool.name) : undefined}
              role={selectable ? 'checkbox' : undefined}
              aria-checked={selectable ? isSelected : undefined}
              tabIndex={selectable ? 0 : undefined}
              onKeyDown={
                selectable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToolToggle(tool.name);
                      }
                    }
                  : undefined
              }
            >
              {selectable ? (
                <Form.Check
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToolToggle(tool.name)}
                  className="mcp-tool-list__checkbox"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="mcp-tool-list__icon">
                  <Wrench size={14} />
                </div>
              )}

              <div className="mcp-tool-list__content">
                <div className="mcp-tool-list__name">
                  <code>{tool.name}</code>
                  {isSelected && !selectable && (
                    <Badge bg="success" className="ms-2">
                      <Check size={10} /> Selected
                    </Badge>
                  )}
                </div>
                {tool.description && !compact && (
                  <div className="mcp-tool-list__description">
                    {tool.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MCPServerToolList;
