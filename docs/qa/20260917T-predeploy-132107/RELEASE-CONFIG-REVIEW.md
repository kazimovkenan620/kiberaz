# Nəşr paketi və konfiqurasiya baxışı — 17.09.2026

## Nəticə

**REL-CFG-01 — P1 / yüksək prioritet:** yoxlanılan publish paketində lokal məxfi konfiqurasiya faylı var. **ARTIFACT_CONFIRMED**, etibar yüksək. Bu paket təmiz release artefaktı kimi təsdiqlənmir; məxfi konfiqurasiyanın paketə düşməsi aradan qaldırılmadan onun paylaşılması/deploy-a daşınması məqbul deyil. İctimai HTTP sızması, credential etibarlılığı və ya istismar yoxlanmayıb və iddia edilmir.

**REL-RT-01 — P1 release önşərti / yüksək etibar:** bu kompüterdə .NET 9 runtime patch-i 9.0.0-dır; 17.09.2026 üzrə cari patch 9.0.20-dir. Production serverin runtime versiyası bu baxışda müəyyən edilməyib. .NET 9-un özü hələ dəstəklənir, amma cari patch səviyyəsi saxlanmalıdır.

Bu follow-up yalnız mövcud publish fayllarının metadata/hash/key-presence baxışı, mənbə oxunuşu, `dotnet --list-runtimes` və artıq yaradılmış QA nəticələrinin müqayisəsidir. Yeni publish/build, API çağırışı, DB açılması, tətbiq startı, konfiqurasiya və production koduna dəyişiklik edilməyib. Yalnız bu hesabat yazılıb. Sirlər, həqiqi email, secret dəyərləri və onların hash-ləri hesabatda saxlanılmır.

## Artefakt sübutu

- Yoxlanılan qovluq: `C:/Users/User/AppData/Local/Temp/20260917T-predeploy-132107/publish`.
- `appsettings.Local.json` mövcuddur; ölçüsü **1332 bayt**.
- Mənbə `Kiberaz.Api/appsettings.Local.json` mövcuddur.
- İki fayl üçün SHA-256 bərabərlik müqayisəsi: **true**. Hash dəyərləri çıxarılmayıb.
- Publish log `evidence/backend-publish.txt` `EXIT=0` göstərir. Uğurlu compile/publish təhlükəsiz paket tərkibi zəmanəti deyil.

| Publish faylı | Bayt | Şərh |
|---|---:|---|
| appsettings.json | 1031 | baza konfiqurasiyası |
| appsettings.Development.json | 1062 | development konfiqurasiyası paketdədir |
| appsettings.Local.example.json | 1078 | nümunə də paketdədir |
| appsettings.Local.json | 1332 | source ilə byte məzmun hash bərabərliyi təsdiqlənib |
| appsettings.Production.json | 3946 | production konfiqurasiyası |
| Kiberaz.Api.runtimeconfig.json | 488 | net9.0, framework-dependent müqaviləsi |
| Kiberaz.Api.deps.json | 24690 | dependency metadata |
| web.config | 555 | host konfiqurasiya faylı |

Lokal JSON-un yalnız açar adları və boş olmaması çıxarılıb. Bunlar **dəyərin real/işlək məxfi açar olduğunu təsdiqləmir**:

| Açar | Boş deyil |
|---|---|
| JwtSettings:SecretKey | bəli |
| Authentication:Google:ClientId | bəli |
| Authentication:Google:ClientSecret | bəli |
| EmailSettings:SmtpHost | bəli |
| EmailSettings:SmtpPort | bəli |
| EmailSettings:FromEmail | bəli |
| EmailSettings:FromName | bəli |
| EmailSettings:SmtpUsername | bəli |
| EmailSettings:SmtpPassword | bəli |
| EmailSettings:ApiBaseUrl | bəli |
| FrontendUrl | bəli |
| Captcha:SecretKey | bəli |

## Koddan çıxan production təsiri

1. `Kiberaz.Api/Program.cs:36–39`: builder yaradıldıqdan sonra `appsettings.Local.json` bütün mühitlərdə optional və reloadOnChange=true ilə əlavə olunur. Ardınca environment və command-line provider-ləri əlavə edilir. Nəticə: env/CLI konkret açarı versə üstün gəlir; verməsə local faylın dəyəri işləyə bilər. Local fayl production JSON-dan sonra yükləndiyi üçün yalnız production JSON-un düzgün olması kifayət deyil.
2. `Kiberaz.Api/Kiberaz.Api.csproj:1–37` Web SDK istifadə edir və local JSON üçün explicit publish exclusion yoxdur. Faktiki publish çıxışında local faylın olması artıq müşahidə edilib; yalnız .gitignore qaydası onu publish-dən çıxarmır.
3. `Program.cs:80–84` JWT yoxlaması açarın olmaması, 32 baytdan qısa olması və müəyyən development prefix-i üçün fail-fast edir. Arbitrary doldurulmuş local dəyərin production-a uyğun environment sirri olduğunu bu check sübut etmir.
4. `CaptchaService.cs:40–69` Development xaricində boş/test key/bypass-a fail-closed davranır. Bu yaxşı qoruma local məxfi faylın release paketində olmasını aradan qaldırmır. Açarların burada test/real sinifləndirilməsi edilməyib.
5. `Program.cs:609–637`: rol seed, single-admin enforcement, flag/block/upload backfill-ləri CAPTCHA readiness yoxlamasından əvvəl icra olunur. Ona görə yalnız CAPTCHA fail-fast nəticəsini görmək üçün production start etmək belə DB-də heç nə dəyişməyəcəyinə zəmanət vermir. Bu baxışda start edilməyib.
6. Həmin fayl normal `wwwroot` daxilində deyil. `UseStaticFiles()` istifadəsi onu avtomatik ictimai fayla çevirmir. İnternetdən `GET appsettings.Local.json` ilə sızma iddiası üçün sübut yoxdur. Təsdiqlənən sərhəd publish paketinin və onun saxlanması/daşınmasıdır.

Kalibrasiya: yüksək prioritet release blocker, çünki eyni lokal məxfi konfiqurasiya development cihazından deploy artefaktına köçürülür və production provider zəncirinə daxil ola bilir. Critical/hesab ələkeçirmə iddiası yoxdur. Arzu olunan düzəliş (bu auditdə tətbiq edilməyib): local secret JSON üçün publish exclusion və paket tərkibi assertion-u; production env/secret-store dəyərləri; təmiz publish-dən təkrar hash/presence yoxlaması. Əgər əvvəlki paketlərin etibarsız tərəflərə verildiyi ayrıca təsdiqlənərsə, yalnız o sübuta əsasən müvafiq açar rotasiyası planlanmalıdır.

## Runtime dəstək yoxlaması

17.09.2026 tarixində Microsoft-un [rəsmi .NET dəstək siyasəti](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core) .NET 9 üçün 9.0.20 (08.09.2026), Maintenance və dəstəyin sonu 10.11.2026 göstərir. Siyasət dəstək müddətində cari patch-də qalmağı tələb edir. [08.09.2026 yeniləmə bildirişi](https://support.microsoft.com/en-us/servicing/dotnet/net-9/2026/net-9-0-update-september-8-2026) bu yeniləmədə təhlükəsizlik düzəlişləri olduğunu bildirir. Burada konkret CVE-nin tətbiqdə istismar edilə bilməsi araşdırılmayıb.

`dotnet --list-runtimes` bu kompüterdə Microsoft.NETCore.App və Microsoft.AspNetCore.App üçün 9.0.0 göstərdi; 9.0.20 görünmədi. Paralel 8.0.31/10.0.12 quraşdırılması 9.0 tətbiqinin 9.0 patch səviyyəsini öz-özünə sübut etmir. `Kiberaz.Api.runtimeconfig.json` framework versions 9.0.0 və tfm net9.0 göstərir; bu minimal framework metadata-sıdır, faktiki production prosesinin həmişə 9.0.0 istifadə edəcəyi demək deyil. Yeni 9.0 patch quraşdırılan hostun aktual runtime seçimi ayrıca yoxlanmalıdır. Major arxitektura dəyişikliyi bu auditdə təklif edilən patch düzəlişindən ayrı qərardır.

## Endpoint inventarı ilə runtime sübutlarının müstəqil tutuşdurulması

Aşağıdakı xəritə **yalnız mövcud `api-requests.json` snapshot-ında route çağırışının olub-olmamasını** göstərir. Runtime testin PASS olması həmin route üçün bütün role/state/error kombinasiyalarını yoxlamır. 401/403-only çağırış endpoint-in uğurlu biznes axınının işlədiyi demək deyil. Main QA matrisi dəyişdirilməyib.

ID ehtiyatı: BACKEND-INVENTORY.md-də API-001 admin stats, runtime nəticədə API-001 isə health deməkdir. Bu cədvəldə inventar ID-si `INV/API-xxx`, test ID-si `RUN/...` ilə fərqləndirilir. Eyni string-i mənbə sənədi olmadan birləşdirmək yanlış coverage yaradır. API inventarının əvvəlki NOT_RUN qeydi onun hazırlanma anındakı statik subtask sərhədidir; sonrakı runtime sübutları aşağıda ayrıdır.

Snapshot: 2026-09-17T13:33:17.5291080+04:00; requests=99; runtime test sətri=28.

| İnventar ID | Metod / route | Çağırış sayı | HTTP statuslar | Əlaqəli runtime ssenari / status |
|---|---|---:|---|---|
| INV/API-001 | `GET /api/Admin/stats` | 2 | 401,403 | RUN/API-002 PASS; RUN/API-003 PASS |
| INV/API-002 | `GET /api/Admin/courses` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-003 | `POST /api/Admin/courses` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-004 | `PATCH /api/Admin/courses/{id:int}/approve` | 1 | 200 | RUN/API-008-FINAL PASS |
| INV/API-005 | `PATCH /api/Admin/courses/{id:int}/reject` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-006 | `PUT /api/Admin/courses/{id:int}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-007 | `PATCH /api/Admin/courses/{id:int}/revision/approve` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-008 | `PATCH /api/Admin/courses/{id:int}/revision/reject` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-009 | `DELETE /api/Admin/courses/{id:int}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-010 | `GET /api/Admin/users` | 1 | 200 | RUN/API-009 PASS |
| INV/API-011 | `POST /api/Admin/users/{userId}/vip-term` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-012 | `GET /api/Admin/users/{userId}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-013 | `PUT /api/Admin/users/{userId}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-014 | `DELETE /api/Admin/users/{userId}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-015 | `PATCH /api/Admin/users/{userId}/role` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-016 | `PATCH /api/Admin/users/{userId}/block` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-017 | `GET /api/Admin/exam-sessions` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-018 | `GET /api/Admin/exam-sessions/{id}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-019 | `GET /api/Admin/audit` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-020 | `POST /api/auth/register` | 2 | 400 | RUN/API-012 PASS |
| INV/API-021 | `POST /api/auth/confirm-email` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-022 | `POST /api/auth/resend-confirmation` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-023 | `POST /api/auth/forgot-password` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-024 | `POST /api/auth/reset-password` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-025 | `GET /api/auth/google` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-026 | `GET /api/auth/google-callback` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-027 | `POST /api/auth/google/exchange` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-028 | `POST /api/auth/login` | 18 | 200,401 | RUN/AUTH-LOGIN-01 PASS; RUN/AUTH-LOGIN-02 PASS; RUN/AUTH-LOGIN-03 PASS; RUN/AUTH-LOGIN-04 PASS; RUN/AUTH-LOGIN-05 PASS; RUN/AUTH-LOGIN-06 PASS; RUN/AUTH-LOGIN-07 PASS; RUN/AUTH-LOGIN-08 PASS; RUN/AUTH-LOGIN-09 PASS; RUN/AUTH-STATE-Unconfirmed PASS; RUN/AUTH-STATE-Blocked PASS |
| INV/API-029 | `POST /api/auth/logout` | 1 | 200 | RUN/API-014 PASS |
| INV/API-030 | `POST /api/auth/logout-all` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-031 | `POST /api/auth/refresh` | 1 | 400 | RUN/API-014 PASS |
| INV/API-032 | `GET /api/auth/me` | 18 | 200,401 | RUN/AUTH-LOGIN-01 PASS; RUN/AUTH-LOGIN-02 PASS; RUN/AUTH-LOGIN-03 PASS; RUN/AUTH-LOGIN-04 PASS; RUN/AUTH-LOGIN-05 PASS; RUN/AUTH-LOGIN-06 PASS; RUN/AUTH-LOGIN-07 PASS; RUN/AUTH-LOGIN-08 PASS; RUN/AUTH-LOGIN-09 PASS; RUN/API-010 PASS; RUN/API-014 PASS |
| INV/API-033 | `POST /api/Course` | 2 | 200,402 | RUN/API-008 FAIL; RUN/API-008-R FAIL |
| INV/API-034 | `GET /api/Course` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-035 | `GET /api/Course/{id:int}` | 2 | 200,404 | RUN/API-008-FINAL PASS |
| INV/API-036 | `GET /api/Course/vip-status` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-037 | `GET /api/Course/mine` | 1 | 200 | RUN/API-008-FINAL PASS |
| INV/API-038 | `PUT /api/Course/{id:int}` | 1 | 404 | RUN/API-008-FINAL PASS |
| INV/API-039 | `DELETE /api/Course/{id:int}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-040 | `POST /api/Course/{id:int}/reactivate` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-041 | `GET /api/exam-sessions/categories` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-042 | `GET /api/exam-sessions/mine` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-043 | `POST /api/exam-sessions` | 2 | 200,403 | RUN/API-003 PASS; RUN/API-007 PASS |
| INV/API-044 | `POST /api/exam-sessions/join` | 2 | 200 | RUN/API-007 PASS |
| INV/API-045 | `GET /api/exam-sessions/attempts/{id}` | 1 | 404 | RUN/API-007 PASS |
| INV/API-046 | `PUT /api/exam-sessions/attempts/{id}/answer` | 6 | 200,404,409 | RUN/API-007 PASS |
| INV/API-047 | `POST /api/exam-sessions/attempts/{id}/submit` | 2 | 200 | RUN/API-007 PASS |
| INV/API-048 | `GET /api/exam-sessions/{code}/dashboard` | 2 | 200,404 | RUN/API-007 PASS |
| INV/API-049 | `POST /api/exam-sessions/{code}/close` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-050 | `GET /api/Quiz/categories` | 1 | 200 | RUN/API-004 PASS |
| INV/API-051 | `GET /api/Quiz/questions` | 3 | 200,400 | RUN/API-004 PASS |
| INV/API-052 | `GET /api/Quiz/leaderboard` | 1 | 200 | RUN/API-009 PASS |
| INV/API-053 | `POST /api/Quiz/submit` | 3 | 200,401 | RUN/API-002 PASS; RUN/API-005 PASS |
| INV/API-054 | `POST /api/Quiz/categories` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-055 | `GET /api/Quiz/admin/categories` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-056 | `POST /api/Quiz/categories/{id:int}/restore` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-057 | `PUT /api/Quiz/categories/{id:int}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-058 | `GET /api/Quiz/admin/questions` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-059 | `PUT /api/Quiz/questions/{id:int}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-060 | `POST /api/Quiz/questions/{id:int}/restore` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-061 | `DELETE /api/Quiz/categories/{id:int}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-062 | `POST /api/Quiz/questions` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-063 | `DELETE /api/Quiz/questions/{id:int}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-064 | `GET /uploads/syllabus/{fileName}` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-065 | `POST /api/Upload/photo` | 6 | 200,400,403 | RUN/API-013 FAIL; RUN/API-013-R PASS |
| INV/API-066 | `POST /api/Upload/syllabus` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-067 | `PATCH /api/User/role` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-068 | `GET /api/User/profile` | 3 | 200,401 | RUN/API-002 PASS; RUN/API-010 PASS |
| INV/API-069 | `PUT /api/User/profile` | 1 | 200 | RUN/API-010 PASS |
| INV/API-070 | `POST /api/User/profile/change-email` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-071 | `POST /api/User/profile/request-password-change` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-072 | `POST /api/User/confirm-email-change` | 0 | NOT_RUN | Bu snapshot-da sübut yoxdur |
| INV/API-073 | `GET /api/User/me/overview` | 2 | 200 | RUN/API-005 PASS |
| INV/API-074 | `GET /api/User/students/{studentId}/overview` | 2 | 200,400 | RUN/API-006 PASS |
| INV/API-075 | `GET /api/User/teacher/classes` | 3 | 200,401,403 | RUN/API-002 PASS; RUN/API-003 PASS; RUN/API-006 PASS |
| INV/API-076 | `POST /api/User/teacher/classes` | 1 | 200 | RUN/API-006 PASS |
| INV/API-077 | `POST /api/User/teacher/classes/{classId:int}/students` | 2 | 200,400 | RUN/API-006 PASS |
| INV/API-078 | `DELETE /api/User/teacher/classes/{classId:int}` | 1 | 400 | RUN/API-006 PASS |
| INV/API-079 | `GET /health` | 1 | 200 | RUN/API-001 PASS |

Route səviyyəsində müşahidə: 32/79. Qalan 47 route üçün bu API snapshot-da çağırış sübutu yoxdur. Bu nisbət test keyfiyyəti və ya release keçid faizi deyil.
