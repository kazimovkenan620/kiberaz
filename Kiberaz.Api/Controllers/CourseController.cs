using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Course;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// Təlim endpoint-ləri.
///
/// Oxu (siyahı, detal) — anonim. Paylaşma və yenidən aktivləşdirmə — yalnız <see cref="AppRoles.VIP"/>
/// (üstəlik servisdə aktiv VIP dövrü + kredit yoxlanılır). Redaktə/silmə/kabinet siyahısı — hər daxil olmuş
/// hesab, lakin yalnız ÖZ təlimləri (sahiblik servisdə; başqasınınki 404). Hər dəyişiklik admin təsdiqindən keçir.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
// Sonradan əlavə ediləcək endpoint limitsiz qalmasın deyə sinif səviyyəsində default.
[EnableRateLimiting("general")]
public class CourseController(ICourseService courseService) : ControllerBase
{
    // Kimlik yalnız JWT-dən; [Authorize] altında belə boş claim ehtimalı ayrıca bağlanır.
    private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    private async Task<IActionResult> Execute<T>(Func<string, Task<ApiResponse<T>>> action)
    {
        var userId = UserId;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse<object>.Fail("Sessiya etibarsızdır. Yenidən daxil olun."));
        try
        {
            var result = await action(userId);
            return result.Success ? Ok(result) : BadRequest(result);
        }
        catch (RequestFailedException e)
        {
            return StatusCode(e.StatusCode, ApiResponse<object>.Fail(e.Message));
        }
    }

    /// <summary>
    /// Yeni təlim paylaşır (Pending → admin təsdiqi → 30 gün aktiv). Yalnız VIP; aktiv VIP dövrünün
    /// 1 kreditini xərcləyir — kredit yoxdursa 402 (əlavə ödəniş), aktiv dövr yoxdursa 403.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = AppRoles.VIP)]
    [Consumes("application/json")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<CourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status402PaymentRequired)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public Task<IActionResult> CreateCourse([FromBody] CreateCourseRequest request)
        => Execute(userId => courseService.CreateCourseAsync(request, userId));

    /// <summary>Təsdiqlənmiş və müddəti bitməmiş təlimlər — ana səhifə üçün. Anonim: ictimai vitrin.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<List<CourseResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetApprovedCourses()
        => Ok(await courseService.GetApprovedCoursesAsync());

    /// <summary>Tək aktiv təlimin detalları. Anonim: ictimai vitrin.</summary>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<CourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<CourseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCourseById(int id)
    {
        var result = await courseService.GetCourseByIdAsync(id);
        return result.Success ? Ok(result) : NotFound(result);
    }

    /// <summary>Cari hesabın VIP vəziyyəti və qalan təlim krediti (məlumat məqsədli; hüquq serverdə yoxlanılır).</summary>
    [HttpGet("vip-status")]
    [Authorize]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(typeof(ApiResponse<VipStatusResponse>), StatusCodes.Status200OK)]
    public Task<IActionResult> VipStatus() => Execute(userId => courseService.GetVipStatusAsync(userId));

    /// <summary>Cari hesabın öz təlimləri (bütün statuslar) — kabinet üçün.</summary>
    [HttpGet("mine")]
    [Authorize]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(typeof(ApiResponse<List<MyCourseResponse>>), StatusCodes.Status200OK)]
    public Task<IActionResult> Mine() => Execute(userId => courseService.GetMyCoursesAsync(userId));

    /// <summary>
    /// Sahibin redaktəsi. Aktiv təlimdə dəyişiklik admin təsdiqinə qədər gözləyir (sayt dəyişmir, müddət uzanmır);
    /// gözləyən/rədd/passiv təlimdə birbaşa yazılır. Yalnız öz təlimi (başqasınınki 404).
    /// </summary>
    [HttpPut("{id:int}")]
    [Authorize]
    [Consumes("application/json")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<MyCourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public Task<IActionResult> UpdateCourse(int id, [FromBody] UpdateCourseRequest request)
        => Execute(userId => courseService.UpdateCourseAsync(id, userId, request));

    /// <summary>Sahibin silməsi (soft delete). Kredit geri qaytarılmır. Yalnız öz təlimi.</summary>
    [HttpDelete("{id:int}")]
    [Authorize]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public Task<IActionResult> DeleteCourse(int id)
        => Execute(userId => courseService.DeleteCourseAsync(id, userId));

    /// <summary>
    /// Passiv (müddəti bitmiş) təlimi yenidən moderasiyaya göndərir; admin təsdiqi ilə yeni 30 gün açılır.
    /// Yalnız VIP; aktiv dövrün 1 kreditini xərcləyir (402/403 yaratma ilə eyni).
    /// </summary>
    [HttpPost("{id:int}/reactivate")]
    [Authorize(Roles = AppRoles.VIP)]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<MyCourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status402PaymentRequired)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public Task<IActionResult> Reactivate(int id)
        => Execute(userId => courseService.ReactivateCourseAsync(id, userId));
}
