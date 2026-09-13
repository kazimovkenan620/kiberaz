import type { ReactNode } from 'react';

// ─── Forma sahəsi: görünən etiket + nəzarət + ipucu/xəta ──────
// Etiket həmişə görünür (placeholder tək başına etiket deyil).
// Xəta sahənin bilavasitə altında göstərilir və `aria-describedby` ilə bağlanır —
// bunun üçün uşaq nəzarətə `id={fieldId}` və `aria-describedby={describedBy}` ötürün.
interface Props {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  error?: string;
  ok?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export default function FormField({ id, label, icon, hint, error, ok, required, className, children }: Props) {
  return (
    <div className={`field${required ? ' field--required' : ''}${className ? ` ${className}` : ''}`}>
      <label className="field__label" htmlFor={id}>{icon}{label}</label>
      {children}
      {error && <span id={`${id}-error`} className="field__error" role="alert">{error}</span>}
      {!error && ok && <span className="field__ok">{ok}</span>}
      {hint && <span id={`${id}-hint`} className="field__hint">{hint}</span>}
    </div>
  );
}
