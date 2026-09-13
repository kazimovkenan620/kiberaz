// ============================================================
// Kiberaz.az — Ortaq frontend tipləri və statik naviqasiya
//
// Kurs, kateqoriya, sual və liderlik məlumatları backend API-dən gəlir
// (services/*). Bu faylda yalnız paylaşılan tiplər və bölmə linkləri qalır.
// ============================================================

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
  explanation: string; // Niyə doğru və ya yanlış olduğunun izahatı (yalnız submit cavabından doldurulur)
}

export interface Question {
  id: number;
  categoryId: number;
  difficulty: DifficultyLevel;
  question: string;
  options: QuestionOption[];
  correctKey: OptionKey; // yüklənəndə boşdur; yalnız serverin submit cavabı ilə dolur
}

// ─── Bölmə linkləri (hash kontraktı App.tsx ilə paylaşılır) ────
export const navLinks = [
  { label: 'Ana Səhifə',    href: '#about'         },
  { label: 'Təlimlər',       href: '#home'           },
  { label: 'Biliklər',      href: '#knowledge'      },
  { label: 'İmtahan',       href: '#exam-session'   },
  { label: 'Liderlik',      href: '#leaderboard'    },
];
