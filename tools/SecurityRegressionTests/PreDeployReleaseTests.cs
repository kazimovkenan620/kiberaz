using System.Net;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Infrastructure.Data;

namespace Kiberaz.SecurityRegressionTests;

internal static partial class Program
{
    private static async Task RunPreDeployProfileTests(HttpClient client, Func<LiteDbContext> openDb,
        Dictionary<string, AppUser> accounts, Dictionary<string, string> tokens)
    {
        // Ad dəyişikliyi və erkən persist edən nickname yolu ayrı yoxlanır.
        var ownerId = accounts[AppRoles.Admin].Id;
        AppUser Read(string id)
        {
            using var db = openDb();
            return db.Users.FindById(id);
        }
        var owner = Read(ownerId);
        foreach (var nickname in new[] { owner.Nickname, "qaprotectedrename" })
        {
            using var response = await Send(client, new("PUT", "/api/User/profile"), tokens[AppRoles.Admin],
                body: new { firstName = "Dəyişiklik", lastName = "Sınağı", nickname, gender = 2 });
            Expect(response, HttpStatusCode.BadRequest, "qorunan sahibin profil dəyişikliyi rədd edilir");
            var after = Read(ownerId);
            Check(after.FirstName == owner.FirstName && after.LastName == owner.LastName
                && after.Nickname == owner.Nickname && after.UserName == owner.UserName
                && after.NormalizedUserName == owner.NormalizedUserName && after.Gender == owner.Gender,
                "qorunan sahibin bütün profil sahələri və normalizasiya dəyişməz qalır");
        }
        foreach (var role in new[] { AppRoles.User, AppRoles.Teacher, AppRoles.VIP, AppRoles.Moderator })
        {
            var user = NewUser("profile" + role.ToLowerInvariant(), role);
            using (var db = openDb()) db.Users.Insert(user);
            var nickname = "updated" + role.ToLowerInvariant();
            using var response = await Send(client, new("PUT", "/api/User/profile"), MakeToken(user),
                body: new { firstName = "Əli", lastName = "Şükürov", nickname, gender = 1 });
            Expect(response, HttpStatusCode.OK, "adi rol öz profilini yeniləyə bilir: " + role);
            var after = Read(user.Id);
            Check(after.FirstName == "Əli" && after.LastName == "Şükürov" && after.Nickname == nickname,
                "adi profil dəyişikliyi saxlanır: " + role);
        }
    }
}
