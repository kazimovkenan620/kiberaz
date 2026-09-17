// 🛡️ Kurs API servisi — backend ilə əlaqə
import { apiFetch } from './apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

// API mənşəyi (sxem + host + port) — yüklənmiş faylların tam ünvanı bundan qurulur.
const API_ORIGIN = (() => {
  try { return new URL(API_URL).origin; } catch { return window.location.origin; }
})();

// Serverin qaytardığı nisbi upload yolunu (/uploads/photos/<guid>.png) tam ünvana çevirir (audit F11).
// Yalnız /uploads/ ilə başlayan yollar qəbul edilir — kənar və ya gözlənilməz dəyər heç vaxt linkə çevrilmir;
// `new URL` sətir birləşməsindən fərqli olaraq yol/port dəyişəndə də düzgün işləyir.
export function resolveUploadUrl(path: string | null | undefined): string | undefined {
  if (!path || !path.startsWith('/uploads/')) return undefined;
  try { return new URL(path, API_ORIGIN).href; } catch { return undefined; }
}

// ─── Tiplər ───────────────────────────────────────────────────

export interface CreateCourseRequest {
  instructorName: string;
  instructorRole: string;
  instructorCompany?: string;
  instructorPhotoUrl?: string;
  linkedInUrl?: string;
  gitHubUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  courseTitle: string;
  kicker?: string;
  description: string;
  duration: string;
  level: string;
  language: string;
  syllabusTopics: string[];
  syllabusFileUrl?: string;
  accentColor: string;
}

export interface CourseResponse {
  id: number;
  instructorName: string;
  instructorInitials: string;
  instructorRole: string;
  instructorCompany?: string;
  instructorPhotoUrl?: string;
  linkedInUrl?: string;
  gitHubUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  courseTitle: string;
  kicker?: string;
  description: string;
  duration: string;
  level: string;
  language: string;
  syllabusTopics: string[];
  syllabusFileUrl?: string;
  accentColor: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

// ─── VIP təlim modeli (kabinet) ───────────────────────────────
// Server qaydaları: təlimi yalnız VIP + aktiv 30 günlük dövr + qalan kredit paylaşır; hər dəyişiklik
// admin təsdiqindən keçir; təsdiqlənmiş təlim 30 gün aktiv qalır, sonra "Expired" (passiv) olur.
// Buradakı bayraqlar (canReactivate, coursesRemaining) yalnız UI üçündür — hüquq serverdə yoxlanılır.
export type MyCourseStatus = 'Pending' | 'Approved' | 'Rejected' | 'Expired';

export interface CourseRevision extends CreateCourseRequest {
  submittedAt: string;
}

export interface MyCourse extends CourseResponse {
  status: MyCourseStatus;
  publishedAt: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  hasPendingRevision: boolean;
  pendingRevision: CourseRevision | null;
  canReactivate: boolean;
}

export interface VipStatus {
  hasVipRole: boolean;
  hasActiveTerm: boolean;
  termStartsAt: string | null;
  termEndsAt: string | null;
  termDaysLeft: number | null;
  courseAllowance: number;
  coursesUsed: number;
  coursesRemaining: number;
  extraCourseRequiresPayment: boolean;
  termDays: number;
  coursesPerTerm: number;
  courseActiveDays: number;
}

// ─── API Çağırışları ──────────────────────────────────────────

// Yazma endpoint-ləri artıq giriş tələb edir. response.json() birbaşa çağırmaq olmaz:
// 401/429/500 cavabları boş və ya HTML gövdə ilə gələ bilər, bu isə exception atır və
// istifadəçi səbəbi yox, ümumi "əlaqə xətası" görür.
async function readWriteResponse<T>(response: Response): Promise<ApiResponse<T>> {
  let body: ApiResponse<T> | null;
  try { body = await response.json(); } catch { body = null; }

  if (body && typeof body.success === 'boolean') return body;

  if (response.status === 401) {
    return { success: false, message: 'Bu əməliyyat üçün daxil olun.', errors: ['AUTH_REQUIRED'] };
  }
  if (response.status === 403) {
    return { success: false, message: 'Bu əməliyyat yalnız VIP hesablar üçündür.', errors: ['VIP_REQUIRED'] };
  }
  if (response.status === 402) {
    return { success: false, message: 'Bu VIP dövründə təlim krediti bitib. Əlavə təlim əlavə ödəniş tələb edir.', errors: ['PAYMENT_REQUIRED'] };
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After'));
    return {
      success: false,
      message: Number.isFinite(retryAfter) && retryAfter > 0
        ? `Çox sayda sorğu göndərildi. ${retryAfter} saniyə sonra yenidən cəhd edin.`
        : 'Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin.',
      errors: ['RATE_LIMIT'],
    };
  }
  return { success: false, message: `Sorğu icra edilmədi (${response.status}).` };
}

/// Yeni kurs yaratma — giriş tələb olunur (apiFetch token əlavə edir və 401-də yeniləyir).
export async function createCourse(request: CreateCourseRequest): Promise<ApiResponse<CourseResponse>> {
  const response = await apiFetch('/course', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  return readWriteResponse<CourseResponse>(response);
}

/// Təsdiqlənmiş kursları siyahılama — HeroSlider üçün
export async function getApprovedCourses(): Promise<ApiResponse<CourseResponse[]>> {
  const response = await fetch(`${API_URL}/course`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return response.json();
}

/// Tək kurs detalları
export async function getCourseById(id: number): Promise<ApiResponse<CourseResponse>> {
  const response = await fetch(`${API_URL}/course/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  return response.json();
}

/// Cari hesabın VIP vəziyyəti (dövr, qalan kredit) — giriş tələb olunur.
export async function getVipStatus(): Promise<ApiResponse<VipStatus>> {
  return readWriteResponse<VipStatus>(await apiFetch('/course/vip-status'));
}

/// Sahibin öz təlimləri (bütün statuslar) — kabinet.
export async function getMyCourses(): Promise<ApiResponse<MyCourse[]>> {
  return readWriteResponse<MyCourse[]>(await apiFetch('/course/mine'));
}

/// Sahibin redaktəsi — aktiv təlimdə admin təsdiqinə qədər gözləyir, saytdakı versiya dəyişmir.
export async function updateCourse(id: number, request: CreateCourseRequest): Promise<ApiResponse<MyCourse>> {
  return readWriteResponse<MyCourse>(await apiFetch(`/course/${id}`, { method: 'PUT', body: JSON.stringify(request) }));
}

/// Sahibin silməsi (soft delete; kredit geri qaytarılmır).
export async function deleteMyCourse(id: number): Promise<ApiResponse<boolean>> {
  return readWriteResponse<boolean>(await apiFetch(`/course/${id}`, { method: 'DELETE' }));
}

/// Passiv təlimi yenidən moderasiyaya göndərir (aktiv VIP dövrünün 1 krediti).
export async function reactivateCourse(id: number): Promise<ApiResponse<MyCourse>> {
  return readWriteResponse<MyCourse>(await apiFetch(`/course/${id}/reactivate`, { method: 'POST' }));
}

// UploadController artıq [Authorize]-dır: anonim istifadəçinin serverin diskinə fayl
// yazması disk doldurma və izlənməyən məzmun yerləşdirmə vektoru idi.
// apiFetch həm token-i əlavə edir, həm də FormData üçün Content-Type-a toxunmur.

/// Müəllim şəklini serverə yükləmə — giriş tələb olunur.
export async function uploadInstructorPhoto(file: File): Promise<ApiResponse<string>> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/upload/photo', {
    method: 'POST',
    body: formData,
  });

  return readWriteResponse<string>(response);
}

/// Kurs sillabusunu (PDF) serverə yükləmə — giriş tələb olunur.
export async function uploadSyllabusPdf(file: File): Promise<ApiResponse<string>> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch('/upload/syllabus', {
    method: 'POST',
    body: formData,
  });

  return readWriteResponse<string>(response);
}
