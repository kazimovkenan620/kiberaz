namespace Kiberaz.Application.DTOs.User;

/// <summary>
/// PUT /api/user/profile endpoint-i üçün giriş DTO-su.
/// Yalnız dəyişdirilə bilən sahələri qəbul edirik.
/// Email ve Rol dəyişdirilmir (ayrıca endpoint lazımdır).
/// </summary>
public class UpdateProfileRequest
{
    /// <summary>Yeni ad (məcburi, max 50 simvol)</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>Yeni soyad (məcburi, max 50 simvol)</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>Yeni nickname (mecburi, unikal, 3-16 simvol)</summary>
    public string Nickname { get; set; } = string.Empty;

    /// <summary>Cins: 1 = Kişi, 2 = Qadın</summary>
    public int Gender { get; set; }
}
