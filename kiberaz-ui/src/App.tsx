import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp } from 'lucide-react';
import Navbar from './components/Navbar';
import HeroSlider from './components/HeroSlider';
import AboutSection from './components/AboutSection';
import KnowledgeCategories from './components/KnowledgeCategories';
import ExamSession from './components/ExamSession';
import Leaderboard from './components/Leaderboard';
import UserDashboard from './components/UserDashboard';
import Footer from './components/Footer';
import QuizView from './components/QuizView';
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
    >
      <ChevronUp size={22} strokeWidth={2.5} />
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
      aria-modal="true"
      aria-label="Çərəz razılığı"
      aria-hidden={!visible}
    >
      <p className="cookie-text">
        Biz sayt təcrübənizi yaxşılaşdırmaq üçün çərəzlərdən istifadə edirik.{' '}
        <a href="#">Məxfilik Siyasəti</a>
      </p>
      <div className="cookie-actions">
        <button
          id="cookie-decline-btn"
          className="btn btn-ghost btn-sm"
          onClick={handleDecline}
          style={{ color: 'var(--neutral-400)', borderColor: 'rgba(255,255,255,0.1)' }}
        >
          Rədd et
        </button>
        <button
          id="cookie-accept-btn"
          className="btn btn-primary btn-sm"
          onClick={handleAccept}
        >
          Qəbul et
        </button>
      </div>
    </div>
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

  return (
    <main className="app-main reset-page">
      <form onSubmit={submit} className="modal-panel reset-panel">
        <h1 className="modal-title">Şifrəni yenilə</h1>
        <div className="form-field">
          <label htmlFor="reset-pass">Yeni şifrə</label>
          <input id="reset-pass" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" maxLength={30} disabled={loading || !!message} />
        </div>
        <div className="form-field">
          <label htmlFor="reset-confirm">Şifrənin təkrarı</label>
          <input id="reset-confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" maxLength={30} disabled={loading || !!message} />
        </div>
        {message && <p style={{ color: '#22c55e', textAlign: 'center' }}>{message}</p>}
        {error && <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading || !!message}>{loading ? 'Yenilənir...' : 'Şifrəni yenilə'}</button>
      </form>
    </main>
  );
}

// type prop sayəsində eyni komponent həm e-poçt təsdiqi, həm e-poçt dəyişikliyi üçün işlədilir;
// useEffect daxilində type-a görə müvafiq API funksiyası seçilir.
function ConfirmActionPage({ type }: { type: 'email' | 'email-change' }) {
  const [message, setMessage] = useState('Yoxlanilir...');
  const [error, setError] = useState('');

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
      }
    };

    run();
  }, [type]);

  return (
    <main className="app-main" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="modal-panel" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <h1 className="modal-title">Təsdiq</h1>
        {!error && <p style={{ color: '#22c55e' }}>{message}</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
      </section>
    </main>
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
      setError('Google giriş kodu tapılmadı. Yenidən cəhd edin.');
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
    <main className="app-main" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="modal-panel" style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <h1 className="modal-title">Google ilə giriş</h1>
        {!error && <p style={{ color: '#22c55e' }}>Giriş yoxlanılır...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}
        {error && <a className="btn btn-primary" href="/">Ana səhifəyə qayıt</a>}
      </section>
    </main>
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

      {/* Navigation — həmişə görünür (dashboard-da da) */}
      {/* Dashboard və ya Admin paneli açıq olanda Navbar gizlədilir ki, iki naviqasiya sistemləri üst-üstə düşməsin. */}
      {!showDashboard && (
        <Navbar
          onLoginDemo={() => setIsLoggedIn(true)}
          onLogout={handleLogout}
          onGoDashboard={() => { setShowDashboard(true); }}
          onGoHome={() => { setActiveQuizCategoryId(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          isLoggedIn={isLoggedIn}
        />
      )}

      {/* Admin Panel görünüşü */}
      {/* showDashboard → ana səhifə sırası ilə yalnız bir ekran göstərilir.
          Admin bölmələri ayrıca səhifə deyil — Kabinetim içində rol ilə açılır. */}
      {showDashboard ? (
        <UserDashboard
          onLogout={handleLogout}
          onGoHome={() => setShowDashboard(false)}
        />
      ) : (

        <main id="main-content" className="app-main">
          {/* activeQuizCategoryId null deyilsə quiz ekranı göstərilir, əks halda ana səhifə bölmələri sıralanır. */}
          {activeQuizCategoryId !== null ? (
            <QuizView
              categoryId={activeQuizCategoryId}
              onGoHome={handleGoKnowledge}
            />
          ) : (
            <>
              {/* Giriş — Platforma Haqqında */}
              <AboutSection />

              <div className="section-divider" role="separator" aria-hidden="true" />

              {/* Section 1 — Təlim Reklamları */}
              <HeroSlider />

              <div className="section-divider" role="separator" aria-hidden="true" />

              {/* Section 2 — Biliklər Bazası */}
              <KnowledgeCategories onStartQuiz={(id) => setActiveQuizCategoryId(id)} />

              <div className="section-divider" role="separator" aria-hidden="true" />

              {/* Section 4 — İmtahan Sessiyaları */}
              <ExamSession />

              <div className="section-divider" role="separator" aria-hidden="true" />

              {/* Section 5 — Liderlik Lövhəsi */}
              <Leaderboard />
            </>
          )}
        </main>
      )}

      {/* Footer & Floating UI (həmişə görünür) */}
      {!showDashboard && <Footer />}
      <ScrollToTop />
      <CookieConsent />
      </>
      )}
    </>
  );
}
