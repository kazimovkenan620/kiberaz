namespace Kiberaz.Application.DTOs.Auth;

/// <summary>
/// <c>GET /api/auth/me</c> cavabı — cari sessiyanın sahibi.
/// Dəyərlər JWT claim-lərindən oxunur, bazaya sorğu göndərilmir.
/// Həssas sahə (parol hash-i, SecurityStamp, refresh token) burada YOXDUR və olmamalıdır.
/// </summary>
public class CurrentUserResponse
{
    public string UserId { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string FirstName { get; set; } = string.Empty;

    public string LastName { get; set; } = string.Empty;

    public List<string> Roles { get; set; } = new();
}
