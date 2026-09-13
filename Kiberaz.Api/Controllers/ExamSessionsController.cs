using System.Security.Claims;
using Kiberaz.Application.DTOs.Common;
using Kiberaz.Application.DTOs.Exam;
using Kiberaz.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Kiberaz.Domain.Common;

namespace Kiberaz.Api.Controllers;

[ApiController]
[Route("api/exam-sessions")]
[Authorize]
[EnableRateLimiting("general")]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class ExamSessionsController(IExamSessionService exams) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
    private IActionResult Execute<T>(Func<T> action)
    {
        try { return Ok(ApiResponse<T>.Ok(action())); }
        catch (ExamRequestException e) { return StatusCode(e.StatusCode, ApiResponse<object>.Fail(e.Message)); }
    }

    [HttpGet("categories")]
    [Authorize(Roles = AppRoles.Teacher)]
    public IActionResult Categories() => Execute(exams.GetCategories);

    [HttpGet("mine")]
    public IActionResult Mine() => Execute(() => exams.GetOverview(UserId));

    [HttpPost]
    [Consumes("application/json")]
    [Authorize(Roles = AppRoles.Teacher)]
    [RequestSizeLimit(16384)]
    public IActionResult Create(CreateExamRequest request) => Execute(() => exams.Create(UserId, request));

    [HttpPost("join")]
    [Consumes("application/json")]
    public IActionResult Join(JoinExamRequest request) => Execute(() => exams.Join(UserId, request.Code));

    [HttpGet("attempts/{id}")]
    public IActionResult Attempt(string id) => Execute(() => exams.GetAttempt(UserId, id));

    [HttpPut("attempts/{id}/answer")]
    [Consumes("application/json")]
    public IActionResult Answer(string id, SaveExamAnswerRequest request) => Execute(() => exams.SaveAnswer(UserId, id, request));

    [HttpPost("attempts/{id}/submit")]
    public IActionResult Submit(string id) => Execute(() => exams.Submit(UserId, id));

    [HttpGet("{code}/dashboard")]
    [Authorize(Roles = AppRoles.Teacher)]
    public IActionResult Dashboard(string code) => Execute(() => exams.GetDashboard(UserId, code));

    [HttpPost("{code}/close")]
    [Authorize(Roles = AppRoles.Teacher)]
    public IActionResult Close(string code) => Execute(() => exams.Close(UserId, code));
}
