import type { ReactNode } from 'react';
import './ui.css';

/** Indicador neutro: la fuente del dato y su período se mantienen en la página. */
export function StatCard({ label, value, note, className = '' }: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <article className={`diza-stat diza-ui-stat ${className}`.trim()}>
      <span className="diza-ui-stat-label">{label}</span>
      <strong className="diza-ui-stat-value">{value}</strong>
      {note && <span className="diza-ui-stat-note">{note}</span>}
    </article>
  );
}
