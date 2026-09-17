using System.Security.Claims;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Exam;
using Kiberaz.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Domain.Common;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// İmtahan sessiyaları.
/// Sessiya yaratmaq, canlı panel və bağlama — yalnız <see cref="AppRoles.VIP"/> rolu (gündə ən çox
/// <see cref="ExamPolicy.DailySessionsPerHost"/> sessiya, limit serverdə yoxlanılır).
/// Qoşulmaq, cavab yazmaq və nəticəni görmək — hər hansı daxil olmuş adi hesab.
/// Admin/sahib hesab heç bir imtahan fəaliyyətində iştirak etmir (servis səviyyəsində rədd edilir).
/// </summary>
[ApiController]
[Route("api/exam-sessions")]
[Authorize]
[EnableRateLimiting("general")]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class ExamSessionsController(IExamSessionService exams) : ControllerBase
{
    private IActionResult Execute<T>(Func<string, T> action)
    {
        // Kimlik yalnız JWT-dən gəlir; [Authorize] altında belə boş claim ehtimalı ayrıca bağlanır.
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse<object>.Fail("Sessiya etibarsızdır. Yenidən daxil olun."));
        try { return Ok(ApiResponse<T>.Ok(action(userId))); }
        catch (ExamRequestException e) { return StatusCode(e.StatusCode, ApiResponse<object>.Fail(e.Message)); }
    }

    /// <summary>Sessiya üçün seçilə bilən kateqoriyalar və məxfi sual sayları. Yalnız VIP.</summary>
    [HttpGet("categories")]
    [Authorize(Roles = AppRoles.VIP)]
    [ProducesResponseType(typeof(ApiResponse<List<ExamCategoryResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    public IActionResult Categories() => Execute(_ => exams.GetCategories());

    /// <summary>Cari hesabın sessiyaları, iştirak tarixçəsi və (VIP üçün) günlük kvota.</summary>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(ApiResponse<ExamOverviewResponse>), StatusCodes.Status200OK)]
    public IActionResult Mine() => Execute(userId => exams.GetOverview(userId));

    /// <summary>
    /// Yeni sessiya yaradır. Yalnız VIP; gündə ən çox 7 sessiya — limit dolduqda 429.
    /// "submit" siyasəti: yazı əməliyyatıdır və hər çağırış məxfi bankdan sual nümunəsi götürür.
    /// </summary>
    [HttpPost]
    [Consumes("application/json")]
    [Authorize(Roles = AppRoles.VIP)]
    [EnableRateLimiting("submit")]
    [RequestSizeLimit(16384)]
    [ProducesResponseType(typeof(ApiResponse<ExamSessionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status429TooManyRequests)]
    public IActionResult Create(CreateExamRequest request) => Execute(userId => exams.Create(userId, request));

    /// <summary>
    /// Kodla sessiyaya qoşulur (və ya mövcud cəhdi qaytarır). Cavab məxfi sualların mətnini daşıyır,
    /// ona görə "submit" siyasəti ilə (30/dəq, hesab üzrə) məhdudlaşdırılır — kod sınama və toplu çıxarış qarşısı.
    /// </summary>
    [HttpPost("join")]
    [Consumes("application/json")]
    [EnableRateLimiting("submit")]
    [ProducesResponseType(typeof(ApiResponse<ExamAttemptResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public IActionResult Join(JoinExamRequest request) => Execute(userId => exams.Join(userId, request.Code));

    /// <summary>Cari istifadəçinin öz cəhdi (davam etdirmək / nəticəyə baxmaq).</summary>
    [HttpGet("attempts/{id}")]
    [ProducesResponseType(typeof(ApiResponse<ExamAttemptResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public IActionResult Attempt(string id) => Execute(userId => exams.GetAttempt(userId, id));

    /// <summary>Bir sualın cavabını saxlayır (avtomatik yazı; revizyon uyğunsuzluğunda 409).</summary>
    [HttpPut("attempts/{id}/answer")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(ApiResponse<ExamAttemptResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public IActionResult Answer(string id, SaveExamAnswerRequest request) => Execute(userId => exams.SaveAnswer(userId, id, request));

    /// <summary>Cəhdi yekunlaşdırır və serverdə hesablanmış nəticəni qaytarır.</summary>
    [HttpPost("attempts/{id}/submit")]
    [EnableRateLimiting("submit")]
    [ProducesResponseType(typeof(ApiResponse<ExamAttemptResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public IActionResult Submit(string id) => Execute(userId => exams.Submit(userId, id));

    /// <summary>Sessiya sahibinin canlı paneli. Yalnız VIP və yalnız öz sessiyası (başqasınınki 404).</summary>
    [HttpGet("{code}/dashboard")]
    [Authorize(Roles = AppRoles.VIP)]
    [ProducesResponseType(typeof(ApiResponse<ExamDashboardResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public IActionResult Dashboard(string code) => Execute(userId => exams.GetDashboard(userId, code));

    /// <summary>Sessiyanı bağlayır; davam edən cəhdlər həmin anda yekunlaşdırılır. Yalnız VIP və yalnız öz sessiyası.</summary>
    [HttpPost("{code}/close")]
    [Authorize(Roles = AppRoles.VIP)]
    [ProducesResponseType(typeof(ApiResponse<ExamSessionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public IActionResult Close(string code) => Execute(userId => exams.Close(userId, code));
}
