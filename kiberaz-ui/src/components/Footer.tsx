import { useState } from 'react';
import { Shield, Mail, Phone, MapPin, Send } from 'lucide-react';
import './Footer.css';

const footerLinks = {
  platform: [
    { label: 'Təlimlər', href: '#courses' },
    { label: 'Biliklər Bazası', href: '#knowledge' },
    { label: 'İmtahan Sessiyaları', href: '#exam-session' },
    { label: 'Liderlik Lövhəsi', href: '#leaderboard' },
  ],
  resources: [
    { label: 'Blog & Məqalələr', href: '#' },
    { label: 'CTF Tapşırıqları', href: '#' },
    { label: 'Alətlər', href: '#' },
    { label: 'Laboratoriyalar', href: '#' },
    { label: 'Video Dərslər', href: '#' },
  ],
};

const socialLinks = [
  { icon: '𝕏', label: 'X (Twitter)', href: '#', ariaLabel: 'X (Twitter) profilimiz' },
  { icon: '📘', label: 'Facebook', href: '#', ariaLabel: 'Facebook səhifəmiz' },
  { icon: '📸', label: 'Instagram', href: '#', ariaLabel: 'Instagram profilimiz' },
  { icon: '💬', label: 'Telegram', href: '#', ariaLabel: 'Telegram kanalımız' },
  { icon: '💼', label: 'LinkedIn', href: '#', ariaLabel: 'LinkedIn profilimiz' },
  { icon: '🐙', label: 'GitHub', href: '#', ariaLabel: 'GitHub profilimiz' },
];

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // TODO: Backend — POST /api/newsletter/subscribe { email }
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" aria-label="Sayt altlığı">
      {/* ── Main Footer ── */}
      <div className="footer-main">
        {/* Brand Column */}
        <div className="footer-brand">
          <a href="#home" className="footer-logo" aria-label="Kiberaz.az Ana Səhifəsi">
            <div className="footer-logo-icon" aria-hidden="true">
              <Shield color="white" size={22} strokeWidth={2.5} />
            </div>
            <div className="footer-logo-text">
              <span style={{ color: 'white' }}>Kiber</span>
              <span style={{
                background: 'var(--gradient-brand)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>az.az</span>
            </div>
          </a>

          <p className="footer-tagline">
            Azərbaycanda aparıcı kibertəhlükəsizlik təhsil platforması.
            Təlimlərdən praktik imtahanlara qədər öyrənmə yolunda sizinlə.
          </p>

          {/* Socials */}
          <div className="footer-socials" aria-label="Sosial media bağlantıları">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                className="footer-social-btn"
                aria-label={social.ariaLabel}
                title={social.label}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span aria-hidden="true">{social.icon}</span>
              </a>
            ))}
          </div>

          {/* Contact Info */}
          <div className="footer-contact" aria-label="Əlaqə məlumatları">
            <div className="footer-contact-item">
              <Mail size={14} className="footer-contact-icon" aria-hidden="true" />
              <span>info@kiberaz.az</span>
            </div>
            <div className="footer-contact-item">
              <Phone size={14} className="footer-contact-icon" aria-hidden="true" />
              <span>+994 XX XXX XX XX</span>
            </div>
            <div className="footer-contact-item">
              <MapPin size={14} className="footer-contact-icon" aria-hidden="true" />
              <span>Bakı, Azərbaycan</span>
            </div>
          </div>
        </div>

        {/* Platform Links */}
        <div className="footer-col">
          <div className="footer-col-title">Platform</div>
          <nav className="footer-links" aria-label="Platforma bağlantıları">
            {footerLinks.platform.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="footer-link"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Resource Links */}
        <div className="footer-col">
          <div className="footer-col-title">Resurslar</div>
          <nav className="footer-links" aria-label="Resurs bağlantıları">
            {footerLinks.resources.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="footer-link"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Newsletter */}
        <div className="footer-col">
          <div className="footer-col-title">Xəbərdarlıq</div>
          <div className="footer-newsletter">
            <p className="footer-newsletter-label">
              Yeni təlimlər, tədbir xəbərləri və müsahibə ipuçları üçün abunə olun.
            </p>
            <form
              id="footer-newsletter-form"
              className="footer-newsletter-form"
              onSubmit={handleSubscribe}
              noValidate
            >
              <input
                id="footer-newsletter-email"
                className="footer-newsletter-input"
                type="email"
                placeholder="E-poçt ünvanınız"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Xəbər bülletenə abunəlik üçün e-poçt"
                required
              />
              <button
                id="footer-subscribe-btn"
                type="submit"
                className="footer-newsletter-btn"
                aria-label="Abunə ol"
              >
                {subscribed ? '✓' : <Send size={14} />}
              </button>
            </form>
            {subscribed && (
              <p
                style={{ fontSize: 'var(--text-xs)', color: '#22c55e' }}
                role="alert"
                aria-live="polite"
              >
                ✓ Uğurla abunə oldunuz!
              </p>
            )}
          </div>

          {/* Trust badges */}
          <div style={{ marginTop: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div className="footer-col-title" style={{ marginBottom: 'var(--space-2)' }}>Güvən</div>
            {[
              { icon: '🔒', text: 'Şifrələnmiş Məlumat' },
              { icon: '✅', text: 'Yoxlanılmış Məzmun' },
              { icon: '🌍', text: 'Azərbaycan Bazarlı' },
            ].map((item) => (
              <div
                key={item.text}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  fontSize: 'var(--text-xs)', color: 'var(--neutral-500)',
                }}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="footer-bottom">
        <p className="footer-copyright">
          © {currentYear} Kiberaz.az — Bütün hüquqlar qorunur.
        </p>
        <nav className="footer-bottom-links" aria-label="Hüquqi bağlantılar">
          <a href="#" className="footer-bottom-link">Məxfilik Siyasəti</a>
          <a href="#" className="footer-bottom-link">İstifadə Şərtləri</a>
          <a href="#" className="footer-bottom-link">Çərəz Siyasəti</a>
          <a href="#" className="footer-bottom-link">Əlaqə</a>
        </nav>
      </div>
    </footer>
  );
}
