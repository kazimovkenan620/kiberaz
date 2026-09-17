using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Admin panelinin bütün əməliyyatları.
/// Bu servisin HƏR metodu yalnız Admin rolu ilə çağrıla bilər —
/// avtorizasiya controller səviyyəsində tətbiq olunur, servis onu təkrar yoxlamır.
///
/// currentAdminId parametri hər yerdə ona görə ötürülür ki, adminin ÖZ ÜZƏRİNDƏ
/// təhlükəli əməliyyat aparmasının qarşısı alınsın (özünü bloklamaq / öz rolunu salmaq / özünü silmək).
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

    /// <summary>
    /// Adminin birbaşa məzmun düzəlişi — canlı nəşrin üzərinə yazılır (admin özü moderatordur,
    /// ikinci təsdiq lazım deyil). Aktiv müddət (ExpiresAt) dəyişmir.
    /// </summary>
    Task<ApiResponse<AdminCourseResponse>> UpdateCourseContentAsync(int courseId, UpdateCourseRequest request);

    /// <summary>Sahibin gözləyən redaktəsini canlı nəşrin üzərinə yazır (aktiv müddət dəyişmir).</summary>
    Task<ApiResponse<bool>> ApproveRevisionAsync(int courseId);

    /// <summary>Gözləyən redaktəni atır; canlı nəşr olduğu kimi qalır.</summary>
    Task<ApiResponse<bool>> RejectRevisionAsync(int courseId);

    // ─── İstifadəçilər ───────────────────────────────────────
    /// <summary>
    /// İstifadəçi siyahısı. Axtarış server tərəfdə aparılır, nəticə həmişə məhdudlaşdırılır —
    /// bütün bazanı yaddaşa çəkmək qarşısı alınır.
    /// </summary>
    /// <param name="currentAdminId">Cari admin — öz hesabı siyahıya daxil edilmir.</param>
    Task<ApiResponse<List<AdminUserResponse>>> GetUsersAsync(string currentAdminId, string? search = null, int take = 100);

    /// <summary>Bir hesabın tam kartı: profil, VIP dövrü və fəaliyyət göstəriciləri.</summary>
    Task<ApiResponse<AdminUserDetailResponse>> GetUserDetailAsync(string userId);

    /// <summary>Ad, soyad, ləqəb, cins düzəlişi və e-poçt təsdiqinin əl ilə verilməsi.</summary>
    Task<ApiResponse<AdminUserDetailResponse>> UpdateUserAsync(string currentAdminId, string userId, AdminUpdateUserRequest request);

    /// <summary>
    /// Hesabı və ona bağlı şəxsi qeydləri həmişəlik silir (geri qaytarılmır).
    /// Sahib hesab və adminin öz hesabı silinə bilməz.
    /// </summary>
    Task<ApiResponse<bool>> DeleteUserAsync(string currentAdminId, string userId);

    Task<ApiResponse<bool>> ChangeUserRoleAsync(string currentAdminId, string userId, string newRole);

    /// <summary>
    /// Yeni 30 günlük VIP dövrü açır ("VIP ödənişi" — ödəniş sistemi gələnə qədər admin əl ilə).
    /// İstifadəçidə VIP rolu yoxdursa rol da verilir. Aktiv dövr varsa yenisi onun bitdiyi andan başlayır.
    /// </summary>
    Task<ApiResponse<bool>> StartVipTermAsync(string currentAdminId, string userId);

    Task<ApiResponse<bool>> ToggleUserBlockAsync(string currentAdminId, string userId);

    // ─── İmtahan sessiyaları ─────────────────────────────────
    /// <summary>Bütün imtahan sessiyaları (ən yenidən köhnəyə).</summary>
    Task<ApiResponse<List<AdminExamSessionResponse>>> GetExamSessionsAsync(string? search = null, int take = 200);

    /// <summary>Sessiya + iştirakçı nəticələri (CSV arxivi üçün də eyni məlumat).</summary>
    Task<ApiResponse<AdminExamSessionDetailResponse>> GetExamSessionDetailAsync(string sessionId);
}
