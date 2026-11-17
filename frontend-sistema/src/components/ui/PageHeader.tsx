import type { ReactNode } from 'react';
import './ui.css';

export function PageHeader({ title, description, eyebrow, actions, className = '', titleId }: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <header className={`diza-ui-page-header ${className}`.trim()}>
      <div className="diza-ui-page-heading">
        {eyebrow && <span className="diza-ui-page-eyebrow">{eyebrow}</span>}
        <h1 id={titleId}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="diza-ui-page-actions">{actions}</div>}
    </header>
  );
}
