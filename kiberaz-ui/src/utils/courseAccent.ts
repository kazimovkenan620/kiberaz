// ─── Kurs vurğu rəngi ─────────────────────────────────────────
//
// API kontraktı: `accentColor` sahəsi yalnız aşağıdakı token adlarından birini
// qəbul edir (CreateCourseRequestValidator.AllowedAccentColors). Backend-ə həmişə
// bu adlar göndərilir; ekranda isə hər ad dizayn sistemindəki real rəngə xəritələnir.
// Backend-dən gələn naməlum dəyər heç vaxt CSS-ə birbaşa ötürülmür.

export const COURSE_ACCENT_TOKENS = [
  '--brand-primary', '--brand-gold', '--brand-success', '--brand-danger', '--text-primary', '--text-secondary',
] as const;

export type CourseAccentToken = typeof COURSE_ACCENT_TOKENS[number];

const ACCENT_MAP: Record<CourseAccentToken, string> = {
  '--brand-primary':  'var(--brand)',
  '--brand-gold':     'var(--warning)',
  '--brand-success':  'var(--success)',
  '--brand-danger':   'var(--danger)',
  '--text-primary':   'var(--text-1)',
  '--text-secondary': 'var(--text-2)',
};

export function isCourseAccentToken(value: unknown): value is CourseAccentToken {
  return typeof value === 'string' && (COURSE_ACCENT_TOKENS as readonly string[]).includes(value);
}

/** Token adını CSS rəng ifadəsinə çevirir; naməlum dəyər brend rənginə düşür. */
export function courseAccentColor(token: string | undefined): string {
  return isCourseAccentToken(token) ? ACCENT_MAP[token] : ACCENT_MAP['--brand-primary'];
}

/** Yeni kurs üçün default token — dizayn sistemində vurğu brend qırmızısıdır. */
export const DEFAULT_COURSE_ACCENT: CourseAccentToken = '--brand-primary';
