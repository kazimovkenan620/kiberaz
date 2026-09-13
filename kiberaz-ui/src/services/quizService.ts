import type { KnowledgeCategory, Question, DifficultyLevel, OptionKey } from '../data/mockData';
import { apiFetch } from './apiClient';
import { getToken } from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5251/api';

// ApiResponse — bütün API cavabları eyni quruluşda gəlir: success bayrağı, mesaj və data.
// Generik <T> tipi sayəsində eyni interfeys həm kateqoriya, həm sual cavabları üçün istifadə olunur.
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

// ApiQuizCategory — servərdən gələn kateqoriya formatı; frontend-in KnowledgeCategory tipindən fərqlidir.
// Aşağıda .map() ilə bu format frontend tipinə çevrilir.
interface ApiQuizCategory {
  id: number;
  title: string;
  icon: string;
  description: string;
  color: string;
  topics: string[];
  questionCount: number;
  difficulty: string;
  sortOrder: number;
}

// ApiQuizOption — hər variant açar (A/B/C/D) və mətn cütündən ibarətdir.
interface ApiQuizOption {
  key: string;
  text: string;
}

// ApiQuizQuestion — servərdən gələn sual; doğru cavab submit zamanı ayrıca alınır,
// buna görə bu interfeysdə correctKey yoxdur.
interface ApiQuizQuestion {
  id: number;
  categoryId: number;
  difficulty: string;
  question: string;
  options: ApiQuizOption[];
}

// ApiSubmitOptionResult — cavab göndərildikdən sonra hər variant üçün izah gəlir.
interface ApiSubmitOptionResult {
  key: string;
  explanation: string;
}

// ApiSubmitAnswerResponse — submit nəticəsi: cavabın doğruluğu, düzgün açar və bütün variantların izahları.
interface ApiSubmitAnswerResponse {
  isCorrect: boolean;
  correctKey: string;
  options: ApiSubmitOptionResult[];
}

export const NETWORK_MAIN_ID = 2;
export const NETWORK_SUB_ID = 8;

export type NetworkTopicFilter = 'Qarışıq' | 'Network Security' | 'Network Attacks';

// Fix 4: try-catch əlavə edildi — şəbəkə xətasında [] qaytarır
export async function fetchQuizCategories(): Promise<KnowledgeCategory[]> {
  try {
    const res = await fetch(`${API_URL}/quiz/categories`);
    if (!res.ok) return [];
    const json: ApiResponse<ApiQuizCategory[]> = await res.json();
    if (!json.success || !json.data) return [];

    // Alt-kateqoriyalar adı '_' ilə başlayır; bunlar UI-da göstərilmir, yalnız daxili istifadə üçündür.
    return json.data
      .filter(c => !c.title.startsWith('_'))
      .map(c => ({
        id: c.id,
        title: c.title,
        icon: c.icon,
        description: c.description,
        questionCount: c.questionCount,
        difficulty: c.difficulty,
        topics: c.topics,
        color: c.color,
      }));
  } catch {
    return [];
  }
}

// Fix 4 + Fix 6: try-catch + Qarışıq rejimində count/2 çəkilir
export async function fetchQuizQuestions(
  categoryId: number,
  difficulty?: string | null,
  count: number = 10,
  topicFilter?: NetworkTopicFilter,
): Promise<Question[]> {
  // Qarışıq rejim: suallar iki kateqoriyaya bölünüb (Network Security = 2, Network Attacks = 8),
  // ona görə hər ikisindən çəkilib qarışdırılır.
  //
  // ⚠ ƏVVƏLKİ BUG: hər tərəfdən DƏQİQ count/2 istənilirdi və bir tərəf az qaytaranda
  // fərq kompensasiya edilmirdi. Məsələn "Başlanğıc" səviyyəsində Network Attacks
  // kateqoriyasında heç bir sual yoxdur — nəticədə 10 sual istəyən istifadəçi 5 sual alırdı,
  // halbuki digər kateqoriyada 77 uyğun sual var idi. İstifadəçiyə heç bir xəbərdarlıq da verilmirdi.
  //
  // İNDİ: hər tərəfdən `count` qədər çəkilir (server onsuz da 50 ilə məhdudlaşdırır),
  // balanslı şəkildə yarı-yarı götürülür, çatmayan tərəfin payı isə digərindən tamamlanır.
  if (categoryId === NETWORK_MAIN_ID && (!topicFilter || topicFilter === 'Qarışıq')) {
    try {
      const [securityQuestions, attackQuestions] = await Promise.all([
        fetchQuizQuestions(NETWORK_MAIN_ID, difficulty, count, 'Network Security'),
        fetchQuizQuestions(NETWORK_SUB_ID, difficulty, count, 'Network Attacks'),
      ]);

      const half = Math.ceil(count / 2);

      // Əvvəlcə balanslı pay: hər tərəfdən mümkün qədər yarı.
      const securityTake = Math.min(securityQuestions.length, half);
      const attackTake = Math.min(attackQuestions.length, count - securityTake);
      const picked = [
        ...securityQuestions.slice(0, securityTake),
        ...attackQuestions.slice(0, attackTake),
      ];

      // Bir tərəf az qaytarıbsa, qalan yer digər tərəfin artıq suallarından doldurulur.
      if (picked.length < count) {
        const leftovers = [
          ...securityQuestions.slice(securityTake),
          ...attackQuestions.slice(attackTake),
        ];
        picked.push(...leftovers.slice(0, count - picked.length));
      }

      return shuffle(picked);
    } catch {
      return [];
    }
  }

  // Network Attacks seçildikdə əslində NETWORK_SUB_ID (8) istifadə olunur,
  // çünki bu suallar servərdə ayrı kateqoriya kimi saxlanılır.
  const effectiveCategoryId =
    categoryId === NETWORK_MAIN_ID && topicFilter === 'Network Attacks'
      ? NETWORK_SUB_ID
      : categoryId;

  const params = new URLSearchParams({
    categoryId: String(effectiveCategoryId),
    count: String(count),
  });

  if (difficulty && difficulty !== 'Qarışıq') {
    params.set('difficulty', difficulty);
  }

  // Fix 4: try-catch əlavə edildi
  try {
    const res = await fetch(`${API_URL}/quiz/questions?${params}`);
    if (!res.ok) return [];
    const json: ApiResponse<ApiQuizQuestion[]> = await res.json();
    if (!json.success || !json.data) return [];

    // Servərdən gələn sual formatı frontend tipinə çevrilir;
    // correctKey və explanation submit zamanı doldurulacaq, ona görə burada boş saxlanılır.
    let questions: Question[] = json.data.map(q => ({
      id: q.id,
      categoryId: q.categoryId,
      difficulty: q.difficulty as DifficultyLevel,
      question: q.question,
      correctKey: '' as OptionKey,
      options: q.options.map(o => ({
        key: o.key as OptionKey,
        text: o.text,
        explanation: '',
      })),
    }));

    if (categoryId === NETWORK_MAIN_ID && topicFilter === 'Network Security') {
      questions = questions.filter(q => q.categoryId === NETWORK_MAIN_ID);
    }

    return questions;
  } catch {
    return [];
  }
}

// Cavab göndərildikdən sonra servər hansının düzgün olduğunu və hər variantın izahını qaytarır;
// bu məlumat birbaşa UI-da göstərilir ki, istifadəçi niyə səhv etdiyini anlasın.
//
// Endpoint artıq GİRİŞ TƏLƏB EDİR. Əvvəl funksiya bütün uğursuzluqlarda `null` qaytarırdı —
// yəni "giriş lazımdır", "limit doldu" və "server xətası" UI-da eyni mətnlə görünürdü.
// İndi nəticə ayrı-ayrı hallara bölünür ki, istifadəçiyə düzgün addım deyilsin.
export type SubmitAnswerResult =
  | { status: 'ok'; isCorrect: boolean; correctKey: OptionKey; options: { key: OptionKey; explanation: string }[] }
  | { status: 'auth-required' }
  | { status: 'rate-limited'; message: string }
  | { status: 'error'; message: string };

export async function submitAnswer(
  questionId: number,
  selectedKey: string,
): Promise<SubmitAnswerResult> {
  // Token yoxdursa serverə heç getmirik: cavab onsuz da 401 olacaq,
  // bu isə apiClient-də lazımsız refresh cəhdini tetikleyir.
  if (!getToken()) return { status: 'auth-required' };

  try {
    const res = await apiFetch('/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedKey }),
    });

    // apiFetch 401-də bir dəfə refresh edib təkrarlayır; yenə 401-dirsə sessiya həqiqətən bitib.
    if (res.status === 401) return { status: 'auth-required' };

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      return {
        status: 'rate-limited',
        message: Number.isFinite(retryAfter) && retryAfter > 0
          ? `Çox sürətli cavab göndərilir. ${retryAfter} saniyə sonra davam edin.`
          : 'Çox sürətli cavab göndərilir. Bir az sonra davam edin.',
      };
    }

    if (!res.ok) return { status: 'error', message: `Cavab yoxlanılmadı (${res.status}).` };

    const json: ApiResponse<ApiSubmitAnswerResponse> = await res.json();
    if (!json.success || !json.data) {
      return { status: 'error', message: json.message || 'Cavab yoxlanılmadı.' };
    }

    return {
      status:     'ok',
      isCorrect:  json.data.isCorrect,
      correctKey: json.data.correctKey as OptionKey,
      options:    (json.data.options ?? []).map(o => ({
        key:         o.key as OptionKey,
        explanation: o.explanation,
      })),
    };
  } catch {
    return { status: 'error', message: 'Serverlə əlaqə yaradıla bilmədi.' };
  }
}

// Fisher-Yates alqoritmi ilə massivi yerindəcə qarışdırır;
// hər mövqe üçün özündən sonrakılar arasından təsadüfi bir element seçilir və dəyişdirilir.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Liderlik Lövhəsi ────────────────────────────────────────

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all';

// Servərdən gələn format. name = ləqəb (ad/soyad ictimai göndərilmir),
// username = "142 cavab · 87% dəqiqlik" statistikası.
export interface LeaderboardEntry {
  rank: number;
  name: string;
  username: string;
  score: number;
  badge: 'gold' | 'silver' | 'bronze' | 'default';
  avatar: string;
  category: string;
  change: 'up' | 'down' | 'same';
  changeValue: number;
}

// Şəbəkə xətasında boş massiv qaytarır — komponent "hələ data yoxdur" vəziyyətini göstərir.
export async function fetchLeaderboard(
  period: LeaderboardPeriod = 'all',
  categoryId?: number | null,
  limit: number = 10,
): Promise<LeaderboardEntry[]> {
  try {
    const params = new URLSearchParams({ period, limit: String(limit) });
    if (categoryId != null) params.set('categoryId', String(categoryId));

    const res = await fetch(`${API_URL}/quiz/leaderboard?${params.toString()}`);
    if (!res.ok) return [];

    const json: ApiResponse<LeaderboardEntry[]> = await res.json();
    if (!json.success || !json.data) return [];

    return json.data;
  } catch {
    return [];
  }
}
