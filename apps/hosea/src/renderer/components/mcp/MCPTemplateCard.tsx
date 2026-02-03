/**
 * MCPTemplateCard Component
 *
 * Displays an individual MCP server template with name, description, category, and tags.
 */

import React from 'react';
import { Badge } from 'react-bootstrap';
import { Star, ExternalLink, Terminal, Key, FolderOpen, Box } from 'lucide-react';
import type { MCPServerTemplate, MCPTemplateCategory, MCPPrerequisite } from '../../../shared/mcpTemplates';
import { CATEGORY_INFO, PREREQUISITE_INFO } from '../../../shared/mcpTemplates';

interface MCPTemplateCardProps {
  /** The template to display */
  template: MCPServerTemplate;
  /** Handler when card is clicked */
  onClick?: (template: MCPServerTemplate) => void;
  /** Whether the card is selected */
  selected?: boolean;
}

/**
 * Get category badge variant based on category type
 */
function getCategoryVariant(category: MCPTemplateCategory): string {
  switch (category) {
    case 'core':
      return 'primary';
    case 'developer':
      return 'info';
    case 'database':
      return 'warning';
    case 'cloud':
      return 'success';
    case 'productivity':
      return 'secondary';
    case 'search':
      return 'danger';
    case 'utility':
      return 'dark';
    default:
      return 'secondary';
  }
}

/**
 * Render popularity stars
 */
function PopularityStars({ popularity }: { popularity?: number }): React.ReactElement | null {
  if (!popularity) return null;

  return (
    <div className="mcp-template-card__popularity" title={`Popularity: ${popularity}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < popularity ? 'star-filled' : 'star-empty'}
        />
      ))}
    </div>
  );
}

export function MCPTemplateCard({
  template,
  onClick,
  selected = false,
}: MCPTemplateCardProps): React.ReactElement {
  const categoryInfo = CATEGORY_INFO[template.category];
  const hasRequiredEnv = template.requiredEnv && template.requiredEnv.length > 0;
  const hasRequiredArgs = template.requiredArgs && template.requiredArgs.length > 0;
  const hasPrerequisites = template.prerequisites && template.prerequisites.length > 0;

  const handleClick = () => {
    onClick?.(template);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(template);
    }
  };

  return (
    <div
      className={`mcp-template-card ${selected ? 'mcp-template-card--selected' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      <div className="mcp-template-card__header">
        <div className="mcp-template-card__icon">
          <Terminal size={20} />
        </div>
        <div className="mcp-template-card__title">
          <div className="mcp-template-card__name">
            {template.displayName}
          </div>
          <div className="mcp-template-card__meta">
            <Badge bg={getCategoryVariant(template.category)} className="mcp-template-card__category">
              {categoryInfo.label}
            </Badge>
            <PopularityStars popularity={template.popularity} />
          </div>
        </div>
      </div>

      <div className="mcp-template-card__body">
        <p className="mcp-template-card__description">{template.description}</p>

        {/* Requirements indicators */}
        <div className="mcp-template-card__requirements">
          {hasPrerequisites && template.prerequisites!.map((prereq: MCPPrerequisite) => (
            <span
              key={prereq}
              className="mcp-template-card__requirement mcp-template-card__requirement--prereq"
              title={PREREQUISITE_INFO[prereq].description}
            >
              <Box size={12} />
              <span>{PREREQUISITE_INFO[prereq].label}</span>
            </span>
          ))}
          {hasRequiredEnv && (
            <span className="mcp-template-card__requirement mcp-template-card__requirement--env" title="Requires API key or token">
              <Key size={12} />
              <span>API Key</span>
            </span>
          )}
          {hasRequiredArgs && (
            <span className="mcp-template-card__requirement" title="Requires configuration">
              <FolderOpen size={12} />
              <span>Config</span>
            </span>
          )}
        </div>

        {/* Tags */}
        {template.tags && template.tags.length > 0 && (
          <div className="mcp-template-card__tags">
            {template.tags.slice(0, 4).map((tag: string) => (
              <span key={tag} className="mcp-template-card__tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Documentation link */}
      {(template.docsUrl || template.sourceUrl) && (
        <div className="mcp-template-card__footer">
          <a
            href={template.docsUrl || template.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mcp-template-card__link"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
            <span>Docs</span>
          </a>
        </div>
      )}
    </div>
  );
}

export default MCPTemplateCard;
