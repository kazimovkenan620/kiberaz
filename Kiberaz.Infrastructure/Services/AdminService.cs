using Microsoft.AspNetCore.Identity;
using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// Admin panelinin arxa qatı. Bütün rəqəmlər canlı bazadan gəlir — mock yoxdur.
///
/// TƏHLÜKƏSİZLİK PRİNSİPİ: bu servis "admin hər şeyi edə bilər" prinsipi ilə YAZILMAYIB.
/// İki sərt məhdudiyyət var və hər ikisi geri dönüşü olmayan vəziyyətlərin qarşısını alır:
///   1. Admin öz hesabını bloklaya və ya öz rolunu dəyişə bilməz.
///   2. Sistemdəki SON admin rolu geri alına bilməz.
/// Bunlar olmasa bir səhv klik platformanı idarəçisiz qoyur və yalnız baza faylına
/// əl ilə müdaxilə ilə bərpa olunur.
/// </summary>
public class AdminService : IAdminService
{
    private readonly LiteDbContext           _db;
    private readonly UserManager<AppUser>    _userManager;
    private readonly ProtectedAccountPolicy  _protected;
    private readonly ICourseService          _courses;
    private readonly TimeProvider            _clock;

    public AdminService(LiteDbContext db, UserManager<AppUser> userManager, ProtectedAccountPolicy protectedAccounts,
        ICourseService courses, TimeProvider clock)
    {
        _protected   = protectedAccounts;
        _db          = db;
        _userManager = userManager;
        _courses     = courses;
        _clock       = clock;
    }

    private DateTime Now => _clock.GetUtcNow().UtcDateTime;

    // ═══════════════════════════════════════════════════════════
    // STATİSTİKA
    // ═══════════════════════════════════════════════════════════

    public async Task<ApiResponse<AdminStatsResponse>> GetStatsAsync()
    {
        // Müddəti bitmiş təlimlər ƏVVƏLCƏ passivə keçirilir — əks halda "Aktiv təlim" rəqəmi
        // fon işi növbəti dövrəyə qədər saytda artıq görünməyən təlimləri sayardı.
        await _courses.ExpireOverdueCoursesAsync();

        var now       = Now;
        var weekAgo   = now.AddDays(-7);
        var expiring  = now.AddDays(7);

        var courses    = _db.Courses.Find(c => !c.IsDeleted).ToList();
        var categories = _db.QuizCategories.Count(c => !c.IsDeleted);
        var questions  = _db.QuizQuestions.Find(q => !q.IsDeleted).ToList();

        // Sistem administratoru istifadəçi/fəallıq göstəricilərinə daxil edilmir.
        // Müdafiə məqsədilə bazada qalmış istənilən qeyri-qanuni Admin rolu da sayılmır.
        var ordinaryUsers = _db.Users.FindAll()
            .Where(u => !ProtectedAccountPolicy.IsHiddenAccount(u))
            .ToList();
        var ordinaryIds = ordinaryUsers.Select(u => u.Id).ToHashSet(StringComparer.Ordinal);

        // QuizResults və ExamAttempts ən böyük kolleksiyalardır: siyahıya yığmaq əvəzinə
        // bir keçiddə sayğaclar doldurulur — yaddaş sabit qalır.
        int answers = 0, correct = 0, answersThisWeek = 0;
        foreach (var result in _db.QuizResults.FindAll())
        {
            if (!ordinaryIds.Contains(result.UserId)) continue;
            answers++;
            if (result.IsCorrect) correct++;
            if (result.AnsweredAt >= weekAgo) answersThisWeek++;
        }

        int attempts = 0, submitted = 0;
        foreach (var attempt in _db.ExamAttempts.FindAll())
        {
            if (!ordinaryIds.Contains(attempt.StudentId)) continue;
            attempts++;
            if (attempt.SubmittedAt is not null) submitted++;
        }

        var sessions = _db.ExamSessions.FindAll().ToList();

        var activeVipTerms = _db.VipTerms.Find(t => !t.IsDeleted)
            .Where(t => t.StartsAt <= now && t.EndsAt > now && ordinaryIds.Contains(t.UserId))
            .Select(t => t.UserId)
            .Distinct(StringComparer.Ordinal)
            .Count();

        var stats = new AdminStatsResponse
        {
            TotalUsers       = ordinaryUsers.Count,
            NewUsersThisWeek = ordinaryUsers.Count(u => u.CreatedAt >= weekAgo),
            BlockedUsers     = ordinaryUsers.Count(u => u.BlockedByAdminAt is not null),
            UnconfirmedUsers = ordinaryUsers.Count(u => !u.EmailConfirmed),
            UsersByRole      = new Dictionary<string, int>(StringComparer.Ordinal)
            {
                [AppRoles.VIP]       = ordinaryUsers.Count(u => u.Roles.Contains(AppRoles.VIP)),
                [AppRoles.Teacher]   = ordinaryUsers.Count(u => u.Roles.Contains(AppRoles.Teacher)),
                [AppRoles.Moderator] = ordinaryUsers.Count(u => u.Roles.Contains(AppRoles.Moderator)),
                // Rolsuz köhnə qeydlər də adi istifadəçi sayılır — cəm ümumi sayla üst-üstə düşsün.
                [AppRoles.User]      = ordinaryUsers.Count(u => u.Roles.Count == 0 || u.Roles.Contains(AppRoles.User)),
            },
            ActiveVipTerms   = activeVipTerms,

            TotalCourses     = courses.Count,
            // Moderasiya növbəsi: yeni/yenidən aktivləşdirmə sorğuları + aktiv təlimlərə gözləyən redaktələr.
            PendingCourses   = courses.Count(c => c.Status == CourseStatus.Pending || c.PendingRevision is not null),
            ActiveCourses    = courses.Count(c => c.Status == CourseStatus.Approved),
            ExpiredCourses   = courses.Count(c => c.Status == CourseStatus.Expired),
            RejectedCourses  = courses.Count(c => c.Status == CourseStatus.Rejected),
            ExpiringSoon     = courses.Count(c => c.Status == CourseStatus.Approved &&
                                                  c.ExpiresAt is not null && c.ExpiresAt <= expiring),

            TotalCategories   = categories,
            TotalQuestions    = questions.Count,
            PublicQuestions   = questions.Count(q => !q.IsExamOnly),
            ExamOnlyQuestions = questions.Count(q => q.IsExamOnly),

            TotalExamSessions    = sessions.Count,
            OpenExamSessions     = sessions.Count(x => x.ClosedAt is null),
            ClosedExamSessions   = sessions.Count(x => x.ClosedAt is not null),
            TotalExamAttempts    = attempts,
            SubmittedAttempts    = submitted,

            TotalAnswers    = answers,
            CorrectAnswers  = correct,
            AnswersThisWeek = answersThisWeek
        };

        return ApiResponse<AdminStatsResponse>.Ok(stats);
    }

    // ═══════════════════════════════════════════════════════════
    // TƏLİMLƏR
    // ═══════════════════════════════════════════════════════════

    public async Task<ApiResponse<List<AdminCourseResponse>>> GetCoursesAsync()
    {
        // Müddəti bitənlər əvvəl passivə keçirilir ki, admin cədvəli həqiqi vəziyyəti göstərsin.
        await _courses.ExpireOverdueCoursesAsync();

        // Moderasiya gözləyənlər (yeni sorğu VƏ YA gözləyən redaktə) HƏMİŞƏ ən üstdə olur — admin
        // siyahını aşağı sürüşdürüb gözləyən müraciəti gözdən qaçırmasın deyə. Sonra ən yeni tarixə görə.
        var owners = _db.Users.FindAll().ToDictionary(u => u.Id, u => u.Nickname, StringComparer.Ordinal);
        var courses = _db.Courses
            .Find(c => !c.IsDeleted)
            .OrderBy(c => c.Status == CourseStatus.Pending || c.PendingRevision is not null ? 0 : 1)
            .ThenByDescending(c => c.CreatedAt)
            .Select(c => MapCourse(c, owners))
            .ToList();

        return ApiResponse<List<AdminCourseResponse>>.Ok(courses);
    }

    public Task<ApiResponse<bool>> ApproveCourseAsync(int courseId)
        => Task.FromResult(SetCourseStatus(courseId, CourseStatus.Approved, "Təlim təsdiqləndi."));

    public Task<ApiResponse<bool>> RejectCourseAsync(int courseId)
        => Task.FromResult(SetCourseStatus(courseId, CourseStatus.Rejected, "Təlim rədd edildi."));

    public Task<ApiResponse<bool>> ApproveRevisionAsync(int courseId) => Task.FromResult(CourseWrite(courseId, course =>
    {
        var revision = course.PendingRevision;
        if (revision is null) return ApiResponse<bool>.Fail("Bu təlimdə gözləyən dəyişiklik yoxdur.");

        // Revizyon canlı sahələrin üzərinə yazılır; status və aktiv müddət (ExpiresAt) DƏYİŞMİR —
        // redaktə 30 günü uzatmır.
        course.InstructorName     = revision.InstructorName;
        course.InstructorRole     = revision.InstructorRole;
        course.InstructorCompany  = revision.InstructorCompany;
        course.InstructorPhotoUrl = revision.InstructorPhotoUrl;
        course.LinkedInUrl        = revision.LinkedInUrl;
        course.GitHubUrl          = revision.GitHubUrl;
        course.ContactEmail       = revision.ContactEmail;
        course.ContactPhone       = revision.ContactPhone;
        course.CourseTitle        = revision.CourseTitle;
        course.Kicker             = revision.Kicker;
        course.Description        = revision.Description;
        course.Duration           = revision.Duration;
        course.Level              = revision.Level;
        course.Language           = revision.Language;
        course.SyllabusTopics     = revision.SyllabusTopics;
        course.SyllabusFileUrl    = revision.SyllabusFileUrl;
        course.AccentColor        = revision.AccentColor;
        course.PendingRevision    = null;
        return ApiResponse<bool>.Ok(true, "Dəyişiklik təsdiqləndi və saytda yeniləndi.");
    }));

    public Task<ApiResponse<bool>> RejectRevisionAsync(int courseId) => Task.FromResult(CourseWrite(courseId, course =>
    {
        if (course.PendingRevision is null) return ApiResponse<bool>.Fail("Bu təlimdə gözləyən dəyişiklik yoxdur.");
        course.PendingRevision = null;
        return ApiResponse<bool>.Ok(true, "Dəyişiklik rədd edildi; saytdakı versiya olduğu kimi qalır.");
    }));

    public Task<ApiResponse<bool>> DeleteCourseAsync(int courseId)
    {
        // CourseWrite: VipSyncRoot + tranzaksiya; SyncClaims silinmiş təlimin fayllarını azad edir.
        return Task.FromResult(CourseWrite(courseId, course =>
        {
            course.IsDeleted = true;
            course.PendingRevision = null;
            return ApiResponse<bool>.Ok(true, "Təlim silindi.");
        }));
    }

    public Task<ApiResponse<AdminCourseResponse>> CreateCourseAsync(CreateAdminCourseRequest request)
    {
        var title      = request.Title.Trim();
        var instructor = request.Instructor.Trim();

        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(instructor))
            return Task.FromResult(ApiResponse<AdminCourseResponse>.Fail("Başlıq və müəllim adı boş ola bilməz."));

        var course = new Course
        {
            CourseTitle    = title,
            InstructorName = instructor,
            Category       = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            Link           = string.IsNullOrWhiteSpace(request.Link) ? null : request.Link.Trim(),

            // Admin əl ilə əlavə etdiyi üçün moderasiyaya ehtiyac yoxdur və müddətsizdir (ExpiresAt = null):
            // 30 günlük qayda VIP istifadəçilərin paylaşdığı təlimlərə aiddir.
            Status         = CourseStatus.Approved,
            PublishedAt    = DateTime.UtcNow,
            ExpiresAt      = null,

            // Ictimai formadakı məcburi sahələr burada boş qalır — admin sonra redaktə edə bilər.
            InstructorRole = "—",
            Description    = "—",
            Duration       = "—",
            Level          = "—",
            Language       = "Azərbaycan dili",
            AccentColor    = "--brand-primary",
            CreatedAt      = DateTime.UtcNow
        };

        _db.Courses.Insert(course);

        return Task.FromResult(ApiResponse<AdminCourseResponse>.Ok(MapCourse(course, null), "Təlim əlavə edildi."));
    }

    /// <summary>
    /// Admin birbaşa məzmun düzəlişi. Sahibin redaktəsindən fərqli olaraq gözləyən revizyon
    /// yaratmır — admin moderatordur, ikinci təsdiqə ehtiyac yoxdur. Status və aktiv müddət
    /// DƏYİŞMİR: düzəliş 30 günü uzatmır və passiv təlimi saytda geri qaytarmır.
    /// Sahibin həmin an gözləyən redaktəsi varsa, o, adminin yazdığı mətnin üzərinə düşməsin deyə atılır.
    /// </summary>
    public Task<ApiResponse<AdminCourseResponse>> UpdateCourseContentAsync(int courseId, UpdateCourseRequest request)
    {
        Course? updated = null;
        var result = CourseWrite(courseId, course =>
        {
            CourseService.ApplyContent(course, request);
            course.PendingRevision = null;
            updated = course;
            return ApiResponse<bool>.Ok(true, "Təlim məzmunu yeniləndi.");
        });

        if (!result.Success || updated is null)
            return Task.FromResult(ApiResponse<AdminCourseResponse>.Fail(result.Errors.FirstOrDefault() ?? "Təlim tapılmadı."));

        var saved   = updated;
        var ownerId = saved.SubmittedByUserId;
        var owners  = ownerId is null
            ? null
            : _db.Users.Find(u => u.Id == ownerId).ToDictionary(u => u.Id, u => u.Nickname, StringComparer.Ordinal);
        return Task.FromResult(ApiResponse<AdminCourseResponse>.Ok(MapCourse(saved, owners), result.Message));
    }

    // ═══════════════════════════════════════════════════════════
    // İSTİFADƏÇİLƏR
    // ═══════════════════════════════════════════════════════════

    /// <summary>
    /// İstifadəçi siyahısı — axtarış SERVER tərəfdə aparılır və nəticə həmişə məhdudlaşdırılır.
    ///
    /// ƏVVƏLKİ PROBLEM: metod bütün istifadəçiləri yaddaşa çəkirdi (FindAll().OrderBy().ToList()).
    /// 10 min istifadəçidə hər admin sorğusu bütün bazanı RAM-a yükləyirdi — autentifikasiya
    /// keçidi deyil, amma admin panelini öz-özünə dayandıran böyümə səhvi.
    ///
    /// İNDİ: axan (streaming) oxuma üzərində filtr, yaddaşda isə yalnız `MaxUserPageSize` qədər
    /// ən yeni qeyd saxlanılır — yaddaş sabitdir. Axtarış server tərəfdə olduğu üçün
    /// məhdudiyyət nəticəni yarımçıq göstərmir: axtarılan istifadəçi hansı sırada olsa da tapılır.
    /// </summary>
    public Task<ApiResponse<List<AdminUserResponse>>> GetUsersAsync(
        string currentAdminId, string? search = null, int take = MaxUserPageSize)
    {
        var now = DateTimeOffset.UtcNow;
        var nowUtc = Now;
        var limit = Math.Clamp(take, 1, MaxUserPageSize);
        var needle = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLowerInvariant();

        // Yaddaşda yalnız `limit` qədər ən yeni qeyd saxlanılır (CreatedAt azalan sırada).
        var newest = new List<AppUser>(limit + 1);
        int matched = 0;

        foreach (var user in _db.Users.FindAll())
        {
            // Admin öz hesabını siyahıda görmür. Onsuz da öz rolunu dəyişə və özünü
            // bloklaya bilmirdi — sətri göstərmək yalnız işləməyən düymələr yaradırdı.
            // Filtr SERVERDƏDİR: sətir ümumiyyətlə göndərilmir, brauzerdə gizlədilmir.
            if (ProtectedAccountPolicy.IsHiddenAccount(user))
                continue;

            if (needle is not null && !MatchesSearch(user, needle))
                continue;

            matched++;

            if (newest.Count < limit)
            {
                newest.Add(user);
                newest.Sort(NewestFirst);
            }
            else if (NewestFirst(user, newest[^1]) < 0)
            {
                newest[^1] = user;
                newest.Sort(NewestFirst);
            }
        }

        var users = newest
            .Select(u => new AdminUserResponse
            {
                Id               = u.Id,
                Nickname         = u.Nickname,
                FirstName        = u.FirstName,
                LastName         = u.LastName,
                Email            = u.Email ?? string.Empty,
                Roles            = u.Roles.ToList(),
                IsEmailConfirmed = u.EmailConfirmed,
                IsBlocked        = u.BlockedByAdminAt is not null,
                IsTemporarilyLocked = u.BlockedByAdminAt is null && u.LockoutEnd is not null && u.LockoutEnd > now,
                JoinDate         = u.CreatedAt.ToString("yyyy-MM-dd"),
                VipTermEndsAt    = u.Roles.Contains(AppRoles.VIP) ? VipEntitlements.ActiveTerm(_db, u.Id, nowUtc)?.EndsAt : null,
                VipCoursesRemaining = u.Roles.Contains(AppRoles.VIP) && VipEntitlements.ActiveTerm(_db, u.Id, nowUtc) is { } term
                    ? Math.Max(0, term.CourseAllowance - term.CoursesUsed) : null
            })
            .ToList();

        // Mesaj YALNIZ hədd dolduqda doldurulur. Əks halda boş qalır ki, panel
        // hər yükləmədə lazımsız bildiriş göstərməsin (cədvəl başlığında onsuz da say var).
        var message = matched > users.Count
            ? $"{matched} istifadəçidən ən yeni {users.Count} göstərilir. Dəqiqləşdirmək üçün axtarışdan istifadə edin."
            : string.Empty;

        return Task.FromResult(ApiResponse<List<AdminUserResponse>>.Ok(users, message));
    }

    /// <summary>
    /// Bir hesabın tam kartı. Gizli (sahib/Admin) hesab HEÇ VAXT açılmır — nə siyahıda,
    /// nə də birbaşa Id ilə: əks halda siyahıdan gizlətmək mənasız olardı.
    /// </summary>
    public Task<ApiResponse<AdminUserDetailResponse>> GetUserDetailAsync(string userId)
    {
        var user = _db.Users.FindById(userId);
        if (user is null || ProtectedAccountPolicy.IsHiddenAccount(user))
            return Task.FromResult(ApiResponse<AdminUserDetailResponse>.Fail("İstifadəçi tapılmadı."));

        return Task.FromResult(ApiResponse<AdminUserDetailResponse>.Ok(MapUserDetail(user)));
    }

    /// <summary>
    /// Ad, soyad, ləqəb, cins düzəlişi. Ləqəb eyni zamanda giriş adıdır (UserName) —
    /// unikallıq YAZI QAPISININ İÇİNDƏ yoxlanılır, yəni iki paralel düzəliş eyni ləqəbi ala bilməz.
    /// </summary>
    public Task<ApiResponse<AdminUserDetailResponse>> UpdateUserAsync(
        string currentAdminId, string userId, AdminUpdateUserRequest request)
    {
        AppUser? saved = null;
        var result = ChangeAccount(currentAdminId, userId, user =>
        {
            if (_protected.IsOwner(user))
                return ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage);

            var nickname   = request.Nickname.Trim();
            var normalized = nickname.ToUpperInvariant();

            // Unikal indeks onsuz da yazını rədd edərdi, lakin xəta mesajı istifadəçiyə
            // anlaşılmaz gələrdi — səbəb burada açıq deyilir.
            if (!string.Equals(user.NormalizedUserName, normalized, StringComparison.Ordinal) &&
                _db.Users.Exists(u => u.NormalizedUserName == normalized))
                return ApiResponse<bool>.Fail("Bu ləqəb artıq istifadə olunur.");

            user.FirstName          = request.FirstName.Trim();
            user.LastName           = request.LastName.Trim();
            user.Nickname           = nickname;
            user.UserName           = nickname;          // ləqəb = giriş adı (qeydiyyatdakı qayda ilə eyni)
            user.NormalizedUserName = normalized;
            user.Gender             = (Gender)request.Gender;

            // E-poçt təsdiqini yalnız VERMƏK olar. Geri almaq canlı hesabı kilidləyər
            // (OnTokenValidated təsdiqlənməmiş hesabı rədd edir) və bərpa yolu paneldə yoxdur.
            if (request.ConfirmEmail && !user.EmailConfirmed)
                user.EmailConfirmed = true;

            saved = user;
            return ApiResponse<bool>.Ok(true, "İstifadəçi məlumatları yeniləndi.");
        });

        if (!result.Success || saved is null)
            return Task.FromResult(ApiResponse<AdminUserDetailResponse>.Fail(
                result.Errors.FirstOrDefault() ?? "İstifadəçi yenilənmədi."));

        return Task.FromResult(ApiResponse<AdminUserDetailResponse>.Ok(MapUserDetail(saved), result.Message));
    }

    /// <summary>
    /// Hesabın HƏMİŞƏLİK silinməsi. Geri qaytarılmır, ona görə üç sədd var:
    /// sahib hesab, adminin öz hesabı və mövcud olmayan hesab rədd edilir.
    ///
    /// Kaskad: şəxsi qeydlər (quiz cavabları, bal iddiaları, imtahan cəhdləri, VIP dövrləri,
    /// öz sinifləri) silinir; başqa müəllimlərin siyahısından çıxarılır; təlimləri saytdan
    /// yığışdırılır (soft delete); yaratdığı imtahan sessiyaları isə SİLİNMİR — onlar
    /// başqa iştirakçıların nəticə tarixçəsidir, yalnız bağlanıb arxivə keçir.
    ///
    /// Kilid sırası: Users → Vip → Exam. Əks sıra kodda heç yerdə yoxdur (deadlock riski yoxdur),
    /// hamısı bir LiteDB tranzaksiyasındadır — yarımçıq silinmiş hesab qalmır. Burada `await` YOXDUR.
    /// </summary>
    public Task<ApiResponse<bool>> DeleteUserAsync(string currentAdminId, string userId)
    {
        if (string.Equals(currentAdminId, userId, StringComparison.Ordinal))
            return Task.FromResult(ApiResponse<bool>.Fail("Öz hesabınızı silə bilməzsiniz."));

        lock (_db.UsersSyncRoot)
        lock (_db.VipSyncRoot)
        lock (_db.ExamSyncRoot)
        {
            _db.Database.BeginTrans();
            try
            {
                var actor = _db.Users.FindById(currentAdminId);
                if (actor is null || !actor.Roles.Contains(AppRoles.Admin) || !_protected.IsOwner(actor))
                {
                    _db.Database.Rollback();
                    return Task.FromResult(ApiResponse<bool>.Fail("Admin səlahiyyəti tələb olunur."));
                }

                var user = _db.Users.FindById(userId);
                if (user is null)
                {
                    _db.Database.Rollback();
                    return Task.FromResult(ApiResponse<bool>.Fail("İstifadəçi tapılmadı."));
                }
                if (_protected.IsOwner(user) || user.Roles.Contains(AppRoles.Admin))
                {
                    _db.Database.Rollback();
                    return Task.FromResult(ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage));
                }

                var now      = Now;
                var nickname = user.Nickname;

                var answers  = _db.QuizResults.DeleteMany(r => r.UserId == userId);
                var attempts = _db.ExamAttempts.DeleteMany(a => a.StudentId == userId);
                _db.VipTerms.DeleteMany(t => t.UserId == userId);
                _db.TeacherClasses.DeleteMany(c => c.TeacherId == userId);

                // Bal iddiaları "<userId>:<questionId>" açarı ilə saxlanılır. Açar kənardan gəlmir,
                // yenə də BsonExpression sətri qurmuruq — sənədlər oxunub yaddaşda süzülür.
                var prefix = userId + ":";
                foreach (var claim in _db.QuizScoreClaims.FindAll().ToList())
                {
                    var id = claim["_id"].IsString ? claim["_id"].AsString : null;
                    if (id is not null && id.StartsWith(prefix, StringComparison.Ordinal))
                        _db.QuizScoreClaims.Delete(claim["_id"]);
                }

                // Başqa müəllimlərin siyahılarında "yetim" tələbə qalmasın.
                foreach (var teacherClass in _db.TeacherClasses.FindAll().ToList())
                {
                    if (teacherClass.Students.RemoveAll(st => st.StudentId == userId) > 0)
                        _db.TeacherClasses.Update(teacherClass);
                }

                var courses = _db.Courses.Find(c => c.SubmittedByUserId == userId && !c.IsDeleted).ToList();
                foreach (var course in courses)
                {
                    course.IsDeleted       = true;
                    course.PendingRevision = null;
                    course.UpdatedAt       = now;
                    _db.Courses.Update(course);
                    UploadLedger.SyncClaims(_db, course, now);
                }

                // Sahibsiz qalan sessiyalar bağlanır ki, yeni iştirakçı qoşula bilməsin.
                var sessions = _db.ExamSessions.Find(x => x.TeacherId == userId && x.ClosedAt == null).ToList();
                foreach (var session in sessions)
                {
                    if (session.ClosedAt is not null) continue;
                    session.ClosedAt = NowMs;
                    _db.ExamSessions.Update(session);
                }

                if (!_db.Users.Delete(userId)) throw new InvalidOperationException("Hesab silinmədi.");

                _db.Database.Commit();
                return Task.FromResult(ApiResponse<bool>.Ok(true,
                    $"@{nickname} hesabı silindi: {answers} quiz cavabı, {attempts} imtahan cəhdi, " +
                    $"{courses.Count} təlim yığışdırıldı, {sessions.Count} sessiya bağlandı."));
            }
            catch { _db.Database.Rollback(); throw; }
        }
    }

    public Task<ApiResponse<bool>> ChangeUserRoleAsync(string currentAdminId, string userId, string newRole)
        => Task.FromResult(ChangeAccount(currentAdminId, userId, user =>
    {
        // Admin rolu heç kimə verilə bilməz — nə panel, nə də birbaşa API sorğusu ilə.
        // Sistem administratoru kodda sabitdir və yalnız tətbiqin başlanğıc qaydası ilə təyin olunur.
        if (string.Equals(newRole, AppRoles.Admin, StringComparison.Ordinal))
            return ApiResponse<bool>.Fail(ProtectedAccountPolicy.AdminGrantBlockedMessage);

        // Yalnız sistemdə mövcud olan rollar qəbul edilir — ixtiyari sətir rol adı kimi yazıla bilməz.
        if (!AllowedRoles.Contains(newRole))
            return ApiResponse<bool>.Fail($"Yanlış rol: {newRole}");

        // ── QORUNAN SAHİB HESABI ──────────────────────────────────────
        // Sahib hesabın rolu HEÇ KİM tərəfindən, o cümlədən özü tərəfindən dəyişdirilə bilməz.
        // Yoxlama hədəfin bazadakı e-poçtuna görə aparılır — sorğudakı ID və ya rol iddiasına deyil.
        if (_protected.IsOwner(user))
            return ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage);

        // Admin öz rolunu dəyişə bilməz: səhvən "User"-ə keçsə panelə bir daha girə bilməz.
        if (string.Equals(currentAdminId, userId, StringComparison.Ordinal))
            return ApiResponse<bool>.Fail("Öz rolunuzu bu paneldən dəyişə bilməzsiniz.");

        var currentRoles = user.Roles;

        if (currentRoles.Count == 1 && currentRoles[0] == newRole)
            return ApiResponse<bool>.Ok(true, "İstifadəçi artıq bu roldadır.");

        // ── MÜƏLLİM ROLUNUN GERİ ALINMASI ─────────────────────────────
        // İstifadəçi öz rolunu dəyişəndə (UserService.ChangeRoleAsync) sistem bütün
        // siniflərin silinməsini tələb edir. Admin paneli bu qaydadan kənarda idi:
        // buradan edilən dəyişiklik müəllimdən rolu alır, lakin sinifləri yerində qoyurdu.
        // Nəticə "yetim" sinif olur — sahibi rolu olmadığı üçün onu nə görə, nə də silə bilir,
        // rol geri qaytarılanda isə sinif birdən yenidən peyda olur.
        // Qayda sistemdə bir dənə olmalıdır, ona görə admin yolu da eyni şərti tələb edir.
        if (currentRoles.Contains(AppRoles.Teacher) && newRole != AppRoles.Teacher)
        {
            var classCount = _db.TeacherClasses.Count(c => c.TeacherId == user.Id);
            if (classCount > 0)
                return ApiResponse<bool>.Fail(
                    $"Bu müəllimin {classCount} sinfi var. Rol dəyişməzdən əvvəl siniflər silinməlidir.");
        }

        // ── VIP DÖVRÜ ────────────────────────────────────────────────
        // VIP rolu = üzvlük. Rol verilərkən aktiv dövr yoxdursa 30 günlük dövr (1 təlim krediti) açılır;
        // rol geri alınarkən qalan dövrlər bitirilir ki, kredit rolsuz qalmasın.
        // VipSyncRoot burada UsersSyncRoot-un İÇİNDƏ alınır; əks sıra heç yerdə yoxdur (deadlock riski yoxdur).
        lock (_db.VipSyncRoot)
        {
            if (newRole == AppRoles.VIP && VipEntitlements.ActiveTerm(_db, user.Id, Now) is null)
                VipEntitlements.StartTerm(_db, user.Id, Now, VipPolicy.SourceAdmin, currentAdminId);
            else if (currentRoles.Contains(AppRoles.VIP) && newRole != AppRoles.VIP)
                VipEntitlements.EndTerms(_db, user.Id, Now);
        }

        user.Roles = [newRole];
        RevokeSessions(user);

        return ApiResponse<bool>.Ok(true, $"Rol {newRole} olaraq dəyişdirildi.");
    }));

    public Task<ApiResponse<bool>> StartVipTermAsync(string currentAdminId, string userId)
        => Task.FromResult(ChangeAccount(currentAdminId, userId, user =>
    {
        if (_protected.IsOwner(user))
            return ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage);
        if (string.Equals(currentAdminId, userId, StringComparison.Ordinal))
            return ApiResponse<bool>.Fail("Öz hesabınıza VIP dövrü aça bilməzsiniz.");
        if (user.Roles.Contains(AppRoles.Teacher) && _db.TeacherClasses.Count(c => c.TeacherId == user.Id) > 0)
            return ApiResponse<bool>.Fail("Bu müəllimin sinifləri var. VIP rolu verməzdən əvvəl siniflər silinməlidir.");

        var now = Now;
        VipTerm term;
        lock (_db.VipSyncRoot)
        {
            term = VipEntitlements.StartTerm(_db, user.Id, now, VipPolicy.SourceAdmin, currentAdminId);
        }

        var roleChanged = !user.Roles.Contains(AppRoles.VIP);
        if (roleChanged)
        {
            user.Roles = [AppRoles.VIP];
            RevokeSessions(user); // rol dəyişdi — canlı sessiyalar köhnə rolla davam etməsin
        }

        var message = term.StartsAt > now
            ? $"Yeni VIP dövrü mövcud dövrün ardınca {term.StartsAt:dd.MM.yyyy} tarixindən başlayacaq ({term.EndsAt:dd.MM.yyyy} tarixinədək, {term.CourseAllowance} təlim)."
            : $"VIP dövrü açıldı: {term.EndsAt:dd.MM.yyyy} tarixinədək, {term.CourseAllowance} təlim krediti.";
        return ApiResponse<bool>.Ok(true, roleChanged ? "VIP rolu verildi. " + message : message);
    }));

    public Task<ApiResponse<bool>> ToggleUserBlockAsync(string currentAdminId, string userId)
        => Task.FromResult(ChangeAccount(currentAdminId, userId, user =>
    {
        // Admin özünü bloklasa hesabına bir daha girə bilməz — bərpası yalnız baza faylına müdaxilə ilə mümkündür.
        if (string.Equals(currentAdminId, userId, StringComparison.Ordinal))
            return ApiResponse<bool>.Fail("Öz hesabınızı bloklaya bilməzsiniz.");

        // Sahib hesabı bloklana bilməz — əks halda bir admin platformanın sahibini
        // öz sistemindən kənarlaşdıra bilərdi.
        if (_protected.IsOwner(user))
            return ApiResponse<bool>.Fail(ProtectedAccountPolicy.OwnerImmutableMessage);

        // Admin bloku ayrıca bayraqla izlənir: brute-force-dan gələn 5 dəqiqəlik LockoutEnd "bloklanıb" sayılmır,
        // yəni admin belə hesabı bloklamaq istəyəndə düymə əksinə kilidi açmır (audit L9).
        if (user.BlockedByAdminAt is null)
        {
            user.BlockedByAdminAt = Now;
            user.LockoutEnabled   = true;
            user.LockoutEnd       = DateTimeOffset.MaxValue;
            RevokeSessions(user);

            return ApiResponse<bool>.Ok(true, "İstifadəçi bloklandı.");
        }

        user.BlockedByAdminAt  = null;
        user.LockoutEnd        = null;
        user.AccessFailedCount = 0;
        RevokeSessions(user);

        return ApiResponse<bool>.Ok(true, "İstifadəçinin bloku götürüldü.");
    }));

    // ═══════════════════════════════════════════════════════════
    // İMTAHAN SESSİYALARI (real ExamSession qeydləri)
    // ═══════════════════════════════════════════════════════════

    public Task<ApiResponse<List<AdminExamSessionResponse>>> GetExamSessionsAsync(
        string? search = null, int take = 200)
    {
        var limit  = Math.Clamp(take, 1, MaxExamSessionPageSize);
        var needle = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLowerInvariant();

        // Ləqəblər və cəhd sayğacları BİR dəfə yüklənir — sessiya başına ayrı sorğu (N+1) yoxdur.
        var hosts = _db.Users.FindAll().ToDictionary(u => u.Id, u => u, StringComparer.Ordinal);

        var attemptsBySession = new Dictionary<string, (int Total, int Submitted, decimal ScoreSum)>(StringComparer.Ordinal);
        foreach (var attempt in _db.ExamAttempts.FindAll())
        {
            // Gizli hesab heç bir iştirakçı sayında görünmür.
            if (hosts.TryGetValue(attempt.StudentId, out var student) && ProtectedAccountPolicy.IsHiddenAccount(student))
                continue;

            attemptsBySession.TryGetValue(attempt.SessionId, out var acc);
            acc.Total++;
            if (attempt.SubmittedAt is not null)
            {
                acc.Submitted++;
                acc.ScoreSum += attempt.CorrectCount ?? 0;
            }
            attemptsBySession[attempt.SessionId] = acc;
        }

        var sessions = _db.ExamSessions.FindAll()
            .Where(x => needle is null ||
                        x.Title.ToLowerInvariant().Contains(needle) ||
                        x.Code.ToLowerInvariant().Contains(needle) ||
                        x.TeacherName.ToLowerInvariant().Contains(needle))
            .OrderByDescending(x => x.CreatedAt)
            .Take(limit)
            .Select(x => MapSession(x, hosts, attemptsBySession))
            .ToList();

        return Task.FromResult(ApiResponse<List<AdminExamSessionResponse>>.Ok(sessions));
    }

    public Task<ApiResponse<AdminExamSessionDetailResponse>> GetExamSessionDetailAsync(string sessionId)
    {
        var session = _db.ExamSessions.FindById(sessionId);
        if (session is null)
            return Task.FromResult(ApiResponse<AdminExamSessionDetailResponse>.Fail("Sessiya tapılmadı."));

        var users = _db.Users.FindAll().ToDictionary(u => u.Id, u => u, StringComparer.Ordinal);
        var attempts = _db.ExamAttempts.Find(a => a.SessionId == session.Id)
            .Where(a => !(users.TryGetValue(a.StudentId, out var s) && ProtectedAccountPolicy.IsHiddenAccount(s)))
            .OrderBy(a => a.StartedAt)
            .ToList();

        var participants = attempts.Select(a => new AdminExamParticipantResponse
        {
            Id            = a.Id,
            StudentId     = a.StudentId,
            Name          = a.StudentName,
            // E-poçt yalnız Admin proyeksiyasındadır — müəllim panelində belə göstərilmir.
            Email         = users.TryGetValue(a.StudentId, out var user) ? user.Email : null,
            StartedAt     = Date(a.StartedAt),
            SubmittedAt   = NullableDate(a.SubmittedAt),
            AnsweredCount = a.Answers.Count,
            CorrectCount  = a.CorrectCount,
            Percentage    = a.CorrectCount is { } correct && session.Questions.Count > 0
                ? Math.Round(correct * 100m / session.Questions.Count, 2)
                : null
        }).ToList();

        var counters = new Dictionary<string, (int Total, int Submitted, decimal ScoreSum)>(StringComparer.Ordinal)
        {
            [session.Id] = (attempts.Count, attempts.Count(a => a.SubmittedAt is not null),
                            attempts.Where(a => a.SubmittedAt is not null).Sum(a => (decimal)(a.CorrectCount ?? 0)))
        };

        return Task.FromResult(ApiResponse<AdminExamSessionDetailResponse>.Ok(new AdminExamSessionDetailResponse
        {
            Session      = MapSession(session, users, counters),
            Participants = participants
        }));
    }

    // ═══════════════════════════════════════════════════════════
    // KÖMƏKÇİLƏR
    // ═══════════════════════════════════════════════════════════

    /// <summary>Bir sorğuda qaytarıla bilən maksimum istifadəçi sayı — yaddaş sərhədi.</summary>
    private const int MaxUserPageSize = 100;

    /// <summary>Bir sorğuda qaytarıla bilən maksimum imtahan sessiyası.</summary>
    private const int MaxExamSessionPageSize = 200;

    /// <summary>Cari UTC vaxt, imtahan qeydlərindəki unix-ms formatında (ExamSessionService ilə eyni).</summary>
    private long NowMs => _clock.GetUtcNow().ToUnixTimeMilliseconds();

    private static DateTime Date(long value) => DateTimeOffset.FromUnixTimeMilliseconds(value).UtcDateTime;
    private static DateTime? NullableDate(long? value) => value is { } v ? Date(v) : null;

    /// <summary>Sessiya sətrinin görünüşü — siyahı və detal eyni xəritələməni işlədir.</summary>
    private static AdminExamSessionResponse MapSession(
        ExamSession x,
        Dictionary<string, AppUser> users,
        Dictionary<string, (int Total, int Submitted, decimal ScoreSum)> counters)
    {
        counters.TryGetValue(x.Id, out var acc);
        var host = users.GetValueOrDefault(x.TeacherId);

        return new AdminExamSessionResponse
        {
            Id              = x.Id,
            Code            = x.Code,
            Title           = x.Title,
            HostName        = host?.Nickname ?? x.TeacherName,
            // Sahib gizli hesabdırsa Id verilmir — admin kartına keçid onsuz da bağlıdır.
            HostId          = host is not null && !ProtectedAccountPolicy.IsHiddenAccount(host) ? host.Id : null,
            DurationMinutes = x.DurationMinutes,
            QuestionCount   = x.Questions.Count,
            CreatedAt       = Date(x.CreatedAt),
            ClosedAt        = NullableDate(x.ClosedAt),
            Status          = x.ClosedAt is not null ? "Bağlı" : "Aktiv",
            ParticipantCount = acc.Total,
            SubmittedCount   = acc.Submitted,
            AverageScore     = acc.Submitted > 0 && x.Questions.Count > 0
                ? Math.Round(acc.ScoreSum * 100m / (acc.Submitted * x.Questions.Count), 2)
                : null
        };
    }

    /// <summary>
    /// İstifadəçi kartı — profil + VIP dövrü + fəaliyyət sayğacları.
    /// Sayğaclar hər çağırışda canlı hesablanır; kart yalnız bir hesab üçün açıldığından
    /// bu, siyahı yolundakı kimi N+1 problemi yaratmır.
    /// </summary>
    private AdminUserDetailResponse MapUserDetail(AppUser u)
    {
        var now  = Now;
        var term = VipEntitlements.ActiveTerm(_db, u.Id, now);

        int answered = 0, correct = 0;
        DateTime? lastActivity = null;
        foreach (var result in _db.QuizResults.Find(r => r.UserId == u.Id))
        {
            answered++;
            if (result.IsCorrect) correct++;
            if (lastActivity is null || result.AnsweredAt > lastActivity) lastActivity = result.AnsweredAt;
        }

        var courses = _db.Courses.Find(c => c.SubmittedByUserId == u.Id && !c.IsDeleted).ToList();

        return new AdminUserDetailResponse
        {
            Id               = u.Id,
            Nickname         = u.Nickname,
            FirstName        = u.FirstName,
            LastName         = u.LastName,
            Email            = u.Email ?? string.Empty,
            Roles            = u.Roles.ToList(),
            IsEmailConfirmed = u.EmailConfirmed,
            IsBlocked        = u.BlockedByAdminAt is not null,
            IsTemporarilyLocked = u.BlockedByAdminAt is null && u.LockoutEnd is not null && u.LockoutEnd > _clock.GetUtcNow(),
            JoinDate         = u.CreatedAt.ToString("yyyy-MM-dd"),
            VipTermEndsAt    = term?.EndsAt,
            VipCoursesRemaining = term is null ? null : Math.Max(0, term.CourseAllowance - term.CoursesUsed),

            Gender          = (int)u.Gender,
            ProfileImageUrl = u.ProfileImageUrl,
            PendingNewEmail = u.PendingNewEmail,
            LockoutEnd      = u.LockoutEnd,
            FailedAttempts  = u.AccessFailedCount,
            CreatedAt       = u.CreatedAt,

            HasActiveVipTerm   = term is not null,
            VipTermStartsAt    = term?.StartsAt,
            VipCourseAllowance = term?.CourseAllowance ?? 0,
            VipCoursesUsed     = term?.CoursesUsed ?? 0,
            VipTermCount       = _db.VipTerms.Count(t => t.UserId == u.Id && !t.IsDeleted),

            CourseCount       = courses.Count,
            ActiveCourseCount = courses.Count(c => c.Status == CourseStatus.Approved),
            ExamSessionCount  = _db.ExamSessions.Count(x => x.TeacherId == u.Id),
            ExamAttemptCount  = _db.ExamAttempts.Count(a => a.StudentId == u.Id),
            TeacherClassCount = _db.TeacherClasses.Count(c => c.TeacherId == u.Id),
            AnsweredQuestions = answered,
            CorrectAnswers    = correct,
            LastActivityAt    = lastActivity
        };
    }

    // CreatedAt azalan; bərabər tarixdə Id-yə görə sabit sıra (eyni nəticə təkrarlanan sorğularda).
    private static int NewestFirst(AppUser a, AppUser b)
    {
        int byDate = b.CreatedAt.CompareTo(a.CreatedAt);
        return byDate != 0 ? byDate : string.CompareOrdinal(a.Id, b.Id);
    }

    // Axtarış ləqəb, e-poçt, ad və soyad üzrə aparılır — admin panelindəki cədvəl sütunları ilə eyni.
    private static bool MatchesSearch(AppUser user, string needle)
        => (user.Nickname?.ToLowerInvariant().Contains(needle) ?? false)
        || (user.Email?.ToLowerInvariant().Contains(needle) ?? false)
        || (user.FirstName?.ToLowerInvariant().Contains(needle) ?? false)
        || (user.LastName?.ToLowerInvariant().Contains(needle) ?? false);

    private static readonly HashSet<string> AllowedRoles = new(StringComparer.Ordinal)
    {
        AppRoles.Moderator, AppRoles.VIP, AppRoles.User, AppRoles.Teacher
    };

    // Actor authorization, last-admin checks and revocation share one LiteDB transaction.
    // No await is allowed here: LiteDB transactions belong to the current thread.
    private ApiResponse<bool> ChangeAccount(string actorId, string userId, Func<AppUser, ApiResponse<bool>> change)
    {
        lock (_db.UsersSyncRoot)
        {
            _db.Database.BeginTrans();
            try
            {
                var actor = _db.Users.FindById(actorId);
                if (actor is null || !actor.EmailConfirmed || actor.LockoutEnd > DateTimeOffset.UtcNow ||
                    !actor.Roles.Contains(AppRoles.Admin) || !_protected.IsOwner(actor))
                {
                    _db.Database.Rollback();
                    return ApiResponse<bool>.Fail("Admin səlahiyyəti tələb olunur.");
                }
                var user = _db.Users.FindById(userId);
                if (user is null)
                {
                    _db.Database.Rollback();
                    return ApiResponse<bool>.Fail("İstifadəçi tapılmadı.");
                }
                var result = change(user);
                if (!result.Success) { _db.Database.Rollback(); return result; }
                user.ConcurrencyStamp = Guid.NewGuid().ToString();
                if (!_db.Users.Update(user)) throw new InvalidOperationException("Hesab yenilənmədi.");
                _db.Database.Commit();
                return result;
            }
            catch { _db.Database.Rollback(); throw; }
        }
    }

    private static void RevokeSessions(AppUser user)
    {
        user.SecurityStamp = Guid.NewGuid().ToString();
        user.RefreshSessions.Clear();
        user.GoogleLoginCodeHash = null;
        user.GoogleLoginCodeExpiryTime = null;
    }

    private ApiResponse<bool> SetCourseStatus(int courseId, CourseStatus status, string message)
        => CourseWrite(courseId, course =>
        {
            var now = Now;
            if (status == CourseStatus.Approved && course.Status != CourseStatus.Approved)
            {
                // Təsdiq anından 30 günlük aktiv müddət açılır (həm ilk nəşr, həm yenidən aktivləşdirmə).
                // Admin panelindən əlavə edilən (sahibsiz) təlimlər müddətsizdir.
                course.PublishedAt = now;
                course.ExpiresAt   = course.SubmittedByUserId is null ? null : now.AddDays(VipPolicy.CourseActiveDays);
            }
            if (status != CourseStatus.Approved)
                course.PendingRevision = null; // saytdan çıxarılan təlimin gözləyən redaktəsi mənasızdır
            course.Status = status;
            return ApiResponse<bool>.Ok(true, message);
        });

    // Təlim status/məzmun yazıları CourseService ilə eyni kilid altında — kredit istifadəsi,
    // müddət süpürgəsi və admin təsdiqi bir-birinin üstündən yazmır. No await inside.
    private ApiResponse<bool> CourseWrite(int courseId, Func<Course, ApiResponse<bool>> change)
    {
        lock (_db.VipSyncRoot)
        {
            _db.Database.BeginTrans();
            try
            {
                var course = _db.Courses.FindOne(c => c.Id == courseId && !c.IsDeleted);
                if (course is null) { _db.Database.Rollback(); return ApiResponse<bool>.Fail("Təlim tapılmadı."); }
                var result = change(course);
                if (!result.Success) { _db.Database.Rollback(); return result; }
                var now = Now;
                course.UpdatedAt = now;
                _db.Courses.Update(course);
                UploadLedger.SyncClaims(_db, course, now); // canlı + gözləyən məzmunun faylları bağlı qalır
                _db.Database.Commit();
                return result;
            }
            catch { _db.Database.Rollback(); throw; }
        }
    }

    private static AdminCourseResponse MapCourse(Course c, Dictionary<string, string>? owners) => new()
    {
        Id             = c.Id,
        Title          = c.CourseTitle,
        Instructor     = c.InstructorName,
        Category       = c.Category ?? "—",
        Status         = c.Status.ToString(),
        CreatedAt      = c.CreatedAt.ToString("yyyy-MM-dd"),
        Link           = c.Link,
        OwnerId        = c.SubmittedByUserId,
        OwnerNickname  = c.SubmittedByUserId is not null && owners is not null && owners.TryGetValue(c.SubmittedByUserId, out var nick) ? nick : null,
        PublishedAt    = c.PublishedAt,
        ExpiresAt      = c.ExpiresAt,
        PendingRevision = CourseService.RevisionView(c.PendingRevision),
        Content        = CourseService.ContentView(c),
        IsReactivation = c.Status == CourseStatus.Pending && c.PublishedAt is not null
    };
}
