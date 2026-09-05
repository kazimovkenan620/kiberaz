// ============================================================
// adminService.ts — Kiberaz.az Admin Paneli API Servisi
//
// Bütün funksiyalar REAL backend-ə (api/admin) müraciət edir.
// apiClient üzərindən gedir: JWT header-i avtomatik əlavə olunur və
// 401 halında token bir dəfə yenilənib sorğu təkrarlanır.
//
// Bütün endpoint-lər server tərəfdə [Authorize(Roles = "Admin")] ilə qorunur —
// Admin olmayan istifadəçi 403 alır, cavabda heç bir məlumat sızmır.
// ============================================================

import { apiFetch } from './apiClient';

// ApiResponse<T> — backend-dəki ApiResponse<T> sinfinin eyni quruluşu.
type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
};

// ── Təlim tipi ────────────────────────────────────────────────
export type AdminCourse = {
  id: number;
  title: string;
  instructor: string;
  category: string;
  status: 'Approved' | 'Pending' | 'Rejected';
  createdAt: string;
  link?: string;
};

// ── İstifadəçi tipi ──────────────────────────────────────────
export type AdminUser = {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  isEmailConfirmed: boolean;
  isBlocked: boolean;
  joinDate: string;
};

// ── İmtahan tipi ──────────────────────────────────────────────
// Backend-də hər sətir bir quiz kateqoriyasıdır:
// studentCount = həmin kateqoriyada cavab vermiş unikal istifadəçi sayı,
// duration     = kateqoriyadakı sual sayı.
export type AdminExam = {
  id: string;
  title: string;
  instructor: string;
  studentCount: number;
  duration: string;
  status: 'Aktiv' | 'Gözlənilir' | 'Tamamlandı';
  category: string;
  createdAt: string;
};

// ── Statistika tipi ──────────────────────────────────────────
export type AdminStats = {
  totalUsers: number;
  totalCourses: number;
  pendingCourses: number;
  activeExams: number;
  totalExams: number;
  newUsersThisWeek: number;
};

// ============================================================
// KÖMƏKÇİ
// ============================================================

// Serverin cavabını təhlükəsiz açır. 403/500 kimi hallarda body JSON olmaya bilər —
// belə vəziyyətdə komponentin çökməməsi üçün standart formada xəta obyekti qaytarılır.
async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await apiFetch(path, init);

    let body: ApiResponse<T> | null = null;
    try {
      body = (await response.json()) as ApiResponse<T>;
    } catch {
      body = null;
    }

    if (body && typeof body.success === 'boolean') return body;

    if (response.status === 403) {
      return { success: false, message: 'Bu əməliyyat üçün Admin səlahiyyəti tələb olunur.' };
    }

    return {
      success: false,
      message: `Server xətası (${response.status}).`,
    };
  } catch {
    return { success: false, message: 'Serverlə əlaqə yaradıla bilmədi.' };
  }
}

// ============================================================
// STATİSTİKA
// ============================================================

export async function getAdminStats(): Promise<ApiResponse<AdminStats>> {
  return request<AdminStats>('/admin/stats');
}

// ============================================================
// TƏLİMLƏR
// ============================================================

export async function getAdminCourses(): Promise<ApiResponse<AdminCourse[]>> {
  return request<AdminCourse[]>('/admin/courses');
}

export async function approveCourse(id: number): Promise<ApiResponse<boolean>> {
  return request<boolean>(`/admin/courses/${id}/approve`, { method: 'PATCH' });
}

export async function rejectCourse(id: number): Promise<ApiResponse<boolean>> {
  return request<boolean>(`/admin/courses/${id}/reject`, { method: 'PATCH' });
}

export async function deleteCourse(id: number): Promise<ApiResponse<boolean>> {
  return request<boolean>(`/admin/courses/${id}`, { method: 'DELETE' });
}

export async function createAdminCourse(
  data: { title: string; instructor: string; category: string; link: string },
): Promise<ApiResponse<AdminCourse>> {
  return request<AdminCourse>('/admin/courses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================
// İSTİFADƏÇİLƏR
// ============================================================

export async function getAdminUsers(): Promise<ApiResponse<AdminUser[]>> {
  return request<AdminUser[]>('/admin/users');
}

// Server yalnız mövcud rolları qəbul edir və adminin ÖZ rolunu dəyişməsini bloklayır.
export async function changeUserRole(userId: string, role: string): Promise<ApiResponse<boolean>> {
  return request<boolean>(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

// Toggle: bloklanmış istifadəçinin bloku götürülür, bloklanmamış istifadəçi bloklanır.
// Server adminin özünü və sistemdəki son admini bloklamasına icazə vermir.
export async function toggleUserBlock(userId: string): Promise<ApiResponse<boolean>> {
  return request<boolean>(`/admin/users/${encodeURIComponent(userId)}/block`, {
    method: 'PATCH',
  });
}

// ============================================================
// İMTAHANLAR
// ============================================================

export async function getAdminExams(): Promise<ApiResponse<AdminExam[]>> {
  return request<AdminExam[]>('/admin/exams');
}

// Soft delete: kateqoriya və ona bağlı bütün suallar gizlədilir, data fiziki silinmir.
export async function deleteExam(id: string): Promise<ApiResponse<boolean>> {
  return request<boolean>(`/admin/exams/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
