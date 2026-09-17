namespace Kiberaz.Domain.Entities;

// Bir cihazın refresh token ailəsi. Hər yeniləmədə TokenHash dəyişir, əvvəlki hash PreviousTokenHash-də qalır:
// köhnə token təkrar təqdim olunarsa (oğurluq əlaməti) yalnız BU sessiya ləğv edilir, digər cihazlar toxunulmur.
public class RefreshSession
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string TokenHash { get; set; } = string.Empty;
    public string? PreviousTokenHash { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LastUsedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    // Yalnız diaqnostika üçün (sessiya siyahısı); PII kimi loglanmır.
    public string? Ip { get; set; }
}
