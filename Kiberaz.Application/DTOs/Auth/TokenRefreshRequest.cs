namespace Kiberaz.Application.DTOs.Auth;

/// <summary>
/// Access Token bitdikdə yeni token almaq üçün istifadə edilən DTO.
/// </summary>
public class TokenRefreshRequest
{
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>
    /// Refresh token. Body-də göndərilməyə bilər — bu halda httpOnly cookie-dən oxunur.
    /// </summary>
    public string? RefreshToken { get; set; }
}
