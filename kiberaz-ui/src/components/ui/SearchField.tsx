import { Search, X } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

// ─── Axtarış sahəsi ───────────────────────────────────────────
// Görünən etiket yoxdur, ona görə `label` aria-label kimi məcburidir.
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type' | 'value' | 'onChange' | 'aria-label' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function SearchField({ value, onChange, label, size = 'md', className, ...rest }: Props) {
  return (
    <div className={`input-wrap input-wrap--icon${className ? ` ${className}` : ''}`}>
      <span className="input-wrap__icon"><Search size={15} /></span>
      <input
        type="search"
        className={`input${size === 'sm' ? ' input--sm' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        {...rest}
      />
      {value && (
        <button type="button" className="input-wrap__action" onClick={() => onChange('')} aria-label="Axtarışı təmizlə">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
