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
| 2 | Shared shells (header, layout, dashboard shell, modal, footer, states, scroll-top, cookie) | done |
| 3 | Public experience (About/home, course discovery, KnowledgeCategories, Leaderboard) | done |
| 4 | Quiz (setup, active, auth gate, result) | done |
| 5 | Exam (create, join, player, teacher dashboard) | done |
| 6 | Cabinet (overview, progress, sessions, classes, profile, role flow) | done |
| 7 | Admin (overview, courses, users, exams) | done |
| 8 | Auth special pages | done |
| 9 | Responsive + accessibility pass | done |
| 10 | Legacy cleanup | done |
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

### Phase 2
- Rewritten: `Navbar.tsx/.css` (sticky header: brand, nav, theme toggle, user menu, mobile drawer; login moved
  from the inline header form into `LoginModal`), `Footer.tsx/.css`, `App.tsx/.css` (header now rendered in the
  cabinet too, `handleNavigate` for section links, auth special pages on a shared `AuthPageShell`, cookie bar,
  scroll-to-top).
- Created: `components/auth/{LoginModal,RegisterModal,ForgotPasswordModal,TurnstileBox,GoogleButton}.tsx`,
  `components/layout/{BrandLogo,DashboardShell,Sidebar,Breadcrumb,TechIllustration}.tsx`, `components/layout/layout.css`,
  `utils/authUi.ts` (DOM event so deep components can open the login modal without prop drilling).
- Fixed in passing (file was rewritten): pre-existing `react-hooks/set-state-in-effect` in App.tsx (Google callback).
- Verification: `tsc` ✅, `npm run build` ✅, `eslint` on the touched files ✅.

### Phase 10
- Repo scan: no cyan/gold/purple neon values, no legacy token names (`--bg-base`, `--brand-primary`, `--glow-*`,
  `--space-*`, …), no hardcoded hex in component CSS (only `index.css` tokens), no "tactical/neon" references left.
- CSS audit (script: every class selector vs. all TSX/HTML): removed `.kicker--muted`, `.anim-rise`, `.code-block`,
  `.illu--compact` (unreferenced). Every remaining selector is referenced.
- `data/mockData.ts`: dead mock arrays (`sliderData`, `examSessions`, `leaderboardData`) and their unused types
  removed; the shared types (`KnowledgeCategory`, `Question`, …) and `navLinks` stay (services import them).
- Deleted unused assets `src/assets/{hero.png,react.svg,vite.svg}` (never imported).
- Verification: `tsc` ✅, `npm run build` ✅, `git diff --check` ✅, `npm run lint` → only the 2 pre-existing
  service-file errors remain.

### Phase 9
- Checked at 1440 / 1280 / 1024 / 768 / 430 / 390 with Playwright (home, quiz active, cabinet overview, students,
  admin users, register/login modals, mobile menu, sidebar drawer). `scrollWidth > clientWidth` was false on every
  checked screen (no horizontal page scroll); tables scroll inside their own `.table-wrap`.
- Adaptations in place: public nav → hamburger + drawer (≤1024); dashboard sidebar → drawer with a "Bölmələr"
  control (≤1024); rail stacks under main (≤1280) / full width (≤1024); quiz/exam become single column; navigator
  grid re-flows (8 / 6 columns); course grid 3 → 2 → 1; modals become bottom sheets (≤640) with full-width actions.
- Fix: the mobile menu user chip was missing the name (rule scoped to the header now).
- Accessibility already in the system: skip link kept, semantic dialogs with focus trap/restore/Escape, labelled
  icon buttons, `aria-pressed` on segmented controls, tab keyboard navigation, option states with icon + text +
  visually-hidden text, `prefers-reduced-motion` respected, visible focus rings everywhere.

### Phase 8
- Reset password / e-mail confirmation / e-mail change confirmation / Google callback pages share
  `AuthPageShell` (brand + theme toggle + centered card) — implemented with the App rewrite in Phase 2 and verified
  here. Token/URL handling untouched: params are read once, stripped from the URL before the request, redirect
  targets stay hardcoded; errors show only the server's message or a generic Azerbaijani text.
- Verification: Playwright screenshots (reset light 1440, Google callback dark 390, confirm light 1440).

### Phase 7
- Rewritten: `AdminPanel.tsx/.css` — `DashboardTab` (real `AdminStats` fields as stat blocks), `CoursesTab`
  (status tabs with counts from the full list, server list via `useAsyncData`, create form on shared fields,
  approve/reject/safe external link, delete behind `ConfirmDialog`, per-row busy + double-submit guard),
  `UsersTab` (server-side search with 350 ms debounce, role `<select>` with hidden label, e-mail/status badges,
  block behind `ConfirmDialog`, unblock direct, limit notice from server message), `ExamsTab` (category rows as the
  backend really returns them; cascade delete behind `ConfirmDialog` with the same warning content).
  `window.confirm()` calls replaced by the shared dialog. Dead default `AdminPanel` shell component and its
  duplicated `Toast` removed (Toast lives in `components/ui`).
- Pre-existing `react-hooks/set-state-in-effect` errors in AdminPanel (×3) are gone with the rewrite.
- Verification: `tsc` ✅, `eslint` ✅ on touched files, Playwright screenshots of all four admin tabs in both themes.

### Phase 6
- Rewritten: `UserDashboard.tsx/.css` on `DashboardShell` + `Sidebar` (user header, tabs, Ana səhifə / Çıxış
  footer). Overview: welcome header, identity card with real `overallProgress`, stat blocks (totalPoints,
  examsTaken, averageScore, bestScore — real summary fields), progress rows, recent sessions; right rail with
  "Son fəaliyyət" (areas sorted by real `lastActivity`) and account card. Progress: cards per area (dead "Davam et"
  no-op button removed). Sessions: table. Teacher: class manager (create / add student), class chips, students
  table with progress, student overview panel (closable). Profile: identity + editable fields + ID copy + gender
  radios; security card (e-mail change / password link); account-type card with the teacher→student block list,
  inline confirm step for role switch (still logs out after success), class deletion via shared `ConfirmDialog`
  (stays open with busy state during the request). All service calls and state semantics unchanged.
- Tokens: `--promo-*` for the sidebar brand card; stat grid min column 150px.
- Verification: `tsc` ✅, `eslint` ✅ on touched files, Playwright screenshots of all teacher tabs in both themes.

### Phase 5
- Rewritten: `ExamSession.tsx/.css` — section (action cards, join form, teacher "last session" card, session /
  attempt history list, login notice with modal trigger), create-session modal (segmented duration, category
  steppers with accessible labels, summary), exam player (server-driven timer with urgent state, question card,
  selected-option state, navigator rail, "İmtahanı bitir" now behind a ConfirmDialog; auto-submit on expiry
  unchanged), result card, teacher dashboard (stats, participants table with progress + status badge + result,
  close session behind a ConfirmDialog). Logic (revision/save/refresh polling) unchanged.
- Shared: question navigator (`.qnav-*`), `.note`, `.inline-status` moved into `index.css` (used by quiz + exam).
- Fixed in passing (blocked the flow): join-code input filtered `[^A-F0-9-]`, which removed the "K" and "R" of the
  mandatory `KBR-` prefix, so a typed/pasted code could never validate. Now `[^A-Z0-9-]` (server validates format).
- Verification: `tsc` ✅, `eslint` ✅ on touched files, Playwright screenshots (section, create modal, teacher
  dashboard, player) in both themes.

### Phase 4
- Rewritten: `QuizView.tsx/.css` on `DashboardShell` (category sidebar with real counts; setup card with
  numbered steps; active question with A–D buttons (states: neutral/hover/pending/correct/wrong/dim via border,
  icon, key badge and screen-reader text — not color only), explanations per option, prev/next; right rail with
  question navigator + question info; result card with per-difficulty breakdown). Auth gate now opens the login
  modal via `requestAuth`. Keyboard: A–D / 1–4 select, ← → navigate. Switching category during an active quiz
  asks for confirmation. All submit/rollback/score logic unchanged (answer keys only from the submit response).
- `App.tsx`: `QuizView` keyed by category id; header gets `activeHref` while a quiz is open.
- Pre-existing `exhaustive-deps` warning in QuizView removed with the rewrite.
- Verification: `tsc` ✅, `eslint` on touched files ✅, Playwright flow (setup → gate → login → answer → result)
  screenshotted in both themes against a mock API.

### Phase 3
- Rewritten: `AboutSection.tsx/.css` (mission hero + illustration, real stats from `/quiz/categories`,
  module cards, mission copy), `HeroSlider.tsx/.css` (auto-carousel → course card grid; details modal; add-course
  form on shared primitives; loading/empty/error states; hardcoded "4.9/5.0" rating removed; safe-link guard for
  LinkedIn/GitHub), `KnowledgeCategories.tsx/.css` (sidebar list + detail panel, keyboard arrows on the list),
  `Leaderboard.tsx/.css` (period pills, category chips, table with subtle top-3 emphasis, skeleton/empty; dead
  "Tam liderlik lövhəsinə bax" TODO button removed; podium removed).
- Created: `hooks/useAsyncData.ts` (loading/error/ready state with cancellation and reload).
- Verification: `tsc` ✅, `npm run build` ✅, `eslint` on touched files ✅; full lint now 5 errors + 1 warning,
  all pre-existing and in files not yet migrated (AdminPanel ×3, QuizView warning, 2 service files).

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

- Header is shown inside the cabinet as well (REF-04/05 show the global header above the cabinet sidebar). The
  `showDashboard` rule still hides the public sections and footer; only the header is global now.
- Login is a modal opened from a "Daxil ol" header button instead of two inline inputs in the header
  (REF-01 header composition). All login logic (captcha-on-demand, resend confirmation, vague errors) is unchanged.
- Footer: the fake newsletter form (no backend, showed a fabricated success), placeholder social links (`#`),
  the placeholder phone number and "trust badges" were removed per H.3 (no fabricated data). Real contact
  (e-mail, city), section navigation and legal links remain.
- Brand tagline follows REF-00/01 wording ("// TƏHSİL PLATFORMASI").

## 7. Pre-existing issues (not caused by the migration)

`npm run lint` on `origin/develop`:
- `react-hooks/set-state-in-effect`: App.tsx:248, AdminPanel.tsx:147/577/695, HeroSlider.tsx:373/409, Leaderboard.tsx:49
- `no-useless-assignment`: authService.ts:88, courseService.ts:64 (service files — out of migration scope)
- warning `react-hooks/exhaustive-deps`: QuizView.tsx:63

## 8. Open questions / known gaps

- Git push from the workspace is not authorized for this repository; delivery is via files written to the
  user's folder + a git bundle of the branch.
