import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle, ChevronUp, Cookie, Lock } from 'lucide-react';
import Navbar from './components/Navbar';
import HeroSlider from './components/HeroSlider';
import AboutSection from './components/AboutSection';
import KnowledgeCategories from './components/KnowledgeCategories';
import ExamSession from './components/ExamSession';
import Leaderboard from './components/Leaderboard';
import UserDashboard from './components/UserDashboard';
import Footer from './components/Footer';
import QuizView from './components/QuizView';
import BrandLogo from './components/layout/BrandLogo';
import { Button, ButtonLink, FormField, ThemeToggle } from './components/ui';
import { confirmEmail, confirmEmailChange, exchangeGoogleLoginCode, getToken, logout, resetPassword, setStoredUserNickname, setStoredUserRoles, setTokens } from './services/authService';
import './index.css';
import './App.css';


// ─── Scroll To Top Button ────────────────────────────────────
// useCallback ilə handleScroll yenidən yaradılmır; bu, scroll hadisəsinin
// lazımsız yenidən qeydiyyatının qarşısını alır.
function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  const handleScroll = useCallback(() => {
    setVisible(window.scrollY > 600);
  }, []);

  // passive: true — brauzerə scroll hadisəsinin bloklanmayacağını bildirir,
  // buna görə sürüşmə daha hamar olur.
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      id="scroll-to-top-btn"
      className={`scroll-top-btn ${visible ? 'visible' : ''}`}
      onClick={scrollTop}
      aria-label="Yuxarıya qayıt"
      title="Yuxarıya qayıt"
      tabIndex={visible ? 0 : -1}
    >
      <ChevronUp size={20} strokeWidth={2.5} />
    </button>
  );
}

// ─── Cookie Consent ──────────────────────────────────────────
function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show cookie bar after 2 seconds if not accepted
    // localStorage-dən əvvəlki razılıq yoxlanılır; tapılarsa banner heç göstərilmir.
    const accepted = localStorage.getItem('kiberaz-cookie-consent');
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('kiberaz-cookie-consent', 'true');
    setVisible(false);
  };

  const handleDecline = () => {
    setVisible(false);
  };

  return (
    <div
      className={`cookie-bar ${visible ? 'visible' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-label="Çərəz razılığı"
      aria-hidden={!visible}
    >
      <Cookie size={18} className="cookie-bar__icon" aria-hidden="true" />
      <p className="cookie-text">
        Biz sayt təcrübənizi yaxşılaşdırmaq üçün çərəzlərdən istifadə edirik.{' '}
        <a href="#" className="text-link">Məxfilik Siyasəti</a>
      </p>
      <div className="cookie-actions">
        <Button id="cookie-decline-btn" variant="ghost" size="sm" onClick={handleDecline} tabIndex={visible ? 0 : -1}>
          Rədd et
        </Button>
        <Button id="cookie-accept-btn" variant="primary" size="sm" onClick={handleAccept} tabIndex={visible ? 0 : -1}>
          Qəbul et
        </Button>
      </div>
    </div>
  );
}

// ─── Xüsusi (auth) səhifələr üçün ortaq qabıq ────────────────
// Reset / təsdiq / Google callback səhifələri əsas tətbiqdən ayrı, mərkəzləşmiş
// kartda göstərilir; mövzu dəyişdirici burada da var.
function AuthPageShell({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <main className="auth-page" id="main-content">
      <div className="auth-page__top">
        <BrandLogo href="/" onClick={undefined} />
        <ThemeToggle />
      </div>
      <section className="auth-card" aria-labelledby="auth-page-title">
        <div className="kicker">{kicker}</div>
        <h1 id="auth-page-title" className="auth-card__title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

// URL-dəki hash və ya query string-dən userId və token parametrləri oxunur;
// bu parametrlər e-poçt linkindən gəlir, ona görə hər iki format dəstəklənir.
function ResetPasswordPage() {
  const params = new URLSearchParams((window.location.hash || window.location.search).replace(/^[#?]/, ''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await resetPassword({
        userId: params.get('userId') || '',
        token: params.get('token') || '',
        newPassword,
        confirmPassword,
      });
      if (res.success) {
        setMessage(res.message || 'Şifrəniz uğurla yeniləndi. Yönləndirilir...');
        // Təhlükəsizlik qeydi: yönləndirmə hədəfi URL-dən oxunmur, sabit (hardcoded) saxlanılır —
        // əks halda "open redirect" boşluğu yaranardı (məs. ?redirect=https://phishing.com kimi bir parametr qəbul etsək).
        setTimeout(() => { window.location.href = '/'; }, 1800);
      } else {
        setError(res.errors?.[0] || res.message || 'Şifrə yenilənmədi.');
      }
    } catch {
      setError('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setLoading(false);
    }
  };

  const locked = loading || !!message;

  return (
    <AuthPageShell title="Şifrəni yenilə" kicker="Hesab təhlükəsizliyi">
      <form onSubmit={submit} className="auth-form" noValidate>
        <p className="text-2 text-sm">Yeni şifrə ən azı 8 simvol olmalı, 1 böyük hərf və 1 rəqəm ehtiva etməlidir.</p>
        <FormField id="reset-pass" label="Yeni şifrə" icon={<Lock size={13} />} required>
          <input id="reset-pass" className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            autoComplete="new-password" maxLength={30} disabled={locked} />
        </FormField>
        <FormField id="reset-confirm" label="Şifrənin təkrarı" icon={<Lock size={13} />} required>
          <input id="reset-confirm" className="input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password" maxLength={30} disabled={locked} />
        </FormField>
        {message && <div className="notice notice--success" role="status"><CheckCircle size={16} /><span>{message}</span></div>}
        {error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}
        <Button type="submit" variant="primary" size="lg" block disabled={locked} loading={loading}>Şifrəni yenilə</Button>
      </form>
    </AuthPageShell>
  );
}

// type prop sayəsində eyni komponent həm e-poçt təsdiqi, həm e-poçt dəyişikliyi üçün işlədilir;
// useEffect daxilində type-a görə müvafiq API funksiyası seçilir.
function ConfirmActionPage({ type }: { type: 'email' | 'email-change' }) {
  const [message, setMessage] = useState('Yoxlanilir...');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // TƏK İCRA QORUYUCUSU.
  //
  // React StrictMode (main.tsx) development-də hər effekti QƏSDƏN iki dəfə işə salır.
  // Qoruyucu olmadan təsdiq sorğusu serverə İKİ DƏFƏ, özü də paralel gedirdi:
  // birinci sorğu əməliyyatı tamamlayıb SecurityStamp/ConcurrencyStamp-i yeniləyirdi,
  // ikincisi isə köhnəlmiş vəziyyətlə uğursuz olurdu — və ekranda göstərilən son nəticə
  // məhz ikincinin XƏTASI olurdu. Nəticədə e-poçt uğurla dəyişdiyi halda istifadəçi
  // "Hesab dəyişib" / "Təsdiq linki etibarsızdır" mesajı görürdü.
  //
  // useRef state deyil: dəyişməsi yenidən render tetiklemir və StrictMode-un ikinci
  // çağırışında da eyni obyekt qalır, ona görə ikinci icranı dayandıra bilir.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams((window.location.hash || window.location.search).replace(/^[#?]/, ''));

    // Parametrlər sorğudan ƏVVƏL URL-dən silinir. Əvvəl bu, cavab gəldikdən sonra
    // edilirdi — yəni səhifə yeniləndikdə link ikinci dəfə işlənə bilirdi.
    window.history.replaceState(null, '', window.location.pathname);

    const run = async () => {
      try {
        const result = type === 'email'
          ? await confirmEmail({ userId: params.get('userId') || '', token: params.get('token') || '' })
          : await confirmEmailChange({
              userId: params.get('userId') || '',
              newEmail: params.get('newEmail') || '',
              token: params.get('token') || '',
            });

        if (result.success) setMessage(result.message || 'Əməliyyat təsdiqləndi.');
        else setError(result.errors?.[0] || result.message || 'Link etibarsızdır və ya vaxtı bitib.');
      } catch {
        setError('Serverlə əlaqə yaradıla bilmir.');
      } finally {
        setDone(true);
      }
    };

    run();
  }, [type]);

  return (
    <AuthPageShell title={type === 'email' ? 'E-poçt təsdiqi' : 'E-poçt dəyişikliyi'} kicker="Təsdiq">
      <div className="auth-form">
        {!done && (
          <div className="state state--compact" role="status" aria-live="polite">
            <span className="spinner spinner--lg" aria-hidden="true" />
            <span className="state__text">{message}</span>
          </div>
        )}
        {done && !error && <div className="notice notice--success" role="status"><CheckCircle size={16} /><span>{message}</span></div>}
        {done && error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}
        {done && <ButtonLink href="/" variant={error ? 'outline' : 'primary'} block>Ana səhifəyə qayıt</ButtonLink>}
      </div>
    </AuthPageShell>
  );
}

// Google OAuth callback ayrıca sabit route-da işləyir. URL-dəki bir dəfəlik kod
// heç bir client-side icazə qərarı vermir: kod şərtsiz serverə göndərilir və
// yalnız server onu tapıb, müddətini yoxlayıb, tükətdikdən sonra sessiya açılır.
function GoogleLoginCallbackPage({ onSuccess }: { onSuccess: () => void }) {
  const [error, setError] = useState('');

  // ConfirmActionPage ilə eyni səbəb: StrictMode effekti iki dəfə işə salır.
  // Bu səhifədə nəticə daha pisdir — birinci icra kodu URL-dən silir, ikincisi isə
  // BOŞ kodu serverə göndərib uğursuz olur və giriş uğurlu olduğu halda ekranda
  // "Google ilə giriş tamamlanmadı" qalır. Kod həm də birdəfəlikdir: serverdə
  // artıq tükədilib.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = params.get('code') ?? '';

    // Bir dəfəlik kod brauzer tarixçəsində və ünvan sətrində qalmasın.
    window.history.replaceState(null, '', window.location.pathname);

    if (!code) {
      // Effektin içində sinxron setState-dən qaçılır (react-hooks/set-state-in-effect).
      queueMicrotask(() => setError('Google giriş kodu tapılmadı. Yenidən cəhd edin.'));
      return;
    }

    exchangeGoogleLoginCode(code)
      .then((response) => {
        if (response.success && response.data) {
          setTokens(response.data.accessToken);
          setStoredUserNickname(response.data.user.nickname);
          // Google ilə girişdə də rollar saxlanılır — əks halda admin panel
          // düyməsi yalnız adi girişdən sonra görünərdi.
          setStoredUserRoles(response.data.user.roles);
          window.history.replaceState(null, '', '/');
          onSuccess();
          return;
        }

        setError(response.message || 'Google ilə giriş tamamlanmadı. Yenidən cəhd edin.');
      })
      .catch(() => setError('Serverlə əlaqə yaradıla bilmədi.'));
  }, [onSuccess]);

  return (
    <AuthPageShell title="Google ilə giriş" kicker="Giriş">
      <div className="auth-form">
        {!error && (
          <div className="state state--compact" role="status" aria-live="polite">
            <span className="spinner spinner--lg" aria-hidden="true" />
            <span className="state__text">Giriş yoxlanılır...</span>
          </div>
        )}
        {error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}
        {error && <ButtonLink href="/" variant="primary" block>Ana səhifəyə qayıt</ButtonLink>}
      </div>
    </AuthPageShell>
  );
}

// ─── Main App ────────────────────────────────────────────────
// Tətbiqin görünüşü React Router əvəzinə boolean state ilə idarə edilir:
// showDashboard və activeQuizCategoryId hansı "ekranın" göstəriləcəyini müəyyən edir.
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getToken()));
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeQuizCategoryId, setActiveQuizCategoryId] = useState<number | null>(null);
  // window.location.pathname yoxlanılır ki, xüsusi URL-lər ana tətbiq ilə qarışmasın.
  const isResetPasswordPage = window.location.pathname === '/reset-password';
  const isConfirmEmailPage = window.location.pathname === '/confirm-email';
  const isConfirmEmailChangePage = window.location.pathname === '/confirm-email-change';
  const isGoogleLoginCallbackPage = window.location.pathname === '/google-login-callback';

  const handleGoogleLoginSuccess = useCallback(() => {
    setIsLoggedIn(true);
    setShowDashboard(true);
  }, []);

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setShowDashboard(false);
  };

  // setTimeout(50ms) hash dəyişmədən əvvəl state yenilənməsinin tamamlanmasına imkan verir;
  // bu olmadan scroll hədəf element render olmadan əvvəl işə düşə bilər.
  const handleGoKnowledge = useCallback(() => {
    setActiveQuizCategoryId(null);
    window.setTimeout(() => {
      window.location.hash = '#knowledge';
      document.getElementById('knowledge')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 50);
  }, []);

  // Başlıq və altlıqdakı bölmə linkləri: kabinet/quiz ekranı bağlanır, sonra
  // müvafiq bölməyə sürüşdürülür. Hash kontraktı (#about, #home, ...) dəyişmir.
  const handleNavigate = useCallback((href: string) => {
    setShowDashboard(false);
    setActiveQuizCategoryId(null);
    window.setTimeout(() => {
      const id = href.replace(/^#/, '');
      if (id === 'about') {
        window.history.replaceState(null, '', window.location.pathname);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      window.location.hash = href;
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  return (
    <>
      {/* Xüsusi URL səhifələri tam fərqli layout göstərir; şərt zənciri yuxarıdan aşağı yoxlanılır. */}
      {isResetPasswordPage ? (
        <ResetPasswordPage />
      ) : isConfirmEmailPage ? (
        <ConfirmActionPage type="email" />
      ) : isConfirmEmailChangePage ? (
        <ConfirmActionPage type="email-change" />
      ) : isGoogleLoginCallbackPage ? (
        <GoogleLoginCallbackPage onSuccess={handleGoogleLoginSuccess} />
      ) : (
      <>
      {/* Skip link */}
      <a href="#main-content" className="skip-link">Əsas məzmuna keç</a>

      {/* Başlıq həmişə görünür — kabinetdə də. Kabinetin öz yan paneli yerli
          naviqasiyadır, başlıq isə qlobal; ikisi bir-birini təkrarlamır. */}
      <Navbar
        onLoginDemo={() => setIsLoggedIn(true)}
        onLogout={handleLogout}
        onGoDashboard={() => { setShowDashboard(true); window.scrollTo({ top: 0 }); }}
        onGoHome={() => { setActiveQuizCategoryId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onNavigate={handleNavigate}
        isLoggedIn={isLoggedIn}
        inDashboard={showDashboard}
      />

      {/* Kabinet görünüşü */}
      {/* showDashboard → ana səhifə sırası ilə yalnız bir ekran göstərilir.
          Admin bölmələri ayrıca səhifə deyil — Kabinetim içində rol ilə açılır. */}
      {showDashboard ? (
        <main id="main-content" className="app-main">
          <UserDashboard
            onLogout={handleLogout}
            onGoHome={() => setShowDashboard(false)}
          />
        </main>
      ) : (

        <main id="main-content" className="app-main">
          {/* activeQuizCategoryId null deyilsə quiz ekranı göstərilir, əks halda ana səhifə bölmələri sıralanır. */}
          {activeQuizCategoryId !== null ? (
            <QuizView
              categoryId={activeQuizCategoryId}
              onGoHome={handleGoKnowledge}
              onSelectCategory={(id) => setActiveQuizCategoryId(id)}
            />
          ) : (
            <>
              {/* Giriş — Platforma Haqqında */}
              <AboutSection onNavigate={handleNavigate} />

              {/* Section 1 — Təlimlər */}
              <HeroSlider />

              {/* Section 2 — Biliklər Bazası */}
              <KnowledgeCategories onStartQuiz={(id) => { setActiveQuizCategoryId(id); window.scrollTo({ top: 0 }); }} />

              {/* Section 4 — İmtahan Sessiyaları */}
              <ExamSession />

              {/* Section 5 — Liderlik Lövhəsi */}
              <Leaderboard />
            </>
          )}
        </main>
      )}

      {/* Footer & Floating UI */}
      {!showDashboard && <Footer onNavigate={handleNavigate} />}
      <ScrollToTop />
      <CookieConsent />
      </>
      )}
    </>
  );
}
