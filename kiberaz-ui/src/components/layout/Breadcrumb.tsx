import { ChevronRight } from 'lucide-react';
import './layout.css';

// ─── Çörək qırıntısı ──────────────────────────────────────────
export interface Crumb { label: string; onClick?: () => void; }

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumb" aria-label="Yol">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              {item.onClick && !last
                ? <button type="button" className="breadcrumb__link" onClick={item.onClick}>{item.label}</button>
                : <span className="breadcrumb__current" aria-current={last ? 'page' : undefined}>{item.label}</span>}
              {!last && <ChevronRight size={13} className="breadcrumb__sep" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
