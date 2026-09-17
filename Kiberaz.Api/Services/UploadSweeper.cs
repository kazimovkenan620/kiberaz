using Kiberaz.Domain.Common;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Api.Services;

// Heç bir təlimə bağlanmayan (sahibsiz) yüklənmiş faylları TTL keçəndə silir — qlobal kvotanı
// yarımçıq/atılmış yükləmələr doldura bilməsin. Yalnız UploadedFiles-da qeydi olan fayllara toxunur;
// qeydsiz köhnə fayllar (mənbəyi bilinmir) silinmir.
public sealed class UploadSweeper(IServiceScopeFactory scopes, IWebHostEnvironment environment, TimeProvider clock,
    ILogger<UploadSweeper> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(UploadPolicy.SweepInterval);
        do
        {
            try { Sweep(); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Yükləmə süpürgəsi uğursuz oldu.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken).ConfigureAwait(false));
    }

    private void Sweep()
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LiteDbContext>();
        var root = Path.Combine(environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot"), "uploads");
        var cutoff = clock.GetUtcNow().UtcDateTime - UploadPolicy.OrphanTtl;
        var removed = 0;

        foreach (var record in db.UploadedFiles.Find(f => f.ClaimedByCourseId == null).ToList())
        {
            if ((record.ReleasedAt ?? record.CreatedAt) >= cutoff) continue;
            // Yol formatı UploadService tərəfindən yaradılıb: /uploads/<folder>/<guid>.<ext>
            var relative = record.Path.TrimStart('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (relative.Length != 3 || relative[0] != "uploads" || relative[1] is not ("photos" or "syllabus") ||
                relative[2].Contains("..", StringComparison.Ordinal))
                continue;
            var path = Path.Combine(root, relative[1], relative[2]);
            try
            {
                if (File.Exists(path)) File.Delete(path);
                db.UploadedFiles.Delete(record.Id);
                removed++;
            }
            catch (IOException ex)
            {
                logger.LogWarning(ex, "Sahibsiz fayl silinmədi: {FileId}", record.Id);
            }
        }

        if (removed > 0)
            logger.LogInformation("Yükləmə süpürgəsi: {Count} sahibsiz fayl silindi.", removed);
    }
}
