using System.Threading.Channels;

namespace Kiberaz.Infrastructure.Services;

// Göndərilməyi gözləyən e-poçt. Attempt — dispatcher-in təkrar cəhd sayğacı.
public sealed record EmailJob(string To, string Subject, string HtmlBody, int Attempt = 0);

// Sorğu axını SMTP-ni gözləmir: iş növbəyə atılır, EmailDispatcher fon prosesində göndərir.
// Növbə məhduddur (1000) — SMTP tamamilə dayananda yaddaş sonsuz böyüməsin; dolanda çağıran Fail alır.
public sealed class EmailQueue
{
    public const int Capacity = 1000;

    private readonly Channel<EmailJob> _channel = Channel.CreateBounded<EmailJob>(new BoundedChannelOptions(Capacity)
    {
        FullMode = BoundedChannelFullMode.Wait, SingleReader = true, SingleWriter = false
    });

    public bool TryEnqueue(EmailJob job) => _channel.Writer.TryWrite(job);

    public ChannelReader<EmailJob> Reader => _channel.Reader;
}
