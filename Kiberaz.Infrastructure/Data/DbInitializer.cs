using LiteDB;
using Microsoft.AspNetCore.Identity;
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
    /// LiteDB-də tək-admin invariantını tətbiq edir. Yalnız kodda sabitlənmiş e-poçt
    /// Admin ola bilər; başqa hesablardakı Admin rolu silinir və sessiyaları ləğv edilir.
    /// </summary>
    public static void EnforceSingleAdministrator(LiteDbContext db, ILogger logger)
    {
        lock (db.UsersSyncRoot)
        {
            db.Database.BeginTrans();
            try
            {
                var users = db.Users.FindAll().ToList();
                var owners = users.Where(u => SystemAccounts.IsAdministratorEmail(u.NormalizedEmail ?? u.Email)).ToList();
                if (owners.Count > 1)
                    throw new InvalidOperationException("LiteDB-də sistem administratoru e-poçtu ilə birdən çox hesab mövcuddur.");

                var owner = owners.SingleOrDefault();
                var changed = 0;

                foreach (var user in users)
                {
                    var isOwner = ReferenceEquals(user, owner);
                    var desiredRoles = isOwner && user.EmailConfirmed
                        ? new List<string> { AppRoles.Admin }
                        : user.Roles.Where(r => !string.Equals(r, AppRoles.Admin, StringComparison.Ordinal)).Distinct(StringComparer.Ordinal).ToList();

                    if (!isOwner && desiredRoles.Count == 0)
                        desiredRoles.Add(AppRoles.User);

                    if (user.Roles.SequenceEqual(desiredRoles, StringComparer.Ordinal))
                        continue;

                    user.Roles = desiredRoles;
                    RevokeSessions(user);
                    user.ConcurrencyStamp = Guid.NewGuid().ToString();
                    if (!db.Users.Update(user))
                        throw new InvalidOperationException($"'{user.Id}' hesabının rolu yenilənmədi.");
                    changed++;
                }

                db.Database.Commit();

                if (owner is null)
                    logger.LogCritical("Sabit sistem administratoru hesabı tapılmadı: {Email}", SystemAccounts.AdministratorEmail);
                else if (!owner.EmailConfirmed)
                    logger.LogCritical("Sabit sistem administratorunun e-poçtu təsdiqlənməyib: {Email}", SystemAccounts.AdministratorEmail);

                if (changed > 0)
                    logger.LogWarning("Tək-admin qaydası tətbiq edildi; {Count} hesabın rolu və sessiyası yeniləndi.", changed);
            }
            catch
            {
                db.Database.Rollback();
                throw;
            }
        }
    }

    /// <summary>
    /// SXEM MİQRASİYASI — quiz suallarında sonradan əlavə edilmiş bool sahələrini doldurur.
    ///
    /// PROBLEM: LiteDB sxemsizdir. `QuizQuestion` sinfinə yeni `bool IsExamOnly` sahəsi
    /// əlavə ediləndə ARTIQ YAZILMIŞ sənədlərə bu sahə əlavə olunmur — onlar sahəsiz qalır.
    /// LiteDB-nin sorğu mühərriki isə olmayan sahəni `null` kimi görür, `null = false` isə
    /// DOĞRU DEYİL. Nəticədə `Find(q => !q.IsDeleted && !q.IsExamOnly)` sorğusu
    /// KÖHNƏ SUALLARIN HAMISINI KƏNARDA QOYUR.
    ///
    /// Simptom: bazada 250 sual olduğu halda bütün kateqoriyalar "0 sual" göstərir,
    /// quiz açılmır və cavab göndərmək "Sual tapılmadı" ilə bitir. Heç bir xəta logu olmur —
    /// sorğu texniki cəhətdən uğurludur, sadəcə boş nəticə qaytarır.
    ///
    /// HƏLL: sənədlər BsonDocument səviyyəsində oxunur (tipli oxunuşda olmayan sahə
    /// avtomatik `false` olur və "var/yox" fərqi itir), sahəsi olmayanlara `false` yazılır.
    /// Əməliyyat idempotentdir: ikinci işə salmada dəyişəcək sənəd qalmır.
    /// </summary>
    public static void BackfillQuizQuestionFlags(LiteDbContext db, ILogger logger)
    {
        var raw = db.Database.GetCollection("QuizQuestions");

        var missing = raw.FindAll()
            .Where(doc => !doc.ContainsKey("IsExamOnly"))
            .ToList();

        if (missing.Count == 0)
            return;

        foreach (var doc in missing)
            doc["IsExamOnly"] = false;

        var updated = raw.Update(missing);

        if (updated != missing.Count)
            logger.LogError(
                "Sxem miqrasiyası tam tamamlanmadı: {Missing} sənəddən {Updated} yeniləndi.",
                missing.Count, updated);

        logger.LogWarning(
            "Sxem miqrasiyası: {Count} quiz sualında 'IsExamOnly' sahəsi yox idi və `false` ilə dolduruldu. " +
            "Bu sahə olmadan həmin suallar quiz sorğularına düşmürdü.",
            updated);
    }

    private static void RevokeSessions(AppUser user)
    {
        user.SecurityStamp = Guid.NewGuid().ToString();
        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        user.GoogleLoginCodeHash = null;
        user.GoogleLoginCodeExpiryTime = null;
        user.GoogleLoginCodeSecurityStamp = null;
    }
}
