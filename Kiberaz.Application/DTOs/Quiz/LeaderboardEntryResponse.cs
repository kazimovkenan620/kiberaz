namespace Kiberaz.Application.DTOs.Quiz;

/// <summary>
/// Liderlik lövhəsinin bir sətri.
///
/// MƏXFİLİK QEYDİ: bu endpoint ictimaidir (girişsiz hər kəs görür).
/// Domain modelində yalnız Nickname ictimai elan edilib — ad, soyad və e-poçt DEYİL.
/// Buna görə burada istifadəçinin real adı HEÇ VAXT göndərilmir.
/// </summary>
public class LeaderboardEntryResponse
{
    public int    Rank  { get; set; }

    /// <summary>İstifadəçinin ləqəbi — ictimai göstərilməsi nəzərdə tutulan yeganə identifikatordur.</summary>
    public string Name  { get; set; } = string.Empty;

    /// <summary>İkinci sətir: "142 cavab · 87% dəqiqlik" — ləqəbin təkrarı deyil, real statistika.</summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>Çətinliyə görə çəkilənmiş xal (Başlanğıc 5 · Orta 10 · Peşəkar 15).</summary>
    public int    Score { get; set; }

    /// <summary>"gold" | "silver" | "bronze" | "default"</summary>
    public string Badge { get; set; } = "default";

    /// <summary>Ləqəbin ilk iki hərfi — avatar dairəsində göstərilir.</summary>
    public string Avatar { get; set; } = string.Empty;

    /// <summary>İstifadəçinin ən çox düzgün cavab verdiyi kateqoriya.</summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>"up" | "down" | "same" — əvvəlki eyni uzunluqlu dövrlə müqayisə.</summary>
    public string Change { get; set; } = "same";

    /// <summary>Neçə pillə dəyişib.</summary>
    public int    ChangeValue { get; set; }
}
