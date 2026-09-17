import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { navLinks } from '../data/mockData';
import { getPrimaryRoleLabel, getStoredUserNickname, getToken, logoutOnServer, setStoredUserNickname, setStoredUserRoles, setTokens } from '../services/authService';
import { onAuthRequest, type AuthRequestKind } from '../utils/authUi';
import { Button, IconButton, ThemeToggle } from './ui';
import BrandLogo from './layout/BrandLogo';
import LoginModal, { type LoggedInUser } from './auth/LoginModal';
import RegisterModal from './auth/RegisterModal';
import ForgotPasswordModal from './auth/ForgotPasswordModal';
import './Navbar.css';

// ─── Tətbiq başlığı (ictimai + kabinet) ──────────────────────
// Giriş, qeydiyyat və şifrə bərpası modal pəncərələrdədir (components/auth).
// Təhlükəsizlik məntiqi dəyişməyib: token yaddaşda (sessionStorage), refresh
// HttpOnly cookie-də; rol nişanı yalnız məlumat xarakterlidir.

function getInitialNavbarUser(): { nickname: string } | null {
  const token = getToken();
  const nickname = getStoredUserNickname();
  return token && nickname ? { nickname } : null;
}

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', teacher: 'Müəllim', user: 'İstifadəçi', moderator: 'Moderator', vip: 'VIP' };
const roleDisplay = (role: string) => ROLE_LABELS[role.toLowerCase()] ?? role;

type AuthModal = 'login' | 'register' | 'forgot' | null;

export default function Navbar({ onLoginDemo, onLogout, onGoDashboard, onGoHome, onNavigate, isLoggedIn, inDashboard, activeHref }: {
  onLoginDemo?: () => void;
  onLogout?: () => void;
  onGoDashboard?: () => void;
  onGoHome?: () => void;
  // Bölmə linki: App kabineti/quiz-i bağlayıb müvafiq bölməyə sürüşdürür.
  onNavigate?: (href: string) => void;
  isLoggedIn?: boolean;
  inDashboard?: boolean;
  // Ana səhifədən kənar ekranlarda (quiz) hansı bölmənin aktiv sayılacağı
  activeHref?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('#about');
  const [authModal, setAuthModal] = useState<AuthModal>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<{ nickname: string } | null>(getInitialNavbarUser);

  // Rol nişanı ləqəbin yanında göstərilir. Ayrıca "Admin" düyməsi yoxdur —
  // admin bölmələri Kabinetim içindədir və orada rol ilə açılır.
  const [roleLabel, setRoleLabel] = useState<string>(() => getPrimaryRoleLabel());

  // Giriş vəziyyəti App-dan gəlir (kabinetdən çıxış, rol keçidi, Google callback).
  // Prop dəyişəndə yerli istifadəçi state-i render zamanı sinxronlaşdırılır —
  // əks halda çıxışdan sonra başlıqda köhnə ləqəb və "Kabinetim" menyusu qalırdı.
  const [prevLoggedIn, setPrevLoggedIn] = useState(isLoggedIn);
  if (prevLoggedIn !== isLoggedIn) {
    setPrevLoggedIn(isLoggedIn);
    setUser(isLoggedIn ? getInitialNavbarUser() : null);
    setRoleLabel(isLoggedIn ? getPrimaryRoleLabel() : '');
  }

  // CAPTCHA tələbi server "captchaRequired" dedikdən sonra modal bağlanıb açılsa da qalır.
  const [loginNeedsCaptcha, setLoginNeedsCaptcha] = useState(false);

  const handleScroll = useCallback(() => setScrolled(window.scrollY > 8), []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Ana səhifədə hansı bölmənin görünməsinə görə aktiv link (scroll-spy).
  useEffect(() => {
    if (inDashboard || activeHref) return;
    const ids = navLinks.map(l => l.href.slice(1));
    const update = () => {
      const line = window.innerHeight * 0.35;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActiveLink(`#${current}`);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, [inDashboard, activeHref]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 1024) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Dərin komponentlərdən (quiz auth qapısı, imtahan) gələn "giriş pəncərəsini aç" siqnalı.
  useEffect(() => onAuthRequest((kind: AuthRequestKind) => { setMobileOpen(false); setAuthModal(kind); }), []);

  // İstifadəçi menyusu: kənara klik və Escape ilə bağlanır.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setActiveLink(href);
    setMobileOpen(false);
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
      return;
    }
    if (href === '#about') {
      onGoHome?.();
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setActiveLink('#about');
    setMobileOpen(false);
    if (onNavigate) { onNavigate('#about'); return; }
    onGoHome?.();
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const handleLoggedIn = (u: LoggedInUser, accessToken: string) => {
    setTokens(accessToken);
    setStoredUserNickname(u.nickname);
    setStoredUserRoles(u.roles);
    setUser({ nickname: u.nickname });
    setRoleLabel(getPrimaryRoleLabel());
    setLoginNeedsCaptcha(false);
    setAuthModal(null);
    onLoginDemo?.();
  };

  const handleLogout = () => {
    void logoutOnServer(); // lokal tokenlər dərhal silinir, server sorğusu fonda gedir
    setUser(null);
    setRoleLabel('');
    setMenuOpen(false);
    setMobileOpen(false);
    onLogout?.();
  };

  const loggedIn = Boolean(user || isLoggedIn);
  const currentHref = activeHref ?? activeLink;
  const initials = (user?.nickname ?? 'K').slice(0, 2);

  return (
    <>
      <header className={`header${scrolled ? ' header--scrolled' : ''}`}>
        <div className="header__inner">
          <BrandLogo onClick={handleLogoClick} />

          <nav className="header__nav" aria-label="Əsas naviqasiya">
            <ul>
              {navLinks.map(link => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={`header__link${!inDashboard && currentHref === link.href ? ' is-active' : ''}`}
                    aria-current={!inDashboard && currentHref === link.href ? 'page' : undefined}
                    onClick={e => handleNavClick(e, link.href)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header__actions">
            <ThemeToggle />

            {loggedIn ? (
              <div className="user-menu" ref={menuRef}>
                <button
                  type="button"
                  className="user-menu__trigger"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  id="navbar-user-menu"
                >
                  <span className="avatar avatar--sm avatar--brand" aria-hidden="true">{initials}</span>
                  <span className="user-menu__text">
                    <span className="user-menu__name">{user?.nickname}</span>
                    {roleLabel && <span className="user-menu__role">{roleDisplay(roleLabel)}</span>}
                  </span>
                  <ChevronDown size={14} className="user-menu__chevron" aria-hidden="true" />
                </button>
                {menuOpen && (
                  <div className="user-menu__panel" role="menu" aria-labelledby="navbar-user-menu">
                    <button type="button" role="menuitem" className="user-menu__item" onClick={() => { setMenuOpen(false); onGoDashboard?.(); }}>
                      <LayoutDashboard size={15} /> Kabinetim
                    </button>
                    <button type="button" role="menuitem" className="user-menu__item user-menu__item--danger" onClick={handleLogout}>
                      <LogOut size={15} /> Çıxış
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="header__auth">
                <Button id="navbar-login-btn" variant="primary" size="sm" onClick={() => setAuthModal('login')}>Daxil ol</Button>
                <Button id="navbar-register-btn" variant="outline" size="sm" onClick={() => setAuthModal('register')}>Qeydiyyat</Button>
              </div>
            )}

            <IconButton
              id="navbar-hamburger"
              label={mobileOpen ? 'Menyunu bağla' : 'Menyunu aç'}
              className="header__burger"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </IconButton>
          </div>
        </div>
      </header>

      {/* Mobil menyu */}
      {mobileOpen && <div className="drawer-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
      <div id="mobile-menu" className={`mobile-menu${mobileOpen ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!mobileOpen} aria-label="Mobil menyu">
        <nav aria-label="Bölmələr (mobil)">
          {navLinks.map(link => (
            <a key={link.href} href={link.href} className={`mobile-menu__link${!inDashboard && currentHref === link.href ? ' is-active' : ''}`}
              onClick={e => handleNavClick(e, link.href)} tabIndex={mobileOpen ? 0 : -1}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="mobile-menu__auth">
          {loggedIn ? (
            <>
              <div className="mobile-menu__user">
                <span className="avatar avatar--brand" aria-hidden="true">{initials}</span>
                <span className="user-menu__text">
                  <span className="user-menu__name">{user?.nickname}</span>
                  {roleLabel && <span className="user-menu__role">{roleDisplay(roleLabel)}</span>}
                </span>
              </div>
              <Button variant="secondary" block onClick={() => { setMobileOpen(false); onGoDashboard?.(); }} tabIndex={mobileOpen ? 0 : -1}>
                <LayoutDashboard size={16} /> Kabinetim
              </Button>
              <Button variant="outline" block onClick={handleLogout} tabIndex={mobileOpen ? 0 : -1}>
                <LogOut size={16} /> Çıxış
              </Button>
            </>
          ) : (
            <>
              <Button id="mob-login" variant="primary" block onClick={() => { setMobileOpen(false); setAuthModal('login'); }} tabIndex={mobileOpen ? 0 : -1}>Daxil ol</Button>
              <Button id="mob-register" variant="outline" block onClick={() => { setMobileOpen(false); setAuthModal('register'); }} tabIndex={mobileOpen ? 0 : -1}>Qeydiyyat</Button>
            </>
          )}
        </div>
      </div>

      {authModal === 'login' && (
        <LoginModal
          onClose={() => setAuthModal(null)}
          onLoggedIn={handleLoggedIn}
          needsCaptcha={loginNeedsCaptcha}
          onNeedsCaptcha={setLoginNeedsCaptcha}
          onForgot={email => { setForgotEmail(email); setAuthModal('forgot'); }}
          onSwitchToRegister={() => setAuthModal('register')}
        />
      )}
      {authModal === 'register' && (
        <RegisterModal onClose={() => setAuthModal(null)} onSwitchToLogin={() => setAuthModal('login')} />
      )}
      {authModal === 'forgot' && (
        <ForgotPasswordModal initialEmail={forgotEmail} onClose={() => setAuthModal(null)} />
      )}
    </>
  );
}
