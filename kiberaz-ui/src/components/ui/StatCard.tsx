import type { ReactNode } from 'react';

// ─── Stat bloku: ikon / dəyər / etiket ────────────────────────
// Yalnız real məlumat üçün istifadə olunur; dəyər backend-dən gəlir.
export type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'danger';

interface Props {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: StatTone;
  extra?: ReactNode;
}

export default function StatCard({ icon, value, label, tone = 'neutral', extra }: Props) {
  return (
    <div className="stat">
      <div className={`stat__icon${tone !== 'neutral' ? ` stat__icon--${tone}` : ''}`} aria-hidden="true">{icon}</div>
      <div className="stat__body">
        <span className="stat__value">{value}</span>
        <span className="stat__label">{label}</span>
        {extra}
      </div>
    </div>
  );
}
