import type { HTMLAttributes } from 'react';

type BrandMarkProps = HTMLAttributes<HTMLDivElement> & {
  compact?: boolean;
  inverse?: boolean;
};

export const BrandMark = ({ compact = false, inverse = false, className = '', ...props }: BrandMarkProps) => (
  <div className={`brand-mark${compact ? ' brand-mark--compact' : ''}${inverse ? ' brand-mark--inverse' : ''} ${className}`} {...props}>
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M8 20 24 9l16 11v19H8Z" />
      <path d="M5 20h38l-3-8H8Z" />
      <path d="M17 39V27h14v12M16 20v-4M24 20v-4M32 20v-4" />
    </svg>
    {!compact && <span><strong>Bodega</strong><b>DIZA</b></span>}
  </div>
);

export default BrandMark;
