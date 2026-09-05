using System.Security.Cryptography;
using System.Text;
using Kiberaz.Application.Interfaces;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// Uğursuz cəhdləri LiteDB-də izləyən tracker.
///
/// InMemoryAttemptTracker-dən fərqi: sayğaclar tətbiqin restart-ından sağ çıxır.
/// Əvvəlki yaddaş versiyasında deploy/app-pool recycle bütün sayğacları sıfırlayırdı —
/// hücumçu üçün CAPTCHA-nı sıfırlamağın ucuz yolu idi. Üstəlik köhnə qeydlər yalnız
/// yenidən toxunulduqda təmizlənirdi, bir daha görünməyən açarlar yaddaşda əbədi qalırdı.
/// </summary>
public sealed class LiteDbAttemptTracker : IAttemptTracker
{
    // 5 uğursuz cəhddən sonra CAPTCHA aktivləşir, qeydlər 15 dəqiqə yaşayır.
    private const int Threshold = 5;
    private static readonly TimeSpan Expiry = TimeSpan.FromMinutes(15);

    // Vaxtı keçmiş qeydlərin toplu təmizlənməsi bu intervaldan tez-tez işə düşmür —
    // hər sorğuda DeleteMany çağırmaq lazımsız disk yazısı deməkdir.
    private static readonly TimeSpan PurgeInterval = TimeSpan.FromMinutes(5);

    // LiteDB tək fayl üzərində işlədiyi üçün oxu-dəyiş-yaz ardıcıllığı kilidlə qorunur.
    // Bu olmadan iki paralel uğursuz giriş eyni sayğacı oxuyub eyni dəyəri yaza bilər (lost update).
    private static readonly object Gate = new();
    private static DateTime _lastPurge = DateTime.MinValue;

    private readonly LiteDbContext _db;

    public LiteDbAttemptTracker(LiteDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public bool RequiresCaptcha(string key)
    {
        var id = HashKey(key);
        lock (Gate)
        {
            PurgeIfDue();

            var entry = _db.LoginAttempts.FindById(id);
            if (entry is null)
                return false;

            if (entry.ExpiresAt <= DateTime.UtcNow)
            {
                _db.LoginAttempts.Delete(id);
                return false;
            }

            return entry.Count >= Threshold;
        }
    }

    /// <inheritdoc />
    public void Record(string key)
    {
        var id  = HashKey(key);
        var now = DateTime.UtcNow;

        lock (Gate)
        {
            PurgeIfDue();

            var entry = _db.LoginAttempts.FindById(id);

            // Qeyd yoxdursa və ya vaxtı keçibsə sıfırdan başlanır — köhnə cəhdlər əbədi toplanmır.
            if (entry is null || entry.ExpiresAt <= now)
                entry = new LoginAttempt { Id = id, Count = 0 };

            entry.Count++;
            entry.ExpiresAt = now.Add(Expiry);

            _db.LoginAttempts.Upsert(entry);
        }
    }

    /// <inheritdoc />
    public void Reset(string key)
    {
        var id = HashKey(key);
        lock (Gate)
        {
            _db.LoginAttempts.Delete(id);
        }
    }

    // Açar e-poçt və ya IP ehtiva edə bilər — bazaya açıq yazılmır, yalnız hash saxlanılır.
    private static string HashKey(string key)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)));

    // Vaxtı keçmiş bütün qeydləri silir. Kilid içindən çağrılır.
    private void PurgeIfDue()
    {
        var now = DateTime.UtcNow;
        if (now - _lastPurge < PurgeInterval)
            return;

        _lastPurge = now;
        _db.LoginAttempts.DeleteMany(a => a.ExpiresAt <= now);
    }
}
