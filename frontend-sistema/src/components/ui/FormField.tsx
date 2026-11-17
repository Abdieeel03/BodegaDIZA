import type { ReactNode } from 'react';
import './ui.css';

type FormFieldProps = {
  controlId: string;
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
};

/** Une una etiqueta visible a un control nativo mediante id/htmlFor. */
export function FormField({ controlId, label, children, hint, error, required, className = '' }: FormFieldProps) {
  return (
    <div className={`diza-ui-field ${className}`.trim()}>
      <label className="diza-ui-field-label" htmlFor={controlId}>
        {label}{required && <span className="diza-ui-required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p className="diza-ui-field-hint" id={`${controlId}-hint`}>{hint}</p>}
      {error && <p className="diza-ui-field-error" id={`${controlId}-error`} role="alert">{error}</p>}
    </div>
  );
}
