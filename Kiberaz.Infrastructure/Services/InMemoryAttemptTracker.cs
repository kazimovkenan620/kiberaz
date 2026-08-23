using System.Collections.Concurrent;
using Kiberaz.Application.Interfaces;

namespace Kiberaz.Infrastructure.Services;

// Uğursuz giriş cəhdlərini yaddaşda izləyən servis.
// Müəyyən bir açar (adətən IP və ya e-poçt) üçün cəhd sayı həddə çatdıqda CAPTCHA tələb olunur — verilənlər bazasına yük salmadan sürətli qoruma təmin edir.
public sealed class InMemoryAttemptTracker : IAttemptTracker
{
    // 5 uğursuz cəhddən sonra CAPTCHA aktivləşir, qeydlər 15 dəqiqə saxlanılır.
    private const int Threshold  = 5;
    private static readonly TimeSpan Expiry = TimeSpan.FromMinutes(15);

    // ConcurrentDictionary istifadə edilir — çox thread eyni anda yazsa belə race condition yaranmır.
    private readonly ConcurrentDictionary<string, Entry> _store = new();

    // Verilən açar üçün cəhd sayı həddə çatıbsa CAPTCHA lazım olduğunu bildirir.
    // Yoxlamadan əvvəl köhnəlmiş qeydlər avtomatik silinir.
    public bool RequiresCaptcha(string key)
    {
        Cleanup(key);
        return _store.TryGetValue(key, out var e) && e.Count >= Threshold;
    }

    // Bir uğursuz cəhdi qeydə alır və vaxt sayğacını sıfırlayır.
    // AddOrUpdate atomar əməliyyatdır — eyni açara paralel yazma zamanı heç bir cəhd itirilmir.
    public void Record(string key)
    {
        Cleanup(key);
        // Immutable replacement — mövcud Entry mutasiya edilmir, yeni obyekt qaytarılır.
        // ConcurrentDictionary.AddOrUpdate factory-ni bir neçə dəfə çağıra bilər; mutable in-place
        // dəyişiklik iki parallel sorğuda race condition yaradır (e.Count++ atomic deyil).
        _store.AddOrUpdate(
            key,
            _ => new Entry { Count = 1, ExpiresAt = DateTimeOffset.UtcNow.Add(Expiry) },
            (_, e) => new Entry { Count = e.Count + 1, ExpiresAt = DateTimeOffset.UtcNow.Add(Expiry) });
    }

    // Uğurlu giriş zamanı cəhd sayğacını sıfırlayır — istifadəçi düzgün girdikdən sonra məhdudiyyət qalxır.
    public void Reset(string key) => _store.TryRemove(key, out _);

    // Vaxtı keçmiş qeydləri yaddaşdan silir — belə ki, sistem sonsuz böyüməsin.
    private void Cleanup(string key)
    {
        if (_store.TryGetValue(key, out var e) && e.ExpiresAt < DateTimeOffset.UtcNow)
            _store.TryRemove(key, out _);
    }

    // Hər bir açar üçün cəhd sayını və bitmə vaxtını saxlayan daxili model.
    private sealed class Entry
    {
        public int Count { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
    }
}
