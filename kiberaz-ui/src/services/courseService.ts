// 🛡️ Kurs API servisi — backend ilə əlaqə
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

/// Yeni kurs yaratma
export async function createCourse(request: CreateCourseRequest): Promise<ApiResponse<CourseResponse>> {
  const response = await fetch(`${API_URL}/course`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  return response.json();
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

/// Müəllim şəklini serverə yükləmə
export async function uploadInstructorPhoto(file: File): Promise<ApiResponse<string>> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/upload/photo`, {
    method: 'POST',
    body: formData, // Qeyd: Fetch-də FormData göndərərkən Content-Type header-i avtomatik təyin olunmalıdır (multipart/form-data)
  });

  return response.json();
}

/// Kurs sillabusunu (PDF) serverə yükləmə
export async function uploadSyllabusPdf(file: File): Promise<ApiResponse<string>> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/upload/syllabus`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}
