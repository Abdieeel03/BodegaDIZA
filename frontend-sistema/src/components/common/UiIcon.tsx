import type { ReactNode } from 'react';

export type UiIconName =
  | 'home'
  | 'inventory'
  | 'prediction'
  | 'sales'
  | 'calendar'
  | 'warning'
  | 'chevron'
  | 'bell'
  | 'logout'
  | 'store';

const paths: Record<UiIconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
  inventory: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M9 5v5M9 15h6" />
    </>
  ),
  prediction: (
    <>
      <path d="M3 18 9 12l4 3 8-9" />
      <path d="M16 6h5v5" />
    </>
  ),
  sales: (
    <>
      <rect x="4" y="7" width="16" height="14" rx="2" />
      <path d="M7 7V4h10v3M4 12h16M8 16h2M14 16h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>
  ),
  warning: (
    <>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
      <path d="M13 7l5 5-5 5M8 12h10" />
    </>
  ),
  store: (
    <>
      <path d="M4 9 6 3h12l2 6M4 9v12h16V9M3 9h18" />
      <path d="M9 21v-7h6v7" />
    </>
  ),
};

export interface UiIconProps {
  name: UiIconName;
  size?: number;
  className?: string;
}

export function UiIcon({ name, size = 20, className = '' }: UiIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
