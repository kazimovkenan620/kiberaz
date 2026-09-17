using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// Admin paneli endpoint-ləri.
///
/// Avtorizasiya SİNİF SƏVİYYƏSİNDƏDİR: [Authorize(Roles = Admin)] burada bir dəfə yazılır və
/// controller-ə sonradan əlavə ediləcək HƏR yeni action avtomatik qorunur.
/// Bu, "yeni endpoint yazdım, atributu unutdum" tipli boşluğun qarşısını alan struktur qərardır.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Admin)]
[EnableRateLimiting("general")]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly IAuditLog     _audit;

    public AdminController(IAdminService adminService, IAuditLog audit)
    {
        _adminService = adminService;
        _audit        = audit;
    }

    // Hər dəyişdirici əməliyyat UĞURLU olduqda jurnala yazılır (kim, nə, nə vaxt, haradan).
    // Uğursuz cəhdlər yazılmır — onların izi ExceptionMiddleware/rate-limiter loglarındadır.
    private Task AuditAsync(string action, string targetType, string? targetId, string summary)
        => _audit.RecordAsync(new AuditRecord(CurrentAdminId, action, targetType, targetId, summary,
            HttpContext.Connection.RemoteIpAddress?.ToString()));

    // Cari adminin ID-si. Servis bunu "öz üzərində təhlükəli əməliyyat" yoxlaması üçün istifadə edir.
    private string CurrentAdminId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

    // ─── STATİSTİKA ──────────────────────────────────────────

    /// <summary>Dashboard statistika kartları — canlı bazadan.</summary>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(ApiResponse<AdminStatsResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStats()
        => Ok(await _adminService.GetStatsAsync());

    // ─── TƏLİMLƏR ────────────────────────────────────────────

    [HttpGet("courses")]
    [ProducesResponseType(typeof(ApiResponse<List<AdminCourseResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCourses()
        => Ok(await _adminService.GetCoursesAsync());

    [HttpPost("courses")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(ApiResponse<AdminCourseResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCourse([FromBody] CreateAdminCourseRequest request)
    {
        var result = await _adminService.CreateCourseAsync(request);
        if (result.Success) await AuditAsync("course.create", "Course", result.Data?.Id.ToString(), result.Message);
        return result.Success
            ? StatusCode(StatusCodes.Status201Created, result)
            : BadRequest(result);
    }

    [HttpPatch("courses/{id:int}/approve")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApproveCourse(int id)
    {
        var result = await _adminService.ApproveCourseAsync(id);
        if (result.Success) await AuditAsync("course.approve", "Course", id.ToString(), result.Message);
        return result.Success ? Ok(result) : NotFound(result);
    }

    [HttpPatch("courses/{id:int}/reject")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RejectCourse(int id)
    {
        var result = await _adminService.RejectCourseAsync(id);
        if (result.Success) await AuditAsync("course.reject", "Course", id.ToString(), result.Message);
        return result.Success ? Ok(result) : NotFound(result);
    }

    /// <summary>
    /// Adminin birbaşa məzmun düzəlişi — gözləyən revizyon yaratmır, dərhal canlı nəşrə yazılır.
    /// Status və 30 günlük aktiv müddət dəyişmir.
    /// </summary>
    [HttpPut("courses/{id:int}")]
    [Consumes("application/json")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<AdminCourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<AdminCourseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCourse(int id, [FromBody] UpdateCourseRequest request)
    {
        var result = await _adminService.UpdateCourseContentAsync(id, request);
        if (result.Success) await AuditAsync("course.update", "Course", id.ToString(), result.Message);
        return result.Success ? Ok(result) : NotFound(result);
    }

    /// <summary>Sahibin (VIP) gözləyən redaktəsini canlı nəşrin üzərinə yazır; aktiv müddət dəyişmir.</summary>
    [HttpPatch("courses/{id:int}/revision/approve")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApproveRevision(int id)
    {
        var result = await _adminService.ApproveRevisionAsync(id);
        if (result.Success) await AuditAsync("course.revision.approve", "Course", id.ToString(), result.Message);
        return result.Success ? Ok(result) : NotFound(result);
    }

    /// <summary>Gözləyən redaktəni atır; saytdakı versiya olduğu kimi qalır.</summary>
    [HttpPatch("courses/{id:int}/revision/reject")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RejectRevision(int id)
    {
        var result = await _adminService.RejectRevisionAsync(id);
        if (result.Success) await AuditAsync("course.revision.reject", "Course", id.ToString(), result.Message);
        return result.Success ? Ok(result) : NotFound(result);
    }

    // Dağıdıcı əməliyyat: "general" (60/dəq) əvəzinə "sensitive" (5/dəq).
    [HttpDelete("courses/{id:int}")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCourse(int id)
    {
        var result = await _adminService.DeleteCourseAsync(id);
        if (result.Success) await AuditAsync("course.delete", "Course", id.ToString(), result.Message);
        return result.Success ? Ok(result) : NotFound(result);
    }

    // ─── İSTİFADƏÇİLƏR ───────────────────────────────────────

    /// <summary>
    /// İstifadəçi siyahısı. Cavabda e-poçt ünvanları var — bu endpoint HEÇ VAXT
    /// Admin rolundan kənara açılmamalıdır (PII sızması).
    /// </summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(ApiResponse<List<AdminUserResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers([FromQuery] string? search = null, [FromQuery] int take = 100)
        => Ok(await _adminService.GetUsersAsync(CurrentAdminId, search, take));

    /// <summary>
    /// Yeni 30 günlük VIP dövrü açır (1 təlim krediti) — ödəniş sistemi gələnə qədər "VIP ödənişi"nin
    /// admin ekvivalenti. VIP rolu yoxdursa rol da verilir (sessiyalar yenilənir). Hesab dəyişikliyi: "sensitive".
    /// </summary>
    [HttpPost("users/{userId}/vip-term")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StartVipTerm(string userId)
    {
        var result = await _adminService.StartVipTermAsync(CurrentAdminId, userId);
        if (result.Success) await AuditAsync("user.vip-term", "User", userId, result.Message);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Bir hesabın tam kartı — profil, VIP dövrü və fəaliyyət göstəriciləri.
    /// Cavabda e-poçt və fəallıq var: Admin rolundan kənara açılmamalıdır (PII).
    /// </summary>
    [HttpGet("users/{userId}")]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDetailResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDetailResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetUserDetail(string userId)
    {
        var result = await _adminService.GetUserDetailAsync(userId);
        return result.Success ? Ok(result) : NotFound(result);
    }

    /// <summary>Ad, soyad, ləqəb, cins düzəlişi və e-poçt təsdiqinin əl ilə verilməsi.</summary>
    [HttpPut("users/{userId}")]
    [Consumes("application/json")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<AdminUserDetailResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateUser(string userId, [FromBody] AdminUpdateUserRequest request)
    {
        var result = await _adminService.UpdateUserAsync(CurrentAdminId, userId, request);
        if (result.Success) await AuditAsync("user.update", "User", userId, result.Message);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Hesabı həmişəlik silir (geri qaytarılmır). Sahib hesab və adminin öz hesabı silinə bilməz.
    /// Ən dağıdıcı əməliyyat: "sensitive" (5/dəq).
    /// </summary>
    [HttpDelete("users/{userId}")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteUser(string userId)
    {
        var result = await _adminService.DeleteUserAsync(CurrentAdminId, userId);
        if (result.Success) await AuditAsync("user.delete", "User", userId, result.Message);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("users/{userId}/role")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangeUserRole(string userId, [FromBody] AdminChangeUserRoleRequest request)
    {
        var result = await _adminService.ChangeUserRoleAsync(CurrentAdminId, userId, request.Role);
        if (result.Success) await AuditAsync("user.role", "User", userId, result.Message);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("users/{userId}/block")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ToggleUserBlock(string userId)
    {
        var result = await _adminService.ToggleUserBlockAsync(CurrentAdminId, userId);
        if (result.Success) await AuditAsync("user.block", "User", userId, result.Message);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    // ─── İMTAHAN SESSİYALARI ─────────────────────────────────

    /// <summary>Bütün imtahan sessiyaları (ən yenidən köhnəyə).</summary>
    [HttpGet("exam-sessions")]
    [ProducesResponseType(typeof(ApiResponse<List<AdminExamSessionResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetExamSessions(
        [FromQuery] string? search = null, [FromQuery] int take = 200)
        => Ok(await _adminService.GetExamSessionsAsync(search, take));

    /// <summary>Sessiya + iştirakçı nəticələri. Cavabda iştirakçı e-poçtları var (yalnız Admin).</summary>
    [HttpGet("exam-sessions/{id}")]
    [ProducesResponseType(typeof(ApiResponse<AdminExamSessionDetailResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<AdminExamSessionDetailResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetExamSessionDetail(string id)
    {
        var result = await _adminService.GetExamSessionDetailAsync(id);
        return result.Success ? Ok(result) : NotFound(result);
    }

    // ─── ƏMƏLİYYAT JURNALI ───────────────────────────────────

    /// <summary>Son admin əməliyyatları (kim, nə, nə vaxt, IP). Yalnız oxu; qeydlər silinmir.</summary>
    [HttpGet("audit")]
    [ProducesResponseType(typeof(ApiResponse<List<AdminAuditResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAudit([FromQuery] int take = 50, [FromQuery] string? search = null)
        => Ok(ApiResponse<List<AdminAuditResponse>>.Ok(await _audit.GetRecentAsync(take, search)));
}
