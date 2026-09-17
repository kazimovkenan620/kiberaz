# Kiberaz.az — Frontend təhlükəsizlik auditi (2026-09-14)

**Əhatə:** `kiberaz-ui` (React 19 + TypeScript + Vite 8): `index.html` + CSP, `vite.config.ts`, `public/theme-init.js`,
`src/services/*` (apiClient, authService, courseService, quizService, examSessionService, adminService, userService),
`src/App.tsx` (URL/token axınları: reset-password, confirm-email, confirm-email-change, google-login-callback),
bütün komponentlər (XSS sink-ləri, kənar linklər, inline stil, CSV ixracı), `.env*`, `package.json`/lock, `dist/` build çıxışı.

**Metod:** mənbə kodunun tam oxunuşu + `npm audit` + production build-in yoxlanması (CSP, source map, env sızması) +
Playwright ilə çıxış axını. Yoxlanılan sinflər: XSS (DOM/reflected/stored), token/sessiya saxlanması, açıq yönləndirmə,
klik-oğurluğu, CSP/başlıqlar, üçüncü tərəf resurslar, CSV/formula injection, məlumat sızması (konsol, source map, env),
asılılıqlar, URL-də həssas parametrlər, rol/icazə məntiqinin frontend-də yeri.

**Vəziyyət (2026-09-14, eyni gün):** istifadəçi qərarı ilə **bütün tapıntılar bağlanıb** — bax §5.

---

## 1. Xülasə

| # | Ciddilik | Sinif | Tapıntı | Fayl |
|---|---|---|---|---|
| F1 | **Medium** | CSV/formula injection | Nəticələr CSV-si `=`, `+`, `-`, `@`, tab ilə başlayan dəyərləri neytrallaşdırmır — sessiya adı (VIP yazır) və e-poçt Excel-də formula kimi icra oluna bilər | `AdminExamsTab.tsx:43-61` |
| F2 | Low | Həssas parametr URL-də | `reset-password` səhifəsi `userId`+`token`-i ünvan sətrindən silmir (confirm səhifələri silir); `?query` formatı da qəbul edilir → token Referer/loglara düşə bilər | `App.tsx:123-124` |
| F3 | Low | CSP sərtləşdirmə | `img-src https:` (hər hansı https şəkil), `style-src 'unsafe-inline'`; `frame-ancestors` yalnız HTTP başlığı ilə mümkündür | `index.html:39` |
| F4 | Low | Üçüncü tərəf resurs / privacy | Google Fonts (`fonts.googleapis.com`/`gstatic`) — ziyarətçi IP-si Google-a gedir, SRI mümkün deyil, kənar mənbə CSP-də açıq qalır | `index.html:45-49` |
| F5 | Low | Sessiya saxlanması | Access token + rollar + ləqəb `sessionStorage`-da: XSS baş versə token oğurlanır (CSP və `HttpOnly` refresh cookie təsiri məhdudlaşdırır) | `authService.ts:159-200` |
| F6 | Low | Sessiya axını (M1-dən sonra) | Yeni tab access tokensiz refresh edə bilmir → hər tab yenidən giriş = yeni server sessiyası (max 5, LRU) | `apiClient.ts`, `authService.ts:refreshTokens` |
| F7 | Low | Validasiya uyğunsuzluğu | Reset formunda parol `maxLength=30`, serverdə 128; qeydiyyatda limit yoxdur | `App.tsx:165-170` |
| F8 | Low | Server validatoru (frontend sink) | Kateqoriya `Color`/`Icon` 50 simvollıq sərbəst mətn; admin panelində inline `style={{ color }}` və emoji kimi render olunur | `CreateQuizCategoryRequestValidator.cs:15-26`, `AdminBankTab.tsx:411` |
| F9 | Info | Build/deploy | Build zamanı `VITE_API_URL` verilməsə CSP və API ünvanı `http://localhost:5251` ilə çıxır; `.env.production` repo-da yoxdur | `vite.config.ts`, `dist/index.html` |
| F10 | Info | Asılılıqlar | `npm audit`: 0 boşluq; versiyalar `^` ilə, lockfile var — CI-da `npm ci` + avtomatik yenilənmə yoxdur | `package.json` |
| F11 | Info | URL qurulması | `host.replace('/api','')` + sətir birləşməsi — API yolu dəyişsə və ya köhnə kənar `https://` şəkil qalsa link sınır (təhlükəsizlik yox, dayanıqlılıq) | `HeroSlider.tsx:65-90` |
| F12 | Info | Klik-oğurluğu | SPA statik hostdan `X-Frame-Options`/`frame-ancestors` göndərilməlidir (meta CSP dəstəkləmir) | deploy |

**Tapılmayan (yoxlanıldı, təmizdir):** `dangerouslySetInnerHTML`/`innerHTML`/`eval` yoxdur; bütün istifadəçi mətni React ilə
escape olunur; `href`-lər `isSafeExternalLink` (yalnız http/https, `javascript:` rədd) ilə süzülür; hər `target="_blank"`-də
`rel="noreferrer"`; açıq yönləndirmə yoxdur (hədəflər sabit); Google `code`, confirm tokenləri sorğudan əvvəl `replaceState` ilə
silinir; refresh token yalnız `HttpOnly` cookie-də, JS-ə açılmır; paralel 401 refresh tək uçuş növbəsi ilə; konsola log yoxdur;
production build-də source map yoxdur; `.env` gitignore-da, yalnız `VITE_*` (public site key) bundle-a düşür; `theme-init.js`
yalnız `light|dark` qəbul edir; parol sahələrində düzgün `autoComplete` (`current-password`/`new-password`); dev server yalnız
`localhost`-a bağlıdır; CSP: inline skript yoxdur (`script-src 'self'` + Turnstile), `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, production-da `upgrade-insecure-requests`; frontend-dəki rol yoxlaması yalnız UI üçündür — hər admin/VIP
endpoint serverdə yenidən yoxlanılır.

---

## 2. Təfərrüat

### F1 — CSV formula injection (Medium)
- **Fayl:** `src/components/AdminExamsTab.tsx` `downloadCsv` — `escape` yalnız `"`, `;`, `,`, `\n` üçün dırnaqlayır.
- **Vektor:** VIP istifadəçi sessiya adını `=HYPERLINK("https://evil.example/x";"Nəticələr")` və ya `=cmd|' /C calc'!A0`
  (DDE) kimi yazır (server yalnız uzunluq ≤120 yoxlayır). Admin nəticələri CSV kimi endirib Excel/LibreOffice-də açanda dəyər
  formula kimi işlənir — phishing linki, DDE xəbərdarlığı ilə əmr icrası, məlumat sızması. Eyni risk iştirakçı e-poçtu
  (`+`/`=` ilə başlaya bilər) və ləqəb üçün (ləqəb `[a-zA-Z0-9_]` olduğu üçün təhlükəsizdir).
- **Necə yoxlamalı:** VIP ilə adı `=1+1` olan sessiya yarat → admin CSV-ni Excel-də aç → hüceyrədə `2` görünür.
- **Təklif:** `escape`-də `^[=+\-@\t\r]` ilə başlayan dəyərlərin qarşısına `'` əlavə et (OWASP CSV Injection) və hər halda
  dırnaqla; alternativ — serverdə sessiya adı üçün `^[\p{L}\p{N} .,:;!?()\-–—'"«»]+$` tipli allow-list.

### F2 — Reset token ünvan sətrində qalır (Low)
- **Fayl:** `src/App.tsx` `ResetPasswordPage` — `params` oxunur, amma `window.history.replaceState` çağırılmır (confirm və
  Google səhifələrində çağırılır). Üstəlik `window.location.search` fallback-ı token-i `?token=` kimi qəbul edir — belə link
  paylaşılsa/yenidən yazılsa token serverə və proxy loglarına gedər (hash getmir).
- **Təsir:** token 2 saat etibarlıdır və bir dəfəlikdir; brauzer tarixçəsi/ekran görüntüsü/paylaşılan cihazda parol
  sıfırlama pəncərəsi qalır.
- **Təklif:** parametrləri `useState` başlanğıcında oxuyub dərhal `replaceState(null, '', '/reset-password')`; `search`
  fallback-ını sil (e-poçt yalnız `#` göndərir).

### F3 — CSP sərtləşdirmə (Low)
- `img-src ... https:` — backend artıq yalnız öz upload yollarını qəbul edir (audit L10 düzəlişi), kənar şəkil lazım deyil →
  `img-src 'self' data: %API_ORIGIN%`.
- `style-src 'unsafe-inline'` — React `style` prop-unu CSSOM ilə yazır (CSP-yə düşmür), Lucide ikonları atributsuzdur; tək
  ehtimal Turnstile/fonts. `'unsafe-inline'`-ı çıxarıb Playwright ilə pozuntu yoxlanmalıdır; qalsa `style-src-attr` ilə daraltmaq olar.
- `frame-ancestors 'none'` və `X-Frame-Options: DENY` statik hostdan HTTP başlığı kimi (F12).
- İstəyə görə `Content-Security-Policy-Report-Only` + `report-to` ilə pozuntuları toplamaq.

### F4 — Google Fonts (Low)
`fonts.googleapis.com` CSS + `fonts.gstatic.com` fayllar: hər ziyarətçi Google-a sorğu göndərir (IP/UA), üçüncü tərəf mənbə
CSP-də açıqdır, SRI tətbiq oluna bilmir (CSS dinamikdir), Google əlçatmaz olanda şrift gecikir. **Təklif:** şriftləri
`public/fonts`-a yerləşdirib `@font-face` ilə `'self'`-dən vermək; CSP-dən iki kənar mənbəni silmək.

### F5 — Token `sessionStorage`-da (Low, dizayn qeydi)
Access token 15 dəq, refresh yalnız `HttpOnly` cookie — XSS olsa hücumçu ən çox 15 dəqiqəlik token və `/auth/refresh`-i
səhifə daxilindən çağıra bilər (cookie avtomatik gedir). CSP inline skripti bağladığı üçün XSS-in özü çətindir. Alternativ
(yaddaşda saxlamaq + səhifə yüklənəndə səssiz refresh) F6 ilə birlikdə həll olunur; `sessionStorage` tab bağlananda silinir — məqbul.

### F6 — Yeni tab = yeni giriş = yeni server sessiyası (Low, UX + sessiya sayı)
`refreshTokens()` `accessToken` olmadan işləmir; `sessionStorage` tab-a bağlıdır → yeni tabda istifadəçi çıxmış görünür, yenidən
daxil olur, serverdə (M1-dən sonra) yeni `RefreshSession` yaranır; 5 sessiyadan sonra ən köhnəsi silinir — eyni istifadəçinin
telefondakı sessiyası itə bilər. **Təklif:** serverdə refresh üçün `accessToken`-i seçimli et (cookie hash-i ilə sessiyanı tap:
`RefreshSession.TokenHash` üzrə indeks və ya `Users` skanı) → frontend səhifə yüklənəndə tokensiz refresh sınayır; tab-lar arası
`BroadcastChannel` ilə tokeni paylaşmaq da olar.

### F7 — Parol uzunluğu uyğunsuzluğu (Low)
Reset formu `maxLength={30}`; server 8–128 qəbul edir; qeydiyyatda limit yoxdur (server 128-də kəsir). 30-dan uzun parol seçmiş
istifadəçi reset edə bilmir. **Təklif:** hər üç formada `maxLength={128}`.

### F8 — Kateqoriya rəng/ikon validatoru (Low)
`Color` 50 simvollıq sərbəst mətn; admin panelində `style={{ color: category.color }}` və `background` kimi işlənir. React CSSOM
ilə yazdığı üçün CSS-dən çıxış (`;`) mümkün deyil, amma `url(...)`/`expression` kimi dəyərlər gələcək kodda `background` sink-inə
düşə bilər. **Təklif:** serverdə `^#[0-9a-fA-F]{6}$`, ikon üçün tək emoji/qısa ad allow-list.

### F9 — Build mühiti (Info)
`vite.config.ts` `VITE_API_URL`-i CSP-yə yazır; build serverində dəyişən verilməsə `dist/index.html` `http://localhost:5251`
daşıyır və `upgrade-insecure-requests` ilə API sorğuları sınır. **Təklif:** `.env.production` (yalnız public dəyərlər) repo-da,
CI-da build sonrası `grep -c localhost dist/index.html == 0` yoxlaması.

### F10 — Asılılıqlar (Info)
`npm audit` təmizdir; `react`, `vite`, `@marsidev/react-turnstile`, `lucide-react` aktualdır. **Təklif:** CI-da `npm ci`,
Dependabot/Renovate, `npm audit --audit-level=high` addımı.

### F11 — API mənşəyinin qurulması (Info)
`HeroSlider.mapCourseToUI`: `host = VITE_API_URL.replace('/api','')`, sonra `${host}${url}`. `VITE_API_URL` `https://api.kiberaz.az/api`
olanda düzdür; başqa yol prefiksi və ya köhnə kənar `https://` şəkil olanda `https://api...https://...` kimi sınıq link yaranır.
**Təklif:** `new URL(url, apiOrigin).href` və yalnız `/uploads/` ilə başlayan yollar.

### F12 — Klik-oğurluğu (Info, deploy)
SPA statik hostu: `Content-Security-Policy` (index.html-dəki ilə eyni) + `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS.

---

## 3. Yoxlama matrisi

| Sahə | Nəticə |
|---|---|
| XSS sink-ləri (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `document.write`) | yoxdur ✅ |
| İstifadəçi/VIP mətni (təlim başlığı, açıqlama, ləqəb, sessiya adı, sual mətni) | React text node — escape ✅ |
| `href` sink-ləri (LinkedIn/GitHub/link/sillabus) | `isSafeExternalLink` + `rel="noreferrer"` ✅; sillabus/şəkil yalnız API mənşəyi ✅ |
| Inline `style` | yalnız allow-list accent tokeni (`courseAccentColor`) və admin rəngi (F8) |
| Açıq yönləndirmə | hədəflər sabit (`'/'`, `#hash` sabitlərdən) ✅ |
| Token saxlanması | access → `sessionStorage` (F5), refresh → `HttpOnly; Secure; SameSite=Strict` cookie ✅, köhnə `localStorage` açarları təmizlənir ✅ |
| URL-də token | Google `code`, confirm tokenləri dərhal silinir ✅; reset tokeni qalır (F2) |
| Çıxış | server `POST /auth/logout` çağırılır, lokal tokenlər əvvəl silinir ✅ (bu gün əlavə edildi) |
| CSP | inline skript yoxdur ✅; `img-src https:` və `'unsafe-inline'` stil (F3) |
| Üçüncü tərəf | Turnstile (zəruri, CSP-də), Google Fonts (F4) |
| Klik-oğurluğu | host başlığı lazımdır (F12) |
| Məlumat sızması | konsol logu yoxdur ✅, source map yoxdur ✅, `.env` commit olunmayıb ✅, bundle-da yalnız public açar ✅ |
| Rol məntiqi | UI gizlətmə + server `[Authorize]`; saxta rol 403 ✅ |
| CSV ixracı | formula injection (F1) |
| Asılılıqlar | 0 boşluq ✅ (F10 proses qeydi) |
| Dev server | `host: 'localhost'` ✅ |
| Formlar | `autoComplete` düzgün ✅; uzunluq uyğunsuzluğu (F7) |

---

## 4. Prioritet
1. **F1** — 1 sətirlik düzəliş, admin cihazını qoruyur.
2. **F2, F3, F7** — kiçik, tez.
3. **F4, F6** — dizayn qərarı tələb edir (şrift self-host; tokensiz refresh serverdə dəstək).
4. **F8–F12** — proses/deploy qeydləri.

Hansılarını düzəldim — nömrələri yazın.

---

## 5. Düzəliş vəziyyəti (2026-09-14)

| # | Vəziyyət | Nə edildi |
|---|---|---|
| F1 | ✅ | `downloadCsv.escape`: `=`, `+`, `-`, `@`, tab, CR ilə başlayan dəyərə `'` prefiksi + dırnaqlama. |
| F2 | ✅ | `ResetPasswordPage` parametrləri bir dəfə oxuyub `replaceState` ilə silir; reset və confirm səhifələrində `?query` fallback-ı çıxarıldı (yalnız `#`). |
| F3 | ✅ | CSP: `img-src 'self' data: %API_ORIGIN%`; `style-src-elem 'self'` (dev-də Vite HMR üçün `%CSP_STYLE_DEV%` = `'unsafe-inline'`), `style-src-attr 'unsafe-inline'`, köhnə brauzerlər üçün `style-src` fallback; Google Fonts mənbələri silindi. Playwright: 0 pozuntu (dev). |
| F4 | ✅ | Şriftlər self-host: `@fontsource/inter`, `@fontsource/jetbrains-mono` (latin + latin-ext, 5.3.0) — `src/fonts.ts`; `index.html`-dən Google Fonts linkləri çıxarıldı. 🔍 Dep: yalnız statik woff/woff2 + CSS, skript yoxdur. |
| F5 | ✅ (dizayn) | Dəyişmədi — F6 ilə səhifə yüklənəndə səssiz bərpa əlavə olundu; token `sessionStorage`-da qalır. |
| F6 | ✅ | Backend: `POST /api/auth/refresh` access tokensiz qəbul edir (sessiya cookie hash-i ilə tapılır); paralel refresh üçün 15 s **reuse grace** (`SessionPolicy.RefreshReuseGraceSeconds`) + ConcurrencyFailure-da bir təkrar. Frontend: `kiberaz-session` işarəsi (localStorage) + `App` yüklənəndə `refreshTokens()`; anonim ziyarətçi üçün sorğu getmir. |
| F7 | ✅ | Reset/qeydiyyat/giriş parol sahələri `maxLength={128}`. |
| F8 | ✅ | Server: `Color` `^#[0-9a-fA-F]{6}$`, `Icon` ≤16, markup/idarəetmə simvolsuz; admin formu `pattern`/`maxLength` ilə uyğunlaşdırıldı. |
| F9 | ✅ | `vite.config.ts`: production build lokal `VITE_API_URL` ilə **alınmır** (`VITE_ALLOW_LOCAL_API=1` ilə bilərəkdən); `env.production.example` (→ `.env.production`). |
| F10 | ✅ | `npm run audit` (`--audit-level=high`) və `npm run check` (tsc + eslint + audit) skriptləri; lockfile ilə `npm ci`. |
| F11 | ✅ | `resolveUploadUrl()` (`courseService`): `new URL(path, apiOrigin)`, yalnız `/uploads/` yolları. |
| F12 | ✅ | `public/_headers` (Cloudflare Pages/Netlify) + `deploy/nginx-spa.conf.example`: `frame-ancestors 'none'`, `X-Frame-Options`, nosniff, Referrer-Policy, Permissions-Policy, HSTS, COOP, cache siyasəti. |

**Yoxlanıldı:** `tsc`, `eslint`, `vite build` (guard işləyir; `VITE_ALLOW_LOCAL_API=1` ilə build), Playwright: admin bölmələri boyunca CSP pozuntusu 0, şriftlər yalnız `localhost:5173`-dən, tokensiz səssiz giriş (`{}` body → sessiya bərpa), anonim ziyarətçidə refresh sorğusu 0, reset səhifəsi URL-i təmizləyir, parol `maxlength=128`.
**Yoxlanılmayan:** backend hissəsi (`RefreshTokenAsync` tokensiz yol, grace, validator) — .NET SDK yoxdur; `SecurityRegressionTests`-ə cookie-only refresh, paralel refresh (hər ikisi OK), grace sonrası replay → ailə ləğvi testləri əlavə edildi, lokalda işlədilməlidir.
