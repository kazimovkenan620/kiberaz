// ─── Proqres zolağı ───────────────────────────────────────────
// `value` 0–100 arasında sıxılır. Rəng tək başına məna daşımır: dəyər
// mətnlə də göstərilir (`showValue`) və ya aria-label ilə oxunur.
interface Props {
  value: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'success' | 'warning' | 'info';
  showValue?: boolean;
}

export default function ProgressBar({ value, label, size = 'md', tone = 'brand', showValue }: Props) {
  const pct = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  const bar = (
    <div
      className={`progress${size !== 'md' ? ` progress--${size}` : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`progress__fill${tone !== 'brand' ? ` progress__fill--${tone}` : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
  if (!showValue) return bar;
  return (
    <div className="progress-row">
      {bar}
      <span className="progress-row__value">{pct}%</span>
    </div>
  );
}
