import { Mail, MapPin } from 'lucide-react';
import { navLinks } from '../data/mockData';
import BrandLogo from './layout/BrandLogo';
import './Footer.css';

// ─── Sayt altlığı ─────────────────────────────────────────────
// Yalnız real naviqasiya və əlaqə məlumatı. Backend-i olmayan "abunəlik" forması
// və hədəfi olmayan resurs linkləri saxlanılmır — istifadəçini aldatmasın.
const legalLinks = [
  { label: 'Məxfilik Siyasəti', href: '#' },
  { label: 'İstifadə Şərtləri', href: '#' },
  { label: 'Çərəz Siyasəti', href: '#' },
];

export default function Footer({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" aria-label="Sayt altlığı">
      <div className="footer__inner">
        <div className="footer__brand">
          <BrandLogo onClick={e => { if (onNavigate) { e.preventDefault(); onNavigate('#about'); } }} />
          <p className="footer__tagline">
            Azərbaycanda kibertəhlükəsizlik təhsil platforması — təlimlərdən praktik imtahanlara qədər öyrənmə yolunda sizinlə.
          </p>
          <div className="footer__contact" aria-label="Əlaqə məlumatları">
            <span><Mail size={14} aria-hidden="true" /> info@kiberaz.az</span>
            <span><MapPin size={14} aria-hidden="true" /> Bakı, Azərbaycan</span>
          </div>
        </div>

        <nav className="footer__col" aria-label="Platforma bağlantıları">
          <div className="footer__col-title">Platforma</div>
          {navLinks.map(link => (
            <a key={link.href} href={link.href} className="footer__link"
              onClick={e => { if (onNavigate) { e.preventDefault(); onNavigate(link.href); } }}>
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="footer__col" aria-label="Hüquqi bağlantılar">
          <div className="footer__col-title">Hüquqi</div>
          {legalLinks.map(link => (
            <a key={link.label} href={link.href} className="footer__link">{link.label}</a>
          ))}
        </nav>
      </div>

      <div className="footer__bottom">
        <p className="footer__copy">© {currentYear} Kiberaz.az — Bütün hüquqlar qorunur.</p>
        <p className="footer__motto">Öyrən · Tətbiq et · Paylaş · İnkişaf et</p>
      </div>
    </footer>
  );
}
