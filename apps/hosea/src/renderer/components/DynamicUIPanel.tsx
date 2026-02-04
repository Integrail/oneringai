/**
 * DynamicUIPanel - Renders dynamic UI content from agent tool results
 * Supports forms, displays, tables, progress indicators, browser views, and custom elements
 */

import React, { useCallback } from 'react';
import { Alert, Button, Form, ProgressBar, Spinner } from 'react-bootstrap';
import { Layout, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import type { DynamicUIContent, DynamicUIElement } from '../../preload/index';
import { BrowserViewHost } from './BrowserViewHost';

interface DynamicUIPanelProps {
  content: DynamicUIContent | null;
  onAction?: (action: string, elementId?: string, value?: unknown) => void;
}

export function DynamicUIPanel({ content, onAction }: DynamicUIPanelProps): React.ReactElement {
  const handleAction = useCallback((action: string, elementId?: string, value?: unknown) => {
    if (onAction) {
      onAction(action, elementId, value);
    }
  }, [onAction]);

  if (!content) {
    return (
      <div className="dynamic-ui-panel dynamic-ui-panel--empty">
        <div className="dynamic-ui-panel__empty-state">
          <Layout size={40} className="dynamic-ui-panel__empty-icon" />
          <h3>No Dynamic Content</h3>
          <p className="text-muted">
            Agents can display interactive content here when running tools that provide UI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dynamic-ui-panel">
      {content.title && (
        <div className="dynamic-ui-panel__title">
          {content.title}
        </div>
      )}
      <div className="dynamic-ui-panel__content">
        {content.elements.map((element, index) => (
          <DynamicUIElementRenderer
            key={element.id || `element-${index}`}
            element={element}
            onAction={handleAction}
          />
        ))}
      </div>
    </div>
  );
}

// Element Renderer Component
interface ElementRendererProps {
  element: DynamicUIElement;
  onAction: (action: string, elementId?: string, value?: unknown) => void;
}

function DynamicUIElementRenderer({ element, onAction }: ElementRendererProps): React.ReactElement | null {
  switch (element.type) {
    case 'text':
      return <TextElement element={element} />;
    case 'heading':
      return <HeadingElement element={element} />;
    case 'input':
      return <InputElement element={element} onAction={onAction} />;
    case 'button':
      return <ButtonElement element={element} onAction={onAction} />;
    case 'select':
      return <SelectElement element={element} onAction={onAction} />;
    case 'progress':
      return <ProgressElement element={element} />;
    case 'alert':
      return <AlertElement element={element} />;
    case 'code':
      return <CodeElement element={element} />;
    case 'divider':
      return <hr className="dynamic-ui__divider" />;
    case 'spacer':
      return <div className="dynamic-ui__spacer" />;
    case 'image':
      return <ImageElement element={element} />;
    case 'list':
      return <ListElement element={element} />;
    case 'table':
      return <TableElement element={element} />;
    case 'link':
      return <LinkElement element={element} />;
    case 'badge':
      return <BadgeElement element={element} />;
    case 'card':
      return <CardElement element={element} onAction={onAction} />;
    case 'browser':
      return <BrowserElement element={element} />;
    default:
      return null;
  }
}

// Browser element component - embeds a live browser view
function BrowserElement({ element }: { element: DynamicUIElement }): React.ReactElement | null {
  if (!element.instanceId) {
    return (
      <div className="dynamic-ui__browser-error">
        <AlertCircle size={16} />
        <span>Browser element requires an instanceId</span>
      </div>
    );
  }

  return (
    <BrowserViewHost
      instanceId={element.instanceId}
      showUrlBar={element.showUrlBar !== false}
      showNavButtons={element.showNavButtons !== false}
      currentUrl={element.currentUrl}
      pageTitle={element.pageTitle}
      isLoading={element.isLoading}
    />
  );
}

// Individual element components
function TextElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const className = `dynamic-ui__text ${element.variant ? `dynamic-ui__text--${element.variant}` : ''}`;
  return <p className={className}>{String(element.value || '')}</p>;
}

function HeadingElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const level = element.level || 3;
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className="dynamic-ui__heading">{String(element.value || '')}</Tag>;
}

function InputElement({ element, onAction }: ElementRendererProps): React.ReactElement {
  const [value, setValue] = React.useState(element.value || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  const handleBlur = () => {
    if (element.action) {
      onAction(element.action, element.id, value);
    }
  };

  const inputType = element.inputType || 'text';
  const isTextarea = inputType === 'textarea';

  return (
    <div className="dynamic-ui__input-group">
      {element.label && (
        <Form.Label className="dynamic-ui__label">{element.label}</Form.Label>
      )}
      {isTextarea ? (
        <Form.Control
          as="textarea"
          className="dynamic-ui__input"
          value={String(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={element.placeholder as string}
          rows={element.rows as number || 3}
          disabled={element.disabled as boolean}
        />
      ) : (
        <Form.Control
          type={inputType}
          className="dynamic-ui__input"
          value={String(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={element.placeholder as string}
          disabled={element.disabled as boolean}
        />
      )}
      {element.helpText && (
        <Form.Text className="text-muted">{String(element.helpText)}</Form.Text>
      )}
    </div>
  );
}

function ButtonElement({ element, onAction }: ElementRendererProps): React.ReactElement {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = async () => {
    if (!element.action) return;

    setIsLoading(true);
    try {
      onAction(element.action, element.id, element.value);
    } finally {
      // Keep loading for a short time to show feedback
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  const variant = element.variant || 'primary';
  const size = element.size as 'sm' | 'lg' | undefined;

  return (
    <Button
      variant={variant}
      size={size}
      className="dynamic-ui__button"
      onClick={handleClick}
      disabled={isLoading || element.disabled as boolean}
    >
      {isLoading ? (
        <>
          <Spinner animation="border" size="sm" className="me-2" />
          {element.loadingText || element.label}
        </>
      ) : (
        element.label
      )}
    </Button>
  );
}

function SelectElement({ element, onAction }: ElementRendererProps): React.ReactElement {
  const [value, setValue] = React.useState(element.value || '');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (element.action) {
      onAction(element.action, element.id, newValue);
    }
  };

  const options = (element.options as Array<{ value: string; label: string }>) || [];

  return (
    <div className="dynamic-ui__select-group">
      {element.label && (
        <Form.Label className="dynamic-ui__label">{element.label}</Form.Label>
      )}
      <Form.Select
        className="dynamic-ui__select"
        value={String(value)}
        onChange={handleChange}
        disabled={element.disabled as boolean}
      >
        {element.placeholder && (
          <option value="">{String(element.placeholder)}</option>
        )}
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Form.Select>
    </div>
  );
}

function ProgressElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const value = Number(element.value) || 0;
  const max = Number(element.max) || 100;
  const percent = (value / max) * 100;
  const variant = element.variant as 'success' | 'info' | 'warning' | 'danger' | undefined;

  return (
    <div className="dynamic-ui__progress-group">
      {element.label && (
        <div className="dynamic-ui__progress-label">
          <span>{element.label}</span>
          <span>{Math.round(percent)}%</span>
        </div>
      )}
      <ProgressBar
        now={percent}
        variant={variant}
        animated={element.animated as boolean}
        striped={element.striped as boolean}
        className="dynamic-ui__progress"
      />
    </div>
  );
}

function AlertElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const variant = element.variant || 'info';
  const icons: Record<string, React.ReactNode> = {
    info: <Info size={16} />,
    success: <CheckCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    danger: <AlertCircle size={16} />,
  };

  return (
    <Alert variant={variant} className="dynamic-ui__alert">
      <span className="dynamic-ui__alert-icon">{icons[variant]}</span>
      <span>{String(element.value || '')}</span>
    </Alert>
  );
}

function CodeElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const language = element.language as string || 'text';

  return (
    <div className="dynamic-ui__code-block">
      {element.label && (
        <div className="dynamic-ui__code-header">
          <span>{element.label}</span>
          <span className="dynamic-ui__code-language">{language}</span>
        </div>
      )}
      <pre className="dynamic-ui__code">
        <code>{String(element.value || '')}</code>
      </pre>
    </div>
  );
}

function ImageElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const src = String(element.value || element.src || '');
  const alt = String(element.alt || element.label || '');

  return (
    <div className="dynamic-ui__image-container">
      <img src={src} alt={alt} className="dynamic-ui__image" />
      {element.label && (
        <div className="dynamic-ui__image-caption">{element.label}</div>
      )}
    </div>
  );
}

function ListElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const items = (element.items as string[]) || [];
  const ordered = element.ordered as boolean;
  const ListTag = ordered ? 'ol' : 'ul';

  return (
    <ListTag className="dynamic-ui__list">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ListTag>
  );
}

function TableElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const headers = element.headers || [];
  const rows = element.tableRows || [];

  return (
    <div className="dynamic-ui__table-container">
      <table className="dynamic-ui__table">
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((header, i) => (
                <th key={i}>{header}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinkElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const href = String(element.href || element.value || '#');
  const target = element.external ? '_blank' : undefined;
  const rel = element.external ? 'noopener noreferrer' : undefined;

  return (
    <a href={href} target={target} rel={rel} className="dynamic-ui__link">
      {element.label || href}
    </a>
  );
}

function BadgeElement({ element }: { element: DynamicUIElement }): React.ReactElement {
  const variant = element.variant || 'secondary';

  return (
    <span className={`badge bg-${variant} dynamic-ui__badge`}>
      {String(element.value || element.label || '')}
    </span>
  );
}

function CardElement({ element, onAction }: ElementRendererProps): React.ReactElement {
  const children = (element.children as DynamicUIElement[]) || [];

  return (
    <div className="dynamic-ui__card">
      {element.label && (
        <div className="dynamic-ui__card-header">{element.label}</div>
      )}
      <div className="dynamic-ui__card-body">
        {children.map((child, i) => (
          <DynamicUIElementRenderer key={i} element={child} onAction={onAction} />
        ))}
      </div>
    </div>
  );
}
