# API Code Review — Kiberaz.az

**Tarix:** 2026-09-09 · **Əhatə:** `Kiberaz.Api` (7 controller / 36 endpoint), onlara bağlı servislər, `Program.cs` pipeline, `ValidationFilter`, validator-lar.
**Metod:** yalnız kod oxunuşu. **Build işlədilməyib, test icra edilməyib** — bu mühitdə .NET SDK yoxdur. Hər tapıntı fayl + sətir ilə göstərilib.

---

## Xülasə

| # | Severity | Tapıntı | Yer |
|---|---|---|---|
| 1 | 🔴 High | Anonim leaderboard hər sorğuda 3 kolleksiyanı tam skan edir | `QuizService.cs:364,372,383` |
| 2 | 🟠 Medium | Cascade soft-delete tranzaksiyasızdır → yetim suallar | `QuizService.cs:305`, `AdminService.cs:351` |
| 3 | 🟠 Medium | Sinfə tələbə əlavəsi gate-dən kənar read-modify-write (lost update) | `UserService.cs:348` |
| 4 | 🟠 Medium | Refresh token reuse detection yoxdur + sessiya mütləq limitsizdir | `AuthService.cs:232` |
| 5 | 🟠 Medium | Validator olmayan DTO-lar səssizcə yoxlanılmır | `ValidationFilter.cs:31` |
| 6 | 🟠 Medium | `confirm-email-change` token endpoint-ləri `general` limitindədir | `UserController.cs:108,119` |
| 7 | 🟠 Medium | Dağıdıcı admin endpoint-ləri `general` limitindədir | `AdminController.cs:83,129` |
| 8 | 🟡 Low | `GET /api/auth/me` `ApiResponse<T>` qaytarmır | `AuthController.cs:278` |
| 9 | 🟡 Low | Rol sabitləri əvəzinə string literal | `ExamSessionsController.cs:27,35,54,58` |
| 10 | 🟡 Low | `ProducesResponseType` / XML doc yoxdur (9 endpoint) | `ExamSessionsController.cs` |
| 11 | 🟡 Low | `QuizScoreClaims` kolleksiyası `LiteDbContext`-dən kənarda yaradılır | `QuizService.cs:153` |
| 12 | 🟡 Low | `GetCategories` exam write gate-i uzun müddət tutur | `ExamSessionService.cs:26,169` |
| 13 | 🟡 Low | `GET /api/course` limitsiz siyahı qaytarır | `CourseController.cs:62` |
| 14 | 🟡 Low | Dashboard hər çağırışda bütün istifadəçiləri skan edir | `ExamSessionService.cs:141` |
| 15 | 🟡 Low | Refresh token body-də də qəbul edilir (qaydadan sapma) | `AuthController.cs:251` |

---

## 🔴 High

### 1. Anonim leaderboard — gücləndirilmiş DoS vektoru

**Fayl:** `Kiberaz.Infrastructure/Services/QuizService.cs:364, 372-376, 383-389`
**Endpoint:** `GET /api/quiz/leaderboard` — `[AllowAnonymous]`, `general` (60/dəq/IP, qlobal xam-IP tavanı 600/dəq)

Hər sorğuda üç kolleksiya **tam** yüklənir və yaddaşda emal olunur:

```csharp
var results = QuizSecurity.ScoredResults(_db.QuizResults.FindAll())   // bütün nəticələr
var hiddenUserIds = _db.Users.FindAll().Where(...)                     // bütün istifadəçilər
var difficulties = _db.QuizQuestions.FindAll().ToDictionary(...)       // bütün suallar
```

`ScoredResults` üstəlik `GroupBy` + `OrderBy` edir. Keş yoxdur, tarix filtri **bazada deyil, yaddaşda** tətbiq olunur (`.Where(r => r.AnsweredAt >= previousFrom)` artıq `FindAll()`-dan sonra gəlir).

**Hücum:** kimliyi olmayan bir skript dəqiqədə 60 sorğu (fərqli IP-lərlə daha çox) göndərir. Hər sorğu bütün `QuizResults` tarixçəsini diskdən oxuyur. LiteDB tək fayldır — bu oxumalar imtahan cavablarının yazılması ilə eyni fayl üzərində yarışır, yəni tələbənin cavabı gecikir.

**Fix (təklif):** nəticəni 30–60 saniyəlik in-memory snapshot-da keşlə (açar: `period|categoryId|limit`), və ya `QuizResults`-a `AnsweredAt` indeksi əlavə edib dövr filtrini sorğu səviyyəsində tətbiq et. `hiddenUserIds` dəyişməz sayıla bilər — startup-da bir dəfə hesablanıb `ProtectedAccountPolicy` ətrafında saxlanıla bilər.

---

## 🟠 Medium

### 2. Cascade soft-delete tranzaksiyasızdır

**Fayllar:** `QuizService.cs:305-333` (`DeleteCategoryAsync`), `AdminService.cs:351-379` (`DeleteExamAsync`)

Hər ikisi eyni pattern-i təkrarlayır: əvvəl kateqoriya `IsDeleted = true` edilir, **sonra** ayrıca `Update` çağırışı ilə sualları silir. Arada `lock` da yoxdur, `BeginTrans` da:

```csharp
_db.QuizCategories.Update(category);          // 1-ci yazı
var questions = _db.QuizQuestions.Find(...);  // 2-ci yazı ayrı əməliyyatdır
_db.QuizQuestions.Update(questions);
```

**Nəticə:** proses birinci və ikinci yazı arasında dayansa, kateqoriya silinmiş, sualları isə canlı qalır. `GetQuestionsAsync` yalnız `!q.IsDeleted` yoxladığı üçün həmin suallar `GET /api/quiz/questions?categoryId=X` ilə hələ də oxunur və `POST /api/quiz/submit` ilə cavablandırıla bilir — silinmiş kateqoriyanın sualları ballara təsir etməyə davam edir.

Bu, `SENIOR-RULES §5.2`-nin "multi-document invariants use `BeginTrans/Commit/Rollback`" qaydasının birbaşa pozuntusudur.

**Fix:** hər iki metodu `lock (_db.QuizSyncRoot) { BeginTrans → iki yazı → Commit }` içinə al (`EnforceSingleAdministrator` şablonu ilə eyni).

### 3. Sinfə tələbə əlavəsi — lost update

**Fayl:** `Kiberaz.Infrastructure/Services/UserService.cs:348-389`

`teacherClass.Students.Add(...)` + `_db.TeacherClasses.Update(teacherClass)` heç bir gate altında deyil. LiteDB `Update` bütün sənədi əvəz edir, ona görə eyni sinfə iki paralel əlavə edildikdə ikincisi birincinin yazdığı tələbəni səssizcə silir. Müqayisə üçün: `CreateTeacherClassAsync` (sətir 323) məhz bu səbəbdən `lock (_db.UsersSyncRoot)` istifadə edir.

Əlavə olaraq **sinif ölçüsü limitsizdir** — imtahan sessiyasında 500 iştirakçı limiti var (`ExamSessionService.cs:98`), sinifdə isə yoxdur. Hər `MapToTeacherClassResponseAsync` çağırışı hər tələbə üçün statistika hesabladığı üçün böyük sinif cavabı da, yükü də şişirdir.

**Fix:** `lock (_db.UsersSyncRoot)` altında sinfi **yenidən oxu → dəyiş → yaz**; `Students.Count` üçün limit qoy (məs. 200).

### 4. Refresh token reuse detection yoxdur

**Fayl:** `Kiberaz.Infrastructure/Services/AuthService.cs:232-296`

Rotation düzgün işləyir: hər yeniləmədə yeni token verilir, köhnəsi hash müqayisəsindən keçmir. Amma **köhnə tokenin təkrar təqdim edilməsi sadəcə rədd olunur** — sessiya ləğv edilmir.

Ssenari: hücumçu refresh tokeni oğurlayır və istifadə edir. Qurban növbəti dəfə öz köhnə tokeni ilə gəlir → "Etibarsız client sorğusu" alır və yenidən daxil olur. Bu anda sistem oğurluğun baş verdiyini **bilir** (etibarlı imzalı access token + uyğun gəlməyən refresh token), amma hücumçunun aktiv sessiyasına toxunmur.

İkinci məsələ: hər yeniləmə `RefreshTokenExpiryTime = UtcNow.AddDays(7)` qoyur — mütləq sessiya limiti yoxdur, yəni oğurlanmış sessiya sonsuz uzadıla bilər (yalnız parol/rol dəyişikliyi `SecurityStamp` vasitəsilə onu öldürür).

**Fix:** access token principal-ı etibarlı, refresh token isə uyğun gəlmirsə — həmin hesabın `SecurityStamp`-ını yenilə və `RefreshToken`-i sıfırla (bütün sessiyaları öldür). Əlavə olaraq `AbsoluteExpiry` sahəsi saxlanılıb, məsələn 30 gündən sonra yenilənməni dayandır.

### 5. Validator olmayan DTO səssizcə keçir

**Fayl:** `Kiberaz.Api/Filters/ValidationFilter.cs:31` — `if (validator == null) continue;`

Filter DI-da `IValidator<T>` tapmadıqda arqumenti **yoxlamadan buraxır**. Validator-u olmayan request DTO-ları:

| DTO | Endpoint | Servisdə yoxlanır? |
|---|---|---|
| `ConfirmEmailRequest` | `POST /api/auth/confirm-email` | ❌ uzunluq limiti yoxdur |
| `GoogleLoginExchangeRequest` | `POST /api/auth/google/exchange` | ❌ uzunluq limiti yoxdur |
| `ConfirmEmailChangeRequest` | `POST /api/user/confirm-email-change` | ❌ uzunluq limiti yoxdur |
| `CreateTeacherClassRequest` | `POST /api/user/teacher/classes` | ✅ servisdə (ad ≤ 80) |
| `AddStudentToClassRequest` | `.../students` | ⚠️ yalnız boşluq yoxlanır |
| `CreateExamRequest` | `POST /api/exam-sessions` | ✅ servisdə (tam hüdudlar) |
| `JoinExamRequest` | `POST /api/exam-sessions/join` | ✅ servisdə (format) |
| `SaveExamAnswerRequest` | `PUT .../answer` | ✅ servisdə |

İlk üçündə istənilən uzunluqda sətir birbaşa Identity token yoxlamasına və LiteDB axtarışına düşür. Kritik deyil (Identity token-i etibarsız sayacaq), amma hüdudsuz giriş qayda ilə ziddiyyətdədir və CPU-nu boş yerə yandırır.

**Fix:** həmin üç DTO üçün validator əlavə et (`UserId` ≤ 64, `Token` ≤ 2048, `Code` ≤ 128, `NewEmail` — `EmailAddress()`). Uzunmüddətli həll: `ValidationFilter`-in "validator yoxdursa keç" davranışını ən azı `[FromBody]` arqumentləri üçün loglamaq.

### 6. Token istehlak edən endpoint-lər zəif limitdədir

**Fayl:** `Kiberaz.Api/Controllers/UserController.cs:108-125`

`GET/POST /api/user/confirm-email-change` `[AllowAnonymous]`-dur və sinif səviyyəli `general` (60/dəq) altındadır. Data Protection tokeni istehlak edən bütün digər endpoint-lər (`confirm-email`, `forgot-password`, `reset-password`, `resend-confirmation`) `sensitive` (5/dəq) istifadə edir. Bu ikisi qaydadan kənarda qalıb — `SENIOR-RULES §4.6`.

**Fix:** hər ikisinə `[EnableRateLimiting("sensitive")]`.

### 7. Dağıdıcı admin əməliyyatları `general` altındadır

**Fayl:** `Kiberaz.Api/Controllers/AdminController.cs:83` (`DELETE /courses/{id}`), `:129` (`DELETE /exams/{id}`)

`DELETE /api/admin/exams/{id}` bir kateqoriyanı **və onun bütün suallarını** soft-delete edir (yuxarıda 2-ci tapıntı). Bu, 60/dəq limitli endpoint-dir. Qayda: e-poçt göndərən, kredensial dəyişən, fayl yazan və ya dağıdıcı əməliyyatlar `general` olmamalıdır.

**Fix:** hər iki `DELETE` üçün `[EnableRateLimiting("sensitive")]`.

---

## 🟡 Low

**8. `GET /api/auth/me` zərfsizdir** — `AuthController.cs:278-288` `return Ok(new { userId, email, firstName, lastName })`. Bütün digər endpoint-lər `ApiResponse<T>` qaytarır; frontend bu bir endpoint üçün ayrıca forma saxlamalı olur. Cavabda `roles` da yoxdur.

**9. Rol string literal-ları** — `ExamSessionsController.cs:27, 35, 54, 58`-də `[Authorize(Roles = "Teacher")]`. Layihənin qalan hissəsi `AppRoles.Teacher` işlədir (`UserController.cs:149`). Yazı səhvi kompilyatorda yox, işləmə zamanı 403 kimi üzə çıxar.

**10. Sənədləşmə yoxdur** — `ExamSessionsController`-in doqquz endpoint-inin heç birində `[ProducesResponseType]` və ya XML doc yoxdur. Swagger-də cavab formaları görünmür.

**11. Kolleksiya kontekstdən kənarda yaradılır** — `QuizService.cs:153`: `_db.Database.GetCollection<BsonDocument>("QuizScoreClaims")`. Bu kolleksiya `LiteDbContext`-də elan olunmayıb, `ConfigureIndexes()`-də indeksi yoxdur, sxem baxışında görünmür. Məntiq düzgündür (bir sual = bir bal, `_id` unikallığı ilə), amma yeri səhvdir.

**12. Exam gate-i uzun tutulur** — `ExamSessionService.cs:26-28` → `Available()` (`:169-180`) hər kateqoriya üçün `QuizQuestions`-u iki dəfə skan edir və hər sual mətnini Unicode normalizasiyadan keçirir. `GetCategories()` bunu **hər kateqoriya üçün ayrıca** çağırır, üstəlik hamısı `Atomic()` içindədir — yəni `ExamSyncRoot` kilidi tutulur. Müəllim bu endpoint-i çağırdıqca tələbələrin `SaveAnswer` yazıları gözləyir. Fix: `exposed` çoxluğunu bir dəfə hesabla və `Available`-a parametr kimi ötür.

**13. Limitsiz kurs siyahısı** — `CourseController.cs:62` → `GetApprovedCoursesAsync()` bütün təsdiqlənmiş kursları qaytarır. Hazırda kiçikdir, amma paging yoxdur.

**14. Dashboard-da tam istifadəçi skanı** — `ExamSessionService.cs:141-144`: admin ID-lərini tapmaq üçün `db.Users.FindAll()`. Nəticə düzgündür (admin gizlədilir ✅), üsul bahalıdır.

**15. Refresh token body-də** — `AuthController.cs:251-259` cookie yoxdursa `request.RefreshToken`-i qəbul edir. Kod şərhi bunu mobil müştərilər üçün qəsdən edildiyini yazır, amma `SENIOR-RULES §4.2` "never a JSON body" deyir. İki variant: ya body yolunu sil, ya da qaydaya istisna kimi yaz — hazırda kod və qayda ziddiyyətdədir.

---

## Yoxlanılıb və təmiz çıxan sahələr

Bunlar xüsusi olaraq axtarıldı və problem tapılmadı:

- **Tək admin invariantı** — `ChangeAccount` aktoru həm rol, həm e-poçt üzrə yoxlayır (`AdminService.cs:418`), `OnTokenValidated` hər sorğuda təkrar yoxlayır (`Program.cs:165-172`), startup-da baza təmizlənir. Gizlətmə `GetUsersAsync`, `GetStatsAsync`, `GetExamsAsync`, `GetLeaderboardAsync`, `GetDashboard`, tələbə axtarışı və sinfə əlavədə tətbiq olunub.
- **Client-controlled ölçülər** — `QuizController` `count`/`limit` üçün `Math.Clamp` (`:67`, `:90`), `AdminService.GetUsersAsync` `take` üçün `Math.Clamp(take, 1, 100)` (`:161`).
- **IDOR** — `OwnedAttempt` / `OwnedSession` (`ExamSessionService.cs:210-227`), `DeleteTeacherClassAsync` `TeacherId` şərti ilə, `GetStudentOverviewAsync` sinif üzvlüyü yoxlaması. Hamısı "tapılmadı" qaytarır, mövcudluq sızmır.
- **İmtahan sual bankının izolyasiyası** — public quiz yolları `!q.IsExamOnly` filtrləyir; `Available()` üstəlik açıq bankda eyni mətnli sualı çıxarır.
- **Fayl yükləmə** — imza (magic bytes) yoxlaması, real bayt sayğacı, kvota gate-i, Guid ad, PDF ayrıca prosesdə `SafePdf` ilə yenidən yazılır, endpoint `upload` (5/dəq) altındadır, PDF statik servisdən çıxarılıb.
- **Login enumeration & timing** — istifadəçi tapılmasa da dummy hash yoxlanılır (`AuthService.cs:165`), mesajlar eynidir, cəhdlər həm e-poçt, həm IP açarı ilə sayılır.
- **Exam servisində konkurensiya** — `Atomic()` kilid + tranzaksiya, içəridə heç bir `await` yoxdur (qayda §5.2 ✅).
- **Rate limiter yerləşməsi** — `UseAuthentication` → `UseRateLimiter` → `UseAuthorization`, qlobal zəncir hesab + xam IP üzrə (`Program.cs:245-263`).

---

## Təklif olunan iş sırası

1. **1-ci tapıntı** (leaderboard keşi) — ictimai səth, ən yüksək təsir.
2. **2 və 3** (tranzaksiya + gate) — data bütövlüyü, hər ikisi kiçik dəyişiklikdir.
3. **6 və 7** (rate limit atributları) — hər biri bir sətir.
4. **4** (reuse detection) — auth axınına toxunur, ayrıca commit və test tələb edir.
5. **5** (validator-lar) — mexaniki.
6. Low-lar — təmizlik commit-i.

Hər biri ayrı commit: `security(quiz): cache leaderboard aggregation`, `fix(quiz): wrap category cascade delete in a transaction`, və s.
