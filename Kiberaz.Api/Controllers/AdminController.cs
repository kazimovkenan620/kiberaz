using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.DTOs.Common;
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

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

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
        return result.Success ? Ok(result) : NotFound(result);
    }

    [HttpPatch("courses/{id:int}/reject")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RejectCourse(int id)
    {
        var result = await _adminService.RejectCourseAsync(id);
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

    [HttpPatch("users/{userId}/role")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ChangeUserRole(string userId, [FromBody] AdminChangeUserRoleRequest request)
    {
        var result = await _adminService.ChangeUserRoleAsync(CurrentAdminId, userId, request.Role);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPatch("users/{userId}/block")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ToggleUserBlock(string userId)
    {
        var result = await _adminService.ToggleUserBlockAsync(CurrentAdminId, userId);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    // ─── İMTAHANLAR ──────────────────────────────────────────

    [HttpGet("exams")]
    [ProducesResponseType(typeof(ApiResponse<List<AdminExamResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetExams()
        => Ok(await _adminService.GetExamsAsync());

    // Bir kateqoriya + onun BÜTÜN suallarını silir — ən dağıdıcı admin əməliyyatıdır.
    [HttpDelete("exams/{id}")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteExam(string id)
    {
        var result = await _adminService.DeleteExamAsync(id);
        return result.Success ? Ok(result) : NotFound(result);
    }
}
