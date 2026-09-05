const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

export const getAuthBaseUrl = () => API_URL;

// LoginRequest — servərə göndəriləcək giriş məlumatlarının strukturunu müəyyənləşdirir.
// TypeScript bu interfeysi yoxlayır, ona görə yanlış sahə göndərmək mümkün deyil.
export interface LoginRequest {
  email: string;
  password: string;
  // Yalnız çox sayda uğursuz cəhddən sonra tələb olunur — normal girişdə göndərilmir.
  captchaToken?: string;
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
  // Qeydiyyatda CAPTCHA həmişə tələb olunur — forma onsuz göndərilmir.
  captchaToken: string;
}

// AuthResponse — servərin autentifikasiya sorğularına verdiyi cavabın ümumi formatı.
// data sahəsi yalnız uğurlu halda doldurulur; errors isə uğursuz halda siyahı şəklində gəlir.
export interface AuthResponse {
  success: boolean;
  message: string;
  errors?: string[];
  captchaRequired?: boolean;
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

const USER_NICKNAME_KEY = 'user_nickname';
const USER_ROLES_KEY = 'user_roles';

// UI-də yalnız salamlaşma üçün lazım olan ləqəb cari tabın sessiyasında saxlanılır.
// Köhnə versiyaların localStorage-a yazdığı geniş profil obyekti burada təmizlənir.
export function getStoredUserNickname(): string | null {
    localStorage.removeItem('user');
    return sessionStorage.getItem(USER_NICKNAME_KEY);
}

export function setStoredUserNickname(nickname: string): void {
    sessionStorage.setItem(USER_NICKNAME_KEY, nickname);
    localStorage.removeItem('user');
}

// ─── Rollar ──────────────────────────────────────────────────
//
// ⚠ BU YALNIZ İNTERFEYS ÜÇÜNDÜR, TƏHLÜKƏSİZLİK MEXANİZMİ DEYİL.
// Dəyər sessionStorage-dadır — istifadəçi onu brauzer konsolundan dəyişib admin
// düyməsini görünən edə bilər. Bu heç nə vermir: hər admin endpoint-i serverdə
// [Authorize(Roles = "Admin")] ilə qorunur və saxta rol 403 alır.
// Məqsəd yalnız lazımsız düymələri gizlətmək və istifadəçiyə öz rolunu göstərməkdir.

export function setStoredUserRoles(roles: string[] | undefined | null): void {
    sessionStorage.setItem(USER_ROLES_KEY, JSON.stringify(roles ?? []));
}

export function getStoredUserRoles(): string[] {
    try {
        const stored = sessionStorage.getItem(USER_ROLES_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === 'string') : [];
    } catch {
        return [];
    }
}

export function isAdmin(): boolean {
    return getStoredUserRoles().some(r => r.toLowerCase() === 'admin');
}

// İstifadəçiyə göstərilən əsas rol: Admin varsa o, yoxsa ilk rol.
export function getPrimaryRoleLabel(): string {
    const roles = getStoredUserRoles();
    if (roles.length === 0) return '';
    return roles.find(r => r.toLowerCase() === 'admin') ?? roles[0];
}

// Yalnız access token saxlanılır; refresh token servər tərəfindən httpOnly cookie kimi idarə edilir,
// ona görə burada JavaScript koduna heç vaxt açılmır.
export function setTokens(accessToken: string): void {
    sessionStorage.setItem('access_token', accessToken);
    // Köhnə localStorage açarlarını təmizlə
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
}

export function logout() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem(USER_NICKNAME_KEY);
    sessionStorage.removeItem(USER_ROLES_KEY);
    localStorage.removeItem('refresh_token'); // köhnə format
    localStorage.removeItem('token'); // köhnə format
    localStorage.removeItem('user'); // köhnə versiyalardakı geniş profil obyekti
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
      setTokens(data.data.accessToken);

      // Rollar hər refresh-də yenilənir: admin rolu verildikdə/alındıqda
      // interfeys növbəti refresh-də dərhal doğru vəziyyətə keçir.
      setStoredUserRoles(data.data.user?.roles);
      if (data.data.user?.nickname) setStoredUserNickname(data.data.user.nickname);

      return true;
    }
    return false;
  } catch {
    return false;
  }
}
