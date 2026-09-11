using System.Collections.Concurrent;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Kiberaz.Api.Controllers;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;
using Kiberaz.Infrastructure.Identity;
using Kiberaz.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;

namespace Kiberaz.SecurityRegressionTests;

internal static partial class Program
{
    private const string Password = "SecurityTest123!";
    private const string Issuer = "kiberaz-security-tests";
    private const string Audience = "kiberaz-security-client";
    private static readonly string SigningKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));
    private static readonly List<string> Failures = [];
    private static int _assertions;

    public static async Task<int> Main()
    {
        var sandbox = Path.Combine(Path.GetTempPath(), "kiberaz-security-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(sandbox);
        Process? api = null;
        Task? stdout = null;
        Task? stderr = null;
        var diagnostics = new ConcurrentQueue<string>();
        try
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:LiteDb"] = $"Filename={Path.Combine(sandbox, "security.db")};Connection=shared",
                ["JwtSettings:SecretKey"] = SigningKey,
                ["JwtSettings:Issuer"] = Issuer,
                ["JwtSettings:Audience"] = Audience,
                ["Authentication:Google:ClientId"] = "",
                ["Authentication:Google:ClientSecret"] = "",
                ["Captcha:SecretKey"] = "",
                ["Captcha:AllowDevelopmentBypass"] = "false",
                ["EmailSettings:SmtpHost"] = "127.0.0.1",
                ["EmailSettings:SmtpPort"] = "9",
                ["EmailSettings:FromEmail"] = "no-email@example.invalid",
                ["EmailSettings:SmtpUsername"] = "",
                ["EmailSettings:SmtpPassword"] = "",
                ["FrontendUrl"] = "http://localhost:5173",
                ["Logging:LogLevel:Default"] = "Warning",
                ["Logging:LogLevel:Microsoft.AspNetCore"] = "Warning"
            };
            // Production Program adds this last, so test configuration also overrides developer secrets.
            await File.WriteAllTextAsync(Path.Combine(sandbox, "appsettings.Local.json"), JsonSerializer.Serialize(settings));
            var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
            var environment = new TestEnvironment(sandbox);
            LiteDbContext OpenDb() => new(config, environment);

            var accounts = new Dictionary<string, AppUser>();
            using (var db = OpenDb())
            {
                foreach (var role in new[] { AppRoles.Admin, AppRoles.User, AppRoles.Teacher, AppRoles.Moderator, AppRoles.VIP })
                {
                    var user = NewUser(role.ToLowerInvariant(), role);
                    // Sistem administratoru yalnız kodda sabitlənmiş e-poçtdur. Fikstür başqa
                    // ünvanla yaradılsa, tətbiq başlanğıcda onun Admin rolunu silərdi.
                    if (role == AppRoles.Admin)
                    {
                        user.Email = SystemAccounts.AdministratorEmail;
                        user.NormalizedEmail = SystemAccounts.NormalizedAdministratorEmail;
                        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, Password);
                    }
                    db.Users.Insert(user);
                    accounts.Add(role, user);
                }
                // A single category skips importing unrelated production quiz seed data.
                db.QuizCategories.Insert(new QuizCategory
                {
                    Title = "Security fixture", Icon = "shield", Description = "Temporary security test category",
                    Color = "cyan", Topics = []
                });
            }

            var address = new Uri($"http://127.0.0.1:{ReservePort()}");
            var apiAssembly = typeof(AdminController).Assembly.Location;
            if (!File.Exists(Path.ChangeExtension(apiAssembly, ".runtimeconfig.json")))
                throw new InvalidOperationException("API runtime configuration was not copied. Run dotnet build before the test.");
            var start = new ProcessStartInfo("dotnet")
            {
                WorkingDirectory = sandbox,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            start.ArgumentList.Add(apiAssembly);
            start.ArgumentList.Add("--contentRoot");
            start.ArgumentList.Add(sandbox);
            start.ArgumentList.Add("--urls");
            start.ArgumentList.Add(address.AbsoluteUri);
            start.Environment["ASPNETCORE_ENVIRONMENT"] = Environments.Development;
            start.Environment["DOTNET_ENVIRONMENT"] = Environments.Development;
            // Never use inherited bootstrap, SMTP or database settings for this child process.
            foreach (var setting in settings)
                start.Environment[setting.Key.Replace(":", "__", StringComparison.Ordinal)] = setting.Value;
            api = Process.Start(start) ?? throw new InvalidOperationException("Could not start isolated API.");
            stdout = Capture(api.StandardOutput, diagnostics);
            stderr = Capture(api.StandardError, diagnostics);
            using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false })
            {
                BaseAddress = address,
                Timeout = TimeSpan.FromSeconds(15)
            };
            await WaitForApi(client, api);

            var tokens = new Dictionary<string, string>();
            foreach (var (role, account) in accounts)
                tokens[role] = (await Login(client, account, role)).AccessToken;

            async Task<(AppUser User, AuthSession Session)> NewSession(string role)
            {
                var user = NewUser("session" + Guid.NewGuid().ToString("N")[..7], role);
                using (var db = OpenDb()) db.Users.Insert(user);
                return (user, await Login(client, user, role));
            }

            var protectedRoutes = GetProtectedRoutes().ToArray();
            Check(protectedRoutes.Length >= 15, "admin and privileged quiz route discovery covers the expected surface");
            foreach (var route in protectedRoutes)
            {
                using var anonymous = await Send(client, route, null);
                Expect(anonymous, HttpStatusCode.Unauthorized, $"anonymous {route}");
                foreach (var role in new[] { AppRoles.User, AppRoles.Teacher, AppRoles.Moderator, AppRoles.VIP })
                {
                    using var denied = await Send(client, route, tokens[role]);
                    Expect(denied, HttpStatusCode.Forbidden, $"{role} {route}");
                    using var spoofed = await Send(client, route, tokens[role], spoofAdmin: true);
                    Expect(spoofed, HttpStatusCode.Forbidden, $"{role} query/header role spoof {route}");
                }
            }
            Console.WriteLine($"Checked {protectedRoutes.Length} privileged routes for anonymous and four non-admin roles.");

            foreach (var route in protectedRoutes.Where(r => r.Method == "GET"))
            {
                using var permitted = await Send(client, route, tokens[AppRoles.Admin]);
                Expect(permitted, HttpStatusCode.OK, $"Admin {route}");
            }
            using (var category = await Send(client, new("POST", "/api/quiz/categories"), tokens[AppRoles.Admin], body: new
            {
                title = "Admin security test", icon = "shield", description = "Created by the isolated security regression test",
                color = "cyan", topics = new[] { "Authorization" }, sortOrder = 10
            }))
            {
                Expect(category, HttpStatusCode.Created, "Admin can create quiz category");
                if (category.IsSuccessStatusCode)
                {
                    using var body = JsonDocument.Parse(await category.Content.ReadAsStringAsync());
                    var id = body.RootElement.GetProperty("data").GetProperty("id").GetInt32();
                    using var deleted = await Send(client, new("DELETE", $"/api/quiz/categories/{id}"), tokens[AppRoles.Admin]);
                    Expect(deleted, HttpStatusCode.OK, "Admin can delete own fixture category");
                }
            }

            var admin = accounts[AppRoles.Admin];
            var invalidTokens = new Dictionary<string, string>
            {
                ["wrong signature"] = MakeToken(admin, key: Convert.ToHexString(RandomNumberGenerator.GetBytes(64))),
                ["unsigned alg none"] = MakeToken(admin, unsigned: true),
                ["expired"] = MakeToken(admin, expires: DateTime.UtcNow.AddMinutes(-1)),
                ["wrong issuer"] = MakeToken(admin, issuer: "untrusted-issuer"),
                ["wrong audience"] = MakeToken(admin, audience: "untrusted-audience"),
                ["wrong security stamp"] = MakeToken(admin, stamp: "invalid-stamp"),
                ["missing token security stamp"] = MakeToken(admin, omitStamp: true),
                ["missing subject"] = MakeToken(admin, omitSubject: true),
                ["missing database user"] = MakeToken(NewUser("not-in-database", AppRoles.Admin)),
                ["unexpected signing algorithm"] = MakeToken(admin, algorithm: SecurityAlgorithms.HmacSha512)
            };
            foreach (var (name, token) in invalidTokens)
            {
                using var rejected = await Send(client, new("GET", "/api/admin/stats"), token);
                Expect(rejected, HttpStatusCode.Unauthorized, name);
            }

            foreach (var state in new[] { "missing database stamp", "blocked account", "unconfirmed email", "deleted account", "removed admin role" })
            {
                var user = NewUser("state" + Guid.NewGuid().ToString("N")[..7], AppRoles.Admin);
                using (var db = OpenDb()) db.Users.Insert(user);
                var token = MakeToken(user);
                using (var db = OpenDb())
                {
                    switch (state)
                    {
                        case "missing database stamp": user.SecurityStamp = null; break;
                        case "blocked account": user.LockoutEnd = DateTimeOffset.UtcNow.AddDays(1); break;
                        case "unconfirmed email": user.EmailConfirmed = false; break;
                        case "deleted account": db.Users.Delete(user.Id); break;
                        case "removed admin role": user.Roles = [AppRoles.User]; break;
                    }
                    if (state != "deleted account") db.Users.Update(user);
                }
                using var rejected = await Send(client, new("GET", "/api/admin/stats"), token);
                if (state == "removed admin role")
                    Check(rejected.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
                        $"stale Admin JWT rejected after DB role removal without stamp change (HTTP {(int)rejected.StatusCode})");
                else Expect(rejected, HttpStatusCode.Unauthorized, state);
            }

            // Even correctly signed role claims cannot substitute for a current database role.
            var roleSpoof = MakeToken(accounts[AppRoles.User], roles: [AppRoles.Admin]);
            using (var denied = await Send(client, new("GET", "/api/admin/users"), roleSpoof))
                Check(denied.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
                    $"token Admin claim cannot override database User role (HTTP {(int)denied.StatusCode})");

            var ordinary = accounts[AppRoles.User];
            using (var denied = await Send(client, new("PATCH", "/api/user/role"), tokens[AppRoles.User], body: new { newRole = AppRoles.Admin }))
                Expect(denied, HttpStatusCode.BadRequest, "self-service role change cannot grant Admin");
            using (var overpost = await Send(client, new("PUT", "/api/user/profile"), tokens[AppRoles.User], body: new
            {
                firstName = "Security", lastName = "Tester", nickname = ordinary.Nickname, gender = 1,
                id = admin.Id, roles = new[] { AppRoles.Admin }, role = AppRoles.Admin,
                isAdmin = true, emailConfirmed = true, securityStamp = admin.SecurityStamp
            }))
                Check(overpost.StatusCode is HttpStatusCode.OK or HttpStatusCode.BadRequest,
                    $"profile DTO overposting handled (HTTP {(int)overpost.StatusCode})");
            using (var db = OpenDb())
            {
                var stored = db.Users.FindById(ordinary.Id);
                Check(stored.Roles.SequenceEqual(new[] { AppRoles.User }), "profile/role overposting leaves database roles unchanged");
                Check(stored.SecurityStamp != admin.SecurityStamp, "profile overposting cannot replace security stamp");
                Check(db.Users.FindById(admin.Id).FirstName == admin.FirstName, "profile ID overposting cannot edit another user");
            }
            using (var denied = await Send(client, new("GET", "/api/admin/stats"), tokens[AppRoles.User]))
                Expect(denied, HttpStatusCode.Forbidden, "profile overposting does not grant admin access");

            // Only one request may consume a refresh token, including simultaneous requests.
            var rotation = await NewSession(AppRoles.User);
            var refreshResponses = await Task.WhenAll(Refresh(client, rotation.Session), Refresh(client, rotation.Session));
            try
            {
                Check(refreshResponses.Count(response => response.StatusCode == HttpStatusCode.OK) == 1
                    && refreshResponses.Count(response => response.StatusCode == HttpStatusCode.BadRequest) == 1,
                    "parallel refresh of the same pair has exactly one winner");
                var winner = refreshResponses.FirstOrDefault(response => response.IsSuccessStatusCode);
                if (winner is not null)
                {
                    var rotated = await ReadSession(winner);
                    Check(rotated.RefreshCookie != rotation.Session.RefreshCookie, "refresh token rotates");
                    using var stillValid = await Send(client, new("GET", "/api/user/profile"), rotated.AccessToken);
                    Expect(stillValid, HttpStatusCode.OK, "winning refresh issues a usable access token");
                }
            }
            finally { foreach (var response in refreshResponses) response.Dispose(); }
            using (var replay = await Refresh(client, rotation.Session))
                Expect(replay, HttpStatusCode.BadRequest, "consumed refresh token cannot be replayed");

            foreach (var state in new[] { "changed stamp", "missing stamp", "blocked", "unconfirmed", "missing expiry", "expired refresh" })
            {
                var fixture = await NewSession(AppRoles.User);
                using (var db = OpenDb())
                {
                    var user = db.Users.FindById(fixture.User.Id);
                    switch (state)
                    {
                        case "changed stamp": user.SecurityStamp = Guid.NewGuid().ToString(); break;
                        case "missing stamp": user.SecurityStamp = null; break;
                        case "blocked": user.LockoutEnd = DateTimeOffset.UtcNow.AddDays(1); break;
                        case "unconfirmed": user.EmailConfirmed = false; break;
                        case "missing expiry": user.RefreshTokenExpiryTime = null; break;
                        case "expired refresh": user.RefreshTokenExpiryTime = DateTime.UtcNow.AddMinutes(-1); break;
                    }
                    db.Users.Update(user);
                }
                using var revoked = await Refresh(client, fixture.Session);
                Expect(revoked, HttpStatusCode.BadRequest, "refresh rejects " + state);
            }

            var logout = await NewSession(AppRoles.User);
            using (var loggedOut = await Send(client, new("POST", "/api/auth/logout"), logout.Session.AccessToken))
                Expect(loggedOut, HttpStatusCode.OK, "logout succeeds");
            using (var oldAccess = await Send(client, new("GET", "/api/admin/stats"), logout.Session.AccessToken))
                Expect(oldAccess, HttpStatusCode.Unauthorized, "logout immediately revokes access token");
            using (var oldRefresh = await Refresh(client, logout.Session))
                Expect(oldRefresh, HttpStatusCode.BadRequest, "logout revokes refresh token");

            // ── TƏK ADMİN İNVARİANTI ────────────────────────────────────
            // Qayda: Admin rolu heç kimə verilə bilməz, sistem administratoru dəyişdirilə,
            // bloklana və istifadəçi göstəricilərində görünə bilməz. Aşağıdakılar bu qaydanın
            // UI-da deyil, HTTP sərhədində və bazada tətbiq olunduğunu yoxlayır.
            var promotion = await NewSession(AppRoles.User);
            using (var denied = await Send(client, new("PATCH", $"/api/admin/users/{promotion.User.Id}/role"), tokens[AppRoles.Admin],
                body: new { role = AppRoles.Admin }))
                Expect(denied, HttpStatusCode.BadRequest, "Admin rolu heç bir istifadəçiyə verilə bilmir");
            using (var db = OpenDb())
                Check(db.Users.FindById(promotion.User.Id).Roles.SequenceEqual(new[] { AppRoles.User }),
                    "rədd edilən Admin təyinatı bazada iz qoymur");
            using (var intact = await Send(client, new("GET", "/api/user/profile"), promotion.Session.AccessToken))
                Expect(intact, HttpStatusCode.OK, "rədd edilən rol dəyişikliyi mövcud sessiyanı ləğv etmir");

            // İcazəli rola keçid isə işləyir və köhnə sessiyanı ləğv edir.
            using (var changed = await Send(client, new("PATCH", $"/api/admin/users/{promotion.User.Id}/role"), tokens[AppRoles.Admin],
                body: new { role = AppRoles.Teacher }))
                Expect(changed, HttpStatusCode.OK, "administrator can change a user to an allowed role");
            using (var denied = await Send(client, new("GET", "/api/user/profile"), promotion.Session.AccessToken))
                Expect(denied, HttpStatusCode.Unauthorized, "role change revokes old access token");

            // Sahib hesabın rolu və bloku API-dən toxunulmazdır — admin özü də daxil olmaqla.
            var owner = accounts[AppRoles.Admin];
            foreach (var role in new[] { AppRoles.User, AppRoles.Teacher, AppRoles.Moderator, AppRoles.VIP, AppRoles.Admin })
                using (var denied = await Send(client, new("PATCH", $"/api/admin/users/{owner.Id}/role"), tokens[AppRoles.Admin],
                    body: new { role }))
                    Expect(denied, HttpStatusCode.BadRequest, $"sistem administratorunun rolu '{role}' olaraq dəyişdirilə bilmir");
            using (var denied = await Send(client, new("PATCH", $"/api/admin/users/{owner.Id}/block"), tokens[AppRoles.Admin]))
                Expect(denied, HttpStatusCode.BadRequest, "sistem administratoru bloklana bilmir");
            using (var db = OpenDb())
            {
                var stored = db.Users.FindById(owner.Id);
                Check(stored.Roles.SequenceEqual(new[] { AppRoles.Admin }) && stored.LockoutEnd is null,
                    "sistem administratorunun rolu və bloku bazada dəyişməz qalır");
            }

            // Admin nə siyahıda, nə də göstəricilərdə görünür.
            using (var list = await Send(client, new("GET", "/api/admin/users?take=100"), tokens[AppRoles.Admin]))
            {
                Expect(list, HttpStatusCode.OK, "admin istifadəçi siyahısını oxuya bilir");
                var payload = await list.Content.ReadAsStringAsync();
                Check(!payload.Contains(SystemAccounts.AdministratorEmail, StringComparison.OrdinalIgnoreCase),
                    "istifadəçi siyahısında sistem administratorunun e-poçtu görünmür");
                Check(!payload.Contains(owner.Id, StringComparison.Ordinal),
                    "istifadəçi siyahısında sistem administratorunun ID-si görünmür");
                Check(!payload.Contains($"\"{AppRoles.Admin}\"", StringComparison.Ordinal),
                    "istifadəçi siyahısında Admin rolu ümumiyyətlə keçmir");
            }
            using (var statistics = await Send(client, new("GET", "/api/admin/stats"), tokens[AppRoles.Admin]))
            {
                Expect(statistics, HttpStatusCode.OK, "admin statistikanı oxuya bilir");
                using var json = JsonDocument.Parse(await statistics.Content.ReadAsStringAsync());
                var reported = json.RootElement.GetProperty("data").GetProperty("totalUsers").GetInt32();
                int expected;
                using (var db = OpenDb())
                    expected = db.Users.FindAll().Count(candidate => !ProtectedAccountPolicy.IsHiddenAccount(candidate));
                Check(reported == expected,
                    $"qeydiyyat göstəricisi admini saymır (API {reported}, baza {expected})");
            }

            // Bazaya birbaşa yazılmış Admin rolu nə sorğuda keçir, nə də tətbiq açılanda qalır.
            var intruder = NewUser("dbadmin" + Guid.NewGuid().ToString("N")[..7], AppRoles.Admin);
            using (var db = OpenDb()) db.Users.Insert(intruder);
            var intruderSession = await Login(client, intruder, AppRoles.Admin);
            using (var denied = await Send(client, new("GET", "/api/admin/stats"), intruderSession.AccessToken))
                Expect(denied, HttpStatusCode.Unauthorized, "bazaya əl ilə yazılmış Admin rolu ilə sorğu keçmir");
            using (var db = OpenDb())
            {
                DbInitializer.EnforceSingleAdministrator(db, NullLogger.Instance);
                var cleaned = db.Users.FindById(intruder.Id);
                Check(cleaned.Roles.SequenceEqual(new[] { AppRoles.User }),
                    "başlanğıc qaydası yad hesabdan Admin rolunu silir");
                Check(cleaned.SecurityStamp != intruder.SecurityStamp,
                    "rolu geri alınan hesabın bütün sessiyaları ləğv edilir");
                Check(db.Users.FindById(owner.Id).Roles.SequenceEqual(new[] { AppRoles.Admin }),
                    "başlanğıc qaydası sabit administratora toxunmur");
                Check(db.Users.FindAll().Count(candidate => candidate.Roles.Contains(AppRoles.Admin)) == 1,
                    "bazada yalnız bir Admin qalır");
            }

            var selfRole = await NewSession(AppRoles.User);
            using (var changed = await Send(client, new("PATCH", "/api/user/role"), selfRole.Session.AccessToken, body: new { newRole = AppRoles.Teacher }))
                Expect(changed, HttpStatusCode.OK, "self-service can choose Teacher");
            using (var denied = await Send(client, new("GET", "/api/user/profile"), selfRole.Session.AccessToken))
                Expect(denied, HttpStatusCode.Unauthorized, "self-service role change revokes old access");
            using (var denied = await Refresh(client, selfRole.Session))
                Expect(denied, HttpStatusCode.BadRequest, "self-service role change revokes old refresh");

            // A profile write read before an admin revocation cannot restore the entire old document.
            using (var db = OpenDb())
            {
                var fixture = NewUser("stalestore", AppRoles.Admin);
                db.Users.Insert(fixture);
                var staleProfile = db.Users.FindById(fixture.Id);
                var revocation = db.Users.FindById(fixture.Id);
                var store = new LiteDbUserStore(db);
                revocation.Roles = [AppRoles.User];
                revocation.LockoutEnd = DateTimeOffset.UtcNow.AddDays(1);
                revocation.SecurityStamp = Guid.NewGuid().ToString();
                Check((await store.UpdateAsync(revocation, CancellationToken.None)).Succeeded, "security state change persists");
                staleProfile.FirstName = "Stale overwrite";
                Check(!(await store.UpdateAsync(staleProfile, CancellationToken.None)).Succeeded,
                    "stale profile update cannot overwrite role and block changes");
                Check(!(await store.DeleteAsync(staleProfile, CancellationToken.None)).Succeeded,
                    "stale user deletion fails optimistic concurrency check");
                var current = db.Users.FindById(fixture.Id);
                Check(current.Roles.SequenceEqual(new[] { AppRoles.User })
                    && current.LockoutEnd > DateTimeOffset.UtcNow
                    && current.SecurityStamp == revocation.SecurityStamp,
                    "current revoked security state survives stale document writes");
            }

            // One-time Google exchange codes must belong to the current account session.
            foreach (var state in new[] { "valid", "changed stamp", "missing expiry", "expired", "blocked", "unconfirmed" })
            {
                var fixture = NewUser("google" + Guid.NewGuid().ToString("N")[..7], AppRoles.User);
                var code = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
                fixture.GoogleLoginCodeHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
                fixture.GoogleLoginCodeExpiryTime = DateTime.UtcNow.AddMinutes(2);
                fixture.GoogleLoginCodeSecurityStamp = fixture.SecurityStamp;
                switch (state)
                {
                    case "changed stamp": fixture.SecurityStamp = Guid.NewGuid().ToString(); break;
                    case "missing expiry": fixture.GoogleLoginCodeExpiryTime = null; break;
                    case "expired": fixture.GoogleLoginCodeExpiryTime = DateTime.UtcNow.AddMinutes(-1); break;
                    case "blocked": fixture.LockoutEnd = DateTimeOffset.UtcNow.AddDays(1); break;
                    case "unconfirmed": fixture.EmailConfirmed = false; break;
                }
                using (var db = OpenDb()) db.Users.Insert(fixture);
                using var exchange = await client.PostAsJsonAsync("/api/auth/google/exchange", new { code });
                Expect(exchange, state == "valid" ? HttpStatusCode.OK : HttpStatusCode.BadRequest, "Google exchange " + state);
                using var replay = await client.PostAsJsonAsync("/api/auth/google/exchange", new { code });
                Expect(replay, HttpStatusCode.BadRequest, "Google exchange cannot replay " + state);
            }

            await RunRemediationTests(client, OpenDb, accounts, tokens, sandbox);
            Console.WriteLine($"Security regression tests: {_assertions - Failures.Count}/{_assertions} passed.");
            foreach (var failure in Failures) Console.Error.WriteLine("FAIL: " + failure);
            return Failures.Count == 0 ? 0 : 1;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"Test harness failed: {exception.GetType().Name}: {exception.Message}");
            foreach (var line in diagnostics.TakeLast(12)) Console.Error.WriteLine(line);
            return 1;
        }
        finally
        {
            if (api is not null)
            {
                if (!api.HasExited) api.Kill(entireProcessTree: true);
                await api.WaitForExitAsync();
                api.Dispose();
            }
            if (stdout is not null) await stdout;
            if (stderr is not null) await stderr;
            // Only this uniquely created test directory is eligible for deletion.
            var fullSandbox = Path.GetFullPath(sandbox);
            var tempRoot = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
            if (fullSandbox.StartsWith(tempRoot, StringComparison.OrdinalIgnoreCase)
                && Path.GetFileName(fullSandbox).StartsWith("kiberaz-security-", StringComparison.Ordinal)
                && Directory.Exists(fullSandbox))
                Directory.Delete(fullSandbox, recursive: true);
        }
    }

    private static AppUser NewUser(string name, string role)
    {
        var user = new AppUser
        {
            UserName = name, NormalizedUserName = name.ToUpperInvariant(), Nickname = name,
            Email = name + "@example.invalid", NormalizedEmail = name.ToUpperInvariant() + "@EXAMPLE.INVALID",
            EmailConfirmed = true, FirstName = "Fixture", LastName = "Tester", Gender = Gender.Male,
            SecurityStamp = Guid.NewGuid().ToString("N"), Roles = [role]
        };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, Password);
        return user;
    }

    private static async Task<AuthSession> Login(HttpClient client, AppUser user, string expectedRole)
    {
        using var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = user.Email, password = Password, roles = new[] { AppRoles.Admin }, role = AppRoles.Admin, isAdmin = true
        });
        Expect(response, HttpStatusCode.OK, $"{expectedRole} uses ordinary /api/auth/login");
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"{expectedRole} fixture login failed.");
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        var roles = data.GetProperty("user").GetProperty("roles").EnumerateArray().Select(role => role.GetString()).ToArray();
        Check(roles.SequenceEqual(new[] { expectedRole }), $"{expectedRole} login ignores role overposting");
        Check(!data.TryGetProperty("refreshToken", out var refresh) || string.IsNullOrEmpty(refresh.GetString()),
            $"{expectedRole} login does not expose refresh token in JSON");
        Check(response.Headers.TryGetValues("Set-Cookie", out var cookies) && cookies.Any(cookie =>
                cookie.Contains("httponly", StringComparison.OrdinalIgnoreCase)
                && cookie.Contains("samesite=strict", StringComparison.OrdinalIgnoreCase)),
            $"{expectedRole} refresh token uses HttpOnly SameSite=Strict cookie");
        return await ReadSession(response);
    }

    private static async Task<AuthSession> ReadSession(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var token = json.RootElement.GetProperty("data").GetProperty("accessToken").GetString()
            ?? throw new InvalidOperationException("Authentication returned no access token.");
        var cookie = response.Headers.GetValues("Set-Cookie")
            .Select(header => header.Split(';')[0])
            .Single(header => header.StartsWith("refresh_token=", StringComparison.Ordinal));
        return new(token, cookie);
    }

    private static async Task<HttpResponseMessage> Refresh(HttpClient client, AuthSession session)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh");
        request.Headers.Add("Cookie", session.RefreshCookie);
        request.Content = JsonContent.Create(new { accessToken = session.AccessToken });
        return await client.SendAsync(request);
    }

    private static IEnumerable<ProtectedRoute> GetProtectedRoutes()
    {
        foreach (var controller in new[] { typeof(AdminController), typeof(QuizController) })
        {
            var prefix = controller.GetCustomAttribute<RouteAttribute>()!.Template
                .Replace("[controller]", controller.Name.Replace("Controller", "", StringComparison.Ordinal), StringComparison.Ordinal);
            foreach (var action in controller.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly))
            {
                var adminOnly = controller == typeof(AdminController)
                    || action.GetCustomAttributes<AuthorizeAttribute>().Any(attribute =>
                        attribute.Roles?.Split(',').Contains(AppRoles.Admin) == true);
                if (!adminOnly) continue;
                foreach (var attribute in action.GetCustomAttributes<HttpMethodAttribute>())
                {
                    var path = "/" + prefix + "/" + (attribute.Template ?? "");
                    path = Regex.Replace(path, @"\{[^}]+\}", match =>
                        match.Value.Contains(":int", StringComparison.Ordinal) ? "2147483000" : "security-test-missing");
                    foreach (var method in attribute.HttpMethods)
                        yield return new(method, path.ToLowerInvariant());
                }
            }
        }
    }

    private static async Task<HttpResponseMessage> Send(HttpClient client, ProtectedRoute route, string? token, bool spoofAdmin = false, object? body = null)
    {
        using var request = new HttpRequestMessage(new HttpMethod(route.Method), route.Path + (spoofAdmin ? "?role=Admin&isAdmin=true" : ""));
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (spoofAdmin)
        {
            request.Headers.Add("X-Role", "Admin");
            request.Headers.Add("X-User-Role", "Admin");
            request.Headers.Add("X-Admin", "true");
        }
        if (route.Method is "POST" or "PATCH" or "PUT") request.Content = JsonContent.Create(body ?? new { role = "Admin" });
        return await client.SendAsync(request);
    }

    private static string MakeToken(AppUser user, string? key = null, bool unsigned = false, DateTime? expires = null,
        string issuer = Issuer, string audience = Audience, string? stamp = null, bool omitStamp = false,
        bool omitSubject = false, string[]? roles = null, string algorithm = SecurityAlgorithms.HmacSha256)
    {
        var claims = new List<Claim>();
        if (!omitSubject) claims.Add(new(JwtRegisteredClaimNames.Sub, user.Id));
        if (!omitStamp && (stamp ?? user.SecurityStamp) is { } securityStamp) claims.Add(new(TokenService.SecurityStampClaimType, securityStamp));
        claims.AddRange((roles ?? user.Roles.ToArray()).Select(role => new Claim(ClaimTypes.Role, role)));
        var token = new JwtSecurityToken(issuer, audience, claims, expires: expires ?? DateTime.UtcNow.AddMinutes(5),
            signingCredentials: unsigned ? null : new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key ?? SigningKey)), algorithm));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static void Expect(HttpResponseMessage response, HttpStatusCode expected, string name) =>
        Check(response.StatusCode == expected, $"{name}: expected {(int)expected}, got {(int)response.StatusCode}");

    private static void Check(bool condition, string message)
    {
        _assertions++;
        if (!condition) Failures.Add(message);
    }

    private static int ReservePort()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        return ((IPEndPoint)listener.LocalEndpoint).Port;
    }

    private static async Task Capture(StreamReader reader, ConcurrentQueue<string> diagnostics)
    {
        while (await reader.ReadLineAsync() is { } line)
        {
            diagnostics.Enqueue(line);
            while (diagnostics.Count > 30) diagnostics.TryDequeue(out _);
        }
    }

    private static async Task WaitForApi(HttpClient client, Process process)
    {
        var deadline = DateTime.UtcNow.AddSeconds(30);
        while (DateTime.UtcNow < deadline)
        {
            if (process.HasExited) throw new InvalidOperationException($"Isolated API exited with code {process.ExitCode}.");
            try
            {
                using var response = await client.GetAsync("/api/auth/me");
                if (response.StatusCode == HttpStatusCode.Unauthorized) return;
            }
            catch (HttpRequestException) { }
            await Task.Delay(100);
        }
        throw new TimeoutException("Isolated API did not become ready within 30 seconds.");
    }

    private sealed record ProtectedRoute(string Method, string Path)
    {
        public override string ToString() => Method + " " + Path;
    }

    private sealed record AuthSession(string AccessToken, string RefreshCookie);

    private sealed class TestEnvironment(string contentRoot) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "Kiberaz.SecurityRegressionTests";
        public string ContentRootPath { get; set; } = contentRoot;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
