using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Application.DTOs.Course;
using Kiberaz.Application.Interfaces;

namespace Kiberaz.Api.Controllers;

/// <summary>
/// Təlim idarəetmə endpoint-ləri.
/// Təlim əlavə etmək və təlimləri siyahılamaq üçün istifadə olunur.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
// Sonradan əlavə ediləcək endpoint limitsiz qalmasın deyə sinif səviyyəsində default.
[EnableRateLimiting("general")]
public class CourseController : ControllerBase
{
    private readonly ICourseService _courseService;

    public CourseController(ICourseService courseService)
    {
        _courseService = courseService;
    }

    /// <summary>
    /// Yeni təlim təklif edir (Pending statusunda, admin təsdiqindən sonra saytda görünür).
    ///
    /// GİRİŞ TƏLƏB OLUNUR. Əvvəl [AllowAnonymous] idi: anonim skript moderasiya növbəsini
    /// və faylları saxlayan diski limitsiz doldura bilirdi, göndərəni müəyyən etmək
    /// isə mümkün deyildi. İndi hər təklif bir hesaba bağlanır.
    /// </summary>
    [HttpPost]
    [Authorize]
    [EnableRateLimiting("sensitive")]
    [ProducesResponseType(typeof(Application.DTOs.Common.ApiResponse<CourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Application.DTOs.Common.ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseRequest request)
    {
        // [Authorize] burada token-i təmin edir; claim-in yoxluğu yenə də yoxlanılır ki,
        // təlim "sahibsiz" qeyd olunmasın.
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(Application.DTOs.Common.ApiResponse<object>.Fail("Sessiya etibarsızdır. Yenidən daxil olun."));

        var result = await _courseService.CreateCourseAsync(request, userId);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Təsdiqlənmiş (Approved) təlimləri qaytarır — HeroSlider üçün.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    [EnableRateLimiting("general")]
    [ProducesResponseType(typeof(Application.DTOs.Common.ApiResponse<List<CourseResponse>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetApprovedCourses()
    {
        var result = await _courseService.GetApprovedCoursesAsync();
        return Ok(result);
    }

    /// <summary>
    /// Tək təlimin detallarını qaytarır.
    /// </summary>
    [HttpGet("{id:int}")]
    [AllowAnonymous]
    [EnableRateLimiting("general")]
    [ProducesResponseType(typeof(Application.DTOs.Common.ApiResponse<CourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Application.DTOs.Common.ApiResponse<CourseResponse>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCourseById(int id)
    {
        var result = await _courseService.GetCourseByIdAsync(id);

        if (!result.Success)
            return NotFound(result);

        return Ok(result);
    }
}
