const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

export const getAuthBaseUrl = () => API_URL;

// LoginRequest — servərə göndəriləcək giriş məlumatlarının strukturunu müəyyənləşdirir.
// TypeScript bu interfeysi yoxlayır, ona görə yanlış sahə göndərmək mümkün deyil.
export interface LoginRequest {
  email: string;
  password: string;
}

// RegisterRequest — qeydiyyat üçün lazım olan bütün sahələri bir yerdə saxlayır.
// Hər sahənin tipi açıq göstərilib ki, forma məlumatları düzgün tiplərlə göndərilsin.
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  nickname: string;
  role: string;
  gender: number;
  password: string;
  confirmPassword: string;
}

// AuthResponse — servərin autentifikasiya sorğularına verdiyi cavabın ümumi formatı.
// data sahəsi yalnız uğurlu halda doldurulur; errors isə uğursuz halda siyahı şəklində gəlir.
export interface AuthResponse {
  success: boolean;
  message: string;
  errors?: string[];
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    user: {
      id: string;
      nickname: string;
      firstName: string;
      lastName: string;
      gender: number;
      joinDate: string;
      roles: string[];
      profileImageUrl: string | null;
    };
  };
}

// credentials: 'include' yazılıb ki, brauzer httpOnly refresh token cookie-ni
// avtomatik əlavə etsin; bu cookie JavaScript tərəfindən oxuna bilmir, buna görə daha təhlükəsizdir.
export async function loginUser(request: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  const data: AuthResponse = await response.json();
  return data;
}

export async function registerUser(request: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data: AuthResponse = await response.json();
    return data;
}

export async function resendConfirmationEmail(email: string): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const response = await fetch(`${API_URL}/auth/resend-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    return response.json();
}

export async function forgotPassword(email: string, captchaToken: string): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, captchaToken }),
    });

    return response.json();
}

export async function resetPassword(data: { userId: string; token: string; newPassword: string; confirmPassword: string }): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    return response.json();
}

export async function confirmEmail(data: { userId: string; token: string }): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const response = await fetch(`${API_URL}/auth/confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    return response.json();
}

export async function confirmEmailChange(data: { userId: string; newEmail: string; token: string }): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const response = await fetch(`${API_URL}/user/confirm-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    return response.json();
}

// credentials: 'include' — Google-dan geri dönəndə servər httpOnly cookie yazdığı üçün
// bu seçim mütləqdir; onsuz cookie brauzer tərəfindən bloklanır.
export async function exchangeGoogleLoginCode(code: string): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/auth/google/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    });

    return response.json();
}

// Access token sessionStorage-da saxlanılır: tab bağlandıqda avtomatik silinir,
// buna görə localStorage-dən daha təhlükəsizdir — oğurlanmış token uzun müddət işlənə bilməz.
export function getToken(): string | null {
    return sessionStorage.getItem('access_token');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// Yalnız access token saxlanılır; refresh token servər tərəfindən httpOnly cookie kimi idarə edilir,
// ona görə burada JavaScript koduna heç vaxt açılmır.
export function setTokens(accessToken: string, _refreshToken?: string): void {
    sessionStorage.setItem('access_token', accessToken);
    // Köhnə localStorage açarlarını təmizlə
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
}

export function logout() {
    sessionStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token'); // köhnə format
    localStorage.removeItem('token'); // köhnə format
    localStorage.removeItem('user');
}

// Servər 401 qaytardıqda bu funksiya köhnə access token-i göndərib yenisini alır.
// Refresh token httpOnly cookie olaraq brauzer tərəfindən avtomatik əlavə edilir —
// JavaScript heç vaxt ona birbaşa toxuna bilmir, bu da XSS hücumlarından qoruyur.
export async function refreshTokens(): Promise<boolean> {
  const accessToken = sessionStorage.getItem('access_token');
  if (!accessToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accessToken }),
    });
    if (!response.ok) return false;
    const data: AuthResponse = await response.json();
    if (data.success && data.data) {
      setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
