import type { HTMLAttributes, ReactNode } from 'react';

// ─── Kart ─────────────────────────────────────────────────────
interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'title'> {
  padded?: boolean | 'sm';
  elevated?: boolean;
  tone?: 'default' | 'brand';
  className?: string;
  children: ReactNode;
}

export default function Card({ padded = true, elevated, tone = 'default', className, children, ...rest }: CardProps) {
  const cls = [
    'card',
    padded === 'sm' ? 'card--pad-sm' : padded ? 'card--pad' : '',
    elevated ? 'card--elevated' : '',
    tone === 'brand' ? 'card--brand' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return <div className={cls} {...rest}>{children}</div>;
}

// Kart başlığı: sol tərəfdə ikon + başlıq, sağda isteğe bağlı əməliyyat/link.
export function CardHead({ icon, title, action }: { icon?: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="card__head">
      <h3 className="card__title">{icon}{title}</h3>
      {action}
    </div>
  );
}
