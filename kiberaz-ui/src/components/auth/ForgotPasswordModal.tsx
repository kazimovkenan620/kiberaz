import { useState } from 'react';
import { AlertTriangle, CheckCircle, Mail } from 'lucide-react';
import { forgotPassword } from '../../services/authService';
import { Button, FormField, Modal } from '../ui';
import TurnstileBox from './TurnstileBox';

// ─── Şifrəni unutdum ──────────────────────────────────────────
// CAPTCHA məcburidir; server cavabı olduğu kimi göstərilir (istifadəçi
// sadalanmasına yol verməmək üçün mesaj serverdə qəsdən ümumidir).
export default function ForgotPasswordModal({ initialEmail, onClose }: { initialEmail: string; onClose: () => void }) {
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
    <Modal open onClose={onClose} title="Şifrəni yenilə" kicker="Hesab" size="sm">
      <form className="auth-form" onSubmit={submit} noValidate>
        <p className="text-2 text-sm">E-poçt ünvanınızı daxil edin — şifrə yeniləmə linki göndərəcəyik.</p>
        <FormField id="forgot-email" label="E-poçt" icon={<Mail size={13} />} required>
          <input id="forgot-email" className="input" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
            placeholder="email@example.com" autoComplete="email" disabled={loading || !!message} />
        </FormField>
        <TurnstileBox onToken={setCaptchaToken} />
        {message && <div className="notice notice--success" role="status"><CheckCircle size={16} /><span>{message}</span></div>}
        {error && <div className="notice notice--danger" role="alert"><AlertTriangle size={16} /><span>{error}</span></div>}
        <Button type="submit" variant="primary" block disabled={!captchaToken || !!message} loading={loading}>Link göndər</Button>
      </form>
    </Modal>
  );
}
