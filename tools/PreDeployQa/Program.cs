using System.Security.Cryptography;
using System.Text.Json;
using JsonSerializer = System.Text.Json.JsonSerializer;
using Kiberaz.Domain.Common;
using Kiberaz.Domain.Entities;
using Kiberaz.Domain.Enums;
using Kiberaz.Infrastructure.Data;
using Kiberaz.Infrastructure.Identity;
using LiteDB;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

const string runName = "20260917T-predeploy-132107";
var expectedRoot = Path.GetFullPath(Path.Combine(Path.GetTempPath(), runName, "runtime"));
var json = new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
if (args.Length != 2 || args[0] is not ("init" or "inspect")
    || !string.Equals(Path.GetFullPath(args[1]), expectedRoot, StringComparison.OrdinalIgnoreCase))
{
    Console.Error.WriteLine("Yalnız init/inspect və bu audit üçün ayrılmış müvəqqəti runtime yolu qəbul edilir.");
    return 2;
}
for (var current = new DirectoryInfo(expectedRoot); current is not null; current = current.Parent)
    if (current.Exists && (current.Attributes & FileAttributes.ReparsePoint) != 0)
    {
        Console.Error.WriteLine("Simvolik keçid/reparse qovluğu qəbul edilmir.");
        return 2;
    }
var databasePath = Path.Combine(expectedRoot, "qa.db");
var markerPath = Path.Combine(expectedRoot, ".synthetic-qa");
if (args[0] == "inspect")
{
    if (!File.Exists(markerPath) || File.ReadAllText(markerPath) != runName || !File.Exists(databasePath))
    {
        Console.Error.WriteLine("Sintetik baza nişanı tapılmadı; oxunuş rədd edildi.");
        return 2;
    }
    // Offline baxış indeks yaratmır və bazaya yazmır.
    using var readOnly = new LiteDatabase(new ConnectionString { Filename = databasePath, ReadOnly = true });
    var counts = readOnly.GetCollectionNames().Order().ToDictionary(name => name,
        name => readOnly.GetCollection(name).Count());
    var states = readOnly.GetCollection("Users").FindAll().Select(user => new
    {
        Id = user["_id"].AsString,
        Nickname = user["Nickname"].AsString,
        Roles = user["Roles"].AsArray.Select(role => role.AsString).ToArray(),
        EmailConfirmed = user["EmailConfirmed"].AsBoolean,
        HasLockout = !user["LockoutEnd"].IsNull,
        HasAdminBlock = !user["BlockedByAdminAt"].IsNull,
        RefreshSessionCount = user["RefreshSessions"].AsArray.Count
    }).ToArray();
    Console.WriteLine(JsonSerializer.Serialize(new { Counts = counts, Accounts = states }, json));
    return 0;
}
if (Directory.Exists(expectedRoot) && Directory.EnumerateFileSystemEntries(expectedRoot).Any())
{
    Console.Error.WriteLine("Mövcud runtime məzmunu qorunur; yenidən init qadağandır.");
    return 2;
}
Directory.CreateDirectory(expectedRoot);
using (var marker = new StreamWriter(new FileStream(markerPath, FileMode.CreateNew, FileAccess.Write)))
    marker.Write(runName);
var settings = new Dictionary<string, string?>
{
    ["ConnectionStrings:LiteDb"] = $"Filename={databasePath};Connection=direct",
    ["JwtSettings:SecretKey"] = Convert.ToHexString(RandomNumberGenerator.GetBytes(64)),
    ["JwtSettings:Issuer"] = "kiberaz-predeploy-qa",
    ["JwtSettings:Audience"] = "kiberaz-predeploy-browser",
    ["JwtSettings:AccessTokenExpirationMinutes"] = "15",
    ["DataProtection:KeysPath"] = Path.Combine(expectedRoot, "keys"),
    ["Authentication:Google:ClientId"] = "",
    ["Authentication:Google:ClientSecret"] = "",
    ["Captcha:SecretKey"] = "1x0000000000000000000000000000000AA",
    ["Captcha:AllowDevelopmentBypass"] = "false",
    ["EmailSettings:SmtpHost"] = "127.0.0.1",
    ["EmailSettings:SmtpPort"] = "9",
    ["EmailSettings:SmtpUsername"] = "",
    ["EmailSettings:SmtpPassword"] = "",
    ["EmailSettings:FromEmail"] = "no-email@example.invalid",
    ["FrontendUrl"] = "http://localhost:5189",
    ["AllowedHosts"] = "localhost",
    ["Urls"] = "http://localhost:5259",
    ["Logging:LogLevel:Default"] = "Warning",
    ["Logging:LogLevel:Microsoft.AspNetCore"] = "Warning"
};
await File.WriteAllTextAsync(Path.Combine(expectedRoot, "appsettings.json"), JsonSerializer.Serialize(settings, json));
// API bu faylı developer secrets-dən sonra oxuyur; yalnız sintetik qovluqdadır.
await File.WriteAllTextAsync(Path.Combine(expectedRoot, "appsettings.Local.json"), JsonSerializer.Serialize(settings, json));
var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
var accounts = new List<FixtureAccount>();
var questions = new List<object>();
var categories = new List<object>();
var categoryIds = new Dictionary<string, int>();
var now = DateTime.UtcNow;
using (var db = new LiteDbContext(config, new FixtureEnvironment(expectedRoot)))
{
    foreach (var role in new[] { AppRoles.User, AppRoles.Teacher, AppRoles.VIP, AppRoles.Moderator, AppRoles.Admin })
    {
        db.Roles.Insert(new AppRole { Name = role, NormalizedName = role.ToUpperInvariant() });
        foreach (var suffix in role == AppRoles.Admin ? new[] { "A" } : new[] { "A", "B" })
            AddAccount(role + suffix, role, true, false);
    }
    AddAccount("Unconfirmed", AppRoles.User, false, false);
    AddAccount("Blocked", AppRoles.User, true, true);

    void AddAccount(string label, string role, bool confirmed, bool blocked)
    {
        var password = "Qa1!" + Convert.ToHexString(RandomNumberGenerator.GetBytes(18));
        var nickname = "qa" + label.ToLowerInvariant();
        var email = role == AppRoles.Admin ? SystemAccounts.AdministratorEmail : nickname + "@example.invalid";
        var user = new AppUser
        {
            UserName = nickname, NormalizedUserName = nickname.ToUpperInvariant(), Nickname = nickname,
            Email = email, NormalizedEmail = email.ToUpperInvariant(), EmailConfirmed = confirmed,
            FirstName = "Sınaq", LastName = label, Gender = Gender.Male, CreatedAt = now,
            SecurityStamp = Guid.NewGuid().ToString(), Roles = [role],
            LockoutEnd = blocked ? DateTimeOffset.UtcNow.AddDays(1) : null,
            BlockedByAdminAt = blocked ? now : null
        };
        user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, password);
        db.Users.Insert(user);
        accounts.Add(new(label, user.Id, email, nickname, role, password));
        if (role == AppRoles.VIP)
            db.VipTerms.Insert(new VipTerm { UserId = user.Id, StartsAt = now.AddMinutes(-1),
                EndsAt = now.AddDays(VipPolicy.TermDays), Source = VipPolicy.SourceAdmin });
    }
    foreach (var privateBank in new[] { false, true })
    {
        var category = new QuizCategory
        {
            Title = privateBank ? "QA Qapalı İmtahan" : "QA Açıq Praktika", Icon = "shield",
            Description = "Yalnız sintetik audit sualları", Color = "#00FFFF", Topics = ["QA"],
            SortOrder = privateBank ? 2 : 1, CreatedAt = now
        };
        db.QuizCategories.Insert(category);
        categoryIds[privateBank ? "examId" : "publicId"] = category.Id;
        categories.Add(new { category.Id, category.Title, IsExamOnly = privateBank });
        foreach (var index in Enumerable.Range(0, 4))
        {
            var key = ((char)('A' + index)).ToString();
            var question = new QuizQuestion
            {
                QuizCategoryId = category.Id, IsExamOnly = privateBank, Difficulty = DifficultyLevel.Beginner,
                QuestionText = $"QA {(privateBank ? "qapalı" : "açıq")} sintetik sual {index + 1}",
                CorrectOptionKey = key, CreatedAt = now,
                Options = new[] { "A", "B", "C", "D" }.Select(option => new QuizOption
                    { Key = option, Text = "Sintetik variant " + option, Explanation = "Sintetik QA izahı" }).ToList()
            };
            db.QuizQuestions.Insert(question);
            questions.Add(new { question.Id, CategoryId = category.Id, question.IsExamOnly, Sequence = index + 1 });
        }
    }
    if (db.Users.Count() != 11 || db.QuizQuestions.Count() != 8 || db.VipTerms.Count() != 2
        || db.Users.FindAll().Count(user => user.Roles.Contains(AppRoles.Admin)) != 1)
        throw new InvalidOperationException("Sintetik fikstürün say invariantı ödənmədi.");
}
await File.WriteAllTextAsync(Path.Combine(expectedRoot, "accounts.json"), JsonSerializer.Serialize(new
{
    Accounts = accounts.Select(account => new { Alias = account.Label, account.Id, account.Email,
        account.Password, account.Role, account.Nickname }),
    Categories = categoryIds
}, json));

// Yalnız fikstür üçün əvvəlcədən token yaradılır; e-poçt servisi və HTTP yoxdur.
var services = new ServiceCollection();
services.AddLogging();
services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(expectedRoot, "keys")))
    .SetApplicationName("kiberaz");
services.AddSingleton<IConfiguration>(config);
services.AddSingleton<IHostEnvironment>(new FixtureEnvironment(expectedRoot));
services.AddSingleton<LiteDbContext>();
services.AddIdentity<AppUser, AppRole>().AddUserStore<LiteDbUserStore>().AddRoleStore<LiteDbRoleStore>()
    .AddDefaultTokenProviders();
services.Configure<DataProtectionTokenProviderOptions>(options => options.TokenLifespan = TimeSpan.FromHours(2));
using (var provider = services.BuildServiceProvider())
using (var scope = provider.CreateScope())
{
    var manager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
    var tokens = new List<object>();
    foreach (var account in accounts.Where(account => account.Label is "UserA" or "UserB" or "Unconfirmed"))
    {
        var user = await manager.FindByIdAsync(account.Id) ?? throw new InvalidOperationException("Fikstür tapılmadı.");
        tokens.Add(new { account.Label, UserId = user.Id,
            ConfirmationToken = await manager.GenerateEmailConfirmationTokenAsync(user),
            PasswordResetToken = await manager.GeneratePasswordResetTokenAsync(user) });
    }
    await File.WriteAllTextAsync(Path.Combine(expectedRoot, "tokens.private.json"), JsonSerializer.Serialize(tokens, json));
}
var manifest = new
{
    Run = runName, CreatedUtc = now, Environment = "Development", Api = "http://localhost:5259",
    Frontend = "http://localhost:5189", Database = "qa.db",
    Accounts = accounts.Select(account => new { account.Label, account.Id, account.Nickname, account.Role }),
    Categories = categories, Questions = questions
};
await File.WriteAllTextAsync(Path.Combine(expectedRoot, "fixture-manifest.json"), JsonSerializer.Serialize(manifest, json));
Console.WriteLine("Sintetik fikstür hazırdır: 11 hesab, 2 kateqoriya, 8 sual, 2 aktiv VIP dövrü. Baza bağlandı.");
return 0;

internal sealed record FixtureAccount(string Label, string Id, string Email, string Nickname, string Role, string Password);
internal sealed class FixtureEnvironment(string root) : IHostEnvironment
{
    public string EnvironmentName { get; set; } = Environments.Development;
    public string ApplicationName { get; set; } = "Kiberaz.Api";
    public string ContentRootPath { get; set; } = root;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
