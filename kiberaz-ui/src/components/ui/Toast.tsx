import { useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

// ─── Toast bildirişi ──────────────────────────────────────────
// Qısa əməliyyat nəticələri üçün (admin təsdiqləmə, blok və s.). 3 saniyəyə bağlanır.
export default function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`toast toast--${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live="polite">
      {type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      <span>{message}</span>
    </div>
  );
}
