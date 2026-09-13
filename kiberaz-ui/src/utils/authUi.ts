// ─── Giriş pəncərəsini uzaqdan açmaq ──────────────────────────
//
// Quiz-in auth qapısı və imtahan bölməsi kimi dərin komponentlər giriş
// pəncərəsini açmaq istəyir. Prop zənciri əvəzinə kiçik DOM hadisəsi işlədilir:
// Navbar dinləyir və müvafiq modalı açır. Bu, yalnız UI siqnalıdır — heç bir
// autentifikasiya məntiqi daşımır.

export type AuthRequestKind = 'login' | 'register';

const EVENT_NAME = 'kiberaz:auth-request';

export function requestAuth(kind: AuthRequestKind = 'login'): void {
  window.dispatchEvent(new CustomEvent<AuthRequestKind>(EVENT_NAME, { detail: kind }));
}

export function onAuthRequest(handler: (kind: AuthRequestKind) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    handler(detail === 'register' ? 'register' : 'login');
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
