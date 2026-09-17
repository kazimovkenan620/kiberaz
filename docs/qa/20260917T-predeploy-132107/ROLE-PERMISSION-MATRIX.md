# Rol və icazə matrisi — statik, NOT_RUN

Bu matrisa backend mənbə kodunun cari kontraktıdır. İcazələr runtime yoxlanmayıb. Qonaq = tokensiz; User tələbə hesabının real rol adıdır, ayrıca Student rolu yoxdur. Moderator ayrıca sabit rol olsa da bu controller-lərdə xüsusi moderator endpoint səlahiyyəti tapılmayıb. Admin superuser kimi Teacher/VIP rol atributlarını avtomatik keçmir; tək administrator invariantı var.

`İ` = icazəli (resurs/servis şərti qala bilər); `401` = etibarlı autentifikasiya yoxdur; `403` = rol rəddi; `Öz` = yalnız claim-ə uyğun sahiblik; `Ş` = aşağıda şərt. Statuslar gözlənilən müqavilədir, test nəticəsi deyil.

| Əməliyyat / API ID | Qonaq | User | Teacher | VIP | Moderator | Admin/sahib |
|---|---|---|---|---|---|---|
| Public course/quiz/leaderboard/PDF/health: 034,035,050–052,064,079 | İ | İ | İ | İ | İ | İ |
| Register/confirmation/forgot/reset/Google: 020–027 | İ | İ | İ | İ | İ | İ; məqsədli token/validation tələb olunur |
| Login 028 | İ | İ | İ | İ | İ | İ; hesab vəziyyəti şərti |
| Refresh 031 | Ş cookie/body token | Ş | Ş | Ş | Ş | Ş |
| Me/profile/logout/logout-all: 029,030,032,068 | 401 | Öz | Öz | Öz | Öz | Öz |
| Profile update/email/password-change: 069–071 | 401 | Öz | Öz | Öz | Öz | Profil/password-change öz hesabına açıq; email-change sahib üçün rədd (B-S10) |
| Email-change confirmation 072 | Ş məqsədli token | Ş | Ş | Ş | Ş | Ş |
| Self-role switch 067 | 401 | User/Teacher | User/Teacher; sinif yoxdursa | rədd | yalnız User/Teacher seçimi; mövcud Moderator davranışı servisə görə ayrıca sınaq | rədd |
| Own overview 073 | 401 | Öz | Öz | Öz | Öz | Öz |
| Teacher overview/classes: 074–078 | 401 | 403 | Öz sinifləri/bağlı tələbə | 403 | 403 | 403 |
| Course create/reactivate 033,040 | 401 | 403 | 403 | Ş aktiv term+kredit; reactivate öz expired təlim | 403 | 403 |
| Course vip-status/mine 036,037 | 401 | Öz | Öz | Öz | Öz | Ş |
| Course edit/delete 038,039 | 401 | Öz | Öz | Öz | Öz | Ş sahib hesab owner service-də rədd; admin ayrıca route istifadə edir |
| Exam categories 041 | 401 | 403 | 403 | İ (aktiv term tələb edilmir) | 403 | 403 |
| Exam create 043 | 401 | 403 | 403 | Ş aktiv term+quota+private bank | 403 | 403 |
| Exam mine 042 | 401 | Öz | Öz | Öz+quota | Öz | boş sessions/attempts, quota null |
| Exam join 044 | 401 | İ | İ | İ; öz host sessiyası olmaz | İ | 403 |
| Exam attempt/answer/submit 045–047 | 401 | Öz | Öz | Öz | Öz | 403 |
| Exam dashboard/close 048,049 | 401 | 403 | 403 | Öz; term bitibsə də rol qaldıqca | 403 | 403 |
| Quiz submit 053 | 401 | İ | İ | İ | İ | İ; Admin üçün QuizResults bal yazısı edilmir |
| Admin panel/data/mutations 001–019 | 401 | 403 | 403 | 403 | 403 | İ, qorunan hədəf şərtləri |
| Quiz bank idarəsi 054–063 | 401 | 403 | 403 | 403 | 403 | İ |
| Upload 065,066 | 401 | 403 | 403 | İ; owner/kvota/type | 403 | İ; owner/kvota/type |

## Şərtlər və status oraklları

- Bütün JWT-lər üçün `Program.cs` OnTokenValidated: hesabın mövcudluğu, email confirmation, lockout, security stamp, canlı rollar və single-admin invariantı; köhnəlmiş rol tokeni endpoint-in öz 403-ünə çatmamış 401 ola bilər. Matrix təzə etibarlı token fərziyyəsinə əsaslanır.
- Admin kurs/user/quiz/audit əməliyyatları ümumi admin funksiyalarıdır; Moderator üçün miras səlahiyyət yoxdur. İcazəli admin rol hədəfləri Moderator, VIP, User, Teacher (`AdminService:839`); Admin verilə bilməz.
- Foreign Course update/delete/reactivate: 404 (`CourseService:260`). Foreign ExamAttempt GET/save/submit: 404 (`ExamSessionService:272`). Foreign VIP dashboard/close: 404 (`ExamSessionService:264`). Müəllimin foreign sinif/bağlanmamış overview səhvi `ApiResponse.Fail` controller-də 400 olur, 404 deyil (`UserController:149–217`, `UserService:246–274,382–386,429–433`).
- Teacher sinif üzvlüyü tələbənin razılıq endpoint-i ilə deyil, müəllimin bildiyi user id ilə yaranır. Teacher/hidden hədəf tələbə kimi əlavə edilmir (`UserService:367–369`). Teacher roster ad/soyad/id/quiz summary daşıyır; public leaderboard yalnız nickname proyeksiyasıdır.
- Public course yalnız Approved, !IsDeleted və bitməmiş məzmundur. MyCourse moderation/revision məlumatını yalnız sahibə qaytarır; AdminCourse geniş daxili görünüşdür. Private bank cavab açarı admin bank görünüşündə qanunidir, iştirakçı ExamAttempt DTO-da yoxdur.
- VIP term yoxdursa yeni imtahan 403; credit yoxdursa yeni/reactivated course 402. Hostun mövcud imtahan dashboard/close hüququ üçün aktiv term tələb olunmur, VIP rolu tələb olunur (`ExamSessionService:239–249`).
- Qapalı sessiyaya yeni join 409; mövcud iştirakçı təkrar join əvvəlki attempt-i ala bilər. Hostun öz sessiyasına ilk join 400; Admin join 403. Limit: 7 sessiya/UTC gün, 50 açıq sessiya, 500 iştirakçı; quota dolu create 429, açıq/iştirakçı limiti 409.
- Role dəyişikliyi sessiyaları ləğv edir. Teacher→User üçün siniflərin silinməsi şərtdir. VIP self-switch rədd edilir. Admin vip-term keçidi varsa Teacher sinifləri əvvəl silinməlidir; normal grant `[VIP]` ilə rolu əvəz edir (`AdminService:583–598`).
- Admin sahibi user siyahısı/statistika/leaderboard/teacher roster/participant görünüşlərindən çıxarır. Profil sahibi öz Auth/profile məlumatını görməsi bu gizlətmə invariantına zidd deyil. Gizli hesabın id/email/stamp/hash/tokeni QA sübutlarına köçürülməməlidir.

## Təklif olunan mənfi icazə paketi — hamısı NOT_RUN

| Test ID | Minimal fixture | Çağırış / gözlənti |
|---|---|---|
| API-R01 | qonaq | profil→401; admin→401; public quiz→200 |
| API-R02 | User,Teacher,Moderator,VİP ayrı tokenlər | admin stats/users/audit→403; refresh-invalid qarışdırılmadan |
| API-R03 | USER_A,USER_B + USER_A attempt | B ilə attempt GET/answer/submit→404; A nəticəsi dəyişməz |
| API-R04 | VIP_A,VIP_B + A sessiyası | B dashboard/close→404; A panelinə təsir yoxdur |
| API-R05 | TEACHER_A,TEACHER_B + A sinfi | B add/delete→400; A roster dəyişməz |
| API-R06 | Teacher + bağlı/bağlanmamış User | bağlı overview 200, bağlanmamış overview 400 |
| API-R07 | VIP_A course, USER_B | B update/delete→404; public məzmun dəyişməz |
| API-R08 | expired-term VIP | exam create→403; mövcud owned dashboard/close term bitməsindən asılı olmayaraq əlçatan |
| API-R09 | course krediti 0 olan active VIP | create/reactivate→402; VipTerms/Courses double-write yoxdur |
| API-R10 | 7 sessiyalı VIP | 8-ci create→429; UTC reset planı clock-fixture ilə yoxlanmalıdır |
| API-R11 | Teacher sinfi, User role toggle | Teacher→User və admin→VIP rədd; orphan sinif yaranmamalı |
| API-R12 | stale access token, role/grant/block dəyişməsi | köhnə token 401, yeni rol tokeni endpoint matrisi ilə uyğun |
| API-R13 | sintetik admin deyil hesab | admin grant body role=Admin→400; tək-sahib invariantı qorunur |
| API-R14 | User/VIP/Admin upload | User→403; VIP/Admin tip/kvota yoxlamasına çatır; başqa owner upload path course-a bağlanmır |
| API-R15 | known private question | public questions/category counts açarı/private sualı göstərmir; public submit private id-ni rədd edir |
| API-R16 | User known public quiz + real exam | Teacher summary public QuizResults-u göstərir; real ExamAttempts ayrıca exam history-dən gəlir |

Mənbələr: `Kiberaz.Domain/Common/AppRoles.cs`, `ExamPolicy.cs`, `VipPolicy.cs`, `Kiberaz.Api/Controllers/*.cs`, `Kiberaz.Infrastructure/Services/{UserService,AdminService,ExamSessionService,CourseService,ProtectedAccountPolicy}.cs`. Payload və fixture sahələri `BACKEND-INVENTORY.md` sənədindədir. Bu matris mövcud konfiqurasiyanın işləməsini və ya production icazələrinin faktiki nəticəsini təsdiqləmir.
