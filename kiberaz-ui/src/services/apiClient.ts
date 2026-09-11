import { getToken, refreshTokens, logout } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

// Parallel 401 race condition qoruması: yalnız bir refresh uçuşda ola bilər.
// Digər 401-lər refresh bitənə qədər növbəyə alınır.
let _isRefreshing = false;
let _pendingQueue: Array<(token: string | null) => void> = [];

function _processQueue(token: string | null) {
  _pendingQueue.forEach(resolve => resolve(token));
  _pendingQueue = [];
}

// Hər sorğuya JWT token əlavə edilir; əgər cavab 401 gəlirsə token yenilənib sorğu bir dəfə təkrarlanır.
// credentials: 'include' vacibdir — onsuz brauzer httpOnly refresh token cookie-ni servərə göndərmir.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // FormData göndərildikdə Content-Type ƏLLƏ QOYULMAMALIDIR: brauzer multipart
  // boundary-ni özü əlavə edir, biz "application/json" yazsaq server gövdəni
  // ayrıştıra bilmir və fayl yükləmə səssizcə sınır.
  if (!(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });

  if (response.status !== 401) return response;

  // Refresh artıq uçuşdadırsa — növbəyə gir, nəticəni gözlə
  if (_isRefreshing) {
    const newToken = await new Promise<string | null>(resolve => {
      _pendingQueue.push(resolve);
    });
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
    }
    return response;
  }

  _isRefreshing = true;
  try {
    const refreshed = await refreshTokens();
    const newToken = refreshed ? getToken() : null;
    _processQueue(newToken);

    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
    } else {
      logout();
    }
  } finally {
    _isRefreshing = false;
  }

  return response;
}
