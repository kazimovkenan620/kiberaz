# Müstəqil yekun əhatə boşluğu təhlili

**Yekun koordinator əlavəsi:** snapshot-dan sonra `FINAL-API-001` PASS əlavə olunub: canonical API 38 ssenaridir (37 PASS/1 FAIL). API dayandırılaraq `evidence/offline-db-inspection.json` yaradılıb: ReadOnly baxışda 12 hesab və test kolleksiyaları təsdiqlənib. Aşağıdakı snapshot tarixi saxlanır; aktual saylar üçün QA-TEST-MATRIX.csv və PRE-DEPLOY-QA-REPORT.md əsasdır. Offline baxış bütün normalized/orphan/backup invariantlarını bağlamır.

Bu sənəd yalnız mövcud sübutların oxunması ilə hazırlanıb. Yeni endpoint çağırışı, brauzer sınağı, DB açılması, runtime startı və əsas QA matrisinə dəyişiklik yoxdur. Yalnız GAP-ANALYSIS.md yazılıb. Əsas auditorun yekun sayları authoritative-dir; aşağıdakı rəqəmlər vaxtı göstərilən snapshot-dır və daha sonra tamamlanan sınaqları avtomatik əhatə etmir.

## Status semantikası

- **PARTIAL** əhatə qiymətləndirməsidir: bir və ya bir neçə altaddımın sübutu var, tam plan ssenarisi icra olunmayıb. Compound ssenarinin plan statusu bu halda **NOT_RUN** qalır; tək altaddım PASS-dan bütöv FE/API PASS çıxarılmır.
- **NOT_RUN** ssenarinin tam icra sübutu yoxdur. Bu, məhsulda həmin funksiyanın işləmədiyini göstərmir.
- **BLOCKED** real xarici konfiqurasiya, hosting və ya icazəli inteqrasiya şərti yoxdur. SMTP çatdırılması, real Google OAuth və real deploy şəbəkəsi bu kateqoriyadadır.
- **FAIL alt-sərhəd** konkret runtime assertion-un pozulmasıdır. Digər altaddımlar yenə açıq qala bilər; həmin FAIL bütün modulun bütün funksiyalarının xarab olması demək deyil.
- Endpoint logunda çağırışın olması yalnız invocation sübutudur. 401/403/400-only çağırış funksional uğur deyil; 200 də cavabın bütün invariantlarının assert edildiyi demək deyil.
- `INV/API-xxx` BACKEND-INVENTORY.md route identifikatorudur. `TEST/API-xxx`, `TEST/EXT-*`, `TEST/BOUND-*`, `TEST/BE-*` runtime test identifikatorlarıdır. Məsələn INV/API-001 admin stats, TEST/API-001 health-dir; ID string-ləri namespace olmadan birləşdirilmir.

## Snapshot sayları və sübut sərhədi

Snapshot vaxtı: **2026-09-17T13:46:21.1539775+04:00**.

Raw API: 44 test sətri; 215 request; BLOCKED=1, FAIL=7, PASS=36.
Raw brauzer: 20 sətr; BLOCKED=2, FAIL=7, PASS=11.
Düzəldilmiş test harness təkrarları seçiləndə API: 37 məntiqi ssenari; FAIL=1, PASS=36.
Brauzerdə eyni TestId üçün son fayl nəticəsi: 16 məntiqi ssenari; PASS=11, FAIL=5. BE-010 korrektə edilmiş 13:45:42 nəticəsi PASS-dır; ilkin text-oracle səhvi məhsul bug-ı sayılmır.

| Fayl | Son yazılma vaxtı | Bayt |
|---|---|---:|
| `api-results.json` | 2026-09-17T13:41:57.2022906+04:00 | 36897 |
| `api-requests.json` | 2026-09-17T13:41:57.2372902+04:00 | 199277 |
| `browser-results.json` | 2026-09-17T13:35:24.0635274+04:00 | 6823 |
| `browser-retest-results.json` | 2026-09-17T13:38:16.2663296+04:00 | 2985 |
| `browser-roles-results.json` | 2026-09-17T13:45:42.8171153+04:00 | 4867 |
| `browser-deadline-results.json` | 2026-09-17T13:43:02.2245535+04:00 | 787 |

**516/516 security regression assertion PASS**, 29 imtiyazlı marşrut və exit 0 ayrıca sübutdur (`REGRESSION-RESULTS.md`, `evidence/security-regression.txt`). Son təkrar `evidence/security-regression-final.txt` 09:43:44 UTC-də yenə 516/516, exit 0 göstərir; bu iki icranı 1032 fərqli assertion kimi toplamaq olmaz. Son backend build 0 warning/0 error, frontend typecheck/lint exit 0 ayrıca gate sübutlarıdır və funksional coverage deyil. 516 rəqəmi 516 funksional ssenari və ya 79 route-un tam E2E əhatəsi demək deyil. Suite Development API + birbaşa servis çağırışlarını birləşdirir, email capture əvəzedicisi istifadə edir. Admin/QuizAdmin 29 route üçün auth yoxlaması CRUD/UI məhsul axınının tam icrası sayılmır.

## Təkrarların düz mənalandırılması

| İlkin nəticə | Əsas son sübut | Qiymətləndirmə |
|---|---|---|
| TEST/API-008: create 201 gözləntisi; TEST/API-008-R: əvvəlki uğurlu yazının kreditini təkrar xərcləmə | TEST/API-008-FINAL PASS | Harness/status/fixture təkrar problemi; course məhsul FAIL kimi sayılmır |
| TEST/API-013 ilkin photo readback failure | TEST/API-013-R PASS | Son korrektə edilmiş harness əsasında upload foto axını keçib |
| TEST/EXT-003, EXT-004 confirm-email replay 200-ü səhv rədd gözləməsi | TEST/EXT-003-R, EXT-004-R PASS | İdempotent confirmation kontraktına uyğun; yanlış orakldan security defect çıxarılmır |
| TEST/EXT-008 request sahə adları yanlış | TEST/EXT-008-R PASS | Düzgün DTO ilə category/question create/delete/restore keçib |
| TEST/BOUND-002 function.futures helper xətası | TEST/BOUND-002-R PASS | İki paralel save bir 200/bir 409 nəticəsi verib; ilkin BLOCKED məhsul failure deyil |
| TEST/BE-004 locator timeout; BE-005/006 ona bağlı ilkin BLOCKED | browser-retest-results | BE-004 create PASS; BE-006 answer/submit PASS; BE-005 timer real FAIL |
| TEST/BE-007 focus | İlkin və retest FAIL | Fokus BODY-də qalıb; düzəlmiş nəticə yoxdur |
| TEST/BE-010 invalid deep-link ilkin text-oracle | browser-roles-results.json son BE-010 PASS; callback-*.txt | Düzəldilmiş mətn/orakl ilə üç callback mənfi UI yoxlaması keçib; ilkin səhv məhsul defect deyil |

## Runtime test → plan/inventar əlaqələri

| Son TEST ssenarisi | INV route-lar / FE planlar | Əhatə və açıq sərhəd |
|---|---|---|
| AUTH-LOGIN-01..09, AUTH-STATE-* | INV/API-028,032; FE-020,022,032 | Çoxrol login/me və blocked/unconfirmed rəddi; form toggle, CAPTCHA retry, bütün session UI yolları tam deyil |
| API-002,003 + SEC-001 | INV/API-001,043,053,068,075 və 29 admin route; FE-104 | Selected wrong-role/guest + suite admin authorization; bütün endpoint×rol×state kartezian matrisi deyil |
| API-004,005 | INV/API-050,051,053,073; FE-015,038,040,044 | Private proyeksiya, duplicate score/overview; bütün quiz UI navigation/keyboard/network ssenariləri deyil |
| API-006 | INV/API-074..078; FE-067..071 | Teacher owner create/add/read və foreign read/add/delete rəddi; owner delete, duplicate/max200/null/consent məhsul qərarı tam deyil |
| API-007, BOUND-001, BOUND-002-R, EXT-009 | INV/API-043..049; FE-048,051..058 | 4 sualda 2 doğru=50%, revision, submit idempotency, foreign access, close state, restart; hər timer/history/error variantı deyil |
| API-008-FINAL, EXT-006 | INV/API-004,007,033,035,037,038; FE-073,077,084,086 | Pending→approved public readback və revision moderation; bütün expiry/reactivate/reject/delete/credit yarışları deyil |
| API-009, EXT-007 | INV/API-001,002,010,012,017..019,052,055,058; FE-080..082,088,092,095,096,098,101 | Admin read/protected exclusion; bütün search/filter/pagination/danger zone UI deyil |
| API-010, EXT-001 | INV/API-068,069; FE-062 | Caller ownership/overposting PASS; owner immutable profile ayrıca FAIL; navbar sync/cancel bütünlüklə yoxlanmayıb |
| API-013-R, BOUND-003 + SEC-001 | INV/API-064..066; FE-074,075 | PNG və benign PDF upload/readback, magic/owner subset, suite sanitizer/kvota; real proxy multipart və UI retry/orphan lifecycle yox |
| EXT-002, API-014 + SEC-001 | INV/API-029,031; FE-032..035 | Cookie flags/refresh/logout; production Secure/TLS ayrıca; browser memory-only storage FAIL |
| EXT-003-R,004-R,005 + SEC-001 | INV/API-021,024,027,072; FE-027..031 | Sintetik issued token + API mutation/readback; real məktub delivery/OAuth provider yoxdur |
| EXT-008-R | INV/API-054,056,060..063; FE-099,100,102,103 | Create/soft-delete/restore; UI edit, paging və bütün bank transition kombinasiyaları deyil |
| BE-001, BE-ROLE-* | FE-001..005,059,060,067,072,080,082,088,095,098,109 | Ekranlar/naviqasiya/390 mobil subset; hər tabın bütün düymələri, 320px, zoom, screen reader, reduced-motion deyil |
| BE-008 | FE-024,025 | Test CAPTCHA ilə register UI subset; real Turnstile və SMTP delivery deyil |
| BE-005, BE-011 | FE-055 | Taymer monotonluğu və 65s sonra auto-submit boundary FAIL; digər tab/background kombinasiyaları açıq |
| BE-007 | FE-019,105 | Modal bağlanandan sonra focus return FAIL; bütün modal növlərinin trap/escape/nesting sınağı deyil |

## Rol, mutasiya və saxlanma boşluqları

| Sahə | Mövcud sübut | Qalan əhatə |
|---|---|---|
| Qonaq/User/Teacher/VIP/Moderator/Admin | API login/role deny; 5 dashboard browser rolları; suite admin auth | Bütün controller action-ları üçün bütün rol kombinasiyaları, fresh/stale token, owner/non-owner və deleted state tam deyil |
| Teacher | Öz class create/add/read, foreign rədd, restart roster | Owner class delete → role switch, class ad/max200/duplicate race; student single-remove/transfer/edit UI mövcud deyil, tələb edilməyən funksiya uydurulmur |
| Exam host/participant | VIP host, User participant, scoring/save/close/concurrency, browser player | VIP participant history recover, Teacher/Moderator participant bütün variantlar; UTC quota reset və max50/max500 böyük sərhədlər bu yeni harness-də tam yoxlanmayıb; suite daily limit ayrıca |
| Course/VIPTerms | Create/approve/revision readback, xarici sahib rəddi | Reject/revision reject/reactivate/delete/expired deadline, credit concurrency/refund, next-term scheduling və scheduler lifecycle; test olmayan axını 200 siyahıdan PASS çıxarmaq olmaz |
| Users/RefreshSessions/RevokedTokens | Profile overposting, owner profile FAIL, reset, confirm, refresh/logout, suite stale writes | Bütün admin update/block/unblock/role/delete və email-change UI roundtrip; metadata davranışı proyeksiyadan tam təsdiqlənmir |
| QuizQuestions/QuizCategories/QuizResults/QuizScoreClaims | Private bank ayrılığı, create/delete/restore, first-answer duplicate, suite parallel score | Bütün edit/filter/pagination/deleted category restore dəstləri və public UI reactivity |
| UploadedFiles/disk | Safe generated PNG path və PDF byte/controller readback; suite kvota/sanitizer | Claim/release course ilə əlaqə, orphan 24h sweeper, restart cleanup, failed course sonrası retry fayl sayları |
| AdminAudit | Admin read views/audit route sübutu | Hər uğurlu mutasiyanın bir audit yazısı, uğursuz mutasiyada siyasət, actor/target/IP integrity və restart retention tam deyil |
| LoginAttempts | Suite account/CAPTCHA sərhədləri | Bu API harness-də restart sonrası attempt persistence, production threshold abuse sınağı ayrıca yoxdur |
| Roles | Login və suite tək Admin enforcement | Bütün startup drift/backfill kombinasiyaları, real production data uyğunluğu yoxlanmayıb |
| Categories/Articles | Statik kolleksiya inventarı | Cari controller CRUD yoxdur; feature kimi əlavə test təsəvvür edilməməlidir |

**Persistence fərqi:** TEST/EXT-009 PASS-də API restartından sonra əvvəlki 50% attempt və teacher class readback-u var. Bu, həmin iki resursun proses restartı arxasında qalmasını sübut edir. Hər kolleksiyanın offline inspection-u, crash/power-loss durability, backup/restore və real DB integrity-ni sübut etmir. Bu snapshot alınanda ayrıca offline-inspect sübut faylı yoxdursa həmin hissə **PENDING/NOT_RUN** saxlanır. Sonradan əsas auditorun offline report-u yaranarsa yekun nəticə ona görə tamamlanmalıdır; bu subtask DB açmayıb.

## İnteqrasiya və yerləşdirmə boşluqları

| Sahə | Cari vəziyyət | Tələb olunan qalan sübut |
|---|---|---|
| SMTP delivery | **BLOCKED**; fixture-generated token + test capture provider ilə auth sınağı var | Real test mailbox-a çatdırılma, SPF/DKIM/DMARC infra siyasəti ayrıca, queue retry/restart semantics; mailbox mesajı göndərilməyib |
| Real Google OAuth | **BLOCKED**; sintetik exchange invalid/expiry/replay suite var | Provider redirect/client settings/consent/callback, doğru hesab bağlanması real authorized test provider ilə |
| Production hosting/TLS/proxy/CDN | **BLOCKED** | Həqiqi host SPA fallback, HSTS/Secure cookies, forwarded IP, CORS, PDF route/static exclusions və deployed /health |
| Production CAPTCHA | **PARTIAL**, real provider E2E BLOCKED | Missing/test/bypass üçün 3 startup probe PASS; real secret/hostname/token provider flow deyil |
| Rate limit | **PARTIAL** | Development limitləri yüksəkdir; named policies production thresholds və 429 UI retry/recovery ayrı mühitdə lazımdır |
| Fon işləri | **NOT_RUN** lifecycle | CourseExpirySweeper 15m, orphan sweeper 24h, email retry/queue full/shutdown davranışı |
| Browser engine/a11y | **PARTIAL** | Sübut engine JSON-dakı engine ilə məhdud; multi-browser, screen reader, 200% zoom, 320px, reduced motion, restricted storage/clipboard tam deyil |
| Release config/runtime | ayrıca təsdiqlənmiş risk | RELEASE-CONFIG-REVIEW.md local secret JSON inclusion və .NET patch gap; bunlar endpoint coverage faizinə daxil edilmir |

## 113 FE planının konservativ xəritəsi

Aşağıdakı hər sətirdə **tam plan statusu NOT_RUN** saxlanır, çünki planlar bir neçə UI/edge altaddımdan ibarətdir və sübut onların hamısını qapatmır. Müstəqil bir tələb artıq pozulubsa alt-sübutda FAIL açıq göstərilir. Real xarici provider/hosting asılılığı olan planlar BLOCKED-dir. Bu cədvəl main matrix statuslarını yenidən yazmır.

| FE plan ID | Tam plan statusu | Mövcud alt-sübut / əhatə | Qalan hissə |
|---|---|---|---|
| FE-001 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-002 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-003 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-004 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-005 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-006 | NOT_RUN | Yeni runtime sübutu yoxdur | Planın bütün addımları açıqdır |
| FE-007 | NOT_RUN | Yeni runtime sübutu yoxdur | Planın bütün addımları açıqdır |
| FE-008 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-009 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-010 | NOT_RUN | PARTIAL: API-008-FINAL, API-013-R, BOUND-003 backend readback; bəzi public ekranlar BE-001 | Modal/contact/link/URL origin və loading/error/retry UI altaddımları |
| FE-011 | NOT_RUN | PARTIAL: API-008-FINAL, API-013-R, BOUND-003 backend readback; bəzi public ekranlar BE-001 | Modal/contact/link/URL origin və loading/error/retry UI altaddımları |
| FE-012 | NOT_RUN | PARTIAL: API-008-FINAL, API-013-R, BOUND-003 backend readback; bəzi public ekranlar BE-001 | Modal/contact/link/URL origin və loading/error/retry UI altaddımları |
| FE-013 | NOT_RUN | PARTIAL: API-008-FINAL, API-013-R, BOUND-003 backend readback; bəzi public ekranlar BE-001 | Modal/contact/link/URL origin və loading/error/retry UI altaddımları |
| FE-014 | NOT_RUN | PARTIAL: API-008-FINAL, API-013-R, BOUND-003 backend readback; bəzi public ekranlar BE-001 | Modal/contact/link/URL origin və loading/error/retry UI altaddımları |
| FE-015 | NOT_RUN | PARTIAL: API-004, API-009 public data/private projection; BE-001 | Bütün filter/empty/error/rapid race UI hallarını icra etmək |
| FE-016 | NOT_RUN | PARTIAL: API-004, API-009 public data/private projection; BE-001 | Bütün filter/empty/error/rapid race UI hallarını icra etmək |
| FE-017 | NOT_RUN | PARTIAL: API-004, API-009 public data/private projection; BE-001 | Bütün filter/empty/error/rapid race UI hallarını icra etmək |
| FE-018 | NOT_RUN | PARTIAL: API-004, API-009 public data/private projection; BE-001 | Bütün filter/empty/error/rapid race UI hallarını icra etmək |
| FE-019 | NOT_RUN | FAIL alt-sərhəd: BE-007 focus return; PARTIAL modal | Bütün modal/escape/backdrop/trap/nesting variantları |
| FE-020 | NOT_RUN | PARTIAL: AUTH-LOGIN-*, BE-002 login; BE-ROLE-* | Toggle/double-submit/switch focus və bütün mənfi forma hallarını yoxlamaq |
| FE-021 | BLOCKED | Real CAPTCHA/SMTP/OAuth və ya hosting şərti | İcazəli real provider/host E2E; local/sintetik yoxlama bunu əvəz etmir |
| FE-022 | NOT_RUN | FAIL alt-sərhəd: BE-003 resend CTA yoxdur | CTA-dan real resend/delivery; compound flow qapanmayıb |
| FE-023 | NOT_RUN | PARTIAL: AUTH-LOGIN-*, BE-002 login; BE-ROLE-* | Toggle/double-submit/switch focus və bütün mənfi forma hallarını yoxlamaq |
| FE-024 | NOT_RUN | PARTIAL: BE-008 register; API-012 validation | Bütün sahə/role/gender/password/duplicate retry variantları; real CAPTCHA/delivery |
| FE-025 | NOT_RUN | PARTIAL: BE-008 register; API-012 validation | Bütün sahə/role/gender/password/duplicate retry variantları; real CAPTCHA/delivery |
| FE-026 | BLOCKED | Real CAPTCHA/SMTP/OAuth və ya hosting şərti | İcazəli real provider/host E2E; local/sintetik yoxlama bunu əvəz etmir |
| FE-027 | NOT_RUN | PARTIAL: EXT-003-R,004-R,005; SEC-001 sintetik token sərhədləri; BE-010 corrected PASS (mənfi callback UI) | Bütün brauzer callback state-ləri və real provider məktub/OAuth yolu |
| FE-028 | NOT_RUN | PARTIAL: EXT-003-R,004-R,005; SEC-001 sintetik token sərhədləri; BE-010 corrected PASS (mənfi callback UI) | Bütün brauzer callback state-ləri və real provider məktub/OAuth yolu |
| FE-029 | NOT_RUN | PARTIAL: EXT-003-R,004-R,005; SEC-001 sintetik token sərhədləri; BE-010 corrected PASS (mənfi callback UI) | Bütün brauzer callback state-ləri və real provider məktub/OAuth yolu |
| FE-030 | BLOCKED | Real CAPTCHA/SMTP/OAuth və ya hosting şərti | İcazəli real provider/host E2E; local/sintetik yoxlama bunu əvəz etmir |
| FE-031 | NOT_RUN | PARTIAL: EXT-003-R,004-R,005; SEC-001 sintetik token sərhədləri; BE-010 corrected PASS (mənfi callback UI) | Bütün brauzer callback state-ləri və real provider məktub/OAuth yolu |
| FE-032 | NOT_RUN | PARTIAL: BE-002 reload; EXT-002; SEC-001 refresh | Yeni tab və UI refresh-failure/multi401 bütün variantlar |
| FE-033 | NOT_RUN | PARTIAL: BE-002 reload; EXT-002; SEC-001 refresh | Yeni tab və UI refresh-failure/multi401 bütün variantlar |
| FE-034 | NOT_RUN | PARTIAL: BE-009 və API-014 logout/back/reload | Navbar/kabinet hər giriş yolu və tam compound state dəsti |
| FE-035 | NOT_RUN | FAIL: BE-002 token sessionStorage-də; memory-only tələb pozulur | Düzəliş sonrası storage yoxlaması; token dəyəri sübuta çıxarılmamalıdır |
| FE-036 | BLOCKED | Real CAPTCHA/SMTP/OAuth və ya hosting şərti | İcazəli real provider/host E2E; local/sintetik yoxlama bunu əvəz etmir |
| FE-037 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-038 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-039 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-040 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-041 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-042 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-043 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-044 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-045 | NOT_RUN | PARTIAL yalnız backend: API-004,005; SEC-001 quiz | Planın quiz UI navigation/keyboard/results/confirm və transport altaddımları NOT_RUN |
| FE-046 | NOT_RUN | PARTIAL: BE-004 retest create; API-003,007 | Bütün role gate, quota, clipboard və forma sərhədləri |
| FE-047 | NOT_RUN | PARTIAL: BE-004 retest create; API-003,007 | Bütün role gate, quota, clipboard və forma sərhədləri |
| FE-048 | NOT_RUN | PARTIAL: BE-004 retest create; API-003,007 | Bütün role gate, quota, clipboard və forma sərhədləri |
| FE-049 | NOT_RUN | PARTIAL: SEC-001 daily quota; API-007 host create | 7/8 UI, UTC reset, expired VIP görünüşü birlikdə tam deyil |
| FE-050 | NOT_RUN | PARTIAL: BE-004 retest create; API-003,007 | Bütün role gate, quota, clipboard və forma sərhədləri |
| FE-051 | NOT_RUN | PARTIAL: BE-006, API-007, BOUND-001, BOUND-002-R, EXT-009 | Bütün wrong/lowercase/closed/history/offline/keyboard/pending-answer halları |
| FE-052 | NOT_RUN | PARTIAL: BE-006, API-007, BOUND-001, BOUND-002-R, EXT-009 | Bütün wrong/lowercase/closed/history/offline/keyboard/pending-answer halları |
| FE-053 | NOT_RUN | PARTIAL: BE-006, API-007, BOUND-001, BOUND-002-R, EXT-009 | Bütün wrong/lowercase/closed/history/offline/keyboard/pending-answer halları |
| FE-054 | NOT_RUN | PARTIAL: BE-006, API-007, BOUND-001, BOUND-002-R, EXT-009 | Bütün wrong/lowercase/closed/history/offline/keyboard/pending-answer halları |
| FE-055 | NOT_RUN | FAIL alt-sərhədlər: BE-005 timer; BE-011 deadline auto-submit | Background tab və bütün recovery variantları; server expiry ayrıca qoruna bilər |
| FE-056 | NOT_RUN | PARTIAL: BE-006, API-007, BOUND-001, BOUND-002-R, EXT-009 | Bütün wrong/lowercase/closed/history/offline/keyboard/pending-answer halları |
| FE-057 | NOT_RUN | PARTIAL: API-007 dashboard, BOUND-001 close | Browser polling/manual/cancel/offline/UI state variantları |
| FE-058 | NOT_RUN | PARTIAL: API-007 dashboard, BOUND-001 close | Browser polling/manual/cancel/offline/UI state variantları |
| FE-059 | NOT_RUN | PARTIAL: BE-ROLE-* kabinet tabları; API-005 overview | Real data identity, bütün loading/empty/error və promo/scroll hədəfləri |
| FE-060 | NOT_RUN | PARTIAL: BE-ROLE-* kabinet tabları; API-005 overview | Real data identity, bütün loading/empty/error və promo/scroll hədəfləri |
| FE-061 | NOT_RUN | PARTIAL: BE-ROLE-* kabinet tabları; API-005 overview | Real data identity, bütün loading/empty/error və promo/scroll hədəfləri |
| FE-062 | NOT_RUN | PARTIAL: API-010 ownership; EXT-001 owner invariant FAIL | Browser edit/cancel/nickname navbar sync və bütün validator hallarını icra etmək |
| FE-063 | NOT_RUN | Yeni runtime sübutu yoxdur | Planın bütün addımları açıqdır |
| FE-064 | NOT_RUN | PARTIAL yalnız əlaqəli servis/regression auth sərhədləri SEC-001; dashboard profil açılıb | UI actual mutation→email/role→logout→relogin tam axını; SMTP BLOCKED |
| FE-065 | NOT_RUN | PARTIAL yalnız əlaqəli servis/regression auth sərhədləri SEC-001; dashboard profil açılıb | UI actual mutation→email/role→logout→relogin tam axını; SMTP BLOCKED |
| FE-066 | NOT_RUN | PARTIAL yalnız əlaqəli servis/regression auth sərhədləri SEC-001; dashboard profil açılıb | UI actual mutation→email/role→logout→relogin tam axını; SMTP BLOCKED |
| FE-067 | NOT_RUN | PARTIAL: API-006, EXT-009; BE-ROLE-TeacherA ekran | Browser create/add/detail/delete/confirm/cancel + duplicate/protected/max sərhədləri |
| FE-068 | NOT_RUN | PARTIAL: API-006, EXT-009; BE-ROLE-TeacherA ekran | Browser create/add/detail/delete/confirm/cancel + duplicate/protected/max sərhədləri |
| FE-069 | NOT_RUN | PARTIAL: API-006, EXT-009; BE-ROLE-TeacherA ekran | Browser create/add/detail/delete/confirm/cancel + duplicate/protected/max sərhədləri |
| FE-070 | NOT_RUN | PARTIAL: API-006, EXT-009; BE-ROLE-TeacherA ekran | Browser create/add/detail/delete/confirm/cancel + duplicate/protected/max sərhədləri |
| FE-071 | NOT_RUN | PARTIAL: API-006, EXT-009; BE-ROLE-TeacherA ekran | Browser create/add/detail/delete/confirm/cancel + duplicate/protected/max sərhədləri |
| FE-072 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-073 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-074 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-075 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-076 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-077 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-078 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-079 | NOT_RUN | PARTIAL: BE-ROLE-VIPA; API-008-FINAL, EXT-006, API-013-R, BOUND-003 | Bütün course form/upload/error/retry/delete/reactivate UI əməliyyatları tam deyil |
| FE-080 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-081 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-082 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-083 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-084 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-085 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-086 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-087 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-088 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-089 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-090 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-091 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-092 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-093 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-094 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-095 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-096 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-097 | NOT_RUN | Yeni runtime sübutu yoxdur | Planın bütün addımları açıqdır |
| FE-098 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-099 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-100 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-101 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-102 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-103 | NOT_RUN | PARTIAL: BE-ROLE-AdminA ekran; EXT-007/008-R, EXT-006, API-008-FINAL; SEC-001 auth | Admin UI bütün düymə/form/filter/confirm/search/page mutation ssenariləri tam deyil |
| FE-104 | NOT_RUN | PARTIAL: SEC-001 29 admin route deny; API-003 | Saxta UI rol state + bütün browser mutation endpoint-lərinə faktiki deny flow |
| FE-105 | NOT_RUN | FAIL alt-sərhəd: BE-007 focus return; PARTIAL modal | Bütün modal/escape/backdrop/trap/nesting variantları |
| FE-106 | NOT_RUN | PARTIAL yalnız əlaqəli mövcud ekran/API sübutları; tam komponent sınağı yoxdur | Planın xüsusi keyboard/busy/network/storage/deep-link/upload-retry edge dəsti |
| FE-107 | NOT_RUN | PARTIAL yalnız əlaqəli mövcud ekran/API sübutları; tam komponent sınağı yoxdur | Planın xüsusi keyboard/busy/network/storage/deep-link/upload-retry edge dəsti |
| FE-108 | NOT_RUN | PARTIAL yalnız əlaqəli mövcud ekran/API sübutları; tam komponent sınağı yoxdur | Planın xüsusi keyboard/busy/network/storage/deep-link/upload-retry edge dəsti |
| FE-109 | NOT_RUN | PARTIAL: BE-001; BE-ROLE-* ekran/naviqasiya/ölçü subset | Bütün link/menu/keyboard/reduced-motion/zoom və planın ayrı hallarının tam icrası |
| FE-110 | NOT_RUN | PARTIAL yalnız əlaqəli mövcud ekran/API sübutları; tam komponent sınağı yoxdur | Planın xüsusi keyboard/busy/network/storage/deep-link/upload-retry edge dəsti |
| FE-111 | NOT_RUN | PARTIAL yalnız əlaqəli mövcud ekran/API sübutları; tam komponent sınağı yoxdur | Planın xüsusi keyboard/busy/network/storage/deep-link/upload-retry edge dəsti |
| FE-112 | NOT_RUN | PARTIAL yalnız əlaqəli mövcud ekran/API sübutları; tam komponent sınağı yoxdur | Planın xüsusi keyboard/busy/network/storage/deep-link/upload-retry edge dəsti |
| FE-113 | NOT_RUN | PARTIAL yalnız əlaqəli mövcud ekran/API sübutları; tam komponent sınağı yoxdur | Planın xüsusi keyboard/busy/network/storage/deep-link/upload-retry edge dəsti |

## 79 endpoint üçün request → TEST xəritəsi

Bu cədvəl yalnız API request snapshot-ını avtomatik route pattern-lərlə tutur; brauzer/suite sübutları yuxarıdakı semantik xəritələrdə ayrıca qalır. Heç bir sıra avtomatik funksional PASS deyil.

| INV ID | Metod / route | Çağırış/status | Son əlaqəli TEST-lər | Qiymətləndirmə |
|---|---|---|---|---|
| INV/API-001 | `GET /api/Admin/stats` | 3 / 200,401,403 | TEST/API-002 PASS; TEST/API-003 PASS; TEST/EXT-007 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-002 | `GET /api/Admin/courses` | 1 / 200 | TEST/EXT-007 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-003 | `POST /api/Admin/courses` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-004 | `PATCH /api/Admin/courses/{id:int}/approve` | 1 / 200 | TEST/API-008-FINAL PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-005 | `PATCH /api/Admin/courses/{id:int}/reject` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-006 | `PUT /api/Admin/courses/{id:int}` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-007 | `PATCH /api/Admin/courses/{id:int}/revision/approve` | 1 / 200 | TEST/EXT-006 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-008 | `PATCH /api/Admin/courses/{id:int}/revision/reject` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-009 | `DELETE /api/Admin/courses/{id:int}` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-010 | `GET /api/Admin/users` | 3 / 200 | TEST/API-009 PASS; TEST/EXT-007 PASS; TEST/EXT-003-R PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-011 | `POST /api/Admin/users/{userId}/vip-term` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-012 | `GET /api/Admin/users/{userId}` | 1 / 200 | TEST/EXT-007 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-013 | `PUT /api/Admin/users/{userId}` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-014 | `DELETE /api/Admin/users/{userId}` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-015 | `PATCH /api/Admin/users/{userId}/role` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-016 | `PATCH /api/Admin/users/{userId}/block` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-017 | `GET /api/Admin/exam-sessions` | 1 / 200 | TEST/EXT-007 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-018 | `GET /api/Admin/exam-sessions/{id}` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-019 | `GET /api/Admin/audit` | 1 / 200 | TEST/EXT-007 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-020 | `POST /api/auth/register` | 2 / 400 | TEST/API-012 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-021 | `POST /api/auth/confirm-email` | 6 / 200,400 | TEST/EXT-003-R PASS; TEST/EXT-004-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-022 | `POST /api/auth/resend-confirmation` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-023 | `POST /api/auth/forgot-password` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-024 | `POST /api/auth/reset-password` | 3 / 200,400 | TEST/EXT-005 PASS; TEST/EXT-003-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-025 | `GET /api/auth/google` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-026 | `GET /api/auth/google-callback` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-027 | `POST /api/auth/google/exchange` | 1 / 400 | TEST/EXT-003-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-028 | `POST /api/auth/login` | 49 / 200,401 | TEST/AUTH-LOGIN-01 PASS; TEST/AUTH-LOGIN-02 PASS; TEST/AUTH-LOGIN-03 PASS; TEST/AUTH-LOGIN-04 PASS; TEST/AUTH-LOGIN-05 PASS; TEST/AUTH-LOGIN-06 PASS; TEST/AUTH-LOGIN-07 PASS; TEST/AUTH-LOGIN-08 PASS; TEST/AUTH-LOGIN-09 PASS; TEST/AUTH-STATE-Unconfirmed PASS; TEST/AUTH-STATE-Blocked PASS; TEST/EXT-002 PASS; TEST/EXT-005 PASS; TEST/EXT-004-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-029 | `POST /api/auth/logout` | 1 / 200 | TEST/API-014 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-030 | `POST /api/auth/logout-all` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-031 | `POST /api/auth/refresh` | 2 / 200,400 | TEST/API-014 PASS; TEST/EXT-002 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-032 | `GET /api/auth/me` | 48 / 200,401 | TEST/AUTH-LOGIN-01 PASS; TEST/AUTH-LOGIN-02 PASS; TEST/AUTH-LOGIN-03 PASS; TEST/AUTH-LOGIN-04 PASS; TEST/AUTH-LOGIN-05 PASS; TEST/AUTH-LOGIN-06 PASS; TEST/AUTH-LOGIN-07 PASS; TEST/AUTH-LOGIN-08 PASS; TEST/AUTH-LOGIN-09 PASS; TEST/API-010 PASS; TEST/API-014 PASS; TEST/EXT-005 PASS; TEST/EXT-004-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-033 | `POST /api/Course` | 2 / 200,402 | — | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-034 | `GET /api/Course` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-035 | `GET /api/Course/{id:int}` | 5 / 200,404 | TEST/API-008-FINAL PASS; TEST/EXT-006 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-036 | `GET /api/Course/vip-status` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-037 | `GET /api/Course/mine` | 1 / 200 | TEST/API-008-FINAL PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-038 | `PUT /api/Course/{id:int}` | 2 / 200,404 | TEST/API-008-FINAL PASS; TEST/EXT-006 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-039 | `DELETE /api/Course/{id:int}` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-040 | `POST /api/Course/{id:int}/reactivate` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-041 | `GET /api/exam-sessions/categories` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-042 | `GET /api/exam-sessions/mine` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-043 | `POST /api/exam-sessions` | 4 / 200,403 | TEST/API-003 PASS; TEST/API-007 PASS; TEST/BOUND-002-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-044 | `POST /api/exam-sessions/join` | 7 / 200,400,403,409 | TEST/API-007 PASS; TEST/BOUND-001 PASS; TEST/BOUND-002-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-045 | `GET /api/exam-sessions/attempts/{id}` | 4 / 200,404 | TEST/API-007 PASS; TEST/EXT-009 PASS; TEST/BOUND-001 PASS; TEST/BOUND-002-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-046 | `PUT /api/exam-sessions/attempts/{id}/answer` | 8 / 200,404,409 | TEST/API-007 PASS; TEST/BOUND-002-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-047 | `POST /api/exam-sessions/attempts/{id}/submit` | 3 / 200,404 | TEST/API-007 PASS; TEST/BOUND-001 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-048 | `GET /api/exam-sessions/{code}/dashboard` | 2 / 200,404 | TEST/API-007 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-049 | `POST /api/exam-sessions/{code}/close` | 2 / 200,404 | TEST/BOUND-001 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-050 | `GET /api/Quiz/categories` | 1 / 200 | TEST/API-004 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-051 | `GET /api/Quiz/questions` | 3 / 200,400 | TEST/API-004 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-052 | `GET /api/Quiz/leaderboard` | 1 / 200 | TEST/API-009 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-053 | `POST /api/Quiz/submit` | 3 / 200,401 | TEST/API-002 PASS; TEST/API-005 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-054 | `POST /api/Quiz/categories` | 2 / 201 | TEST/EXT-008-R PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-055 | `GET /api/Quiz/admin/categories` | 1 / 200 | TEST/EXT-007 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-056 | `POST /api/Quiz/categories/{id:int}/restore` | 1 / 200 | TEST/EXT-008-R PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-057 | `PUT /api/Quiz/categories/{id:int}` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-058 | `GET /api/Quiz/admin/questions` | 1 / 200 | TEST/EXT-007 PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-059 | `PUT /api/Quiz/questions/{id:int}` | 0 / — | — | NOT_RUN bu API snapshot-da; SEC-001 auth-only əlaqəsi |
| INV/API-060 | `POST /api/Quiz/questions/{id:int}/restore` | 1 / 200 | TEST/EXT-008-R PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-061 | `DELETE /api/Quiz/categories/{id:int}` | 1 / 200 | TEST/EXT-008-R PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-062 | `POST /api/Quiz/questions` | 2 / 201,400 | TEST/EXT-008-R PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-063 | `DELETE /api/Quiz/questions/{id:int}` | 1 / 200 | TEST/EXT-008-R PASS | PARTIAL invocation; tam plan NOT_RUN; SEC-001 auth-only əlaqəsi |
| INV/API-064 | `GET /uploads/syllabus/{fileName}` | 1 / 200 | TEST/BOUND-003 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-065 | `POST /api/Upload/photo` | 6 / 200,400,403 | TEST/API-013-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-066 | `POST /api/Upload/syllabus` | 1 / 200 | TEST/BOUND-003 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-067 | `PATCH /api/User/role` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-068 | `GET /api/User/profile` | 5 / 200,401 | TEST/API-002 PASS; TEST/API-010 PASS; TEST/EXT-001 FAIL | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-069 | `PUT /api/User/profile` | 2 / 200 | TEST/API-010 PASS; TEST/EXT-001 FAIL | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-070 | `POST /api/User/profile/change-email` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-071 | `POST /api/User/profile/request-password-change` | 0 / — | — | NOT_RUN bu API snapshot-da |
| INV/API-072 | `POST /api/User/confirm-email-change` | 1 / 400 | TEST/EXT-003-R PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-073 | `GET /api/User/me/overview` | 2 / 200 | TEST/API-005 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-074 | `GET /api/User/students/{studentId}/overview` | 2 / 200,400 | TEST/API-006 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-075 | `GET /api/User/teacher/classes` | 4 / 200,401,403 | TEST/API-002 PASS; TEST/API-003 PASS; TEST/API-006 PASS; TEST/EXT-009 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-076 | `POST /api/User/teacher/classes` | 1 / 200 | TEST/API-006 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-077 | `POST /api/User/teacher/classes/{classId:int}/students` | 2 / 200,400 | TEST/API-006 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-078 | `DELETE /api/User/teacher/classes/{classId:int}` | 1 / 400 | TEST/API-006 PASS | PARTIAL invocation; tam plan NOT_RUN |
| INV/API-079 | `GET /health` | 1 / 200 | TEST/API-001 PASS | PARTIAL invocation; tam plan NOT_RUN |

Bu snapshot: 52/79 route üçün ən az bir API çağırışı; 27 route üçün bu request faylında çağırış yoxdur. Bu, funksional coverage faizi deyil.

## Açıq prioritetlər

1. Runtime təsdiqlənmiş tələb pozuntuları: owner immutable profile (EXT-001), token storage (BE-002), resend CTA (BE-003), timer/auto-submit (BE-005/011), modal focus (BE-007). Bug ID/severity üçün əsas auditorun yekun hesabatı əsasdır.
2. Release paketi local secret inclusion və runtime patch səviyyəsi ayrıca release gate olaraq qalır.
3. Qalan compound FE planlar və bütün owner/role/state variantları tamamlanmadan 113/113 PASS və ya 79/79 funksional PASS iddiası verilə bilməz.
4. SMTP/Google/hosting BLOCKED açıq saxlanır; API-issued synthetic token uğuru məktubun çatmasını sübut etmir.
5. Son pending offline inspection bu snapshot-dan sonra gəlirsə əsas auditor son qərara əlavə etməlidir. BE-010 corrected PASS artıq nəzərə alınıb; bu sənəd offline pending nəticəni özbaşına PASS etmir.
