using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

// jti qara siyahısı: yaddaşda sürətli yoxlama + LiteDB-də davamlılıq (deploy/restart sonrası çıxış edilmiş token dirilməsin).
// Access token 15 dəqiqəlikdir — siyahı kiçik qalır, vaxtı keçənlər 5 dəqiqədən bir təmizlənir.
public sealed class LiteDbTokenDenylist : ITokenDenylist
{
    private static readonly TimeSpan PurgeInterval = TimeSpan.FromMinutes(5);
    private readonly object _gate = new();
    private readonly Dictionary<string, DateTime> _memory = new(StringComparer.Ordinal);
    private readonly LiteDbContext _db;
    private readonly TimeProvider _clock;
    private DateTime _lastPurge = DateTime.MinValue;

    public LiteDbTokenDenylist(LiteDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
        var now = clock.GetUtcNow().UtcDateTime;
        foreach (var token in db.RevokedTokens.FindAll())
            if (token.ExpiresAt > now) _memory[token.Id] = token.ExpiresAt;
    }

    public void Revoke(string tokenId, DateTime expiresAtUtc)
    {
        if (string.IsNullOrWhiteSpace(tokenId)) return;
        lock (_gate)
        {
            PurgeIfDue();
            _memory[tokenId] = expiresAtUtc;
            _db.RevokedTokens.Upsert(new RevokedToken { Id = tokenId, ExpiresAt = expiresAtUtc });
        }
    }

    public bool IsRevoked(string tokenId)
    {
        lock (_gate)
        {
            PurgeIfDue();
            return _memory.TryGetValue(tokenId, out var expires) && expires > _clock.GetUtcNow().UtcDateTime;
        }
    }

    private void PurgeIfDue()
    {
        var now = _clock.GetUtcNow().UtcDateTime;
        if (now - _lastPurge < PurgeInterval) return;
        _lastPurge = now;
        foreach (var expired in _memory.Where(kv => kv.Value <= now).Select(kv => kv.Key).ToList())
            _memory.Remove(expired);
        _db.RevokedTokens.DeleteMany(t => t.ExpiresAt <= now);
    }
}
