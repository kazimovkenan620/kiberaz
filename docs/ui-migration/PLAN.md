# Kiberaz.az — Frontend UI migration plan (Light/Dark design system)

Branch: `feat/ui-migration-light-dark` (from `origin/develop` @ d311637)
Working copy: cloned from GitHub in the cloud workspace; the user's local checkout
(`C:\Users\User\Desktop\kiberaz`, branch `develop`) matched `origin/develop` for the
whole frontend at Phase 0 (only CRLF differences). Uncommitted user work found and
left untouched: `AGENTS.md` (9 changed lines), untracked `SENIOR-RULES.md`.

> Resume protocol: re-read `AGENTS.md`, `SENIOR-RULES.md`, this file, then
> `git log --oneline` and `git status --short` before touching anything.

## 1. Real architecture found (Phase 0)

- `kiberaz-ui/`: React 19.2.5, TypeScript ~6.0, Vite 8, `lucide-react` 1.14, `@marsidev/react-turnstile` 1.5.
  ESLint 10 flat config (`js.recommended`, `tseslint.recommended`, `react-hooks` flat recommended, `react-refresh`).
- No React Router. `App.tsx` switches screens with state (`showDashboard`, `activeQuizCategoryId`),
  hash anchors (`#about #home #knowledge #exam-session #leaderboard`) and pathname checks for
  `/reset-password`, `/confirm-email`, `/confirm-email-change`, `/google-login-callback`.
- Components (all colocated `.tsx` + `.css`): `Navbar` (login form + Register/Forgot modals + Turnstile),
  `AboutSection`, `HeroSlider` (course discovery + AddCourse + CourseDetails modals), `KnowledgeCategories`,
  `QuizView`, `ExamSession` (create/join/player/teacher dashboard), `Leaderboard`, `UserDashboard`
  (cabinet + teacher classes + profile + role switch; mounts `AdminPanel` tabs), `AdminPanel`
  (exports `DashboardTab/CoursesTab/UsersTab/ExamsTab/Toast`; its default `AdminPanel` shell is dead code),
  `Footer`.
- Services: `apiClient` (access token in sessionStorage, refresh via HttpOnly cookie, single-flight refresh),
  `authService`, `courseService`, `quizService`, `examSessionService`, `userService`, `adminService`.
- `data/mockData.ts`: shared types (`KnowledgeCategory`, `Question`, …) + `navLinks`; also contains dead
  mock arrays (`sliderData`, `examSessions`, `leaderboardData`) that nothing imports.
- Global tokens in `src/index.css` ("Refined Dark Tactical": cyan `#00d4ff`, gold, purple, glows, noise, scanline).
  Fonts: DM Sans + JetBrains Mono via Google Fonts in `index.html`. `color-scheme: dark` only.
- Backend contract that constrains the UI: `CreateCourseRequestValidator.AllowedAccentColors =
  --brand-primary | --brand-gold | --brand-success | --brand-danger | --text-primary | --text-secondary`.
  The frontend must keep sending these names; visually they are mapped to the new tokens.
- Category data (`/api/quiz/categories`): `icon` is an emoji, `color` is a hex; sub-categories start with `_`.

## 2. Baseline verification (before any change)

| Command | Result |
|---|---|
| `npm run build` | ✅ pass |
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ pass |
| `npm run lint` | ❌ 9 errors + 1 warning (pre-existing, see §7) |

## 3. Phases

| # | Phase | Status |
|---|---|---|
| 0 | Baseline, branch, PLAN.md | done |
| 1 | Design foundation (tokens, themes, typography, base primitives, ThemeToggle) | done |
| 2 | Shared shells (header, layout, dashboard shell, modal, footer, states, scroll-top, cookie) | todo |
| 3 | Public experience (About/home, course discovery, KnowledgeCategories, Leaderboard) | todo |
| 4 | Quiz (setup, active, auth gate, result) | todo |
| 5 | Exam (create, join, player, teacher dashboard) | todo |
| 6 | Cabinet (overview, progress, sessions, classes, profile, role flow) | todo |
| 7 | Admin (overview, courses, users, exams) | todo |
| 8 | Auth special pages | todo |
| 9 | Responsive + accessibility pass | todo |
| 10 | Legacy cleanup | todo |
| 11 | Regression + quality gate + final report | todo |

## 4. Files created / heavily modified / deleted

### Phase 1
- Rewritten: `kiberaz-ui/src/index.css` (new token system, light/dark, reset, base primitives: buttons,
  cards, badges, fields, tabs, progress, tables, states, modal, toast), `kiberaz-ui/index.html`
  (Inter + JetBrains Mono, pre-paint theme script, theme-color meta).
- Created: `src/hooks/useTheme.ts`, `src/components/ui/{Button,IconButton,Badge,Card,StatCard,ProgressBar,
  Tabs,FormField,SearchField,Modal,ConfirmDialog,States,ThemeToggle,Toast,index}.tsx`,
  `src/utils/{buttonClass,formA11y,courseAccent,categoryIcon}.ts(x)`.
- Verification: `tsc` ✅, `npm run build` ✅, `eslint src/components/ui src/hooks src/utils` ✅.

## 5. Design decisions

- Theme mechanism: `<html data-theme="light|dark">`; preference in `localStorage['kiberaz-theme']`
  (theme only — tokens never); OS preference as initial fallback; inline pre-paint script in `index.html`
  to avoid a wrong-theme flash; `color-scheme` follows the theme; Turnstile `theme` option follows the theme.
- Fonts: Inter (400–800) as the single sans family, JetBrains Mono for technical content. Both have full
  Azerbaijani coverage (`ə Ə ğ Ğ ı İ ö Ö ü Ü ş Ş ç Ç`).
- Course `accentColor` stays an API token name; `utils/courseAccent.ts` maps it to a design-system color.
- Category emoji icons are mapped to lucide icons for the sidebar (fallback: the emoji itself); the
  category hex `color` is used only as a subtle dot, never as a UI accent.

## 6. Deviations from the prompt

- (none yet)

## 7. Pre-existing issues (not caused by the migration)

`npm run lint` on `origin/develop`:
- `react-hooks/set-state-in-effect`: App.tsx:248, AdminPanel.tsx:147/577/695, HeroSlider.tsx:373/409, Leaderboard.tsx:49
- `no-useless-assignment`: authService.ts:88, courseService.ts:64 (service files — out of migration scope)
- warning `react-hooks/exhaustive-deps`: QuizView.tsx:63

## 8. Open questions / known gaps

- Git push from the workspace is not authorized for this repository; delivery is via files written to the
  user's folder + a git bundle of the branch.
