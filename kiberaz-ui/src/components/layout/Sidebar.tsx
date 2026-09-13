import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import './layout.css';

// ─── Yan panel naviqasiyası ───────────────────────────────────
// Sətir: ikon + ad (+ real say). Aktiv sətir: zərif brend fonu + sol qırmızı xətt.
export interface SidebarItem<T extends string | number> {
  id: T;
  label: string;
  icon?: ReactNode;
  meta?: string;
  disabled?: boolean;
}

interface Props<T extends string | number> {
  title?: string;
  items: SidebarItem<T>[];
  value: T | null;
  onSelect: (id: T) => void;
  ariaLabel: string;
  header?: ReactNode;
  footer?: ReactNode;
  idPrefix?: string;
}

export default function Sidebar<T extends string | number>({ title, items, value, onSelect, ariaLabel, header, footer, idPrefix = 'sb' }: Props<T>) {
  return (
    <div className="sidebar">
      {header}
      {title && <div className="sidebar__title">{title}</div>}
      <nav className="sidebar__nav" aria-label={ariaLabel}>
        {items.map(item => {
          const active = item.id === value;
          return (
            <button
              key={String(item.id)}
              id={`${idPrefix}-${item.id}`}
              type="button"
              className={`sidebar__item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              disabled={item.disabled}
            >
              {item.icon && <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>}
              <span className="sidebar__text">
                <span className="sidebar__label">{item.label}</span>
                {item.meta && <span className="sidebar__meta">{item.meta}</span>}
              </span>
            </button>
          );
        })}
      </nav>
      {footer}
    </div>
  );
}

// Yan panelin altındakı brend kartı — statik mətn, uydurma məlumat yoxdur.
export function SidebarPromo({ onClick }: { onClick?: () => void }) {
  return (
    <div className="sidebar__promo">
      <p>Daha güclü gələcək üçün birlikdə öyrənək.</p>
      {onClick
        ? <button type="button" className="sidebar__promo-btn" onClick={onClick} aria-label="Təlimlərə keç"><ArrowUpRight size={16} /></button>
        : <span className="sidebar__promo-btn" aria-hidden="true"><ArrowUpRight size={16} /></span>}
    </div>
  );
}
