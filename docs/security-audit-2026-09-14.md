# Kiberaz.az — Backend təhlükəsizlik auditi (2026-09-14)

**Əhatə:** `Kiberaz.Api` (Program.cs, 6 controller, middleware, filter), `Kiberaz.Infrastructure`
(Auth/Token/User/Admin/Quiz/Exam/Course/Upload/SafePdf/PdfProcessSanitizer/Captcha/Email/AuditLog,
LiteDbUserStore, LiteDbAttemptTracker, DbInitializer, LiteDbContext), `Kiberaz.Application` (bütün validator və DTO-lar),
`appsettings*.json`, `.gitignore`, csproj paket versiyaları. Frontend yalnız token saxlanması və CSP baxımından.

**Metod:** tam mənbə kodu oxunuşu (static review) — OWASP Top 10 (2021), biznes məntiqi, API səthi (endpoint × auth ×
rate-limit × validator matrisi), ümumi konfiqurasiya. **Dinamik pentest icra olunmayıb** — bulud mühitində .NET SDK yoxdur,
API işə salına bilmir; `dotnet build`, `SecurityRegressionTests` işlədilməyib. Hər tapıntı üçün "necə yoxlamalı"
sətri verilib ki, lokalda təsdiqləyə biləsiniz.

**Vəziyyət (2026-09-14, eyni gün):** istifadəçi qərarı ilə **L3 istisna olmaqla bütün tapıntılar bağlanıb** — bax §9.

---

## 1. Xülasə cədvəli

| # | Ciddilik | Sinif | Tapıntı | Fayl |
|---|---|---|---|---|
| H1 | **High** | Business logic / funksional reqressiya | Platformaya yüklənmiş şəkil/PDF yolu təlim formasında validator tərəfindən **rədd edilir** (36 vs 32 simvol) | `CreateCourseRequestValidator.cs:19`, `UploadService.cs:55` |
| H2 | **High** | A05 / Availability (DoS) | PDF endirmə hər dəfə yeni proses yaradır **və** eksklüziv yazı qapısını tutur → paralel 2-ci endirmə 503, anonim CPU DoS | `UploadService.cs:83-90`, `UploadController.cs:30-44` |
| M1 | Medium | A07 / Session | Bir hesab üçün **tək refresh token** + oğurluq aşkarlanması → 2-ci cihazdan giriş 15 dəq sonra hər iki sessiyanı öldürür | `AuthService.cs:197, 293` |
| M2 | Medium | A04 / Resource abuse | Hər təsdiqli hesab (VIP olmasa da) 5/dəq × 10 MB yükləyə bilər; fayllar heç vaxt silinmir; qlobal 1 GB / 2000 fayl limiti dolanda **bütün** yükləmə dayanır | `UploadController.cs:25`, `UploadService.cs:21-36` |
| M3 | Medium | A07 / Pre-registration takeover | Təsdiqlənməmiş mövcud e-poçtla təkrar qeydiyyat hücumçunun parolunu saxlayıb qurbana təsdiq linki göndərir | `AuthService.cs:99-106` |
| M4 | Medium | A07 / Enumeration + lockout DoS | Girişdə təsdiqlənməmiş/kilidli hesab üçün fərqli mesaj; 5 səhv parol istənilən hesabı 5 dəq kilidləyir (təkrarlana bilər) | `AuthService.cs:172-178`, `Program.cs:55-56` |
| M5 | Medium | Availability | `/api/auth/refresh` anonimdir → limit IP-yə görə (10/dəq); NAT arxasındakı sinif/ofis kütləvi 429 + məcburi çıxış | `Program.cs:287-294`, `AuthController.cs:246-248` |
| L1 | Low | A09 / Info leak | `GET /api/auth/confirm-email` və `GET /api/user/confirm-email-change` tokeni query string-də daşıyır (proxy/server logları) | `AuthController.cs:78`, `UserController.cs:110` |
| L2 | Low | A05 / DoS | JSON endpoint-lər üçün qlobal request body limiti yoxdur (Kestrel default 30 MB) | `Program.cs` |
| L3 | Low | A01 / Consent | Teacher rolu özü-seçilir; müəllim tələbənin razılığı olmadan ID ilə sinfə əlavə edib nəticələrini görür (ID GUID-dir — yalnız paylaşılsa) | `UserService.cs:399`, `AuthService.cs:74` |
| L4 | Low | A05 / Config | CAPTCHA startup yoxlaması `IsProduction()`, qalan kod `!IsDevelopment()` — `Staging` mühitində CAPTCHA yoxlaması keçilir | `CaptchaService.cs:47` |
| L5 | Low | Availability | Turnstile `HttpClient` timeout-suz (default 100 s) — Cloudflare ləngiyəndə login sorğuları asılır | `Program.cs:456` |
| L6 | Low | A09 / Logging | Uğursuz giriş, rədd edilən token, admin rədd cavabları loglanmır — hücum izlənə bilmir | `AuthService.cs`, `Program.cs:117-173` |
| L7 | Low | A06 / Dependencies | `JwtBearer 9.0.0`, `Identity.Core 9.0.0` — digər paketlər 9.0.13; `dotnet list package --vulnerable` işlədilməlidir | `*.csproj` |
| L8 | Low | Concurrency | `LiteDbUserStore.CreateAsync` qapısız — paralel eyni e-poçt qeydiyyatı unique index-ə dəyib 500 qaytarır | `LiteDbUserStore.cs:57` |
| L9 | Low | Business logic | Admin bloku və brute-force kilidi eyni `LockoutEnd` sahəsindədir — 5 dəq müvəqqəti kilid paneldə "bloklanıb" görünür; "blokdan çıxar" onu sıfırlayır | `AdminService.cs:622` |
| L10 | Low | Privacy | Təlim kartında kənar `https://` şəkil URL-i icazəlidir → ziyarətçi IP-si üçüncü tərəfə gedir; moderasiyadan asılıdır | `CreateCourseRequestValidator.cs:26` |
| L11 | Low | Business logic | VIP dövrü bitəndə rol qalır → imtahan sessiyası (7/gün) ödənişsiz davam edir; kredit yalnız təlimə təsir edir | `ExamSessionService.cs:243` |
| L12 | Low | Availability / Oracle | Qeydiyyat və resend e-poçtu sorğu içində sinxron göndərilir (SMTP 30 s) — gecikmə hesab varlığını sızdırır, sorğu asılır | `AuthService.cs:103,133`, `EmailService.cs:131` |
| I1 | Info | Data at rest | `Kiberaz.db` şifrələnməyib; backup-larda PII + hash-lər açıqdır | `LiteDbContext.cs` |
| I2 | Info | HSTS | `UseHsts()` default (30 gün, `includeSubDomains`/`preload` yoxdur) | `Program.cs:605` |
| I3 | Info | Business logic | Liderlik lövhəsi ilk cavabla hesablanır; 2-ci hesabla cavab öyrənib əsas hesabda düzgün cavab vermək mümkündür | `QuizService.cs` |
| I4 | Info | Public data | `GET /api/course` anonim olaraq müəllim e-poçt/telefonunu qaytarır (60/dəq) — toplanma (scraping) mümkündür | `CourseService.cs` |

---

## 2. Tapıntıların təfərrüatı

### H1 — Yüklənmiş fayl yolu təlim formasında rədd edilir (funksional reqressiya)
- **Sinif:** business logic / regression. **Fayl:** `Kiberaz.Application/Validators/CreateCourseRequestValidator.cs:19`,
  `Kiberaz.Infrastructure/Services/UploadService.cs:55`.
- **Mexanizm:** `UploadService` faylı `Guid.NewGuid().ToString("N")` (32 hex) adı ilə saxlayıb `/uploads/photos/<32hex>.png`
  qaytarır. Validatorun `OwnUploadPath` regex-i isə `[0-9a-fA-F\-]{36}` — yəni defisli 36-lıq GUID tələb edir.
  Frontend (`CourseForm.tsx`) upload cavabını olduğu kimi `instructorPhotoUrl`/`syllabusFileUrl`-ə yazır → `POST /api/course`
  və `PUT /api/course/{id}` "Foto URL HTTPS ilə başlamalı və ya platformaya yüklənmiş fayl olmalıdır." ilə 400 qaytarır.
  `ReadSafePdfAsync` regex-i hər iki formatı qəbul edir — uyğunsuzluq yalnız validatordadır (`d311637` commit-indən).
- **Təsir:** VIP istifadəçi yüklədiyi şəkil/sillabusla təlim yarada bilmir; yalnız kənar `https://` linklər keçir (bu da L10-u gücləndirir).
- **Necə yoxlamalı:** lokalda VIP hesabla şəkil yükləyib təlim göndərin — 400 gözlənilir.
- **Təklif:** regex-i `(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})` et; `SecurityRegressionTests`-ə
  "upload → create course" ssenarisi əlavə et.

### H2 — PDF endirmə: eksklüziv qapı + hər sorğuda yeni proses
- **Sinif:** A05/A04 — availability. **Fayl:** `UploadService.cs:75-91`, `UploadController.cs:30-44` (`[AllowAnonymous]`, `general` 60/dəq).
- **Mexanizm (a):** `ReadSafePdfAsync` `AcquireGate()` ilə `.upload-write.lock` faylını `FileShare.None` açır. İkinci paralel
  sorğu (başqa ziyarətçi eyni anda sillabusu açır, ya da bir upload gedir) `IOException` → `UploadCapacityException` → **503**.
  Yəni iki tələbənin eyni PDF-i eyni anda açması birinə xəta verir; endirmə gedərkən heç kim yükləyə bilmir.
- **Mexanizm (b):** hər endirmə `sanitizer.RewriteAsync` → ayrıca `dotnet --sanitize-pdf` prosesi (≤10 s, ≤512 MB) — fayl artıq
  yükləmə zamanı təmizlənib. Anonim hücumçu 60/dəq/IP × bir neçə IP ilə serveri proses fırtınasına salır.
- **Necə yoxlamalı:** eyni PDF-ə 2 paralel `curl` — biri 503; `top`-da hər sorğuda yeni `dotnet` prosesi.
- **Təklif:** oxu yolunda qapı götürülsün (yalnız `FileShare.Read`); ikinci sanitizasiya ya ləğv edilsin (fayl yazılmazdan
  əvvəl artıq təmizlənib, adı GUID-dir, kənardan dəyişmir), ya da nəticə keşlənsin; endirməyə ayrıca dar rate-limit
  (məs. `download` 20/dəq) və `Content-Disposition: attachment` saxlanılsın.

### M1 — Tək refresh token + reuse-detection = çoxcihazlı istifadədə məcburi çıxış
- **Sinif:** A07 session management / availability. **Fayl:** `AuthService.cs:197` (login yeni token yazır), `:293-303` (oğurluq şaxəsi).
- **Mexanizm:** Cihaz A daxil olur (RT_A saxlanır). Cihaz B daxil olur → `user.RefreshToken = hash(RT_B)` A-nınkını əvəz edir.
  15 dəq sonra A refresh edir: imza etibarlı, `sstamp` uyğun, token uyğun deyil, saxlanan token boş deyil → "sessiya oğurlanıb"
  qərarı → `SecurityStamp` yenilənir → **A və B hər ikisi çıxarılır**. Eyni şey iki brauzerdə (mobil + masaüstü) baş verir.
  Əlavə: qurbanın **vaxtı keçmiş** access tokenini əldə edən şəxs (log/ekran görüntüsü) istənilən refresh token ilə bu şaxəni
  tətikləyib qurbanı çıxarda bilər (DoS, hesab ələ keçmir).
- **Necə yoxlamalı:** iki brauzerdə eyni hesabla daxil ol, birincidə 15 dəq gözlə/refresh çağır → ikisi də "Yenidən daxil olun".
- **Təklif:** hesab başına **refresh token ailəsi** (cihaz/sessiya siyahısı: `{TokenHash, Family, ExpiresAt, CreatedAt, Ip}`),
  reuse-detection ailə daxilində; limit (məs. 5 aktiv sessiya); "bütün cihazlardan çıx" əməliyyatı.

### M2 — Yükləmə səthi: hər hesab, per-user kvota yox, fayllar heç vaxt silinmir
- **Sinif:** A04 insecure design / resource exhaustion. **Fayl:** `UploadController.cs:25` (`[Authorize]`), `UploadService.cs:21-36`.
- **Mexanizm:** yalnız VIP təlim yarada bilər, amma `POST /api/upload/photo|syllabus` hər təsdiqli hesaba açıqdır: 5/dəq × 10 MB = 3 GB/saat
  (qlobal 1 GB limitinə 20 dəqiqəyə çatır). Limit dolanda `UploadCapacityException` **hamı** üçün — real VIP də yükləyə bilmir.
  Yüklənmiş fayl heç bir təlimə bağlanmır; təlim silinəndə, şəkil dəyişəndə, istifadəçi silinəndə (`AdminService.DeleteUserAsync`)
  fayl diskdə qalır — sahibsiz fayllar limiti tədricən "dolu" vəziyyətinə gətirir.
- **Necə yoxlamalı:** adi User hesabı ilə `POST /api/upload/syllabus` → 200.
- **Təklif:** `[Authorize(Roles = AppRoles.VIP)]` (admin də), per-user günlük kvota (say + bayt), faylın sahibini və istifadə
  vəziyyətini bazada izləmək (`UploadedFile {Owner, Path, UsedByCourse}`), 24 saat istifadəsiz qalan faylların süpürülməsi
  (mövcud `CourseExpirySweeper` nümunəsi ilə), təlim silinəndə fayl silinsin.

### M3 — Təsdiqlənməmiş hesab üzərindən "pre-registration" ələ keçirmə
- **Sinif:** A07. **Fayl:** `AuthService.cs:99-106`.
- **Mexanizm:** Hücumçu `victim@x.com` + öz parolu ilə qeydiyyatdan keçir (təsdiqsiz hesab yaranır). Qurban sonra eyni e-poçtla
  qeydiyyat edir → server mövcud təsdiqsiz hesaba **yenidən təsdiq linki** göndərir və "Qeydiyyat uğurla tamamlandı" deyir. Qurban
  öz qeydiyyatı sandığı linki klikləyir → hesab hücumçunun parolu ilə təsdiqlənir. Qurbanın adı/soyadı/ləqəbi də hücumçununkudur.
  Qurban parolla girə bilməyəndə "şifrəni unutdum" edənə qədər hücumçu hesabdadır. Sistem sahibi e-poçtu (`SystemAccounts.AdministratorEmail`)
  üçün: təzə bazada sahib hesabı hələ yaradılmayıbsa eyni ssenari + restart-da `EnforceSingleAdministrator` hesabı Admin edir.
- **Necə yoxlamalı:** eyni e-poçtla iki fərqli parolla qeydiyyat; ikinci sorğu 201 qaytarır, amma bazada birinci parol qalır.
- **Təklif:** mövcud hesab **təsdiqsizdirsə** yeni qeydiyyat sorğusunun parolu/profili ilə üstündən yazılsın (təsdiqsiz hesabın
  sahibi yoxdur) və köhnə təsdiq tokenləri etibarsız olsun (`SecurityStamp` yenilə); alternativ — təsdiq səhifəsində parol tələb et.
  Sahib hesabı deploy-dan əvvəl əl ilə yaradılsın/yoxlanılsın.

### M4 — Hesab enumeration + kilid DoS
- **Sinif:** A07. **Fayl:** `AuthService.cs:172-178`; `Program.cs:55-56` (`MaxFailedAccessAttempts=5`, 5 dəq).
- **Mexanizm:** Mövcud olmayan e-poçt və səhv parol → "E-poçt və ya parol yanlışdır"; mövcud amma təsdiqsiz/kilidli hesab →
  "Hesabınız aktiv deyil…" (həm də parol hash-ləməsi keçildiyi üçün daha sürətli cavab). Nəticə: (1) təsdiqsiz hesablar birbaşa
  sayılır; (2) istənilən e-poçt üçün 5 səhv parol → hesab varsa 6-cı cavab "aktiv deyil" olur → **hər hesab sayıla bilər**;
  (3) eyni 5 sorğu qurbanı 5 dəqiqəlik kilidləyir — hücumçu bunu təkrarlayaraq (CAPTCHA həll xidməti ilə) hesabı daimi bağlı saxlaya bilər.
  Qeydiyyatda da fərq var: mövcud təsdiqli e-poçt üçün cavab dərhal, yeni e-poçt üçün SMTP gecikməsi (bax L12).
- **Necə yoxlamalı:** təsdiqsiz hesab e-poçtu ilə login → fərqli mesaj; 5 səhv parol → 6-cıda "aktiv deyil".
- **Təklif:** login-də hər halda eyni mesaj + eyni iş (dummy hash) — "təsdiqlənməyib" məlumatı yalnız düzgün parol verildikdə;
  kilid mesajını ayırmamaq; kilid siyasətini "yumşaq" etmək (progressive delay/CAPTCHA, hesabı bağlamadan) və ya kilidi IP+hesab
  kombinasiyasına bağlamaq; `AccessFailedCount` yalnız CAPTCHA keçildikdən sonra artsın.

### M5 — Refresh limiti anonim IP-yə görə
- **Sinif:** availability. **Fayl:** `Program.cs:287-294`, `AuthController.cs:246-248`.
- **Mexanizm:** `/api/auth/refresh` `[AllowAnonymous]`-dur; sorğu anında access token vaxtı keçdiyi üçün `HttpContext.User` boşdur →
  limit açarı `ip:<IP>` → 10/dəq. Eyni NAT arxasında 20+ aktiv istifadəçi (məktəb, ofis, mobil operator CGNAT) 15 dəq dövrlərində
  429 alır; frontend refresh uğursuzluğunu çıxış kimi işləyir.
- **Təklif:** refresh üçün ayrıca siyasət — açar cookie-dəki refresh tokenin hash-i və ya vaxtı keçmiş tokenin `sub` claim-i
  (imza yoxlanaraq); IP limiti daha geniş (məs. 120/dəq) qalsın.

### L1 — Token query string-də (GET təsdiq endpoint-ləri)
E-poçtlar artıq fragment (`#userId=…&token=…`) + POST istifadə edir; `GET /api/auth/confirm-email?userId&token` və
`GET /api/user/confirm-email-change?…` köhnə yoldur — token proxy/Kestrel/CDN loglarına düşür, `Referer` ilə sıza bilər.
**Təklif:** GET variantlarını sil (frontend onları çağırmır).

### L2 — Qlobal body limiti
Yalnız `POST /api/exam-sessions` `[RequestSizeLimit(16384)]` daşıyır; qalan JSON endpoint-lər Kestrel default 30 MB qəbul edir —
validator işləməzdən əvvəl bütün body deserializasiya olunur (yaddaş). **Təklif:** `KestrelServerOptions.Limits.MaxRequestBodySize = 64 KB`
default, upload action-larında mövcud `[RequestSizeLimit]` qalsın.

### L3 — Teacher rolu və razılıqsız sinif üzvlüyü
`Register.Role` və `PATCH /api/user/role` ilə hər kəs Teacher olur; `POST teacher/classes/{id}/students` tələbənin razılığı olmadan
onu əlavə edir və `GET students/{id}/overview` ad/soyad/ləqəb/quiz statistikasını verir. Tələbə ID-si GUID-dir və heç bir ictimai
cavabda yoxdur (liderlik yalnız ləqəb) — risk yalnız ID paylaşılanda. **Təklif:** dəvət kodu / tələbənin qəbulu modeli, ya da
ID əvəzinə ləqəb + tələbənin təsdiqi.

### L4 — Mühit adı uyğunsuzluğu
`CaptchaService.EnsureProductionReady` `!env.IsProduction()` olanda çıxır; `Program.cs` HTTPS/HSTS/CSP/cookie `Secure` üçün
`!IsDevelopment()` işlədir. `ASPNETCORE_ENVIRONMENT=Staging` ilə server HTTPS-də işləyər, amma test CAPTCHA açarı ilə qalxar.
**Təklif:** hər yerdə `!IsDevelopment()`.

### L5 — Turnstile HttpClient timeout
`AddHttpClient("captcha")` timeout təyin etmir (100 s). Cloudflare ləngiyəndə CAPTCHA tələb edən hər login/register sorğusu asılır,
thread-lər tükənir. **Təklif:** `c.Timeout = TimeSpan.FromSeconds(5)`; xəta = rədd (artıq belədir).

### L6 — Təhlükəsizlik hadisələrinin loglanması (A09)
Uğursuz giriş (IP, hesab hash-i), `OnTokenValidated` rədd səbəbləri, `sstamp` uyğunsuzluğu, admin invariant pozuntusu, refresh
oğurluq aşkarlanması, 403-lər loglanmır — brute-force və ya token oğurluğu retrospektiv aşkar edilə bilməz. Yeni `AdminAudit`
yalnız uğurlu admin əməliyyatlarını yazır. **Təklif:** `ILogger` ilə strukturlu `SecurityEvent` (növ, IP, userId, TraceId), PII-siz.

### L7 — Paket versiyaları
`Microsoft.AspNetCore.Authentication.JwtBearer 9.0.0`, `Microsoft.Extensions.Identity.Core 9.0.0` — `Google`/`OpenApi` 9.0.13-dədir.
9.0.x xəttində Identity/Kestrel üçün düzəlişlər çıxıb; bulud mühitində yoxlanıla bilmədi. **Təklif:** hamısını 9.0.13-ə,
`dotnet list package --vulnerable --include-transitive`; runtime patch səviyyəsi (Kestrel CVE-lər) serverdə yoxlanılsın.

### L8 — `CreateAsync` qapısız
`LiteDbUserStore.CreateAsync` `UsersSyncRoot` almadan `Insert` edir; `UserManager` əvvəl `FindByEmail/Name` yoxlayır — iki eyni
qeydiyyat sorğusu arasındakı pəncərədə unique index `LiteException` atır → `ExceptionMiddleware` 500. Bütövlük pozulmur.
**Təklif:** `CreateAsync`-də qapı + `LiteException` → `DuplicateEmail` nəticəsi.

### L9 — Blok və brute-force kilidi eyni sahədə
`ToggleUserBlockAsync` `LockoutEnd = MaxValue`; brute-force kilidi də `LockoutEnd`-dir. 5 dəq kilidli istifadəçi paneldə "bloklanıb"
görünür; admin onu həqiqətən **bloklamaq** istəyib düyməni basanda toggle `isBlocked=true` oxuyur və əksinə kilidi **açır**.
Qarışıqlıq riski, təhlükəsizlik pozuntusu deyil. **Təklif:** ayrıca `IsBlockedByAdmin` sahəsi.

### L10 — Kənar şəkil URL-ləri
`InstructorPhotoUrl`/`SyllabusFileUrl` üçün istənilən `https://` qəbul edilir → ictimai səhifədə üçüncü tərəf mənbə (ziyarətçi IP/UA
sızması, tracking pixel, dəyişdirilə bilən məzmun). Moderasiya var, amma admin şəkil mənbəyini görmür. **Təklif:** yalnız öz upload
yolları (H1 düzəlişindən sonra mümkündür) və ya domen allow-list.

### L11 — VIP rolu dövrdən sonra
`VipTerm` bitəndə rol avtomatik geri alınmır; `ExamSessionService.Host` yalnız rolu yoxlayır → imtahan sessiyaları (7/gün) müddətsiz.
Bu, "VIP = admin tərəfindən verilən status" qərarıdırsa problem deyil; ödənişli model gəlirsə `ActiveTerm` yoxlaması imtahana da
əlavə edilməlidir.

### L12 — Sinxron SMTP
Qeydiyyat/resend/forgot sorğuları SMTP-ni (30 s timeout) gözləyir: cavab gecikməsi hesab varlığını sızdırır (M4), Gmail ləngiyəndə
`auth` limiti (10/dəq) altında thread-lər tutulur. **Təklif:** göndərişi `Channel<T>` + `BackgroundService` növbəsinə keçir,
sorğu dərhal generic cavab qaytarsın.

---

## 3. OWASP Top 10 (2021) matrisi

| Kateqoriya | Vəziyyət | Qeyd |
|---|---|---|
| A01 Broken Access Control | ✅ (L3) | Hər controller `[Authorize]`/`FallbackPolicy`; rol yoxlaması + servisdə sahiblik (`OwnedCourse`, `OwnedSession`, `OwnedAttempt`, `TeacherId == teacherId`); admin invariant hər sorğuda; gizli hesab bütün siyahılarda süzülür. IDOR tapılmadı. |
| A02 Cryptographic Failures | ✅ (I1) | HMAC-SHA256 pinned, 32+ bayt açar; refresh token 64 bayt RNG, SHA-256 ilə saxlanır, sabit-vaxt müqayisə; Identity PBKDF2; tokenlər fragment-də; DB şifrəsiz (I1). |
| A03 Injection | ✅ | LiteDB typed predicate-lər; tək `Query.EQ("_id", key)` server tərəfli sətirlə; `BsonExpression` string-i user inputundan qurulmur. Fayl adı yalnız GUID regex ilə; `Path.Combine` istifadəçi adı ilə yox. Regex-lər sabit, ReDoS yoxdur. |
| A04 Insecure Design | ⚠️ (M1, M2, M3) | Tək refresh token; upload sahibsiz; təsdiqsiz hesab yenidən qeydiyyatı. |
| A05 Security Misconfiguration | ⚠️ (H2, L2, L4, I2) | Başlıqlar, CSP, HSTS, CORS allow-list, Swagger dev-only, secrets env-də, `.gitignore` düzgün; qalan — body limiti, mühit adı, PDF yolu. |
| A06 Vulnerable Components | ⚠️ (L7) | Versiyalar pinned; yoxlama işlədilməyib. |
| A07 Auth Failures | ⚠️ (M3, M4, M5) | Lockout, CAPTCHA fail-closed, `sstamp`, rotation, reuse-detection var; enumeration və kilid DoS qalır. |
| A08 Integrity Failures | ✅ | PDF sanitizasiyası izolyasiya olunmuş prosesdə; magic bytes; Google `email_verified` + `hd` yoxlanır; CSP `base-uri 'none'`. |
| A09 Logging & Monitoring | ⚠️ (L1, L6) | Admin audit jurnalı var; təhlükəsizlik hadisələri yoxdur; GET tokenlər logda. |
| A10 SSRF | ✅ | Server yalnız sabit Turnstile URL-inə sorğu atır; istifadəçi URL-ləri heç vaxt fetch edilmir. |

---

## 4. API səthi (static pentest matrisi)

Bütün endpoint-lər oxundu; hər sətirdə auth, rate-limit siyasəti və validator təsdiqlənib. ✅ = kodda düzgün, ⚠️ = tapıntıya istinad.

| Endpoint | Auth | Limit | Validator | Qeyd |
|---|---|---|---|---|
| `POST /api/auth/register` | anon | auth 10/dəq + IP CAPTCHA | ✅ | M3, M4, L12 |
| `POST /api/auth/login` | anon | auth | ✅ | M4; dummy hash timing ✅ |
| `POST /api/auth/refresh` | anon (cookie) | auth | ✅ | M1, M5; rotation + reuse ✅ |
| `POST /api/auth/logout` | JWT | general | — | stamp yenilənir ✅ |
| `GET/POST /api/auth/confirm-email` | anon | sensitive/auth | ✅ (POST) | L1 (GET) |
| `POST /api/auth/resend-confirmation` | anon | sensitive | ✅ | generic cavab ✅, cooldown 60 s ✅ |
| `POST /api/auth/forgot-password` | anon | sensitive + CAPTCHA | ✅ | generic ✅ |
| `POST /api/auth/reset-password` | anon | sensitive | ✅ | Identity token (HMAC, 2 saat) ✅ |
| `GET /api/auth/google`, `google-callback` | anon | general | — | `email_verified`+`hd` ✅, kod 2 dəq tək-istifadəli ✅ |
| `POST /api/auth/google/exchange` | anon | auth | ✅ | kod həmişə tüketilir ✅ |
| `GET /api/auth/me` | JWT | general | — | claim-lərdən, DB yox ✅ |
| `PATCH /api/user/role` | JWT | general | ✅ | yalnız User↔Teacher, VIP/Admin rədd ✅ (L3) |
| `GET/PUT /api/user/profile` | JWT | general | ✅ | ləqəb unikallığı ✅ |
| `POST /api/user/profile/change-email` | JWT | general | ✅ | link **köhnə** e-poçta gedir ✅, yeni e-poçt yenidən təsdiq ✅ |
| `GET/POST /api/user/confirm-email-change` | anon | sensitive | ✅ (POST) | L1 (GET) |
| `POST /api/user/profile/request-password-change` | JWT | general | — | cooldown ✅ |
| `GET /api/user/students/{id}/overview` | Teacher | general | — | sinif üzvlüyü yoxlanır ✅ (L3) |
| `teacher/classes*` | Teacher | general | ✅ | sahiblik `TeacherId` ✅, limit 200 ✅ |
| `GET /api/quiz/categories`, `questions` | anon | general | — | `count` clamp 1–50 ✅, cavab açarı yoxdur ✅ |
| `GET /api/quiz/leaderboard` | anon | general | — | yalnız ləqəb ✅, keş 128 açar ✅ |
| `POST /api/quiz/submit` | JWT | submit 30/dəq | ✅ | `IsExamOnly` rədd ✅, ilk cavab iddiası ✅ (I3) |
| `quiz/categories|questions` yazı/silmə/bərpa | Admin | sensitive | ✅ | audit ✅, kaskad tranzaksiyada ✅ |
| `GET /api/quiz/admin/*` | Admin | general | — | `NoStore` ✅ |
| `GET /api/exam-sessions/categories`, `POST /`, `{code}/dashboard`, `{code}/close` | VIP | submit/general | ✅ | rol DB-dən ✅, kvota kilid altında ✅, kod 64-bit ✅ |
| `POST /api/exam-sessions/join` | JWT | submit | ✅ | öz sessiyasına rədd ✅, 500 limit ✅ |
| `attempts/{id}`, `answer`, `submit` | JWT | general/submit | ✅ | sahiblik ✅, `Revision` ✅, düzgün açar heç vaxt qayıtmır ✅ |
| `POST /api/course` | VIP | sensitive | ✅ | kredit `VipSyncRoot` ✅ (H1) |
| `GET /api/course`, `/{id}` | anon | general | — | yalnız Approved+aktiv ✅ (I4, L10) |
| `PUT/DELETE /api/course/{id}`, `reactivate` | JWT/VIP | sensitive | ✅ | sahiblik 404 ✅ |
| `POST /api/upload/photo|syllabus` | JWT | upload 5/dəq | — | magic bytes ✅, GUID ad ✅, PDF sanitizer ✅ (M2) |
| `GET /uploads/syllabus/{file}` | anon | general | regex ✅ | sandbox CSP ✅ (H2) |
| `/api/admin/*` | Admin | general/sensitive | ✅ | sahib invariantı `ChangeAccount` içində ✅, audit ✅ |
| `GET /api/admin/audit` | Admin | general | — | take ≤ 200 ✅ |

Ümumi: `[AllowAnonymous]` yalnız 19 endpoint-də və hamısı məqsədlidir; `FallbackPolicy` sayəsində atributsuz action anonim qala bilməz.

---

## 5. Biznes məntiqi — yoxlanılan ssenarilər

| Ssenari | Nəticə |
|---|---|
| VIP krediti iki paralel sorğu ilə iki dəfə xərclənə bilərmi? | ❌ mümkün deyil — `VipSyncRoot` + tranzaksiya (`ConsumeCourseCredit`). |
| Rədd edilmiş təlimi redaktə edib limitsiz təkrar göndərmək | kredit yenidən xərclənmir, moderasiyaya düşür — məqsədlidir. |
| Silinmiş təlimin krediti geri qayıdırmı? | xeyr (sənədləşib). |
| Günlük 7 sessiya limiti keçilə bilərmi (paralel, saat qurşağı)? | ❌ — `ExamSyncRoot` altında UTC gün sayımı. |
| Tələbə imtahan cavab açarını görə bilərmi? | ❌ — `AttemptView` `CorrectKey` qaytarmır; təqdimdən sonra da yox. |
| Vaxt bitəndən sonra cavab yazmaq | ❌ — `Expire` hər çağırışda server vaxtı ilə yekunlaşdırır. |
| Açıq bankdakı sualın imtahan bankına keçirilməsi | ❌ — `IsExamOnly` dəyişmir, `NormalizeQuestion` dublikat qapısı. |
| Kateqoriya bərpası yalnız kaskadla silinənləri qaytarırmı? | ✅ — `UpdatedAt == cascadeStamp`. |
| Admin rolunu vermək/almaq (API, panel, DB) | ❌ — `AllowedRoles`, startup invariantı, hər sorğuda `OnTokenValidated`. |
| Öz hesabını silmək/bloklamaq | ❌ rədd edilir. |
| Quiz balı: eyni suala təkrar cavab | ilk cavab sayılır (`QuizScoreClaims`); alt hesabla öyrənmə mümkündür (I3). |
| Google ilə mövcud parollu hesaba girmək | yalnız Google-un təsdiqlədiyi gmail/hd e-poçt; təsdiqsiz hesab rədd ✅. |
| Çoxcihazlı giriş | ⚠️ M1. |
| Yüklənmiş faylla təlim yaratmaq | ⚠️ H1. |
| VIP dövrü bitəndə | rol qalır (L11), kredit dayanır ✅, aktiv təlim 30 gününü tamamlayır ✅. |

---

## 6. Düzgün işləyən nəzarətlər (yoxlanıldı)

- JWT: `ValidAlgorithms=[HS256]`, `ClockSkew=0`, `RequireSignedTokens`, `RequireExpirationTime`; refresh axınında `alg` yenidən yoxlanır, 7 gündən köhnə token rədd.
- `OnTokenValidated`: istifadəçi mövcud + `EmailConfirmed` + kilid yox + `sstamp` + canlı rollar = token rolları + sahib/Admin invariantı.
- Refresh cookie `HttpOnly/Secure/SameSite=Strict`, body-dən silinir; rotation + reuse-detection (M1 qeydi ilə).
- Tək-admin: kodda sabit e-poçt, `EnforceSingleAdministrator` tranzaksiyada, gizli hesab bütün siyahı/say/lövhə/sinif/imtahan cavablarında süzülür.
- CORS normalizə olunmuş allow-list + credentials; `AllowedHosts`; `ForwardedHeaders` loopback default, `ForwardLimit=1`.
- Başlıqlar: nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, API CSP `default-src 'none'`; SPA CSP nonce/`'self'` (inline skript yoxdur).
- Rate limiting: qlobal zəncir (hesab 240/dəq + xam IP 600/dəq) + dar siyasətlər; limiter autentifikasiyadan sonra.
- CAPTCHA fail-closed; production test açarı/bypass ilə qalxmır; `hostname` allow-list.
- Uploads: uzantı + magic bytes + real bayt limiti + boş fayl rədd; GUID ad; PDF `SafePdf` (JS/OpenAction/EmbeddedFile/AcroForm/Launch/Encrypt…) ayrıca prosesdə, yaddaş/vaxt limiti; PDF-lər `UseStaticFiles`-dan kənarda; kvota + disk ehtiyatı.
- Secrets: `appsettings*.json`-da açar yoxdur, `.gitignore` `*.db`/`Local.json`/`.env`; JWT açarı qısa/dev olduqda start alınmır.
- `ExceptionMiddleware` production-da generic; `ApiResponse<T>` hər yerdə; hər request DTO-nun validatoru var (`ValidationFilter`).
- Soft delete + `IsDeleted` süzgəcləri; unique index-lər (`NormalizedEmail`, `NormalizedUserName`, `Code`, `ParticipationKey`) + qapı içində təkrar yoxlama.
- E-poçt linkləri fragment-də (`#`), tokenlər 2 saat; e-poçt dəyişikliyi köhnə ünvana gedir, yeni ünvan yenidən təsdiqlənir.
- Frontend: access token `sessionStorage` (tab bağlananda silinir), refresh yalnız cookie; CSP XSS təsirini məhdudlaşdırır.

---

## 7. Deploy yoxlama siyahısı (koddan kənar, amma nəticəyə təsir edir)

1. `ForwardedHeaders:KnownProxies` — Cloudflare/xarici LB varsa mütləq doldurulsun; əks halda bütün istifadəçilər bir IP kimi görünür (rate limit + CAPTCHA + audit IP-si yararsız), `UseHttpsRedirection` dövrə düşür.
2. Statik host SPA üçün `index.html`-dəki CSP-ni **HTTP başlığı** kimi + `frame-ancestors 'none'` göndərsin (meta `frame-ancestors`-u dəstəkləmir).
3. `ASPNETCORE_ENVIRONMENT=Production` (Staging deyil — L4).
4. `ConnectionStrings__LiteDb` publish qovluğundan kənarda; `.db` backup-ları şifrələnmiş yerdə (I1).
5. Env: `JwtSettings__SecretKey` (≥32 bayt təsadüfi), `Captcha__SecretKey` (real), `EmailSettings__Smtp*`, `Authentication__Google__*`, `FrontendUrl`.
6. `Uploads:MaxTotalBytes/MaxFiles/MinFreeBytes` real diskə görə; `wwwroot/uploads` üçün ayrıca disk kvotası (M2).
7. Runtime patch: `dotnet --list-runtimes` — 9.0.x son patch; `dotnet list package --vulnerable` (L7).
8. Log toplama: `Kiberaz` kateqoriyası `Information`; L6 həll olunanda SIEM/alert.

---

## 8. Tövsiyə olunan prioritet

1. **H1** (istifadəçi funksiyası sınıb) və **H2** (503 + DoS) — dərhal.
2. **M1, M2, M3, M4, M5** — növbəti iterasiya; M1 və M2 sxem dəyişikliyi tələb edir (refresh token ailəsi, `UploadedFile` kolleksiyası).
3. L-lər — kiçik, hər biri 1–20 sətir.

Hansılarını düzəldim — nömrələri yazın (məs. `H1 H2 M3 L1 L4 L5`). Düzəlişlər eyni qaydalarla (validator + servis + test + lokal fayllar) tətbiq olunacaq.

---

## 9. Düzəliş vəziyyəti (2026-09-14)

| # | Vəziyyət | Nə edildi |
|---|---|---|
| H1 | ✅ | `OwnUploadPath` regex-i 32-lik (`N`) və 36-lıq GUID-i qəbul edir; yalnız öz upload yolları (L10 ilə birlikdə). |
| H2 | ✅ | `ReadSafePdfAsync`: qeydli/təmizlənmiş fayl qapısız, `FileShare.Read` ilə birbaşa oxunur; qeydsiz köhnə PDF **bir dəfə** təmizlənib yerində əvəz olunur və `UploadedFiles`-a yazılır; `download` siyasəti 20/dəq. |
| M1 | ✅ | `AppUser.RefreshSessions` (cihaz başına token ailəsi, max 5, 7 gün sürüşən / 30 gün mütləq); reuse-detection yalnız həmin ailəni bağlayır; `POST /api/auth/logout` tək cihaz (jti qara siyahısı `LiteDbTokenDenylist` + sessiya silinir), yeni `POST /api/auth/logout-all`; frontend çıxışda serveri çağırır. Köhnə `RefreshToken` sahələri silindi — deploy-dan sonra hər kəs bir dəfə yenidən daxil olur. |
| M2 | ✅ | Upload yalnız `VIP,Admin`; hesab başına 24 saat kvota (20 fayl / 60 MB → 429 + Retry-After); `UploadedFiles` qeydi (sahib, ölçü, sanitizasiya, təlimə bağlılıq); `UploadLedger.EnsureOwnedBy` — başqasının faylına istinad 400; `SyncClaims` hər təlim yazısında; `UploadSweeper` sahibsiz faylları 24 saatdan sonra silir; startup `UploadLedger.Backfill` mövcud təlim fayllarını qeydə alır. |
| M3 | ✅ | Təsdiqsiz mövcud hesab yeni qeydiyyat sorğusunun parol/profil/rolu ilə üstündən yazılır (`AddPasswordAsync` → stamp yenilənir, köhnə linklər ölür), yeni təsdiq linki göndərilir; ləqəb yoxlaması sərt qalır (oracle yaranmasın). |
| M4 | ✅ | Login: təsdiqsiz/kilidli/bloklanmış hesab üçün də əvvəlcə parol yoxlanılır — yanlış paroldan cavab mövcud olmayan hesabla eynidir (mesaj + hash işi); yalnız düzgün parol sahibi vəziyyət mesajını görür. Kilid siyasəti (5 cəhd / 5 dəq) qaydalara görə dəyişdirilmədi; kilid hadisələri loglanır. |
| M5 | ✅ | `refresh` siyasəti: açar cookie-dəki tokenin SHA-256 hash-idir (10/dəq/token), token yoxdursa IP. |
| L1 | ✅ | `GET /api/auth/confirm-email` və `GET /api/user/confirm-email-change` silindi. |
| L2 | ✅ | Kestrel/IIS `MaxRequestBodySize = 64 KB`; upload action-ları `[RequestSizeLimit]` ilə genişləndirir. |
| L3 | ⏸ | İstifadəçi qərarı ilə dəyişdirilmədi. |
| L4 | ✅ | `CaptchaService.EnsureProductionReady` `!IsDevelopment()` ilə işləyir. |
| L5 | ✅ | Turnstile `HttpClient.Timeout = 5 s`. |
| L6 | ✅ | `SecurityEvents` logger: token rədd səbəbi (jti/stamp/rol/invariant/hesab vəziyyəti) + hesab ID + IP + yol; uğursuz giriş, kilid, refresh reuse, logout-all loglanır (PII yox). |
| L7 | ✅ | `JwtBearer`, `Identity.Core` → 9.0.13. `dotnet list package --vulnerable` lokalda işlədilməlidir. |
| L8 | ✅ | `LiteDbUserStore.CreateAsync` `UsersSyncRoot` altında, təkrar yoxlama + `INDEX_DUPLICATE_KEY` → `DuplicateEmail/UserName`. |
| L9 | ✅ | `AppUser.BlockedByAdminAt`; `IsBlocked` yalnız admin bloku, yeni `IsTemporarilyLocked`; UI "Müvəqqəti kilid" nişanı. |
| L10 | ✅ | Kənar `https://` şəkil/PDF qəbul edilmir — yalnız platform upload-ı. |
| L11 | ✅ | `POST /api/exam-sessions` aktiv VIP dövrü tələb edir; mövcud sessiyanın paneli/bağlanması rol ilə qalır. |
| L12 | ✅ | `EmailQueue` (bounded 1000) + `EmailDispatcher` (3 cəhd, 10/30 s); sorğu SMTP-ni gözləmir; SMTP konfiqurasiyası növbəyə atmazdan əvvəl yoxlanılır. |
| I2 | ✅ | HSTS 1 il + `includeSubDomains` (preload yox). |
| I1, I3, I4 | ℹ | Məlumat xarakterli, dəyişiklik yoxdur. |

**Yoxlanılmayan:** buludda .NET SDK yoxdur — `dotnet build -c Release --warnaserror` və `SecurityRegressionTests` (yeni: çoxcihazlı refresh, hesab başına upload kvotası) işlədilməyib; kod əl ilə iki dəfə nəzərdən keçirilib. Frontend `tsc`/`eslint`/`build` təmiz, Playwright ilə çıxış axını (`POST /api/auth/logout` çağırılır, tokenlər silinir) yoxlanılıb.

**Deploy qeydi:** yeni kolleksiyalar `UploadedFiles`, `RevokedTokens` avtomatik yaranır; `AppUser.RefreshSessions`/`BlockedByAdminAt` sahələri köhnə sənədlərdə boş oxunur; **bütün istifadəçilər bir dəfə yenidən daxil olmalıdır** (köhnə refresh tokenlər tanınmır). Əvvəl admin tərəfindən bloklanmış hesablar (`LockoutEnd = MaxValue`) startup-da `DbInitializer.BackfillAdminBlocks` ilə `BlockedByAdminAt` bayrağı alır — əl ilə miqrasiya lazım deyil.
