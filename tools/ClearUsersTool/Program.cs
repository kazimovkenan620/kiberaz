// Dev aləti: LiteDB-dəki istifadəçiləri silir.
//
// İşlətmək (tools/ClearUsersTool qovluğundan):
//   dotnet run -- --list                        → kimin olduğunu göstərir, HEÇ NƏ SİLMİR
//   dotnet run -- --email a@b.com               → yalnız o hesabı silir
//   dotnet run -- --nickname mrk4z1m0v          → yalnız o ləqəbli hesabı silir
//   dotnet run -- --all --confirm               → BÜTÜN istifadəçiləri silir
//
// Qeyd: --all təsadüfən işə düşməsin deyə ayrıca --confirm tələb edir.
// Silinən istifadəçinin quiz nəticələri də təmizlənir — əks halda liderlik lövhəsində
// sahibsiz qeydlər qalır və hesablamaları pozur.
//
// Backend işləyirsə əvvəlcə onu dayandır (LiteDB fayl kilidi).

using LiteDB;
using Kiberaz.Domain.Entities;

var argList = args.ToList();

string? GetOption(string name)
{
    int i = argList.IndexOf(name);
    return i >= 0 && i + 1 < argList.Count ? argList[i + 1] : null;
}

bool listOnly = argList.Contains("--list");
bool deleteAll = argList.Contains("--all");
bool confirmed = argList.Contains("--confirm");
string? email = GetOption("--email");
string? nickname = GetOption("--nickname");
string? pathArg = GetOption("--db");

string dbPath = pathArg ?? Path.Combine("..", "..", "Kiberaz.Infrastructure", "Data", "Kiberaz.db");
string fullPath = Path.GetFullPath(dbPath);

Console.WriteLine($"DB faylı: {fullPath}");

if (!File.Exists(fullPath))
{
    Console.WriteLine("XƏTA: DB faylı tapılmadı.");
    return 1;
}

var connectionString = new ConnectionString
{
    Filename = fullPath,
    Connection = ConnectionType.Shared
};

using var db = new LiteDatabase(connectionString);

var users = db.GetCollection<AppUser>("Users");
var quizResults = db.GetCollection<QuizResult>("QuizResults");
var teacherClasses = db.GetCollection<TeacherClass>("TeacherClasses");

var all = users.FindAll().ToList();
Console.WriteLine($"Bazadakı istifadəçi sayı: {all.Count}");

if (all.Count == 0)
{
    Console.WriteLine("Users collection boşdur — heç nə edilmədi.");
    return 0;
}

// ── Siyahı rejimi: heç nə silinmir ──────────────────────────
if (listOnly || (!deleteAll && email is null && nickname is null))
{
    Console.WriteLine();
    Console.WriteLine("Mövcud istifadəçilər:");
    foreach (var u in all)
    {
        var roles = u.Roles.Count > 0 ? string.Join(", ", u.Roles) : "rolsuz";
        var confirmedMark = u.EmailConfirmed ? "təsdiqli" : "TƏSDİQSİZ";
        Console.WriteLine($"  • {u.Nickname,-20} {u.Email,-32} [{roles}] {confirmedMark}");
    }

    if (!listOnly)
    {
        Console.WriteLine();
        Console.WriteLine("Heç bir filtr verilmədi — təhlükəsizlik üçün heç nə silinmədi.");
        Console.WriteLine("İşlətmək: --email <e-poçt> | --nickname <ləqəb> | --all --confirm");
    }
    return 0;
}

// ── Silinəcəkləri seç ───────────────────────────────────────
List<AppUser> targets;

if (deleteAll)
{
    if (!confirmed)
    {
        Console.WriteLine("--all təhlükəlidir: bütün hesabları silir. Təsdiq üçün --confirm əlavə et.");
        return 1;
    }
    targets = all;
}
else
{
    targets = all.Where(u =>
        (email is not null && string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)) ||
        (nickname is not null && string.Equals(u.Nickname, nickname, StringComparison.OrdinalIgnoreCase)))
        .ToList();
}

if (targets.Count == 0)
{
    Console.WriteLine("Bu filtrə uyğun istifadəçi tapılmadı — heç nə silinmədi.");
    return 0;
}

Console.WriteLine();
Console.WriteLine($"Silinəcək: {targets.Count} hesab");
foreach (var u in targets)
    Console.WriteLine($"  • {u.Nickname} ({u.Email})");

// ── Sil ─────────────────────────────────────────────────────
int deletedResults = 0;
int cleanedClasses = 0;

foreach (var u in targets)
{
    // Sahibsiz quiz nəticələri liderlik lövhəsində "yoxa çıxmış istifadəçi" kimi qalır.
    deletedResults += quizResults.DeleteMany(r => r.UserId == u.Id);

    // Müəllim sinifləri: silinən tələbə siyahılardan çıxarılır.
    foreach (var cls in teacherClasses.FindAll().ToList())
    {
        int removed = cls.Students.RemoveAll(s => s.StudentId == u.Id);
        if (removed > 0)
        {
            teacherClasses.Update(cls);
            cleanedClasses += removed;
        }
    }

    users.Delete(u.Id);
}

Console.WriteLine();
Console.WriteLine($"Silindi: {targets.Count} istifadəçi.");
Console.WriteLine($"Təmizləndi: {deletedResults} quiz nəticəsi, {cleanedClasses} sinif üzvlüyü.");
Console.WriteLine($"Qalan istifadəçi sayı: {users.Count()}");
Console.WriteLine("Roles / Courses / QuizCategories / QuizQuestions collection-larına toxunulmadı.");
return 0;
