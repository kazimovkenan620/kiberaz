import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

// ─── Təsdiq pəncərəsi ─────────────────────────────────────────
// Dağıdıcı / geri qaytarıla bilməyən əməliyyatlar üçün. `confirmLabel` konkret
// felə görə yazılır ("Bəli, sil"), "OK" deyil. Əməliyyat gedərkən pəncərə bağlanmır.
interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, children, confirmLabel, cancelLabel = 'Ləğv et', tone = 'danger', busy, icon, onConfirm, onCancel,
}: Props) {
  const close = () => { if (!busy) onCancel(); };
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      role="alertdialog"
      closeOnEscape={!busy}
      footer={
        <div className="modal__actions">
          <Button variant="outline" onClick={close} disabled={busy}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy} autoFocus>
            {icon ?? <AlertTriangle size={15} />} {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="confirm__body">{children}</div>
    </Modal>
  );
}
