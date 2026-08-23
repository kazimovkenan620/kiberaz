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
public class CourseController : ControllerBase
{
    private readonly ICourseService _courseService;

    public CourseController(ICourseService courseService)
    {
        _courseService = courseService;
    }

    /// <summary>
    /// Yeni təlim yaradır.
    /// Hər kəs təlim təklif edə bilər (AllowAnonymous), Rate Limiting ilə qorunur.
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(Application.DTOs.Common.ApiResponse<CourseResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(Application.DTOs.Common.ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseRequest request)
    {
        // İstifadəçi daxil olubsa userId-ni götürürük
        string? userId = User.Identity?.IsAuthenticated == true
            ? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            : null;

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
