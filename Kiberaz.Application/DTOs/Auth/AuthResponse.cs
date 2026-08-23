namespace Kiberaz.Application.DTOs.Auth;

/// <summary>
/// Uğurlu login/register sonrası qaytarılan cavab.
/// Token-lar burada yer alır.
/// </summary>
public class AuthResponse
{
    /// <summary>JWT Access Token (15 dəqiqə ömrü var)</summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>Refresh Token (7 gün — yeni AccessToken almaq üçün)</summary>
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>AccessToken-in bitmə vaxtı (UTC)</summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>İstifadəçi haqqında qısa məlumat (UI üçün)</summary>
    public UserInfo User { get; set; } = new();
}

/// <summary>
/// JWT payload-na düşməyən, yalnız UI üçün qaytarılan istifadəçi məlumatı.
/// MƏXFILIK: Email HEÇVAXT API cavabında göstərilmir — yalnız Nickname ictimai olur.
/// </summary>
public class UserInfo
{
    public string Id { get; set; } = string.Empty;

    /// <summary>Saytda görünən ləqəb — Email deyil!</summary>
    public string Nickname { get; set; } = string.Empty;

    /// <summary>Ad (yalnız öz profilində görünür)</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>Soyad (yalnız öz profilində görünür)</summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>Cins rəqəmi: 1=Kişi, 2=Qadın</summary>
    public int Gender { get; set; }

    /// <summary>Hesabın yaradılma tarixi</summary>
    public DateTime JoinDate { get; set; }

    /// <summary>İstifadəçinin rolları (User, VIP, Moderator, Admin)</summary>
    public List<string> Roles { get; set; } = new();

    public string? ProfileImageUrl { get; set; }
}
