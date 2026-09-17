# QA test matrisi — yekun snapshot

Audit **INCOMPLETE**, release **NO-GO**. Tam metadata, addımlar, expected/actual, tarix, run/commit və request range [CSV](QA-TEST-MATRIX.csv)-dədir. Bu Markdown onun oxunaqlı indeksidir.

`RUN-*` faktiki icra olunmuş məhdud ssenarilərdir. `GAP-FE-*` və `GAP-INV-*` inventardakı geniş planların hələ qapanmayan hissələridir; keçmiş altaddımları ikinci dəfə PASS saymır. Bunlar atomik assertion sayı deyil. Geniş planların konservativ məxrəci auditin tamamlanmadığını göstərir; faiz bütün məhsulun doğruluq ehtimalı deyil. NOT_RUN/BLOCKED timestamp icra vaxtı deyil, planın son qiymətləndirmə vaxtıdır.

İlkin harness/environment/oracle səhvləri raw evidence-də saxlanıb; son düzgün oracle nəticəsi məntiqi ssenaridə sayılır. Səbəblər [gap-analysis](GAP-ANALYSIS.md)-dədir. Məhsul FAIL-ləri retry ilə gizlədilmir. Registration CAPTCHA sınağı SANDBOX-dur; SMTP və Google real inteqrasiya PASS deyil. Security suite-in 516 assertion-u ayrıca vahiddir, 516 E2E ssenari kimi sayılmır.


| Sübut səviyyəsi | PASS | FAIL | BLOCKED | NOT_RUN | N/A | Execution coverage | Runtime pass rate |
|---|---:|---:|---:|---:|---:|---|---|
| API_RUNTIME | 37 | 1 | 0 | 79 | 0 | 38/117 (32.5%) | 37/38 (97.4%) |
| BROWSER_E2E | 11 | 5 | 4 | 109 | 1 | 16/129 (12.4%) | 11/16 (68.8%) |
| INTEGRATION | 5 | 0 | 5 | 3 | 1 | 5/13 (38.5%) | N/A — ayrıca gate/suite |
| STATIC_ONLY | 9 | 1 | 0 | 0 | 0 | 10/10 (100.0%) | N/A — ayrıca gate/suite |
| UNIT | 0 | 0 | 0 | 0 | 2 | N/A (0/0) | N/A — ayrıca gate/suite |

| Test ID | Feature / qalan plan | Sübut | Status | Əhatə | Bug |
|---|---|---|---|---|---|
| RUN-API-001 | Health/security headers | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-01 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-02 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-03 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-04 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-05 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-06 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-07 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-08 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-LOGIN-09 | Rol login/me | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-002 | Guest restricted endpoints | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-003 | Wrong role | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-004 | Quiz public projection | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-005 | Quiz submit/duplicate scoring | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-006 | Teacher class cross-owner | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-007 | Exam deterministic scoring/ownership | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-009 | Hidden administrator | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-010 | Profile ownership/overposting | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-011 | CORS explicit allowlist | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-012 | Registration validation | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-STATE-Unconfirmed | Account state | API_RUNTIME | PASS | SCENARIO |  |
| RUN-AUTH-STATE-Blocked | Account state | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-014 | Logout revocation | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-013-R | Upload auth/magic/filename | API_RUNTIME | PASS | SCENARIO |  |
| RUN-API-008-FINAL | Course publication/moderation | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-001 | Protected owner immutable profile | API_RUNTIME | FAIL | SCENARIO | BUG-005 |
| RUN-EXT-002 | Refresh transport | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-005 | Fixture reset token boundary | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-006 | Course revision moderation | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-007 | Admin read views | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-009 | Restart persistence | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-003-R | Invalid callback/exchange tokens | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-004-R | Fixture confirmation token boundary | API_RUNTIME | PASS | SCENARIO |  |
| RUN-EXT-008-R | Admin question/category lifecycle | API_RUNTIME | PASS | SCENARIO |  |
| RUN-BOUND-001 | Closed exam/ownership/state | API_RUNTIME | PASS | SCENARIO |  |
| RUN-BOUND-003 | PDF upload/sanitizer/readback | API_RUNTIME | PASS | SCENARIO |  |
| RUN-BOUND-002-R | Two-tab revision concurrency | API_RUNTIME | PASS | SCENARIO |  |
| RUN-FINAL-API-001 | Final auth/authorization/cross-role smoke | API_RUNTIME | PASS | SCENARIO |  |
| RUN-BE-001 | Guest navigation/theme/responsive | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-002 | Login/reload/storage | BROWSER_E2E | FAIL | SCENARIO | BUG-003 |
| RUN-BE-003 | Unconfirmed account resend | BROWSER_E2E | FAIL | SCENARIO | BUG-004 |
| RUN-BE-004 | VIP creates exam through UI | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-005 | Exam join/timer monotonicity | BROWSER_E2E | FAIL | SCENARIO | BUG-001 |
| RUN-BE-006 | Exam UI answer/submit/result | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-007 | Modal keyboard focus | BROWSER_E2E | FAIL | SCENARIO | BUG-006 |
| RUN-BE-008 | Registration UI with official test CAPTCHA | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-009 | Logout/back/reload isolation | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-ROLE-UserA | Dashboard screens | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-ROLE-TeacherA | Dashboard screens | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-ROLE-VIPA | Dashboard screens | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-ROLE-ModeratorA | Dashboard screens | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-ROLE-AdminA | Dashboard screens | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-010 | Invalid callbacks/deep links | BROWSER_E2E | PASS | SCENARIO |  |
| RUN-BE-011 | Deadline auto-submit | BROWSER_E2E | FAIL | SCENARIO | BUG-001 |
| BUILD-01 | Backend restore/Release build | STATIC_ONLY | PASS | SCENARIO |  |
| BUILD-02 | Backend publish | STATIC_ONLY | PASS | SCENARIO |  |
| BUILD-03 | Frontend isolated lockfile restore | STATIC_ONLY | PASS | SCENARIO |  |
| BUILD-04 | Frontend final typecheck/lint | STATIC_ONLY | PASS | SCENARIO |  |
| BUILD-05 | Frontend production build final | STATIC_ONLY | PASS | SCENARIO |  |
| BUILD-06 | Backend final release gate | STATIC_ONLY | PASS | SCENARIO |  |
| HYGIENE-01 | Tracked mənbə bütövlüyü | STATIC_ONLY | PASS | SCENARIO |  |
| DEP-01 | npm lockfile advisory audit | STATIC_ONLY | PASS | SCENARIO |  |
| DEP-02 | NuGet advisory audit | STATIC_ONLY | PASS | SCENARIO |  |
| REL-CFG-01 | Publish local secret faylı | STATIC_ONLY | FAIL | SCENARIO | BUG-002 |
| UNIT-01 | Ayrıca unit test layihəsi | UNIT | N/A | SCENARIO |  |
| UNIT-02 | Frontend unit test script | UNIT | N/A | SCENARIO |  |
| SEC-001 | Mövcud security regression suite | INTEGRATION | PASS | SCENARIO |  |
| PROD-START-1 | missing-secret | INTEGRATION | PASS | SCENARIO |  |
| PROD-START-2 | official-test-key | INTEGRATION | PASS | SCENARIO |  |
| PROD-START-3 | bypass-enabled | INTEGRATION | PASS | SCENARIO |  |
| DB-001 | Offline LiteDB inspection | INTEGRATION | PASS | SCENARIO |  |
| GAP-FE-001 | Navbar/Footer loqosu və 5 bölmə linki — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-002 | Mobil menu aç/bağla, backdrop, resize — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-003 | İstifadəçi menyusu, kənara klik/Escape, Kabinetim — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-004 | Skip link, yuxarıya qayıt — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-005 | Açıq/tünd mövzu — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-006 | Çərəz banneri qəbul/rədd — qalan geniş plan | BROWSER_E2E | NOT_RUN | NONE |  |
| GAP-FE-007 | Hüquqi linklər: footer, qeydiyyat, cookie — qalan geniş plan | BROWSER_E2E | NOT_RUN | NONE |  |
| GAP-FE-008 | About CTA “Biliklər”, “Platformanı kəşf et” — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-009 | PlatformShowcase 4 modul, əvvəl/sonra, indikator, ox düymələri, CTA — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-010 | Təlim kataloqu, loading/empty/error/retry — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-011 | “Proqram və əlaqə”, bağla/backdrop — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-012 | Təlimçi LinkedIn/GitHub — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-013 | Kart/modal sillabus, müəllim fotosu — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-014 | “Təlimini paylaş”, boş kataloq “Təlim əlavə et” — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-015 | Bilik kateqoriyası seçimi və detal — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-016 | Liderlik dövrü həftəlik/aylıq/ümumi — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-017 | Liderlik kateqoriya filtri, sürətli dəyişmə — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-018 | Public API offline/500/429 — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-019 | Navbar və quiz/imtahan CTA ilə login/register açma — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-020 | Login, şifrə göstər/gizlət — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-021 | CAPTCHA tələb olunan login və retry — qalan geniş plan | BROWSER_E2E | BLOCKED | NONE |  |
| GAP-FE-022 | Təsdiqsiz düzgün-parol login → resend — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-023 | Login → qeydiyyat / şifrəni unutdum — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-024 | Register ad, soyad, email, nickname, User/Teacher, cins, parol/təkrar — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-025 | Register password toggle/strength, success close, login keçid — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-026 | Forgot password, e-poçt + CAPTCHA, uğur/error — qalan geniş plan | BROWSER_E2E | BLOCKED | NONE |  |
| GAP-FE-027 | `/reset-password#userId=…&token=…` — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-028 | `/confirm-email#…` — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-029 | `/confirm-email-change#…` — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-030 | Google giriş/qeydiyyat düymələri — qalan geniş plan | BROWSER_E2E | BLOCKED | NONE |  |
| GAP-FE-031 | `/google-login-callback#code=…` — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-032 | Reload/yeni tab sessiya bərpası — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-033 | Paralel API 401, refresh uğur/fail — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-034 | Navbar/kabinet çıxış, sonra Back/reload — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-035 | Token saxlanma müqaviləsi — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-036 | Birbaşa 4 auth path refresh — qalan geniş plan | BROWSER_E2E | BLOCKED | NONE |  |
| GAP-FE-037 | Kateqoriyadan quiz aç, sidebar/breadcrumb/promo/qayıt — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-038 | Çətinlik, 10/20/30/40/50 sual seçimi — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-039 | Network Qarışıq/Security/Attacks — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-040 | Variant seç, bütün izahlar və düzgün cavab — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-041 | Anonim variant seçimi → giriş → eyni suala cavab — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-042 | Əvvəl/Növbəti/naviqator — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-043 | A–D/1–4/ox klaviatura, modal açıq halda — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-044 | Son nəticə, səviyyələr, restart, biliklərə qayıt — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-045 | Başlanmış quizdə başqa category təsdiq/ləğv — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-046 | İmtahan overview, anonim login və admin gate — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-047 | Sessiya yarat modalı/kateqoriyalar — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-048 | Başlıq, müddət 15/30/45/60/90/120, say +/− — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-049 | Günlük 7 limit, UTC reset, aktiv VIP dövrü — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-050 | Yaranan/son sessiya kodunu kopyala, panelə keç — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-051 | Kodla qoşul, lowercase/paste/yanlış/bağlı kod — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-052 | Cəhdi tarixçədən davam et/nəticə aç — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-053 | İmtahan variantı və revision conflict — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-054 | Əvvəl/növbəti/naviqator — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-055 | Geri sayım və vaxt bitməsi — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-056 | İmtahanı bitir, təsdiq/ləğv, cavabsız xəbərdarlıq — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-057 | Canlı panel, 10s polling, manual yenilə/geri — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-058 | Sessiyanı bağla, confirm/cancel — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-059 | Ümumi baxış, progress, son fəaliyyət, imtahanlarım — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-060 | Sidebar tabları, “Hamısını gör”, “Profilə keç” — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-061 | Kabinet ana səhifə / “Biliklərə keç” / promo — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-062 | Profil redaktə, save/cancel — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-063 | Profil ID kopyala — qalan geniş plan | BROWSER_E2E | NOT_RUN | NONE |  |
| GAP-FE-064 | E-poçt dəyişmə linki — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-065 | Şifrə dəyişmə linki — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-066 | User ↔ Teacher təsdiq/ləğv — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-067 | Teacher sinif siyahısı/seçimi — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-068 | Sinif yarat — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-069 | ID ilə tələbə əlavə et — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-070 | Roster “Bax”, detail bağla — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-071 | Profil rol-keçid hissəsində sinif sil — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-072 | “Təlimlərim”, refresh/retry, VIP dövr/status kartı — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-073 | Yeni təlim forması — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-074 | Foto seç və yüklə — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-075 | PDF seç və yüklə — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-076 | Mövzu əlavə et, mövzu boşalt, submit/cancel — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-077 | Mövcud təlim redaktəsi — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-078 | Təlim sil, confirm/cancel — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-079 | Passiv təlim yenidən aktivləşdir — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-080 | Admin icmal / refresh / alert CTA-ları — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-081 | Son əməliyyatlar / refresh/retry — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-082 | Təlim siyahısı / status tab / search / refresh — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-083 | Admin sürətli təlim yarat, cancel — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-084 | Təlim təsdiq/rədd — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-085 | Təlim redaktə modalı/shared CourseForm — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-086 | Pending revision aç/gizlət/təsdiq/rədd — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-087 | Admin təlim sil confirm/cancel — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-088 | İstifadəçi search/debounce/refresh — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-089 | İstifadəçi role select — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-090 | VIP dövrü aç — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-091 | Blokla confirm/cancel, bloku aç — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-092 | User detail aç/bağla/retry — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-093 | User detail ad/soyad/nickname/cins/email-confirm save — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-094 | Danger zone aç, nickname yaz, sil — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-095 | Admin imtahan search/status/refresh — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-096 | İmtahan nəticə modalı/retry/close — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-097 | CSV yüklə — qalan geniş plan | BROWSER_E2E | NOT_RUN | NONE |  |
| GAP-FE-098 | Bank category/question tab, silinmişlər, refresh — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-099 | Category create/edit: title/icon/color/description/topics/difficulty/sort — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-100 | Category delete confirm/cancel/restore — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-101 | Question search/category/difficulty/open-exam/deleted + paging — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-102 | Question create/edit/options/key/explanations/exam-only — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-103 | Question delete confirm/cancel/restore — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-104 | Saxta UI admin rolu ilə hər admin əməliyyat — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-105 | Modal close, Escape, backdrop, Tab/Shift+Tab, focus return, nested dialogs — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-106 | ConfirmDialog busy/confirm/cancel/header X — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-107 | Tabs ArrowLeft/Right/Home/End; SearchField clear — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-108 | Button loading/disabled, IconButton label, FormField label/hint/error — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-109 | 320–1440px, 200% zoom, dark/light, reduced motion, keyboard-only — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-110 | Offline/slow/401/403/404/409/429/500/HTML response — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-111 | Back/Forward/reload/unknown path/hash/deep-link — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-112 | Storage və clipboard məhdud brauzer rejimi — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-FE-113 | Təlim upload uğurlu, sonrakı API validation fail, retry — qalan geniş plan | BROWSER_E2E | NOT_RUN | PARTIAL |  |
| GAP-INV-API-001 | `GET /api/Admin/stats` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-002 | `GET /api/Admin/courses` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-003 | `POST /api/Admin/courses` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-004 | `PATCH /api/Admin/courses/{id:int}/approve` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-005 | `PATCH /api/Admin/courses/{id:int}/reject` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-006 | `PUT /api/Admin/courses/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-007 | `PATCH /api/Admin/courses/{id:int}/revision/approve` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-008 | `PATCH /api/Admin/courses/{id:int}/revision/reject` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-009 | `DELETE /api/Admin/courses/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-010 | `GET /api/Admin/users` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-011 | `POST /api/Admin/users/{userId}/vip-term` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-012 | `GET /api/Admin/users/{userId}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-013 | `PUT /api/Admin/users/{userId}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-014 | `DELETE /api/Admin/users/{userId}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-015 | `PATCH /api/Admin/users/{userId}/role` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-016 | `PATCH /api/Admin/users/{userId}/block` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-017 | `GET /api/Admin/exam-sessions` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-018 | `GET /api/Admin/exam-sessions/{id}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-019 | `GET /api/Admin/audit` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-020 | `POST /api/auth/register` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-021 | `POST /api/auth/confirm-email` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-022 | `POST /api/auth/resend-confirmation` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-023 | `POST /api/auth/forgot-password` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-024 | `POST /api/auth/reset-password` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-025 | `GET /api/auth/google` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-026 | `GET /api/auth/google-callback` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-027 | `POST /api/auth/google/exchange` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-028 | `POST /api/auth/login` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-029 | `POST /api/auth/logout` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-030 | `POST /api/auth/logout-all` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-031 | `POST /api/auth/refresh` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-032 | `GET /api/auth/me` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-033 | `POST /api/Course` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-034 | `GET /api/Course` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-035 | `GET /api/Course/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-036 | `GET /api/Course/vip-status` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-037 | `GET /api/Course/mine` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-038 | `PUT /api/Course/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-039 | `DELETE /api/Course/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-040 | `POST /api/Course/{id:int}/reactivate` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-041 | `GET /api/exam-sessions/categories` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-042 | `GET /api/exam-sessions/mine` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-043 | `POST /api/exam-sessions` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-044 | `POST /api/exam-sessions/join` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-045 | `GET /api/exam-sessions/attempts/{id}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-046 | `PUT /api/exam-sessions/attempts/{id}/answer` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-047 | `POST /api/exam-sessions/attempts/{id}/submit` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-048 | `GET /api/exam-sessions/{code}/dashboard` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-049 | `POST /api/exam-sessions/{code}/close` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-050 | `GET /api/Quiz/categories` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-051 | `GET /api/Quiz/questions` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-052 | `GET /api/Quiz/leaderboard` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-053 | `POST /api/Quiz/submit` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-054 | `POST /api/Quiz/categories` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-055 | `GET /api/Quiz/admin/categories` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-056 | `POST /api/Quiz/categories/{id:int}/restore` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-057 | `PUT /api/Quiz/categories/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-058 | `GET /api/Quiz/admin/questions` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-059 | `PUT /api/Quiz/questions/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-060 | `POST /api/Quiz/questions/{id:int}/restore` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-061 | `DELETE /api/Quiz/categories/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-062 | `POST /api/Quiz/questions` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-063 | `DELETE /api/Quiz/questions/{id:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-064 | `GET /uploads/syllabus/{fileName}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-065 | `POST /api/Upload/photo` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-066 | `POST /api/Upload/syllabus` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-067 | `PATCH /api/User/role` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-068 | `GET /api/User/profile` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-069 | `PUT /api/User/profile` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-070 | `POST /api/User/profile/change-email` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-071 | `POST /api/User/profile/request-password-change` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | NONE |  |
| GAP-INV-API-072 | `POST /api/User/confirm-email-change` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-073 | `GET /api/User/me/overview` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-074 | `GET /api/User/students/{studentId}/overview` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-075 | `GET /api/User/teacher/classes` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-076 | `POST /api/User/teacher/classes` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-077 | `POST /api/User/teacher/classes/{classId:int}/students` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-078 | `DELETE /api/User/teacher/classes/{classId:int}` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| GAP-INV-API-079 | `GET /health` — bütün rol/state/validation kombinasiyaları | API_RUNTIME | NOT_RUN | PARTIAL |  |
| EXT-REAL-01 | SMTP registration/confirmation/reset/change tam roundtrip | INTEGRATION | BLOCKED | NONE |  |
| EXT-REAL-02 | Google OAuth real provider və linking | INTEGRATION | BLOCKED | NONE |  |
| EXT-REAL-03 | Turnstile real secret/hostname | INTEGRATION | BLOCKED | NONE |  |
| HOST-01 | Hosting DNS/TLS/proxy/CDN/cache/production cookie | INTEGRATION | BLOCKED | NONE |  |
| HOST-02 | Production storage ACL/topology/backup restore | INTEGRATION | BLOCKED | NONE |  |
| LIFE-01 | CourseExpirySweeper və orphan upload lifecycle | INTEGRATION | NOT_RUN | PARTIAL |  |
| DB-002 | Bütün kolleksiyalarda normalized duplicate/orphan/audit invariantları | INTEGRATION | NOT_RUN | PARTIAL |  |
| LIMIT-01 | Production rate-limit 429 və UI retry | INTEGRATION | NOT_RUN | PARTIAL |  |
| SCOPE-01 | Teacher imtahan təyin etməsi | BROWSER_E2E | N/A | SCENARIO |  |
| SCOPE-02 | Real ödəniş | INTEGRATION | N/A | SCENARIO |  |
