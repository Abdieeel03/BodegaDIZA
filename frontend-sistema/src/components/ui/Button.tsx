import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
};

/** El tipo por defecto es button; pasar type="submit" expresamente en formularios. */
export function Button({
  children, variant = 'primary', size = 'md', loading = false, block = false,
  className = '', type = 'button', disabled, ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'diza-ui-button', `diza-ui-button--${variant}`,
        `diza-ui-button--${size}`, block ? 'diza-ui-button--block' : '', className,
      ].filter(Boolean).join(' ')}
    >
      {loading && <span className="diza-ui-button-spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}
