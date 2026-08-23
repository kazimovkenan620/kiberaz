// ============================================================
// Kiberaz.az — Placeholder / Mock Data
// Bu fayl backend inteqrasiyası üçün hazırdır.
// Real API-lar hazır olduqda bu datalar əvəz olunacaq.
// ============================================================

export interface SliderItem {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  badge: string;
  highlights: string[];
  accentColor: string;
  icon: string;
}

export interface KnowledgeCategory {
  id: number;
  title: string;
  icon: string;
  description: string;
  questionCount: number;
  difficulty: string;
  topics: string[];
  color: string;
}

// ─── Quiz / Question Types ─────────────────────────────────────
export type DifficultyLevel = 'Başlanğıc' | 'Orta' | 'Peşəkar';
export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface QuestionOption {
  key: OptionKey;
  text: string;
  explanation: string; // Niyə doğru və ya yanlış olduğunun izahatı
}

export interface Question {
  id: number;
  categoryId: number;
  difficulty: DifficultyLevel;
  question: string;
  options: QuestionOption[];
  correctKey: OptionKey;
}

export interface ExamSession {
  id: string;
  title: string;
  instructor: string;
  studentCount: number;
  duration: string;
  status: 'Aktiv' | 'Gözlənilir' | 'Tamamlandı';
  category: string;
}

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

// ─── Slider / Hero Data ────────────────────────────────────────
export const sliderData: SliderItem[] = [
  {
    id: 1,
    title: 'Kibertəhlükəsizlik Təlimləri',
    subtitle: 'Peşəkar Təlimçilərlə',
    description: 'Azərbaycanda ən güclü kibertəhlükəsizlik platformasında real dünya hücum və müdafiə texnikalarını öyrənin.',
    ctaText: 'Təlimlərə Bax',
    ctaLink: '#courses',
    badge: 'Yeni Qrup',
    highlights: ['Network Security', 'Web Pentesting', 'Active Directory', 'SOC Analyst'],
    accentColor: '#3b82f6',
    icon: '🛡️',
  },
  {
    id: 2,
    title: 'Müsahibə sualları',
    subtitle: 'Junior → Senior Yolu',
    description: 'Real şirkətlərdə verilən kibertəhlükəsizlik müsahibə sualları ilə özünüzü sınayın və karyeranıza sürətlə başlayın.',
    ctaText: 'Biliklərə Bax',
    ctaLink: '#knowledge',
    badge: 'Populyar',
    highlights: ['500+ Sual', 'Real Case-lər', 'Video İzahlar', 'Cavab Açıqlamaları'],
    accentColor: '#8b5cf6',
    icon: '💼',
  },
  {
    id: 4,
    title: 'Onlayn İmtahan Sessiyaları',
    subtitle: 'Müəllim & Tələbə Platforması',
    description: 'Müəllimlər xüsusi imtahan sessiyaları yarada bilər. Tələbələr sessiya kodu ilə imtahana qoşulur.',
    ctaText: 'Sessiya Yarat',
    ctaLink: '#exam-session',
    badge: 'Yeni Xüsusiyyət',
    highlights: ['Real-vaxt Monitorinq', 'Avtomatik Qiymətləndirmə', 'Ətraflı Hesabat', 'Çoxlu Format'],
    accentColor: '#f59e0b',
    icon: '📝',
  },
  {
    id: 5,
    title: 'Canlı Liderlik Lövhəsi',
    subtitle: 'Rəqabət & Motivasiya',
    description: 'Ən yaxşı tələbələr arasında özünüzü sınayın. Həftəlik və aylıq reytinqlər ilə irəliləyişinizi izləyin.',
    ctaText: 'Liderlər Lövhəsinə Bax',
    ctaLink: '#leaderboard',
    badge: 'Canlı',
    highlights: ['Həftəlik Müsabiqə', 'Kateqoriya Filtrləri', 'Mükafat Sistemi', 'Profil Nişanları'],
    accentColor: '#ef4444',
    icon: '🥇',
  },
];

// ─── CourseAd və heroAdsData silindi ───────────────────────────
// Kurs datası artıq backend API-dan gəlir: GET /api/course
// Frontend servisi: src/services/courseService.ts
// ────────────────────────────────────────────────────────────────


// ─── Knowledge Categories ──────────────────────────────────────
// Kateqoriya datası artıq quizService-dən gəlir (dev: JSON, prod: API)
// Frontend servisi: src/services/quizService.ts
// ────────────────────────────────────────────────────────────────

// ─── Exam Sessions (Preview) ───────────────────────────────────
export const examSessions: ExamSession[] = [

  {
    id: 'KBR-2025-001',
    title: 'Network Security Final İmtahanı',
    instructor: 'Əli Həsənov',
    studentCount: 24,
    duration: '90 dəqiqə',
    status: 'Aktiv',
    category: 'Network',
  },
  {
    id: 'KBR-2025-002',
    title: 'OWASP Top 10 Quiz',
    instructor: 'Nigar Məmmədova',
    studentCount: 18,
    duration: '45 dəqiqə',
    status: 'Gözlənilir',
    category: 'Web Security',
  },
  {
    id: 'KBR-2025-003',
    title: 'Active Directory Praktik Simulyasiyası',
    instructor: 'Rauf İsmayılov',
    studentCount: 12,
    duration: '120 dəqiqə',
    status: 'Tamamlandı',
    category: 'Active Directory',
  },
];

// ─── Leaderboard ───────────────────────────────────────────────
export const leaderboardData: LeaderboardEntry[] = [
  {
    rank: 1,
    name: 'Anar Quliyev',
    username: '@anar_sec',
    score: 9870,
    badge: 'gold',
    avatar: 'AQ',
    category: 'Web Security',
    change: 'same',
    changeValue: 0,
  },
  {
    rank: 2,
    name: 'Leyla Abdullayeva',
    username: '@leyla_cyber',
    score: 9540,
    badge: 'silver',
    avatar: 'LA',
    category: 'Network',
    change: 'up',
    changeValue: 1,
  },
  {
    rank: 3,
    name: 'Turan Hüseynov',
    username: '@turan_h',
    score: 9210,
    badge: 'bronze',
    avatar: 'TH',
    category: 'SOC',
    change: 'up',
    changeValue: 2,
  },
  {
    rank: 4,
    name: 'Şəhriyar Rəhimov',
    username: '@shahri_r',
    score: 8950,
    badge: 'default',
    avatar: 'ŞR',
    category: 'Active Directory',
    change: 'down',
    changeValue: 1,
  },
  {
    rank: 5,
    name: 'Günel Məmmədli',
    username: '@gunel_m',
    score: 8720,
    badge: 'default',
    avatar: 'GM',
    category: 'Web Security',
    change: 'up',
    changeValue: 3,
  },
  {
    rank: 6,
    name: 'Elvin Babayev',
    username: '@elvin_sec',
    score: 8510,
    badge: 'default',
    avatar: 'EB',
    category: 'Code Review',
    change: 'down',
    changeValue: 2,
  },
  {
    rank: 7,
    name: 'Xədicə Sultanova',
    username: '@xedice_s',
    score: 8340,
    badge: 'default',
    avatar: 'XS',
    category: 'Network',
    change: 'up',
    changeValue: 1,
  },
];

export const navLinks = [
  { label: 'Ana Səhifə',    href: '#about'         },
  { label: 'Təlimlər',       href: '#home'           },
  { label: 'Biliklər',      href: '#knowledge'      },
  { label: 'İmtahan',       href: '#exam-session'   },
  { label: 'Liderlik',      href: '#leaderboard'    },
];

// ─── Quiz Questions ────────────────────────────────────────────
// Quiz sualları artıq quizService-dən gəlir:
//   Development: seed-data/quiz-questions.json (birbaşa JSON import)
//   Production:  GET /api/quiz/questions (database-dən)
// Frontend servisi: src/services/quizService.ts
