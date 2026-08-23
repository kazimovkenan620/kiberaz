using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Kiberaz.Domain.Common;
using Kiberaz.Application.DTOs.User;
using Kiberaz.Application.Interfaces;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// İstifadəçi profil əməliyyatları.
/// Bütün endpoint-lər [Authorize] ilə qorunur — token olmadan giriş yoxdur.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    // IValidator<T> birbaşa konstruktora inject edilir — FluentValidation qaydaları controller-dən ayrı bir sinifdə yazılıb.
    // Bu "separation of concerns" prinsipidir: controller yalnız sorğunu idarə edir, validasiya məntiqi öz sinfindədir.
    private readonly IUserService _userService;
    private readonly IValidator<UpdateProfileRequest> _updateValidator;

    public UserController(IUserService userService, IValidator<UpdateProfileRequest> updateValidator)
    {
        _userService      = userService;
        _updateValidator  = updateValidator;
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
        // FluentValidation qaydaları burada əl ilə işə salınır — bu endpoint Program.cs-dəki qlobal ValidationFilter-dən əvvəl öz xüsusi yoxlamasını edir.
        // Xəta mesajları birbaşa errors massivində qaytarılır ki, frontend hər sahəni ayrıca göstərə bilsin.
        var validation = await _updateValidator.ValidateAsync(request);
        if (!validation.IsValid)
        {
            var errors = validation.Errors.Select(e => e.ErrorMessage).ToList();
            return BadRequest(new { success = false, errors });
        }

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

    [HttpGet("confirm-email-change")]
    [AllowAnonymous]
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
    public async Task<IActionResult> ConfirmEmailChangePost([FromBody] ConfirmEmailChangeRequest request)
    {
        var result = await _userService.ConfirmEmailChangeAsync(request.UserId, request.NewEmail, request.Token);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Muellim dashboard-u ucun telebe gostericilerini qaytarir.
    /// </summary>
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
}
