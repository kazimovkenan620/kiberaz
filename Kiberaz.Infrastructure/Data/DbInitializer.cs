using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;

namespace Kiberaz.Infrastructure.Data;

/// <summary>
/// Verilənlər bazasının ilkin məlumatlarını yaradır.
/// RoleManager{AppRole} vasitəsilə rolları seed edir.
///
/// EF Core → LiteDB dəyişikliyi:
/// - RoleManager{IdentityRole} → RoleManager{AppRole}
/// </summary>
public static class DbInitializer
{
    public static async Task SeedRolesAsync(RoleManager<AppRole> roleManager)
    {
        string[] roles =
        {
            AppRoles.Admin,
            AppRoles.Moderator,
            AppRoles.VIP,
            AppRoles.User,
            AppRoles.Teacher
        };

        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new AppRole { Name = role });
            }
        }
    }

    /// <summary>
    /// İlk admini konfiqurasiyadan təyin edir (bootstrap).
    ///
    /// PROBLEM: rolu dəyişmək üçün Admin olmaq lazımdır — yəni sistemdə heç bir admin yoxdursa
    /// heç vaxt yarana da bilmir. Əvvəl bunun yeganə həlli .db faylını əl ilə redaktə etmək idi.
    ///
    /// TƏHLÜKƏSİZLİK ÇƏRÇİVƏSİ — bu metod qəsdən dar saxlanılıb:
    ///   • Yeni istifadəçi YARATMIR. Yalnız artıq mövcud olan hesabı yüksəldir.
    ///   • E-poçtu təsdiqlənməmiş hesabı yüksəltmir — əks halda kimsə sənin admin e-poçtunla
    ///     qeydiyyatdan keçib təsdiqləmədən admin ola bilərdi.
    ///   • Açar konfiqurasiyadadır; oranı ələ keçirən onsuz da JWT SecretKey-ə sahibdir.
    ///   • Hər yüksəltmə xəbərdarlıq kimi loglanır.
    /// Admin yarandıqdan sonra açarı konfiqurasiyadan silmək tövsiyə olunur.
    /// </summary>
    public static async Task SeedAdminAsync(
        UserManager<AppUser> userManager,
        IConfiguration configuration,
        ILogger logger)
    {
        var adminEmail = configuration["AdminBootstrap:Email"];
        if (string.IsNullOrWhiteSpace(adminEmail))
            return;

        var user = await userManager.FindByEmailAsync(adminEmail.Trim());
        if (user is null)
        {
            logger.LogWarning(
                "AdminBootstrap: '{Email}' hesabı tapılmadı. Əvvəlcə qeydiyyatdan keçin, sonra tətbiqi yenidən başladın.",
                adminEmail);
            return;
        }

        if (!user.EmailConfirmed)
        {
            logger.LogWarning(
                "AdminBootstrap: '{Email}' hesabının e-poçtu təsdiqlənməyib — admin rolu verilmədi.",
                adminEmail);
            return;
        }

        if (await userManager.IsInRoleAsync(user, AppRoles.Admin))
            return;

        var result = await userManager.AddToRoleAsync(user, AppRoles.Admin);
        if (!result.Succeeded)
        {
            logger.LogError("AdminBootstrap: rol verilə bilmədi — {Errors}",
                string.Join(", ", result.Errors.Select(e => e.Description)));
            return;
        }

        // Damğa yenilənir ki, istifadəçinin əlindəki köhnə token dərhal etibarsız olsun
        // və növbəti refresh-də yeni token artıq Admin claim-i ilə gəlsin.
        await userManager.UpdateSecurityStampAsync(user);

        logger.LogWarning("AdminBootstrap: '{Email}' hesabına Admin rolu verildi.", adminEmail);
    }
}
