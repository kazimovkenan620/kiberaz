import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import IconButton from './IconButton';

// ─── Modal ────────────────────────────────────────────────────
// - semantik dialog (role="dialog"/"alertdialog", aria-modal, aria-labelledby)
// - fokus tələsi + bağlananda fokusun geri qaytarılması
// - Escape ilə bağlanma (`closeOnEscape`), fon skrolunun kilidlənməsi
// - `closeOnBackdrop` default false: yarımçıq doldurulmuş forma təsadüfi
//   kliklə itməsin; yalnız məlumat pəncərələri üçün true verilir.

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  role?: 'dialog' | 'alertdialog';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openModals = 0;

export default function Modal({
  open, onClose, title, kicker, size = 'md', role = 'dialog',
  closeOnBackdrop = false, closeOnEscape = true, footer, children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Effekt yalnız `open` dəyişəndə işləyir; onClose/closeOnEscape hər renderdə
  // dəyişə bilər (inline funksiyalar), ona görə ref-də saxlanılır — əks halda
  // valideynin hər renderi (məs. imtahan taymeri) fokusu yenidən qoyurdu.
  const latest = useRef({ onClose, closeOnEscape });
  useEffect(() => { latest.current = { onClose, closeOnEscape }; });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    openModals += 1;
    document.body.style.overflow = 'hidden';

    // İlk fokus: React `autoFocus` commit zamanı fokusu artıq qoyubsa, o saxlanılır;
    // yoxsa bağlama düyməsindən sonrakı ilk fokuslana bilən element, o da yoxdursa panel.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = nodes.find(n => !n.closest('.modal__head')) ?? nodes[0];
      (first ?? panel).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (latest.current.closeOnEscape) { e.stopPropagation(); latest.current.onClose(); }
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.offsetParent !== null || n === document.activeElement);
      if (nodes.length === 0) { e.preventDefault(); panel.focus(); return; }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === firstNode || document.activeElement === panel)) { e.preventDefault(); lastNode.focus(); }
      else if (!e.shiftKey && document.activeElement === lastNode) { e.preventDefault(); firstNode.focus(); }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      openModals = Math.max(0, openModals - 1);
      // Digər kilidlər (mobil menyu, yan panel çəkməsi) pozulmasın deyə əvvəlki dəyər bərpa olunur.
      if (openModals === 0) document.body.style.overflow = previousOverflow === 'hidden' ? previousOverflow : '';
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className={`modal modal--${size}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__head">
          <div className="modal__heading">
            {kicker && <div className="kicker modal__kicker">{kicker}</div>}
            <h2 className="modal__title" id={titleId}>{title}</h2>
          </div>
          <IconButton label="Bağla" onClick={onClose} size="sm"><X size={18} /></IconButton>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
