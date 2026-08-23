using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Kurs idarəetmə servisinin müqaviləsi (contract).
/// Infrastructure layeri bu interface-i implement edir.
/// </summary>
public interface ICourseService
{
    /// <summary>
    /// Yeni kurs yaradır. Default status: Approved.
    /// </summary>
    Task<ApiResponse<CourseResponse>> CreateCourseAsync(CreateCourseRequest request, string? userId);

    /// <summary>
    /// Təsdiqlənmiş (Approved) kursları siyahılayır — HeroSlider üçün.
    /// </summary>
    Task<ApiResponse<List<CourseResponse>>> GetApprovedCoursesAsync();

    /// <summary>
    /// Tək kursun detallarını qaytarır.
    /// </summary>
    Task<ApiResponse<CourseResponse>> GetCourseByIdAsync(int id);
}
