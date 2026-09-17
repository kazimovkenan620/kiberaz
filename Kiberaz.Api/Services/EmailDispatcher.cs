using Kiberaz.Infrastructure.Services;

namespace Kiberaz.Api.Services;

// EmailQueue-dan işləri götürüb SMTP ilə göndərir; müvəqqəti xəta üç dəfə artan fasilə ilə təkrarlanır.
// Alıcı ünvanı loglanmır (PII) — yalnız mövzu və cəhd sayı.
public sealed class EmailDispatcher(EmailQueue queue, SmtpSender sender, ILogger<EmailDispatcher> logger) : BackgroundService
{
    private const int MaxAttempts = 3;
    private static readonly TimeSpan[] RetryDelays = [TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(30)];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await sender.SendAsync(job, stoppingToken);
                logger.LogInformation("E-poçt göndərildi: {Subject}", job.Subject);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                var attempt = job.Attempt + 1;
                if (attempt >= MaxAttempts)
                {
                    logger.LogError(ex, "E-poçt {Attempt} cəhddən sonra göndərilmədi: {Subject}", attempt, job.Subject);
                    continue;
                }
                logger.LogWarning(ex, "E-poçt göndərilmədi ({Attempt}/{Max}), təkrar planlaşdırıldı: {Subject}",
                    attempt, MaxAttempts, job.Subject);
                _ = RequeueLaterAsync(job with { Attempt = attempt }, RetryDelays[Math.Min(attempt - 1, RetryDelays.Length - 1)], stoppingToken);
            }
        }
    }

    private async Task RequeueLaterAsync(EmailJob job, TimeSpan delay, CancellationToken token)
    {
        try
        {
            await Task.Delay(delay, token);
            if (!queue.TryEnqueue(job))
                logger.LogError("E-poçt növbəsi doludur, təkrar cəhd atıldı: {Subject}", job.Subject);
        }
        catch (OperationCanceledException) { /* tətbiq dayanır */ }
    }
}
