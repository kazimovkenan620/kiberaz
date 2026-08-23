using Kiberaz.Domain.Common;
using Kiberaz.Domain.Enums;

namespace Kiberaz.Application.DTOs.Auth;

/// <summary>
/// İstifadəçi qeydiyyatı üçün giriş DTO-su.
/// Frontend-dən gələn JSON bu sinfə map olunur.
/// </summary>
public class RegisterRequest
{
    /// <summary>İstifadəçinin adı (tələb olunur)</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>İstifadəçinin soyadı (tələb olunur)</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>E-poçt ünvanı — login identifier kimi istifadə olunur</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Saytda görünəcək unikal ləqəb.
    /// Email gizli qalır — kənar istifadəçilər yalnız bu ləqəbi görür.
    /// </summary>
    public string Nickname { get; set; } = string.Empty;

    /// <summary>Hesab tipi: User ve ya Teacher</summary>
    public string Role { get; set; } = AppRoles.User;

    /// <summary>Cins</summary>
    public Gender Gender { get; set; }

    /// <summary>Şifrə — minimum 8 simvol, böyük hərf + rəqəm</summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>Şifrə təkrarı — Password ilə uyğun olmalıdır</summary>
    public string ConfirmPassword { get; set; } = string.Empty;

    /// <summary>Cloudflare Turnstile CAPTCHA tokeni</summary>
    public string CaptchaToken { get; set; } = string.Empty;
}
