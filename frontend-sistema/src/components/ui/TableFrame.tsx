import type { ReactNode } from 'react';
import './ui.css';

/** Conserva el HTML de las tablas y agrega región accesible con scroll horizontal. */
export function TableFrame({ label, children, className = '' }: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`diza-ui-table-frame ${className}`.trim()}
      role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
