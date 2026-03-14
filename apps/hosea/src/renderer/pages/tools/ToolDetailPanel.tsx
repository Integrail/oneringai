import type { ToolListItem, ToolSchemaParam } from './toolTypes.js';
import { getCatIcon, getCatLabel } from './toolUtils.js';

interface Props {
  tool: ToolListItem | null;
  schema: ToolSchemaParam[] | null;
  panelWidth: number;
  onClose: () => void;
}

export function ToolDetailPanel({ tool, schema, panelWidth, onClose }: Props) {
  if (!tool) {
    return (
      <div className="detail-panel detail-panel--hidden" style={{ width: 0 }} />
    );
  }

  return (
    <div className="detail-panel" style={{ width: panelWidth }}>
      <div className="pn-header">
        <div
          className="pn-header__icon"
          style={{ background: `color-mix(in srgb, var(--cat-${tool.category}) 15%, white)` }}
        >
          {getCatIcon(tool.category)}
        </div>
        <div className="pn-header__info">
          <div className="pn-header__name">{tool.name}</div>
          <div className="pn-header__badges">
            <span className="pn-header__cat-badge">{getCatLabel(tool.category)}</span>
            <span className={`perm-badge perm-badge--${tool.safeByDefault ? 'safe' : 'approval'}`}>
              {tool.safeByDefault ? '✓ Auto-allowed' : '⚠ Approval'}
            </span>
          </div>
        </div>
        <button className="pn-close-btn" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="pn-body">
        <div>
          <div className="pn-section__label">Description</div>
          <div className="pn-section__text">{tool.description}</div>
        </div>

        {schema !== null && (
          <div>
            <div className="pn-section__label">
              Parameters ({schema.length})
            </div>
            {schema.length === 0 ? (
              <div className="pn-section__text" style={{ color: 'var(--color-gray-400)', fontStyle: 'italic' }}>
                No parameters
              </div>
            ) : (
              <div className="pn-params-list">
                {schema.map((param) => (
                  <div key={param.name} className="param-row">
                    <div className="param-row__head">
                      <span className="param-row__name">{param.name}</span>
                      <span className="param-row__type">{param.type}</span>
                      <span className={`param-row__required param-row__required--${param.required ? 'yes' : 'no'}`}>
                        {param.required ? 'required' : 'optional'}
                      </span>
                    </div>
                    {param.description && (
                      <div className="param-row__desc">{param.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <div className="pn-section__label">Permission</div>
          <div className={`pn-perm-box pn-perm-box--${tool.safeByDefault ? 'safe' : 'approval'}`}>
            <div className="pn-perm-box__icon">
              {tool.safeByDefault ? '✓' : '⚠'}
            </div>
            <div>
              <div className="pn-perm-box__title">
                {tool.safeByDefault ? 'Auto-allowed' : 'Requires approval'}
              </div>
              <div className="pn-perm-box__sub">
                {tool.safeByDefault
                  ? 'Runs automatically without user approval.'
                  : 'Agent must request user approval before each use.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
