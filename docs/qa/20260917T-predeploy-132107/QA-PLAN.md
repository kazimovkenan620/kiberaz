# Deploy öncəsi QA planı

RUN_ID: `20260917T-predeploy-132107`; commit: `2a3f32f4e131fda77d668215c4ea83af20a6f8b5`; branch: `feat/ui-migration-light-dark`.
Başlanğıc working tree təmizdir. Mənbə: `C:/Users/User/Desktop/kiberaz`. Audit-only; tətbiq kodu dəyişdirilmir.

## Məqsəd və ardıcıllıq

- [x] Təlimatlar, git baseline, runtime və alətlərin kəşfi.
- [x] Frontend ekran/action və backend endpoint/persistence inventarı; faktiki rol matrisi.
- [x] Lockfile əsasında restore, backend Release build/publish, frontend typecheck/lint/production build və dependency audit.
- [x] Mövcud ayrıca SecurityRegressionTests harness-i; nəticələr assertion vahidi ilə ayrıca.
- [x] İzolə local API, build olunmuş frontend, sintetik hesablar, ayrı sessiyalar və API read-back.
- [ ] Guest navigation, qeydiyyat, login/logout/reload; CAPTCHA və SMTP imkanlarının faktiki yoxlanması.
- [ ] User, Teacher, VIP, Moderator, Admin axınları; ownership və qadağan edilmiş sorğular.
- [ ] Deterministik VIP→User imtahan axını, scoring, duplicate submit, dashboard və persistence/restart.
- [ ] Kurs/sinif/profil/upload, validation və xətalar; responsive/light/dark/klaviatura sınaqları.
- [x] Inventory–matrix gap-analysis, son smoke, diff/hash yoxlaması, hesabat və checkpoint.

Yekun: **INCOMPLETE / NO-GO**. İşarələnməmiş geniş axınlar PARTIAL əhatəyə malikdir, icra edilmiş altaddımlar CSV-dədir. 38 API və 16 browser ssenarisi, 516 security assertion, 3 production startup probe, restart/readback və offline DB inspection aparılıb. Bütün rol/action/edge kombinasiyaları, SMTP/OAuth/hosting tamamlanmadığı üçün geniş checklist bağlanmır. Nəticə PRE-DEPLOY-QA-REPORT.md və QA-CHECKPOINT.md-dədir.

## Sərhədlər

Yalnız ayrıca `%TEMP%/20260917T-predeploy-132107` test bazası və uploads. Real DB, real e-poçt və ödənişlər istifadə edilmir. Parol/token/cookie/log secrets yalnız private temp daxilində, sübutlar redaktə edilmişdir. CAPTCHA, auth və rate-limit qorunmaları zəiflədilmir. External OAuth/SMTP/hosting test konfiqurasiyası yoxdursa konkret BLOCKED yazılır. Fixture ilə təsdiqlənmiş hesab confirmation E2E sayılmır.

Hər testdə feature vəziyyəti ilə icra nəticəsi ayrı saxlanır. BROWSER_E2E, API_RUNTIME, INTEGRATION, UNIT, STATIC_ONLY, MOCKED/SANDBOX nəticələri qarışdırılmır. API statusdan əlavə body/read-back; hesab sessiyaları ayrıdır. Concurrency yalnız bir koordinatorla, maksimum iki planlı sorğu.

## Gözlənilən davranış

İstifadəçi tələbi → domain/API kontraktı → sənədlər/testlər → açıq fərziyyə. Naməlum biznes tələbi SPEC_GAP, vaxt çatışmazlığı NOT_RUN, alət/mühit maneəsi BLOCKED. User tələbə roludur; VIP faktiki ayrıca roldur və VipTerm əlavə state-dir. Teacher-a aid olmayan imtahan yaratma hüququ bug sayılmayacaq.

## Alətlər və məhdudiyyətlər

Windows 10.0.26200, .NET SDK 10.0.401; net9.0 target, runtime 9.0.0; Node 24.16.0, npm 11.13.0. In-app browser mövcuddur. `package-lock.json` mövcuddur; frontend test script-i yoxdur. `.codex/roles/bug-hunter-reviewer.md` və `.codex/skills/kiberaz-engineering/SKILL.md` mövcud deyil; onların istifadəsi iddia edilmir. Mövcud Superpowers plan/debugging/verification qaydaları tətbiq olunur; istifadəçinin audit-only qaydası implementasiya/commit addımlarını əvəz edir.

İcra əmrləri və exit code-lar `evidence/` altında, test ssenariləri canlı QA-TEST-MATRIX fayllarında saxlanılır. Hesabat audit tam olmayana qədər INCOMPLETE qalır.
