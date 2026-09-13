using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;

namespace Kiberaz.Infrastructure.Services;

/// <summary>
/// Qorunan sahib hesabı siyasəti.
///
/// PROBLEM: admin paneli olan hər sistemdə eyni risk var — səlahiyyəti olan bir nəfər
/// (səhvən və ya hesabı ələ keçirildikdən sonra) sahib hesabın rolunu sala, onu bloklaya
/// və ya özünə/başqasına Admin verə bilər. Bu, geri dönüşü olmayan vəziyyət yaradır:
/// platformanı idarə edən qalmır və bərpa yalnız baza faylına əl ilə müdaxilə ilə mümkün olur.
///
/// HƏLL: sahib hesabın kimliyi API-dən DEYİL, server konfiqurasiyasından gəlir.
/// Konfiqurasiyanı dəyişmək üçün serverə çıxış və yenidən başlatma lazımdır —
/// yəni bu hesabı dəyişmək HTTP sərhədindən kənarda, yalnız backend səviyyəsindədir.
///
/// Bu sinif yalnız "kim sahibdir" sualına cavab verir; qadağaları tətbiq edən yerlər
/// AdminService və UserService-dir.
/// </summary>
public sealed class ProtectedAccountPolicy
{
    /// <summary>Verilən istifadəçi qorunan sahib hesabıdırmı.</summary>
    public bool IsOwner(AppUser? user)
        => user is not null && IsOwnerEmail(user.NormalizedEmail ?? user.Email);

    /// <summary>Verilən e-poçt qorunan sahib hesabına aiddirmi.</summary>
    public bool IsOwnerEmail(string? email)
        => SystemAccounts.IsAdministratorEmail(email);

    /// <summary>
    /// Hesab istifadəçi görünüşlərindən (siyahı, statistika, liderlər lövhəsi, axtarış)
    /// tamamilə gizlədilməlidirmi.
    ///
    /// Sistem administratoru heç bir istifadəçi göstəricisində iştirak etmir — nə sətir,
    /// nə say, nə də sıralama kimi. Yoxlama HƏM sabit e-poçta, HƏM də Admin roluna baxır:
    /// bootstrap hələ işləməyibsə sahib müvəqqəti rolsuz, bazaya əl ilə müdaxilə olunubsa
    /// yad hesab rollu ola bilər — hər iki pəncərə burada bağlanır.
    ///
    /// Statik-dir ki, DI qurmadan hər servisdən eyni qayda çağırılsın (tək həqiqət mənbəyi).
    /// </summary>
    public static bool IsHiddenAccount(AppUser? user)
        => user is not null &&
           (SystemAccounts.IsAdministratorEmail(user.NormalizedEmail ?? user.Email) ||
            user.Roles.Contains(AppRoles.Admin));

    /// <summary>Qadağa mesajı — bütün yerlərdə eyni mətn işlədilsin deyə burada saxlanılır.</summary>
    public const string OwnerImmutableMessage =
        "Sistem administratoru dəyişdirilə və ya bloklana bilməz.";

    public const string AdminGrantBlockedMessage =
        "Admin rolu heç bir istifadəçiyə verilə bilməz.";
}
