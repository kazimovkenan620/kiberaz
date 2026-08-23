import type { KnowledgeCategory, Question, DifficultyLevel, OptionKey } from '../data/mockData';
import { apiFetch } from './apiClient';

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
  // Fix 6: Qarışıq rejimində hər alt-kateqoriyadan count/2 çəkilir (əvvəl count idi)
  // Network Security və Network Attacks sualları ayrı-ayrı çəkilib, qarışdırılır və kəsilir.
  if (categoryId === NETWORK_MAIN_ID && (!topicFilter || topicFilter === 'Qarışıq')) {
    const half = Math.ceil(count / 2);
    try {
      const [securityQuestions, attackQuestions] = await Promise.all([
        fetchQuizQuestions(NETWORK_MAIN_ID, difficulty, half, 'Network Security'),
        fetchQuizQuestions(NETWORK_SUB_ID, difficulty, half, 'Network Attacks'),
      ]);
      return shuffle([...securityQuestions, ...attackQuestions]).slice(0, count);
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

// Fix 3: bütün 4 variantın izahı qaytarılır indi
// Cavab göndərildikdən sonra servər hansının düzgün olduğunu və hər variantın izahını qaytarır;
// bu məlumat birbaşa UI-da göstərilir ki, istifadəçi niyə səhv etdiyini anlasın.
export async function submitAnswer(
  questionId: number,
  selectedKey: string,
): Promise<{ isCorrect: boolean; correctKey: OptionKey; options: { key: OptionKey; explanation: string }[] } | null> {
  try {
    const res = await apiFetch('/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedKey }),
    });
    if (!res.ok) return null;
    const json: ApiResponse<ApiSubmitAnswerResponse> = await res.json();
    if (!json.success || !json.data) return null;

    return {
      isCorrect:  json.data.isCorrect,
      correctKey: json.data.correctKey as OptionKey,
      options:    (json.data.options ?? []).map(o => ({
        key:         o.key as OptionKey,
        explanation: o.explanation,
      })),
    };
  } catch {
    return null;
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
