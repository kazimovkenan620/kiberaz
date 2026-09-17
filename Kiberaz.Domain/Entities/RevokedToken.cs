namespace Kiberaz.Domain.Entities;

// Çıxış edilmiş access tokenin jti-si — ömrü bitənə qədər (≤15 dəq) qara siyahıda qalır.
// Bu, tək cihazdan çıxışın dərhal təsir etməsini SecurityStamp-i yeniləmədən (digər cihazları öldürmədən) təmin edir.
public class RevokedToken
{
    public string Id { get; set; } = string.Empty; // jti
    public DateTime ExpiresAt { get; set; }
}
