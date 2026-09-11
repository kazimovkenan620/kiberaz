// 🛡️ Kurs API servisi — backend ilə əlaqə
import { apiFetch } from './apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

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

// ─── API Çağırışları ──────────────────────────────────────────

// Yazma endpoint-ləri artıq giriş tələb edir. response.json() birbaşa çağırmaq olmaz:
// 401/429/500 cavabları boş və ya HTML gövdə ilə gələ bilər, bu isə exception atır və
// istifadəçi səbəbi yox, ümumi "əlaqə xətası" görür.
async function readWriteResponse<T>(response: Response): Promise<ApiResponse<T>> {
  let body: ApiResponse<T> | null = null;
  try { body = await response.json(); } catch { body = null; }

  if (body && typeof body.success === 'boolean') return body;

  if (response.status === 401) {
    return { success: false, message: 'Bu əməliyyat üçün daxil olun.', errors: ['AUTH_REQUIRED'] };
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
