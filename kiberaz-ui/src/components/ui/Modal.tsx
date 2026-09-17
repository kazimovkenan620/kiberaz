import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
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

type FocusScope = { panel: HTMLDivElement; returnTargets: HTMLElement[] };
const modalStack: FocusScope[] = [];
let previousBodyOverflow = '';

function isVisible(element: HTMLElement): boolean {
  return element.isConnected && element.getClientRects().length > 0
    && !element.matches(':disabled') && !element.closest('[inert], [aria-hidden="true"]');
}

export default function Modal(props: Props) {
  // Açıq hissə ayrıca mount olunur: ilkin fokus autoFocus commit-indən əvvəl tutulur.
  return props.open ? <OpenModal {...props} /> : null;
}

function OpenModal({
  onClose, title, kicker, size = 'md', role = 'dialog',
  closeOnBackdrop = false, closeOnEscape = true, footer, children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [returnTargets] = useState(() => {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Auth pəncərələri bir-birini əvəz edəndə silinmiş elementin əvəzinə ilkin açan düymə seçilir.
    return [...(focused && focused !== document.body ? [focused] : []), ...modalStack.flatMap(scope => scope.returnTargets).reverse()];
  });

  // Effekt yalnız açılışda işləyir; onClose/closeOnEscape hər renderdə
  // dəyişə bilər (inline funksiyalar), ona görə ref-də saxlanılır — əks halda
  // valideynin hər renderi (məs. imtahan taymeri) fokusu yenidən qoyurdu.
  const latest = useRef({ onClose, closeOnEscape });
  useEffect(() => { latest.current = { onClose, closeOnEscape }; });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const scope: FocusScope = { panel, returnTargets };
    if (modalStack.length === 0) previousBodyOverflow = document.body.style.overflow;
    modalStack.push(scope);
    document.body.style.overflow = 'hidden';

    // İlk fokus: React `autoFocus` commit zamanı fokusu artıq qoyubsa, o saxlanılır;
    // yoxsa bağlama düyməsindən sonrakı ilk fokuslana bilən element, o da yoxdursa panel.
    if (!panel.contains(document.activeElement)) {
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
      const first = nodes.find(n => !n.closest('.modal__head')) ?? nodes[0];
      (first ?? panel).focus();
    }

    const onKey = (e: KeyboardEvent) => {
      if (modalStack.at(-1) !== scope) return;
      if (e.key === 'Escape') {
        if (latest.current.closeOnEscape) { e.preventDefault(); e.stopPropagation(); latest.current.onClose(); }
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
      if (nodes.length === 0) { e.preventDefault(); panel.focus(); return; }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === firstNode || document.activeElement === panel || !panel.contains(document.activeElement))) { e.preventDefault(); lastNode.focus(); }
      else if (!e.shiftKey && (document.activeElement === lastNode || !panel.contains(document.activeElement))) { e.preventDefault(); firstNode.focus(); }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(scope), 1);
      if (modalStack.length === 0) document.body.style.overflow = previousBodyOverflow;
      const activePanel = modalStack.at(-1)?.panel;
      // Yeni açılmış pəncərənin autoFocus-u əvvəlki pəncərənin cleanup-ı ilə pozulmur.
      if (activePanel?.contains(document.activeElement)) return;
      const target = returnTargets.find(element => isVisible(element) && (!activePanel || activePanel.contains(element)))
        ?? Array.from((activePanel ?? document).querySelectorAll<HTMLElement>(FOCUSABLE)).find(isVisible)
        ?? activePanel;
      target?.focus();
    };
  }, [returnTargets]);

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
