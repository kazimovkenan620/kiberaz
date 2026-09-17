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
export type AdminCourseRevision = {
  instructorName: string; instructorRole: string; instructorCompany?: string; instructorPhotoUrl?: string;
  linkedInUrl?: string; gitHubUrl?: string; contactEmail?: string; contactPhone?: string;
  courseTitle: string; kicker?: string; description: string; duration: string; level: string; language: string;
  syllabusTopics: string[]; syllabusFileUrl?: string; accentColor: string; submittedAt: string;
};

export type AdminCourse = {
  id: number;
  title: string;
  instructor: string;
  category: string;
  // Expired = 30 günlük aktiv müddət bitib ("Passiv").
  status: 'Approved' | 'Pending' | 'Rejected' | 'Expired';
  createdAt: string;
  link?: string;
  ownerNickname?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  // Sahibin göndərdiyi, təsdiq gözləyən redaktə — canlı nəşr hələ dəyişməyib.
  pendingRevision?: AdminCourseRevision | null;
  // Əvvəl nəşr olunmuş təlimin yenidən aktivləşdirmə sorğusu.
  isReactivation?: boolean;
  /** Saytda görünən cari məzmun — admin redaktə forması bununla doldurulur. */
  content?: AdminCourseRevision | null;
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
  /** Uğursuz giriş cəhdlərinə görə müvəqqəti (5 dəq) kilid — admin bloku deyil, öz-özünə açılır. */
  isTemporarilyLocked?: boolean;
  joinDate: string;
  // Aktiv VIP dövrünün sonu və qalan təlim krediti (yalnız VIP rolunda; aktiv dövr yoxdursa null).
  vipTermEndsAt?: string | null;
  vipCoursesRemaining?: number | null;
};

/** Bir hesabın tam kartı — yalnız admin "Bax" düyməsi ilə açılır (PII daşıyır). */
export type AdminUserDetail = AdminUser & {
  gender: number;
  profileImageUrl?: string | null;
  pendingNewEmail?: string | null;
  lockoutEnd?: string | null;
  failedAttempts: number;
  createdAt: string;

  hasActiveVipTerm: boolean;
  vipTermStartsAt?: string | null;
  vipCourseAllowance: number;
  vipCoursesUsed: number;
  vipTermCount: number;

  courseCount: number;
  activeCourseCount: number;
  examSessionCount: number;
  examAttemptCount: number;
  teacherClassCount: number;
  answeredQuestions: number;
  correctAnswers: number;
  lastActivityAt?: string | null;
};

export type AdminUpdateUserRequest = {
  firstName: string;
  lastName: string;
  nickname: string;
  gender: number;
  /** E-poçt təsdiqini əl ilə vermək (yalnız vermək olar, geri almaq yox). */
  confirmEmail: boolean;
};

// ── İmtahan sessiyası (real ExamSession qeydi) ────────────────
// Köhnə "AdminExam" tipi quiz kateqoriyasını imtahan kimi göstərirdi — kateqoriyalar artıq
// "Kateqoriyalar + suallar" bölməsindədir, burada isə həqiqi sessiyalar var.
export type AdminExamSession = {
  id: string;
  code: string;
  title: string;
  hostName: string;
  hostId?: string | null;
  durationMinutes: number;
  questionCount: number;
  createdAt: string;
  closedAt?: string | null;
  /** "Aktiv" | "Bağlı" */
  status: 'Aktiv' | 'Bağlı';
  participantCount: number;
  submittedCount: number;
  averageScore?: number | null;
};

export type AdminExamParticipant = {
  id: string;
  studentId: string;
  name: string;
  email?: string | null;
  startedAt: string;
  submittedAt?: string | null;
  answeredCount: number;
  correctCount?: number | null;
  percentage?: number | null;
};

export type AdminExamSessionDetail = {
  session: AdminExamSession;
  participants: AdminExamParticipant[];
};

// ── Sual bankı (kateqoriya + sual) ───────────────────────────
export type AdminQuizCategory = {
  id: number;
  title: string;
  icon: string;
  description: string;
  color: string;
  topics: string[];
  sortOrder: number;
  publicQuestionCount: number;
  examQuestionCount: number;
  totalQuestionCount: number;
  participantCount: number;
  createdAt: string;
  /** Soft-delete vəziyyəti — "Silinmişlər" siyahısında bərpa üçün. */
  isDeleted: boolean;
  deletedAt?: string | null;
};

export type QuizCategoryRequest = {
  title: string;
  icon: string;
  description: string;
  color: string;
  topics: string[];
  sortOrder: number;
};

export type AdminQuizOption = { key: string; text: string; explanation: string };

export type AdminQuizQuestion = {
  id: number;
  categoryId: number;
  categoryTitle: string;
  difficulty: string;
  question: string;
  correctKey: string;
  /** true = yalnız imtahan sessiyalarında işlənən məxfi sual. */
  isExamOnly: boolean;
  options: AdminQuizOption[];
  createdAt: string;
  updatedAt?: string | null;
  answerCount: number;
  isDeleted: boolean;
  deletedAt?: string | null;
};

/** Admin əməliyyat jurnalının sətri. */
export type AdminAuditEntry = {
  id: number;
  actorNickname: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  ip?: string | null;
  at: string;
};

export type AdminQuestionPage = {
  items: AdminQuizQuestion[];
  total: number;
  skip: number;
  take: number;
};

/** Yaratma sorğusu — bank (isExamOnly) yalnız yaradılarkən seçilir. */
export type CreateQuestionRequest = {
  categoryId: number;
  difficulty: string;
  question: string;
  correctKey: string;
  isExamOnly: boolean;
  options: AdminQuizOption[];
};

/** Düzəliş sorğusu — bank QƏSDƏN dəyişmir (server də rədd edir). */
export type UpdateQuestionRequest = Omit<CreateQuestionRequest, 'isExamOnly'>;

// ── Statistika tipi ──────────────────────────────────────────
export type AdminStats = {
  totalUsers: number;
  newUsersThisWeek: number;
  blockedUsers: number;
  unconfirmedUsers: number;
  usersByRole: Record<string, number>;
  activeVipTerms: number;

  totalCourses: number;
  pendingCourses: number;
  activeCourses: number;
  expiredCourses: number;
  rejectedCourses: number;
  expiringSoon: number;

  totalCategories: number;
  totalQuestions: number;
  publicQuestions: number;
  examOnlyQuestions: number;

  totalExamSessions: number;
  openExamSessions: number;
  closedExamSessions: number;
  totalExamAttempts: number;
  submittedAttempts: number;

  totalAnswers: number;
  correctAnswers: number;
  answersThisWeek: number;
};

// ============================================================
// KÖMƏKÇİ
// ============================================================

// Serverin cavabını təhlükəsiz açır. 403/500 kimi hallarda body JSON olmaya bilər —
// belə vəziyyətdə komponentin çökməməsi üçün standart formada xəta obyekti qaytarılır.
async function request_<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
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
  return request_<AdminStats>('/admin/stats');
}

// ============================================================
// TƏLİMLƏR
// ============================================================

export async function getAdminCourses(): Promise<ApiResponse<AdminCourse[]>> {
  return request_<AdminCourse[]>('/admin/courses');
}

export async function approveCourse(id: number): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/courses/${id}/approve`, { method: 'PATCH' });
}

export async function rejectCourse(id: number): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/courses/${id}/reject`, { method: 'PATCH' });
}

export async function deleteCourse(id: number): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/courses/${id}`, { method: 'DELETE' });
}

/// Sahibin gözləyən redaktəsini canlı nəşrin üzərinə yazır (aktiv müddət dəyişmir).
export async function approveCourseRevision(id: number): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/courses/${id}/revision/approve`, { method: 'PATCH' });
}

/// Gözləyən redaktəni atır; saytdakı versiya olduğu kimi qalır.
export async function rejectCourseRevision(id: number): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/courses/${id}/revision/reject`, { method: 'PATCH' });
}

/// Yeni 30 günlük VIP dövrü açır (1 təlim krediti); VIP rolu yoxdursa verilir.
export async function startVipTerm(userId: string): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/users/${encodeURIComponent(userId)}/vip-term`, { method: 'POST' });
}

/** Adminin birbaşa məzmun düzəlişi — gözləyən revizyon yaratmır, dərhal saytda görünür. */
export async function updateAdminCourse(
  id: number,
  request: Record<string, unknown>,
): Promise<ApiResponse<AdminCourse>> {
  return request_<AdminCourse>(`/admin/courses/${id}`, { method: 'PUT', body: JSON.stringify(request) });
}

export async function createAdminCourse(
  data: { title: string; instructor: string; category: string; link: string },
): Promise<ApiResponse<AdminCourse>> {
  return request_<AdminCourse>('/admin/courses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================
// İSTİFADƏÇİLƏR
// ============================================================

// Axtarış SERVER tərəfdə aparılır: siyahı məhdudlaşdırıldığı üçün müştəri tərəfdə
// filtrləmək axtarışı yarımçıq edərdi (yüklənməmiş istifadəçilər tapılmazdı).
export async function getAdminUsers(search?: string, take = 100): Promise<ApiResponse<AdminUser[]>> {
  const params = new URLSearchParams({ take: String(take) });
  if (search?.trim()) params.set('search', search.trim());
  return request_<AdminUser[]>(`/admin/users?${params.toString()}`);
}

// Server yalnız mövcud rolları qəbul edir və adminin ÖZ rolunu dəyişməsini bloklayır.
export async function changeUserRole(userId: string, role: string): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/users/${encodeURIComponent(userId)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

// Toggle: bloklanmış istifadəçinin bloku götürülür, bloklanmamış istifadəçi bloklanır.
// Server adminin özünü və sistemdəki son admini bloklamasına icazə vermir.
/** Bir hesabın tam kartı (profil + VIP + fəaliyyət). */
export async function getUserDetail(userId: string): Promise<ApiResponse<AdminUserDetail>> {
  return request_<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`);
}

/** Ad, soyad, ləqəb, cins düzəlişi (+ e-poçt təsdiqini əl ilə vermək). */
export async function updateUser(userId: string, body: AdminUpdateUserRequest): Promise<ApiResponse<AdminUserDetail>> {
  return request_<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT', body: JSON.stringify(body),
  });
}

/** Hesabı həmişəlik silir — geri qaytarılmır (server sahib hesabı və adminin özünü rədd edir). */
export async function deleteUser(userId: string): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

export async function toggleUserBlock(userId: string): Promise<ApiResponse<boolean>> {
  return request_<boolean>(`/admin/users/${encodeURIComponent(userId)}/block`, {
    method: 'PATCH',
  });
}

// ============================================================
// İMTAHAN SESSİYALARI
// ============================================================

export async function getExamSessions(search?: string, take = 200): Promise<ApiResponse<AdminExamSession[]>> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set('search', search.trim());
  params.set('take', String(take));
  return request_<AdminExamSession[]>(`/admin/exam-sessions?${params.toString()}`);
}

export async function getExamSessionDetail(id: string): Promise<ApiResponse<AdminExamSessionDetail>> {
  return request_<AdminExamSessionDetail>(`/admin/exam-sessions/${encodeURIComponent(id)}`);
}

// ============================================================
// KATEQORİYALAR + SUALLAR (sual bankı)
//
// Bu endpoint-lər /api/quiz altındadır (quiz domenidir), lakin yalnız admin paneli
// istifadə edir və hamısı serverdə [Authorize(Roles = Admin)] ilə qorunur.
// ============================================================

export async function getAdminCategories(deleted = false): Promise<ApiResponse<AdminQuizCategory[]>> {
  return request_<AdminQuizCategory[]>(`/quiz/admin/categories${deleted ? '?deleted=true' : ''}`);
}

/** Silinmiş kateqoriyanı və onunla birlikdə silinmiş sualları bərpa edir. */
export async function restoreQuizCategory(id: number): Promise<ApiResponse<number>> {
  return request_<number>(`/quiz/categories/${id}/restore`, { method: 'POST' });
}

export async function createQuizCategory(body: QuizCategoryRequest): Promise<ApiResponse<unknown>> {
  return request_<unknown>('/quiz/categories', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateQuizCategory(id: number, body: QuizCategoryRequest): Promise<ApiResponse<unknown>> {
  return request_<unknown>(`/quiz/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

/** Kaskad: kateqoriya ilə birlikdə onun bütün sualları da gizlədilir (soft delete). */
export async function deleteQuizCategory(id: number): Promise<ApiResponse<unknown>> {
  return request_<unknown>(`/quiz/categories/${id}`, { method: 'DELETE' });
}

export async function getAdminQuestions(params: {
  categoryId?: number | null; search?: string; difficulty?: string; examOnly?: boolean | null;
  deleted?: boolean; skip?: number; take?: number;
}): Promise<ApiResponse<AdminQuestionPage>> {
  const query = new URLSearchParams();
  if (params.deleted) query.set('deleted', 'true');
  if (params.categoryId) query.set('categoryId', String(params.categoryId));
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.difficulty) query.set('difficulty', params.difficulty);
  if (params.examOnly !== null && params.examOnly !== undefined) query.set('examOnly', String(params.examOnly));
  query.set('skip', String(params.skip ?? 0));
  query.set('take', String(params.take ?? 25));
  return request_<AdminQuestionPage>(`/quiz/admin/questions?${query.toString()}`);
}

export async function createQuizQuestion(body: CreateQuestionRequest): Promise<ApiResponse<unknown>> {
  return request_<unknown>('/quiz/questions', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateQuizQuestion(id: number, body: UpdateQuestionRequest): Promise<ApiResponse<AdminQuizQuestion>> {
  return request_<AdminQuizQuestion>(`/quiz/questions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function deleteQuizQuestion(id: number): Promise<ApiResponse<unknown>> {
  return request_<unknown>(`/quiz/questions/${id}`, { method: 'DELETE' });
}

/** Silinmiş sualı bərpa edir (kateqoriyası aktiv olmalıdır). */
export async function restoreQuizQuestion(id: number): Promise<ApiResponse<AdminQuizQuestion>> {
  return request_<AdminQuizQuestion>(`/quiz/questions/${id}/restore`, { method: 'POST' });
}

// ============================================================
// ƏMƏLİYYAT JURNALI
// ============================================================

export async function getAdminAudit(take = 50, search?: string): Promise<ApiResponse<AdminAuditEntry[]>> {
  const params = new URLSearchParams({ take: String(take) });
  if (search?.trim()) params.set('search', search.trim());
  return request_<AdminAuditEntry[]>(`/admin/audit?${params.toString()}`);
}
