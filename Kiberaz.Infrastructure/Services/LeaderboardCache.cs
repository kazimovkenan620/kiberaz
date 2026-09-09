using Kiberaz.Application.DTOs.Quiz;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// Liderlər lövhəsinin hazır nəticəsini qısa müddətə saxlayan keş.
///
/// PROBLEM: <c>GET /api/quiz/leaderboard</c> ictimai endpoint-dir və hər çağırışda
/// QuizResults, Users və QuizQuestions kolleksiyalarını TAM oxuyurdu. LiteDB tək fayldır —
/// bu oxumalar imtahan cavablarının yazılması ilə eyni fayl üzərində yarışır.
/// Nəticədə kimliyi bilinməyən bir skript dəqiqədə onlarla belə sorğu göndərərək
/// bazanı yazı əməliyyatları üçün yavaşlada bilirdi (gücləndirilmiş DoS).
///
/// HƏLL: nəticə (dövr + kateqoriya) açarı ilə <see cref="Ttl"/> müddətinə saxlanılır.
/// Bu müddət ərzində neçə sorğu gəlirsə gəlsin, baza yalnız BİR dəfə oxunur.
///
/// Hesablama qəsdən kilid altında aparılır: keş bitdiyi anda gələn 100 paralel sorğu
/// 100 ayrı tam skan başlatmır, biri hesablayır, qalanları hazır nəticəni alır
/// ("cache stampede" qorunması).
///
/// Nəticə ən çox <see cref="Ttl"/> qədər köhnə ola bilər — liderlər lövhəsi üçün
/// bu məqbuldur, cavab verildikdən sonra sıra bir dəqiqə ərzində yenilənir.
/// </summary>
public sealed class LeaderboardCache(TimeProvider clock)
{
    /// <summary>Snapshot-ın köhnəlmə müddəti.</summary>
    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Açar sayının yuxarı həddi. Açar = dövr (3) × kateqoriya (aktiv kateqoriya sayı + "all"),
    /// yəni normalda onlarla açar olur. Limit yalnız gözlənilməz artıma qarşı sığortadır.
    /// </summary>
    private const int MaxKeys = 128;

    private readonly object _gate = new();
    private readonly Dictionary<string, Snapshot> _snapshots = new(StringComparer.Ordinal);

    private sealed record Snapshot(DateTimeOffset ExpiresAt, List<LeaderboardEntryResponse> Entries);

    /// <summary>
    /// Açara uyğun hazır nəticəni qaytarır; keş boşdursa və ya köhnəlibsə <paramref name="build"/> ilə yenidən hesablayır.
    /// Qaytarılan siyahı PAYLAŞILANDIR — çağıran tərəf onu dəyişməməlidir (yalnız oxuyub kəsməlidir).
    /// </summary>
    public List<LeaderboardEntryResponse> GetOrBuild(string key, Func<List<LeaderboardEntryResponse>> build)
    {
        lock (_gate)
        {
            var now = clock.GetUtcNow();

            if (_snapshots.TryGetValue(key, out var cached) && cached.ExpiresAt > now)
                return cached.Entries;

            var entries = build();
            _snapshots[key] = new Snapshot(now.Add(Ttl), entries);

            if (_snapshots.Count > MaxKeys)
                Prune(now);

            return entries;
        }
    }

    /// <summary>Köhnəlmiş açarları təmizləyir; hamısı təzədirsə keş tam sıfırlanır.</summary>
    private void Prune(DateTimeOffset now)
    {
        var stale = _snapshots.Where(kv => kv.Value.ExpiresAt <= now).Select(kv => kv.Key).ToList();

        if (stale.Count == 0)
        {
            _snapshots.Clear();
            return;
        }

        foreach (var key in stale)
            _snapshots.Remove(key);
    }
}
