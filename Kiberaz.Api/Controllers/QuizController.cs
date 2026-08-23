using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Quiz;
using Kiberaz.Application.Interfaces;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// Quiz sual-cavab sistemi üçün API endpoint-ləri.
/// GET endpoint-ləri public-dir (AllowAnonymous).
/// POST/DELETE endpoint-ləri Admin roluna məhdudlaşdırılıb.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class QuizController : ControllerBase
{
    // IQuizService interfeysi vasitəsilə işləyirik — konkret QuizService sinifini deyil, onun müqaviləsini tanıyırıq.
    // Bu sayədə gələcəkdə servisi dəyişdirmək lazım olsa, controller kodu dəyişməz qalır.
    private readonly IQuizService _quizService;

    public QuizController(IQuizService quizService)
    {
        _quizService = quizService;
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
    /// İstifadəçinin cavabını server tərəfdə yoxlayır və düzgün açarı qaytarır.
    /// Anonim istifadəçilər də cavab göndərə bilər (nəticə saxlanmır).
    /// Autentifikasiya olunmuş istifadəçilərin nəticəsi statistika üçün saxlanır.
    /// </summary>
    [HttpPost("submit")]
    [AllowAnonymous]
    [EnableRateLimiting("general")]
    [ProducesResponseType(typeof(ApiResponse<SubmitAnswerResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitAnswer([FromBody] SubmitAnswerRequest request)
    {
        try
        {
            // [AllowAnonymous] olduğu üçün token olmadan da bu endpoint-ə müraciət mümkündür.
            // Əgər istifadəçi daxil olubsa userId null olmayacaq, əks halda null qaytarılır — servis bu fərqi idarə edir.
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

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
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<QuizCategoryResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateQuizCategoryRequest request)
    {
        try
        {
            QuizCategoryResponse result = await _quizService.CreateCategoryAsync(request);
            return StatusCode(StatusCodes.Status201Created,
                ApiResponse<QuizCategoryResponse>.Ok(result, "Kateqoriya uğurla yaradıldı."));
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
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        bool deleted = await _quizService.DeleteCategoryAsync(id);

        if (!deleted)
            return NotFound(ApiResponse<object>.Fail($"Kateqoriya tapılmadı: {id}"));

        return Ok(ApiResponse<object>.Ok(null!, "Kateqoriya uğurla silindi."));
    }

    /// <summary>
    /// Yeni quiz sualı yaradır.
    /// Yalnız Admin roluna icazə verilir.
    /// </summary>
    [HttpPost("questions")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<QuizQuestionResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateQuestion([FromBody] CreateQuizQuestionRequest request)
    {
        try
        {
            QuizQuestionResponse result = await _quizService.CreateQuestionAsync(request);
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
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteQuestion(int id)
    {
        bool deleted = await _quizService.DeleteQuestionAsync(id);

        if (!deleted)
            return NotFound(ApiResponse<object>.Fail($"Sual tapılmadı: {id}"));

        return Ok(ApiResponse<object>.Ok(null!, "Sual uğurla silindi."));
    }
}
