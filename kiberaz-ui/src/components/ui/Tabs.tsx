import type { ReactNode } from 'react';

// ─── Tab zolağı ───────────────────────────────────────────────
// Klaviatura: Sol/Sağ oxlar tablar arasında keçir, Home/End ilk/son taba gedir.
export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  variant?: 'underline' | 'pills';
  idPrefix?: string;
}

export default function Tabs<T extends string>({ items, value, onChange, ariaLabel, variant = 'underline', idPrefix = 'tab' }: Props<T>) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex(i => i.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    document.getElementById(`${idPrefix}-${items[next].id}`)?.focus();
  };

  return (
    <div className={variant === 'pills' ? 'pills' : 'tabs'} role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {items.map(item => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            id={`${idPrefix}-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={variant === 'pills' ? 'pill' : 'tab'}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
            {typeof item.count === 'number' && <span className="tab__count">({item.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
