using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.User;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// İstifadəçi profil əməliyyatları üçün müqavilə (contract).
/// </summary>
public interface IUserService
{
    /// <summary>
    /// JWT token-dən gələn userId ilə bazadan profil çəkir.
    /// </summary>
    Task<ApiResponse<ProfileResponse>> GetProfileAsync(string userId);

    /// <summary>
    /// İstifadəçinin Ad, Soyad və Cins məlumatlarını yeniləyir.
    /// Email, Nickname dəyişdirilmir — ayrıca axın tələb olunur.
    /// </summary>
    Task<ApiResponse<ProfileResponse>> UpdateProfileAsync(string userId, UpdateProfileRequest request);

    Task<ApiResponse<bool>> RequestEmailChangeAsync(string userId, ChangeEmailRequest request);

    Task<ApiResponse<bool>> ConfirmEmailChangeAsync(string userId, string newEmail, string token);

    Task<ApiResponse<bool>> RequestPasswordChangeAsync(string userId);

    /// <summary>
    /// Müəllim dashboard-u üçün tələbə ID-si ilə tələbə göstəricilərini qaytarır.
    /// </summary>
    Task<ApiResponse<StudentOverviewResponse>> GetStudentOverviewAsync(string teacherId, string studentId);

    Task<ApiResponse<List<TeacherClassResponse>>> GetTeacherClassesAsync(string teacherId);

    Task<ApiResponse<TeacherClassResponse>> CreateTeacherClassAsync(string teacherId, CreateTeacherClassRequest request);

    Task<ApiResponse<TeacherClassResponse>> AddStudentToClassAsync(string teacherId, int classId, AddStudentToClassRequest request);
}
