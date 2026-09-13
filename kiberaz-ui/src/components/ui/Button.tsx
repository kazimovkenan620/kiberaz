import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonClass, type ButtonSize, type ButtonVariant } from '../../utils/buttonClass';

export type { ButtonSize, ButtonVariant };

// ─── Düymə primitivi ──────────────────────────────────────────
// Variantlar: primary / secondary / outline / ghost / danger / success.
// Ölçülər: sm / md / lg. `loading` düyməni bloklayır və spinner göstərir.
// Dağıdıcı əməliyyatlar `danger` variantı ilə YANAŞI ikon + mətn + təsdiq pəncərəsi
// tələb edir — rəng tək başına fərqləndirici deyil.

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  className?: string;
  children?: ReactNode;
}

type ButtonProps = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export default function Button({
  variant, size, block, loading, iconOnly, className, children, type = 'button', disabled, ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, loading, iconOnly, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = BaseProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>;

// Eyni görünüşlü link (xarici keçidlər, PDF yükləmə və s.)
export function ButtonLink({ variant, size, block, iconOnly, className, children, ...rest }: ButtonLinkProps) {
  return (
    <a className={buttonClass({ variant, size, block, iconOnly, className })} {...rest}>
      {children}
    </a>
  );
}
