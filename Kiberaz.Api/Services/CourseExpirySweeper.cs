using Kiberaz.Application.Interfaces;

namespace Kiberaz.Api.Services;

/// <summary>
/// Müddəti bitmiş (PublishedAt + 30 gün) təsdiqli təlimləri vaxtaşırı passivə keçirən fon işi.
///
/// İctimai siyahı və kabinet onsuz da vaxta görə süzür/keçirir (oxu yolunda), ona görə bu iş
/// yalnız "heç kim oxumasa da status vaxtında dəyişsin" məqsədi daşıyır — admin cədvəli və
/// statistika gözləmədən doğru olur. Scoped servis hər dövrədə ayrıca scope-da açılır.
/// </summary>
public sealed class CourseExpirySweeper(IServiceScopeFactory scopes, ILogger<CourseExpirySweeper> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                var courses = scope.ServiceProvider.GetRequiredService<ICourseService>();
                var expired = await courses.ExpireOverdueCoursesAsync();
                if (expired > 0)
                    logger.LogInformation("Müddəti bitmiş {Count} təlim passivə keçirildi.", expired);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Fon işi tətbiqi yıxmamalıdır; növbəti dövrədə yenidən cəhd olunur.
                logger.LogError(ex, "Təlim müddəti süpürgəsi uğursuz oldu.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }
}
