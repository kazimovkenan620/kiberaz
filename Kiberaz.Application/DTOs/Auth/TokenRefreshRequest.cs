namespace Kiberaz.Application.DTOs.Auth;

/// <summary>
/// Access Token bitdikdə yeni token almaq üçün istifadə edilən DTO.
/// </summary>
public class TokenRefreshRequest
{
    /// <summary>
    /// Vaxtı keçmiş access token. Boş göndərilə bilər (yeni tab / səhifə yenilənməsi) — bu halda sessiya
    /// yalnız cookie-dəki refresh tokenin hash-i ilə tapılır.
    /// </summary>
    public string? AccessToken { get; set; }

    /// <summary>
    /// Refresh token. Body-də göndərilməyə bilər — bu halda httpOnly cookie-dən oxunur.
    /// </summary>
    public string? RefreshToken { get; set; }
}
