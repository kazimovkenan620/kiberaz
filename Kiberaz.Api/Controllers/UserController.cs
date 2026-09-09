using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Domain.Common;
using Kiberaz.Application.DTOs.User;
using Kiberaz.Application.Interfaces;
using Kiberaz.Application.DTOs.Common;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// İstifadəçi profil əməliyyatları.
/// Bütün endpoint-lər [Authorize] ilə qorunur — token olmadan giriş yoxdur.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
// Sinif səviyyəsində default limit: bu controller-ə sonradan əlavə ediləcək
// endpoint də avtomatik limit altına düşür, ayrıca atribut yazılması unudulsa belə.
[EnableRateLimiting("general")]
public class UserController : ControllerBase
{
    // Validasiya burada əl ilə çağrılmır: Program.cs-də qlobal qeydiyyatdan keçmiş ValidationFilter
    // action icra olunmazdan əvvəl bütün DTO-ları FluentValidation-dan keçirir və uğursuzluqda
    // standart ApiResponse formatında 400 qaytarır. Controller yalnız öz işini görür.
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
    }

    /// <summary>
    /// Cari istifadəçinin rolunu (tələbə/müəllim) dəyişir.
    /// </summary>
    [HttpPatch("role")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangeRole([FromBody] ChangeRoleRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var result = await _userService.ChangeRoleAsync(userId, request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Cari daxil olmuş istifadəçinin profilini qaytarır.
    /// </summary>
    [HttpGet("profile")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetProfile()
    {
        // [Authorize] atributu token-i yoxlayır, lakin claim-in mövcudluğunu zəmanətləndirmir — buna görə əlavə null yoxlaması aparılır.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var result = await _userService.GetProfileAsync(userId);
        return result.Success ? Ok(result) : NotFound(result);
    }

    /// <summary>
    /// İstifadəçinin Ad, Soyad, Cins məlumatlarını yeniləyir.
    /// </summary>
    [HttpPut("profile")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var result = await _userService.UpdateProfileAsync(userId, request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("profile/change-email")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RequestEmailChange([FromBody] ChangeEmailRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var result = await _userService.RequestEmailChangeAsync(userId, request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("profile/request-password-change")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RequestPasswordChange()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var result = await _userService.RequestPasswordChangeAsync(userId);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    // Data Protection tokeni istehlak edən bütün endpoint-lər "sensitive" (5/dəq) altındadır —
    // bu ikisi sinif səviyyəli "general" (60/dəq) limitində qalmışdı.
    [HttpGet("confirm-email-change")]
    [AllowAnonymous]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> ConfirmEmailChange([FromQuery] string userId, [FromQuery] string newEmail, [FromQuery] string token)
    {
        var result = await _userService.ConfirmEmailChangeAsync(userId, newEmail, token);
        // E-poçtdakı link bu GET endpoint-inə yönləndirir — təsdiq tamamlandıqdan sonra istifadəçi frontend-ə redirect edilir.
        // Bu axın sayəsində istifadəçi brauzer xəbərdarı görmür; login səhifəsi query parametri ilə uğur/uğursuzluq haqqında məlumat alır.
        var frontendUrl = HttpContext.RequestServices.GetRequiredService<IConfiguration>()["FrontendUrl"] ?? "http://localhost:5173";
        return Redirect($"{frontendUrl}/login?emailChanged={(result.Success ? "true" : "false")}");
    }

    [HttpPost("confirm-email-change")]
    [AllowAnonymous]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> ConfirmEmailChangePost([FromBody] ConfirmEmailChangeRequest request)
    {
        var result = await _userService.ConfirmEmailChangeAsync(request.UserId, request.NewEmail, request.Token);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Muellim dashboard-u ucun telebe gostericilerini qaytarir.
    /// </summary>
    /// <summary>
    /// Cari istifadəçinin öz göstəriciləri (kabinet statistikası).
    /// Rol tələbi yoxdur — hər kəs YALNIZ öz məlumatını görür, ID token-dən götürülür.
    /// </summary>
    [HttpGet("me/overview")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyOverview()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var result = await _userService.GetMyOverviewAsync(userId);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpGet("students/{studentId}/overview")]
    // [Authorize(Roles = "Teacher")] həm autentifikasiyanı, həm də rolu yoxlayır — yalnız müəllim tokeni olan istifadəçilər daxil ola bilər.
    // Başqa rol sahibi (məsələn, Student) token ilə gəlsə belə, 403 Forbidden cavabı alacaq.
    [Authorize(Roles = AppRoles.Teacher)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetStudentOverview([FromRoute] string studentId)
    {
        var teacherId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(teacherId)) return Unauthorized();

        var result = await _userService.GetStudentOverviewAsync(teacherId, studentId);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpGet("teacher/classes")]
    [Authorize(Roles = AppRoles.Teacher)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTeacherClasses()
    {
        var teacherId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(teacherId)) return Unauthorized();

        var result = await _userService.GetTeacherClassesAsync(teacherId);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("teacher/classes")]
    [Authorize(Roles = AppRoles.Teacher)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateTeacherClass([FromBody] CreateTeacherClassRequest request)
    {
        var teacherId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(teacherId)) return Unauthorized();

        var result = await _userService.CreateTeacherClassAsync(teacherId, request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("teacher/classes/{classId:int}/students")]
    [Authorize(Roles = AppRoles.Teacher)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AddStudentToClass([FromRoute] int classId, [FromBody] AddStudentToClassRequest request)
    {
        var teacherId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(teacherId)) return Unauthorized();

        var result = await _userService.AddStudentToClassAsync(teacherId, classId, request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Müəllimin öz sinfini silir — rol keçidi üçün ön şərt.
    /// Sahiblik servis qatında TeacherId ilə yoxlanılır.
    /// </summary>
    [HttpDelete("teacher/classes/{classId:int}")]
    [Authorize(Roles = AppRoles.Teacher)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteTeacherClass([FromRoute] int classId)
    {
        var teacherId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(teacherId)) return Unauthorized();

        var result = await _userService.DeleteTeacherClassAsync(teacherId, classId);
        return result.Success ? Ok(result) : BadRequest(result);
    }
}
