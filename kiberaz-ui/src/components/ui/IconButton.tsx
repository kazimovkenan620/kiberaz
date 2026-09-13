import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonClass, type ButtonSize, type ButtonVariant } from '../../utils/buttonClass';

// ─── Yalnız ikonlu düymə ─────────────────────────────────────
// `label` məcburidir: ekran oxuyucu üçün adı verir və tooltip kimi görünür.
interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'aria-label' | 'title'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

export default function IconButton({ label, variant = 'ghost', size = 'md', className, children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, iconOnly: true, className })}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}
