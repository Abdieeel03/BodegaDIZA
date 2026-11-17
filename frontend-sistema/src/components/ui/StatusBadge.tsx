import type { ReactNode } from 'react';
import './ui.css';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function StatusBadge({ children, tone = 'neutral', className = '' }: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span className={`diza-ui-badge diza-ui-badge--${tone} ${className}`.trim()}>
      <span className="diza-ui-badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
