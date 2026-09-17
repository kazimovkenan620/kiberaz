using Kiberaz.Application.DTOs.Auth;
using Kiberaz.Application.DTOs.Common;

namespace Kiberaz.Application.Interfaces;

/// <summary>
/// Authentication servisinin müqaviləsi (contract).
/// Infrastructure layeri bu interface-i implement edir.
/// API layeri yalnız bu interface ilə danışır — heç vaxt birbaşa servislə yox.
/// Bu Dependency Inversion Principle-in tətbiqidir.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Yeni istifadəçi qeydiyyatı.
    /// Uğurlu olarsa: JWT token + istifadəçi məlumatı qaytarır.
    /// </summary>
    Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest request);

    /// <summary>
    /// İstifadəçi girişi.
    /// Uğursuz olarsa: HƏMIŞƏ "Etimadnamələr yanlışdır" — hansı sahənin yanlış
    /// olduğunu bildirmirik (information leakage önlənməsi).
    /// </summary>
    Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest request);

    /// <summary>
    /// Çıxış — Refresh token-ı ləğv edir.
    /// </summary>

    /// <summary>
    /// Cari cihazdan çıxış: access token (jti) dərhal qara siyahıya düşür, yalnız bu cihazın refresh sessiyası silinir.
    /// Refresh token tanınmırsa (cookie yoxdur) təhlükəsiz tərəfdə qalıb hər yerdən çıxılır.
    /// </summary>
    Task<ApiResponse<bool>> LogoutAsync(string userId, string? refreshToken, string? accessTokenId, DateTime? accessTokenExpiresAt);

    /// <summary>Bütün cihazlardan çıxış: SecurityStamp yenilənir, bütün refresh sessiyaları silinir.</summary>
    Task<ApiResponse<bool>> LogoutAllAsync(string userId);

    /// <summary>
    /// Access Token bitdikdə Refresh Token vasitəsilə yeni token alır.
    /// </summary>
    Task<ApiResponse<AuthResponse>> RefreshTokenAsync(TokenRefreshRequest request);

    /// <summary>
    /// E-poçt təsdiqi — link vasitəsilə hesabı aktivləşdirir.
    /// </summary>
    Task<ApiResponse<bool>> ConfirmEmailAsync(string userId, string token);

    Task<ApiResponse<bool>> ResendConfirmationEmailAsync(ResendConfirmationEmailRequest request);

    Task<ApiResponse<string>> CreateGoogleLoginCodeAsync(string providerId, string email, bool authoritativeEmail, string firstName, string lastName);

    Task<ApiResponse<AuthResponse>> ExchangeGoogleLoginCodeAsync(string code);

    Task<ApiResponse<bool>> ForgotPasswordAsync(ForgotPasswordRequest request);

    Task<ApiResponse<bool>> ResetPasswordAsync(ResetPasswordRequest request);
}
