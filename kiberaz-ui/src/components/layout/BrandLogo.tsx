import { Shield } from 'lucide-react';
import './layout.css';

// ─── Brend işarəsi ────────────────────────────────────────────
// KIBERAZ.AZ — ".AZ" brend qırmızısı ilə; altında mono şriftli qısa izah.
interface Props {
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  compact?: boolean;
  className?: string;
}

export default function BrandLogo({ href = '#about', onClick, compact, className }: Props) {
  return (
    <a href={href} onClick={onClick} className={`brand${compact ? ' brand--compact' : ''}${className ? ` ${className}` : ''}`} aria-label="Kiberaz.az — Ana səhifə">
      <span className="brand__mark" aria-hidden="true"><Shield size={16} strokeWidth={2.4} /></span>
      <span className="brand__text">
        <span className="brand__name">KIBERAZ<span className="brand__tld">.AZ</span></span>
        {!compact && <span className="brand__tagline">// TƏHSİL PLATFORMASI</span>}
      </span>
    </a>
  );
}
