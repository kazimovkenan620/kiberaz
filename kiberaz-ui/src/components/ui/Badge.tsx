import type { ReactNode } from 'react';

// ─── Nişan (status, kateqoriya, rol) ──────────────────────────
// Status heç vaxt yalnız rənglə bildirilmir: mətn və ya ikon həmişə yanındadır.
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  tone?: BadgeTone;
  dot?: boolean;
  outline?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Badge({ tone = 'neutral', dot, outline, className, children }: Props) {
  const cls = [
    'badge',
    tone !== 'neutral' ? `badge--${tone}` : '',
    dot ? 'badge--dot' : '',
    outline ? 'badge--outline' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}
