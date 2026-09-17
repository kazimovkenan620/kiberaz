# Kiberaz.az — deploy öncəsi QA hesabatı

**Release qərarı: NO-GO. Audit vəziyyəti: INCOMPLETE.** İki təsdiqlənmiş P1 buraxılışı bloklayır: imtahan taymeri/avtomatik göndəriş və publish paketinə lokal məxfi konfiqurasiyanın daxil olması. Əlçatan lokal scope-da real brauzer və API sınaqları aparılıb; bütün inventar, xarici inteqrasiyalar və deployment mühiti tam yoxlanmayıb. Bu hesabat xətaların yoxluğuna zəmanət və deploy icazəsi deyil.

## İcra konteksti

| Sahə | Faktiki vəziyyət |
|---|---|
| Mənbə | `C:/Users/User/Desktop/kiberaz` |
| Run / tarix | `20260917T-predeploy-132107`; 17.09.2026; Asia/Baku UTC+04; başlanğıc 13:21:07; dəqiq test vaxtları CSV/evidence-də UTC ilə |
| Git | `feat/ui-migration-light-dark`; `2a3f32f4e131fda77d668215c4ea83af20a6f8b5` |
| Working tree | İlk `git status --short` boş idi; saxlanmış baseline-status.txt QA qovluğu yaradıldıqdan sonra çəkilib və `?? docs/qa/` göstərir. Sonda yalnız yeni `docs/qa/` və `tools/PreDeployQa/`; tracked SHA256 müqayisəsində **0 fərq** |
| Backend | .NET 9, Clean Architecture, custom Identity stores, singleton LiteDB 5.0.21; EF/migration yoxdur |
| Frontend | React 19.2.5, TypeScript 6.0.2, Vite 8.0.13; lockfile əsasında ayrıca build |
| Alətlər | Windows 10.0.26200; .NET SDK 10.0.401, runtime 9.0.0; Node 24.16.0; npm 11.13.0 |
| Brauzer | Playwright 1.58.2 + quraşdırılmış Chrome/Chromium 153.0.8010.47; ayrı account context-ləri |
| Lokal tətbiq | Release API `http://localhost:5259`, Development environment; production frontend preview `http://localhost:5189` |
| Test data | `C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107/runtime/qa.db`; uploads həmin runtime/wwwroot daxilində; real baza istifadə edilməyib |
| İnteqrasiya | Turnstile rəsmi test key/widget, bypass=false; SMTP delivery yoxdur; Google provider testi yoxdur |

Production frontend build + Release API lokal sınağı real Production hosting sınağı deyil. Ayrı Production environment mənfi startup yoxlamaları yalnız fail-closed qorunmanı ölçür.

Təlimatlar, `SENIOR-RULES.md`, test/deploy sənədləri və uyğun Superpowers plan/debug/verification qaydaları oxunub. İstinad olunan lokal bug-hunter role və kiberaz-engineering skill faylları tapılmayıb; istifadələri iddia edilmir. İki read-only inventar və ayrıca security suite paralel aparılıb; izolə sintetik QA LiteDB-yə bütün yazıları tək koordinator idarə edib.

## Scope və hesablar

Faktiki rollar **User, Teacher, VIP, Moderator, Admin**-dir. Guest ayrıca sessiya vəziyyətidir. VIP həm rol, həm aktiv `VipTerm` qaydası ilə işləyir; confirmed/blocked ayrıca rol deyil. İmtahanı VIP yaradır; Teacher-a olmayan assignment funksiyasını bug saymadıq.

11 fixture alias: `UserA/B`, `TeacherA/B`, `VIPA/B`, `ModeratorA/B`, `AdminA`, `Unconfirmed`, `Blocked`. Tək-administrator invariantına görə ikinci Admin yaradılmayıb. Əlavə `UIRegistration` hesabı real brauzer forması ilə yaradılıb. Hər rolun ayrıca hesab/sessiyası var; rol keçidi ilə eyni hesab təkrar istifadə edilməyib. Fixture provisioning registration/role-assignment E2E-si sayılmır.

İnventar: [113 frontend planı](FRONTEND-INVENTORY.md), [79 backend marşrutu və persistence xəritəsi](BACKEND-INVENTORY.md), [rol/icazə matrisi](ROLE-PERMISSION-MATRIX.md). Ekran/action → endpoint → rol/ownership → storage → test əlaqələri inventar və [gap-analysis](GAP-ANALYSIS.md)-dədir. Tam action/endpoint×rol×state əhatəsi **PARTIAL**-dır.

SPEC_GAP-lər: hüquqi linklər hazırda `href="#"`; məzmun və release acceptance criterion müəyyənləşdirilməlidir. Boolean/state əsaslı kabinetin Back/Forward/deep-link gözləntisi və Moderator üçün əlavə səlahiyyət gözləntisi təsdiqlənməyib. Bunlar sübutsuz runtime defect kimi sayılmır. Real payment və Teacher exam assignment cari scope xaricindədir.

## Test nəticələri və sayma qaydası

Saylar [QA-TEST-MATRIX.csv](QA-TEST-MATRIX.csv)-dən skriptlə hesablanıb; [maşınla oxunan yekun](evidence/matrix-summary.json). **273 matris sətri: 62 PASS, 7 FAIL, 9 BLOCKED, 191 NOT_RUN, 4 N/A.** Bunlar eyni ölçülü assertion-lar deyil: məhdud icra ssenariləri, build gate-ləri və geniş inventarın qalan planlarıdır.

| Sübut səviyyəsi | PASS | FAIL | BLOCKED | NOT_RUN | N/A | Execution coverage | Runtime pass rate |
|---|---:|---:|---:|---:|---:|---|---|
| API_RUNTIME | 37 | 1 | 0 | 79 | 0 | 38/117 (32.5%) | 37/38 (97.4%) |
| BROWSER_E2E | 11 | 5 | 4 | 109 | 1 | 16/129 (12.4%) | 11/16 (68.8%) |
| INTEGRATION | 5 | 0 | 5 | 3 | 1 | 5/13 (38.5%) | N/A — suite/probe vahidi |
| STATIC_ONLY | 9 | 1 | 0 | 0 | 0 | 10/10 (100.0%) | N/A |
| UNIT | 0 | 0 | 0 | 0 | 2 | N/A (0/0) | N/A |

Applicable = PASS+FAIL+BLOCKED+NOT_RUN; N/A məxrəcdən çıxılıb. `RUN-*` faktiki icra ssenarisidir; `GAP-*` inventardakı geniş planın hələ qapanmayan hissəsidir. Geniş planın qismən altaddımı PASS olduqda bütün plana PASS yazılmayıb. 79 geniş API planının NOT_RUN olması heç bir endpoint-in çağırılmadığı anlamına gəlmir. Müstəqil snapshot 52 route invocation qeyd edir, lakin invocation tam kontrakt/ownership sınağı deyil.

SANDBOX ayrıca `IntegrationMode` sütunundadır: real browser registration PASS rəsmi Turnstile test key istifadə edir; real CAPTCHA/SMTP PASS deyil. API reset/confirmation tokenləri real Identity/DataProtection ilə fixture-də yaradılıb, məktubdan alınmayıb. Mövcud security suite test email capture istifadə edir. Static nəticələr runtime pass rate-ə qatılmayıb.

**516/516 security assertion keçib**; bu ayrıca vahiddir, 516 browser/feature ssenarisi deyil. İki təkrar run eyni assertion-ları yoxlayır, 1032 fərqli test sayılmır. [Regression nəticələri](REGRESSION-RESULTS.md).

İlkin harness səhvləri gizlədilməyib: create status gözləntisi, təkrar fixture kredit xərci, yanlış DTO sahələri, callback text oracle, browser locator, Python helper adı və runtime wwwroot olmaması. Düzgün oracle/mühit ilə təkrarlar canonical sətirdədir; raw ilkin nəticələr saxlanıb. Məhsul FAIL-ləri qalır. Tarixi browser harness-i FAIL-i JSON-a yazıb exit 0 qaytarırdı; tooling indi FAIL=1/BLOCKED=2 qaytarır. Bu son exit-code düzəlişindən sonra syntax yoxlanıb; əvvəlki runtime nəticələri yenidən icra edilmiş kimi təqdim edilmir.

## Build və avtomatlaşdırılmış yoxlamalar

- Backend restore, `dotnet build Kiberaz.sln -c Release --warnaserror`, publish və son Release build keçib; son build 0 warning/0 error.
- İzolə UI-da lockfile `npm ci`, typecheck/lint/build keçib. Son original-workspace typecheck/lint və izolə production build exit 0.
- Original `npm ci` istifadəçinin açıq dev prosesinin kilidlədiyi rolldown native faylı səbəbindən EPERM verdi. Tooling bərpa edildi və izolə qovluğun dəqiq lockfile dependency-ləri original node_modules-a köçürüldü. İstifadəçinin prosesi dayandırılmadı; package/lockfile dəyişmədi. İlkin gate uğursuzluğu məhsul bug-ı deyil. [Bərpa qeydi](evidence/dependency-restoration.txt).
- `dotnet test ... --no-build` exit 0 olsa da ayrıca test SDK layihəsi/assertion yoxdur; UNIT N/A. Frontend-də test script yoxdur.
- SecurityRegressionTests son təkrar: 516/516 assertion, 29 imtiyazlı route, exit 0.
- Production CAPTCHA missing-secret/test-key/bypass-enabled: **3/3 fail-closed probe PASS**, gözlənilən exception və listener açılmaması. [Startup sübutu](PROD-STARTUP-RESULTS.md).
- npm və NuGet audit alətləri cari mənbələrdə məlum vulnerable dependency bildirmədi. Bu nəticə kod/runtime-də vulnerability olmadığını sübut etmir.

Komandalar və exit code-lar [evidence](evidence/), tam gate əlaqələri CSV-dədir.

## Faktiki işləyən axınlar və məhdudiyyətlər

| Sahə | Faktiki sübut | Qalan sərhəd |
|---|---|---|
| Auth | 5 rol üzrə login/me; unconfirmed və blocked rəddi; refresh/logout/revocation; profile overposting rəddi | Bütün multi-tab/back/stale-role/admin block variantları tam deyil |
| Registration | Azərbaycan hərfli form sahələri, real widget, 201 success; offline DB-də UIRegistration daxil cəmi 12 hesab | Məktub çatdırılması → confirmation → həmin yeni hesab login tam zənciri BLOCKED |
| Reset/confirmation | Fixture-issued etibarlı token ilə mutation, köhnə parol rəddi/yeni login; invalid/reset reuse sərhədi; idempotent confirm | Mail delivery, bütün expired/UI variantları tamamlanmayıb |
| Authorization | Guest/wrong-role deny, Teacher/VIP/User foreign owner read/write rəddi, private question projection, protected account exclusion | Bütün endpoint×role×owner kombinasiyası yoxlanmayıb |
| VIP → User exam | API və real UI create/join/answer/submit; 4 sualdan müstəqil hesablanan 2 doğru = 50%; host nəticə, duplicate/revision/close qaydaları | Timer və deadline auto-submit FAIL; bütün reload/background/history variantları açıq |
| Nəzarətli concurrency | Eyni revision ilə 2 parallel save: biri 200, biri 409 | Stress/load və böyük sərhədlər yoxlanmayıb |
| Teacher → User | Öz sinfini yarat/add/read; TeacherB foreign read/add/delete rəddi; restartdan sonra roster | Bütün browser CRUD və role-switch sonrası consistency tamamlanmayıb |
| VIP → Admin → public course | Pending create → approve → public readback; revision → approve → yenilənmiş məzmun | Reject/reactivate/delete/credit race/expiry lifecycle tamamlanmayıb |
| Quiz/bank | Public/private ayrılığı, answer duplicate protection; admin category/question create/soft-delete/restore | Bütün quiz player UI, bank edit/search/pagination variantları NOT_RUN |
| Upload | Zərərsiz PNG və sanitizer-dən keçən PDF upload/readback, magic/owner subset; ayrıca suite kvota/sanitizer | Real proxy multipart, UI retry, orphan sweeper lifecycle açıq |
| Dashboard | User/Teacher/VIP/Moderator/Admin real UI login, bütün mövcud sidebar tablarını açma, mobil screenshot | Ekranı açmaq hər düymə/mutation/boş/xəta halının PASS-ı deyil |

Əsas cross-role workflow tətbiqin faktiki VIP host kontraktına uyğunlaşdırılıb. Manual submit və scoring PASS serverin deadline-dan sonra gec cavabı qəbul etdiyini sübut etmir; belə bypass iddiası yoxdur.

## Persistence, UI və inteqrasiya

API restartından sonra imtahanın 50% nəticəsi və teacher class readback-u keçib; son smoke login/deny/course/class/attempt readback-u təkrar edib. API dayandırıldıqdan sonra LiteDB `ReadOnly=true` ilə açılıb: **12 Users, 5 Roles, 5 ExamSessions, 5 ExamAttempts, 1 Course, 1 TeacherClass, 1 QuizResult, 3 UploadedFiles**; collection/account state sübutu [offline-db-inspection.json](evidence/offline-db-inspection.json)-dadır. Saylar tam normalized uniqueness, bütün foreign-key/orphan, crash durability və backup/restore yoxlaması deyil; bunlar DB-002/HOST-02-də açıqdır.

1440×900, 768×1024, 390×844 guest ekranında horizontal overflow müşahidə edilmədi; desktop light/dark və 5 rol mobil ekranı yoxlanıb. Modal Tab trap subset keçib, Escape focus return FAIL. 3 mənfi callback path-də SPA fallback və anlaşılan error görülüb. Brauzer console/network sübutları saxlanıb; auth header/body/token yazılmayıb. Firefox/Safari, screen reader, 200% zoom, 320px, bütün loading/error/offline/retry vəziyyətləri yoxlanmayıb. Tək engine nəticəsi multi-browser PASS deyil.

SMTP mailbox, real Google OAuth və real Turnstile hostname/secret axınları **BLOCKED**. Local Development cookie/header/CORS nəticəsi Production TLS/Secure/forwarded headers/CDN cache nəticəsi deyil. Hosting/DNS/TLS, persistent disk icazələri, real backup restore ayrıca **BLOCKED**. Production named limiter 429 UI, expiry/orphan fon işlərinin tam lifecycle sınaqları **NOT_RUN**. Performans SLO/yük testi aparılmayıb.

Yerli .NET 9.0.0 patch səviyyəsi köhnədir; production runtime məlum deyil. .NET 9-un dəstəyi audit tarixində davam edir; cari patch və support mənbələri [release-config review](RELEASE-CONFIG-REVIEW.md)-dədir. Bu, ayrıca production release önşərtidir, əlavə təsdiqlənmiş məhsul bug-ı kimi sayılmır.

## Təsdiqlənmiş qüsurlar və prioritet

| ID | Prioritet | Pozuntu | Deploy öncəsi tövsiyə / regression |
|---|---|---|---|
| BUG-001 | P1 | Taymer dəyişmir; 1 dəqiqəlik imtahanda 65 saniyə sonra auto-submit yoxdur | Timer state/effect səbəbini düzəlt; foreground/background/reload ilə real deadline regression |
| BUG-002 | P1 | `appsettings.Local.json` publish paketinə source ilə eyni məzmunda düşür | Local secret faylını paketdən çıxar; production config qaydasını düzəlt; təmiz publish tərkibi assertion-u |
| BUG-003 | P2 | Access token sessionStorage-dədir; memory-only invariant pozulur | Auth token lifecycle/storage müqaviləsini bərpa et; yalnız key presence ilə test |
| BUG-004 | P2 | Təsdiqsiz login zamanı resend CTA görünmür | Backend message string-indən asılı UI şərtini düzəlt; resend görünüşü və tam mailbox axını |
| BUG-005 | P2 | Qorunan Admin öz profilini dəyişə bilir | Self-update servisində protected-account invariantını tətbiq et; PUT/readback regression |
| BUG-006 | P3 | Login modalından Escape sonrası fokus BODY-də qalır | Açan elementə focus restore; keyboard regression |

**P0=0, P1=2, P2=3, P3=1.** Bir taymer kök səbəbinin iki FAIL ssenarisi bir bug sayılıb. 7 FAIL matris sətri = 6 runtime FAIL + 1 static artifact FAIL; 6 unikal defect. Sızma/hesab ələkeçirmə və ya server deadline bypass sübut olunmadığından iddia edilmir. Tam repro, request/evidence, source:line, confidence və remediation [QA-BUGS.md](QA-BUGS.md)-dədir. Production koduna düzəliş edilməyib.

## Təhlükəsiz təkrar icra və cleanup

Yalnız QA sənədləri və ayrı [test tooling](../../../tools/PreDeployQa/README.md) əlavə olunub; commit/push/PR/deploy yoxdur. API PID 31512 və UI PID 3032 audit temp yoluna görə yoxlanıb dayandırılıb. İstifadəçinin əvvəlcədən işləyən 5251/5173 prosesləri qorunub. [Cleanup sübutu](evidence/cleanup.txt), [tracked hash/diff](evidence/final-hygiene.txt).

Synthetic DB/uploads/keys/credentials və publish artefaktı təkrar araşdırma üçün auditin private temp qovluğunda saxlanıb, Git-ə əlavə edilməyib. Publish daxilindəki Local JSON da həssasdır; həmin temp publish qovluğunu paylaşmaq olmaz. Mənbədəki local konfiqurasiyaya toxunulmayıb. Trace/auth storage export edilməyib. Redaktə olunmuş sübutlar hesabat qovluğundadır. Mövcud fixture üzərində init/rerun əvvəlki state-ə görə repeatable green suite deyil; README-də addım asılılıqları göstərilib.

## Qərar və davam nöqtəsi

İki açıq P1 olduğundan **NO-GO**. Əvvəl BUG-001/002 həll olunmalı, həmin regressiyalar və release paket yoxlaması təkrar keçməlidir. Sonra digər defect-lər, SMTP/OAuth/CAPTCHA/hosting kritik boşluqları və matrisin qalan prioritetli ssenariləri bağlanmalıdır. Bu audit daxilində düzəliş və deploy icra edilməyib. Qalan iş və dəqiq test ID-ləri [QA-CHECKPOINT.md](QA-CHECKPOINT.md)-dədir; arxa planda audit işi davam etmir.
