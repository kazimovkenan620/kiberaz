namespace Kiberaz.Application.DTOs.Course;

/// <summary>
/// Təlim yaratma formundan göndərilən DTO.
/// Frontend-dəki "Təlim Əlavə Et" modalının məlumatlarını daşıyır.
/// </summary>
public class CreateCourseRequest
{
    // ─── Müəllim ──────────────────────────────────────────────
    public string InstructorName { get; set; } = string.Empty;
    public string InstructorRole { get; set; } = string.Empty;
    public string? InstructorCompany { get; set; }
    public string? InstructorPhotoUrl { get; set; }
    public string? LinkedInUrl { get; set; }
    public string? GitHubUrl { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }

    // ─── Kurs ─────────────────────────────────────────────────
    public string CourseTitle { get; set; } = string.Empty;
    public string? Kicker { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string Language { get; set; } = "Azərbaycan dili";
    public List<string> SyllabusTopics { get; set; } = new();
    public string? SyllabusFileUrl { get; set; }
    public string AccentColor { get; set; } = "--brand-primary";
}
