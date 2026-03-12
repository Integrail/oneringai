/**
 * AgentContextMenu — dropdown triggered by the ⋮ button on an agent card.
 * Portaled to document.body to escape card overflow clipping.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Archive, ArchiveRestore, Pencil } from 'lucide-react';

interface AgentContextMenuProps {
  agentId: string;
  isArchived: boolean;
  anchorEl: HTMLElement;
  onClose: () => void;
  onCopyId: (id: string) => void;
  onRename: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
}

export function AgentContextMenu({
  agentId,
  isArchived,
  anchorEl,
  onClose,
  onCopyId,
  onRename,
  onArchive,
  onUnarchive,
}: AgentContextMenuProps): React.ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position the menu near the anchor button
  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const menuH = 160; // approx height
    const menuW = 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuH ? rect.bottom + 4 : rect.top - menuH - 4;
    const left = Math.min(rect.left, window.innerWidth - menuW - 8);
    setPos({ top, left });
  }, [anchorEl]);

  // Close on outside click or Escape
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  function handleItem(cb: () => void) {
    cb();
    onClose();
  }

  return createPortal(
    <div
      ref={menuRef}
      className="agent-menu"
      style={{ top: pos.top, left: pos.left }}
      role="menu"
    >
      <button
        type="button"
        className="agent-menu__item"
        role="menuitem"
        onClick={() => handleItem(() => onRename(agentId))}
      >
        <Pencil size={14} />
        Rename
      </button>
      <button
        type="button"
        className="agent-menu__item"
        role="menuitem"
        onClick={() => handleItem(() => onCopyId(agentId))}
      >
        <Copy size={14} />
        Copy ID
      </button>
      <div className="agent-menu__divider" />
      {isArchived ? (
        <button
          type="button"
          className="agent-menu__item"
          role="menuitem"
          onClick={() => handleItem(() => onUnarchive(agentId))}
        >
          <ArchiveRestore size={14} />
          Unarchive
        </button>
      ) : (
        <button
          type="button"
          className="agent-menu__item agent-menu__item--danger"
          role="menuitem"
          onClick={() => handleItem(() => onArchive(agentId))}
        >
          <Archive size={14} />
          Archive
        </button>
      )}
    </div>,
    document.body,
  );
}
