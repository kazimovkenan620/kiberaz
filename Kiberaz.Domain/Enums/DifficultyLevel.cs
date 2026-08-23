namespace Kiberaz.Domain.Enums;

/// <summary>
/// Quiz suallarının çətinlik səviyyəsi.
/// Azərbaycan dilində: Başlanğıc, Orta, Peşəkar
/// </summary>
public enum DifficultyLevel
{
    /// <summary>Başlanğıc səviyyə — yeni başlayanlar üçün</summary>
    Beginner = 0,

    /// <summary>Orta səviyyə — orta bilikli mütəxəssislər üçün</summary>
    Intermediate = 1,

    /// <summary>Peşəkar səviyyə — təcrübəli ekspertlər üçün</summary>
    Expert = 2
}
