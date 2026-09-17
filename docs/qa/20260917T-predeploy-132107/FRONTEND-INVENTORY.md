# Frontend funksionallıq və sınaq inventarı

Tarix: 2026-09-17. Əhatə: `kiberaz-ui/src` ekranları, bütün servis funksiyaları, istifadəçi əməliyyatları, naviqasiya və ortaq UI idarələri. Bu sənəd mənbə kodunun yalnız oxunması ilə hazırlanıb. Brauzer, build, DB yazısı, e-poçt/OAuth və xarici yazı icra edilməyib. Production faylları dəyişdirilməyib. Bütün FE sınaqları **UNTESTED**-dir; statik tapıntı runtime FAIL kimi təqdim edilmir. Endpoint-lər konfiqurasiya olunmuş API bazasına nisbidir (adi baza `/api`).

`AGENTS.md` və `SENIOR-RULES.md` oxunub. Parent audit tərəfindən bildirilən `.codex` rol/skill fayllarının çatışmazlığı əsas auditdə ayrıca izlənir. `git status --short` ilkin baxışda yalnız mövcud `docs/qa/` untracked qovluğunu göstərib.

## Rollar və ekran modeli

| Rol | Kodda təqdim olunan əsas imkanlar |
|---|---|
| Anonim | Təlim kataloqu, bilik kateqoriyaları, sual mətnləri, liderlik; giriş, qeydiyyat, şifrə bərpası; cavab yoxlanışı giriş tələb edir. |
| User | Öz profil/statistika, quiz cavabı, kodla imtahana qoşulma, User → Teacher keçidi. |
| Teacher | User imkanları və öz siniflərinin yaradılması, ID ilə tələbə əlavə edilməsi, roster/göstərici baxışı, sinif silmə. Tək Teacher rolu imtahan yaratmır. |
| VIP | Kodla iştirak və VIP sessiya yaratma/panel/bağlama, aktiv dövr və kredit ilə təlim paylaşma; Teacher əlavə rolu varsa siniflər. |
| Keçmiş VIP / öz təlimi olan hesab | `getMyCourses()` nəticəsi varsa “Təlimlərim” görünür; yaradılma/yenidən aktivləşmə hüququ serverdən gəlir. |
| Moderator | UI rol nişanı var; ayrıca moderator ekranı yoxdur. Xüsusi səlahiyyət gözləntisi SPEC_GAP-dır. |
| Admin | Kabinetdə İcmal, İstifadəçilər, Təlimlər, İmtahan sessiyaları, Kateqoriyalar + suallar; public imtahan fəaliyyətində qadağa mesajı. |

Adi ekranlar React Router deyil, `App.tsx` boolean və kateqoriya state-i ilə seçilir. Hash bölmələri: `#about`, `#home`, `#knowledge`, `#exam-session`, `#leaderboard`. Ayrı path-lər: `/reset-password`, `/confirm-email`, `/confirm-email-change`, `/google-login-callback`. Kabinet tabları ayrıca URL deyil; reload/back davranışı xüsusi sınaq tələb edir. UI rol yoxlaması server icazəsi kimi qəbul edilmir.

## İctimai ekranlar və naviqasiya

| ID | Ekran / əməliyyat | Endpoint / təsir | Rol | Gözlənilən yoxlama | Status |
|---|---|---|---|---|---|
| FE-001 | Navbar/Footer loqosu və 5 bölmə linki | Lokal `handleNavigate`, hash, scroll | Hamı | Kabinet/quiz bağlanır, düzgün bölmə görünür; hash müqaviləsi qorunur | UNTESTED |
| FE-002 | Mobil menu aç/bağla, backdrop, resize | Lokal body scroll lock | Hamı | 320/375/768/1024 px; gizli elementlər fokus almır, açıq menu ilə Tab/Escape işləyir | UNTESTED |
| FE-003 | İstifadəçi menyusu, kənara klik/Escape, Kabinetim | Lokal state; profil açılışı | Daxil olmuş | Ad/rol düzgün, menu bağlanır, kabinet açılır | UNTESTED |
| FE-004 | Skip link, yuxarıya qayıt | `#main-content`, scroll | Hamı | Klaviatura, 600px həddi, reduced-motion davranışı | UNTESTED |
| FE-005 | Açıq/tünd mövzu | `useTheme`, storage | Hamı | Reload və auth səhifələrində davamlılıq, kontrast, OS seçimi | UNTESTED |
| FE-006 | Çərəz banneri qəbul/rədd | `kiberaz-cookie-consent` localStorage | Hamı | 2s gecikmə; qəbul saxlanır, rədd sonrası reload siyasəti aydın | UNTESTED |
| FE-007 | Hüquqi linklər: footer, qeydiyyat, cookie | Hazırda `href="#"` | Hamı | Həqiqi sənəd hədəfi tələb olunur; SPEC_GAP-01 | UNTESTED |
| FE-008 | About CTA “Biliklər”, “Platformanı kəşf et” | Lokal naviqasiya/modal | Hamı | Doğru bölmə və modal; desktop/mobil | UNTESTED |
| FE-009 | PlatformShowcase 4 modul, əvvəl/sonra, indikator, ox düymələri, CTA | Lokal modul seçimi/hash | Hamı | Dairəvi keçid, şəkil yüklənməsi, CTA modalı bağlayır | UNTESTED |
| FE-010 | Təlim kataloqu, loading/empty/error/retry | GET `/course` | Hamı | Yalnız təsdiqli aktiv təlim; retry real yenidən sorğulayır | UNTESTED |
| FE-011 | “Proqram və əlaqə”, bağla/backdrop | Kataloq obyektindən modal, əlavə HTTP yoxdur | Hamı | Təlimçi, mövzular, səviyyə, müddət, əlaqə eynidir | UNTESTED |
| FE-012 | Təlimçi LinkedIn/GitHub | HTTP(S) xarici link | Hamı | Təhlükəli sxem kliklənmir, yeni tab, referrer yoxdur | UNTESTED |
| FE-013 | Kart/modal sillabus, müəllim fotosu | API origin + `/uploads/...` | Hamı | Ayrı frontend/API origin-də PDF/foto açılır; səhv yol linkə çevrilmir | UNTESTED |
| FE-014 | “Təlimini paylaş”, boş kataloq “Təlim əlavə et” | GET `/course/vip-status` (giriş varsa) | Hamı, yazı VIP | Anonim/adi/vaxtı bitmiş/kreditsiz/aktiv VIP üçün gate və düymə | UNTESTED |
| FE-015 | Bilik kateqoriyası seçimi və detal | GET `/quiz/categories` | Hamı | Başlıq `_` olanlar gizli; 0 sualda başlat disabled; metadata uyğun | UNTESTED |
| FE-016 | Liderlik dövrü həftəlik/aylıq/ümumi | GET `/quiz/leaderboard?period=…&limit=10` | Hamı | Statistikalar, sıralama, boş/yüklənən vəziyyət | UNTESTED |
| FE-017 | Liderlik kateqoriya filtri, sürətli dəyişmə | GET `/quiz/categories`; GET leaderboard `categoryId` | Hamı | Son seçimin nəticəsi qalır, PII/protected hesab yoxdur | UNTESTED |
| FE-018 | Public API offline/500/429 | GET kateqoriya/sual/liderlik | Hamı | Xəta “hələ data yoxdur” ilə qarışmır; STAT-04 | UNTESTED |

## Giriş, qeydiyyat və callback-lər

| ID | Ekran / əməliyyat | Endpoint / təsir | Rol | Gözlənilən yoxlama | Status |
|---|---|---|---|---|---|
| FE-019 | Navbar və quiz/imtahan CTA ilə login/register açma | `requestAuth` hadisəsi → Navbar modal | Hamı | Ekran konteksti qorunur; modal bağlanır/fokus qayıdır | UNTESTED |
| FE-020 | Login, şifrə göstər/gizlət | POST `/auth/login` | Anonim | Uğur session UI, səhv məlumat ümumi mesaj, double-click blok | UNTESTED |
| FE-021 | CAPTCHA tələb olunan login və retry | POST `/auth/login`, Turnstile | Anonim | Token tələb, expiry/error, yanlış paroldan sonra təkrar CAPTCHA; STAT-08 | UNTESTED |
| FE-022 | Təsdiqsiz düzgün-parol login → resend | POST `/auth/resend-confirmation` | Anonim | Resend düyməsi əlçatandır; STAT-03 | UNTESTED |
| FE-023 | Login → qeydiyyat / şifrəni unutdum | Lokal modal switch, e-poçt ötürülür | Anonim | Sahələr/mesaj/fokus düzgün | UNTESTED |
| FE-024 | Register ad, soyad, email, nickname, User/Teacher, cins, parol/təkrar | POST `/auth/register` | Anonim | Məcburi sahələr, 3–16 nickname, rol/cins, uyğun parol, CAPTCHA, API validator mesajı | UNTESTED |
| FE-025 | Register password toggle/strength, success close, login keçid | Lokal state | Anonim | Güc etiketi server siyasəti ilə izah edilir; uğurdan sonra yanlış auto-login yoxdur | UNTESTED |
| FE-026 | Forgot password, e-poçt + CAPTCHA, uğur/error | POST `/auth/forgot-password` | Anonim | Təkrar submit uğurdan sonra bağlı; ümumi cavab | UNTESTED |
| FE-027 | `/reset-password#userId=…&token=…` | POST `/auth/reset-password` | Link sahibi | Fragment dərhal silinir, valid/expired/missing token, password mismatch, uğur `/` yönləndirməsi | UNTESTED |
| FE-028 | `/confirm-email#…` | POST `/auth/confirm-email` | Link sahibi | Bir dəfə işləmə, expired/replayed/missing token, ana səhifə | UNTESTED |
| FE-029 | `/confirm-email-change#…` | POST `/user/confirm-email-change` | Link sahibi | userId/newEmail/token, fragment təmizliyi, nəticə/sessiya yenilənməsi | UNTESTED |
| FE-030 | Google giriş/qeydiyyat düymələri | Brauzer GET `/auth/google` | Anonim | Xarici OAuth ayrıca konfiqurasiya/qaçış tələb edir | UNTESTED |
| FE-031 | `/google-login-callback#code=…` | POST `/auth/google/exchange` | Callback | Bir dəfəlik kod; fragment silinir; uğur kabinetə, missing/invalid kod error | UNTESTED |
| FE-032 | Reload/yeni tab sessiya bərpası | POST `/auth/refresh`, cookie, session hint | Daxil olmuş | İlk açılış, StrictMode paralelliyi, birdəfəlik rotation | UNTESTED |
| FE-033 | Paralel API 401, refresh uğur/fail | `apiClient` queue, POST refresh | Daxil olmuş | Tək refresh, ilkin sorğular retry, uğursuzluqda UI da çıxış edir; STAT-05 | UNTESTED |
| FE-034 | Navbar/kabinet çıxış, sonra Back/reload | POST `/auth/logout` | Daxil olmuş | Lokal təmizlik, server sessiyası etibarsız, UI anonim | UNTESTED |
| FE-035 | Token saxlanma müqaviləsi | `authService.ts:161,215` | Daxil olmuş | Token local/sessionStorage-də olmamalıdır; STAT-01 | UNTESTED |
| FE-036 | Birbaşa 4 auth path refresh | Host SPA fallback | Hamı | 404 olmur; URL-də token loglanmır | UNTESTED |

## Quiz

| ID | Ekran / əməliyyat | Endpoint / təsir | Rol | Gözlənilən yoxlama | Status |
|---|---|---|---|---|---|
| FE-037 | Kateqoriyadan quiz aç, sidebar/breadcrumb/promo/qayıt | GET `/quiz/categories`, lokal naviqasiya | Hamı | Doğru kateqoriya, qayıt `#knowledge`, aktiv quiz category switch təsdiqi | UNTESTED |
| FE-038 | Çətinlik, 10/20/30/40/50 sual seçimi | Lokal setup; GET `/quiz/questions?categoryId&count&difficulty` | Hamı | Az sual hovuzu, 0 nəticə, requested/actual say düzgün | UNTESTED |
| FE-039 | Network Qarışıq/Security/Attacks | 2 və 8 kateqoriya ID-ləri, paralel GET | Hamı | Yarı bölgü/fallback; yeni seed-də sabit ID fərziyyəsi | UNTESTED |
| FE-040 | Variant seç, bütün izahlar və düzgün cavab | POST `/quiz/submit` | Daxil olmuş | Nəticə yalnız serverdən, 401 auth CTA, 429 retry məlumatı, failed seçim rollback | UNTESTED |
| FE-041 | Anonim variant seçimi → giriş → eyni suala cavab | Token yoxdursa lokal auth gate | Anonim → User | Qapıdan sonra quiz itmir, sual düzgündür | UNTESTED |
| FE-042 | Əvvəl/Növbəti/naviqator | Lokal state | Quiz iştirakçısı | Cavabsız irəli keçid bağlı, əvvəlki cavab yalnız oxunur | UNTESTED |
| FE-043 | A–D/1–4/ox klaviatura, modal açıq halda | Lokal keydown | Quiz iştirakçısı | Input/modal fokusunda qısayol çalışmır; şəbəkə zamanı geri; STAT-09 | UNTESTED |
| FE-044 | Son nəticə, səviyyələr, restart, biliklərə qayıt | Lokal serverResults hesabı | Quiz iştirakçısı | Doğru say/faiz, yeni quiz state-i təmiz | UNTESTED |
| FE-045 | Başlanmış quizdə başqa category təsdiq/ləğv | ConfirmDialog, komponent key dəyişir | Quiz iştirakçısı | İtirilən progress xəbərdarlığı, ləğvdə cari quiz saxlanır | UNTESTED |

## İmtahan sessiyaları

| ID | Ekran / əməliyyat | Endpoint / təsir | Rol | Gözlənilən yoxlama | Status |
|---|---|---|---|---|---|
| FE-046 | İmtahan overview, anonim login və admin gate | GET `/exam-sessions/mine` | User/Teacher/VIP | Admin qoşula/yarada bilmir; səhv yüklənmə boş tarixçə kimi gizlənmir | UNTESTED |
| FE-047 | Sessiya yarat modalı/kateqoriyalar | GET `/exam-sessions/categories` | VIP | Məxfi bank kateqoriyaları; adi rol düyməsi bağlı | UNTESTED |
| FE-048 | Başlıq, müddət 15/30/45/60/90/120, say +/− | Lokal, POST `/exam-sessions` | VIP | 1–50 toplam, kateqoriya hovuzu həddi, trim, 120 başlıq, quota | UNTESTED |
| FE-049 | Günlük 7 limit, UTC reset, aktiv VIP dövrü | Overview quota + create | VIP | 7-ci/8-ci sərhəd, server 429/403 düzgün göstərilir | UNTESTED |
| FE-050 | Yaranan/son sessiya kodunu kopyala, panelə keç | Clipboard, lokal UI | VIP | Kod düzgün, clipboard permission failure üçün görünən kod qalır | UNTESTED |
| FE-051 | Kodla qoşul, lowercase/paste/yanlış/bağlı kod | POST `/exam-sessions/join` | User/Teacher/VIP | `KBR-` + 16 hex saxlanır, boş/yanlış cavab aydın | UNTESTED |
| FE-052 | Cəhdi tarixçədən davam et/nəticə aç | GET `/exam-sessions/attempts/{id}` | Öz cəhdi | Reload sonrası answers/revision/vaxt; VIP iştirak tarixçəsi STAT-07 | UNTESTED |
| FE-053 | İmtahan variantı və revision conflict | PUT `/exam-sessions/attempts/{id}/answer`, error sonrası GET | İştirakçı | Bir seçim saxlanır, conflict refresh, offline error, spam blok | UNTESTED |
| FE-054 | Əvvəl/növbəti/naviqator | Lokal state | İştirakçı | Sualları istənilən sıra, selected və count saxlanır | UNTESTED |
| FE-055 | Geri sayım və vaxt bitməsi | serverNow/expiresAt; POST submit | İştirakçı | Əlləmədən 10s monoton azalır, background tab, auto-submit; STAT-02 | UNTESTED |
| FE-056 | İmtahanı bitir, təsdiq/ləğv, cavabsız xəbərdarlıq | POST `/exam-sessions/attempts/{id}/submit` | İştirakçı | Double submit idempotent, pending answer itmir, nəticə/qayıt | UNTESTED |
| FE-057 | Canlı panel, 10s polling, manual yenilə/geri | GET `/exam-sessions/{code}/dashboard` | Sahib VIP | İştirakçılar/progress/status/score, yad sahib 403 | UNTESTED |
| FE-058 | Sessiyanı bağla, confirm/cancel | POST `/exam-sessions/{code}/close` | Sahib VIP | Bağlı state və join qadağası, offline xəta; STAT-10 | UNTESTED |

## Kabinet, profil, müəllim və VIP təlimləri

| ID | Ekran / əməliyyat | Endpoint / təsir | Rol | Gözlənilən yoxlama | Status |
|---|---|---|---|---|---|
| FE-059 | Ümumi baxış, progress, son fəaliyyət, imtahanlarım | GET `/user/profile`; GET `/user/me/overview` | User/Teacher/VIP | Real statistika; empty/error/loading; quiz statistikası ilə real sessiya fərqi aydındır | UNTESTED |
| FE-060 | Sidebar tabları, “Hamısını gör”, “Profilə keç” | Lokal tab seçimi | Daxil olmuş | Doğru ekran, mobil panel aç/bağla/selection, focus | UNTESTED |
| FE-061 | Kabinet ana səhifə / “Biliklərə keç” / promo | Parent `setShowDashboard(false)` | Daxil olmuş | Mətnin və real scroll hədəfinin uyğunluğu; əvvəl quiz açıq idisə davranış | UNTESTED |
| FE-062 | Profil redaktə, save/cancel | PUT `/user/profile` | Öz hesabı | Ad/soyad/nickname/cins, validation; navbar ləqəbi STAT-06 | UNTESTED |
| FE-063 | Profil ID kopyala | Clipboard | Öz hesabı | Uğur və clipboard rədd xətası | UNTESTED |
| FE-064 | E-poçt dəyişmə linki | POST `/user/profile/change-email` | Öz hesabı | Email validator, disabled, ümumi mesaj, callback FE-029 | UNTESTED |
| FE-065 | Şifrə dəyişmə linki | POST `/user/profile/request-password-change` | Öz hesabı | Uğur/error/rate limit, reset FE-027 | UNTESTED |
| FE-066 | User ↔ Teacher təsdiq/ləğv | PATCH `/user/role` | User/Teacher | Yalnız allowed role, 2.2s sonra logout, login yeni rol | UNTESTED |
| FE-067 | Teacher sinif siyahısı/seçimi | GET `/user/teacher/classes` | Teacher | Öz roster, empty/error, başqa sinfə keçiddə detail təmiz | UNTESTED |
| FE-068 | Sinif yarat | POST `/user/teacher/classes` | Teacher | Boş/ad sərhədi, yeni sinif seçilir, duplicate/server errors | UNTESTED |
| FE-069 | ID ilə tələbə əlavə et | POST `/user/teacher/classes/{id}/students` | Teacher | Etibarlı/yanlış/protected/duplicate tələbə, say yenilənir | UNTESTED |
| FE-070 | Roster “Bax”, detail bağla | GET `/user/students/{id}/overview` | Teacher sahibi | Başqa müəllimin tələbəsi rədd, PII minimum, tələbə göstəricisi doğru | UNTESTED |
| FE-071 | Profil rol-keçid hissəsində sinif sil | DELETE `/user/teacher/classes/{id}` | Teacher sahibi | Ad/tələbə sayı ilə confirm, cancel, silmədən User keçidi bağlı | UNTESTED |
| FE-072 | “Təlimlərim”, refresh/retry, VIP dövr/status kartı | GET `/course/mine`, GET `/course/vip-status` | VIP / keçmiş sahib | Aktiv/gözləyən/passiv say, tarix/kredit; status serverlə eyni | UNTESTED |
| FE-073 | Yeni təlim forması | POST `/course` | Aktiv VIP+kredit | Müəllim, sosial, əlaqə, başlıq, kicker, duration, level, language, description, mövzular | UNTESTED |
| FE-074 | Foto seç və yüklə | POST `/upload/photo`, multipart | İcazəli hesab | PNG/JPG/WEBP, 2MB; boş/yanlış format/magic/oversize server rəddi | UNTESTED |
| FE-075 | PDF seç və yüklə | POST `/upload/syllabus`, multipart | İcazəli hesab | 10MB; PDF sanitar rəddi, empty/oversize; saxlanan nisbi yol | UNTESTED |
| FE-076 | Mövzu əlavə et, mövzu boşalt, submit/cancel | Lokal forma + upload sonra course | Sahib/Admin edit | Blank trim, mövzu limitləri, duplicate klik, cancel zamanı davam edən upload | UNTESTED |
| FE-077 | Mövcud təlim redaktəsi | PUT `/course/{id}` | Sahib | Pending revision varsa o açılır, canlı Approved dəyişmir, tarix uzanmır | UNTESTED |
| FE-078 | Təlim sil, confirm/cancel | DELETE `/course/{id}` | Sahib | Siyahıdan yox olur, kredit qayıtmır, yad sahib rədd | UNTESTED |
| FE-079 | Passiv təlim yenidən aktivləşdir | POST `/course/{id}/reactivate` | Sahib+aktiv VIP+kredit | Confirm, 1 kredit, pending moderation, disabled gate | UNTESTED |

## Admin

| ID | Ekran / əməliyyat | Endpoint / təsir | Rol | Gözlənilən yoxlama | Status |
|---|---|---|---|---|---|
| FE-080 | Admin icmal / refresh / alert CTA-ları | GET `/admin/stats`, lokal tab keçidi | Admin | Saylar/protected exclusion; error sonsuz skeleton olmur | UNTESTED |
| FE-081 | Son əməliyyatlar / refresh/retry | GET `/admin/audit?take=15` | Admin | Həqiqi action adı/tarix/actor; read-only siyahı | UNTESTED |
| FE-082 | Təlim siyahısı / status tab / search / refresh | GET `/admin/courses`, lokal filter | Admin | Bütün statuslar, active/expired/revision sayları | UNTESTED |
| FE-083 | Admin sürətli təlim yarat, cancel | POST `/admin/courses` | Admin | Title/instructor/category/link, validation, yaradılan public görünüş | UNTESTED |
| FE-084 | Təlim təsdiq/rədd | PATCH `/admin/courses/{id}/approve` və `/reject` | Admin | Publication müddəti, status, toast, busy | UNTESTED |
| FE-085 | Təlim redaktə modalı/shared CourseForm | PUT `/admin/courses/{id}` | Admin | Bütün sahələr/fayllar, dərhal nəşr, saxlanan deadline | UNTESTED |
| FE-086 | Pending revision aç/gizlət/təsdiq/rədd | PATCH `/admin/courses/{id}/revision/approve` və `/reject` | Admin | Canlı ilə revision müqayisə, düzgün versiya və expiry | UNTESTED |
| FE-087 | Admin təlim sil confirm/cancel | DELETE `/admin/courses/{id}` | Admin | Public/sahib siyahısında da gizlənir | UNTESTED |
| FE-088 | İstifadəçi search/debounce/refresh | GET `/admin/users?search=…&take=100` | Admin | Server axtarışı, owner gizli, limit/empty/error | UNTESTED |
| FE-089 | İstifadəçi role select | PATCH `/admin/users/{id}/role` | Admin | Allowed rollar, Admin yoxdur, target session revoke | UNTESTED |
| FE-090 | VIP dövrü aç | POST `/admin/users/{id}/vip-term` | Admin | Yeni 30 gün/1 kredit, mesaj/session impact, təkrar klik | UNTESTED |
| FE-091 | Blokla confirm/cancel, bloku aç | PATCH `/admin/users/{id}/block` | Admin | Düzgün status, target sessiya bağlanır, owner rədd | UNTESTED |
| FE-092 | User detail aç/bağla/retry | GET `/admin/users/{id}` | Admin | Profil/VIP/fəaliyyət/statistika, qorunan hesab yoxdur | UNTESTED |
| FE-093 | User detail ad/soyad/nickname/cins/email-confirm save | PUT `/admin/users/{id}` | Admin | Validation, session invalidation, siyahı yenilənir | UNTESTED |
| FE-094 | Danger zone aç, nickname yaz, sil | DELETE `/admin/users/{id}` | Admin | Təsdiq mətni, bağlı resursların nəticəsi, owner qadağası | UNTESTED |
| FE-095 | Admin imtahan search/status/refresh | GET `/admin/exam-sessions?search=…&take=200` | Admin | Həqiqi sessiyalar, say/status/filter, owner exclusion | UNTESTED |
| FE-096 | İmtahan nəticə modalı/retry/close | GET `/admin/exam-sessions/{id}` | Admin | İştirakçı nəticəsi, no answer key, düzgün status | UNTESTED |
| FE-097 | CSV yüklə | Brauzer Blob/download | Admin | UTF-8 BOM/Az hərfləri, separator, formula prefix müdafiəsi, row/score uyğunluğu | UNTESTED |
| FE-098 | Bank category/question tab, silinmişlər, refresh | GET `/quiz/admin/categories[?deleted=true]`; GET `/quiz/admin/questions?...` | Admin | Aktif/silinmiş ayrılığı, real toplamlar, error/retry | UNTESTED |
| FE-099 | Category create/edit: title/icon/color/description/topics/difficulty/sort | POST `/quiz/categories`; PUT `/quiz/categories/{id}` | Admin | Məcburi sahələr və ikon/rəng seçimi, public görünüş | UNTESTED |
| FE-100 | Category delete confirm/cancel/restore | DELETE `/quiz/categories/{id}`; POST `/quiz/categories/{id}/restore` | Admin | Kaskad silmə/bərpa nəticəsi, saylar | UNTESTED |
| FE-101 | Question search/category/difficulty/open-exam/deleted + paging | GET `/quiz/admin/questions?categoryId&search&difficulty&examOnly&deleted&skip&take` | Admin | Filtr dəyişəndə page reset, 25-lik səhifə, son page controls | UNTESTED |
| FE-102 | Question create/edit/options/key/explanations/exam-only | POST `/quiz/questions`; PUT `/quiz/questions/{id}` | Admin | A-D, doğru açar, hər izah, validator, secret bank public sızmır | UNTESTED |
| FE-103 | Question delete confirm/cancel/restore | DELETE `/quiz/questions/{id}`; POST `/quiz/questions/{id}/restore` | Admin | Deleted category altında restore rəddi, saylar/public effect | UNTESTED |
| FE-104 | Saxta UI admin rolu ilə hər admin əməliyyat | Eyni endpoint-lər | User/Teacher/VIP | Hər əməliyyat serverdə 403; UI rolu səlahiyyət vermir | UNTESTED |

## Ortaq idarələr və edge-case sınaqları

| ID | Əməliyyat / komponent | Əhatə | Status |
|---|---|---|---|
| FE-105 | Modal close, Escape, backdrop, Tab/Shift+Tab, focus return, nested dialogs | `ui/Modal.tsx`, bütün auth/course/results/bank modalları | UNTESTED |
| FE-106 | ConfirmDialog busy/confirm/cancel/header X | Delete, close, role və quiz keçidləri; busy halda təsadüfi ikinci mutation yoxdur | UNTESTED |
| FE-107 | Tabs ArrowLeft/Right/Home/End; SearchField clear | Leaderboard/admin; fokus və seçilmiş tab uyğun | UNTESTED |
| FE-108 | Button loading/disabled, IconButton label, FormField label/hint/error | Bütün formalar; Enter double submit, yalnız rənglə status verilmir | UNTESTED |
| FE-109 | 320–1440px, 200% zoom, dark/light, reduced motion, keyboard-only | Navbar, 3 sütun, uzun mətn, cədvəllər, modal, sidebar | UNTESTED |
| FE-110 | Offline/slow/401/403/404/409/429/500/HTML response | Read və hər mutation; lost response/retry/duplicate davranışı | UNTESTED |
| FE-111 | Back/Forward/reload/unknown path/hash/deep-link | Boolean state ekranlarının URL gözləntisi; SPEC_GAP-02 | UNTESTED |
| FE-112 | Storage və clipboard məhdud brauzer rejimi | Theme/cookie/auth nickname/session hint/copy; crash yox | UNTESTED |
| FE-113 | Təlim upload uğurlu, sonrakı API validation fail, retry | Eyni seçilmiş faylın təkrar upload-u və quota/orphan təsiri; STAT-11 | UNTESTED |

## Statik sübutlar və runtime təsdiqi tələb edən namizədlər

Bu cədvəldə “statik sübut” kod yolunun mövcudluğunu bildirir. Təsir və ciddilik ilkin qiymətləndirmədir; heç biri brauzerdə icra edilmiş FAIL deyil.

| Namizəd | İlkin prioritet | Mənbə və səbəb | Konkret təkrar ssenarisi / gözlənti |
|---|---|---|---|
| STAT-01: access token davamlı tab storage-də | Yüksək, müqavilə pozuntusu | `services/authService.ts:161–162,215–216` tokeni sessionStorage-də oxuyur/yazır. `AGENTS.md` və `SENIOR-RULES.md` yalnız yaddaş tələb edir. Bu əlavə XSS exploit sübutu deyil. | FE-035; storage-də access_token açarı olmamalıdır. Tokenin özü hesabat/loga çıxarılmamalıdır. |
| STAT-02: timer hər renderdə öz istinad vaxtını yenidən qurur | Yüksək, imtahan axını | `components/ExamSession.tsx:198–209` effekt dependency array-sizdir; `serverOffset` hər renderdə eyni köhnə serverNow-dan hesablanır. `setRemaining` render edəndə növbəti dərhal tick qalan vaxtı əvvəlki baseline-a qaytarır. | FE-055; cavab vermədən 10 saniyə baxın. Vaxt 10s azalmalıdır; təkcə cavab sorğusu gələndə dəyişməməlidir. Server hələ expiry-ni tətbiq edə bilər, amma UI/auto-submit etibarlı deyil. |
| STAT-03: təsdiq məktubunu yenidən göndər CTA-sı server mesajını tanımır | Orta, auth recovery | `components/auth/LoginModal.tsx:38,117` yalnız `aktiv` alt-sətrini yoxlayır. `Kiberaz.Infrastructure/Services/AuthService.cs:185–190` düzgün parollu təsdiqsiz hesaba `Hesabınız hələ təsdiqlənməyib...` qaytarır; `aktiv` yoxdur. | FE-022; server düzgün təsdiqsiz mesaj qaytarsa da resend düyməsi görünməyə bilər. Structured code və ya həmişə əlçatan resend axını ilə düzəliş nəzərdən keçirilsin. |
| STAT-04: API xətası boş data kimi görünür | Orta, yanlış UI məlumatı | `services/quizService.ts:65–88,156–187,278–298` qeyri-OK/catch-də `[]`; KnowledgeCategories/QuizView/Leaderboard boş və xəta fərqini itirir. | FE-018: API 500/offline/429 → “bu filtr üzrə hələ nəticə yoxdur”, “hələ sual yoxdur” əvəzinə xəta/retry olmalıdır. |
| STAT-05: avtomatik logout əsas auth state-ni xəbərdar etmir | Orta, sessiya UI-si | `services/apiClient.ts:57–58` refresh alınmayanda `logout()` çağırır; `App.tsx:322,348–352` isLoggedIn ayrı state-dir. Navbar öz user state-ni yalnız prop dəyişəndə yeniləyir (`Navbar.tsx:60–65`). | FE-033: server sessiyasını etibarsız edən dəyişiklik → profile 401/refresh fail → navbar/kabinet anonim vəziyyətə keçməlidir. Bu server auth bypass deyil. |
| STAT-06: profil ləqəbi navbar-da köhnə qalır | Aşağı, state sinxronluğu | `UserDashboard.tsx:220–240` uğurlu save yalnız profil/form state-ni yeniləyir; `setStoredUserNickname` və navbar user event yoxdur. `Navbar.tsx:47,60–65` ad local state-dədir. | FE-062: nickname save → dərhal navbar/reload yoxlaması. Göstərilən ad serverdəki ilə eyni olmalıdır. |
| STAT-07: VIP iştirakçının cəhd tarixçəsi gizlənir | Orta, bərpa əlçatanlığı | `ExamSession.tsx:589–598` VIP olduqda yalnız `overview.sessions`, digərlərinə attempts render edir. `ExamSessionService.cs:92–108` hər ikisini yığır. VIP kodla qoşula bilir. | FE-052: VIP başqa sessiyaya qoşulub reload etsin; yarımçıq öz cəhdini history-dən tapa bilməlidir. Kodu yenidən yazmaq workaround ola bilər. |
| STAT-08: işlənmiş CAPTCHA tokenindən sonra yeni cəhd | Orta, şərtli namizəd | `LoginModal.tsx:57` tokeni yalnız uğurda sıfırlayır; RegisterModal fail-də sıfırlamır. `TurnstileBox.tsx` onExpire/onError var, submit sonrası widget reset mexanizmi yoxdur. Backend CAPTCHA-nı qəbul edib login/register sonradan rədd etsə token artıq işlənmiş ola bilər. | FE-021/024: CAPTCHA keç → business validation/parol səhvi → düzəlt və dərhal retry. Real Turnstile davranışı ayrıca təsdiq edilməlidir; provider uğuru iddia edilmir. |
| STAT-09: quiz submit zamanı geri düyməsi açıqdır | Orta, şərtli yarış | `QuizView.tsx:635` Əvvəlki yalnız index=0-da disabled; `:226` ArrowLeft də isSubmitting yoxlamır. `:122–130` gecikmiş failure rollback `selected`-i global null edir. | FE-043: ikinci suala cavab sorğusunu gecikdir → əvvəlki cavablanmış suala qayıt → ikinci cavab fail. Əvvəlki sual seçimi/Next itirməməlidir. |
| STAT-10: sessiya bağlama transport xətası tutulmur | Orta/Aşağı | `ExamSession.tsx:359–363` close try/finally var, catch yoxdur; `examSessionService` fetch rejection-u ötürür. | FE-058: bağlama POST offline olsun. Loading dayansa da aydın error və təkrar cəhd imkanı olmalıdır; unhandled rejection olmamalıdır. |
| STAT-11: uğurlu upload sonrakı submit fail-də yenidən edilir | Aşağı/Orta, quota təsiri şərtli | `CourseForm.tsx:55–74` yüklənmiş yollar yalnız lokal dəyişənə yazılır; photoFile/syllabusFile və values uğurdan sonra yenilənmir. Son onSubmit fail olanda retry bütün upload-ları təkrarlayır. | FE-113: foto/PDF upload uğurlu, course validation fail → düzəlt və retry. Request sayını/izolyasiya olunmuş quota-nı yoxla; təmizləmə arxa planı ayrıca araşdırılsın. |

Əlavə aşağı riskli müşahidələr: `UserDashboard.tsx:333–336` overview promise-in catch-i yoxdur; nəqliyyat xətası null/0 göstərici və unhandled rejection verə bilər. Admin stat res.success=false olduqda null qalır və `AdminPanel DashboardTab` skeleton göstərir; görünən retry/xəta vəziyyəti məhduddur. Profil ID clipboard çağırışında catch yoxdur. Bunlar FE-063/080/110-da yoxlanmalıdır.

## SPEC_GAP və placeholder təsiri

- **SPEC_GAP-01 — hüquqi sənədlər:** `Footer.tsx:10–12`, `App.tsx:88`, `auth/RegisterModal.tsx:189` `#` linkləridir. Bunlar real Privacy/Terms/Cookie səhifəsini açmır. Qəbul zamanı hansı mətnin təsdiqləndiyi məhsul səviyyəsində tamamlanmalıdır; hüquqi rəy verilməyib.
- **SPEC_GAP-02 — URL tarixçəsi:** kabinet, quiz və tablar state ilə işləyir, URL-də tam identifikator yoxdur. Refresh/Back-də əvvəlki ekranın saxlanması tələb olunub-olunmadığı sənədləşdirilməyib. Mövcud davranış avtomatik FAIL deyil.
- **SPEC_GAP-03 — VIP ödənişi:** `HeroSlider.tsx` və `MyCoursesTab.tsx` “ödəniş sistemi tezliklə” göstərir. UI-da ödəniş endpoint-i/checkout yoxdur; hazır axın adminin `vip-term` açmasıdır. Özünəxidmət VIP alma/yeniləmə tamamlanmış funksiya sayılmamalıdır.
- **SPEC_GAP-04 — kabinet “İmtahanlarım” mənası:** `UserDashboard.tsx` overview examSessions proyeksiyasını göstərir və comment bunu kateqoriya üzrə quiz nəticəsi kimi izah edir; `ExamSession` isə real timed cəhd tarixçəsidir. İki görünüşün biznes izahı/backend proyeksiyası müqayisə olunmalıdır.
- **SPEC_GAP-05 — cookie rədd siyasəti:** “Qəbul” localStorage-də saxlanır, “Rədd” yalnız cari renderdə gizlədir. Növbəti açılışda bannerin yenidən göstərilməsi razılaşdırılmayıb.
- **SPEC_GAP-06 — Teacher roster idarəsi:** UI-da sinif yarat/əlavə et/sil var; tələbəni tək çıxart, sinif adını dəyiş, transfer və axtarış yoxdur. Bunlar mövcud olmayan imkanlardır; tələb təsdiqi olmadan defect sayılmır.
- **SPEC_GAP-07 — upload forma ergonomikası:** photo `accept="image/*"`, mətndə PNG/JPG/WEBP; client ölçü limiti yox, serverə həvalə edilir. Mövcud şəkil/PDF-ni ayrıca silmə və mövzu sətrini ayrıca remove yoxdur (mövzu boşaldılıb filter edilir). İstənilən davranış dəqiqləşdirilməlidir.

`data/mockData.ts` adında “mock” olsa da faktiki yalnız tiplər və beş naviqasiya linki var; kurs/kateqoriya/sual/liderlik üçün işləyən mock dataset görülmədi. `onLoginDemo` köhnə callback adıdır, `Navbar.handleLoggedIn` real uğurlu API cavabından sonra çağırır; adına görə demo bypass hesab edilməməlidir. `PlatformShowcase` mətnləri/şəkilləri təqdimat materialıdır; canlı statistika kimi göstərilmir. Kartdakı initials foto yoxluğunun placeholder-idir.

## Servis səthi və UI-da ayrıca yolu olmayan funksiyalar

- `courseService.getCourseById` GET `/course/{id}` mövcuddur, kataloq detal modalı isə artıq yüklənmiş obyektə baxır; ayrıca route/link yoxdur.
- `adminService.getAdminAudit` search parametrini dəstəkləyir, AuditCard yalnız son 15 qeydi və refresh təqdim edir; tam audit search UI deyil.
- `adminService.getAdminUsers` take=100 və `getExamSessions` take=200 default verir; bank xaric siyahı pagination UI-sı yoxdur. Böyük bazada axtarışın bütün dataset üzərində olması server testi ilə yoxlanmalıdır.
- `userService` öz/tələbə overview, sinif list/create/add/delete və rol-keçid imkanlarını çağırır; profileImage üçün ayrıca profil upload düyməsi yoxdur.
- `ui` qovluğunun Badge/Card/StatCard/ProgressBar/States/FormField hissələri təqdimatdır. Interaktiv səthlər Button/ButtonLink/IconButton, Modal, ConfirmDialog, Tabs, SearchField, ThemeToggle, Toast və layout Sidebar/Breadcrumb/DashboardShell-dır; FE-105–109 bunları əhatə edir.

## Brauzer üçün ilk prioritet sırası

1. FE-055 timerin monoton azalması (STAT-02).
2. FE-022 unconfirmed hesab və resend CTA (STAT-03).
3. FE-020/032/033/034 sessiya login → refresh → expiry → logout.
4. FE-040/043 quiz submit → geri → gecikmiş error yarışı.
5. FE-052 VIP başqa sessiyaya iştirak və reload sonrası davam.
6. FE-073–079 upload/moderasiya/sahib təlimi tam dövrü yalnız auditin izolyasiya olunmuş test bazasında.
7. FE-067–071 Teacher və FE-080–104 Admin axınları ayrıca sintetik rollarla.
8. FE-007 hüquqi linklər, FE-018 offline görünüş, FE-105–109 responsive/fokus.

E-poçt, CAPTCHA və Google kimi xarici inteqrasiyalar konfiqurasiyasız və ya mock ilə yalnız məhdud sübut verir; tam E2E uğur kimi təqdim edilməməlidir. Real xarici hesab və məlumatlar bu alt-auditdə istifadə edilməyib.
