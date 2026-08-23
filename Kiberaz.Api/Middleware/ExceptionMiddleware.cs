using System.Net;
using System.Text.Json;
using Kiberaz.Application.DTOs.Common;

namespace Kiberaz.Api.Middleware;

// Bütün HTTP sorğuları üçün mərkəzi xəta idarəetmə middleware-i.
// Controller-lərdən keçən istənilən tutulmamış istisna burda ələ keçirilir, loglanır və istifadəçiyə təmiz JSON cavabı qaytarılır.
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionMiddleware(
        RequestDelegate next,
        ILogger<ExceptionMiddleware> logger,
        IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    // Sorğunu növbəti middleware-ə ötürür; xəta olarsa ələ keçirib idarə edir.
    // try/catch bütün pipeline-ı əhatə edir — heç bir controller xətası "itirilmir".
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gözlənilməyən xəta: {Message} | Path: {Path}",
                ex.Message, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    // Xəta detallarını mühitə görə formalaşdırıb JSON kimi cavab olaraq yazır.
    // Development-də tam xəta mesajı göstərilir ki, debug asan olsun; production-da isə ümumi mesaj verilir.
    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

        // Production-da stack trace göstərilmir — internal detail açıqlanmasın
        var message = _env.IsDevelopment()
            ? $"Server xətası: {exception.Message}"
            : "Xidmətdə texniki problem baş verdi. Zəhmət olmasa bir az sonra yenidən cəhd edin.";

        // Cavab həmişə tətbiqin standart ApiResponse formatında olur — frontend fərqli format gözləmir.
        var response = ApiResponse<object>.Fail(message);
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var json = JsonSerializer.Serialize(response, options);

        await context.Response.WriteAsync(json);
    }
}
