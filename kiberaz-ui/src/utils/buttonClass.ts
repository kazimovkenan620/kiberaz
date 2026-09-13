// ─── Düymə sinif adları ───────────────────────────────────────
// Button, ButtonLink və IconButton eyni sinif quruluşunu paylaşır.
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  className?: string;
}

export function buttonClass({ variant = 'secondary', size = 'md', block, loading, iconOnly, className }: ButtonClassOptions): string {
  return [
    'btn',
    `btn--${variant}`,
    size !== 'md' ? `btn--${size}` : '',
    block ? 'btn--block' : '',
    iconOnly ? 'btn--icon' : '',
    loading ? 'is-loading' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
}
