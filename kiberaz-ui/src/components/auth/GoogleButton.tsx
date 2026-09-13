import { getAuthBaseUrl } from '../../services/authService';

// ─── Google ilə giriş/qeydiyyat düyməsi ──────────────────────
// Axın dəyişmir: brauzer serverin /auth/google endpoint-inə yönləndirilir,
// geri dönüş /google-login-callback səhifəsində serverlə mübadilə olunur.
export default function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="btn btn--outline btn--block google-btn"
      onClick={() => { window.location.href = `${getAuthBaseUrl()}/auth/google`; }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.4 37.5 16.1 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.5l6.2 5.2C41.3 35.1 44 30 44 24c0-1.3-.1-2.7-.4-3.9z" />
      </svg>
      {label}
    </button>
  );
}
