using Microsoft.AspNetCore.Identity;
using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.DTOs.Common;
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

    public AdminService(LiteDbContext db, UserManager<AppUser> userManager, ProtectedAccountPolicy protectedAccounts)
    {
        _protected   = protectedAccounts;
        _db          = db;
        _userManager = userManager;
    }

    // ═══════════════════════════════════════════════════════════
    // STATİSTİKA
    // ═══════════════════════════════════════════════════════════

    public Task<ApiResponse<AdminStatsResponse>> GetStatsAsync()
    {
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        var courses    = _db.Courses.Find(c => !c.IsDeleted).ToList();
        var categories = _db.QuizCategories.Find(c => !c.IsDeleted).ToList();

        // Sualı olan kateqoriya "aktiv imtahan" sayılır — sualsız kateqoriyada test həll etmək mümkün deyil.
        var categoryIdsWithQuestions = _db.QuizQuestions
            .Find(q => !q.IsDeleted)
            .Select(q => q.QuizCategoryId)
            .ToHashSet();

        // Sistem administratoru istifadəçi/qeydiyyat göstəricilərinə daxil edilmir.
        // Müdafiə məqsədilə bazada qalmış istənilən qeyri-qanuni Admin rolu da sayılmır.
        var ordinaryUsers = _db.Users.FindAll()
            .Where(u => !ProtectedAccountPolicy.IsHiddenAccount(u))
            .ToList();

        var stats = new AdminStatsResponse
        {
            TotalUsers       = ordinaryUsers.Count,
            TotalCourses     = courses.Count,
            PendingCourses   = courses.Count(c => c.Status == CourseStatus.Pending),
            TotalExams       = categories.Count,
            ActiveExams      = categories.Count(c => categoryIdsWithQuestions.Contains(c.Id)),
            NewUsersThisWeek = ordinaryUsers.Count(u => u.CreatedAt >= weekAgo)
        };

        return Task.FromResult(ApiResponse<AdminStatsResponse>.Ok(stats));
    }

    // ═══════════════════════════════════════════════════════════
    // TƏLİMLƏR
    // ═══════════════════════════════════════════════════════════

    public Task<ApiResponse<List<AdminCourseResponse>>> GetCoursesAsync()
    {
        // Moderasiya gözləyənlər HƏMİŞƏ ən üstdə olur — admin siyahını aşağı sürüşdürüb
        // gözləyən müraciəti gözdən qaçırmasın deyə. Sonra ən yeni tarixə görə sıralanır.
        var courses = _db.Courses
            .Find(c => !c.IsDeleted)
            .OrderBy(c => c.Status == CourseStatus.Pending ? 0 : 1)
            .ThenByDescending(c => c.CreatedAt)
            .Select(MapCourse)
            .ToList();

        return Task.FromResult(ApiResponse<List<AdminCourseResponse>>.Ok(courses));
    }

    public Task<ApiResponse<bool>> ApproveCourseAsync(int courseId)
        => Task.FromResult(SetCourseStatus(courseId, CourseStatus.Approved, "Təlim təsdiqləndi."));

    public Task<ApiResponse<bool>> RejectCourseAsync(int courseId)
        => Task.FromResult(SetCourseStatus(courseId, CourseStatus.Rejected, "Təlim rədd edildi."));

    public Task<ApiResponse<bool>> DeleteCourseAsync(int courseId)
    {
        var course = _db.Courses.FindOne(c => c.Id == courseId && !c.IsDeleted);
        if (course is null)
            return Task.FromResult(ApiResponse<bool>.Fail("Təlim tapılmadı."));

        // Fiziki silmə yox, soft delete — layihənin qalan hissəsi ilə eyni davranış.
        course.IsDeleted = true;
        course.UpdatedAt = DateTime.UtcNow;
        _db.Courses.Update(course);

        return Task.FromResult(ApiResponse<bool>.Ok(true, "Təlim silindi."));
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

            // Admin əl ilə əlavə etdiyi üçün moderasiyaya ehtiyac yoxdur.
            Status         = CourseStatus.Approved,

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

        return Task.FromResult(ApiResponse<AdminCourseResponse>.Ok(MapCourse(course), "Təlim əlavə edildi."));
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
                IsBlocked        = u.LockoutEnd is not null && u.LockoutEnd > now,
                JoinDate         = u.CreatedAt.ToString("yyyy-MM-dd")
            })
            .ToList();

        // Mesaj YALNIZ hədd dolduqda doldurulur. Əks halda boş qalır ki, panel
        // hər yükləmədə lazımsız bildiriş göstərməsin (cədvəl başlığında onsuz da say var).
        var message = matched > users.Count
            ? $"{matched} istifadəçidən ən yeni {users.Count} göstərilir. Dəqiqləşdirmək üçün axtarışdan istifadə edin."
            : string.Empty;

        return Task.FromResult(ApiResponse<List<AdminUserResponse>>.Ok(users, message));
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

        user.Roles = [newRole];
        RevokeSessions(user);

        return ApiResponse<bool>.Ok(true, $"Rol {newRole} olaraq dəyişdirildi.");
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

        var isBlocked = user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow;

        if (!isBlocked)
        {
            user.LockoutEnabled = true;
            user.LockoutEnd     = DateTimeOffset.MaxValue;
            RevokeSessions(user);

            return ApiResponse<bool>.Ok(true, "İstifadəçi bloklandı.");
        }

        user.LockoutEnd        = null;
        user.AccessFailedCount = 0;
        RevokeSessions(user);

        return ApiResponse<bool>.Ok(true, "İstifadəçinin bloku götürüldü.");
    }));

    // ═══════════════════════════════════════════════════════════
    // İMTAHANLAR (quiz kateqoriyaları)
    // ═══════════════════════════════════════════════════════════

    public Task<ApiResponse<List<AdminExamResponse>>> GetExamsAsync()
    {
        var categories = _db.QuizCategories
            .Find(c => !c.IsDeleted)
            .OrderBy(c => c.SortOrder)
            .ToList();

        // N+1 qarşısı: sual sayları və iştirakçılar bir dəfə yüklənib qruplaşdırılır.
        var questionCounts = _db.QuizQuestions
            .Find(q => !q.IsDeleted)
            .GroupBy(q => q.QuizCategoryId)
            .ToDictionary(g => g.Key, g => g.Count());

        // İştirakçı sayı UYDURMA DEYİL — həmin kateqoriyada cavab vermiş unikal istifadəçi sayıdır.
        var hiddenUserIds = _db.Users
            .FindAll()
            .Where(u => ProtectedAccountPolicy.IsHiddenAccount(u))
            .Select(u => u.Id)
            .ToHashSet(StringComparer.Ordinal);
        var participants = _db.QuizResults
            .FindAll()
            .Where(r => !hiddenUserIds.Contains(r.UserId))
            .GroupBy(r => r.CategoryId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.UserId).Distinct().Count());

        var exams = categories.Select(c =>
        {
            int questionCount = questionCounts.GetValueOrDefault(c.Id, 0);
            int studentCount  = participants.GetValueOrDefault(c.Id, 0);

            // Sualı yoxdursa hələ həll edilə bilməz → "Gözlənilir".
            // Sualı var, amma heç kim toxunmayıbsa da "Gözlənilir" — real iştirak yoxdur.
            string status = questionCount == 0 ? "Gözlənilir"
                          : studentCount  == 0 ? "Gözlənilir"
                          : "Aktiv";

            return new AdminExamResponse
            {
                Id           = c.Id.ToString(),
                Title        = c.Title,
                Instructor   = "Kiberaz.az",
                StudentCount = studentCount,
                Duration     = $"{questionCount} sual",
                Status       = status,
                Category     = c.Title,
                CreatedAt    = c.CreatedAt.ToString("yyyy-MM-dd")
            };
        }).ToList();

        return Task.FromResult(ApiResponse<List<AdminExamResponse>>.Ok(exams));
    }

    public Task<ApiResponse<bool>> DeleteExamAsync(string examId)
    {
        if (!int.TryParse(examId, out var categoryId))
            return Task.FromResult(ApiResponse<bool>.Fail("Yanlış imtahan ID-si."));

        // Kateqoriya + onun sualları BİR tranzaksiyada silinir (QuizService.DeleteCategoryAsync ilə
        // eyni davranış və eyni kilid). Ayrı-ayrı yazıldıqda proses aradakı pəncərədə dayansa
        // kateqoriya siyahıdan itir, sualları isə canlı qalır və bal verməyə davam edirdi.
        // Tranzaksiya thread-ə bağlıdır — burada `await` YOXDUR.
        lock (_db.QuizSyncRoot)
        {
            _db.Database.BeginTrans();
            try
            {
                var category = _db.QuizCategories.FindOne(c => c.Id == categoryId && !c.IsDeleted);
                if (category is null)
                {
                    _db.Database.Rollback();
                    return Task.FromResult(ApiResponse<bool>.Fail("İmtahan tapılmadı."));
                }

                var now = DateTime.UtcNow;

                category.IsDeleted = true;
                category.UpdatedAt = now;
                _db.QuizCategories.Update(category);

                var questions = _db.QuizQuestions
                    .Find(q => q.QuizCategoryId == categoryId && !q.IsDeleted)
                    .ToList();

                foreach (var q in questions)
                {
                    q.IsDeleted = true;
                    q.UpdatedAt = now;
                }

                if (questions.Count > 0)
                    _db.QuizQuestions.Update(questions);

                _db.Database.Commit();
                return Task.FromResult(ApiResponse<bool>.Ok(true, "İmtahan silindi."));
            }
            catch { _db.Database.Rollback(); throw; }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // KÖMƏKÇİLƏR
    // ═══════════════════════════════════════════════════════════

    /// <summary>Bir sorğuda qaytarıla bilən maksimum istifadəçi sayı — yaddaş sərhədi.</summary>
    private const int MaxUserPageSize = 100;

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
        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        user.GoogleLoginCodeHash = null;
        user.GoogleLoginCodeExpiryTime = null;
    }

    private ApiResponse<bool> SetCourseStatus(int courseId, CourseStatus status, string message)
    {
        var course = _db.Courses.FindOne(c => c.Id == courseId && !c.IsDeleted);
        if (course is null)
            return ApiResponse<bool>.Fail("Təlim tapılmadı.");

        course.Status    = status;
        course.UpdatedAt = DateTime.UtcNow;
        _db.Courses.Update(course);

        return ApiResponse<bool>.Ok(true, message);
    }

    private static AdminCourseResponse MapCourse(Course c) => new()
    {
        Id         = c.Id,
        Title      = c.CourseTitle,
        Instructor = c.InstructorName,
        Category   = c.Category ?? "—",
        Status     = c.Status.ToString(),
        CreatedAt  = c.CreatedAt.ToString("yyyy-MM-dd"),
        Link       = c.Link
    };
}
