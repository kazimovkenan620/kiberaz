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
    private readonly LiteDbContext        _db;
    private readonly UserManager<AppUser> _userManager;

    public AdminService(LiteDbContext db, UserManager<AppUser> userManager)
    {
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

        var stats = new AdminStatsResponse
        {
            TotalUsers       = _db.Users.Count(),
            TotalCourses     = courses.Count,
            PendingCourses   = courses.Count(c => c.Status == CourseStatus.Pending),
            TotalExams       = categories.Count,
            ActiveExams      = categories.Count(c => categoryIdsWithQuestions.Contains(c.Id)),
            NewUsersThisWeek = _db.Users.Find(u => u.CreatedAt >= weekAgo).Count()
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

    public Task<ApiResponse<List<AdminUserResponse>>> GetUsersAsync()
    {
        var now = DateTimeOffset.UtcNow;

        var users = _db.Users
            .FindAll()
            .OrderByDescending(u => u.CreatedAt)
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

        return Task.FromResult(ApiResponse<List<AdminUserResponse>>.Ok(users));
    }

    public async Task<ApiResponse<bool>> ChangeUserRoleAsync(string currentAdminId, string userId, string newRole)
    {
        // Yalnız sistemdə mövcud olan rollar qəbul edilir — ixtiyari sətir rol adı kimi yazıla bilməz.
        if (!AllowedRoles.Contains(newRole))
            return ApiResponse<bool>.Fail($"Yanlış rol: {newRole}");

        // Admin öz rolunu dəyişə bilməz: səhvən "User"-ə keçsə panelə bir daha girə bilməz.
        if (string.Equals(currentAdminId, userId, StringComparison.Ordinal))
            return ApiResponse<bool>.Fail("Öz rolunuzu bu paneldən dəyişə bilməzsiniz.");

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<bool>.Fail("İstifadəçi tapılmadı.");

        var currentRoles = await _userManager.GetRolesAsync(user);

        if (currentRoles.Count == 1 && currentRoles[0] == newRole)
            return ApiResponse<bool>.Ok(true, "İstifadəçi artıq bu roldadır.");

        // Son admini adi istifadəçiyə çevirmək platformanı idarəçisiz qoyar.
        if (currentRoles.Contains(AppRoles.Admin) && newRole != AppRoles.Admin && CountAdmins() <= 1)
            return ApiResponse<bool>.Fail("Sistemdəki son admin rolunu geri ala bilməzsiniz.");

        foreach (var role in currentRoles)
            await _userManager.RemoveFromRoleAsync(user, role);

        await _userManager.AddToRoleAsync(user, newRole);

        // Rollar JWT claim-i kimi daşınır. Damğa yenilənməsə istifadəçi əlindəki tokenlə
        // 15 dəqiqəyə qədər KÖHNƏ səlahiyyətlərlə işləməyə davam edərdi.
        await _userManager.UpdateSecurityStampAsync(user);

        return ApiResponse<bool>.Ok(true, $"Rol {newRole} olaraq dəyişdirildi.");
    }

    public async Task<ApiResponse<bool>> ToggleUserBlockAsync(string currentAdminId, string userId)
    {
        // Admin özünü bloklasa hesabına bir daha girə bilməz — bərpası yalnız baza faylına müdaxilə ilə mümkündür.
        if (string.Equals(currentAdminId, userId, StringComparison.Ordinal))
            return ApiResponse<bool>.Fail("Öz hesabınızı bloklaya bilməzsiniz.");

        var user = await _userManager.FindByIdAsync(userId);
        if (user is null)
            return ApiResponse<bool>.Fail("İstifadəçi tapılmadı.");

        var isBlocked = user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow;

        if (!isBlocked)
        {
            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Contains(AppRoles.Admin) && CountAdmins() <= 1)
                return ApiResponse<bool>.Fail("Sistemdəki son admini bloklaya bilməzsiniz.");

            user.LockoutEnabled = true;
            user.LockoutEnd     = DateTimeOffset.MaxValue;
            user.RefreshToken   = null;
            user.RefreshTokenExpiryTime = null;
            await _userManager.UpdateAsync(user);

            // Bloklamaq kifayət deyil: əlindəki access token hələ etibarlıdır.
            // Damğa yenilənəndə OnTokenValidated onu dərhal rədd edir — blok ANİ qüvvəyə minir.
            await _userManager.UpdateSecurityStampAsync(user);

            return ApiResponse<bool>.Ok(true, "İstifadəçi bloklandı.");
        }

        user.LockoutEnd        = null;
        user.AccessFailedCount = 0;
        await _userManager.UpdateAsync(user);

        return ApiResponse<bool>.Ok(true, "İstifadəçinin bloku götürüldü.");
    }

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
        var participants = _db.QuizResults
            .FindAll()
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

        var category = _db.QuizCategories.FindOne(c => c.Id == categoryId && !c.IsDeleted);
        if (category is null)
            return Task.FromResult(ApiResponse<bool>.Fail("İmtahan tapılmadı."));

        category.IsDeleted = true;
        category.UpdatedAt = DateTime.UtcNow;
        _db.QuizCategories.Update(category);

        // Kateqoriya silinəndə sualları da soft delete edilir (QuizService ilə eyni cascade davranışı).
        var questions = _db.QuizQuestions
            .Find(q => q.QuizCategoryId == categoryId && !q.IsDeleted)
            .ToList();

        foreach (var q in questions)
        {
            q.IsDeleted = true;
            q.UpdatedAt = DateTime.UtcNow;
        }

        if (questions.Count > 0)
            _db.QuizQuestions.Update(questions);

        return Task.FromResult(ApiResponse<bool>.Ok(true, "İmtahan silindi."));
    }

    // ═══════════════════════════════════════════════════════════
    // KÖMƏKÇİLƏR
    // ═══════════════════════════════════════════════════════════

    private static readonly HashSet<string> AllowedRoles = new(StringComparer.Ordinal)
    {
        AppRoles.Admin, AppRoles.Moderator, AppRoles.VIP, AppRoles.User, AppRoles.Teacher
    };

    // Admin sayı birbaşa embed edilmiş Roles siyahısından hesablanır — UserManager ilə
    // hər istifadəçi üçün ayrıca sorğu göndərmək N+1 yaradardı.
    private int CountAdmins()
        => _db.Users.FindAll().Count(u => u.Roles.Any(r => r.Equals(AppRoles.Admin, StringComparison.OrdinalIgnoreCase)));

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
