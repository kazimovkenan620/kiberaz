// Bir dəfəlik dev alət: LiteDB-dəki "Users" collection-unu tamamilə təmizləyir
// (bütün qeydiyyatlar, e-poçtlar, şifrə hash-ləri, tokenlər).
// Digər collection-lara (Roles, Courses, Articles, QuizCategories, QuizQuestions, QuizResults) TOXUNMUR.
//
// İşlətmək: bu qovluqdan (tools/ClearUsersTool) "dotnet run" çağır.
// Backend (Kiberaz.Api) işə düşübsə, əvvəlcə onu dayandırmaq tövsiyə olunur.

using LiteDB;
using Kiberaz.Domain.Entities;

string dbPath = args.Length > 0
    ? args[0]
    : Path.Combine("..", "..", "Kiberaz.Infrastructure", "Data", "Kiberaz.db");

string fullPath = Path.GetFullPath(dbPath);

Console.WriteLine($"DB faylı: {fullPath}");

if (!File.Exists(fullPath))
{
    Console.WriteLine("XƏTA: DB faylı tapılmadı.");
    return;
}

var connectionString = new ConnectionString
{
    Filename = fullPath,
    Connection = ConnectionType.Shared
};

using var db = new LiteDatabase(connectionString);

var users = db.GetCollection<AppUser>("Users");
int before = users.Count();
Console.WriteLine($"Silinmədən əvvəl istifadəçi sayı: {before}");

if (before == 0)
{
    Console.WriteLine("Users collection artıq boşdur — heç nə edilmədi.");
    return;
}

int deleted = users.DeleteAll();
Console.WriteLine($"Silindi: {deleted} istifadəçi.");
Console.WriteLine($"Qalan istifadəçi sayı: {users.Count()}");
Console.WriteLine("Bitdi. Roles/Courses/Articles/QuizCategories/QuizQuestions collection-larına toxunulmadı.");
