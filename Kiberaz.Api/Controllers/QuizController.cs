using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Admin;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Quiz;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Common;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// Quiz sual-cavab sistemi üçün API endpoint-ləri.
/// GET endpoint-ləri public-dir (AllowAnonymous).
/// POST/DELETE endpoint-ləri Admin roluna məhdudlaşdırılıb.
/// </summary>
[ApiController]
[Route("api/[controller]")]
// Sinif səviyyəsində limit: bu controller-ə SONRADAN əlavə ediləcək endpoint
// avtomatik "general" altına düşür. Metod səviyyəsindəki siyasət bunu əvəz edir
// (məs. submit → "submit"), yəni default limitli, istisna daha dardır.
[EnableRateLimiting("general")]
public class QuizController : ControllerBase
{
    // IQuizService interfeysi vasitəsilə işləyirik — konkret QuizService sinifini deyil, onun müqaviləsini tanıyırıq.
    // Bu sayədə gələcəkdə servisi dəyişdirmək lazım olsa, controller kodu dəyişməz qalır.
    private readonly IQuizService _quizService;
    private readonly IAuditLog _audit;

    public QuizController(IQuizService quizService, IAuditLog audit)
    {
        _quizService = quizService;
        _audit = audit;
    }

    // Admin dəyişikliklərinin izi. Aktor yalnız JWT-dən; IP ForwardedHeaders-dan sonrakı real ünvandır.
    private Task AuditAsync(string action, string targetType, string? targetId, string summary)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        return _audit.RecordAsync(new AuditRecord(actorId, action, targetType, targetId, summary, ip));
    }

    /// <summary>
    /// Bütün quiz kateqoriyalarını qaytarır (sual sayı ilə birlikdə).
    /// </summary>
    /// <returns>Quiz kateqoriyalarının siyahısı</returns>
    [HttpGet("categories")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<List<QuizCategoryResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories()
    {
        List<QuizCategoryResponse> categories = await _quizService.GetCategoriesAsync();
        return Ok(ApiResponse<List<QuizCategoryResponse>>.Ok(categories));
    }

    /// <summary>
    /// Verilən kateqoriya üzrə sualları qaytarır.
    /// Çətinlik filteri və sual sayı ilə istifadə oluna bilər.
    /// </summary>
    /// <param name="categoryId">Kateqoriya ID-si (1-7)</param>
    /// <param name="difficulty">Çətinlik filteri: Başlanğıc, Orta, Peşəkar (null = Qarışıq)</param>
    /// <param name="count">Qaytarılacaq sual sayı (default: 10, max: 50)</param>
    [HttpGet("questions")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<List<QuizQuestionPublicResponse>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetQuestions(
        [FromQuery] int categoryId,
        [FromQuery] string? difficulty = null,
        [FromQuery] int count = 10)
    {
        if (categoryId <= 0)
            return BadRequest(ApiResponse<object>.Fail("categoryId müsbət olmalıdır."));

        // İstifadəçi count parametrini 0 və ya 1000 kimi göndərə bilər — Clamp onu məcburi [1, 50] aralığında saxlayır.
        // Bu həm server yükünü azaldır, həm də cavabın ağlabatan ölçüdə olmasını zəmanətləndirir.
        count = Math.Clamp(count, 1, 50);

        List<QuizQuestionPublicResponse> questions = await _quizService.GetQuestionsAsync(categoryId, difficulty, count);
        return Ok(ApiResponse<List<QuizQuestionPublicResponse>>.Ok(questions));
    }

    /// <summary>
    /// Liderlik lövhəsi — canlı QuizResults məlumatından hesablanır.
    /// İctimaidir: girişsiz də görünür, ona görə cavabda YALNIZ ləqəb var, ad/soyad/e-poçt yoxdur.
    /// </summary>
    /// <param name="period">weekly | monthly | all (default: all)</param>
    /// <param name="categoryId">Kateqoriya filtri; boş = bütün kateqoriyalar</param>
    /// <param name="limit">Sətir sayı (default 10, max 100)</param>
    [HttpGet("leaderboard")]
    [AllowAnonymous]
    [EnableRateLimiting("general")]
    [ProducesResponseType(typeof(ApiResponse<List<LeaderboardEntryResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLeaderboard(
        [FromQuery] string? period = null,
        [FromQuery] int? categoryId = null,
        [FromQuery] int limit = 10)
    {
        // Kənardan gələn limit sərbəst buraxılsa böyük cavabla serveri yormaq mümkündür.
        limit = Math.Clamp(limit, 1, 100);

        var entries = await _quizService.GetLeaderboardAsync(period, categoryId, limit);
        return Ok(ApiResponse<List<LeaderboardEntryResponse>>.Ok(entries));
    }

    /// <summary>
    /// İstifadəçinin cavabını server tərəfdə yoxlayır və düzgün açarı qaytarır.
    ///
    /// GİRİŞ TƏLƏB OLUNUR. Əvvəl [AllowAnonymous] idi və bu, sual bankı üçün açıq
    /// oxu kanalı yaradırdı: endpoint hər çağırışda CorrectKey-i və bütün variantların
    /// izahını qaytarır, cavab isə yoxlanılmır — yəni questionId-ləri ardıcıl gəzərək
    /// bütün cavab açarlarını kimliyi bilinməyən bir skript çıxara bilərdi.
    /// İndi cavab yalnız hesabla göndərilir: limit hesaba bağlanır və sui-istifadə izlənə bilir.
    /// </summary>
    [HttpPost("submit")]
    [Authorize]
    [EnableRateLimiting("submit")]
    [ProducesResponseType(typeof(ApiResponse<SubmitAnswerResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitAnswer([FromBody] SubmitAnswerRequest request)
    {
        try
        {
            // [Authorize] sayəsində buraya yalnız etibarlı token ilə gəlinir.
            // Yenə də claim-in yoxluğunu yoxlayırıq: token varsa, amma NameIdentifier
            // yoxdursa, servisə null userId ötürmək nəticəni səssizcə itirərdi.
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized(ApiResponse<object>.Fail("Sessiya etibarsızdır. Yenidən daxil olun."));

            SubmitAnswerResponse result = await _quizService.SubmitAnswerAsync(request, userId);
            return Ok(ApiResponse<SubmitAnswerResponse>.Ok(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Yeni quiz kateqoriyası yaradır.
    /// Yalnız Admin roluna icazə verilir.
    /// </summary>
    [HttpPost("categories")]
    [Authorize(Roles = AppRoles.Admin)]
    [ProducesResponseType(typeof(ApiResponse<QuizCategoryResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateQuizCategoryRequest request)
    {
        try
        {
            QuizCategoryResponse result = await _quizService.CreateCategoryAsync(request);
            await AuditAsync("category.create", "QuizCategory", result.Id.ToString(), $"«{result.Title}» yaradıldı.");
            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<QuizCategoryResponse>.Ok(result, "Kateqoriya uğurla yaradıldı."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Admin paneli üçün kateqoriya siyahısı — ictimai/məxfi sual sayları və iştirakçı sayı ilə.
    /// İctimai <c>GET categories</c>-dən fərqi: məxfi (imtahan) bankın həcmini açır, ona görə yalnız Admin.
    /// </summary>
    [HttpGet("admin/categories")]
    [Authorize(Roles = AppRoles.Admin)]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(typeof(ApiResponse<List<AdminQuizCategoryResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdminCategories([FromQuery] bool deleted = false)
        => Ok(ApiResponse<List<AdminQuizCategoryResponse>>.Ok(await _quizService.GetAdminCategoriesAsync(deleted)));

    /// <summary>Silinmiş kateqoriyanı (və onunla birlikdə silinmiş sualları) bərpa edir. Yalnız Admin.</summary>
    [HttpPost("categories/{id:int}/restore")]
    [Authorize(Roles = AppRoles.Admin)]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RestoreCategory(int id)
    {
        try
        {
            var restored = await _quizService.RestoreCategoryAsync(id);
            var message = restored > 0 ? $"Kateqoriya və {restored} sualı bərpa edildi." : "Kateqoriya bərpa edildi.";
            await AuditAsync("category.restore", "QuizCategory", id.ToString(), message);
            return Ok(ApiResponse<int>.Ok(restored, message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>Kateqoriyanın məlumatlarını yeniləyir. Yalnız Admin.</summary>
    [HttpPut("categories/{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    [Consumes("application/json")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<QuizCategoryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateQuizCategoryRequest request)
    {
        try
        {
            var result = await _quizService.UpdateCategoryAsync(id, request);
            await AuditAsync("category.update", "QuizCategory", id.ToString(), $"«{result.Title}» yeniləndi.");
            return Ok(ApiResponse<QuizCategoryResponse>.Ok(result, "Kateqoriya yeniləndi."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Admin sual siyahısı — düzgün açar və izahlarla, səhifələnmiş.
    /// BU CAVAB SUAL BANKININ AÇARLARINI DAŞIYIR: yalnız Admin rolu, keşsiz.
    /// </summary>
    [HttpGet("admin/questions")]
    [Authorize(Roles = AppRoles.Admin)]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [ProducesResponseType(typeof(ApiResponse<AdminQuestionPageResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdminQuestions(
        [FromQuery] int? categoryId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? difficulty = null,
        [FromQuery] bool? examOnly = null,
        [FromQuery] bool deleted = false,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 25)
    {
        var page = await _quizService.GetAdminQuestionsAsync(categoryId, search, difficulty, examOnly, deleted, skip, take);
        return Ok(ApiResponse<AdminQuestionPageResponse>.Ok(page));
    }

    /// <summary>
    /// Sualın məzmununu yeniləyir. Bank (ictimai ⇄ məxfi) qəsdən dəyişmir —
    /// ictimai bankda görünmüş sual məxfi imtahan bankına keçirilə bilməz. Yalnız Admin.
    /// </summary>
    [HttpPut("questions/{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    [Consumes("application/json")]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<AdminQuizQuestionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpdateQuestion(int id, [FromBody] UpdateQuizQuestionRequest request)
    {
        try
        {
            var result = await _quizService.UpdateQuestionAsync(id, request);
            await AuditAsync("question.update", "QuizQuestion", id.ToString(), "Sual məzmunu yeniləndi.");
            return Ok(ApiResponse<AdminQuizQuestionResponse>.Ok(result, "Sual yeniləndi."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>Silinmiş sualı bərpa edir (kateqoriyası aktiv olmalıdır). Yalnız Admin.</summary>
    [HttpPost("questions/{id:int}/restore")]
    [Authorize(Roles = AppRoles.Admin)]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<AdminQuizQuestionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RestoreQuestion(int id)
    {
        try
        {
            var result = await _quizService.RestoreQuestionAsync(id);
            await AuditAsync("question.restore", "QuizQuestion", id.ToString(), "Sual bərpa edildi.");
            return Ok(ApiResponse<AdminQuizQuestionResponse>.Ok(result, "Sual bərpa edildi."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Quiz kateqoriyasını silir (soft delete, bağlı suallar da silinir).
    /// Yalnız Admin roluna icazə verilir.
    /// </summary>
    [HttpDelete("categories/{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        bool deleted = await _quizService.DeleteCategoryAsync(id);

        if (!deleted)
            return NotFound(ApiResponse<object>.Fail($"Kateqoriya tapılmadı: {id}"));

        await AuditAsync("category.delete", "QuizCategory", id.ToString(), "Kateqoriya və sualları silindi (kaskad).");
        return Ok(ApiResponse<object>.Ok(null!, "Kateqoriya uğurla silindi."));
    }

    /// <summary>
    /// Yeni quiz sualı yaradır.
    /// Yalnız Admin roluna icazə verilir.
    /// </summary>
    [HttpPost("questions")]
    [Authorize(Roles = AppRoles.Admin)]
    [ProducesResponseType(typeof(ApiResponse<QuizQuestionResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateQuestion([FromBody] CreateQuizQuestionRequest request)
    {
        try
        {
            QuizQuestionResponse result = await _quizService.CreateQuestionAsync(request);
            await AuditAsync("question.create", "QuizQuestion", result.Id.ToString(), result.IsExamOnly ? "Məxfi sual yaradıldı." : "Açıq sual yaradıldı.");
            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<QuizQuestionResponse>.Ok(result, "Sual uğurla yaradıldı."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Quiz sualını silir (soft delete).
    /// Yalnız Admin roluna icazə verilir.
    /// </summary>
    /// <param name="id">Silinəcək sualın ID-si</param>
    [HttpDelete("questions/{id:int}")]
    [Authorize(Roles = AppRoles.Admin)]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteQuestion(int id)
    {
        bool deleted = await _quizService.DeleteQuestionAsync(id);

        if (!deleted)
            return NotFound(ApiResponse<object>.Fail($"Sual tapılmadı: {id}"));

        await AuditAsync("question.delete", "QuizQuestion", id.ToString(), "Sual silindi.");
        return Ok(ApiResponse<object>.Ok(null!, "Sual uğurla silindi."));
    }
}
