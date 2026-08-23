using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// Təlim idarəetmə servisi.
/// CRUD əməliyyatlarını LiteDbContext vasitəsilə həyata keçirir.
///
/// EF Core → LiteDB dəyişiklikləri:
/// - AppDbContext → LiteDbContext
/// - .AddAsync() + .SaveChangesAsync() → .Insert()
/// - .AsNoTracking().ToListAsync() → .FindAll() / .Find()
/// - .FirstOrDefaultAsync() → .FindOne()
/// - SyllabusTopics: JSON serialize/deserialize → birbaşa List{string}
/// </summary>
public class CourseService : ICourseService
{
    private readonly LiteDbContext _db;

    public CourseService(LiteDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Yeni təlim yaradır və LiteDB-yə yazır.
    /// Status default olaraq Approved-dir.
    /// </summary>
    public Task<ApiResponse<CourseResponse>> CreateCourseAsync(CreateCourseRequest request, string? userId)
    {
        var course = new Course
        {
            InstructorName    = request.InstructorName.Trim(),
            InstructorRole    = request.InstructorRole.Trim(),
            InstructorCompany = request.InstructorCompany?.Trim(),
            InstructorPhotoUrl = request.InstructorPhotoUrl?.Trim(),
            LinkedInUrl       = request.LinkedInUrl?.Trim(),
            GitHubUrl         = request.GitHubUrl?.Trim(),
            ContactEmail      = request.ContactEmail?.Trim(),
            ContactPhone      = request.ContactPhone?.Trim(),
            CourseTitle       = request.CourseTitle.Trim(),
            Kicker            = request.Kicker?.Trim(),
            Description       = request.Description.Trim(),
            Duration          = request.Duration.Trim(),
            Level             = request.Level.Trim(),
            Language          = request.Language.Trim(),
            // NoSQL üstünlüyü: artıq JsonSerializer.Serialize lazım deyil!
            // SyllabusTopics birbaşa List<string> kimi saxlanır.
            SyllabusTopics = request.SyllabusTopics
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.Trim())
                .ToList(),
            SyllabusFileUrl   = request.SyllabusFileUrl?.Trim(),
            AccentColor       = request.AccentColor.Trim(),
            Status            = CourseStatus.Approved,
            SubmittedByUserId = userId,
            CreatedAt         = DateTime.UtcNow
        };

        // LiteDB Insert — EF-dəki AddAsync + SaveChangesAsync əvəzinə
        _db.Courses.Insert(course);

        var response = MapToResponse(course);
        return Task.FromResult(ApiResponse<CourseResponse>.Ok(response, "Təlim uğurla əlavə edildi."));
    }

    /// <summary>
    /// Təsdiqlənmiş təlimləri qaytarır — HeroSlider üçün.
    /// </summary>
    public Task<ApiResponse<List<CourseResponse>>> GetApprovedCoursesAsync()
    {
        // LiteDB sorğusu — EF-dəki .Where().OrderByDescending().ToListAsync() əvəzinə
        var courses = _db.Courses
            .Find(c => !c.IsDeleted && c.Status == CourseStatus.Approved)
            .OrderByDescending(c => c.CreatedAt)
            .ToList();

        var response = courses.Select(MapToResponse).ToList();
        return Task.FromResult(ApiResponse<List<CourseResponse>>.Ok(response));
    }

    /// <summary>
    /// Tək təlimin detallarını qaytarır.
    /// </summary>
    public Task<ApiResponse<CourseResponse>> GetCourseByIdAsync(int id)
    {
        // LiteDB FindOne — EF-dəki .FirstOrDefaultAsync() əvəzinə
        var course = _db.Courses.FindOne(c => c.Id == id && !c.IsDeleted);

        if (course is null)
            return Task.FromResult(ApiResponse<CourseResponse>.Fail("Təlim tapılmadı."));

        return Task.FromResult(ApiResponse<CourseResponse>.Ok(MapToResponse(course)));
    }

    // ─── PRIVATE HELPERS ─────────────────────────────────────────

    /// <summary>
    /// Course entity-ni CourseResponse DTO-ya çevirir.
    /// </summary>
    private static CourseResponse MapToResponse(Course course)
    {
        string initials = string.Join("",
            course.InstructorName
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(p => p.Length > 0)
                .Select(p => char.ToUpper(p[0])));

        return new CourseResponse
        {
            Id                 = course.Id,
            InstructorName     = course.InstructorName,
            InstructorInitials = initials.Length > 2 ? initials[..2] : initials,
            InstructorRole     = course.InstructorRole,
            InstructorCompany  = course.InstructorCompany,
            InstructorPhotoUrl = course.InstructorPhotoUrl,
            LinkedInUrl        = course.LinkedInUrl,
            GitHubUrl          = course.GitHubUrl,
            ContactEmail       = course.ContactEmail,
            ContactPhone       = course.ContactPhone,
            CourseTitle        = course.CourseTitle,
            Kicker             = course.Kicker,
            Description        = course.Description,
            Duration           = course.Duration,
            Level              = course.Level,
            Language           = course.Language,
            // NoSQL üstünlüyü: JsonSerializer.Deserialize lazım deyil!
            SyllabusTopics     = course.SyllabusTopics,
            SyllabusFileUrl    = course.SyllabusFileUrl,
            AccentColor        = course.AccentColor,
            CreatedAt          = course.CreatedAt
        };
    }
}
