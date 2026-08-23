namespace Kiberaz.Application.DTOs.Course;

/// <summary>
/// API-dan kurs datalarını qaytarmaq üçün response DTO.
/// Frontend HeroSlider bu məlumatları istifadə edərək kursları göstərir.
/// </summary>
public class CourseResponse
{
    public int Id { get; set; }

    // ─── Müəllim ──────────────────────────────────────────────
    public string InstructorName { get; set; } = string.Empty;
    public string InstructorInitials { get; set; } = string.Empty;
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
    public string Language { get; set; } = string.Empty;
    public List<string> SyllabusTopics { get; set; } = new();
    public string? SyllabusFileUrl { get; set; }
    public string AccentColor { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
