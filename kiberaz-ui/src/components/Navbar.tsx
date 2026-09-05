import { useState, useEffect, useCallback } from 'react';
import { Shield, X, Eye, EyeOff, User, Mail, Lock, Users, LogOut } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { navLinks } from '../data/mockData';
import { forgotPassword, getAuthBaseUrl, getPrimaryRoleLabel, getStoredUserNickname, getToken, loginUser, registerUser, logout, resendConfirmationEmail, setStoredUserNickname, setStoredUserRoles, setTokens } from '../services/authService';
import './Navbar.css';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;

function getInitialNavbarUser(): { nickname: string } | null {
  const token = getToken();
  const nickname = getStoredUserNickname();
  return token && nickname ? { nickname } : null;
}

// ── Qeydiyyat Modal ───────────────────────────────────────────
function RegisterModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    nickname: '', role: 'User', gender: '', password: '', confirmPassword: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Ad tələb olunur';
    if (!form.lastName.trim()) e.lastName = 'Soyad tələb olunur';
    if (!form.email.includes('@')) e.email = 'Düzgün e-poçt daxil edin';
    if (!form.nickname.trim()) e.nickname = 'Nickname tələb olunur';
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(form.nickname.trim())) e.nickname = '3-16 simvol: hərf, rəqəm, _';
    if (!form.role) e.role = 'Rol seçin';
    if (!form.gender) e.gender = 'Cins seçin';
    if (form.password.length < 8) e.password = 'Minimum 8 simvol';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Şifrələr uyğun deyil';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!captchaToken) { setApiError('Zəhmət olmasa CAPTCHA-nı tamamlayın.'); return; }

    try {
      const response = await registerUser({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        nickname: form.nickname.trim(),
        role: form.role,
        gender: form.gender === 'male' ? 1 : 2,
        password: form.password,
        confirmPassword: form.confirmPassword,
        captchaToken,
      });

      if (response.success) {
        setSubmitted(true);
      } else {
        // Backenddən gələn xətaları göstər
        setApiError(response.message || response.errors?.[0] || 'Qeydiyyat uğursuz oldu.');
      }
    } catch {
      setApiError('Serverlə əlaqə yaradıla bilmədi.');
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reg-title">
      <div className="modal-panel reg-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-kicker"><span className="kicker-pulse" /> KIBERAZ.AZ</div>
            <h2 className="modal-title" id="reg-title">Qeydiyyat</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Bağla"><X size={18} /></button>
        </div>

        {submitted ? (
          <div className="modal-success">
            <div className="success-icon">✓</div>
            <h3>Xoş gəldiniz!</h3>
            <p>Qeydiyyat uğurla tamamlandı. E-poçtunuza təsdiq məktubu göndərildi.</p>
            <button className="reg-btn-primary" onClick={onClose}>Bağla</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit} noValidate>

            {/* Gmail ilə qeydiyyat */}
            <button
              type="button"
              className="reg-google-btn"
              onClick={() => {
                window.location.href = `${getAuthBaseUrl()}/auth/google`;
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.4 37.5 16.1 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l6.2 5.2C41.3 35.1 44 30 44 24c0-1.3-.1-2.7-.4-3.9z" />
              </svg>
              Gmail ilə Qeydiyyat
            </button>

            {/* Bölücü */}
            <div className="reg-divider">
              <span /><span>və ya e-poçt ilə</span><span />
            </div>

            {apiError && <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px', textAlign: 'center', marginBottom: '10px', fontSize: '0.9rem' }}>{apiError}</div>}

            {/* Ad & Soyad */}
            <div className="form-grid-2">
              <div className="form-field">
                <label htmlFor="reg-first">
                  <User size={12} /> Ad *
                </label>
                <input
                  id="reg-first"
                  type="text"
                  placeholder="Adınız"
                  value={form.firstName}
                  onChange={e => set('firstName', e.target.value)}
                  className={errors.firstName ? 'input-error' : ''}
                />
                {errors.firstName && <span className="field-error">{errors.firstName}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="reg-last">
                  <User size={12} /> Soyad *
                </label>
                <input
                  id="reg-last"
                  type="text"
                  placeholder="Soyadınız"
                  value={form.lastName}
                  onChange={e => set('lastName', e.target.value)}
                  className={errors.lastName ? 'input-error' : ''}
                />
                {errors.lastName && <span className="field-error">{errors.lastName}</span>}
              </div>
            </div>

            {/* E-poçt */}
            <div className="form-field">
              <label htmlFor="reg-email">
                <Mail size={12} /> E-poçt *
              </label>
              <input
                id="reg-email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className={errors.email ? 'input-error' : ''}
                autoComplete="email"
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="reg-nickname">
                <User size={12} /> Nickname *
              </label>
              <input
                id="reg-nickname"
                type="text"
                placeholder="MrK4z1m0v"
                value={form.nickname}
                onChange={e => {
                  set('nickname', e.target.value);
                  setErrors(p => ({ ...p, nickname: '' }));
                }}
                className={errors.nickname ? 'input-error' : ''}
                autoComplete="nickname"
              />
              {errors.nickname && <span className="field-error">{errors.nickname}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="reg-role">
                <Shield size={12} /> Rol *
              </label>
              <div className="reg-gender-row">
                {[
                  ['İstifadəçi', 'User'],
                  ['Müəllim', 'Teacher'],
                ].map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    className={`reg-gender-btn ${form.role === value ? 'active' : ''}`}
                    onClick={() => {
                      set('role', value);
                      setErrors(p => ({ ...p, role: '' }));
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {errors.role && <span className="field-error">{errors.role}</span>}
            </div>

            {/* Cins */}
            <div className="form-field">
              <label htmlFor="reg-gender">
                <Users size={12} /> Cins *
              </label>
              <div className="reg-gender-row">
                {[['Kişi', 'male'], ['Qadın', 'female']].map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    className={`reg-gender-btn ${form.gender === value ? 'active' : ''}`}
                    onClick={() => { set('gender', value); setErrors(p => ({ ...p, gender: '' })); }}
                  >
                    {value === 'male' ? '♂' : '♀'} {label}
                  </button>
                ))}
              </div>
              {errors.gender && <span className="field-error">{errors.gender}</span>}
            </div>

            {/* Şifrə */}
            <div className="form-field">
              <label htmlFor="reg-pass">
                <Lock size={12} /> Şifrə *
              </label>
              <div className="reg-pass-wrap">
                <input
                  id="reg-pass"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Minimum 8 simvol"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  className={errors.password ? 'input-error' : ''}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="reg-eye-btn"
                  onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? 'Şifrəni gizlət' : 'Şifrəni göstər'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Şifrə gücü */}
              {form.password.length > 0 && (
                <>
                  <div className="reg-strength">
                    <div className="reg-strength-bar">
                      <div
                        className="reg-strength-fill"
                        style={{
                          width: form.password.length >= 12 ? '100%' : form.password.length >= 8 ? '60%' : '30%',
                          background: form.password.length >= 12 ? '#00e5a0' : form.password.length >= 8 ? '#f5a623' : '#ef4444',
                        }}
                      />
                    </div>
                    <span>{form.password.length >= 12 ? 'Güclü' : form.password.length >= 8 ? 'Orta' : 'Zəif'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'left' }}>
                    * Şifrədə ən azı 1 böyük hərf və 1 rəqəm olmalıdır.
                  </div>
                </>
              )}
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            {/* Şifrə təkrarı */}
            <div className="form-field">
              <label htmlFor="reg-confirm">
                <Lock size={12} /> Şifrə Təkrarı *
              </label>
              <div className="reg-pass-wrap">
                <input
                  id="reg-confirm"
                  type={showConf ? 'text' : 'password'}
                  placeholder="Şifrəni təkrar daxil edin"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  className={errors.confirmPassword ? 'input-error' : ''}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="reg-eye-btn"
                  onClick={() => setShowConf(p => !p)}
                  aria-label={showConf ? 'Gizlət' : 'Göstər'}
                >
                  {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.confirmPassword.length > 0 && form.password === form.confirmPassword && (
                <span className="field-ok">✓ Şifrələr uyğundur</span>
              )}
              {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setCaptchaToken}
                onExpire={() => setCaptchaToken('')}
                onError={() => setCaptchaToken('')}
                options={{ theme: 'dark', language: 'az' }}
              />
            </div>

            <div className="modal-footer">
              <p className="modal-note">Qeydiyyatla <a href="#">İstifadə Şərtlərini</a> qəbul etmiş olursunuz.</p>
              <div className="modal-footer-actions">
                <button type="button" className="reg-btn-outline" onClick={onClose}>Ləğv et</button>
                <button type="submit" className="reg-btn-primary" disabled={!captchaToken}>Qeydiyyatdan keç</button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────
function ForgotPasswordModal({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
  const [forgotEmail, setForgotEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) { setError('Zəhmət olmasa CAPTCHA-nı tamamlayın.'); return; }
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await forgotPassword(forgotEmail, captchaToken);
      if (res.success) setMessage(res.message || 'Şifrə yeniləmə linki e-poçtunuza göndərildi.');
      else setError(res.errors?.[0] || res.message || 'Sorğu tamamlanmadı.');
    } catch {
      setError('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2 className="modal-title">Şifrəni yenilə</h2>
          <button className="modal-close" onClick={onClose} aria-label="Bağla"><X size={18} /></button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="forgot-email"><Mail size={12} /> E-poçt</label>
            <input id="forgot-email" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="email@example.com" autoComplete="email" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
            <Turnstile
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={setCaptchaToken}
              onExpire={() => setCaptchaToken('')}
              onError={() => setCaptchaToken('')}
              options={{ theme: 'dark', language: 'az' }}
            />
          </div>
          {message && <p style={{ color: '#22c55e', textAlign: 'center' }}>{message}</p>}
          {error && <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>}
          <button className="reg-btn-primary" type="submit" disabled={loading || !captchaToken}>
            {loading ? 'Göndərilir...' : 'Link göndər'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Navbar({ onLoginDemo, onLogout, onGoDashboard, onGoHome, isLoggedIn }: {
  onLoginDemo?: () => void;
  onLogout?: () => void;
  onGoDashboard?: () => void;
  onGoHome?: () => void;
  isLoggedIn?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeLink, setActiveLink] = useState('#about');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const [user, setUser] = useState<{ nickname: string } | null>(getInitialNavbarUser);

  // Rol nişanı ləqəbin yanında göstərilir. Ayrıca "Admin" düyməsi yoxdur —
  // admin bölmələri Kabinetim içindədir və orada rol ilə açılır.
  const [roleLabel, setRoleLabel] = useState<string>(() => getPrimaryRoleLabel());

  const [loginError, setLoginError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [loginNeedsCaptcha, setLoginNeedsCaptcha] = useState(false);

  const handleScroll = useCallback(() => setScrolled(window.scrollY > 20), []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 820) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = (mobileOpen || registerOpen || forgotOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen, registerOpen, forgotOpen]);

  const handleNavClick = (href: string) => {
    setActiveLink(href);
    setMobileOpen(false);
    if (href === '#about') {
      onGoHome?.();
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setResendMessage('');
    if (loginNeedsCaptcha && !loginCaptchaToken) {
      setLoginError('Zəhmət olmasa CAPTCHA-nı tamamlayın.');
      return;
    }
    try {
      const response = await loginUser({
        email,
        password,
        captchaToken: loginCaptchaToken || undefined,
      });
      if (response.success && response.data) {
        const u = response.data.user;
        setTokens(response.data.accessToken);
        setStoredUserNickname(u.nickname);
        setStoredUserRoles(u.roles);
        setUser({ nickname: u.nickname });
        setRoleLabel(getPrimaryRoleLabel());
        setLoginNeedsCaptcha(false);
        setLoginCaptchaToken('');
        onLoginDemo?.();
      } else {
        if (response.captchaRequired) setLoginNeedsCaptcha(true);
        setLoginError(response.message || response.errors?.[0] || 'Giriş uğursuz oldu');
      }
    } catch {
      setLoginError('Serverlə əlaqə yaradıla bilmədi');
    }
  };

  const canResendConfirmation = loginError.toLowerCase().includes('aktiv') && email.includes('@');

  const handleResendConfirmation = async () => {
    if (!email.includes('@')) return;

    setResending(true);
    setResendMessage('');
    try {
      const response = await resendConfirmationEmail(email);
      setResendMessage(response.message || 'Təsdiq linki e-poçtunuza göndərildi.');
    } catch {
      setResendMessage('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setRoleLabel('');
    onLogout?.();
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} role="navigation" aria-label="Əsas naviqasiya">
        <div className="navbar-inner">

          {/* Logo */}
          <a
            href="#about"
            className="navbar-logo"
            onClick={(e) => {
              e.preventDefault();
              onGoHome?.();
              setActiveLink('#about');
              setMobileOpen(false);
              setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
            }}
            aria-label="Kiberaz.az — Ana səhifə"
          >
            <div className="logo-icon" aria-hidden="true">
              <Shield size={20} color="var(--brand-primary)" strokeWidth={2} />
            </div>
            <div className="logo-wordmark">
              <div className="logo-name">Kiber<span>az.az</span></div>
              <div className="logo-tagline">// TƏLİM PLATFORMASI</div>
            </div>
          </a>

          {/* Desktop nav */}
          <ul className="navbar-nav" aria-label="Bölmələr">
            {navLinks.map(link => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`nav-link ${activeLink === link.href ? 'active' : ''}`}
                  onClick={() => handleNavClick(link.href)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop auth */}
          <div className="navbar-auth">

            {(user || isLoggedIn) ? (
              <div className="navbar-user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={onGoDashboard}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <User size={15} /> Kabinetim
                </button>
                <span style={{ color: 'var(--text-light)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--brand-primary)' }}>{user?.nickname}</span>
                  {roleLabel && <span className="navbar-role-badge">{roleLabel}</span>}
                </span>
                <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <LogOut size={16} /> Çıxış
                </button>
              </div>
            ) : (
              <>
                <form className="navbar-auth-inputs" onSubmit={handleLogin} style={{ position: 'relative' }} noValidate>
                  <input
                    id="navbar-email" type="email" className="navbar-input"
                    placeholder="E-poçt" value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email" aria-label="E-poçt"
                  />
                  <input
                    id="navbar-password" type="password" className="navbar-input"
                    placeholder="Şifrə" value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" aria-label="Şifrə"
                  />
                  {loginNeedsCaptcha && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                      <Turnstile
                        siteKey={TURNSTILE_SITE_KEY}
                        onSuccess={setLoginCaptchaToken}
                        onExpire={() => setLoginCaptchaToken('')}
                        onError={() => setLoginCaptchaToken('')}
                        options={{ theme: 'dark', language: 'az', size: 'compact' }}
                      />
                    </div>
                  )}
                  <button
                    id="navbar-login-btn"
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={loginNeedsCaptcha && !loginCaptchaToken}
                  >
                    Daxil ol
                  </button>
                  {loginError && (
                    <span style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, color: '#ef4444', fontSize: '0.75rem', minWidth: '260px' }}>
                      {loginError}
                      {canResendConfirmation && (
                        <button
                          type="button"
                          onClick={handleResendConfirmation}
                          disabled={resending}
                          style={{ marginLeft: 8, color: 'var(--brand-primary)', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          {resending ? 'Göndərilir...' : 'Linki yenidən göndər'}
                        </button>
                      )}
                      {resendMessage && <span style={{ display: 'block', color: '#22c55e', marginTop: 4 }}>{resendMessage}</span>}
                    </span>
                  )}
                </form>
                <button
                  id="navbar-register-btn"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setRegisterOpen(true)}
                >
                  Qeydiyyat
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setForgotOpen(true)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Şifrəni unutdum
                </button>
              </>
            )}

            {/* Hamburger */}
            <button
              id="navbar-hamburger"
              className={`navbar-toggle ${mobileOpen ? 'open' : ''}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Menyunu bağla' : 'Menyunu aç'}
            >
              <span className="toggle-bar" />
              <span className="toggle-bar" />
              <span className="toggle-bar" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!mobileOpen} aria-label="Mobil menyu">
        {navLinks.map(link => (
          <a key={link.href} href={link.href} className="mobile-nav-link"
            onClick={() => handleNavClick(link.href)} tabIndex={mobileOpen ? 0 : -1}>
            {link.label}
          </a>
        ))}
        <div className="mobile-auth">
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-2) 0' }}>
              <span style={{ color: 'var(--text-light)', fontWeight: 500, textAlign: 'center' }}>
                Xoş gəldin, <span style={{ color: 'var(--brand-primary)' }}>{user.nickname}</span>
              </span>
              <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <LogOut size={18} /> Çıxış
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <input id="mob-email" type="email" className="mobile-auth-input"
                placeholder="E-poçt" value={email}
                onChange={e => setEmail(e.target.value)} tabIndex={mobileOpen ? 0 : -1} />
              <input id="mob-password" type="password" className="mobile-auth-input"
                placeholder="Şifrə" value={password}
                onChange={e => setPassword(e.target.value)} tabIndex={mobileOpen ? 0 : -1} />
              {loginError && (
                <span style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>
                  {loginError}
                  {canResendConfirmation && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resending}
                      style={{ display: 'block', margin: '6px auto 0', color: 'var(--brand-primary)', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                    >
                      {resending ? 'Göndərilir...' : 'Linki yenidən göndər'}
                    </button>
                  )}
                  {resendMessage && <span style={{ display: 'block', color: '#22c55e', marginTop: 4 }}>{resendMessage}</span>}
                </span>
              )}
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <button id="mob-login" type="submit" className="btn btn-primary" style={{ flex: 1 }} tabIndex={mobileOpen ? 0 : -1}>
                  Daxil ol
                </button>
                <button id="mob-register" type="button" className="btn btn-secondary" style={{ flex: 1 }}
                  tabIndex={mobileOpen ? 0 : -1}
                  onClick={() => { setMobileOpen(false); setRegisterOpen(true); }}>
                  Qeydiyyat
                </button>
              </div>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 0, padding: 0, fontSize: '0.85rem' }}
              >
                Şifrəni unutdum
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Backdrop (mobile) */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 'calc(var(--z-navbar) - 2)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Qeydiyyat Modal */}
      {registerOpen && <RegisterModal onClose={() => setRegisterOpen(false)} />}
      {forgotOpen && <ForgotPasswordModal initialEmail={email} onClose={() => setForgotOpen(false)} />}
    </>
  );
}
