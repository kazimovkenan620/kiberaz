using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Təlim idarəetmə servisinin müqaviləsi (contract).
/// Infrastructure layeri bu interface-i implement edir.
///
/// Qaydalar (VipPolicy): təlim yaratmaq və passiv təlimi yenidən aktivləşdirmək yalnız VIP rolu +
/// aktiv VIP dövrü + dövrdə qalan kreditlə mümkündür; hər dəyişiklik admin təsdiqindən keçir;
/// təsdiqlənmiş təlim 30 gün aktiv qalır, sonra avtomatik passivə düşür.
/// Caller-ə düzəldilə bilən xətalar <see cref="RequestFailedException"/> ilə (402/403/404/409) qaytarılır.
/// </summary>
public interface ICourseService
{
    /// <summary>Yeni təlim yaradır (Pending). Aktiv VIP dövrünün 1 kreditini istifadə edir.</summary>
    Task<ApiResponse<CourseResponse>> CreateCourseAsync(CreateCourseRequest request, string userId);

    /// <summary>Təsdiqlənmiş və müddəti bitməmiş təlimlər — ana səhifə üçün. Köhnəlmişləri passivə keçirir.</summary>
    Task<ApiResponse<List<CourseResponse>>> GetApprovedCoursesAsync();

    /// <summary>Tək (aktiv) təlimin detallarını qaytarır.</summary>
    Task<ApiResponse<CourseResponse>> GetCourseByIdAsync(int id);

    /// <summary>Sahibin bütün təlimləri (statusdan asılı olmayaraq, silinmişlər xaric).</summary>
    Task<ApiResponse<List<MyCourseResponse>>> GetMyCoursesAsync(string userId);

    /// <summary>
    /// Sahibin redaktəsi. Aktiv təlimdə dəyişiklik gözləyən revizyon kimi saxlanır (canlı nəşr dəyişmir),
    /// gözləyən/rədd edilmiş/passiv təlimdə isə birbaşa yazılır; rədd edilmiş yenidən Pending olur.
    /// </summary>
    Task<ApiResponse<MyCourseResponse>> UpdateCourseAsync(int id, string userId, UpdateCourseRequest request);

    /// <summary>Sahibin silməsi (soft delete). Kredit geri qaytarılmır.</summary>
    Task<ApiResponse<bool>> DeleteCourseAsync(int id, string userId);

    /// <summary>Passiv təlimi yenidən moderasiyaya göndərir; aktiv VIP dövrünün 1 kreditini istifadə edir.</summary>
    Task<ApiResponse<MyCourseResponse>> ReactivateCourseAsync(int id, string userId);

    /// <summary>İstifadəçinin VIP vəziyyəti və qalan təlim krediti.</summary>
    Task<ApiResponse<VipStatusResponse>> GetVipStatusAsync(string userId);

    /// <summary>
    /// Müddəti bitmiş təsdiqli təlimləri passivə keçirir. Oxu yollarından və fon işindən çağırılır;
    /// keçirilən təlim sayını qaytarır.
    /// </summary>
    Task<int> ExpireOverdueCoursesAsync();
}
