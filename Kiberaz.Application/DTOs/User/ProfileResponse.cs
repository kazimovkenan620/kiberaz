namespace Kiberaz.Application.DTOs.User;

/// <summary>
/// GET /api/user/profile endpoint-i üçün cavab DTO-su.
/// İstifadəçinin öz profilini görməsi üçün — email daxildir (özü üçün).
/// Başqa istifadəçilərə göstərilmir.
/// </summary>
public class ProfileResponse
{
    public string Id { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    /// <summary>Email — yalnız öz profilində görünür, heç vaxt başqasına açılmır</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>1 = Kişi, 2 = Qadın</summary>
    public int Gender { get; set; }

    public DateTime JoinDate { get; set; }
    public List<string> Roles { get; set; } = new();
    public string? ProfileImageUrl { get; set; }
}
