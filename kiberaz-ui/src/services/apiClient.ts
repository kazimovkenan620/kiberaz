import { getAuthSessionVersion, getToken, refreshTokens, logout } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

// Hər sorğuya JWT token əlavə edilir; əgər cavab 401 gəlirsə token yenilənib sorğu bir dəfə təkrarlanır.
// credentials: 'include' vacibdir — onsuz brauzer httpOnly refresh token cookie-ni servərə göndərmir.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const sessionVersion = getAuthSessionVersion();
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // FormData göndərildikdə Content-Type ƏLLƏ QOYULMAMALIDIR: brauzer multipart
  // boundary-ni özü əlavə edir, biz "application/json" yazsaq server gövdəni
  // ayrıştıra bilmir və fayl yükləmə səssizcə sınır.
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });

  if (response.status !== 401 || sessionVersion !== getAuthSessionVersion()) return response;

  // Eyni sessiyanın paralel 401-ləri authService-də bir refresh paylaşır.
  // Başqa sorğu artıq tokeni yeniləyibsə əlavə rotasiya lazım deyil.
  if (getToken() === token) {
    const refreshed = await refreshTokens();
    // Köhnə sorğu yeni login-i silə və başqa hesabın tokeni ilə təkrarlana bilməz.
    if (sessionVersion !== getAuthSessionVersion()) return response;
    if (!refreshed) {
      logout();
      return response;
    }
  }

  const newToken = getToken();
  if (newToken) {
    headers.set('Authorization', `Bearer ${newToken}`);
    return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  }
  return response;
}
