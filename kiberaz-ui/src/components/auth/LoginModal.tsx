import { useState } from 'react';
import { AlertTriangle, CheckCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { loginUser, resendConfirmationEmail } from '../../services/authService';
import { Button, FormField, Modal } from '../ui';
import TurnstileBox from './TurnstileBox';
import GoogleButton from './GoogleButton';

// ─── Giriş ────────────────────────────────────────────────────
// Məntiq Navbar-dakı köhnə sətiriçi formadan köçürülüb, dəyişməyib:
//  - CAPTCHA yalnız server `captchaRequired` qaytarandan sonra tələb olunur;
//  - "aktiv" sözü olan xəta halında təsdiq linkini yenidən göndərmək təklif edilir;
//  - xəta mesajları serverin qəsdən ümumi mətnidir (istifadəçi sadalanması yoxdur).

export interface LoggedInUser { nickname: string; roles: string[]; }

interface Props {
  onClose: () => void;
  onLoggedIn: (user: LoggedInUser, accessToken: string) => void;
  onForgot: (email: string) => void;
  onSwitchToRegister: () => void;
}

export default function LoginModal({ onClose, onLoggedIn, onForgot, onSwitchToRegister }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendOk, setResendOk] = useState(true);
  const [resending, setResending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [needsCaptcha, setNeedsCaptcha] = useState(false);

  const canResendConfirmation = loginError.toLowerCase().includes('aktiv') && email.includes('@');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setResendMessage('');
    if (needsCaptcha && !captchaToken) {
      setLoginError('Zəhmət olmasa CAPTCHA-nı tamamlayın.');
      return;
    }
    setLoading(true);
    try {
      const response = await loginUser({
        email,
        password,
        captchaToken: captchaToken || undefined,
      });
      if (response.success && response.data) {
        const u = response.data.user;
        setNeedsCaptcha(false);
        setCaptchaToken('');
        onLoggedIn({ nickname: u.nickname, roles: u.roles }, response.data.accessToken);
      } else {
        if (response.captchaRequired) setNeedsCaptcha(true);
        setLoginError(response.message || response.errors?.[0] || 'Giriş uğursuz oldu');
      }
    } catch {
      setLoginError('Serverlə əlaqə yaradıla bilmədi');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.includes('@')) return;
    setResending(true);
    setResendMessage('');
    try {
      const response = await resendConfirmationEmail(email);
      // success bayrağı nəzərə alınır: uğursuz cavab yaşıl görünməsin.
      setResendOk(response.success);
      setResendMessage(response.message || (response.success
        ? 'Təsdiq linki e-poçtunuza göndərildi.'
        : 'Təsdiq linki göndərilə bilmədi.'));
    } catch {
      setResendOk(false);
      setResendMessage('Serverlə əlaqə yaradıla bilmədi.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Daxil ol" kicker="KIBERAZ.AZ" size="sm">
      <form className="auth-form" onSubmit={handleLogin} noValidate>
        <GoogleButton label="Google ilə daxil ol" />
        <div className="divider divider--text">və ya e-poçt ilə</div>

        <FormField id="login-email" label="E-poçt" icon={<Mail size={13} />} required>
          <input id="login-email" className="input" type="email" placeholder="email@example.com" value={email}
            onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus />
        </FormField>

        <FormField id="login-password" label="Şifrə" icon={<Lock size={13} />} required>
          <div className="input-wrap">
            <input id="login-password" className="input" type={showPass ? 'text' : 'password'} placeholder="Şifrəniz" value={password}
              onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" className="input-wrap__action" onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Şifrəni gizlət' : 'Şifrəni göstər'}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </FormField>

        {needsCaptcha && <TurnstileBox onToken={setCaptchaToken} />}

        {loginError && (
          <div className="notice notice--danger" role="alert">
            <AlertTriangle size={16} />
            <div className="notice__body">
              <span>{loginError}</span>
              {canResendConfirmation && (
                <button type="button" className="link-btn" onClick={handleResendConfirmation} disabled={resending}>
                  {resending ? 'Göndərilir...' : 'Təsdiq linkini yenidən göndər'}
                </button>
              )}
            </div>
          </div>
        )}
        {resendMessage && (
          <div className={`notice ${resendOk ? 'notice--success' : 'notice--danger'}`} role="status">
            {resendOk ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            <span>{resendMessage}</span>
          </div>
        )}

        <Button id="login-submit" type="submit" variant="primary" block loading={loading} disabled={needsCaptcha && !captchaToken}>
          Daxil ol
        </Button>

        <div className="auth-form__links">
          <button type="button" className="link-btn" onClick={() => onForgot(email)}>Şifrəni unutdum</button>
          <button type="button" className="link-btn" onClick={onSwitchToRegister}>Hesabınız yoxdur? Qeydiyyat</button>
        </div>
      </form>
    </Modal>
  );
}
