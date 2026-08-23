// ============================================================
// adminService.ts — Kiberaz.az Admin Paneli Mock Servisi
// Hal-hazırda mock data ilə işləyir.
// Backend API hazır olduqda bu faylda real fetch çağırışları
// əvəz olunacaq.
// ============================================================

import { getToken } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

// ApiResponse<T> — bütün mock funksiyalar bu ümumi quruluşu qaytarır ki,
// gələcəkdə real API-ya keçid zamanı çağıran komponentlərdə heç nə dəyişməsin.
type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
};

// ── Təlim tipi ────────────────────────────────────────────────
// AdminCourse — admin panelinin Təlimlər bölməsindəki hər sətri təmsil edir.
// status sahəsi yalnız üç sabit dəyər qəbul edə bilər; TypeScript bunu yoxlayır.
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
// AdminUser — admin panelinin İstifadəçilər cədvəlindəki hər sətri təmsil edir.
// isBlocked və isEmailConfirmed sahələri cədvəldə rəngli etiket kimi göstərilir.
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

// ── İmtahan Sessiyası tipi ────────────────────────────────────
// AdminExam — admin panelinin İmtahanlar bölməsindəki hər sessiyayı əks etdirir.
// status sahəsi Azərbaycan dilindəki üç sabit dəyərdən birini alır.
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
// AdminStats — dashboard-un yuxarı hissəsindəki statistika kartlarını dolduran məlumatlar.
export type AdminStats = {
  totalUsers: number;
  totalCourses: number;
  pendingCourses: number;
  activeExams: number;
  totalExams: number;
  newUsersThisWeek: number;
};

// ============================================================
// MOCK DATA
// ============================================================

const MOCK_STATS: AdminStats = {
  totalUsers: 247,
  totalCourses: 18,
  pendingCourses: 3,
  activeExams: 4,
  totalExams: 12,
  newUsersThisWeek: 31,
};

const MOCK_COURSES: AdminCourse[] = [
  { id: 1, title: 'Kibertəhlükəsizlik Əsasları', instructor: 'Əli Həsənov', category: 'Ümumi', status: 'Approved', createdAt: '2025-01-10' },
  { id: 2, title: 'Network Security Pro', instructor: 'Nigar Məmmədova', category: 'Network Security', status: 'Approved', createdAt: '2025-02-14' },
  { id: 3, title: 'OWASP Top 10 Masterclass', instructor: 'Rauf İsmayılov', category: 'Web Security', status: 'Approved', createdAt: '2025-03-05' },
  { id: 4, title: 'Active Directory Hücumları', instructor: 'Şəhriyar Rəhimov', category: 'Active Directory', status: 'Pending', createdAt: '2025-04-18' },
  { id: 5, title: 'SOC Analyst Bootcamp', instructor: 'Günel Məmmədli', category: 'SOC', status: 'Pending', createdAt: '2025-04-22' },
  { id: 6, title: 'Secure Code Review', instructor: 'Elvin Babayev', category: 'Code Review', status: 'Rejected', createdAt: '2025-03-30' },
  { id: 7, title: 'Penetration Testing 101', instructor: 'Xədicə Sultanova', category: 'Web Security', status: 'Pending', createdAt: '2025-05-01' },
];

const MOCK_USERS: AdminUser[] = [
  { id: 'u1', nickname: 'anar_sec', firstName: 'Anar', lastName: 'Quliyev', email: 'anar@example.com', roles: ['User'], isEmailConfirmed: true, isBlocked: false, joinDate: '2025-01-05' },
  { id: 'u2', nickname: 'leyla_cyber', firstName: 'Leyla', lastName: 'Abdullayeva', email: 'leyla@example.com', roles: ['Teacher'], isEmailConfirmed: true, isBlocked: false, joinDate: '2025-01-12' },
  { id: 'u3', nickname: 'turan_h', firstName: 'Turan', lastName: 'Hüseynov', email: 'turan@example.com', roles: ['VIP'], isEmailConfirmed: true, isBlocked: false, joinDate: '2025-02-08' },
  { id: 'u4', nickname: 'shahri_r', firstName: 'Şəhriyar', lastName: 'Rəhimov', email: 'shahri@example.com', roles: ['Moderator'], isEmailConfirmed: true, isBlocked: false, joinDate: '2025-02-20' },
  { id: 'u5', nickname: 'gunel_m', firstName: 'Günel', lastName: 'Məmmədli', email: 'gunel@example.com', roles: ['Teacher'], isEmailConfirmed: false, isBlocked: false, joinDate: '2025-03-15' },
  { id: 'u6', nickname: 'elvin_sec', firstName: 'Elvin', lastName: 'Babayev', email: 'elvin@example.com', roles: ['User'], isEmailConfirmed: true, isBlocked: true, joinDate: '2025-03-28' },
  { id: 'u7', nickname: 'xedice_s', firstName: 'Xədicə', lastName: 'Sultanova', email: 'xedice@example.com', roles: ['User'], isEmailConfirmed: true, isBlocked: false, joinDate: '2025-04-02' },
  { id: 'u8', nickname: 'admin_kaz', firstName: 'Kenan', lastName: 'Kazimov', email: 'admin@kiberaz.az', roles: ['Admin'], isEmailConfirmed: true, isBlocked: false, joinDate: '2024-12-01' },
];

const MOCK_EXAMS: AdminExam[] = [
  { id: 'KBR-2025-001', title: 'Network Security Final', instructor: 'Əli Həsənov', studentCount: 24, duration: '90 dəq', status: 'Aktiv', category: 'Network', createdAt: '2025-05-20' },
  { id: 'KBR-2025-002', title: 'OWASP Top 10 Quiz', instructor: 'Nigar Məmmədova', studentCount: 18, duration: '45 dəq', status: 'Gözlənilir', category: 'Web Security', createdAt: '2025-05-22' },
  { id: 'KBR-2025-003', title: 'Active Directory Simulyasiya', instructor: 'Rauf İsmayılov', studentCount: 12, duration: '120 dəq', status: 'Tamamlandı', category: 'Active Directory', createdAt: '2025-05-10' },
  { id: 'KBR-2025-004', title: 'SOC Analyst Test', instructor: 'Şəhriyar Rəhimov', studentCount: 30, duration: '60 dəq', status: 'Aktiv', category: 'SOC', createdAt: '2025-05-25' },
  { id: 'KBR-2025-005', title: 'Code Review Challenge', instructor: 'Günel Məmmədli', studentCount: 8, duration: '90 dəq', status: 'Gözlənilir', category: 'Code Review', createdAt: '2025-05-28' },
];

// ============================================================
// MOCK API FUNCTIONS (backend hazır olduqda real fetch ilə əvəz et)
// ============================================================

// Gerçək şəbəkə gecikmə hissini simulyasiya edir ki, UI loading vəziyyətləri test edilə bilsin.
function delay(ms = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getAdminStats(): Promise<ApiResponse<AdminStats>> {
  await delay();
  return { success: true, message: 'OK', data: { ...MOCK_STATS } };
}

export async function getAdminCourses(): Promise<ApiResponse<AdminCourse[]>> {
  await delay();
  return { success: true, message: 'OK', data: [...MOCK_COURSES] };
}

// MOCK_COURSES massivi birbaşa dəyişdirilir; spread operatoru işlənmədiyindən bütün oxuyucular
// dərhal yenilənmiş məlumatı görür — bu mock üçün əlverişlidir, real API-da belə olmazdı.
export async function approveCourse(id: number): Promise<ApiResponse<boolean>> {
  await delay();
  const c = MOCK_COURSES.find(x => x.id === id);
  if (c) { c.status = 'Approved'; MOCK_STATS.pendingCourses = Math.max(0, MOCK_STATS.pendingCourses - 1); }
  return { success: true, message: 'Təlim təsdiqləndi.' };
}

export async function rejectCourse(id: number): Promise<ApiResponse<boolean>> {
  await delay();
  const c = MOCK_COURSES.find(x => x.id === id);
  if (c) { c.status = 'Rejected'; MOCK_STATS.pendingCourses = Math.max(0, MOCK_STATS.pendingCourses - 1); }
  return { success: true, message: 'Təlim rədd edildi.' };
}

// splice massivdən elementi silir; findIndex -1 qaytararsa heç nə dəyişmir.
export async function deleteCourse(id: number): Promise<ApiResponse<boolean>> {
  await delay();
  const idx = MOCK_COURSES.findIndex(x => x.id === id);
  if (idx !== -1) { MOCK_COURSES.splice(idx, 1); MOCK_STATS.totalCourses = Math.max(0, MOCK_STATS.totalCourses - 1); }
  return { success: true, message: 'Təlim silindi.' };
}

export async function createAdminCourse(data: { title: string; instructor: string; category: string; link: string }): Promise<ApiResponse<AdminCourse>> {
  await delay();
  // Real API hazır olduqda bu blok real fetch ilə əvəz olunacaq
  const _token = getToken(); // auth üçün saxlanılıb
  void _token;
  // Date.now() unikal tam ədəd qaytarır; mock mühitdə sadə ID yaratmaq üçün kifayətdir.
  const newCourse: AdminCourse = {
    id: Date.now(),
    title: data.title,
    instructor: data.instructor,
    category: data.category,
    link: data.link,
    status: 'Approved',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  MOCK_COURSES.unshift(newCourse);
  MOCK_STATS.totalCourses += 1;
  return { success: true, message: 'Təlim əlavə edildi.', data: newCourse };
}

export async function getAdminUsers(): Promise<ApiResponse<AdminUser[]>> {
  await delay();
  return { success: true, message: 'OK', data: [...MOCK_USERS] };
}

export async function changeUserRole(userId: string, role: string): Promise<ApiResponse<boolean>> {
  await delay();
  const u = MOCK_USERS.find(x => x.id === userId);
  // roles massivi tamamilə əvəz edilir ki, istifadəçinin əvvəlki rolları silinsin.
  if (u) u.roles = [role];
  return { success: true, message: `Rol dəyişdirildi: ${role}` };
}

// isBlocked sahəsi hər çağırışda tersə çevrilir (toggle); eyni funksiya həm bloklayır, həm açır.
export async function toggleUserBlock(userId: string): Promise<ApiResponse<boolean>> {
  await delay();
  const u = MOCK_USERS.find(x => x.id === userId);
  if (u) u.isBlocked = !u.isBlocked;
  return { success: true, message: u?.isBlocked ? 'İstifadəçi bloklandı.' : 'Blok götürüldü.' };
}

export async function getAdminExams(): Promise<ApiResponse<AdminExam[]>> {
  await delay();
  return { success: true, message: 'OK', data: [...MOCK_EXAMS] };
}

export async function deleteExam(id: string): Promise<ApiResponse<boolean>> {
  await delay();
  const idx = MOCK_EXAMS.findIndex(x => x.id === id);
  if (idx !== -1) { MOCK_EXAMS.splice(idx, 1); }
  return { success: true, message: 'İmtahan sessiyası silindi.' };
}

// Real API-ya keçid üçün nümunə (gələcək üçün şablon):
// Bu funksiya real fetch nümunəsi kimi saxlanılır; token Authorization header-ə əlavə edilir.
export async function _realGetAdminStats(): Promise<ApiResponse<AdminStats>> {
  const token = getToken();
  const response = await fetch(`${API_URL}/admin/stats`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return response.json();
}
