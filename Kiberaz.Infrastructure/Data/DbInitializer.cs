using Microsoft.AspNetCore.Identity;
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
}
