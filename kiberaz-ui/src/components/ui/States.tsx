import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import Button from './Button';

// ─── Ortaq vəziyyətlər: yüklənir / boş / xəta ─────────────────
// Bir nümunə, hər yerdə eyni görünüş. Xəta mətni həmişə Azərbaycan dilində və
// insan üçün yazılır — heç vaxt stack trace və ya server daxili məlumatı deyil.

export function LoadingState({ text = 'Yüklənir...', compact }: { text?: string; compact?: boolean }) {
  return (
    <div className={`state${compact ? ' state--compact' : ''}`} role="status" aria-live="polite">
      <span className="spinner spinner--lg" aria-hidden="true" />
      <span className="state__text">{text}</span>
    </div>
  );
}

// Məzmun-ağır sahələr üçün skelet (siyahı, cədvəl).
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" role="status" aria-live="polite" aria-label="Yüklənir">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton skeleton--block" />)}
    </div>
  );
}

export function EmptyState({ icon, title, text, action, compact }: {
  icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={`state${compact ? ' state--compact' : ''}`} role="status">
      <div className="state__icon" aria-hidden="true">{icon ?? <Inbox size={20} />}</div>
      <div className="state__title">{title}</div>
      {text && <div className="state__text">{text}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Məlumat yüklənmədi', text, onRetry, retryLabel = 'Yenidən cəhd et', compact }: {
  title?: string; text?: ReactNode; onRetry?: () => void; retryLabel?: string; compact?: boolean;
}) {
  return (
    <div className={`state state--error${compact ? ' state--compact' : ''}`} role="alert">
      <div className="state__icon" aria-hidden="true"><AlertTriangle size={20} /></div>
      <div className="state__title">{title}</div>
      {text && <div className="state__text">{text}</div>}
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  );
}
