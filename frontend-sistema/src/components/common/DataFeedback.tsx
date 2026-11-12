import './data-feedback.css';

export type DataFeedbackStatus = 'loading' | 'error' | 'empty';

type Props = {
  status: DataFeedbackStatus;
  title?: string;
  description?: string;
  onRetry?: () => void;
  actionLabel?: string;
};

const TEXTS: Record<DataFeedbackStatus, { title: string; description: string }> = {
  loading: {
    title: 'Cargando información',
    description: 'Estamos consultando los datos.',
  },
  error: {
    title: 'No se pudieron cargar los datos',
    description: 'Verifica la conexión y vuelve a intentarlo.',
  },
  empty: {
    title: 'Todavía no hay registros',
    description: 'Los datos aparecerán aquí cuando estén disponibles.',
  },
};

/** Componente presentacional: se reutiliza sin importar de qué módulo vienen los datos. */
export function DataFeedback({ status, title, description, onRetry, actionLabel }: Props) {
  const copy = TEXTS[status];
  return (
    <section
      className="diza-data-feedback"
      role={status === 'error' ? 'alert' : 'status'}
      aria-live={status === 'error' ? 'assertive' : 'polite'}
    >
      {status === 'loading' ? (
        <span className="diza-data-spinner" aria-hidden="true" />
      ) : (
        <span className={`diza-data-symbol diza-data-symbol--${status}`} aria-hidden="true">
          {status === 'error' ? '!' : '□'}
        </span>
      )}
      <h2>{title ?? copy.title}</h2>
      <p>{description ?? copy.description}</p>
      {status === 'loading' ? (
        <div className="diza-data-skeletons" aria-hidden="true">
          <span /><span /><span />
        </div>
      ) : onRetry ? (
        <button type="button" className="diza-data-retry" onClick={onRetry}>
          {actionLabel ?? (status === 'empty' ? 'Actualizar' : 'Reintentar')}
        </button>
      ) : null}
    </section>
  );
}
