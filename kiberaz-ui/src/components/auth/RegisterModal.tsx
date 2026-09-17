import { useState } from 'react';
import { AlertTriangle, CheckCircle, Eye, EyeOff, Lock, Mail, Shield, User, Users } from 'lucide-react';
import { registerUser } from '../../services/authService';
import { Button, FormField, Modal } from '../ui';
import { describedBy } from '../../utils/formA11y';
import TurnstileBox from './TurnstileBox';
import GoogleButton from './GoogleButton';

// ─── Qeydiyyat ────────────────────────────────────────────────
// Məntiq dəyişməyib: müştəri tərəfi yoxlama → CAPTCHA → registerUser.
// Şifrə qaydaları serverdə də yoxlanılır; burada yalnız erkən ipucudur.

interface Props {
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

type FormState = {
  firstName: string; lastName: string; email: string;
  nickname: string; role: string; gender: string; password: string; confirmPassword: string;
};

export default function RegisterModal({ onClose, onSwitchToLogin }: Props) {
  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', email: '',
    nickname: '', role: 'User', gender: '', password: '', confirmPassword: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const set = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

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

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  const strength = form.password.length >= 12 ? 'strong' : form.password.length >= 8 ? 'medium' : 'weak';
  const strengthLabel = { strong: 'Güclü', medium: 'Orta', weak: 'Zəif' }[strength];

  return (
    <Modal open onClose={onClose} title="Qeydiyyat" kicker="KIBERAZ.AZ" size="md">
      {submitted ? (
        <div className="auth-success">
          <div className="auth-success__icon"><CheckCircle size={26} /></div>
          <h3>Xoş gəldiniz!</h3>
          <p>Qeydiyyat uğurla tamamlandı. E-poçtunuza təsdiq məktubu göndərildi.</p>
          <Button variant="primary" onClick={onClose}>Bağla</Button>
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <GoogleButton label="Gmail ilə qeydiyyat" />
          <div className="divider divider--text">və ya e-poçt ilə</div>

          {apiError && (
            <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{apiError}</span></div>
          )}

          <div className="form-grid form-grid--2">
            <FormField id="reg-first" label="Ad" icon={<User size={13} />} required error={errors.firstName}>
              <input id="reg-first" className="input" type="text" placeholder="Adınız" value={form.firstName}
                onChange={e => set('firstName', e.target.value)} aria-invalid={!!errors.firstName} aria-describedby={describedBy('reg-first', false, !!errors.firstName)} autoComplete="given-name" />
            </FormField>
            <FormField id="reg-last" label="Soyad" icon={<User size={13} />} required error={errors.lastName}>
              <input id="reg-last" className="input" type="text" placeholder="Soyadınız" value={form.lastName}
                onChange={e => set('lastName', e.target.value)} aria-invalid={!!errors.lastName} aria-describedby={describedBy('reg-last', false, !!errors.lastName)} autoComplete="family-name" />
            </FormField>
          </div>

          <FormField id="reg-email" label="E-poçt" icon={<Mail size={13} />} required error={errors.email}>
            <input id="reg-email" className="input" type="email" placeholder="email@example.com" value={form.email}
              onChange={e => set('email', e.target.value)} aria-invalid={!!errors.email} aria-describedby={describedBy('reg-email', false, !!errors.email)} autoComplete="email" />
          </FormField>

          <FormField id="reg-nickname" label="Nickname" icon={<User size={13} />} required error={errors.nickname}
            hint="3-16 simvol: hərf, rəqəm və alt xətt. Liderlik lövhəsində yalnız bu ad görünür.">
            <input id="reg-nickname" className="input" type="text" placeholder="MrK4z1m0v" value={form.nickname}
              onChange={e => { set('nickname', e.target.value); setErrors(p => ({ ...p, nickname: '' })); }}
              aria-invalid={!!errors.nickname} aria-describedby={describedBy('reg-nickname', true, !!errors.nickname)} autoComplete="nickname" />
          </FormField>

          <div className="form-grid form-grid--2">
            <div className="field field--required">
              <span className="field__label" id="reg-role-label"><Shield size={13} /> Rol</span>
              <div className="segmented" role="group" aria-labelledby="reg-role-label">
                {[['İstifadəçi', 'User'], ['Müəllim', 'Teacher']].map(([label, value]) => (
                  <button key={value} type="button" className="segmented__btn" aria-pressed={form.role === value}
                    onClick={() => { set('role', value); setErrors(p => ({ ...p, role: '' })); }}>
                    {label}
                  </button>
                ))}
              </div>
              {errors.role && <span className="field__error" role="alert">{errors.role}</span>}
            </div>
            <div className="field field--required">
              <span className="field__label" id="reg-gender-label"><Users size={13} /> Cins</span>
              <div className="segmented" role="group" aria-labelledby="reg-gender-label">
                {[['Kişi', 'male'], ['Qadın', 'female']].map(([label, value]) => (
                  <button key={value} type="button" className="segmented__btn" aria-pressed={form.gender === value}
                    onClick={() => { set('gender', value); setErrors(p => ({ ...p, gender: '' })); }}>
                    {label}
                  </button>
                ))}
              </div>
              {errors.gender && <span className="field__error" role="alert">{errors.gender}</span>}
            </div>
          </div>

          <FormField id="reg-pass" label="Şifrə" icon={<Lock size={13} />} required error={errors.password}
            hint="Ən azı 8 simvol, 1 böyük hərf və 1 rəqəm.">
            <div className="input-wrap">
              <input id="reg-pass" className="input" type={showPass ? 'text' : 'password'} placeholder="Minimum 8 simvol"
                value={form.password} onChange={e => set('password', e.target.value)}
                aria-invalid={!!errors.password} aria-describedby={describedBy('reg-pass', true, !!errors.password)} autoComplete="new-password" maxLength={128} />
              <button type="button" className="input-wrap__action" onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Şifrəni gizlət' : 'Şifrəni göstər'}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {form.password.length > 0 && (
              <div className={`pw-strength pw-strength--${strength}`} aria-live="polite">
                <span className="progress progress--sm"><span className="progress__fill" /></span>
                <span className="pw-strength__label">{strengthLabel}</span>
              </div>
            )}
          </FormField>

          <FormField id="reg-confirm" label="Şifrə təkrarı" icon={<Lock size={13} />} required error={errors.confirmPassword}
            ok={form.confirmPassword.length > 0 && form.password === form.confirmPassword ? 'Şifrələr uyğundur' : undefined}>
            <div className="input-wrap">
              <input id="reg-confirm" className="input" type={showConf ? 'text' : 'password'} placeholder="Şifrəni təkrar daxil edin"
                value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
                aria-invalid={!!errors.confirmPassword} aria-describedby={describedBy('reg-confirm', false, !!errors.confirmPassword)} autoComplete="new-password" maxLength={128} />
              <button type="button" className="input-wrap__action" onClick={() => setShowConf(p => !p)} aria-label={showConf ? 'Gizlət' : 'Göstər'}>
                {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </FormField>

          <TurnstileBox onToken={setCaptchaToken} />

          <p className="modal__note">Qeydiyyatla <a href="#" className="text-link">İstifadə Şərtlərini</a> qəbul etmiş olursunuz.</p>

          <div className="modal__actions modal__actions--between">
            {onSwitchToLogin
              ? <button type="button" className="link-btn" onClick={onSwitchToLogin}>Hesabınız var? Daxil olun</button>
              : <span />}
            <div className="auth-form__actions">
              <Button variant="outline" onClick={onClose}>Ləğv et</Button>
              <Button type="submit" variant="primary" disabled={!captchaToken} loading={submitting}>Qeydiyyatdan keç</Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
