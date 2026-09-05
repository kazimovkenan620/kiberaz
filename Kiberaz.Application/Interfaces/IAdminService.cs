using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.DTOs.Common;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Admin panelinin bütün əməliyyatları.
/// Bu servisin HƏR metodu yalnız Admin rolu ilə çağrıla bilər —
/// avtorizasiya controller səviyyəsində tətbiq olunur, servis onu təkrar yoxlamır.
///
/// currentAdminId parametri hər yerdə ona görə ötürülür ki, adminin ÖZ ÜZƏRİNDƏ
/// təhlükəli əməliyyat aparmasının qarşısı alınsın (özünü bloklamaq / öz rolunu salmaq).
/// </summary>
public interface IAdminService
{
    // ─── Statistika ──────────────────────────────────────────
    Task<ApiResponse<AdminStatsResponse>> GetStatsAsync();

    // ─── Təlimlər ────────────────────────────────────────────
    Task<ApiResponse<List<AdminCourseResponse>>> GetCoursesAsync();
    Task<ApiResponse<bool>> ApproveCourseAsync(int courseId);
    Task<ApiResponse<bool>> RejectCourseAsync(int courseId);
    Task<ApiResponse<bool>> DeleteCourseAsync(int courseId);
    Task<ApiResponse<AdminCourseResponse>> CreateCourseAsync(CreateAdminCourseRequest request);

    // ─── İstifadəçilər ───────────────────────────────────────
    Task<ApiResponse<List<AdminUserResponse>>> GetUsersAsync();
    Task<ApiResponse<bool>> ChangeUserRoleAsync(string currentAdminId, string userId, string newRole);
    Task<ApiResponse<bool>> ToggleUserBlockAsync(string currentAdminId, string userId);

    // ─── İmtahanlar (quiz kateqoriyaları) ────────────────────
    Task<ApiResponse<List<AdminExamResponse>>> GetExamsAsync();
    Task<ApiResponse<bool>> DeleteExamAsync(string examId);
}
