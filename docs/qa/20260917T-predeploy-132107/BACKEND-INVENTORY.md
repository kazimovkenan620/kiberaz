# Backend inventarı — 17.09.2026

Status: yalnız statik mənbə baxışı. Aşağıdakı API-xxx identifikatorları təklif olunan yoxlamalardır; hamısı **NOT_RUN**. HTTP çağırışı, tətbiq startı, build, DB açılması və dəyişdirilməsi edilməyib. Gizli konfiqurasiya oxunmayıb. Mənbələr repodakı cari controller, service, DTO, validator və domain fayllarıdır.

## Tam controller marşrut siyahısı

Cavab sütunu controller atributları və ApiResponse istifadəsindən çıxarılıb; atributu olmayan nəticə «atributda göstərilməyib» kimi saxlanır. Bütün endpoint-lərdə qlobal limiter də işləyir. JWT = təsdiqlənmiş, bloklanmamış canlı hesab və etibarlı təhlükəsizlik stampı/rolları. Public = [AllowAnonymous]. HTTP statuslarının atribut inventarı runtime nəticə zəmanəti deyil.

| ID / status | Metod və yol | Giriş / siyasət | Sorğu müqaviləsi və action | Cavab / deklarativ statuslar | Mənbə |
|---|---|---|---|---|---|
| API-001 NOT_RUN | `GET /api/Admin/stats` | Admin / general | `GetStats(gövdə yoxdur)` | `ApiResponse<AdminStatsResponse>; 200` | `AdminController.cs:50` |
| API-002 NOT_RUN | `GET /api/Admin/courses` | Admin / general | `GetCourses(gövdə yoxdur)` | `ApiResponse<List<AdminCourseResponse>>; 200` | `AdminController.cs:56` |
| API-003 NOT_RUN | `POST /api/Admin/courses` | Admin / general | `CreateCourse([FromBody] CreateAdminCourseRequest request)` | `ApiResponse<AdminCourseResponse>, ApiResponse<object>; 201/400` | `AdminController.cs:61` |
| API-004 NOT_RUN | `PATCH /api/Admin/courses/{id:int}/approve` | Admin / general | `ApproveCourse(int id)` | `ApiResponse<bool>; 200/404` | `AdminController.cs:74` |
| API-005 NOT_RUN | `PATCH /api/Admin/courses/{id:int}/reject` | Admin / general | `RejectCourse(int id)` | `ApiResponse<bool>; 200/404` | `AdminController.cs:84` |
| API-006 NOT_RUN | `PUT /api/Admin/courses/{id:int}` | Admin / sensitive | `UpdateCourse(int id, [FromBody] UpdateCourseRequest request)` | `ApiResponse<AdminCourseResponse>, ApiResponse<object>; 200/400/404` | `AdminController.cs:99` |
| API-007 NOT_RUN | `PATCH /api/Admin/courses/{id:int}/revision/approve` | Admin / general | `ApproveRevision(int id)` | `ApiResponse<bool>; 200/404` | `AdminController.cs:113` |
| API-008 NOT_RUN | `PATCH /api/Admin/courses/{id:int}/revision/reject` | Admin / general | `RejectRevision(int id)` | `ApiResponse<bool>; 200/404` | `AdminController.cs:124` |
| API-009 NOT_RUN | `DELETE /api/Admin/courses/{id:int}` | Admin / sensitive | `DeleteCourse(int id)` | `ApiResponse<bool>; 200/404` | `AdminController.cs:135` |
| API-010 NOT_RUN | `GET /api/Admin/users` | Admin / general | `GetUsers([FromQuery] string? search = null, [FromQuery] int take = 100)` | `ApiResponse<List<AdminUserResponse>>; 200` | `AdminController.cs:152` |
| API-011 NOT_RUN | `POST /api/Admin/users/{userId}/vip-term` | Admin / sensitive | `StartVipTerm(string userId)` | `ApiResponse<bool>; 200/400` | `AdminController.cs:161` |
| API-012 NOT_RUN | `GET /api/Admin/users/{userId}` | Admin / general | `GetUserDetail(string userId)` | `ApiResponse<AdminUserDetailResponse>; 200/404` | `AdminController.cs:176` |
| API-013 NOT_RUN | `PUT /api/Admin/users/{userId}` | Admin / sensitive | `UpdateUser(string userId, [FromBody] AdminUpdateUserRequest request)` | `ApiResponse<AdminUserDetailResponse>, ApiResponse<object>; 200/400` | `AdminController.cs:186` |
| API-014 NOT_RUN | `DELETE /api/Admin/users/{userId}` | Admin / sensitive | `DeleteUser(string userId)` | `ApiResponse<bool>; 200/400` | `AdminController.cs:202` |
| API-015 NOT_RUN | `PATCH /api/Admin/users/{userId}/role` | Admin / general | `ChangeUserRole(string userId, [FromBody] AdminChangeUserRoleRequest request)` | `ApiResponse<bool>; 200/400` | `AdminController.cs:212` |
| API-016 NOT_RUN | `PATCH /api/Admin/users/{userId}/block` | Admin / general | `ToggleUserBlock(string userId)` | `ApiResponse<bool>; 200/400` | `AdminController.cs:223` |
| API-017 NOT_RUN | `GET /api/Admin/exam-sessions` | Admin / general | `GetExamSessions( [FromQuery] string? search = null, [FromQuery] int take = 200)` | `ApiResponse<List<AdminExamSessionResponse>>; 200` | `AdminController.cs:237` |
| API-018 NOT_RUN | `GET /api/Admin/exam-sessions/{id}` | Admin / general | `GetExamSessionDetail(string id)` | `ApiResponse<AdminExamSessionDetailResponse>; 200/404` | `AdminController.cs:244` |
| API-019 NOT_RUN | `GET /api/Admin/audit` | Admin / general | `GetAudit([FromQuery] int take = 50, [FromQuery] string? search = null)` | `ApiResponse<List<AdminAuditResponse>>; 200` | `AdminController.cs:256` |
| API-020 NOT_RUN | `POST /api/auth/register` | Public / auth | `Register([FromBody] RegisterRequest request)` | `ApiResponse<AuthResponse>; 201/400` | `AuthController.cs:65` |
| API-021 NOT_RUN | `POST /api/auth/confirm-email` | Public / auth | `ConfirmEmailPost([FromBody] ConfirmEmailRequest request)` | `ApiResponse<bool>; 200/400` | `AuthController.cs:80` |
| API-022 NOT_RUN | `POST /api/auth/resend-confirmation` | Public / sensitive | `ResendConfirmation([FromBody] ResendConfirmationEmailRequest request)` | `ApiResponse<bool>; 200/400` | `AuthController.cs:90` |
| API-023 NOT_RUN | `POST /api/auth/forgot-password` | Public / sensitive | `ForgotPassword([FromBody] ForgotPasswordRequest request)` | `ApiResponse<bool>; 200/400` | `AuthController.cs:100` |
| API-024 NOT_RUN | `POST /api/auth/reset-password` | Public / sensitive | `ResetPassword([FromBody] ResetPasswordRequest request)` | `ApiResponse<bool>; 200/400` | `AuthController.cs:111` |
| API-025 NOT_RUN | `GET /api/auth/google` | Public / general | `GoogleLogin(gövdə yoxdur)` | `Google Challenge/redirect; disabled 400 ApiResponse<bool>` | `AuthController.cs:122` |
| API-026 NOT_RUN | `GET /api/auth/google-callback` | Public / general | `GoogleCallback(gövdə yoxdur)` | `frontend redirect; failure redirect` | `AuthController.cs:134` |
| API-027 NOT_RUN | `POST /api/auth/google/exchange` | Public / auth | `ExchangeGoogleCode([FromBody] GoogleLoginExchangeRequest request)` | `ApiResponse<AuthResponse>; 200/400` | `AuthController.cs:166` |
| API-028 NOT_RUN | `POST /api/auth/login` | Public / auth | `Login([FromBody] LoginRequest request)` | `ApiResponse<AuthResponse>; 200/401` | `AuthController.cs:194` |
| API-029 NOT_RUN | `POST /api/auth/logout` | JWT / general | `Logout(gövdə yoxdur)` | `ApiResponse<bool>; 200` | `AuthController.cs:217` |
| API-030 NOT_RUN | `POST /api/auth/logout-all` | JWT / sensitive | `LogoutAll(gövdə yoxdur)` | `ApiResponse<bool>; 200` | `AuthController.cs:239` |
| API-031 NOT_RUN | `POST /api/auth/refresh` | Public / refresh | `RefreshToken([FromBody] TokenRefreshRequest request)` | `ApiResponse<AuthResponse>; 200/400` | `AuthController.cs:255` |
| API-032 NOT_RUN | `GET /api/auth/me` | JWT / general | `Me(gövdə yoxdur)` | `ApiResponse<CurrentUserResponse>; 200/401` | `AuthController.cs:285` |
| API-033 NOT_RUN | `POST /api/Course` | VIP / sensitive | `CreateCourse([FromBody] CreateCourseRequest request)` | `ApiResponse<CourseResponse>, ApiResponse<object>; 200/400/402/403` | `CourseController.cs:49` |
| API-034 NOT_RUN | `GET /api/Course` | Public / general | `GetApprovedCourses(gövdə yoxdur)` | `ApiResponse<List<CourseResponse>>; 200` | `CourseController.cs:61` |
| API-035 NOT_RUN | `GET /api/Course/{id:int}` | Public / general | `GetCourseById(int id)` | `ApiResponse<CourseResponse>; 200/404` | `CourseController.cs:68` |
| API-036 NOT_RUN | `GET /api/Course/vip-status` | JWT / general | `VipStatus(gövdə yoxdur)` | `ApiResponse<VipStatusResponse>; 200` | `CourseController.cs:79` |
| API-037 NOT_RUN | `GET /api/Course/mine` | JWT / general | `Mine(gövdə yoxdur)` | `ApiResponse<List<MyCourseResponse>>; 200` | `CourseController.cs:86` |
| API-038 NOT_RUN | `PUT /api/Course/{id:int}` | JWT / sensitive | `UpdateCourse(int id, [FromBody] UpdateCourseRequest request)` | `ApiResponse<MyCourseResponse>, ApiResponse<object>; 200/400/404` | `CourseController.cs:96` |
| API-039 NOT_RUN | `DELETE /api/Course/{id:int}` | JWT / sensitive | `DeleteCourse(int id)` | `ApiResponse<bool>, ApiResponse<object>; 200/404` | `CourseController.cs:107` |
| API-040 NOT_RUN | `POST /api/Course/{id:int}/reactivate` | VIP / sensitive | `Reactivate(int id)` | `ApiResponse<MyCourseResponse>, ApiResponse<object>; 200/402/403/404/409` | `CourseController.cs:119` |
| API-041 NOT_RUN | `GET /api/exam-sessions/categories` | VIP / general | `Categories(gövdə yoxdur)` | `ApiResponse<List<ExamCategoryResponse>>, ApiResponse<object>; 200/403` | `ExamSessionsController.cs:38` |
| API-042 NOT_RUN | `GET /api/exam-sessions/mine` | JWT / general | `Mine(gövdə yoxdur)` | `ApiResponse<ExamOverviewResponse>; 200` | `ExamSessionsController.cs:45` |
| API-043 NOT_RUN | `POST /api/exam-sessions` | VIP / submit | `Create(CreateExamRequest request)` | `ApiResponse<ExamSessionResponse>, ApiResponse<object>; 200/400/403/409/429` | `ExamSessionsController.cs:53` |
| API-044 NOT_RUN | `POST /api/exam-sessions/join` | JWT / submit | `Join(JoinExamRequest request)` | `ApiResponse<ExamAttemptResponse>, ApiResponse<object>; 200/400/404/409` | `ExamSessionsController.cs:69` |
| API-045 NOT_RUN | `GET /api/exam-sessions/attempts/{id}` | JWT / general | `Attempt(string id)` | `ApiResponse<ExamAttemptResponse>, ApiResponse<object>; 200/404` | `ExamSessionsController.cs:79` |
| API-046 NOT_RUN | `PUT /api/exam-sessions/attempts/{id}/answer` | JWT / general | `Answer(string id, SaveExamAnswerRequest request)` | `ApiResponse<ExamAttemptResponse>, ApiResponse<object>; 200/400/404/409` | `ExamSessionsController.cs:85` |
| API-047 NOT_RUN | `POST /api/exam-sessions/attempts/{id}/submit` | JWT / submit | `Submit(string id)` | `ApiResponse<ExamAttemptResponse>, ApiResponse<object>; 200/404` | `ExamSessionsController.cs:94` |
| API-048 NOT_RUN | `GET /api/exam-sessions/{code}/dashboard` | VIP / general | `Dashboard(string code)` | `ApiResponse<ExamDashboardResponse>, ApiResponse<object>; 200/403/404` | `ExamSessionsController.cs:101` |
| API-049 NOT_RUN | `POST /api/exam-sessions/{code}/close` | VIP / general | `Close(string code)` | `ApiResponse<ExamSessionResponse>, ApiResponse<object>; 200/403/404` | `ExamSessionsController.cs:109` |
| API-050 NOT_RUN | `GET /api/Quiz/categories` | Public / general | `GetCategories(gövdə yoxdur)` | `ApiResponse<List<QuizCategoryResponse>>; 200` | `QuizController.cs:49` |
| API-051 NOT_RUN | `GET /api/Quiz/questions` | Public / general | `GetQuestions( [FromQuery] int categoryId, [FromQuery] string? difficulty = null, [FromQuery] int count = 10)` | `ApiResponse<List<QuizQuestionPublicResponse>>, ApiResponse<object>; 200/400` | `QuizController.cs:65` |
| API-052 NOT_RUN | `GET /api/Quiz/leaderboard` | Public / general | `GetLeaderboard( [FromQuery] string? period = null, [FromQuery] int? categoryId = null, [FromQuery] int limit = 10)` | `ApiResponse<List<LeaderboardEntryResponse>>; 200` | `QuizController.cs:92` |
| API-053 NOT_RUN | `POST /api/Quiz/submit` | JWT / submit | `SubmitAnswer([FromBody] SubmitAnswerRequest request)` | `ApiResponse<SubmitAnswerResponse>, ApiResponse<object>; 200/400` | `QuizController.cs:117` |
| API-054 NOT_RUN | `POST /api/Quiz/categories` | Admin / general | `CreateCategory([FromBody] CreateQuizCategoryRequest request)` | `ApiResponse<QuizCategoryResponse>, ApiResponse<object>; 201/400` | `QuizController.cs:146` |
| API-055 NOT_RUN | `GET /api/Quiz/admin/categories` | Admin / general | `GetAdminCategories([FromQuery] bool deleted = false)` | `ApiResponse<List<AdminQuizCategoryResponse>>; 200` | `QuizController.cs:169` |
| API-056 NOT_RUN | `POST /api/Quiz/categories/{id:int}/restore` | Admin / sensitive | `RestoreCategory(int id)` | `ApiResponse<int>, ApiResponse<object>; 200/400` | `QuizController.cs:177` |
| API-057 NOT_RUN | `PUT /api/Quiz/categories/{id:int}` | Admin / sensitive | `UpdateCategory(int id, [FromBody] UpdateQuizCategoryRequest request)` | `ApiResponse<QuizCategoryResponse>, ApiResponse<object>; 200/400` | `QuizController.cs:198` |
| API-058 NOT_RUN | `GET /api/Quiz/admin/questions` | Admin / general | `GetAdminQuestions( [FromQuery] int? categoryId = null, [FromQuery] string? search = null, [FromQuery] string? difficulty = null, [FromQuery] bool? examOnly = null, [FromQuery] bool deleted = false, [FromQuery] int skip = 0, [FromQuery] int take = 25)` | `ApiResponse<AdminQuestionPageResponse>; 200` | `QuizController.cs:222` |
| API-059 NOT_RUN | `PUT /api/Quiz/questions/{id:int}` | Admin / sensitive | `UpdateQuestion(int id, [FromBody] UpdateQuizQuestionRequest request)` | `ApiResponse<AdminQuizQuestionResponse>, ApiResponse<object>; 200/400` | `QuizController.cs:243` |
| API-060 NOT_RUN | `POST /api/Quiz/questions/{id:int}/restore` | Admin / sensitive | `RestoreQuestion(int id)` | `ApiResponse<AdminQuizQuestionResponse>, ApiResponse<object>; 200/400` | `QuizController.cs:264` |
| API-061 NOT_RUN | `DELETE /api/Quiz/categories/{id:int}` | Admin / sensitive | `DeleteCategory(int id)` | `ApiResponse<object>; 200/404` | `QuizController.cs:287` |
| API-062 NOT_RUN | `POST /api/Quiz/questions` | Admin / general | `CreateQuestion([FromBody] CreateQuizQuestionRequest request)` | `ApiResponse<QuizQuestionResponse>, ApiResponse<object>; 201/400/401/403` | `QuizController.cs:307` |
| API-063 NOT_RUN | `DELETE /api/Quiz/questions/{id:int}` | Admin / sensitive | `DeleteQuestion(int id)` | `ApiResponse<object>; 200/404/401/403` | `QuizController.cs:333` |
| API-064 NOT_RUN | `GET /uploads/syllabus/{fileName}` | Public / download | `DownloadPdf(string fileName)` | `application/pdf File; 200/404/503` | `UploadController.cs:57` |
| API-065 NOT_RUN | `POST /api/Upload/photo` | VIP və ya Admin / upload | `UploadPhoto(IFormFile file)` | `ApiResponse<object>, ApiResponse<string>; 200/400/429/503` | `UploadController.cs:77` |
| API-066 NOT_RUN | `POST /api/Upload/syllabus` | VIP və ya Admin / upload | `UploadSyllabus(IFormFile file)` | `ApiResponse<object>, ApiResponse<string>; 200/400/429/503` | `UploadController.cs:122` |
| API-067 NOT_RUN | `PATCH /api/User/role` | JWT / general | `ChangeRole([FromBody] ChangeRoleRequest request)` | `ApiResponse<bool>; 200/400/401` | `UserController.cs:37` |
| API-068 NOT_RUN | `GET /api/User/profile` | JWT / general | `GetProfile(gövdə yoxdur)` | `ApiResponse<ProfileResponse>; 200/401/404` | `UserController.cs:53` |
| API-069 NOT_RUN | `PUT /api/User/profile` | JWT / general | `UpdateProfile([FromBody] UpdateProfileRequest request)` | `ApiResponse<ProfileResponse>; 200/400/401` | `UserController.cs:69` |
| API-070 NOT_RUN | `POST /api/User/profile/change-email` | JWT / general | `RequestEmailChange([FromBody] ChangeEmailRequest request)` | `ApiResponse<bool>; 200/400/401` | `UserController.cs:81` |
| API-071 NOT_RUN | `POST /api/User/profile/request-password-change` | JWT / general | `RequestPasswordChange(gövdə yoxdur)` | `ApiResponse<bool>; 200/400/401` | `UserController.cs:94` |
| API-072 NOT_RUN | `POST /api/User/confirm-email-change` | Public / sensitive | `ConfirmEmailChangePost([FromBody] ConfirmEmailChangeRequest request)` | `ApiResponse<bool>; 200/400` | `UserController.cs:112` |
| API-073 NOT_RUN | `GET /api/User/me/overview` | JWT / general | `GetMyOverview(gövdə yoxdur)` | `ApiResponse<StudentOverviewResponse>; 200/400/401` | `UserController.cs:128` |
| API-074 NOT_RUN | `GET /api/User/students/{studentId}/overview` | Teacher / general | `GetStudentOverview([FromRoute] string studentId)` | `ApiResponse<StudentOverviewResponse>; 200/400/401/403` | `UserController.cs:139` |
| API-075 NOT_RUN | `GET /api/User/teacher/classes` | Teacher / general | `GetTeacherClasses(gövdə yoxdur)` | `ApiResponse<List<TeacherClassResponse>>; 200/400/401/403` | `UserController.cs:156` |
| API-076 NOT_RUN | `POST /api/User/teacher/classes` | Teacher / general | `CreateTeacherClass([FromBody] CreateTeacherClassRequest request)` | `ApiResponse<TeacherClassResponse>; 200/400/401/403` | `UserController.cs:170` |
| API-077 NOT_RUN | `POST /api/User/teacher/classes/{classId:int}/students` | Teacher / general | `AddStudentToClass([FromRoute] int classId, [FromBody] AddStudentToClassRequest request)` | `ApiResponse<TeacherClassResponse>; 200/400/401/403` | `UserController.cs:185` |
| API-078 NOT_RUN | `DELETE /api/User/teacher/classes/{classId:int}` | Teacher / general | `DeleteTeacherClass([FromRoute] int classId)` | `ApiResponse<bool>; 200/400/401/403` | `UserController.cs:205` |
| API-079 NOT_RUN | `GET /health` | Public / qlobal | gövdə yoxdur | raw `{status:"ok"}`; 200 | `Program.cs:731` |

Controller fayllarının qovluğu: `Kiberaz.Api/Controllers/`. Cədvəldəki mənbə sətiri HTTP atributunun başladığı sahəni göstərir. OAuth handler callback-i `/signin-google` ayrıca controller action deyil; Google middleware konfiqurasiyasından yaranır. Şəkil statik faylları `/uploads/photos/*` xəttindən verilə bilər; PDF isə ayrıca controller marşrutudur. Swagger yalnız Development rejimindədir.

## İstehlakçı → servis → saxlanma əlaqəsi

| API ailəsi | Frontend istehlakçısı | Backend işi / sahiblik | Kolleksiya və yan təsir |
|---|---|---|---|
| Auth | `src/services/authService.ts`, `apiClient.ts`; giriş/qeydiyyat/token keçid səhifələri | `IAuthService` → `AuthService`, `TokenService`, Identity stores; kimlik JWT/cookie ilə, reset/confirmation məqsədli token ilə | `Users` içində `RefreshSessions`, security stamp, Google qısa kod hash; `LoginAttempts`, `RevokedTokens`; email növbəsi |
| User profil / rol | `src/services/userService.ts`; kabinet/profil | `UserService`; claim-dən cari id; rol User↔Teacher; VIP/sahib dəyişməz; müəllimin sinfi varsa keçid rədd | `Users`; rol/credential dəyişikliyi sessiyaları ləğv edir; email növbəsi |
| Teacher sinif / overview | `userService.ts:getTeacherClasses/createTeacherClass/addStudentToClass/getStudentOverview/deleteTeacherClass` | `UserService:246–554`; Teacher rolu və `TeacherId == caller`; overview üçün tələbənin müəllimin siniflərindən birində olması | `TeacherClasses.Students` embed; `Users`, `QuizResults`, `QuizCategories` oxunur; sinif silmə fiziki DELETE-dir |
| Course ictimai | `courseService.ts:getApprovedCourses/getCourseById` | `CourseService:36–61`; Approved, !IsDeleted, vaxtı keçməyən | `Courses`; siyahı GET vaxtı keçən statusları da yaza bilər |
| Course sahib | `courseService.ts`; paylaşma formu/kabinet | `CourseService`; `SubmittedByUserId`; yaratma/reactivate VIP + aktiv term + kredit; `UploadLedger` fayl sahibini yoxlayır | `Courses`, `VipTerms`, `UploadedFiles`, `Users`; `VipSyncRoot` tranzaksiyası; soft delete |
| Quiz ictimai/cavab | `quizService.ts`; quiz və liderlik | `QuizService`; private bank ictimai proyeksiyadan və submit-dən kənar; nəticədə açar/izah yalnız public sual submit-dən sonra | `QuizCategories`, `QuizQuestions` (embed Options), `QuizResults`, `QuizScoreClaims`; bal iddiası user+question üzrə unikaldır |
| Exam | `examSessionService.ts:52–77`; imtahan yarat/join/player/panel | `ExamSessionService`; Host=VIP; `OwnedSession` host id; `OwnedAttempt` student id; gizli/sahib iştirak edə bilməz | `ExamSessions` immutable sual snapshotları + server CorrectKey; `ExamAttempts` revision/answers/result; `ExamSyncRoot` tranzaksiyası |
| Admin | `adminService.ts:287–470`; admin tabları | `AdminService`, quiz idarəsi üçün `QuizService`, `AuditLog`; yalnız tək Admin; hidden hesablar siyahıdan çıxır; öz/sahib hədəfə mutasiya rədd | Demək olar bütün biznes kolleksiyalar; uğurlu admin dəyişməsi `AdminAudit`; istifadəçi DELETE fiziki kaskad |
| Upload | `courseService.ts:199–221`; forma photo/PDF | `UploadService`, `SafePdf`, `PdfProcessSanitizer`; VIP/Admin, ownerId claim; axın byte limiti/magic-byte/kvota/random ad | Disk `wwwroot/uploads`, `UploadedFiles`; photo 2 MiB, PDF 10 MiB; multipart tavan 3/12 MiB |
| Health | deploy/uptime monitor | `Program.cs:731`; DB-yə toxunmayan liveness | `{status:"ok"}` DB/SMTP readiness sübutu deyil |

Frontend yolları `kiberaz-ui/` altındadır. Controller route adları böyük/kiçik hərflə fərqlənə bilər; frontend kiçik hərfli `/auth`, `/user`, `/course`, `/quiz`, `/admin`, `/upload` istifadə edir.

## DTO və validator xəritəsi

Hər action-ın sorğu tipinin adı endpoint cədvəlindədir. Tiplər `Kiberaz.Application/DTOs/{Auth,User,Course,Quiz,Exam,Admin}` altındadır. FluentValidation `Program.cs:557` ətrafında assembly-dən qeydiyyata alınır; `Filters/ValidationFilter.cs` action-dan əvvəl yoxlayır. Route/query primitive-lər DTO validatoru ilə eyni mexanizm deyil; clamp və xidmət yoxlamaları ayrıca izlənməlidir.

| Qrup | Əsas sahələr | Validator / sərhəd |
|---|---|---|
| Register/Login | firstName,lastName,email,nickname,role,gender,password,confirmPassword,captchaToken; login email,password,captchaToken | `RegisterRequestValidator`, `LoginRequestValidator`; yalnız User/Teacher self-register; Identity policy ayrıca |
| Confirmation/reset | userId,token; reset newPassword,confirmPassword; forgot email,captchaToken | `TokenRequestValidators`, `ResetPasswordRequestValidator`, `ForgotPasswordRequestValidator` |
| Refresh | accessToken?, refreshToken?; veb `{}` + HttpOnly cookie | `TokenRefreshRequestValidator`; köhnə/yanlış/replay/bitmiş ailə ssenariləri |
| User | profile firstName,lastName,nickname,gender; role newRole; email newEmail | `UpdateProfileRequestValidator`, `ChangeRoleRequestValidator`, `ChangeEmailRequestValidator` |
| Teacher | create {name}; add {studentId} | `TokenRequestValidators:63,74`; ad 80, class max 200; duplicate/foreign ownership servisdə |
| Course create/update | instructorName,instructorRole,courseTitle,description,duration,level,language,accentColor; optional company/photo/social/contact/syllabus | `CreateCourseRequestValidator`, `UpdateCourseRequestValidator`; title 5–150, description 20–2000; 30 mövzu; own upload URL; xidmət fayl ledger sahibini yoxlayır |
| Exam create | title,durationMinutes,categories:[{categoryId,count}] | `ExamValidators`; title 3–120; 1–180 dəq; 1–30 category; total 1–50 sual; duplicate category rədd |
| Exam join/save | code; questionId,optionKey,revision | `ExamValidators`; KBR- + 16 hex; question id 32 hex; option 1–8 hərf/rəqəm; revision ≥0 |
| Quiz submit | questionId,selectedKey | `SubmitAnswerRequestValidator`; private/unknown question service tərəfindən rədd |
| Quiz admin | category create/update; question isExamOnly,categoryId,difficulty,question,correctKey,options:[{key,text,explanation}] | `CreateQuizCategoryRequestValidator`, `CreateQuizQuestionRequestValidator`, `QuizAdminValidators`; edit private/public bankı dəyişmir |
| Admin | CreateAdminCourseRequest {title,instructor,category,link?}; AdminUpdateUserRequest {firstName,lastName,nickname,gender,confirmEmail}; role {role} | `AdminValidators`; Admin icazəli təyin edilən rollar siyahısında yoxdur |
| Upload | multipart/form-data `file` | ayrıca DTO yoxdur; controller/service content/size/magic-byte/sanitizer nəzarəti |

`ApiResponse<T>` zərfi: success,message,data,errors. İmtahan attempt cavabında session,serverNow,expiresAt,submittedAt,correctCount,percentage,revision,answers,questions var; question-da id/category/text/options var, CorrectKey yoxdur. Dashboard iştirakçı id-si attempt id-dir; tələbənin user id-si kimi işlədilməməlidir. `TeacherName` imtahan DTO-da tarixi addır, VIP host nickname deməkdir.

## Saxlanma, vəziyyət və fon işləri

`LiteDbContext` singleton-dur; LiteDB 5.0.21; `UtcDate=true`; kökə nisbətən DB yolu həll edilir, qovluq/indexlər constructor zamanı yarana bilər. Buna görə auditdə context instansiyası yaradılmayıb. Kolleksiya inventarı (`Data/LiteDbContext.cs:87–219`): Users, Roles, Categories, Articles, TeacherClasses, Courses, QuizCategories, QuizQuestions, QuizResults, LoginAttempts, QuizScoreClaims, VipTerms, AdminAudit, UploadedFiles, RevokedTokens, ExamSessions, ExamAttempts. Categories/Articles üçün cari controller-lərdə ayrıca CRUD tapılmadı; mövcud kolleksiya olması HTTP səthinin olması demək deyil.

Unikal indekslər: Users.NormalizedEmail/NormalizedUserName, Roles.NormalizedName, ExamSessions.Code, ExamAttempts.ParticipationKey, UploadedFiles.Path; QuizScoreClaims `_id` user:question açarı. İstifadə olunan ayrıca gate-lər: UsersSyncRoot, QuizSyncRoot, ExamSyncRoot, VipSyncRoot. Bütün entity-lər BaseEntity-dən gəlmir: AppUser/TeacherClass/ExamSession/ExamAttempt üçün «soft delete hər yerdə» fərziyyəsi doğru deyil.

- CourseStatus: Pending=0 → approve → Approved=1 → expiry → Expired=3 → reactivate (kredit) → Pending; reject → Rejected=2. Approved edit PendingRevision yaradır, canlı məzmun və expiry saxlanır; revision approve/reject ayrıca. Silmə IsDeleted; kredit geri verilmir. ExpiresAt=null tarixi/admin təlimlər üçün ayrıca davranışdır.
- VIP: 30 günlük dövr, 1 course krediti; yeni term aktiv mövcud term arxasına planlana bilər. Course təsdiqdən 30 gün yaşayır, VIP term bitməsi ilə eyni saatda bitməsi tələb edilmir. İmtahan yaratma kredit xərcləmir, aktiv term tələb edir.
- Exam: açıq/closed `ClosedAt`; attempt in-progress/submitted `SubmittedAt`; expires ayrı millisaniyə UTC zamanıdır. Version!=1 köhnə sessiya private-bank tələb edən əməliyyatlarda 409 alır. Günlük 7 (UTC), açıq 50, iştirakçı 500. Join eyni user/session üçün idempotent; öz host sessiyasına join 400. Submit idempotent; stale save revision 409; bitmiş attempt-ə save cari yekun cavabı qaytarır, cavabı dəyişmir.
- Auth: təsdiqsiz, temporary lock, admin block, canlı/tam bitmiş/revoked session, pending email change, Google exchange code. SessionPolicy: maksimum 5 cihaz, 15 dəq access, 7 gün refresh, 30 gün absolute session, 15 saniyə refresh yarış güzəşti. Admin blok ayrıca `BlockedByAdminAt` ilə müvəqqəti lockout-dan ayrılır.
- `CourseExpirySweeper`: startup və 15 dəqiqədən bir status update (`Services/CourseExpirySweeper.cs:15–35`). `UploadSweeper`: startup və saatlıq, 24 saatlıq orphan/released TTL, disk+ledger delete (`UploadPolicy`, `Services/UploadSweeper.cs`). `EmailDispatcher`: memory Channel tutumu 1000; maksimum 3 cəhd, 10/30 saniyə retry; diskdə davamlı outbox deyil (`Services/EmailDispatcher.cs`, `Infrastructure/Services/EmailQueue.cs`).
- Startup initializer/seed/backfill tək Admin invariantı, hesab və upload uyğunlaşdırmaları yaza bilər. Tətbiqi audit məqsədilə işə salmaq read-only hesab edilmir.

İnteqrasiyalar: SMTP/MailKit + memory queue; Cloudflare Turnstile fail-closed; optional Google OAuth (external cookie, exchange code); Identity DataProtection confirmation/reset; LiteDB embedded file; PDF ayrıca `--sanitize-pdf` worker; reverse proxy forwarded headers/CORS/HTTPS; upload disk. Ödəniş provider/webhook controller-i yoxdur: VIP ödənişinin cari ekvivalenti Admin vip-term əməliyyatıdır. Xarici xidmət çağırışı bu baxışda edilməyib.

Konfiqurasiya açar ailələri: ConnectionStrings:LiteDb, JwtSettings, Captcha, EmailSettings, Authentication:Google, FrontendUrl, CORS/proxy və upload limit parametrləri. Dəyərlər hesabatda yoxdur. `Program.cs:37–39` local optional JSON yükləyir, sonra environment/command-line üstünlüyü verir. Deployment-də local faylın təsadüfən çatdırılmaması ayrıca release yoxlamasıdır; burada mövcudluğu/məzmunu oxunmayıb.

Production limiter: auth 10/dəq, sensitive 5/dəq, upload 5/dəq, submit 30/dəq, general 60/dəq, refresh 10/dəq cookie hash (yoxdursa IP), download 20/dəq; qlobal hesab 240/IP 600 həddi (`Program.cs:260–390`). Development limitləri artırılıb; Development testi production limiter sübutu deyil.

## Minimal, deterministik rollararası ssenari — NOT_RUN

Bu plan yalnız ayrıca icazəli izolyasiya edilmiş test mühiti üçündür. Audit zamanı payload-lar göndərilməyib. Fixture adları sintetikdir; real email/token/user id yazılmamalıdır. Standart role change tək rola keçirir, ona görə Teacher və VIP ayrı fixture olmalıdır.

Fixture-lər: ADMIN_OWNER (mövcud invariant sahib), VIP_A (təsdiqli, bloklanmayıb, aktiv VipTerm, ≥1 boş kredit, bugünkü quota boş), USER_A və USER_B (təsdiqli User), TEACHER_A və TEACHER_B (təsdiqli Teacher); QA_CAT aktiv; QA_PRIVATE_Q bu kateqoriyada yeganə aktiv, public mətni ilə üst-üstə düşməyən private sual. USER_A id-si müvafiq auth/profile cavabından saxlanır. Hamısı eyni test run label daşımalıdır. Administrator fixture yaradılması real sahib invariantını dəyişdirməməlidir.

1. ADMIN_OWNER test bankına bir private sual əlavə edir (API cədvəlində Quiz POST questions). Payload quruluşu:
   ```json
   {"isExamOnly":true,"categoryId":123,"difficulty":"Başlanğıc","question":"QA run üçün yeganə yoxlama sualı hansıdır?","correctKey":"A","options":[{"key":"A","text":"Yoxlama variantı","explanation":"Sintetik nümunə"},{"key":"B","text":"Alternativ variant","explanation":"Sintetik nümunə"},{"key":"C","text":"Üçüncü variant","explanation":"Sintetik nümunə"},{"key":"D","text":"Dördüncü variant","explanation":"Sintetik nümunə"}]}
   ```
   123 fixture kateqoriya id-si ilə əvəz olunur. Known key yalnız test qurucusundadır; iştirakçı cavab payload-da açar olmamalıdır.
2. VIP_A `POST /api/exam-sessions`:
   ```json
   {"title":"QA rol axını","durationMinutes":5,"categories":[{"categoryId":123,"count":1}]}
   ```
   Code/id cavabdan alınır. USER/Teacher eyni əməliyyatda 403; ikinci VIP host olmadan dashboard-da 404. VIP term bitmiş fixture yaratmada 403 gözlənir.
3. USER_A `POST /api/exam-sessions/join` `{ "code": "<cavabdakı code>" }`; təkrar join eyni attempt id. Cavabdan 32-hex question id və revision götürülür. USER_B həmin attempt GET/PUT/submit üçün 404 almalıdır.
4. USER_A `PUT /api/exam-sessions/attempts/{id}/answer`:
   ```json
   {"questionId":"<cavabdakı 32-hex id>","optionKey":"A","revision":0}
   ```
   Revision real cari dəyərlə əvəz olunur. Cavab revision+1; köhnə revision ilə ikinci save 409. Sonra POST submit: bir suallı known-key fixture-də correctCount=1, percentage=100; təkrar submit eyni nəticə. VIP_A dashboard eyni count/score göstərir; POST close sessiyanı closed edir. Yeni USER_B join 409.
5. USER_A ayrıca public quiz suala `POST /api/Quiz/submit` `{ "questionId":456,"selectedKey":"A" }` göndərir. Teacher statistikasını artırmaq üçün bu ayrıca addım lazımdır: overview real ExamAttempts-dən deyil QuizResults-dən hesablanır. İlk-cavab bal qorunmasını təkrar submit ilə yoxlamaq lazımdır.
6. TEACHER_A əvvəl `GET /api/User/students/{USER_A}/overview`: bağlı deyilsə 400. `POST /api/User/teacher/classes` `{ "name":"QA sinfi" }`; id cavabdan. `POST /api/User/teacher/classes/{id}/students` `{ "studentId":"<USER_A>" }`: roster count=1. Sonra overview 200, public quiz statistikası uyğun. TEACHER_B həmin class-a əlavə/silmə və USER_A overview üçün 400; User rolu müəllim route-da 403. Eyni student yenidən əlavə 400.
7. VIP_A `POST /api/Course`:
   ```json
   {"instructorName":"Sınaq Müəllimi","instructorRole":"Təlimçi","courseTitle":"QA təhlükəsizlik təlimi","description":"İzolyasiya edilmiş QA axını üçün sintetik təlim açıqlaması.","duration":"5 saat","level":"Başlanğıc","language":"Azərbaycan dili","syllabusTopics":["Yoxlama"],"accentColor":"--brand-primary"}
   ```
   Fayl optional buraxılır, disk təsirini azaltmaq üçündür. Mine Pending; public detail 404. ADMIN_OWNER PATCH `/api/Admin/courses/{id}/approve`; public detail 200; 30 günlük expiry. VIP_A PUT title dəyişməsi PendingRevision yaradır, public köhnə başlıq qalır; admin revision approve-dan sonra yeni başlıq görünür və expiry uzanmır. USER_B PUT/DELETE 404. İkinci course üçün kredit yoxdursa 402.
8. Testdən sonra yalnız həmin run fixture-ləri ayrıca razılaşdırılmış təmizləmə planı ilə idarə olunur. Bu auditdə nə fixture yaradılıb, nə silinib.

## Statik müşahidələr və sənəd drift-i

Bunlar runtime repro ilə təsdiqlənmiş bug statusu daşımır; etibar kodun faktına aiddir.

| İD | Əhəmiyyət / etibar | Sübut və təsir | Sonrakı yoxlama |
|---|---|---|---|
| B-S01 | Yüksək audit sərhədi / yüksək | `CourseService:38,92` GET-dən ExpireOverdue; `ExamSessionService:109,138,174,283–296` GET-dən Finish yazısı. Sadə HTTP GET read-only zəmanəti vermir. | Yalnız izolyasiya DB ilə runtime sınaq; bu auditdə çağırılmayıb |
| B-S02 | Məhsul/razılıq sərhədi / yüksək | `UserService:350–407` teacher bildiyi student id ilə roster-a əlavə edir; invitation/consent vəziyyəti yoxdur. Sonra `246–274` overview açılır. | Səlahiyyətli məhsul sahibi tələbə razılığı gözləntisini təsdiqləsin; artıq `docs/security-audit-2026-09-14.md:138`-də qeyd var |
| B-S03 | Müqavilə semantikası / yüksək | `UserService:570–649` overview.ExamSessions `QuizResults` kateqoriya qruplarıdır, CAT-id daşıyır; real ExamSession deyil. | UI etiketi və QA oracle ayrıca təsdiqlənsin; imtahan sonrası overview artımı avtomatik gözlənməsin |
| B-S04 | Sənəd drift-i / yüksək | SENIOR-RULES soft-delete hər yerdə deyir; `UserService:438` TeacherClass.Delete, `AdminService:461–502` user və əlaqəli obyektlər fiziki silinir. | Restore/backup testi destructive-scope olmadan bu auditdə aparılmır; sənəd qaydası ilə fakt fərqi qeyd olunur |
| B-S05 | Siyasət drift-i / yüksək | SENIOR-RULES refresh yalnız cookie deyir; `AuthController:262–272`, TokenRefreshRequest body refresh qəbul edir. Cavabdakı token isə cookie-dən sonra boşaldılır. | Mobil body kontraktının qəsdən olub-olmadığı, limiterin cookie fallback davranışı ayrıca baxış |
| B-S06 | Rate-policy drift / yüksək | `UserController:81–107` change-email və password-change general altındadır; xidmət 60s cooldown edir. `AuthController:80–82` confirm-email auth (10), sensitive (5) deyil. | Məhsul/abuse tələbini dəqiqləşdirərək uyğun səviyyə testi; bypass faktı iddia edilmir |
| B-S07 | Sənəd drift-i / yüksək | Köhnə audit cədvəli refresh=auth və expired VIP host aça bilir deyir; cari Program:365 refresh siyasəti, ExamSessionService:45,247 aktiv term yoxlayır. | Köhnə sənədin ilkin finding-ləri cari nəticə kimi sayılmamalıdır; sonradan əlavə edilmiş fix qeydləri nəzərə alınmalıdır |
| B-S08 | Müqavilə/operasiya / yüksək | `/health` DB/SMTP-dən asılı deyil; email queue memory-dir, retry max3. Proses restart pending işi itirə bilər (davamlılıq xüsusiyyəti yoxdur). | Test SMTP + kontrollu restart yalnız ayrıca icazəli mühitdə; hazırda NOT_RUN |
| B-S09 | Role model drift / yüksək | `userService.ts:3–4` Teacher+VIP nümunəsi verir; `AdminService:567,596` role dəyişməsi `[newRole]`/`[VIP]` ilə əvəz edir, teacher sinfi bloklayır. | Teacher və VIP ayrı fixture; multi-role kombinasiyanı standart UI nəticəsi kimi fərz etməmək |

Bu sənəd yalnız controller səthi və əlaqəli əsas xidmətlərin inventarıdır; tam təhlükəsizlik zəmanəti, dependency CVE yoxlaması və ya runtime buraxılış təsdiqi deyil.


### B-S10 — sahib profilinin dəyişməzliyi: statik qayda uyğunsuzluğu

Etibar yüksək (mənbə kontraktı); runtime repro **NOT_RUN**. AGENTS/SENIOR-RULES sahibin özü tərəfindən də redaktəsini qadağan edir. `UserService.UpdateProfileAsync:53–82` sahib yoxlaması olmadan nickname, ad, soyad, gender yazır; `LiteDbUserStore.PersistAsync:88–129` concurrency-ni qoruyur, owner immutability yoxlamır. Email-change yolu isə `UserService:93–94` ayrıca sahib qorumasına malikdir. Bu fərq profilin digər sahələrinə qadağanın qəsdən istisna olub-olmadığını aydınlaşdırmağa ehtiyac yaradır; exploit və ya səlahiyyət yüksəltmə təsdiqi deyil. İcazəli izolyasiya edilmiş sahib fixture ilə yalnız profil mutasiya sərhədi ayrıca yoxlanmalıdır.

### Kontrakt inventarının tamamlayıcı qeydləri

Register response tipi AuthResponse olsa da bu endpoint-in təsdiqdən əvvəl boş token/məlumat davranışı ayrıca assertion tələb edir; interface şərhindəki «uğurda JWT verir» mətnini runtime nəticə kimi qəbul etmək olmaz. OAuth challenge/redirect və PDF fayl cavabı JSON zərfinin qəsdən fərqli cavab sinifləridir. User controller-də bəzi claim-missing 401 cavabları gövdəsizdir; /health raw obyekt qaytarır. API zərfi haqqında «hər cavab ApiResponse» sənədi bu istisnaları açıq göstərmir.

Question create HTTP validatoru dəqiq 4 A/B/C/D variant istəyir (`CreateQuizQuestionRequestValidator:8,32–34`); exam snapshot bankını oxuyan `Available()` tarixi obyektlər üçün 2–6 variant qəbul edə bilər. HTTP fixture yaratmaq üçün servis səviyyəsinin daha geniş intervalına əsaslanmaq olmaz.
