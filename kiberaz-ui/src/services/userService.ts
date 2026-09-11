import { apiFetch } from './apiClient';

// ProfileResponse — istifadəçinin profil səhifəsində göstəriləcək bütün sahələri ehtiva edir.
// roles massivi bir istifadəçinin eyni anda birdən çox rol daşıya biləcəyini göstərir (məs. Teacher + VIP).
export type ProfileResponse = {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: number;
  joinDate: string;
  roles: string[];
  profileImageUrl: string | null;
};

// StudentOverviewResponse — tələbənin imtahan tarixçəsini və inkişaf faizlərini bir cavabda birləşdirir.
// summary sahəsi dashboard kartlarında, examSessions isə cədvəldə göstərilir.
export type StudentOverviewResponse = {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  joinDate: string;
  summary: {
    examsTaken: number;
    averageScore: number;
    bestScore: number;
    totalPoints: number;
    overallProgress: number;
  };
  examSessions: {
    id: string;
    title: string;
    date: string;
    score: number;
    maxScore: number;
    percentage: number;
    status: string;
  }[];
  progressAreas: {
    area: string;
    solved: number;
    total: number;
    percentage: number;
    /** Bu sahədə ən son cavab verilən an — "Son fəallıq" göstəricisi üçün. */
    lastActivity: string | null;
  }[];
};

// TeacherClassStudentResponse — müəllimin sinif siyahısında hər tələbə üçün göstəriləcək məlumat.
// summary sahəsi StudentOverviewResponse-dan götürülür ki, eyni tip iki yerdə təkrarlanmasın.
export type TeacherClassStudentResponse = {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  addedAt: string;
  summary: StudentOverviewResponse['summary'];
};

// TeacherClassResponse — bir sinfin bütün məlumatlarını tələbə siyahısı ilə birlikdə qaytarır.
export type TeacherClassResponse = {
  id: number;
  name: string;
  createdAt: string;
  studentCount: number;
  students: TeacherClassStudentResponse[];
};

// ApiResponse<T> — bütün servis funksiyaları bu ümumi quruluşu qaytarır.
// Generik tip sayəsində hər funksiya öz data tipini müəyyən edir, kod təkrarlanmır.
type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
};

// HTTP status kodlarına görə fərqli xəta mesajları qaytarılır;
// 401 tokenin bitdiyini, 403 isə icazə olmadığını bildirir.
async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (response.ok) {
    return data as ApiResponse<T>;
  }

  if (response.status === 401) {
    return { success: false, message: 'Sessiyanız bitib. Zəhmət olmasa yenidən daxil olun.' };
  }

  if (response.status === 403) {
    return { success: false, message: 'Bu bölməyə giriş icazəniz yoxdur.' };
  }

  return data ?? { success: false, message: 'Sorğu icra edilmədi.' };
}

// Bazadan canlı profil məlumatını çəkir.
// apiFetch JWT token-i Authorization header-ə əlavə edir və 401-də avtomatik refresh edir.
export async function getProfile(): Promise<ApiResponse<ProfileResponse>> {
  const response = await apiFetch('/user/profile', { method: 'GET' });
  return readApiResponse<ProfileResponse>(response);
}

// Profili yeniləyir — Ad, Soyad, Cins.
export async function updateProfile(data: { firstName: string; lastName: string; nickname: string; gender: number }): Promise<ApiResponse<ProfileResponse>> {
  const response = await apiFetch('/user/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return readApiResponse<ProfileResponse>(response);
}

export async function requestEmailChange(newEmail: string): Promise<ApiResponse<boolean>> {
  const response = await apiFetch('/user/profile/change-email', {
    method: 'POST',
    body: JSON.stringify({ newEmail }),
  });
  return readApiResponse<boolean>(response);
}

export async function requestPasswordChange(): Promise<ApiResponse<boolean>> {
  const response = await apiFetch('/user/profile/request-password-change', {
    method: 'POST',
  });
  return readApiResponse<boolean>(response);
}

// studentId URL-ə daxil ediləndən əvvəl encodeURIComponent ilə kodlanır;
// bu, xüsusi simvolların URL-i sındırmasının qarşısını alır.
// Cari istifadəçinin öz göstəriciləri. Server ID-ni token-dən götürür,
// ona görə burada heç bir identifikator ötürülmür.
export async function getMyOverview(): Promise<ApiResponse<StudentOverviewResponse>> {
  const response = await apiFetch('/user/me/overview', { method: 'GET' });
  return readApiResponse<StudentOverviewResponse>(response);
}

export async function getStudentOverview(studentId: string): Promise<ApiResponse<StudentOverviewResponse>> {
  const response = await apiFetch(`/user/students/${encodeURIComponent(studentId)}/overview`, {
    method: 'GET',
  });
  return readApiResponse<StudentOverviewResponse>(response);
}

export async function getTeacherClasses(): Promise<ApiResponse<TeacherClassResponse[]>> {
  const response = await apiFetch('/user/teacher/classes', {
    method: 'GET',
  });
  return readApiResponse<TeacherClassResponse[]>(response);
}

export async function createTeacherClass(name: string): Promise<ApiResponse<TeacherClassResponse>> {
  const response = await apiFetch('/user/teacher/classes', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return readApiResponse<TeacherClassResponse>(response);
}

export async function addStudentToClass(classId: number, studentId: string): Promise<ApiResponse<TeacherClassResponse>> {
  const response = await apiFetch(`/user/teacher/classes/${classId}/students`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
  return readApiResponse<TeacherClassResponse>(response);
}

// Sinfi silir. Müəllim → tələbə rol keçidi üçün ön şərtdir:
// server sinifi olan müəllimin rolunu dəyişmir.
export async function deleteTeacherClass(classId: number): Promise<ApiResponse<boolean>> {
  const response = await apiFetch(`/user/teacher/classes/${classId}`, {
    method: 'DELETE',
  });
  return readApiResponse<boolean>(response);
}

// Yalnız bu iki dəyər qəbul edilir. Tip səviyyəsində məhdudlaşdırmaq
// 'Admin' kimi dəyərin təsadüfən göndərilməsini kompilyasiya vaxtı bağlayır —
// server onsuz da rədd edir, bu isə səhvi daha erkən tutur.
export type SwitchableRole = 'User' | 'Teacher';

// Rol keçidi. UĞURDAN SONRA SESSİYA ETİBARSIZDIR:
// server SecurityStamp-i yeniləyir və refresh token-i silir, ona görə
// çağıran tərəf mütləq logout edib istifadəçini yenidən girişə yönləndirməlidir.
export async function changeRole(newRole: SwitchableRole): Promise<ApiResponse<boolean>> {
  const response = await apiFetch('/user/role', {
    method: 'PATCH',
    body: JSON.stringify({ newRole }),
  });
  return readApiResponse<boolean>(response);
}
