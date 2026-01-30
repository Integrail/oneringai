/**
 * Page Container Component
 */

import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function PageContainer({ children, noPadding }: PageContainerProps): React.ReactElement {
  return (
    <div className="page">
      <div className={`page__content ${noPadding ? 'page__content--no-padding' : ''}`}>
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  backButton?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  children,
  backButton,
}: PageHeaderProps): React.ReactElement {
  return (
    <div className="page__header">
      <div className="page__header-left">
        {backButton}
        <div>
          <h1 className="page__title">{title}</h1>
          {subtitle && <p className="page__subtitle">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="page__header-right">{children}</div>}
    </div>
  );
}
