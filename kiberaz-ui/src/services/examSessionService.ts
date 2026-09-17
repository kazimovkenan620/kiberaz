import { apiFetch } from './apiClient';

export type ApiResponse<T> = { success: boolean; message: string; data?: T; errors?: string[] };
export type ExamCategory = { id: number; title: string; questionCount: number };
export type ExamSessionInfo = {
  id: string; code: string; title: string; teacherName: string; durationMinutes: number;
  questionCount: number; createdAt: string; isClosed: boolean;
};
export type ExamQuestion = {
  id: string; category: string; text: string; options: { key: string; text: string }[];
};
export type ExamAttempt = {
  id: string; session: ExamSessionInfo; serverNow: string; expiresAt: string;
  submittedAt: string | null; correctCount: number | null; percentage: number | null;
  revision: number; answers: Record<string, string>; questions: ExamQuestion[];
};
export type ExamAttemptSummary = {
  id: string; session: ExamSessionInfo; startedAt: string; submittedAt: string | null;
  correctCount: number | null; percentage: number | null;
};
// Günlük kvota yalnız VIP hesablar üçün gəlir (digərləri üçün null). Məlumat məqsədlidir —
// həqiqi limit serverdə, yaratma anında yoxlanılır; UI yalnız sayğacı və izahı göstərir.
export type ExamQuota = { dailyLimit: number; usedToday: number; remaining: number; resetsAt: string };
export type ExamOverview = { sessions: ExamSessionInfo[]; attempts: ExamAttemptSummary[]; quota?: ExamQuota | null };
export type ExamParticipant = {
  id: string; name: string; startedAt: string; submittedAt: string | null;
  answeredCount: number; correctCount: number | null; percentage: number | null;
};
export type ExamDashboard = { session: ExamSessionInfo; participants: ExamParticipant[] };

async function read<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get('content-type') ?? '';
  const body: unknown = contentType.includes('application/json') ? await response.json() : null;
  if (body && typeof body === 'object') {
    const parsed = body as ApiResponse<T>;
    // Qlobal rate-limiter 429 cavabında errors=['RATE_LIMIT'] və oxunaqlı `message` göndərir —
    // istifadəçiyə texniki kodu deyil, mesajı göstəririk. Günlük sessiya limiti (servis 429) isə
    // mətnini birbaşa errors[0]-da daşıyır və olduğu kimi keçir.
    if (response.status === 429 && parsed.errors?.[0] === 'RATE_LIMIT') {
      return { ...parsed, errors: [parsed.message || 'Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin.'] };
    }
    return parsed;
  }
  if (response.status === 429) return { success: false, message: 'Çox sayda sorğu göndərildi. Bir az sonra yenidən cəhd edin.' };
  return { success: false, message: response.ok ? 'Boş server cavabı alındı.' : 'Sorğu icra edilmədi.' };
}

export const getExamCategories = async () => read<ExamCategory[]>(await apiFetch('/exam-sessions/categories'));
export const getExamOverview = async () => read<ExamOverview>(await apiFetch('/exam-sessions/mine'));
export const createExamSession = async (request: {
  title: string; durationMinutes: number; categories: { categoryId: number; count: number }[];
}) => read<ExamSessionInfo>(await apiFetch('/exam-sessions', { method: 'POST', body: JSON.stringify(request) }));
export const joinExamSession = async (code: string) => read<ExamAttempt>(await apiFetch('/exam-sessions/join', {
  method: 'POST', body: JSON.stringify({ code }),
}));
export const getExamAttempt = async (id: string) => read<ExamAttempt>(await apiFetch(`/exam-sessions/attempts/${encodeURIComponent(id)}`));
export const saveExamAnswer = async (id: string, questionId: string, optionKey: string, revision: number) =>
  read<ExamAttempt>(await apiFetch(`/exam-sessions/attempts/${encodeURIComponent(id)}/answer`, {
    method: 'PUT', body: JSON.stringify({ questionId, optionKey, revision }),
  }));
export const submitExamAttempt = async (id: string) => read<ExamAttempt>(await apiFetch(
  `/exam-sessions/attempts/${encodeURIComponent(id)}/submit`, { method: 'POST' },
));
export const getExamDashboard = async (code: string) => read<ExamDashboard>(await apiFetch(
  `/exam-sessions/${encodeURIComponent(code)}/dashboard`,
));
export const closeExamSession = async (code: string) => read<ExamSessionInfo>(await apiFetch(
  `/exam-sessions/${encodeURIComponent(code)}/close`, { method: 'POST' },
));
