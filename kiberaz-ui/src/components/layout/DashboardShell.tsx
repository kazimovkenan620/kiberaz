import { useEffect, useState, type ReactNode } from 'react';
import { PanelLeft, X } from 'lucide-react';
import { IconButton } from '../ui';
import './layout.css';

// ─── Kabinet/quiz qabığı: yan panel + əsas məzmun + isteğe bağlı sağ sütun ──
// 1024px-dən aşağı yan panel çəkməyə (drawer) çevrilir; sağ sütun məzmunun altına düşür.
interface Props {
  sidebar: ReactNode;
  rail?: ReactNode;
  sidebarLabel?: string;
  children: ReactNode;
}

export default function DashboardShell({ sidebar, rail, sidebarLabel = 'Bölmələr', children }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => { if (window.innerWidth > 1024) setOpen(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className={`shell${rail ? ' shell--rail' : ''}`}>
      <div className="shell__mobilebar">
        <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="shell-sidebar">
          <PanelLeft size={15} /> {sidebarLabel}
        </button>
      </div>

      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside id="shell-sidebar" className={`shell__sidebar${open ? ' is-open' : ''}`} aria-label={sidebarLabel}>
        <div className="shell__sidebar-close">
          <IconButton label="Paneli bağla" size="sm" onClick={() => setOpen(false)}><X size={18} /></IconButton>
        </div>
        {/* Çəkmədə bir seçim edildikdə panel bağlanır */}
        <div className="shell__sidebar-body" onClickCapture={e => { if (open && (e.target as HTMLElement).closest('button, a')) setOpen(false); }}>
          {sidebar}
        </div>
      </aside>

      <div className="shell__main">{children}</div>

      {rail && <aside className="shell__rail" aria-label="Əlavə məlumat">{rail}</aside>}
    </div>
  );
}
