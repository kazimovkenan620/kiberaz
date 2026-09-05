namespace Kiberaz.Domain.Entities;

/// <summary>
/// Uğursuz giriş / qeydiyyat / şifrə sıfırlama cəhdlərinin sayğacı.
///
/// Niyə bazada? Əvvəl bu sayğaclar yalnız proses yaddaşında saxlanılırdı —
/// tətbiq restart olduqda (deploy, IIS app pool recycle, crash) bütün sayğaclar sıfırlanır
/// və hücumçu CAPTCHA həddinə çatmadan istənilən qədər cəhd edə bilirdi.
/// </summary>
public class LoginAttempt
{
    /// <summary>
    /// Açarın SHA-256 hash-i (hex). Açarın özündə e-poçt və ya IP ola bilər —
    /// bu kolleksiyada açıq PII saxlamamaq üçün yalnız hash yazılır.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>Ardıcıl uğursuz cəhd sayı.</summary>
    public int Count { get; set; }

    /// <summary>Bu qeydin etibarlılıq müddəti — keçdikdən sonra sayğac sıfırlanmış sayılır.</summary>
    public DateTime ExpiresAt { get; set; }
}
